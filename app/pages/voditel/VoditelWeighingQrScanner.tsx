import React, { Component } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Code } from 'react-native-vision-camera';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { CONTENT_SPACING, CONTROL_BUTTON_SIZE, SAFE_AREA_PADDING } from '../../Constants';
import { StatusBarBlurBackground } from '../../views/StatusBarBlurBackground';
import { PressableOpacity } from 'react-native-pressable-opacity';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { NavigationProp, RouteProp } from '@react-navigation/native';
import ScanningOverlay from '../../views/ScanningOverlay';
import { RootStackParamList } from '../../../global';
import { connectToTcpServer, sendTcpRequest } from '../../wifi/TcpClient';
import { ICreateTalonsParams } from '../../db/talons_of_combainers';
import KeepAwake from 'react-native-keep-awake';

/**
 * Разбор QR-кода от desktop приложения
 * Формат: JSON строка с полями { ip, port, auth_code }
 */
function parseDesktopQrCode(value: string): { ip: string; port: number; auth_code: string } | null {
  try {
    const data = JSON.parse(value);
    if (data.ip && data.port && data.auth_code) {
      return {
        ip: data.ip,
        port: parseInt(data.port, 10),
        auth_code: data.auth_code,
      };
    }
  } catch (error) {
    console.error('Ошибка парсинга QR-кода:', error);
  }
  return null;
}

interface VoditelWeighingQrScannerProps {
  navigation: NavigationProp<RootStackParamList>;
  route: RouteProp<RootStackParamList, 'VoditelWeighingQrScannerScreen'>;
}

interface VoditelWeighingQrScannerState {
  torch: boolean;
  processing: boolean;
  cancelInProgress: boolean;
  showConnectionStatus: boolean;
  connectionMessage: string;
  isFocused: boolean;
  isForeground: boolean;
}

