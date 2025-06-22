import React, { Component } from 'react';
import {
  ActivityIndicator,
  Alert,
  NativeModules,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  BackHandler,
} from 'react-native';
import type { Code, CameraDevice } from 'react-native-vision-camera';
import { Camera } from 'react-native-vision-camera';
import { CONTENT_SPACING, CONTROL_BUTTON_SIZE, SAFE_AREA_PADDING } from '../../Constants';
import { StatusBarBlurBackground } from '../../views/StatusBarBlurBackground';
import { PressableOpacity } from 'react-native-pressable-opacity';
import IonIcon from 'react-native-vector-icons/Ionicons';
import type { Routes } from '../../Routes';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScanningOverlay from '../../views/ScanningOverlay';
import {
  JoinHotspotResponse,
  JoinHotspotPayload,
  SendTcpRequestResponse,
  ITcpResponseConnectEstablishedOk,
  CurrentUserResponse,
  RootStackParamList,
} from '../../../global';
import { closeAllConnections } from '../../services/ConnectionManager';
import { handleMessage, setNeedRedirect } from '../../services/MessageHandler';
import { connectToTcpServer, sendTcpRequest } from '../../wifi/TcpClient';
import { AuthStoreData } from '../../stores/AuthStore';
import { NavigationProp, RouteProp } from '@react-navigation/native';

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

interface VoditelQrCodeScannerProps {
  navigation: NavigationProp<RootStackParamList, 'CodeScannerPageScreen'>;
  route: RouteProp<RootStackParamList, 'CodeScannerPageScreen'>;
}

interface VoditelQrCodeScannerState {
  torch: boolean;
  processing: boolean;
  cancelInProgress: boolean;
  showHotspotInstruction: boolean;
  isFocused: boolean;
  isForeground: boolean;
  isActive: boolean;
  cameraReady: boolean;
  cameraPermissionStatus: 'granted' | 'denied' | 'restricted' | 'not-determined' | null;
  showPermissionError: boolean;
}

class VoditelQrCodeScanner extends Component<VoditelQrCodeScannerProps, VoditelQrCodeScannerState> {
  private isProcessingRef = false;
  private wifiCredentialsRef: { ssid: string; password: string; port?: number } | null = null;
  private backHandlerListener: any = null;
  private focusListener: any = null;
  private blurListener: any = null;
  private device: CameraDevice | null = null;

  constructor(props: VoditelQrCodeScannerProps) {
    super(props);
    this.state = {
      torch: false,
      processing: false,
      cancelInProgress: false,
      showHotspotInstruction: false,
      isFocused: true,
      isForeground: true,
      isActive: true,
      cameraReady: false,
      cameraPermissionStatus: null,
      showPermissionError: false,
    };
  }

  componentDidMount() {
    // Небольшая задержка для завершения монтирования компонента
    setTimeout(() => {
      this.initializeCamera();
    }, 100);

    this.setupEventListeners();
    this.closeConnections();
  }

