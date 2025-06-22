import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  NativeModules,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Code } from 'react-native-vision-camera';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { CONTENT_SPACING, CONTROL_BUTTON_SIZE, SAFE_AREA_PADDING } from '../../Constants';
import { useIsForeground } from '../../hooks/useIsForeground';
import { StatusBarBlurBackground } from '../../views/StatusBarBlurBackground';
import { PressableOpacity } from 'react-native-pressable-opacity';
import IonIcon from 'react-native-vector-icons/Ionicons';
import type { Routes } from '../../Routes';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/core';
import ScanningOverlay from '../../views/ScanningOverlay';
import {
  JoinHotspotResponse,
  JoinHotspotPayload,
  SendTcpRequestResponse,
  ITcpResponseConnectEstablishedOk,
  CurrentUserResponse,
} from '../../../global';
import { closeAllConnections } from '../../services/ConnectionManager';
import { handleMessage, setNeedRedirect } from '../../services/MessageHandler';
import { connectToTcpServer, sendTcpRequest } from '../../wifi/TcpClient';
import { AuthStoreData } from '../../stores/AuthStore';

const { MainWifiModule } = NativeModules; // Получаем нативный модуль

/**
 * Функция для парсинга Wi‑Fi строки.
 * Ожидается формат: "WIFI:S:AndroidShare_2534;P:68g9e5ec6m3na7i;T:3290;;"
 */
const parseWifiCredentials = (
  value: string
): { ssid: string; password: string; port?: number } | null => {
  if (!value.startsWith('WIFI:')) return null;
  const wifiData = value.slice(5); // удаляем префикс "WIFI:"
  const parts = wifiData.split(';');
  let ssid = '';
  let password = '';
  let port: number | undefined;

  for (const part of parts) {
    if (part.startsWith('S:')) {
      ssid = part.substring(2);
    } else if (part.startsWith('P:')) {
      password = part.substring(2);
    } else if (part.startsWith('T:')) {
      const portStr = part.substring(2);
      const parsedPort = parseInt(portStr, 10);
      if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
        port = parsedPort;
      }
    }
  }

  console.log('parseWifiCredentials: parsed data =', { ssid, password, port });
  return ssid && password ? { ssid, password, port: port || 3290 } : null;
};

