import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  FlatList,
  Share,
  Platform,
  TextInput,
} from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { handleMessage } from '../../services/MessageHandler';
import { VectorLogo } from '../../components/VectorLogo';
import { CurrentUserResponse, PositionOptionValue, RootStackParamList } from '../../../global';
import { getTalonsForVoditelExport, ITalonExportData } from '../../db/talons_of_combainers';

/**
 * Экран выгрузки талонов водителя
 */
const VoditelTalonsExport: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [loading, setLoading] = useState(true);
  const [loadingTalons, setLoadingTalons] = useState(false);
  const [data, setData] = useState<CurrentUserResponse | null>(null);
  const [talons, setTalons] = useState<ITalonExportData[]>([]);

  // Состояния для фильтра по дате
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)); // 7 дней назад
  const [endDate, setEndDate] = useState(new Date());
  const [showDateInput, setShowDateInput] = useState(false);
  const [dateInputType, setDateInputType] = useState<'start' | 'end'>('start');
  const [tempDateInput, setTempDateInput] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await handleMessage({
          req: {
            type: 'currentUser',
            data: { context: 'voditel' as PositionOptionValue },
          },
          reqId: 'getCurrentUser_' + Date.now(),
        });

        if (response.type === 'currentUser') {
          setData(response);

          // Автоматически загружаем талоны за последние 7 дней
          if (response.voditelData?.id) {
            await loadTalons(response.voditelData.id, startDate, endDate);
          }
        } else {
          throw new Error('Failed to get current user');
        }
      } catch (error: unknown) {
        console.error('Ошибка загрузки данных:', error);
        const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
        Alert.alert('Ошибка', `Не удалось загрузить данные водителя. ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const loadTalons = async (voditelId: string, fromDate: Date, toDate: Date) => {
    try {
      setLoadingTalons(true);
      const startTime = fromDate.getTime();
      const endTime = toDate.getTime() + (24 * 60 * 60 * 1000 - 1); // конец дня

      const exportData = await getTalonsForVoditelExport(voditelId, startTime, endTime);
      setTalons(exportData);
    } catch (error) {
      console.error('Ошибка загрузки талонов:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить талоны');
    } finally {
      setLoadingTalons(false);
    }
  };

  const showDateInputDialog = (type: 'start' | 'end') => {
    setDateInputType(type);
    const currentDate = type === 'start' ? startDate : endDate;
    setTempDateInput(currentDate.toISOString().split('T')[0]); // YYYY-MM-DD format
    setShowDateInput(true);
  };

  const handleDateInputConfirm = () => {
    try {
      const newDate = new Date(tempDateInput + 'T00:00:00');
      if (isNaN(newDate.getTime())) {
        Alert.alert('Ошибка', 'Неверный формат даты');
        return;
      }

      if (dateInputType === 'start') {
        setStartDate(newDate);
      } else {
        setEndDate(newDate);
      }
      setShowDateInput(false);
    } catch (error) {
      Alert.alert('Ошибка', 'Неверный формат даты');
    }
  };

  const setPresetDates = (days: number) => {
    const end = new Date();
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    setStartDate(start);
    setEndDate(end);
  };

  const handleFilterChange = async () => {
    if (!data?.voditelData?.id) return;
    await loadTalons(data.voditelData.id, startDate, endDate);
  };

  const exportToCSV = () => {
    if (talons.length === 0) {
      Alert.alert('Внимание', 'Нет данных для экспорта');
      return;
    }

    const headers =
      'Порядковый номер,Номер талона,Выгрузка (кг),Вес (кг),Время создания,ФИО комбайнера,Статус\n';
    const csvContent = talons
      .map(
        (talon) =>
          `${talon.serialNumber},${talon.talonNumber},${talon.unloadWeight || 'Не указан'},${talon.nominalWeight || 'Не указан'},"${new Date(talon.createdTime).toLocaleString('ru-RU')}","${talon.fio}","${talon.status}"`
      )
      .join('\n');

    const fullCSV = headers + csvContent;

    Share.share({
      message: fullCSV,
      title: `Талоны водителя за период ${startDate.toLocaleDateString('ru-RU')} - ${endDate.toLocaleDateString('ru-RU')}`,
    }).catch((error) => {
      console.error('Ошибка экспорта:', error);
      Alert.alert('Ошибка', 'Не удалось экспортировать данные');
    });
  };

  const renderTalonItem = ({ item }: { item: ITalonExportData }) => (
    <View style={styles.talonItem} key={item.serialNumber}>
      <View style={styles.talonRow}>
        <Text style={styles.talonLabel}>№ {item.serialNumber}</Text>
        <Text style={styles.talonNumber}>Талон {item.talonNumber}</Text>
      </View>
      <View style={styles.talonRow}>
        <Text style={styles.talonLabel}>Выгрузка:</Text>
        <Text style={styles.talonValue}>
          {item.unloadWeight ? `${item.unloadWeight} кг` : 'Не указан'}
        </Text>
      </View>
      <View style={styles.talonRow}>
        <Text style={styles.talonLabel}>Вес:</Text>
        <Text style={styles.talonValue}>
          {item.nominalWeight ? `${item.nominalWeight} кг` : 'Не указан'}
        </Text>
      </View>
      <View style={styles.talonRow}>
        <Text style={styles.talonLabel}>Время:</Text>
        <Text style={styles.talonValue}>{new Date(item.createdTime).toLocaleString('ru-RU')}</Text>
      </View>
      <View style={styles.talonRow}>
        <Text style={styles.talonLabel}>Комбайнер:</Text>
        <Text style={styles.talonValue}>{item.fio}</Text>
      </View>
      <View style={styles.talonRow}>
        <Text style={styles.talonLabel}>Статус:</Text>
        <Text style={[styles.talonValue, styles.statusText]}>{item.status}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5a7d2b" />
        <Text style={styles.loadingText}>Загрузка данных...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoContainer}>
          <VectorLogo />
        </View>

        <Text style={styles.title}>Выгрузка талонов</Text>
        <Text style={styles.subtitle}>Водитель: {data?.userData?.fio}</Text>

        {/* Фильтр по дате */}
        <View style={styles.filterContainer}>
          <Text style={styles.filterTitle}>Период:</Text>

          {/* Быстрые фильтры */}
          <View style={styles.presetButtonsContainer}>
            <TouchableOpacity style={styles.presetButton} onPress={() => setPresetDates(1)}>
              <Text style={styles.presetButtonText}>Сегодня</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetButton} onPress={() => setPresetDates(7)}>
              <Text style={styles.presetButtonText}>7 дней</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetButton} onPress={() => setPresetDates(30)}>
              <Text style={styles.presetButtonText}>30 дней</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.dateButton} onPress={() => showDateInputDialog('start')}>
            <Text style={styles.dateButtonText}>С: {startDate.toLocaleDateString('ru-RU')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dateButton} onPress={() => showDateInputDialog('end')}>
            <Text style={styles.dateButtonText}>По: {endDate.toLocaleDateString('ru-RU')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.applyButton}
            onPress={handleFilterChange}
            disabled={loadingTalons}
          >
            <Text style={styles.applyButtonText}>
              {loadingTalons ? 'Загрузка...' : 'Применить'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Статистика */}
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>Найдено талонов: {talons.length}</Text>
          {/* {talons.length > 0 && (
            <TouchableOpacity style={styles.exportButton} onPress={exportToCSV}>
              <Text style={styles.exportButtonText}>Экспортировать CSV</Text>
            </TouchableOpacity>
          )} */}
        </View>

        {/* Список талонов */}
        {loadingTalons ? (
          <View style={styles.loadingTalonsContainer}>
            <ActivityIndicator size="large" color="#5a7d2b" />
            <Text style={styles.loadingText}>Загрузка талонов...</Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {talons.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Талоны за выбранный период не найдены</Text>
              </View>
            ) : (
              // Сортируем талоны по убыванию времени создания
              [...talons]
                .sort((a, b) => b.createdTime - a.createdTime)
                .map((item) => renderTalonItem({ item }))
            )}
          </View>
        )}

        {/* Отступ для кнопки "Назад" */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Кнопка "Назад" */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>Назад</Text>
      </TouchableOpacity>

      {/* Модальное окно для ввода даты */}
      {showDateInput && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              {dateInputType === 'start' ? 'Начальная дата' : 'Конечная дата'}
            </Text>
            <TextInput
              style={styles.dateInput}
              value={tempDateInput}
              onChangeText={setTempDateInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#999"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setShowDateInput(false)}>
                <Text style={styles.modalButtonText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleDateInputConfirm}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                  Подтвердить
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  bottomSpacer: {
    height: 80, // Высота для кнопки "Назад"
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingTalonsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
  },
  filterContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  presetButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  presetButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
    marginHorizontal: 2,
  },
  presetButtonText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  dateButton: {
    backgroundColor: '#5a7d2b',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  dateButtonText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  applyButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statsText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  exportButton: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  talonItem: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  talonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  talonLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    flex: 1,
  },
  talonNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#5a7d2b',
  },
  talonValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  statusText: {
    fontWeight: '500',
    color: '#5a7d2b',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  backButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#666',
    padding: 15,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 8,
    padding: 20,
    minWidth: 280,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#333',
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    marginHorizontal: 5,
    backgroundColor: '#f0f0f0',
  },
  modalButtonPrimary: {
    backgroundColor: '#5a7d2b',
  },
  modalButtonText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#333',
  },
  modalButtonTextPrimary: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default VoditelTalonsExport;
