import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation, NavigationProp, RouteProp } from '@react-navigation/native';
import { VectorLogo } from '../../components/VectorLogo';
import { RootStackParamList } from '../../../global';
import { ICreateTalonsParams } from '../../db/talons_of_combainers';
import { getReadableStatus } from '../../utils/statusUtils';
import { StatusBadge } from '../../components/StatusBadge';

interface VoditelTalonDetailProps {
  navigation: NavigationProp<RootStackParamList>;
  route: RouteProp<RootStackParamList, 'VoditelTalonDetailScreen'>;
}

/**
 * Экран детальной информации о талоне водителя
 */
const VoditelTalonDetail: React.FC<VoditelTalonDetailProps> = ({ navigation, route }) => {
  const { talon } = route.params;

  const goBack = () => {
    navigation.goBack();
  };

  const handleWeighing = () => {
    console.log('handleWeighing|talonId=', talon.id);

    // Проверяем статус талона
    if (talon.status === 'completed' || talon.status === 'weighed') {
      Alert.alert('Внимание', 'Данный талон уже взвешен');
      return;
    }

    if (
      talon.status === 'cancelled' ||
      talon.status === 'cancelled_by_kombainer' ||
      talon.status === 'cancelled_by_voditel'
    ) {
      Alert.alert('Внимание', 'Данный талон отменен');
      return;
    }

    // Переходим к сканеру QR-кода для подключения к десктопу
    navigation.navigate('VoditelWeighingQrScannerScreen', { talon });
  };

  const formatDateTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('ru-RU');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'created':
        return '#007bff';
      case 'assigned':
        return '#6f42c1';
      case 'in_progress':
        return '#fd7e14';
      case 'voditel_signed':
        return '#20c997';
      case 'weighed':
        return '#28a745';
      case 'completed':
        return '#28a745';
      case 'cancelled':
      case 'cancelled_by_kombainer':
      case 'cancelled_by_voditel':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

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

        <Text style={styles.title}>Информация о талоне</Text>

        <View style={styles.infoContainer}>
          {/* Заголовок талона */}
          <View style={styles.talonHeader}>
            <Text style={styles.talonNumber}>Талон {talon.talonNumber || talon.id}</Text>
            <StatusBadge status={talon.status} textStyle={styles.statusText} />
          </View>

          {/* Информация о комбайнере */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Комбайнер</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>ФИО:</Text>
              <Text style={styles.infoValue}>{talon.kombainerUserData?.fio || 'Не указан'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Телефон:</Text>
              <Text style={styles.infoValue}>{talon.kombainerUserData?.phone || 'Не указан'}</Text>
            </View>
          </View>

          {/* Информация о комбайне */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Комбайн</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Комбайн:</Text>
              <Text style={styles.infoValue}>{talon.kombainerData?.combine || 'Не указан'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Бригада:</Text>
              <Text style={styles.infoValue}>{talon.kombainerData?.brigade || 'Не указана'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Культура:</Text>
              <Text style={styles.infoValue}>{talon.kombainerData?.culture || 'Не указана'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Поле:</Text>
              <Text style={styles.infoValue}>{talon.kombainerData?.field || 'Не указано'}</Text>
            </View>
          </View>

          {/* Информация о талоне */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Данные талона</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Статус:</Text>
              <Text style={[styles.infoValue, { color: getStatusColor(talon.status) }]}>
                {getReadableStatus(talon.status)}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Вес:</Text>
              <Text style={styles.infoValue}>
                {talon.weight ? `${talon.weight} кг` : 'Не указан'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Время создания:</Text>
              <Text style={styles.infoValue}>{formatDateTime(talon.created_at)}</Text>
            </View>
            {talon.startTime && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Время начала:</Text>
                <Text style={styles.infoValue}>{formatDateTime(talon.startTime)}</Text>
              </View>
            )}
            {talon.endTime && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Время окончания:</Text>
                <Text style={styles.infoValue}>{formatDateTime(talon.endTime)}</Text>
              </View>
            )}
            {talon.comment && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Комментарий:</Text>
                <Text style={styles.infoValue}>{talon.comment}</Text>
              </View>
            )}
          </View>

          {/* Информация о водителе */}
          {talon.voditelData && talon.voditelUserData && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Водитель</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>ФИО:</Text>
                <Text style={styles.infoValue}>{talon.voditelUserData.fio}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Телефон:</Text>
                <Text style={styles.infoValue}>{talon.voditelUserData.phone}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Транспорт:</Text>
                <Text style={styles.infoValue}>{talon.voditelData.transport}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Отступ для кнопок */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Кнопки внизу экрана */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity style={styles.closeButton} onPress={goBack}>
          <Text style={styles.closeButtonText}>Закрыть</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.weighingButton,
            (talon.status === 'completed' ||
              talon.status === 'weighed' ||
              talon.status === 'cancelled' ||
              talon.status === 'cancelled_by_kombainer' ||
              talon.status === 'cancelled_by_voditel') &&
              styles.disabledButton,
          ]}
          onPress={handleWeighing}
          disabled={
            talon.status === 'completed' ||
            talon.status === 'weighed' ||
            talon.status === 'cancelled' ||
            talon.status === 'cancelled_by_kombainer' ||
            talon.status === 'cancelled_by_voditel'
          }
        >
          <Text
            style={[
              styles.weighingButtonText,
              (talon.status === 'completed' ||
                talon.status === 'weighed' ||
                talon.status === 'cancelled' ||
                talon.status === 'cancelled_by_kombainer' ||
                talon.status === 'cancelled_by_voditel') &&
                styles.disabledButtonText,
            ]}
          >
            Взвесить
          </Text>
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
    height: 100, // Высота для кнопок
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
    marginBottom: 20,
  },
  infoContainer: {
    paddingHorizontal: 15,
  },
  talonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  talonNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#5a7d2b',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    flex: 2,
    textAlign: 'right',
    fontWeight: '400',
  },
  buttonsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 10,
  },
  closeButton: {
    flex: 1,
    backgroundColor: '#dc3545',
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
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  weighingButton: {
    flex: 1,
    backgroundColor: '#28a745',
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
  weighingButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#6c757d',
    opacity: 0.6,
  },
  disabledButtonText: {
    color: '#aaa',
  },
});

export default VoditelTalonDetail;