type Props = NativeStackScreenProps<Routes, 'CodeScannerPageScreen'>;
export function VoditelQrCodeScanner({ navigation }: Props): React.ReactElement {
  // Используем заднюю камеру
  const device = useCameraDevice('back');

  // Камера активна только если экран в фокусе и приложение на переднем плане
  const isFocused = useIsFocused();
  const isForeground = useIsForeground();
  const isActive = isFocused && isForeground;

  // Включение фонарика
  const [torch, setTorch] = useState(false);

  // Флаг для предотвращения повторного срабатывания.
  // Используем useRef для хранения флага, а state для управления UI
  const isProcessing = useRef(false);
  const [processing, setProcessing] = useState(false);

  // Состояние для защиты от множественных нажатий кнопки "Назад к сканеру"
  const [cancelInProgress, setCancelInProgress] = useState(false);

  // Новое состояние для показа инструкции
  const [showHotspotInstruction, setShowHotspotInstruction] = useState(false);
  // Сохраняем данные Wi-Fi для передачи в joinHotspot после инструкции
  const wifiCredentialsRef = useRef<{ ssid: string; password: string; port?: number } | null>(null);

  // При загрузке страницы отключаем все соединения
  useEffect(() => {
    const closeConnections = async () => {
      try {
        await closeAllConnections(
          {
            closeHotspot: true,
            closeTcpServer: true,
            closeTcpClient: true,
          },
          'VoditelQrCodeScanner'
        );
      } catch (error) {
        console.error('VoditelQrCodeScanner: Ошибка при закрытии соединений:', error);
      }
    };

    closeConnections();

    // Cleanup функция при размонтировании компонента
    return () => {
      setProcessing(false);
    };
  }, []);

  // Закрываем все соединения перед началом сканирования
  useEffect(() => {
    if (isActive && !processing && !showHotspotInstruction) {
      const closeConnectionsBeforeScanning = async () => {
        try {
          await closeAllConnections(
            {
              closeHotspot: true,
              closeTcpServer: true,
              closeTcpClient: true,
            },
            'VoditelQrCodeScanner_BeforeScanning'
          );
        } catch (error) {
          console.error(
            'VoditelQrCodeScanner: Ошибка при закрытии соединений перед сканированием:',
            error
          );
        }
      };

      closeConnectionsBeforeScanning();
    }
  }, [isActive, processing, showHotspotInstruction]);

  const onCodeScanned = useCallback(
    (codes: Code[]) => {
      const value = codes[0]?.value;
      if (!value || isProcessing.current) return;

      const credentials = parseWifiCredentials(value);
      if (credentials) {
        const { ssid, password, port } = credentials;
        console.log('Parsed Wi‑Fi credentials:', { ssid, password, port });

        // Сохраняем данные для дальнейшего использования
        wifiCredentialsRef.current = { ssid, password, port };
        // Блокируем повторное сканирование
        isProcessing.current = true;
        // Показываем инструкцию вместо сканера
        setShowHotspotInstruction(true);
        // Автоматически запускаем подключение к Wi-Fi после небольшой задержки
        setTimeout(() => {
          handleConnectToHotspot();
        }, 500);
        return;
      } else {
        console.error('onCodeScanned|!credentials|value=', value);
        Alert.alert('Ошибка считывания QR-кода');
      }
    },
    [navigation]
  );

  // Обработчик для кнопки "Подключиться к Wi-Fi"
  const handleConnectToHotspot = async () => {
    if (!wifiCredentialsRef.current) return;
    const { ssid, password, port } = wifiCredentialsRef.current;
    console.log('handleConnectToHotspot: Starting connection with:', { ssid, password, port });
    setProcessing(true);

    try {
      const joinDataRes = await MainWifiModule.joinHotspot(ssid, password);
      console.log('onCodeScanned|joinHotspot|joinDataRes=', joinDataRes);
      let joinData: JoinHotspotResponse;
      try {
        joinData = JSON.parse(joinDataRes);
      } catch (e) {
        console.error('onCodeScanned|JSON.parse error|e=', e);
        console.error('onCodeScanned|JSON.parse error|e|joinDataRes=', joinDataRes);
        Alert.alert('Ошибка joinDataRes');
        // Сбрасываем состояния при ошибке
        setProcessing(false);
        setShowHotspotInstruction(false);
        isProcessing.current = false;
        return;
      }
      console.log('onCodeScanned|joinData=', joinData);

      await handleNeedRedirect(joinData, port);
    } catch (err: unknown) {
      Alert.alert('Ошибка', err instanceof Error ? err.message : 'Не удалось подключиться к сети');
      // Сбрасываем состояния при ошибке
      setProcessing(false);
      setShowHotspotInstruction(false);
      isProcessing.current = false;
    }
  };

  const handleNeedRedirect = async (joinData: JoinHotspotResponse, port?: number) => {
    console.log('Main|needRedirect|joinData=', joinData, 'port=', port);

    try {
      // Отправляем запрос на подключение к TCP-серверу
      const message = await connectToTcpServer({
        ip: joinData.ip,
        port: port || 3290, // Используем переданный порт или значение по умолчанию
      });
      console.log('connectToTcpServer|message=', message);
    } catch (error: unknown) {
      console.error('Main|needRedirect|error=', error);
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      Alert.alert('Ошибка подключения к устройству', errorMessage);
      // Сбрасываем состояния при ошибке
      setProcessing(false);
      setShowHotspotInstruction(false);
      isProcessing.current = false;
      return;
    }

    let tcpResponse: SendTcpRequestResponse;
    try {
      // Отправляем запрос на подключение к TCP-серверу
      const data = await sendTcpRequest({
        type: 'test',
      });
      console.log('sendTcpRequest|data=', data);
      tcpResponse = { type: 'sendTcpRequest', data };
    } catch (error: unknown) {
      console.error('Main|needRedirect|tcp test error =', error);
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      Alert.alert('Ошибка подключения к устройству', errorMessage);
      // Сбрасываем состояния при ошибке
      setProcessing(false);
      setShowHotspotInstruction(false);
      isProcessing.current = false;
      return;
    }

    console.log('Main|needRedirect|tcpResponse =', tcpResponse);

    if ((tcpResponse.data as ITcpResponseConnectEstablishedOk).status !== 'ok') {
      Alert.alert(
        'Ошибка подключения к устройству',
        `При подключении к устройству, получен некорректный ответ: ${JSON.stringify(tcpResponse)}`
      );
      // Сбрасываем состояния при ошибке
      setProcessing(false);
      setShowHotspotInstruction(false);
      isProcessing.current = false;
      return;
    }

    AuthStoreData.context = 'voditel'; // Устанавливаем контекст пользователя

    if (!AuthStoreData.context) {
      Alert.alert(
        'Не определен контекст',
        "Не определен контекст пользователя 'AuthStoreData.context'"
      );
      // Сбрасываем состояния при ошибке
      setProcessing(false);
      setShowHotspotInstruction(false);
      isProcessing.current = false;
      return;
    }

    let currentUser: CurrentUserResponse;
    try {
      // Отправляем запрос на получение данных текущего пользователя
      const currentUserResponse = await handleMessage({
        req: {
          type: 'currentUser',
          data: { context: AuthStoreData.context },
        },
        reqId: 'currentUser_' + Date.now(),
      });
      console.log('Main|needRedirect|currentUserResponse=', currentUserResponse);

      currentUser = currentUserResponse as CurrentUserResponse;
    } catch (error: unknown) {
      console.error('Main|needRedirect|currentUser|error =', error);
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      Alert.alert('Ошибка получения данных текущего пользователя', errorMessage);
      // Сбрасываем состояния при ошибке
      setProcessing(false);
      setShowHotspotInstruction(false);
      isProcessing.current = false;
      return;
    }

    Alert.alert('Подключение к устройству прошло успешно', '', [
      {
        text: 'OK',
        onPress: () => {},
      },
    ]);

    if (!currentUser.voditelData || !currentUser.userData) {
      Alert.alert('Ошибка', 'Отсутствуют данные водителя');
      // Сбрасываем состояния при ошибке
      setProcessing(false);
      setShowHotspotInstruction(false);
      isProcessing.current = false;
      return;
    }

    try {
      // Отправляем запрос на подключение к TCP-серверу
      const data = await sendTcpRequest({
        type: 'set_voditel_data',
        voditelData: currentUser.voditelData,
        voditelUserData: currentUser.userData,
      });
      console.log('sendTcpRequest|data=', data);
    } catch (error: any) {
      console.error('Main|needRedirect|set_voditel_data error =', error);
      Alert.alert('Ошибка подключения к устройству', error.message || JSON.stringify(error));
      // Сбрасываем состояния при ошибке
      setProcessing(false);
      setShowHotspotInstruction(false);
      isProcessing.current = false;
      return;
    }

    navigation.navigate('VoditelTicketDetailAfterSetWeightScreen');
  };

  // Инициализация сканера с поддержкой QR и штрих‑кодов (ean‑13)
  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13'],
    onCodeScanned,
  });

  // Компонент-инструкция по подключению к хотспоту
  const HotspotInstruction = () => (
    <View style={styles.instructionOverlay}>
      <View style={styles.instructionBox}>
        <Text style={styles.instructionTitle}>Подключение к Wi-Fi точке доступа</Text>
        <Text style={styles.instructionStep}>
          1. После сканирования QR-кода дождитесь появления системного окна с кнопкой{' '}
          <Text style={{ fontWeight: 'bold' }}>Соединиться</Text>.
        </Text>
        <Text style={styles.instructionStep}>
          2. Нажмите на кнопку <Text style={{ fontWeight: 'bold' }}>Соединиться/Подключиться</Text>,
          чтобы подключиться к Wi-Fi.
        </Text>
        <Text style={styles.instructionStep}>
          3. После подключения процесс продолжится автоматически.
        </Text>

        {/* Показываем индикатор загрузки если идет процесс подключения */}
        {processing && (
          <View style={styles.instructionLoader}>
            <ActivityIndicator size="large" color="#5a7d2b" />
            <Text style={styles.instructionLoaderText}>Подключение...</Text>
          </View>
        )}

        {/* Кнопка "Назад к сканеру" */}
        <TouchableOpacity
          style={[styles.cancelButton, cancelInProgress && styles.disabledButton]}
          onPress={() => {
            if (cancelInProgress) return;
            setCancelInProgress(true);

            setShowHotspotInstruction(false);
            isProcessing.current = false;
            setProcessing(false);

            // Сбрасываем флаг через небольшую задержку
            setTimeout(() => setCancelInProgress(false), 500);
          }}
          disabled={processing || cancelInProgress}
        >
          <Text
            style={[
              styles.cancelButtonText,
              (processing || cancelInProgress) && styles.disabledButtonText,
            ]}
          >
            {cancelInProgress ? 'Отмена...' : 'Назад к сканеру'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Показываем инструкцию вместо сканера, если showHotspotInstruction */}
      {showHotspotInstruction ? (
        <HotspotInstruction />
      ) : (
        <>
          {device && (
            // @ts-ignore
            <Camera
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={isActive && !isProcessing.current}
              codeScanner={codeScanner}
              torch={torch ? 'on' : 'off'}
              enableZoomGesture={true}
            />
          )}
          <StatusBarBlurBackground />
          {/* Оверлей для сканирования */}
          {!isProcessing.current && <ScanningOverlay />}
          <View style={styles.rightButtonRow}>
            <PressableOpacity
              style={styles.button}
              onPress={() => setTorch(!torch)}
              disabledOpacity={0.4}
            >
              <IonIcon name={torch ? 'flash' : 'flash-off'} color="white" size={24} />
            </PressableOpacity>
          </View>
          {/* Кнопка "Назад" */}
          <PressableOpacity style={styles.backButton} onPress={navigation.goBack}>
            <IonIcon name="chevron-back" color="white" size={35} />
          </PressableOpacity>

          {/* Кнопка "Отмена" внизу */}
          <View style={styles.bottomButtonContainer}>
            <TouchableOpacity style={styles.bottomCancelButton} onPress={navigation.goBack}>
              <Text style={styles.bottomCancelButtonText}>Отмена</Text>
            </TouchableOpacity>
          </View>

          {processing && (
            <View style={styles.preloaderContainer}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  button: {
    marginBottom: CONTENT_SPACING,
    width: CONTROL_BUTTON_SIZE,
    height: CONTROL_BUTTON_SIZE,
    borderRadius: CONTROL_BUTTON_SIZE / 2,
    backgroundColor: 'rgba(140, 140, 140, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightButtonRow: {
    position: 'absolute',
    right: SAFE_AREA_PADDING.paddingRight,
    top: SAFE_AREA_PADDING.paddingTop,
  },
  backButton: {
    position: 'absolute',
    left: SAFE_AREA_PADDING.paddingLeft,
    top: SAFE_AREA_PADDING.paddingTop,
  },
  preloaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  instructionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  instructionBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 28,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    elevation: 8,
  },
  instructionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 18,
    color: '#333',
    textAlign: 'center',
  },
  instructionStep: {
    fontSize: 15,
    color: '#333',
    marginBottom: 10,
    textAlign: 'left',
    width: '100%',
  },
  instructionLoader: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  instructionLoaderText: {
    fontSize: 16,
    color: '#5a7d2b',
    marginTop: 8,
    fontWeight: '500',
  },
  connectButton: {
    backgroundColor: '#5a7d2b',
    borderRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 18,
    width: '100%',
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#d9d9d9',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 12,
    width: '100%',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 15,
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.6,
    backgroundColor: '#b0b0b0',
  },
  disabledButtonText: {
    color: '#666',
  },
  bottomButtonContainer: {
    position: 'absolute',
    bottom: SAFE_AREA_PADDING.paddingBottom + 20,
    left: SAFE_AREA_PADDING.paddingLeft,
    right: SAFE_AREA_PADDING.paddingRight,
    alignItems: 'center',
  },
  bottomCancelButton: {
    backgroundColor: 'rgba(255, 77, 77, 0.9)',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 32,
    minWidth: 120,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  bottomCancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