  initializeCamera = async () => {
    try {
      console.log('VoditelQrCodeScanner: Starting camera initialization...');

      // Сбрасываем состояние ошибки разрешений
      this.setState({ showPermissionError: false });

      // Проверяем разрешения камеры
      const cameraPermission = await Camera.getCameraPermissionStatus();
      console.log('VoditelQrCodeScanner: Camera permission status:', cameraPermission);

      this.setState({ cameraPermissionStatus: cameraPermission });

      if (cameraPermission === 'not-determined') {
        // Впервые запрашиваем разрешение
        console.log('VoditelQrCodeScanner: Requesting camera permission for the first time...');
        const newCameraPermission = await Camera.requestCameraPermission();
        console.log('VoditelQrCodeScanner: New camera permission status:', newCameraPermission);

        this.setState({ cameraPermissionStatus: newCameraPermission });

        if (newCameraPermission !== 'granted') {
          console.log('VoditelQrCodeScanner: Camera permission denied');
          this.setState({
            cameraReady: true,
            showPermissionError: true,
          });
          return;
        }
      } else if (cameraPermission === 'denied') {
        // Разрешение было отклонено ранее
        console.log('VoditelQrCodeScanner: Camera permission was denied before');
        this.setState({
          cameraReady: true,
          showPermissionError: true,
        });
        return;
      } else if (cameraPermission === 'restricted') {
        // Разрешение ограничено (например, родительский контроль)
        console.log('VoditelQrCodeScanner: Camera permission is restricted');
        this.setState({
          cameraReady: true,
          showPermissionError: true,
        });
        return;
      } else if (cameraPermission !== 'granted') {
        // Любое другое состояние, кроме granted
        console.log('VoditelQrCodeScanner: Unknown camera permission state:', cameraPermission);
        this.setState({
          cameraReady: true,
          showPermissionError: true,
        });
        return;
      }

      // Разрешение получено, пробуем получить камеру
      console.log('VoditelQrCodeScanner: Getting available camera devices...');
      const devices = Camera.getAvailableCameraDevices();
      console.log(
        'VoditelQrCodeScanner: Available devices:',
        devices.length,
        devices.map((d) => ({ id: d.id, position: d.position }))
      );

      this.device = devices.find((d) => d.position === 'back') || devices[0] || null;

      if (!this.device) {
        console.warn('VoditelQrCodeScanner: No camera device found');
        Alert.alert('Ошибка', 'Камера недоступна на этом устройстве');
        this.setState({ cameraReady: true }); // Отмечаем как готово, но устройство null
        return;
      }

      console.log(
        'VoditelQrCodeScanner: Camera device found:',
        this.device.id,
        this.device.position
      );
      this.setState({ cameraReady: true, showPermissionError: false });
    } catch (error) {
      console.error('VoditelQrCodeScanner: Error initializing camera:', error);
      Alert.alert('Ошибка', 'Не удалось инициализировать камеру');
      this.setState({ cameraReady: true, showPermissionError: true }); // Отмечаем как готово, чтобы показать ошибку
    }
  };

  setupEventListeners = () => {
    // Обработчик для кнопки "Назад" на Android
    this.backHandlerListener = BackHandler.addEventListener(
      'hardwareBackPress',
      this.handleBackPress
    );

    // Слушатели фокуса экрана
    this.focusListener = this.props.navigation.addListener('focus', () => {
      this.setState({ isFocused: true }, this.updateActiveState);

      // Если камера не готова, попробуем переинициализировать
      if (!this.device || !this.state.cameraReady) {
        setTimeout(() => {
          this.handleRetryCamera();
        }, 500);
      }
    });

    this.blurListener = this.props.navigation.addListener('blur', () => {
      this.setState({ isFocused: false }, this.updateActiveState);
    });
  };

  componentWillUnmount() {
    try {
      if (this.backHandlerListener) {
        this.backHandlerListener.remove();
      }
    } catch (error) {
      console.error('VoditelQrCodeScanner: Error closing connections:', error);
    }
    try {
      if (this.focusListener) {
        this.focusListener.remove();
      }
    } catch (error) {
      console.error('VoditelQrCodeScanner: Error closing connections:', error);
    }
    try {
      if (this.blurListener) {
        this.blurListener.remove();
      }
    } catch (error) {
      console.error('VoditelQrCodeScanner: Error closing connections:', error);
    }

    this.backHandlerListener = null;
    this.focusListener = null;
    this.blurListener = null;

    this.setState({ processing: false });
  }

  updateActiveState = () => {
    const { isFocused, isForeground } = this.state;
    this.setState({ isActive: isFocused && isForeground });
  };

  handleBackPress = () => {
    if (this.state.showHotspotInstruction) {
      this.handleCancelInstruction();
      return true;
    }
    return false;
  };

