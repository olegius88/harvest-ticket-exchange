import React, { Component } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  NativeModules,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  EmitterSubscription,
} from 'react-native';
import type { Code } from 'react-native-vision-camera';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { CONTENT_SPACING, CONTROL_BUTTON_SIZE, SAFE_AREA_PADDING } from '../../Constants';
import { StatusBarBlurBackground } from '../../views/StatusBarBlurBackground';
import { PressableOpacity } from 'react-native-pressable-opacity';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { NavigationProp, RouteProp } from '@react-navigation/native';
import ScanningOverlay from '../../views/ScanningOverlay';
import {
  JoinHotspotResponse,
  SendTcpRequestResponse,
  ITcpResponseConnectEstablishedOk,
  CurrentUserResponse,
  RootStackParamList,
  ICreateKombainerParams,
} from '../../../global';
import { closeAllConnections } from '../../services/ConnectionManager';
import { handleMessage } from '../../services/MessageHandler';
import { connectToTcpServer, sendTcpRequest } from '../../wifi/TcpClient';
import { AuthStoreData } from '../../stores/AuthStore';
import KeepAwake from 'react-native-keep-awake';
import type { Routes } from '../../Routes';
import { ICreateUsersParams } from '../../db/users';

const { MainWifiModule } = NativeModules;

/** Разбор строки формата: "WIFI:S:AndroidShare_2534;P:68g9e5ec6m3na7i;T:3290;;" */
function parseWifiCredentials(
  value: string
): { ssid: string; password: string; port?: number } | null {
  if (!value.startsWith('WIFI:')) return null;
  const wifiData = value.slice(5);
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
      const parsedPort = parseInt(part.substring(2), 10);
      if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
        port = parsedPort;
      }
    }
  }
  return ssid && password ? { ssid, password, port: port || 3290 } : null;
}

interface VoditelQrCodeScannerProps {
  navigation: NavigationProp<RootStackParamList>;
  route: RouteProp<RootStackParamList, 'CodeScannerPageScreen'>;
}

interface VoditelQrCodeScannerState {
  torch: boolean;
  processing: boolean;
  cancelInProgress: boolean;
  showHotspotInstruction: boolean;
  isFocused: boolean;
  isForeground: boolean;
}

// HOC для передачи device и codeScanner в классовый компонент
function withCameraHooks(Component: typeof VoditelQrCodeScannerClass) {
  return (props: VoditelQrCodeScannerProps) => {
    const device = useCameraDevice('back');
    const codeScanner = useCodeScanner({
      codeTypes: ['qr', 'ean-13'],
      onCodeScanned: (codes: Code[]) => {
        // Будет переопределено в классе
      },
    });

    return <Component {...props} device={device} codeScanner={codeScanner} />;
  };
}

class VoditelQrCodeScannerClass extends Component<
  VoditelQrCodeScannerProps & {
    device: ReturnType<typeof useCameraDevice>;
    codeScanner: ReturnType<typeof useCodeScanner>;
  },
  VoditelQrCodeScannerState
