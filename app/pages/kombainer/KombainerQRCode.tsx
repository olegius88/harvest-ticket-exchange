import React, { Component } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  BackHandler,
  PermissionsAndroid,
  Linking,
  DeviceEventEmitter,
  NativeModules,
} from 'react-native';
import { NavigationProp, RouteProp } from '@react-navigation/native';
import {
  checkPermissionsHotspot,
  handleMessage,
  isHotspotEnabled,
  setHotspotDisabled,
} from '../../services/MessageHandler';
import {
  closeKombainerConnections,
  closeKombainerConnectionsGracefully,
} from '../../services/ConnectionManager';
import {
  startTcpServer,
  isTcpServerRunning,
  stopTcpServer,
  getCurrentTcpServerPort,
  tcpServerSendRequest,
} from '../../wifi/TcpServer';
import { AuthStoreData } from '../../stores/AuthStore';
import { VectorLogo } from '../../components/VectorLogo';
import {
  ISendPostResponseIsHotspotEnabled,
  ISendPostResponseNeedRedirect,
  NeedRedirectResponse,
  PositionOptionValue,
  IPayloadVoditelConnectSuccess,
  RootStackParamList,
  SetHotspotDisabledResponse,
  SetHotspotEnabledResponse,
  IVoditelConnectedPayload,
} from '../../../global';
import DeviceInfo from 'react-native-device-info';
import QRCode from 'react-native-qrcode-svg';
import KeepAwake from 'react-native-keep-awake';

const { HotspotBridge } = NativeModules;

interface KombainerQRCodeProps {
  navigation: NavigationProp<RootStackParamList, 'KombainerQRCodeScreen'>;
  route: RouteProp<RootStackParamList, 'KombainerQRCodeScreen'>;
}

interface KombainerQRCodeState {
  qrValue: string; // Изменено с qrUrl на qrValue
  loading: boolean;
  generatingQR: boolean;
  allPermissionsGranted: boolean;
  permissionsStatus: {
    [key: string]: string;
  };
  // Новые поля для отслеживания попыток
  retryCount: number;
  maxRetries: number;
  retryInProgress: boolean;
  isCancelling: boolean; // Добавляем флаг для отслеживания процесса отмены
  voditelConnected: boolean; // Добавляем флаг для отслеживания подключения водителя
  // Новые поля для геопозиции
  isLocationEnabled: boolean;
  checkingLocationStatus: boolean;
  cancelInProgress: boolean; // Добавляем флаг для защиты от множественных нажатий кнопки "Отменить"
  talonId: string; // Добавляем ID талона
}

class KombainerQRCode extends Component<KombainerQRCodeProps, KombainerQRCodeState> {
  generateQr = false;
  waitingVoditelDataCtrl: number | NodeJS.Timeout | null = null;
  voditelConnectedListener: any = null;
  // Новый массив для хранения всех таймеров повторных попыток
  retryTimeouts: Array<NodeJS.Timeout | number> = [];
  _isUnmounted = false; // Флаг размонтирования

  constructor(props: KombainerQRCodeProps) {
    super(props);
    this.state = {
      qrValue: '', // Изменено с qrUrl на qrValue
      loading: true,
      generatingQR: true,
      allPermissionsGranted: true,
      permissionsStatus: {},
      // Инициализация новых полей
      retryCount: 0,
      maxRetries: 5, // Максимальное количество попыток
      retryInProgress: false,
      isCancelling: false, // Инициализация флага отмены
      voditelConnected: false, // Инициализация флага подключения водителя
      // Инициализация полей геопозиции
      isLocationEnabled: true,
      checkingLocationStatus: false,
      cancelInProgress: false, // Инициализация флага защиты от множественных нажатий
      talonId: props.route.params?.talonId || '', // Инициализация ID талона из параметров
    };
  }

  // Отключение точки доступа через API
  setHotspotDisabled = async (): Promise<SetHotspotDisabledResponse> => {
    console.log('setHotspotDisabled|init');
    const response = await setHotspotDisabled();
    console.log('setHotspotDisabled|response=', response);
    return response;
  };