  closeConnections = async () => {
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

  onCodeScanned = (codes: Code[]) => {
    const value = codes[0]?.value;
    if (!value || this.isProcessingRef) return;

    const credentials = parseWifiCredentials(value);
    if (credentials) {
      const { ssid, password, port } = credentials;
      console.log('Parsed Wi‑Fi credentials:', { ssid, password, port });

      // Сохраняем данные для дальнейшего использования
      this.wifiCredentialsRef = { ssid, password, port };
      // Блокируем повторное сканирование
      this.isProcessingRef = true;
      // Показываем инструкцию вместо сканера
      this.setState({ showHotspotInstruction: true });
      // Автоматически запускаем подключение к Wi-Fi после небольшой задержки
      setTimeout(() => {
        this.handleConnectToHotspot();
      }, 500);
      return;
    } else {
      console.error('onCodeScanned|!credentials|value=', value);
      Alert.alert('Ошибка считывания QR-кода');
    }
  };

  // Обработчик для кнопки "Подключиться к Wi-Fi"
  handleConnectToHotspot = async () => {
    if (!this.wifiCredentialsRef) return;
    const { ssid, password, port } = this.wifiCredentialsRef;
    console.log('handleConnectToHotspot: Starting connection with:', { ssid, password, port });
    this.setState({ processing: true });

    try {
      const joinDataRes = await MainWifiModule.joinHotspot(ssid, password);
      console.log('onCodeScanned|joinHotspot|joinDataRes=', joinDataRes);
      let joinData: JoinHotspotResponse;
      try {
        joinData = typeof joinDataRes === 'string' ? JSON.parse(joinDataRes) : joinDataRes;
      } catch (e) {
        console.error('onCodeScanned|JSON.parse error=', e);
        throw new Error('Ошибка парсинга ответа подключения к Wi-Fi');
      }
      console.log('onCodeScanned|joinData=', joinData);

      await this.handleNeedRedirect(joinData, port);
    } catch (err: unknown) {
      Alert.alert('Ошибка', err instanceof Error ? err.message : 'Не удалось подключиться к сети');
      // Сбрасываем состояния при ошибке
      this.setState({ processing: false, showHotspotInstruction: false });
      this.isProcessingRef = false;
    }
  };

  handleNeedRedirect = async (joinData: JoinHotspotResponse, port?: number) => {
    console.log('Main|needRedirect|joinData=', joinData, 'port=', port);

    try {
      // Отправляем запрос на подключение к TCP-серверу
      const message = await connectToTcpServer({
        ip: joinData.ip,
        port: port || 3290,
      });
      console.log('connectToTcpServer|message=', message);
    } catch (error: unknown) {
      console.error('Main|needRedirect|error=', error);
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
      return;
    }

    console.log('Main|needRedirect|tcpResponse =', tcpResponse);

    if ((tcpResponse.data as ITcpResponseConnectEstablishedOk).status !== 'ok') {
      Alert.alert('Ошибка установления соединения', JSON.stringify(tcpResponse.data));
      return;
    }

    AuthStoreData.context = 'voditel'; // Устанавливаем контекст пользователя

    if (!AuthStoreData.context) {
      Alert.alert('Ошибка', `Не удалось установить контекст пользователя`);
      return;
    }

    let currentUser: CurrentUserResponse;
    try {
      const response = await handleMessage({
        req: {
          type: 'currentUser',
          data: { context: AuthStoreData.context as 'voditel' },
        },
        reqId: 'getCurrentUser_' + Date.now(),
      });
      currentUser = response as CurrentUserResponse;
    } catch (error: unknown) {
      console.error('Main|needRedirect|getCurrentUser|error=', error);
      Alert.alert(
        'Ошибка получения данных пользователя',
        error instanceof Error ? error.message : 'Неизвестная ошибка'
      );
      return;
    }

    Alert.alert('Подключение к устройству прошло успешно', '', [
      {
        text: 'OK',
        onPress: () => {},
      },
    ]);

    if (!currentUser.voditelData || !currentUser.userData) {
      Alert.alert('Ошибка', 'Отсутствуют данные водителя или пользователя');
      return;
    }

    try {
      const connectData = await sendTcpRequest({
        type: 'set_voditel_data',
        voditelData: currentUser.voditelData,
        voditelUserData: currentUser.userData,
      });
      console.log('Main|needRedirect|voditel_connected|connectData=', connectData);
    } catch (error: any) {
      console.error('Main|needRedirect|voditel_connected|error=', error);
      Alert.alert('Ошибка отправки данных водителя', error.message || JSON.stringify(error));
      return;
    }

    this.props.navigation.navigate('VoditelTicketDetailAfterSetWeightScreen');
  };

  handleCancelInstruction = () => {
    if (this.state.cancelInProgress) return;

    this.setState({ cancelInProgress: true });

    // Сбрасываем состояния
    this.setState({
      processing: false,
      showHotspotInstruction: false,
      cancelInProgress: false,
    });
    this.isProcessingRef = false;
  };

  toggleTorch = () => {
    this.setState((prevState) => ({ torch: !prevState.torch }));
  };

  handleRetryCamera = () => {
    this.setState({
      cameraReady: false,
      showPermissionError: false,
      cameraPermissionStatus: null,
    });
    this.device = null;
    setTimeout(() => {
      this.initializeCamera();
    }, 100);
  };

  handlePermissionError = () => {
    const { cameraPermissionStatus } = this.state;

    if (cameraPermissionStatus === 'denied') {
      // Разрешение отклонено, предлагаем перейти в настройки
      Alert.alert(
        'Разрешение камеры отклонено',
        'Для сканирования QR-кодов необходимо разрешение на использование камеры. Вы можете предоставить его в настройках приложения.',
        [
          { text: 'Отмена', style: 'cancel' },
          { text: 'Настройки', onPress: this.openAppSettings },
        ]
      );
    } else if (cameraPermissionStatus === 'restricted') {
      Alert.alert(
        'Камера недоступна',
        'Доступ к камере ограничен системными настройками (например, родительским контролем).',
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert(
        'Камера недоступна',
        'Не удалось получить доступ к камере. Проверьте настройки приложения.',
        [
          { text: 'Отмена', style: 'cancel' },
          { text: 'Попробовать снова', onPress: this.handleRetryCamera },
        ]
      );
    }
  };

  openAppSettings = () => {
    Linking.openSettings().catch((error) => {
      console.error('VoditelQrCodeScanner: Error opening app settings:', error);
      Alert.alert('Ошибка', 'Не удалось открыть настройки приложения');
    });
  };

  // Компонент-инструкция по подключению к хотспоту
  renderHotspotInstruction = () => (
    <View style={styles.instructionOverlay}>
      <View style={styles.instructionBox}>
        <Text style={styles.instructionTitle}>Подключение к устройству</Text>

        <Text style={styles.instructionStep}>1. QR-код успешно отсканирован</Text>
        <Text style={styles.instructionStep}>2. Подключение к Wi-Fi сети комбайнера...</Text>
        <Text style={styles.instructionStep}>3. Установка соединения с устройством...</Text>

        {this.state.processing ? (
          <View style={styles.instructionLoader}>
            <ActivityIndicator size="large" color="#5a7d2b" />
            <Text style={styles.instructionLoaderText}>Подключение...</Text>
          </View>
        ) : (
          <>
            <TouchableOpacity style={styles.connectButton} onPress={this.handleConnectToHotspot}>
              <Text style={styles.connectButtonText}>Подключиться к Wi-Fi</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelButton, this.state.cancelInProgress && styles.disabledButton]}
              onPress={this.handleCancelInstruction}
              disabled={this.state.cancelInProgress}
            >
              <Text
                style={[
                  styles.cancelButtonText,
                  this.state.cancelInProgress && styles.disabledButtonText,
                ]}
              >
                Назад к сканеру
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  // Компонент для отображения ошибки разрешений камеры
  renderPermissionError = () => {
    const { cameraPermissionStatus } = this.state;

    let title = 'Камера недоступна';
    let message = 'Не удалось получить доступ к камере';
    let showSettingsButton = false;
    let showRetryButton = true;

    if (cameraPermissionStatus === 'denied') {
      title = 'Нужно разрешение';
      message =
        'Для сканирования QR-кодов необходимо разрешение на использование камеры. Предоставьте его в настройках приложения.';
      showSettingsButton = true;
      showRetryButton = false;
    } else if (cameraPermissionStatus === 'restricted') {
      title = 'Камера ограничена';
      message = 'Доступ к камере ограничен системными настройками.';
      showSettingsButton = false;
      showRetryButton = false;
    }

    return (
      <View style={styles.permissionErrorContainer}>
        <Text style={styles.permissionErrorTitle}>{title}</Text>
        <Text style={styles.permissionErrorMessage}>{message}</Text>

        <View style={styles.permissionErrorButtons}>
          {showSettingsButton && (
            <TouchableOpacity
              style={[styles.permissionButton, styles.settingsButton]}
              onPress={this.openAppSettings}
            >
              <Text style={styles.settingsButtonText}>Открыть настройки</Text>
            </TouchableOpacity>
          )}

          {showRetryButton && (
            <TouchableOpacity
              style={[styles.permissionButton, styles.retryButton]}
              onPress={this.handleRetryCamera}
            >
              <Text style={styles.retryButtonText}>Попробовать снова</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.permissionButton, styles.backButtonPermission]}
            onPress={() => this.props.navigation.goBack()}
          >
            <Text style={styles.backButtonPermissionText}>Назад</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  render() {
    const {
      torch,
      processing,
      showHotspotInstruction,
      isActive,
      cameraReady,
      showPermissionError,
    } = this.state;

    return (
      <View style={styles.container}>
        <StatusBarBlurBackground />

        {showHotspotInstruction ? (
          this.renderHotspotInstruction()
        ) : showPermissionError ? (
          this.renderPermissionError()
        ) : (
          <>
            {cameraReady && this.device ? (
              <Camera
                style={StyleSheet.absoluteFill}
                device={this.device}
                isActive={isActive}
                torch={torch ? 'on' : 'off'}
                codeScanner={{
                  codeTypes: ['qr', 'ean-13'],
                  onCodeScanned: this.onCodeScanned,
                }}
              />
            ) : (
              <View style={styles.noCameraContainer}>
                {!cameraReady ? (
                  <>
                    <ActivityIndicator size="large" color="#ffffff" />
                    <Text style={styles.noCameraText}>Инициализация камеры...</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.noCameraText}>Камера недоступна</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={this.handleRetryCamera}>
                      <Text style={styles.retryButtonText}>Попробовать снова</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            <ScanningOverlay />

            <View style={styles.rightButtonRow}>
              <PressableOpacity style={styles.button} onPress={this.toggleTorch}>
                <IonIcon name={torch ? 'flash' : 'flash-off'} color="white" size={24} />
              </PressableOpacity>
            </View>

            <PressableOpacity
              style={[styles.button, styles.backButton]}
              onPress={() => this.props.navigation.goBack()}
            >
              <IonIcon name="chevron-back" color="white" size={24} />
            </PressableOpacity>

            {processing && (
              <View style={styles.preloaderContainer}>
                <ActivityIndicator size="large" color="#5a7d2b" />
              </View>
            )}

            <View style={styles.bottomButtonContainer}>
              <TouchableOpacity
                style={[
                  styles.bottomCancelButton,
                  this.state.cancelInProgress && styles.disabledButton,
                ]}
                onPress={() => this.props.navigation.goBack()}
                disabled={this.state.cancelInProgress}
              >
                <Text
                  style={[
                    styles.bottomCancelButtonText,
                    this.state.cancelInProgress && styles.disabledButtonText,
                  ]}
                >
                  Отмена
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {showPermissionError && this.renderPermissionError()}
      </View>
    );
  }
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
  noCameraContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
  },
  noCameraText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  retryButton: {
    backgroundColor: '#5a7d2b',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 20,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  permissionErrorContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    padding: 20,
  },
  permissionErrorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff4d4d',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionErrorMessage: {
    fontSize: 15,
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  permissionErrorButtons: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
  },
  permissionButton: {
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  settingsButton: {
    backgroundColor: '#007bff',
  },
  settingsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButtonPermission: {
    backgroundColor: '#d9d9d9',
  },
  backButtonPermissionText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
});

export type { VoditelQrCodeScannerProps };

export { VoditelQrCodeScanner };
export default VoditelQrCodeScanner;