> {
  // Рефы для процесса
  isProcessing: boolean = false;
  wifiCredentialsRef: { ssid: string; password: string; port?: number } | null = null;

  // Таймеры
  connectTimeoutRef: NodeJS.Timeout | null = null;
  cancelTimeoutRef: NodeJS.Timeout | null = null;

  // Слушатели
  acceptVoditelConnectListener: EmitterSubscription | null = null;
  focusListener: (() => void) | null = null;
  blurListener: (() => void) | null = null;

  constructor(
    props: VoditelQrCodeScannerProps & {
      device: ReturnType<typeof useCameraDevice>;
      codeScanner: ReturnType<typeof useCodeScanner>;
    }
  ) {
    super(props);

    this.state = {
      torch: false,
      processing: false,
      cancelInProgress: false,
      showHotspotInstruction: false,
      isFocused: true,
      isForeground: true,
    };

    // Переопределяем обработчик сканирования
    if (props.codeScanner) {
      props.codeScanner.onCodeScanned = this.handleCodeScanned;
    }
  }

  componentDidMount() {
    // Включаем не гаснущий экран при сканировании и подключении
    KeepAwake.activate();

    // Закрываем все соединения
    this.closeAllConnectionsAsync();

    // Слушатель события accept_voditel_connect
    this.acceptVoditelConnectListener = DeviceEventEmitter.addListener(
      'accept_voditel_connect',
      ({ talonId, kombainerData, kombainerUserData }) => {
        console.log('accept_voditel_connect received:', {
          talonId,
          kombainerData,
          kombainerUserData,
        });
        this.acceptVoditelConnectListener?.remove();
        this.props.navigation.navigate('VoditelTicketDetailAfterSetWeightScreen', {
          talonId,
          kombainerData,
          kombainerUserData,
        });
        Alert.alert('Подключение к устройству прошло успешно');
      }
    );

    // Слушатели фокуса навигации
    this.focusListener = this.props.navigation.addListener('focus', () => {
      this.setState({ isFocused: true });
    });

    this.blurListener = this.props.navigation.addListener('blur', () => {
      this.setState({ isFocused: false });
    });
  }

  componentWillUnmount() {
    this.setState({ processing: false });

    // Очищаем слушатели
    if (this.acceptVoditelConnectListener) {
      this.acceptVoditelConnectListener.remove();
    }

    if (this.focusListener) {
      this.focusListener();
    }

    if (this.blurListener) {
      this.blurListener();
    }

    // Очищаем таймеры
    if (this.connectTimeoutRef) {
      clearTimeout(this.connectTimeoutRef);
      this.connectTimeoutRef = null;
    }

    if (this.cancelTimeoutRef) {
      clearTimeout(this.cancelTimeoutRef);
      this.cancelTimeoutRef = null;
    }

    // Деактивируем не гаснущий экран
    KeepAwake.deactivate();
  }

  closeAllConnectionsAsync = async () => {
    try {
      await closeAllConnections(
        { closeHotspot: true, closeTcpServer: true, closeTcpClient: true },
        'VoditelQrCodeScanner'
      );
    } catch (error) {
      console.error('Ошибки при закрытии соединений:', error);
    }
  };

  handleCodeScanned = (codes: Code[]) => {
    const value = codes[0]?.value;
    if (!value || this.isProcessing) return;

    const credentials = parseWifiCredentials(value);
    if (credentials) {
      this.wifiCredentialsRef = credentials;
      this.isProcessing = true;
      this.setState({ showHotspotInstruction: true });
      this.connectTimeoutRef = setTimeout(() => this.handleConnectToHotspot(), 500);
    } else {
      Alert.alert('Ошибка считывания QR-кода');
    }
  };

  handleConnectToHotspot = async () => {
    if (!this.wifiCredentialsRef) return;

    const { ssid, password, port } = this.wifiCredentialsRef;
    console.log('handleConnectToHotspot|=', { ssid, password, port });
    this.setState({ processing: true });

    try {
      const joinDataRes = await MainWifiModule.joinHotspot(ssid, password);
      console.log('handleConnectToHotspot|joinDataRes=', joinDataRes);
      const joinData: JoinHotspotResponse = JSON.parse(joinDataRes);
      await this.handleNeedRedirect(joinData, port);
    } catch (error: unknown) {
      Alert.alert(
        'Ошибка',
        error instanceof Error ? error.message : 'Не удалось подключиться к сети'
      );
      this.setState({ showHotspotInstruction: false, processing: false });
      this.isProcessing = false;
    }
  };

  handleNeedRedirect = async (joinData: JoinHotspotResponse, port?: number) => {
    try {
      await connectToTcpServer({ ip: joinData.ip, port: port || 3290 });
      const data = await sendTcpRequest({ type: 'test' });
      if ((data as ITcpResponseConnectEstablishedOk).status !== 'ok') {
        throw new Error('Некорректный ответ при тестовом запросе');
      }
    } catch (error: unknown) {
      Alert.alert('Ошибка подключения', error instanceof Error ? error.message : '');
      this.setState({ showHotspotInstruction: false, processing: false });
      this.isProcessing = false;
      return;
    }

    AuthStoreData.context = 'voditel';
    if (!AuthStoreData.context) {
      Alert.alert('Ошибка', 'Не удалось установить контекст');
      this.setState({ showHotspotInstruction: false, processing: false });
      this.isProcessing = false;
      return;
    }

    try {
      const currentUserResp = await handleMessage({
        req: {
          type: 'currentUser',
          data: { context: AuthStoreData.context },
        },
        reqId: 'currentUser_' + Date.now(),
      });
      const currentUser = currentUserResp as CurrentUserResponse;

      if (!currentUser.voditelData || !currentUser.userData) {
        Alert.alert('Ошибка', 'Отсутствуют данные водителя');
        this.setState({ showHotspotInstruction: false, processing: false });
        this.isProcessing = false;
        return;
      }

      await sendTcpRequest({
        type: 'set_voditel_data',
        voditelData: currentUser.voditelData,
        voditelUserData: currentUser.userData,
      });
    } catch (error: any) {
      Alert.alert('Ошибка', error.message || JSON.stringify(error));
      this.setState({ showHotspotInstruction: false, processing: false });
      this.isProcessing = false;
    }
  };

  toggleTorch = () => {
    this.setState((prevState) => ({ torch: !prevState.torch }));
  };

  handleCancel = () => {
    this.setState({ cancelInProgress: true, showHotspotInstruction: false, processing: false });
    this.isProcessing = false;
    this.cancelTimeoutRef = setTimeout(() => {
      this.setState({ cancelInProgress: false });
    }, 600);
  };

  goBack = () => {
    this.props.navigation.goBack();
  };

  renderHotspotInstruction = () => {
    const { processing, cancelInProgress } = this.state;

    return (
      <View style={styles.instructionOverlay}>
        <View style={styles.instructionBox}>
          <Text style={styles.instructionTitle}>Подключение к устройству</Text>
          <Text style={styles.instructionStep}>
            QR-код отсканирован, идет подключение к Wi-Fi...
          </Text>
          {processing && (
            <View style={styles.instructionLoader}>
              <ActivityIndicator size="large" color="#5a7d2b" />
              <Text style={styles.instructionLoaderText}>Подключение...</Text>
              <TouchableOpacity
                style={[styles.cancelButton, cancelInProgress && styles.disabledButton]}
                onPress={this.handleCancel}
                disabled={cancelInProgress}
              >
                <Text
                  style={[styles.cancelButtonText, cancelInProgress && styles.disabledButtonText]}
                >
                  Отмена
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {!processing && (
            <TouchableOpacity
              style={[styles.cancelButton, cancelInProgress && styles.disabledButton]}
              onPress={this.handleCancel}
              disabled={cancelInProgress}
            >
              <Text
                style={[styles.cancelButtonText, cancelInProgress && styles.disabledButtonText]}
              >
                Назад к сканеру
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  render() {
    const { device, codeScanner } = this.props;
    const { torch, processing, showHotspotInstruction, isFocused, isForeground } = this.state;
    const isActive = isFocused && isForeground;

    return (
      <View style={styles.container}>
        {showHotspotInstruction ? (
          this.renderHotspotInstruction()
        ) : (
          <>
            {device && (
              <Camera
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={isActive && !this.isProcessing}
                codeScanner={codeScanner}
                torch={torch ? 'on' : 'off'}
                enableZoomGesture
              />
            )}

            <StatusBarBlurBackground />
            {!this.isProcessing && <ScanningOverlay />}

            <View style={styles.rightButtonRow}>
              <PressableOpacity
                style={styles.button}
                onPress={this.toggleTorch}
                disabledOpacity={0.4}
              >
                <IonIcon name={torch ? 'flash' : 'flash-off'} color="white" size={24} />
              </PressableOpacity>
            </View>

            <PressableOpacity style={styles.backButton} onPress={this.goBack}>
              <IonIcon name="chevron-back" color="white" size={35} />
            </PressableOpacity>

            <View style={styles.bottomButtonContainer}>
              <TouchableOpacity style={styles.bottomCancelButton} onPress={this.goBack}>
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
}

// Экспортируем компонент с HOC
export const VoditelQrCodeScanner = withCameraHooks(VoditelQrCodeScannerClass);

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
  },
  bottomCancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  preloaderContainer: {
    ...StyleSheet.absoluteFillObject,
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