// HOC для передачи device и codeScanner в классовый компонент
function withCameraHooks(Component: typeof VoditelWeighingQrScannerClass) {
  return (props: VoditelWeighingQrScannerProps) => {
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

class VoditelWeighingQrScannerClass extends Component<
  VoditelWeighingQrScannerProps & {
    device: ReturnType<typeof useCameraDevice>;
    codeScanner: ReturnType<typeof useCodeScanner>;
  },
  VoditelWeighingQrScannerState
> {
  // Рефы для процесса
  isProcessing: boolean = false;
  desktopConnectionRef: { ip: string; port: number; auth_code: string } | null = null;
  talon: ICreateTalonsParams;

  // Таймеры
  connectTimeoutRef: NodeJS.Timeout | null = null;
  cancelTimeoutRef: NodeJS.Timeout | null = null;

  // Слушатели
  focusListener: (() => void) | null = null;
  blurListener: (() => void) | null = null;

  constructor(
    props: VoditelWeighingQrScannerProps & {
      device: ReturnType<typeof useCameraDevice>;
      codeScanner: ReturnType<typeof useCodeScanner>;
    }
  ) {
    super(props);

    this.talon = props.route.params.talon;

    this.state = {
      torch: false,
      processing: false,
      cancelInProgress: false,
      showConnectionStatus: false,
      connectionMessage: '',
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

  handleCodeScanned = (codes: Code[]) => {
    const value = codes[0]?.value;
    if (!value || this.isProcessing) return;

    const connectionData = parseDesktopQrCode(value);
    if (connectionData) {
      this.desktopConnectionRef = connectionData;
      this.isProcessing = true;
      this.setState({
        showConnectionStatus: true,
        connectionMessage: 'QR-код отсканирован, подключение к весовой...',
      });
      this.connectTimeoutRef = setTimeout(() => this.handleConnectToDesktop(), 500);
    } else {
      Alert.alert('Ошибка считывания QR-кода', 'Неверный формат QR-кода от весовой');
    }
  };

  handleConnectToDesktop = async () => {
    if (!this.desktopConnectionRef) return;

    const { ip, port, auth_code } = this.desktopConnectionRef;
    console.log('handleConnectToDesktop|=', { ip, port, auth_code });

    this.setState({
      processing: true,
      connectionMessage: `Подключение к ${ip}:${port}...`,
    });

    try {
      // Подключаемся к TCP серверу desktop приложения
      await connectToTcpServer({ ip, port });

      this.setState({
        connectionMessage: 'Подключение установлено, отправка данных...',
      });

      // Отправляем данные авторизации
      const authResponse = (await sendTcpRequest({
        type: 'weighing_auth',
        auth_code,
        timestamp: Date.now(),
      })) as any; // Временно используем any

      if (authResponse.status !== 'ok') {
        throw new Error('Ошибка авторизации на весовой');
      }

      this.setState({
        connectionMessage: 'Авторизация прошла успешно, отправка данных талона...',
      });

      // Отправляем данные талона для взвешивания
      const talonResponse = (await sendTcpRequest({
        type: 'weighing_talon_data',
        talon: {
          id: this.talon.id,
          talonNumber: this.talon.talonNumber,
          kombainerData: this.talon.kombainerData,
          kombainerUserData: this.talon.kombainerUserData,
          voditelData: this.talon.voditelData,
          voditelUserData: this.talon.voditelUserData,
          status: this.talon.status,
          weight: this.talon.weight,
          created_at: this.talon.created_at,
        },
        timestamp: Date.now(),
      })) as any; // Временно используем any

      if (talonResponse.status === 'ok') {
        this.setState({
          connectionMessage: 'Данные переданы успешно! Ожидайте взвешивания...',
        });

        // Показываем успешное сообщение и возвращаемся назад через некоторое время
        setTimeout(() => {
          Alert.alert(
            'Успех',
            'Данные талона переданы на весовую. Процедура взвешивания будет выполнена весовщиком.',
            [
              {
                text: 'OK',
                onPress: () => {
                  // Возвращаемся к предыдущему экрану
                  this.props.navigation.goBack();
                },
              },
            ]
          );
        }, 2000);
      } else {
        throw new Error('Ошибка при передаче данных талона');
      }
    } catch (error: unknown) {
      console.error('handleConnectToDesktop|error=', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Не удалось подключиться к весовой';
      Alert.alert('Ошибка подключения', errorMessage);
      this.setState({
        showConnectionStatus: false,
        processing: false,
        connectionMessage: '',
      });
      this.isProcessing = false;
    }
  };

  toggleTorch = () => {
    this.setState((prevState) => ({ torch: !prevState.torch }));
  };

  handleCancel = () => {
    this.setState({
      cancelInProgress: true,
      showConnectionStatus: false,
      processing: false,
      connectionMessage: '',
    });
    this.isProcessing = false;
    this.cancelTimeoutRef = setTimeout(() => {
      this.setState({ cancelInProgress: false });
    }, 600);
  };

  goBack = () => {
    this.props.navigation.goBack();
  };

  renderConnectionStatus = () => {
    const { processing, cancelInProgress, connectionMessage } = this.state;

    return (
      <View style={styles.instructionOverlay}>
        <View style={styles.instructionBox}>
          <Text style={styles.instructionTitle}>Подключение к весовой</Text>
          <Text style={styles.instructionStep}>{connectionMessage}</Text>
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
    const { torch, processing, showConnectionStatus, isFocused, isForeground } = this.state;
    const isActive = isFocused && isForeground;

    return (
      <View style={styles.container}>
        {showConnectionStatus ? (
          this.renderConnectionStatus()
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

            <View style={styles.instructionContainer}>
              <Text style={styles.instructionText}>
                Наведите камеру на QR-код от весовой для передачи данных талона
              </Text>
              <Text style={styles.talonInfoText}>
                Талон: {this.talon.talonNumber || this.talon.id}
              </Text>
            </View>

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
export const VoditelWeighingQrScanner = withCameraHooks(VoditelWeighingQrScannerClass);

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
  instructionContainer: {
    position: 'absolute',
    top: '20%',
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  instructionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '500',
  },
  talonInfoText: {
    color: '#28a745',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
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
    textAlign: 'center',
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
});

export default VoditelWeighingQrScanner;