  // Функция, вызываемая при покидании страницы (размонтировании компонента)
  cancel = async () => {
    console.log('KombainerQRCode: Покидание страницы, вызывается функция cancel');

    // Установим флаг отмены, чтобы предотвратить запуск новых процессов
    this.setState({ isCancelling: true });

    // Очищаем таймер ожидания данных водителя
    if (this.waitingVoditelDataCtrl !== null) {
      clearTimeout(this.waitingVoditelDataCtrl);
      this.waitingVoditelDataCtrl = null;
    }

    try {
      // Используем согласованное отключение с таймаутом 3 секунды
      await closeKombainerConnectionsGracefully(
        'KombainerQRCode.cancel',
        'Пользователь покинул страницу QR-кода',
        3000
      );
    } catch (error) {
      console.error('KombainerQRCode.cancel: Ошибка при согласованном закрытии соединений:', error);

      // Если согласованное отключение не удалось, пробуем обычное
      try {
        await closeKombainerConnections('KombainerQRCode.cancel.fallback');
      } catch (fallbackError) {
        console.error(
          'KombainerQRCode.cancel: Ошибка при резервном закрытии соединений:',
          fallbackError
        );
      }
    }
  };

  // Генерация QR-кода - упрощённая версия
  generateQRCode = async (isRetry = false) => {
    // Не выполнять, если отменено или размонтировано
    if (this.state.isCancelling || this._isUnmounted) {
      console.log('generateQRCode|отменено или размонтировано, выход');
      return;
    }

    console.log(`generateQRCode|init|isRetry=${isRetry}|retryCount=${this.state.retryCount}`);

    if (isRetry) {
      this.setState({
        retryInProgress: true,
        retryCount: this.state.retryCount + 1,
      });
    }

    let sheRes: SetHotspotEnabledResponse;
    let iheRes: ISendPostResponseIsHotspotEnabled;

    try {
      iheRes = await isHotspotEnabled();
      console.log('generateQRCode|isHotspotEnabled|iheRes=', iheRes);
    } catch (e) {
      console.error('Ошибка при проверке точки доступа:', e);
      this.handleRetryIfNeeded('Ошибка при проверке точки доступа');
      return;
    }

    try {
      await this.setHotspotDisabled();
    } catch (e) {
      console.error('generateQRCode|Ошибка при отключении точки доступа:', e);
      this.handleRetryIfNeeded('Ошибка при отключении точки доступа');
      return;
    }

    try {
      const startResStr = await HotspotBridge.startHotspot('reqId');
      console.log('generateQRCode|startHotspot|startResStr=', startResStr);
      sheRes = JSON.parse(startResStr);
      // Проверка валидности полученных данных
      if (!sheRes || !sheRes.ssid || !sheRes.password) {
        throw new Error('Получены неполные данные Wi-Fi (отсутствует SSID или пароль)');
      }
    } catch (e) {
      console.error('generateQRCode|setHotspotEnabled|error=', e);
      this.handleRetryIfNeeded('Ошибка при включении точки доступа');
      return;
    }

    // Проверяем, запущен ли уже TCP-сервер
    const isServerRunning = isTcpServerRunning();
    console.log('generateQRCode|isTcpServerRunning=', isServerRunning);

    let tcpPort = 3290; // Значение по умолчанию

    if (isServerRunning) {
      console.log('generateQRCode|TCP-сервер уже запущен, получаем текущий порт');
      tcpPort = getCurrentTcpServerPort();
    } else {
      // Новая часть: запуск TCP-сервера через API
      try {
        const message = await stopTcpServer();
        console.log('generateQRCode|stopTcpServer|message=', message);
      } catch (e) {
        console.error('generateQRCode|Ошибка при остановке TCP-сервера:', e);
        // Продолжаем выполнение, так как сервер может быть не запущен
      }

      try {
        const serverResult = await startTcpServer();
        console.log('generateQRCode|TCP-сервер успешно запущен:', serverResult);
        tcpPort = serverResult.port;
      } catch (e) {
        console.error('generateQRCode|Ошибка при запуске TCP-сервера:', e);

        // Если ошибка связана с занятым портом, пробуем остановить сервер и повторить
        if (e instanceof Error && e.message.includes('EADDRINUSE')) {
          console.log('generateQRCode|Порт занят, пытаемся остановить сервер и повторить');
          try {
            await stopTcpServer();
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Ждем 1 секунду
            const serverResult = await startTcpServer();
            console.log(
              'generateQRCode|TCP-сервер успешно запущен после повторной попытки:',
              serverResult
            );
            tcpPort = serverResult.port;
          } catch (retryError) {
            console.error('generateQRCode|Ошибка при повторном запуске TCP-сервера:', retryError);
            try {
              await this.setHotspotDisabled();
            } catch (disableError) {
              console.error('Ошибка при отключении hotspot после ошибки TCP:', disableError);
            }
            this.handleRetryIfNeeded('Ошибка при запуске TCP-сервера');
            return;
          }
        } else {
          try {
            await this.setHotspotDisabled();
          } catch (disableError) {
            console.error('Ошибка при отключении hotspot после ошибки TCP:', disableError);
          }
          this.handleRetryIfNeeded('Ошибка при запуске TCP-сервера');
          return;
        }
      }
    }

    // Генерация строки для QR-кода Wi-Fi точки доступа с портом TCP
    const { ssid, password } = sheRes;
    const wifiQRCodeContent = `WIFI:S:${ssid};P:${password};T:${tcpPort};;`;

    // Устанавливаем значение для QR-кода напрямую
    this.setState({
      qrValue: wifiQRCodeContent,
      generatingQR: false,
      loading: false,
      retryInProgress: false,
      retryCount: 0, // Сбрасываем счетчик после успешной генерации
    });

    console.log('QR-код сгенерирован для Wi-Fi с TCP портом:', wifiQRCodeContent);
  };

