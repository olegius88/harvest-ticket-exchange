import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { handleMessage } from '../../services/MessageHandler';
import {
  ISendPostResponseCurrentUser,
  ISendTcpResponse,
  SendTcpRequestResponse,
} from '../../../global';

// Компонент логотипа
const VectorLogo: React.FC<{ width?: number; height?: number }> = ({
  width = 120,
  height = 120,
}) => {
  return (
    <View
      style={{
        width,
        height,
        backgroundColor: '#5a7d2b',
        borderRadius: width / 2,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: 'bold' }}>LOGO</Text>
    </View>
  );
};

type RootStackParamList = {
  VoditelCreateTripScreen: undefined;
  MainScreen: undefined;
};

const VoditelWaitKombainerData: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [loading, setLoading] = useState(true);
  const [hasKombainerWeight, setHasKombainerWeight] = useState(false);
  const [checkIntervalId, setCheckIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [weight, setWeight] = useState<string>('');

  // Логика проверки данных от комбайнера
  useEffect(() => {
    // Функция для проверки статуса подтверждения от комбайнера
    const checkKombainerConfirmation = async () => {
      try {
        const response = await handleMessage({
          req: {
            type: 'sendTcpRequest',
            data: {
              type: 'get_kombainer_data',
            },
          },
          reqId: 'check_kombainer_weight_' + Date.now(),
        });

        if (response.type !== 'sendTcpRequest') {
          console.log('Ожидание данных от комбайнера...');
          return;
        }

        const tcpData = response as SendTcpRequestResponse;
        console.log('VoditelWaitKombainerData|get_kombainer_data|tcpData=', tcpData);

        // Имитация проверки веса (в настоящей реализации мы бы правильно проверяли наличие веса)
        // В зависимости от состояния приложения имитируем наличие или отсутствие веса
        // В реальном приложении нужна будет логика проверки наличия веса в данных от комбайнера
        if (Math.random() > 0.5) {
          // Имитация случайного определения наличия веса
          // Этот код имитирует получение веса, реальную логику нужно будет реализовать
          setHasKombainerWeight(true);
          setWeight('1000'); // Имитируем вес в кг

          // Останавливаем интервал проверки
          if (checkIntervalId) {
            clearInterval(checkIntervalId);
            setCheckIntervalId(null);
          }
        }
      } catch (error) {
        console.error('Ошибка при проверке статуса комбайнера:', error);
      } finally {
        setLoading(false);
      }
    };

    // Начинаем проверять статус сразу при загрузке компонента
    checkKombainerConfirmation();

    // Устанавливаем интервал для периодической проверки
    const intervalId = setInterval(checkKombainerConfirmation, 5000);
    setCheckIntervalId(intervalId);

    // Очистка интервала при размонтировании компонента
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      const response = await handleMessage({
        req: {
          type: 'sendTcpRequest',
          data: {
            type: 'confirm_kombainer_ticket_with_weight',
          },
        },
        reqId: 'confirm_kombainer_weight_' + Date.now(),
      });

      if (response.type !== 'sendTcpRequest') {
        throw new Error('Не удалось подтвердить вес');
      }

      const tcpData = response as SendTcpRequestResponse;

      // В реальном приложении здесь была бы проверка успешности операции
      if (tcpData) {
        Alert.alert('Успешно', 'Вес успешно подтвержден', [
          {
            text: 'OK',
            onPress: () => navigation.navigate('VoditelCreateTripScreen'),
          },
        ]);
      } else {
        throw new Error('Сервер вернул ошибку');
      }
    } catch (error: any) {
      Alert.alert(
        'Ошибка',
        'Не удалось подтвердить вес: ' + (error.message || JSON.stringify(error))
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (checkIntervalId) {
      clearInterval(checkIntervalId);
    }
    navigation.navigate('VoditelCreateTripScreen');
  };

  return (
    <View style={styles.container}>
      <VectorLogo />

      <Text style={styles.title}>
        {hasKombainerWeight ? 'Комбайнер указал вес' : 'Ожидание ввода веса комбайнером'}
      </Text>

      {loading ? (
        <ActivityIndicator size="large" color="#5a7d2b" style={styles.loader} />
      ) : (
        <>
          {hasKombainerWeight ? (
            <View style={styles.weightContainer}>
              <Text style={styles.weightLabel}>Вес указанный комбайнером:</Text>
              <Text style={styles.weightValue}>{weight} кг</Text>

              <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                <Text style={styles.confirmButtonText}>Подтвердить вес</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.messageContainer}>
              <Text style={styles.message}>
                Комбайнер указывает вес собранного урожая. Пожалуйста, подождите...
              </Text>
              <ActivityIndicator size="large" color="#5a7d2b" style={styles.inlineLoader} />
            </View>
          )}
        </>
      )}

      <TouchableOpacity style={styles.backButton} onPress={handleBack}>
        <Text style={styles.backButtonText}>Вернуться назад</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 24,
    color: '#333333',
  },
  loader: {
    marginVertical: 40,
  },
  messageContainer: {
    width: '100%',
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666666',
  },
  inlineLoader: {
    marginVertical: 20,
  },
  weightContainer: {
    width: '100%',
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
  },
  weightLabel: {
    fontSize: 16,
    marginBottom: 10,
    color: '#5a7d2b',
    fontWeight: 'bold',
  },
  weightValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333333',
  },
  confirmButton: {
    backgroundColor: '#5a7d2b',
    borderRadius: 6,
    padding: 14,
    width: '100%',
    alignItems: 'center',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    marginTop: 30,
    padding: 10,
  },
  backButtonText: {
    color: '#5a7d2b',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});

export default VoditelWaitKombainerData;
