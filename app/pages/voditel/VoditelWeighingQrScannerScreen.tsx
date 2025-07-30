import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, NavigationProp, RouteProp } from '@react-navigation/native';
import { Camera, useCameraDevices, useCodeScanner } from 'react-native-vision-camera';
import { VectorLogo } from '../../components/VectorLogo';
import { RootStackParamList } from '../../../global';
import { TcpDesktopConnectionData, WeighingDataRequest } from '../../types/weighing';
import { TcpClient } from '../../wifi/TcpClientWrapper';

type VoditelWeighingQrScannerScreenRouteProp = RouteProp<
  RootStackParamList,
  'VoditelWeighingQrScannerScreen'
>;

/**
 * Экран сканирования QR-кода для подключения к desktop приложению для взвешивания
 */
const VoditelWeighingQrScannerScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<VoditelWeighingQrScannerScreenRouteProp>();
  const { talon } = route.params;

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const devices = useCameraDevices();
  const device = devices.find((d) => d.position === 'back');

  useEffect(() => {
    const requestCameraPermission = async () => {
      try {
        const permission = await Camera.requestCameraPermission();
        setHasPermission(permission === 'granted');
      } catch (error) {
        console.error('Ошибка запроса разрешения камеры:', error);
        setHasPermission(false);
      }
    };

    requestCameraPermission();
  }, []);

  const handleQrCodeScanned = async (codes: any[]) => {
    if (!isScanning || codes.length === 0) return;

    setIsScanning(false);

    try {
      const qrData = codes[0].value;
      console.log('Отсканирован QR-код:', qrData);

      // Парсим данные из QR-кода
      let connectionData: TcpDesktopConnectionData;

      try {
        connectionData = JSON.parse(qrData);
      } catch (parseError) {
        throw new Error('Неверный формат QR-кода');
      }

      // Проверяем обязательные поля
      if (!connectionData.ip || !connectionData.port || !connectionData.auth_code) {
        throw new Error('QR-код не содержит необходимые данные для подключения');
      }

      await connectToDesktop(connectionData);
    } catch (error) {
      console.error('Ошибка обработки QR-кода:', error);
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';

      Alert.alert('Ошибка', `Не удалось обработать QR-код: ${errorMessage}`, [
        {
          text: 'Попробовать снова',
          onPress: () => setIsScanning(true),
        },
        {
          text: 'Отмена',
          onPress: () => navigation.goBack(),
          style: 'cancel',
        },
      ]);
    }
  };

  const connectToDesktop = async (connectionData: TcpDesktopConnectionData) => {
    setIsConnecting(true);

    try {
      console.log('Подключаемся к desktop приложению:', connectionData);

      // Создаем TCP клиент с новым адаптером
      const tcpClient = new TcpClient();

      // Подключаемся к серверу
      console.log(`Подключение к ${connectionData.ip}:${connectionData.port}`);
      await tcpClient.connect(connectionData.ip, connectionData.port);

      // Подготавливаем данные для отправки в формате, ожидаемом Desktop приложением
      const weighingRequest: WeighingDataRequest = {
        type: 'weighingData',
        auth_code: connectionData.auth_code,
        talon_data: {
          id: talon.id,
          talonNumber: talon.talonNumber,
          kombainerData: talon.kombainerData,
          kombainerUserData: talon.kombainerUserData,
          voditelData: talon.voditelData,
          voditelUserData: talon.voditelUserData,
          status: talon.status,
          weight: talon.weight,
          moisture: talon.moisture,
          impurity: talon.impurity,
          created_at: talon.created_at,
          notes: talon.notes,
        },
      };

      console.log('Отправляем данные талона:', weighingRequest);

      // Отправляем данные с помощью нового адаптера
      console.log('Вызываем tcpClient.sendWeighingData...');
      const response = await tcpClient.sendWeighingData(weighingRequest);
      console.log('sendWeighingData завершился успешно');

      console.log('Получен ответ от Desktop:', response);

      // Закрываем соединение
      await tcpClient.disconnect();

      // Проверяем результат
      if (response.status === 'ok') {
        Alert.alert(
          'Успешно',
          'Данные талона переданы на весовую. Можете приступать к взвешиванию.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Возвращаемся к реестру талонов
                navigation.navigate('VoditelTalonsRegistry');
              },
            },
          ]
        );
      } else {
        throw new Error(response.message || 'Неизвестная ошибка при обработке данных');
      }
    } catch (error) {
      console.error('Ошибка подключения к desktop:', error);
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';

      Alert.alert('Ошибка подключения', `Не удалось подключиться к весовой: ${errorMessage}`, [
        {
          text: 'Попробовать снова',
          onPress: () => setIsScanning(true),
        },
        {
          text: 'Отмена',
          onPress: () => navigation.goBack(),
          style: 'cancel',
        },
      ]);
    } finally {
      setIsConnecting(false);
    }
  };

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: handleQrCodeScanned,
  });

  const handleCancel = () => {
    navigation.goBack();
  };

  if (hasPermission === null) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#5a7d2b" />
        <Text style={styles.statusText}>Запрос разрешения камеры...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.centerContainer}>
        <VectorLogo />
        <Text style={styles.errorText}>
          Для сканирования QR-кода необходимо разрешение на использование камеры
        </Text>
        <TouchableOpacity style={styles.button} onPress={handleCancel}>
          <Text style={styles.buttonText}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.centerContainer}>
        <VectorLogo />
        <Text style={styles.errorText}>Камера недоступна</Text>
        <TouchableOpacity style={styles.button} onPress={handleCancel}>
          <Text style={styles.buttonText}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isConnecting) {
    return (
      <View style={styles.centerContainer}>
        <VectorLogo />
        <ActivityIndicator size="large" color="#5a7d2b" style={styles.loader} />
        <Text style={styles.statusText}>Подключение к весовой...</Text>
        <Text style={styles.subtitleText}>Пожалуйста, подождите. Идет передача данных талона.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFillObject}
        device={device}
        isActive={isScanning}
        codeScanner={codeScanner}
      />

      {/* Оверлей с инструкциями */}
      <View style={styles.overlay}>
        <View style={styles.topOverlay}>
          <VectorLogo />
          <Text style={styles.title}>Сканирование QR-кода</Text>
          <Text style={styles.instructions}>
            Наведите камеру на QR-код весовой для передачи данных талона
          </Text>
        </View>

        {/* Рамка для сканирования */}
        <View style={styles.scanFrame}>
          <View style={styles.scanBorder} />
        </View>

        <View style={styles.bottomOverlay}>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelButtonText}>Отмена</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  topOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  bottomOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  instructions: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 22,
  },
  scanFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  scanBorder: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#5a7d2b',
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 30,
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#5a7d2b',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 30,
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginVertical: 20,
    lineHeight: 22,
  },
  statusText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  subtitleText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
  },
  loader: {
    marginVertical: 20,
  },
});

export default VoditelWeighingQrScannerScreen;