  // Новый метод для обработки повторных попыток
  handleRetryIfNeeded = async (errorMessage: string) => {
    if (this.state.isCancelling || this._isUnmounted) {
      console.log('handleRetryIfNeeded: процесс был отменен или размонтирован');
      return;
    }
    const { retryCount, maxRetries } = this.state;
    if (retryCount < maxRetries) {
      console.log(
        `Попытка ${retryCount + 1}/${maxRetries} не удалась: ${errorMessage}. Повторяем...`
      );

      // Небольшая задержка перед следующей попыткой
      const timeout = setTimeout(() => {
        if (!this.state.isCancelling && !this._isUnmounted) {
          this.generateQRCode(true);
        } else {
          console.log('handleRetryIfNeeded: повторная попытка отменена или размонтирована');
        }
      }, 1500);
      this.retryTimeouts.push(timeout);
    } else {
      console.error(
        `Достигнуто максимальное количество попыток (${maxRetries}). Прекращаем попытки.`
      );
      this.setState({
        generatingQR: false,
        loading: false,
        retryInProgress: false,
      });

      Alert.alert(
        'Ошибка генерации QR-кода',
        'Не удалось создать точку доступа после нескольких попыток. Пожалуйста, проверьте настройки устройства и попробуйте снова.'
      );
    }
  };

  // Обработчик события подключения водителя
  handleVoditelConnected = async (data: IVoditelConnectedPayload) => {
    console.log('Водитель подключился:', data);

    // Устанавливаем флаг подключения водителя
    this.setState({ voditelConnected: true });

    // Очищаем таймер ожидания данных водителя, если он был установлен
    if (this.waitingVoditelDataCtrl !== null) {
      clearTimeout(this.waitingVoditelDataCtrl);
      this.waitingVoditelDataCtrl = null;
    }

    // Отправляем водителю событие о принятии подключения с talonId
    try {
      await tcpServerSendRequest({
        type: 'accept_voditel_connect',
        talonId: this.state.talonId,
      });
      console.log('Отправлено событие accept_voditel_connect с talonId:', this.state.talonId);
    } catch (error) {
      console.error('Ошибка при отправке accept_voditel_connect:', error);
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      Alert.alert(
        'Ошибка подключения',
        `Не удалось отправить подтверждение подключения водителю: ${errorMessage}`
      );
      return; // Прекращаем выполнение при ошибке
    }

    // Переходим на экран ожидания подтверждения данных водителем и передаем данные водителя
    this.props.navigation.navigate('KombainerTicketDetailAfterVoditelConfirmScreen', {
      data,
      talonId: this.state.talonId,
    });
  };

