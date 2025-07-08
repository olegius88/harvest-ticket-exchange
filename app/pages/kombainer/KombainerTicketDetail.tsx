import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { handleMessage } from '../../services/MessageHandler';
import { VectorLogo } from '../../components/VectorLogo';
import { CurrentUserResponse, PositionOptionValue, RootStackParamList } from '../../../global';
import { createTalon, TalonsOfCombainers, getNextTalonNumber } from '../../db/talons_of_combainers';
import { database } from '../../db/database';

/**
 * Страница "Талон комбайнера N"
 */
const KombainerTicketDetail: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CurrentUserResponse | null>(null);
  const [weight, setWeight] = useState('');
  const [creatingTalon, setCreatingTalon] = useState(false);
  const [talonId, setTalonId] = useState<string | null>(null);
  const [nextTalonNumber, setNextTalonNumber] = useState<string>('');
  const [talonCreatedAt, setTalonCreatedAt] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await handleMessage({
          req: {
            type: 'currentUser',
            data: { context: 'kombainer' as PositionOptionValue },
          },
          reqId: 'getCurrentUser_' + Date.now(),
        });

        if (response.type === 'currentUser') {
          setData(response);

          // Вычисляем будущий номер талона
          if (response.kombainerData?.id) {
            try {
              const nextNumber = await getNextTalonNumber(response.kombainerData.id);
              setNextTalonNumber(nextNumber);
            } catch (error) {
              console.error('Ошибка при вычислении номера талона:', error);
            }
          }
        } else {
          throw new Error('Failed to get current user');
        }
      } catch (error: unknown) {
        console.error('Ошибка загрузки данных:', error);
        const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
        Alert.alert('Ошибка', `Не удалось загрузить данные комбайнера. ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const voditelConnect = () => {
    console.log('voditelConnect|talonId=', talonId);
    if (!talonId) {
      Alert.alert(
        'Ошибка',
        'Талон не создан. Пожалуйста, создайте талон перед подключением водителя.'
      );
      return;
    }
    // Переходим к экрану QR-кода для сканирования водителем
    navigation.navigate('KombainerQRCodeScreen', { talonId });
  };

  const handleCreateTalon = () => {
    Alert.alert(
      'Подтверждение',
      'Вы уверены, что желаете создать талон? После принятия талон считается созданным и сохранённым в базу.',
      [
        {
          text: 'Отменить',
          style: 'cancel',
        },
        {
          text: 'Принять',
          onPress: async () => {
            try {
              setCreatingTalon(true);

              if (!data?.kombainerData?.id) {
                throw new Error('Не найдены данные комбайнера');
              }

              // Создаем талон в базе данных
              const createdAt = Date.now();
              const talonId = await createTalon({
                kombainerId: data.kombainerData.id,
                kombainerData: data.kombainerData,
                kombainerUserData: data.userData,
                status: 'created',
                startTime: createdAt,
              });

              console.log('handleCreateTalon|talonId=', talonId);

              setTalonId(talonId);

              // Сохраняем время создания талона
              setTalonCreatedAt(createdAt);

              console.log('Талон создан с ID:', talonId);
              Alert.alert('Успех', 'Талон успешно создан!', [
                {
                  text: 'ОК',
                },
              ]);
            } catch (error) {
              console.error('Ошибка при создании талона:', error);
              const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
              Alert.alert('Ошибка', `Не удалось создать талон: ${errorMessage}`);
            } finally {
              setCreatingTalon(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#98d642" />
        <Text style={styles.loadingText}>Загрузка данных...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Логотип */}
        <VectorLogo width={100} height={100} />

        {/* Заголовок */}
        <Text style={styles.title}>Талон комбайнера</Text>

        {/* Поля данных */}
        <View style={styles.formContainer}>
          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Номер талона:</Text>
            <Text style={[styles.formValue, styles.talonNumber]}>
              {nextTalonNumber && data?.userData?.id
                ? `${String(nextTalonNumber).padStart(5, '0')}`
                : 'Вычисляется...'}
            </Text>
          </View>

          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Дата:</Text>
            <Text style={styles.formValue}>
              {talonCreatedAt ? new Date(talonCreatedAt).toLocaleDateString('ru-RU') : '-'}
            </Text>
          </View>

          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Время:</Text>
            <Text style={styles.formValue}>
              {talonCreatedAt ? new Date(talonCreatedAt).toLocaleTimeString('ru-RU') : '-'}
            </Text>
          </View>

          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Комбайн:</Text>
            <Text style={styles.formValue}>{data?.kombainerData?.combine || '-'}</Text>
          </View>

          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Комбайнер:</Text>
            <Text style={styles.formValue}>{data?.userData?.fio || '-'}</Text>
          </View>

          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Культура:</Text>
            <Text style={styles.formValue}>{data?.kombainerData?.culture || '-'}</Text>
          </View>

          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Поле:</Text>
            <Text style={styles.formValue}>{data?.kombainerData?.field || '-'}</Text>
          </View>

          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Бригада:</Text>
            <Text style={styles.formValue}>{data?.kombainerData?.brigade || '-'}</Text>
          </View>

          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Вес:</Text>
            <TextInput
              style={styles.weightInput}
              placeholder="Введите вес"
              keyboardType="numeric"
              value={weight}
              onChangeText={setWeight}
              editable={false}
            />
          </View>

          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Физический вес зерна:</Text>
            <Text style={styles.formValue}>-</Text>
          </View>

          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Транспорт:</Text>
            <Text style={styles.formValue}>-</Text>
          </View>

          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Водитель:</Text>
            <Text style={styles.formValue}>-</Text>
          </View>

          <TouchableOpacity
            style={[styles.createTalonButton, creatingTalon && styles.disabledButton]}
            onPress={talonCreatedAt ? voditelConnect : handleCreateTalon}
            disabled={creatingTalon}
          >
            <Text style={styles.createTalonButtonText}>
              {creatingTalon
                ? 'Создание талона...'
                : talonCreatedAt
                  ? 'Подключить водителя'
                  : 'Создать талон'}
            </Text>
          </TouchableOpacity>

          <View style={styles.backLinkContainer}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.backLink}>Назад</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 20,
    color: '#333',
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  formLabel: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  formValue: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    textAlign: 'left',
  },
  talonNumber: {
    fontWeight: 'bold',
    color: '#98d642',
    fontSize: 18,
  },
  weightInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 10,
  },
  createTalonButton: {
    backgroundColor: '#98d642',
    borderRadius: 5,
    padding: 15,
    alignItems: 'center',
    marginTop: 20,
    width: '100%',
  },
  createTalonButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backLinkContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  backLink: {
    color: '#5a7d2b',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  disabledButton: {
    backgroundColor: '#cccccc',
    opacity: 0.7,
  },
});

export default KombainerTicketDetail;
