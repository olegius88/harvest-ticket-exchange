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
} from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { handleMessage } from '../../services/MessageHandler';
import { VectorLogo } from '../../components/VectorLogo';
import { CurrentUserResponse, PositionOptionValue, RootStackParamList } from '../../../global';
import { getTalonsByVoditelId, ICreateTalonsParams } from '../../db/talons_of_combainers';
import { getReadableStatus } from '../../utils/statusUtils';
import { StatusBadge } from '../../components/StatusBadge';

/**
 * Экран реестра талонов водителя
 */
const VoditelTalonsRegistry: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CurrentUserResponse | null>(null);
  const [talons, setTalons] = useState<ICreateTalonsParams[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await handleMessage({
          req: {
            type: 'currentUser',
            data: { context: 'voditel' as PositionOptionValue },
          },
          reqId: 'getCurrentUser_' + Date.now(),
        });

        if (response.type === 'currentUser') {
          setData(response);

          // Загружаем талоны водителя
          if (response.voditelData?.id) {
            await loadTalons(response.voditelData.id);
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

  const loadTalons = async (voditelId: string) => {
    try {
      console.log('loadTalons|voditelId=', voditelId);
      const talonsData = await getTalonsByVoditelId(voditelId);
      console.log('loadTalons|получено талонов:', talonsData.length);
      setTalons(talonsData);
    } catch (error) {
      console.error('Ошибка загрузки талонов:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить талоны');
    }
  };

  const handleTalonPress = (talon: ICreateTalonsParams) => {
    navigation.navigate('VoditelTalonDetailScreen', { talon });
  };

  const goBack = () => {
    navigation.goBack();
  };

  const renderTalonItem = ({ item }: { item: ICreateTalonsParams }) => (
    <TouchableOpacity
      style={styles.talonItem}
      onPress={() => handleTalonPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.talonHeader}>
        <Text style={styles.talonNumber}>Талон {item.talonNumber || item.id}</Text>
        <StatusBadge status={item.status} textStyle={styles.statusText} />
      </View>

      <View style={styles.talonRow}>
        <Text style={styles.talonLabel}>Комбайнер:</Text>
        <Text style={styles.talonValue}>{item.kombainerUserData?.fio || 'Не указан'}</Text>
      </View>

      <View style={styles.talonRow}>
        <Text style={styles.talonLabel}>Комбайн:</Text>
        <Text style={styles.talonValue}>{item.kombainerData?.combine || 'Не указан'}</Text>
      </View>

      <View style={styles.talonRow}>
        <Text style={styles.talonLabel}>Вес:</Text>
        <Text style={styles.talonValue}>{item.weight ? `${item.weight} кг` : 'Не указан'}</Text>
      </View>

      <View style={styles.talonRow}>
        <Text style={styles.talonLabel}>Время создания:</Text>
        <Text style={styles.talonValue}>{new Date(item.created_at).toLocaleString('ru-RU')}</Text>
      </View>
    </TouchableOpacity>
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

        <Text style={styles.title}>Реестр талонов</Text>
        <Text style={styles.subtitle}>Водитель: {data?.userData?.fio}</Text>

        {/* Статистика */}
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>Всего талонов: {talons.length}</Text>
        </View>

        {/* Список талонов */}
        <View style={styles.listContainer}>
          {talons.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>У вас пока нет назначенных талонов</Text>
            </View>
          ) : (
            // Сортируем талоны по убыванию времени создания
            [...talons]
              .sort((a, b) => b.created_at - a.created_at)
              .map((item) => (
                <React.Fragment key={item.id}>{renderTalonItem({ item })}</React.Fragment>
              ))
          )}
        </View>

        {/* Отступ для кнопки "Назад" */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Кнопка "Назад" */}
      <View style={styles.backButtonContainer}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Text style={styles.backButtonText}>Назад</Text>
        </TouchableOpacity>
      </View>
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
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#5a7d2b',
    textAlign: 'center',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  statsContainer: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statsText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    fontWeight: '500',
  },
  listContainer: {
    paddingHorizontal: 15,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  talonItem: {
    backgroundColor: '#fff',
    marginBottom: 12,
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  talonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  talonNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#5a7d2b',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
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
    flex: 1,
  },
  talonValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  backButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f5f5f5',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  backButton: {
    backgroundColor: '#5a7d2b',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3.84,
    elevation: 5,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VoditelTalonsRegistry;