  componentDidMount() {
    this._isUnmounted = false;
    console.log('componentDidMount');

    // Обработчик для кнопки "Назад" на Android
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      this.handleCancelClick();
      return true; // Предотвращаем стандартное поведение
    });

    // Добавляем слушатель события подключения водителя
    this.voditelConnectedListener = DeviceEventEmitter.addListener(
      'voditelConnected',
      this.handleVoditelConnected
    );

    this.initGenerateQr();

    // Cleanup function
    return () => backHandler.remove();
  }

  // Новая функция для проверки состояния GPS
  checkLocationServiceStatus = async (): Promise<boolean> => {
    try {
      const locationEnabled = await DeviceInfo.isLocationEnabled();
      console.log('checkLocationServiceStatus|locationEnabled=', locationEnabled);
      this.setState({ isLocationEnabled: locationEnabled });
      return locationEnabled;
    } catch (error) {
      console.error('checkLocationServiceStatus|error=', error);
      return false;
    }
  };

  // Новая функция для запроса включения геопозиции
  requestEnableLocation = () => {
    Alert.alert(
      'Требуется включить геопозицию',
      'Для создания точки доступа Wi-Fi необходимо включить службу определения местоположения на устройстве.',
      [
        {
          text: 'Отмена',
          style: 'cancel',
        },
        {
          text: 'Открыть настройки',
          onPress: () => {
            // Открываем настройки местоположения
            Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => {
              // Если не удалось открыть настройки местоположения, открываем общие настройки
              Linking.openSettings().catch(() => {
                Alert.alert(
                  'Ошибка',
                  'Не удалось открыть настройки. Пожалуйста, включите геопозицию вручную: Настройки → Местоположение → Включить'
                );
              });
            });
          },
        },
      ]
    );
  };

  initGenerateQr = async () => {
    console.log('initGenerateQr|init');

    // Сбрасываем индикатор загрузки и счетчик попыток
    this.setState({
      loading: true,
      generatingQR: true,
      retryCount: 0,
      retryInProgress: false,
      checkingLocationStatus: true,
    });

    // Разрешим запускать проверку разрешений снова
    this.generateQr = false;
    this.generateQr = true;

    // Сначала проверяем состояние геопозиции
    const locationEnabled = await this.checkLocationServiceStatus();
    this.setState({ checkingLocationStatus: false });

    if (!locationEnabled) {
      console.log('initGenerateQr|Геопозиция отключена');
      this.setState({
        loading: false,
        generatingQR: false,
        allPermissionsGranted: false,
      });
      this.requestEnableLocation();
      return;
    }

    try {
      const permissions = [
        PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ];
      const granted = await PermissionsAndroid.requestMultiple(permissions);
      console.log('initGenerateQr|requestMultiple|granted=', granted);

      // Сохраняем текущие статусы разрешений
      this.setState({ permissionsStatus: granted });

      const allGranted = permissions.every(
        (permission) => granted[permission] === PermissionsAndroid.RESULTS.GRANTED
      );

      if (!allGranted) {
        // Специальная обработка для точного местоположения
        if (
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
          PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
        ) {
          console.log('checkPermissionsHotspot|ACCESS_FINE_LOCATION = NEVER_ASK_AGAIN');

          // Повторно проверяем состояние геопозиции
          const currentLocationEnabled = await this.checkLocationServiceStatus();
          console.log('checkPermissionsHotspot|currentLocationEnabled=', currentLocationEnabled);

          if (!currentLocationEnabled) {
            console.log('initGenerateQr|Геопозиция отключена при NEVER_ASK_AGAIN');
            this.setState({
              loading: false,
              generatingQR: false,
              allPermissionsGranted: false,
            });
            this.requestEnableLocation();
            return;
          }
        } else {
          // Если разрешения не предоставлены и это не NEVER_ASK_AGAIN
          console.log('initGenerateQr|requestMultiple|!allGranted');
          this.setState({
            loading: false,
            generatingQR: false,
            allPermissionsGranted: false,
          });
          return;
        }
      }

      // ✅ ИСПРАВЛЕНИЕ: Устанавливаем allPermissionsGranted в true при успешной проверке
      this.setState({ allPermissionsGranted: true });
    } catch (e) {
      console.error('initGenerateQr|generateQRCode|error=', e);
      this.setState({
        loading: false,
        generatingQR: false,
        allPermissionsGranted: false,
      });
      return;
    }

    try {
      await this.generateQRCode(false); // Первая попытка, не является повторной
      console.log('componentDidMount|generateQRCode|ok');
    } catch (e) {
      console.error('componentDidMount|generateQRCode|error=', e);
      Alert.alert(
        'Ошибка генерации QR-кода',
        'Произошла ошибка при создании точки доступа и генерации QR-кода. Попробуйте еще раз.'
      );
      this.setState({ generatingQR: false, loading: false, retryInProgress: false });
      return;
    } finally {
      if (!this.state.retryInProgress) {
        this.setState({ loading: false });
      }
    }

    this.waitingVoditelDataCtrl = 0;
  };

  componentWillUnmount() {
    this._isUnmounted = true;
    // Очищаем все таймеры повторных попыток
    this.retryTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.retryTimeouts = [];

    // Установим флаг отмены для предотвращения запуска новых процессов
    this.setState({ isCancelling: true });

    // Удаляем слушатель события подключения водителя
    if (this.voditelConnectedListener) {
      this.voditelConnectedListener.remove();
      this.voditelConnectedListener = null;
    }

    if (this.waitingVoditelDataCtrl !== null) {
      clearTimeout(this.waitingVoditelDataCtrl);
      this.waitingVoditelDataCtrl = null;
    }

    // ✅ Отключаем не гаснущий экран
    KeepAwake.deactivate();

    // Определяем, нужно ли сохранить соединение
    // Соединение сохраняется, если водитель подключился (voditelConnected = true)
    const shouldKeepConnection = this.state.voditelConnected;

    if (!shouldKeepConnection) {
      console.log('Водитель не подключен - закрываем соединения');
      this.cancel().catch((error) => {
        console.error('cancel|error=', error);
      });
    } else {
      console.log('Водитель подключен - сохраняем соединения для обмена данными');
    }
  }

  handleCancelClick = async () => {
    // Защита от множественных нажатий
    if (this.state.cancelInProgress) {
      return;
    }

    this.setState({ isCancelling: true, cancelInProgress: true });
    // Очищаем все таймеры повторных попыток
    this.retryTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.retryTimeouts = [];

    // Показываем уведомление о закрытии TCP-соединения
    Alert.alert(
      'Закрытие TCP-соединения',
      'TCP-соединение с устройством водителя будет закрыто. Обмен данными прекратится.',
      [
        {
          text: 'Отмена',
          style: 'cancel',
          // Если пользователь отменил закрытие, снимаем флаг отмены
          onPress: () => this.setState({ isCancelling: false, cancelInProgress: false }),
        },
        {
          text: 'Закрыть',
          style: 'destructive',
          onPress: async () => {
            try {
              // Очищаем таймер ожидания данных водителя
              if (this.waitingVoditelDataCtrl !== null) {
                clearTimeout(this.waitingVoditelDataCtrl);
                this.waitingVoditelDataCtrl = null;
              }

              await this.cancel();
              console.log('handleCancelClick|Соединения закрыты');
            } catch (error) {
              console.error('handleCancelClick|Ошибка при закрытии соединений:', error);
            }
            this.props.navigation.goBack();
          },
        },
      ]
    );
  };

  // Открытие настроек приложения
  openAppSettings = () => {
    Linking.openSettings().catch(() => {
      Alert.alert(
        'Ошибка',
        'Не удалось открыть настройки приложения. Пожалуйста, откройте их вручную через меню устройства: Настройки → Приложения → Это приложение → Разрешения'
      );
    });
  };

  // Открытие настроек местоположения
  openLocationSettings = () => {
    Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => {
      // Если не удалось открыть настройки местоположения, пробуем общие настройки
      Linking.openSettings().catch(() => {
        Alert.alert(
          'Ошибка',
          'Не удалось открыть настройки. Пожалуйста, включите геопозицию вручную: Настройки → Местоположение → Включить'
        );
      });
    });
  };

  renderPermissionStatusMessages = () => {
    const { permissionsStatus, isLocationEnabled, checkingLocationStatus } = this.state;
    const messages: React.ReactNode[] = [];

    // Если геопозиция отключена, показываем соответствующее сообщение
    if (!isLocationEnabled) {
      messages.push(
        <View key="location-disabled" style={styles.permissionMessageContainer}>
          <Text style={styles.permissionTitle}>Служба определения местоположения</Text>
          <Text style={styles.permissionError}>
            Служба определения местоположения отключена на устройстве.
          </Text>
          <Text style={styles.permissionInstruction}>
            Для создания точки доступа Wi-Fi необходимо включить геопозицию в настройках устройства.
          </Text>
        </View>
      );
    }

    // Если проверяем статус геопозиции, показываем индикатор
    if (checkingLocationStatus) {
      messages.push(
        <View key="location-checking" style={styles.permissionMessageContainer}>
          <Text style={styles.permissionTitle}>Проверка геопозиции</Text>
          <ActivityIndicator size="small" color="#856404" style={{ marginVertical: 8 }} />
          <Text style={styles.permissionInstruction}>
            Проверяем состояние службы определения местоположения...
          </Text>
        </View>
      );
    }

    // Текст с описанием проблемы для каждого типа разрешения
    const permissionMessages: {
      [key: string]: {
        title: string;
        denied: string;
        never_ask_again: string;
        instruction: string;
      };
    } = {
      [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]: {
        title: 'Точное местоположение',
        denied: 'Разрешение на доступ к точному местоположению отклонено.',
        never_ask_again: 'Разрешение на доступ к точному местоположению заблокировано навсегда.',
        instruction: isLocationEnabled
          ? 'Перейдите в Настройки → Приложения → Это приложение → Разрешения → Местоположение → включите доступ к местоположению.'
          : 'Сначала включите геопозицию в настройках устройства, затем предоставьте разрешение приложению.',
      },
      [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]: {
        title: 'Приблизительное местоположение',
        denied: 'Разрешение на доступ к приблизительному местоположению отклонено.',
        never_ask_again:
          'Разрешение на доступ к приблизительному местоположению заблокировано навсегда.',
        instruction:
          'Перейдите в Настройки → Приложения → Это приложение → Разрешения → Местоположение → включите доступ к местоположению.',
      },
      [PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES]: {
        title: 'Устройства Wi-Fi поблизости',
        denied: 'Разрешение на доступ к устройствам Wi-Fi поблизости отклонено.',
        never_ask_again:
          'Разрешение на доступ к устройствам Wi-Fi поблизости заблокировано навсегда.',
        instruction:
          'Перейдите в Настройки → Приложения → Это приложение → Разрешения → Ближайшие устройства → включите доступ к устройствам Wi-Fi поблизости.',
      },
    };

    // Обрабатываем каждое разрешение и добавляем соответствующее сообщение
    Object.entries(permissionsStatus).forEach(([permission, status]) => {
      const permInfo = permissionMessages[permission];
      if (!permInfo) return;

      if (status === PermissionsAndroid.RESULTS.DENIED) {
        messages.push(
          <View key={permission} style={styles.permissionMessageContainer}>
            <Text style={styles.permissionTitle}>{permInfo.title}</Text>
            <Text style={styles.permissionError}>{permInfo.denied}</Text>
            <Text style={styles.permissionInstruction}>
              {isLocationEnabled
                ? 'Нажмите кнопку "Проверить разрешения", чтобы запросить доступ повторно.'
                : 'Сначала включите геопозицию, затем проверьте разрешения.'}
            </Text>
          </View>
        );
      } else if (status === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        messages.push(
          <View key={permission} style={styles.permissionMessageContainer}>
            <Text style={styles.permissionTitle}>{permInfo.title}</Text>
            <Text style={styles.permissionError}>{permInfo.never_ask_again}</Text>
            <Text style={styles.permissionInstruction}>{permInfo.instruction}</Text>
          </View>
        );
      }
    });

    // Если нет сообщений (что странно, так как мы в блоке отображения ошибок)
    if (messages.length === 0) {
      messages.push(
        <View key="generic" style={styles.permissionMessageContainer}>
          <Text style={styles.permissionError}>
            Пожалуйста, включите определение местоположения в настройках устройства.
          </Text>
        </View>
      );
    }

    return messages;
  };

  render() {
    const {
      qrValue,
      loading,
      generatingQR,
      allPermissionsGranted,
      retryCount,
      maxRetries,
      retryInProgress,
      isLocationEnabled,
      checkingLocationStatus,
    } = this.state;

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          {/* Заголовок */}
          <Text style={styles.title}>Сканируйте QR-код для подключения к WiFi</Text>

          {/* QR-код или контент ошибки */}
          {!allPermissionsGranted ? (
            <View style={styles.permissionsErrorContainer}>
              {this.renderPermissionStatusMessages()}
              <View style={styles.buttonsContainer}>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={this.initGenerateQr}
                  disabled={checkingLocationStatus}
                >
                  <Text style={styles.retryButtonText}>
                    {checkingLocationStatus ? 'Проверяю...' : 'Проверить разрешения'}
                  </Text>
                </TouchableOpacity>

                {!isLocationEnabled ? (
                  <TouchableOpacity
                    style={styles.settingsButton}
                    onPress={this.openLocationSettings}
                  >
                    <Text style={styles.settingsButtonText}>Включить геопозицию</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.settingsButton} onPress={this.openAppSettings}>
                    <Text style={styles.settingsButtonText}>Открыть настройки</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.qrContainer}>
              {loading || generatingQR ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#98d642" />
                  <Text style={styles.loadingText}>
                    {retryInProgress
                      ? `Повторная попытка ${retryCount}/${maxRetries}...`
                      : 'Создание точки доступа и генерация QR-кода...'}
                  </Text>
                </View>
              ) : qrValue ? (
                // Отображаем QR-код напрямую вместо Image
                <QRCode
                  value={qrValue}
                  size={300}
                  logoSize={30}
                  logoBackgroundColor="transparent"
                />
              ) : (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>Ошибка генерации QR-кода</Text>
                  <TouchableOpacity style={styles.retryButton} onPress={this.initGenerateQr}>
                    <Text style={styles.retryButtonText}>Попробовать еще раз</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Инструкция */}
          {!loading && !generatingQR && qrValue && allPermissionsGranted && (
            <View style={styles.instructionContainer}>
              <Text style={styles.instructionText}>1. Откройте камеру на устройстве водителя</Text>
              <Text style={styles.instructionText}>2. Наведите камеру на QR-код</Text>
              <Text style={styles.instructionText}>3. Подключитесь к WiFi сети</Text>
              <Text style={styles.instructionText}>4. Дождитесь подтверждения подключения</Text>
            </View>
          )}

          {/* Кнопка отмены */}
          <TouchableOpacity
            style={[styles.cancelButton, this.state.cancelInProgress && styles.disabledButton]}
            onPress={this.handleCancelClick}
            disabled={this.state.cancelInProgress}
          >
            <Text
              style={[
                styles.cancelButtonText,
                this.state.cancelInProgress && styles.disabledButtonText,
              ]}
            >
              {this.state.cancelInProgress ? 'Отмена...' : 'Отменить'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
    color: '#333333',
  },
  // Контейнер для ошибок разрешений
  permissionsErrorContainer: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 40,
    alignItems: 'center',
  },
  // Контейнер для QR-кода
  qrContainer: {
    width: '90%',
    aspectRatio: 1,
    padding: 10,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  qrImage: {
    width: '100%',
    height: '100%',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#ff4d4f',
    textAlign: 'center',
    marginBottom: 16,
  },
  // Контейнер для кнопок
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 16,
    gap: 12,
  },
  retryButton: {
    backgroundColor: '#98d642',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 6,
    flex: 1,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  settingsButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 6,
    flex: 1,
    alignItems: 'center',
  },
  settingsButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  instructionContainer: {
    alignItems: 'flex-start',
    marginBottom: 32,
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: 400,
  },
  instructionText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
    lineHeight: 20,
  },
  cancelButton: {
    backgroundColor: '#ff4d4f',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 6,
    minWidth: 200,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Стили для отключенной кнопки
  disabledButton: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  disabledButtonText: {
    color: '#999',
  },
  // Стили для сообщений о разрешениях
  permissionMessageContainer: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#fff3cd',
    borderColor: '#ffeeba',
    borderWidth: 1,
    width: '100%',
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#856404',
  },
  permissionError: {
    fontSize: 14,
    color: '#856404',
    marginBottom: 8,
  },
  permissionInstruction: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
});

export default KombainerQRCode;
