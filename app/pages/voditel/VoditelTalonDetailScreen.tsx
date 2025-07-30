import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation, useRoute, NavigationProp, RouteProp } from '@react-navigation/native';
import { VectorLogo } from '../../components/VectorLogo';
import { RootStackParamList } from '../../../global';
import { StatusBadge } from '../../components/StatusBadge';

type VoditelTalonDetailScreenRouteProp = RouteProp<RootStackParamList, 'VoditelTalonDetailScreen'>;

/**
 * Экран детальной информации о талоне водителя
 */
const VoditelTalonDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<VoditelTalonDetailScreenRouteProp>();
  const { talon } = route.params;

  const handleClose = () => {
    navigation.goBack();
  };

  const handleWeighing = () => {
    // Переходим к сканированию QR-кода для взвешивания
    navigation.navigate('VoditelWeighingQrScannerScreen', { talon });
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
        <Text style={styles.subtitle}>Талон {talon.talonNumber || talon.id}</Text>

        {/* Детальная информация */}
        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Статус:</Text>
            <StatusBadge status={talon.status} textStyle={styles.statusText} />
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Комбайнер:</Text>
            <Text style={styles.detailValue}>{talon.kombainerUserData?.fio || 'Не указан'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Комбайн:</Text>
            <Text style={styles.detailValue}>{talon.kombainerData?.combine || 'Не указан'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Поле:</Text>
            <Text style={styles.detailValue}>{talon.kombainerData?.field || 'Не указано'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Культура:</Text>
            <Text style={styles.detailValue}>{talon.kombainerData?.culture || 'Не указана'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Вес:</Text>
            <Text style={styles.detailValue}>
              {talon.weight ? `${talon.weight} кг` : 'Не указан'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Влажность:</Text>
            <Text style={styles.detailValue}>
              {talon.moisture ? `${talon.moisture}%` : 'Не указана'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Сорность:</Text>
            <Text style={styles.detailValue}>
              {talon.impurity ? `${talon.impurity}%` : 'Не указана'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Время создания:</Text>
            <Text style={styles.detailValue}>
              {new Date(talon.created_at).toLocaleString('ru-RU')}
            </Text>
          </View>

          {talon.weighed_at && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Время взвешивания:</Text>
              <Text style={styles.detailValue}>
                {new Date(talon.weighed_at).toLocaleString('ru-RU')}
              </Text>
            </View>
          )}

          {talon.notes && (
            <View style={styles.detailColumn}>
              <Text style={styles.detailLabel}>Примечания:</Text>
              <Text style={styles.notesValue}>{talon.notes}</Text>
            </View>
          )}
        </View>

        {/* Отступ для кнопок */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Кнопки действий */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={[styles.actionButton, styles.closeButton]} onPress={handleClose}>
          <Text style={styles.closeButtonText}>Закрыть</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.weighButton]}
          onPress={handleWeighing}
        >
          <Text style={styles.weighButtonText}>Взвесить</Text>
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
    height: 80, // Высота для кнопок действий
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
  detailsContainer: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 20,
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
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailColumn: {
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  notesValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    marginTop: 8,
    lineHeight: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f5f5f5',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
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
  closeButton: {
    backgroundColor: '#999',
    marginRight: 10,
  },
  weighButton: {
    backgroundColor: '#5a7d2b',
    marginLeft: 10,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  weighButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VoditelTalonDetailScreen;
