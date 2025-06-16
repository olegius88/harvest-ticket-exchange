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
} from 'react-native';
import { NavigationProp, RouteProp } from '@react-navigation/native';
import {
  checkPermissionsHotspot,
  handleMessage,
  isHotspotEnabled,
} from '../../services/MessageHandler';
import { stopTcpServer, startTcpServer, isTcpServerRunning } from '../../wifi/TcpServer';
import { AuthStoreData } from '../../stores/AuthStore';
import { VectorLogo } from '../../components/VectorLogo';
import {
  ISendPostResponseIsHotspotEnabled,
  ISendPostResponseSetHotspotEnabled,
  ISendPostResponseNeedRedirect,
  NeedRedirectResponse,
  PositionOptionValue,
  IPayloadVoditelConnectSuccess,
  RootStackParamList,
  SetHotspotDisabledResponse,
  SetHotspotEnabledResponse,
} from '../../../global';
import DeviceInfo from 'react-native-device-info';
import QRCode from 'react-native-qrcode-svg';

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
}

class KombainerQRCode extends Component<KombainerQRCodeProps, KombainerQRCodeState> {
  generateQr = false;
  waitingVoditelDataCtrl: number | NodeJS.Timeout | null = null;

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
    };
  }

  // Включение точки доступа через API
  setHotspotEnabled = async (): Promise<SetHotspotEnabledResponse> => {
    console.log('setHotspotEnabled|init');
    const response = await handleMessage({
      req: {
        type: 'setHotspotEnabled',
      },
      reqId: 'setHotspotEnabled_' + Date.now(),
    });

    console.log('setHotspotEnabled|response=', response);
    return response as SetHotspotEnabledResponse;
  };

  // Отключение точки доступа через API
  setHotspotDisabled = async (): Promise<SetHotspotDisabledResponse> => {
    console.log('setHotspotDisabled|init');
    const response = await handleMessage({
      req: {
        type: 'setHotspotDisabled',
      },
      reqId: 'setHotspotDisabled_' + Date.now(),
    });

    if (response.type !== 'setHotspotDisabled') {
      throw new Error('Failed to disable hotspot');
    }

    console.log('setHotspotDisabled|response=', response);
    return response as SetHotspotDisabledResponse;
  };

  // Функция, вызываемая при покидании страницы (размонтировании компонента)
  cancel = async () => {
    console.log('Покидание страницы: вызывается функция cancel');

    // Установим флаг отмены, чтобы предотвратить запуск новых процессов
    this.setState({ isCancelling: true });

    // Очищаем таймер ожидания данных водителя
    if (this.waitingVoditelDataCtrl !== null) {
      clearTimeout(this.waitingVoditelDataCtrl);
      this.waitingVoditelDataCtrl = null;
    }

    try {
      await this.setHotspotDisabled();
      console.log('Точка доступа отключена при покидании страницы');
    } catch (error) {
      console.error('Ошибка при отключении точки доступа на выходе:', error);
    }

    try {
      // Проверяем, запущен ли TCP-сервер перед остановкой
      if (isTcpServerRunning()) {
        const message = await stopTcpServer();
        console.log('cancel|stopTcpServer|message=', message);
      } else {
        console.log('cancel|TCP-сервер не запущен, пропускаем остановку');
      }
    } catch (error) {
      console.error('cancel|stopTcpServer|error=', error);
    }
  };

  // Генерация QR-кода - упрощённая версия
  generateQRCode = async (isRetry = false) => {
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
      sheRes = await this.setHotspotEnabled();
      console.log('generateQRCode|setHotspotEnabled|sheRes=', sheRes);

      // Проверка валидности полученных данных
      if (!sheRes || !sheRes.ssid || !sheRes.password) {
        throw new Error('Получены неполные данные Wi-Fi (отсутствует SSID или пароль)');
      }

      // Теперь можно безопасно использовать sheRes.ssid и sheRes.password
    } catch (e) {
      console.error('generateQRCode|setHotspotEnabled|error=', e);
      this.handleRetryIfNeeded('Ошибка при включении точки доступа');
      return;
    }

    // Проверяем, запущен ли уже TCP-сервер
    const isServerRunning = isTcpServerRunning();
    console.log('generateQRCode|isTcpServerRunning=', isServerRunning);

    if (isServerRunning) {
      console.log('generateQRCode|TCP-сервер уже запущен, пропускаем перезапуск');
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
        await startTcpServer();
        console.log('generateQRCode|TCP-сервер успешно запущен');
      } catch (e) {
        console.error('generateQRCode|Ошибка при запуске TCP-сервера:', e);

        // Если ошибка связана с занятым портом, пробуем остановить сервер и повторить
        if (e instanceof Error && e.message.includes('EADDRINUSE')) {
          console.log('generateQRCode|Порт занят, пытаемся остановить сервер и повторить');
          try {
            await stopTcpServer();
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Ждем 1 секунду
            await startTcpServer();
            console.log('generateQRCode|TCP-сервер успешно запущен после повторной попытки');
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

    // Генерация строки для QR-кода Wi-Fi точки доступа
    const { ssid, password } = sheRes;
    const wifiQRCodeContent = `WIFI:S:${ssid};P:${password};;`;

    // Устанавливаем значение для QR-кода напрямую
    this.setState({
      qrValue: wifiQRCodeContent,
      generatingQR: false,
      loading: false,
      retryInProgress: false,
      retryCount: 0, // Сбрасываем счетчик после успешной генерации
    });

    console.log('QR-код сгенерирован для Wi-Fi:', wifiQRCodeContent);
  };

  // Новый метод для обработки повторных попыток
  handleRetryIfNeeded = async (errorMessage: string) => {
    // Проверяем флаг отмены перед повторной попыткой
    if (this.state.isCancelling) {
      console.log('handleRetryIfNeeded: процесс был отменен');
      return;
    }

    const { retryCount, maxRetries } = this.state;

    if (retryCount < maxRetries) {
      console.log(
        `Попытка ${retryCount + 1}/${maxRetries} не удалась: ${errorMessage}. Повторяем...`
      );

      // Небольшая задержка перед следующей попыткой
      setTimeout(() => {
        // Проверяем флаг отмены перед выполнением повторной попытки
        if (!this.state.isCancelling) {
          this.generateQRCode(true);
        } else {
          console.log('handleRetryIfNeeded: повторная попытка отменена');
        }
      }, 1500);
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

  componentDidMount() {
    console.log('componentDidMount');

    // Обработчик для кнопки "Назад" на Android
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      this.handleCancelClick();
      return true; // Предотвращаем стандартное поведение
    });

    this.initGenerateQr();

    // Cleanup function
    return () => backHandler.remove();
  }

  waitingVoditelData = async () => {
    // Проверяем флаг отмены перед началом выполнения
    if (this.state.isCancelling) {
      console.log('waitingVoditelData: процесс был отменен');
      this.waitingVoditelDataCtrl = null;
      return;
    }

    if (this.waitingVoditelDataCtrl === null) {
      console.log('KombainerQRCode|waitingVoditelData|!this.waitingVoditelDataCtrl');
      return;
    }

    let response: NeedRedirectResponse;
    try {
      const res = await handleMessage({
        req: {
          type: 'needRedirect',
        },
        reqId: 'needRedirect_' + Date.now(),
      });

      // Проверяем флаг отмены после получения ответа
      if (this.state.isCancelling) {
        console.log('waitingVoditelData: процесс был отменен после получения ответа');
        this.waitingVoditelDataCtrl = null;
        return;
      }

      if (res.type !== 'needRedirect') {
        throw new Error('Failed to get needRedirect');
      }

      response = res as NeedRedirectResponse;
    } catch (e) {
      console.error('KombainerQRCode|waitingVoditelData|error=', e);
      return;
    }

    console.log('KombainerQRCode|waitingVoditelData|response =', response);

    if (response.status === 'empty') {
      // Проверяем флаг отмены перед установкой нового таймера
      if (!this.state.isCancelling) {
        this.waitingVoditelDataCtrl = setTimeout(() => this.waitingVoditelData(), 1000);
      } else {
        console.log('waitingVoditelData: новый таймер не установлен из-за отмены');
        this.waitingVoditelDataCtrl = null;
      }
      return;
    }

    this.waitingVoditelDataCtrl = null;

    if (!response.path) {
      console.error('KombainerQRCode|waitingVoditelData|!response.path|response=', response);
      Alert.alert(
        'Ошибка подключения к устройству',
        `Не был получен корректный 'needRedirect': ${JSON.stringify(response)}`
      );
      return;
    }

    // Сохраняем payload для дальнейшего использования
    // AuthStoreData.payloadVoditelConnectSuccess = response.payload as IPayloadVoditelConnectSuccess;
    console.log('Payload водителя:', response.payload);
    AuthStoreData.context = response.path as PositionOptionValue;

    if (!AuthStoreData.context) {
      Alert.alert(
        'Не определен контекст',
        "Не определен контекст пользователя 'AuthStoreData.context'"
      );
      return;
    }
    switch (AuthStoreData.context) {
      case 'kombainer':
        // В React Native навигация происходит через navigation prop
        Alert.alert('Подключение успешно', 'Водитель подключился к устройству', [
          {
            text: 'OK',
            onPress: () => {
              // Переходим на экран ожидания подтверждения данных водителем
              this.props.navigation.navigate('KombainerWaitTicketConfirmScreen');
            },
          },
        ]);
        return;
      default:
        Alert.alert('Ошибка', `Неизвестный контекст в switch: ${AuthStoreData.context}`);
        return;
    }
  };

  initGenerateQr = async () => {
    console.log('initGenerateQr|init');

    // Сбрасываем индикатор загрузки и счетчик попыток
    this.setState({
      loading: true,
      generatingQR: true,
      retryCount: 0,
      retryInProgress: false,
    });

    // Разрешим запускать проверку разрешений снова
    this.generateQr = false;
    this.generateQr = true;

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
        if (
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
          PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
        ) {
          console.log('checkPermissionsHotspot|ACCESS_FINE_LOCATION = NEVER_ASK_AGAIN');

          const locationEnabled = await DeviceInfo.isLocationEnabled();
          console.log('checkPermissionsHotspot|locationEnabled=', locationEnabled);
          if (!locationEnabled) {
            console.log('initGenerateQr|requestMultiple|!allGranted');
            this.setState({ loading: false, generatingQR: false, allPermissionsGranted: false });
            return;
          }
        }
      }
    } catch (e) {
      console.error('initGenerateQr|generateQRCode|error=', e);
      this.setState({ loading: false, generatingQR: false, allPermissionsGranted: false });
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
    console.log('componentDidMount|waitingVoditelData|init');
    this.waitingVoditelData().catch((error) => {
      console.error('waitingVoditelData|error=', error);
    });
  };

  componentWillUnmount() {
    // Установим флаг отмены для предотвращения запуска новых процессов
    this.setState({ isCancelling: true });

    if (this.waitingVoditelDataCtrl !== null) {
      clearTimeout(this.waitingVoditelDataCtrl);
      this.waitingVoditelDataCtrl = null;
    }

    // ✅ Отключаем не гаснущий экран
    handleMessage({
      req: {
        type: 'disableKeepAwake',
      },
      reqId: 'disableKeepAwake_' + Date.now(),
    }).catch((e) => console.error('disableKeepAwake|error=', e));

    // Определяем, переходим ли мы на страницу подтверждения талона
    const isNavigatingToTicketConfirm =
      AuthStoreData.context === 'kombainer' && this.waitingVoditelDataCtrl === null;

    if (!isNavigatingToTicketConfirm) {
      this.cancel().catch((error) => {
        console.error('cancel|error=', error);
      });
    } else {
      console.log('Переход на страницу подтверждения талона - сохраняем соединения');
    }
  }

  handleCancelClick = async () => {
    // Сразу устанавливаем флаг отмены, чтобы предотвратить запуск новых процессов
    this.setState({ isCancelling: true });

    // Показываем уведомление о закрытии TCP-соединения
    Alert.alert(
      'Закрытие TCP-соединения',
      'TCP-соединение с устройством водителя будет закрыто. Обмен данными прекратится.',
      [
        {
          text: 'Отмена',
          style: 'cancel',
          // Если пользователь отменил закрытие, снимаем флаг отмены
          onPress: () => this.setState({ isCancelling: false }),
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

  renderPermissionStatusMessages = () => {
    const { permissionsStatus } = this.state;
    const messages: React.ReactNode[] = [];

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
        instruction:
          'Перейдите в Настройки → Приложения → Это приложение → Разрешения → Местоположение → включите доступ к местоположению.',
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
              Нажмите кнопку "Проверить разрешения", чтобы запросить доступ повторно.
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
                <TouchableOpacity style={styles.retryButton} onPress={this.initGenerateQr}>
                  <Text style={styles.retryButtonText}>Проверить разрешения</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.settingsButton} onPress={this.openAppSettings}>
                  <Text style={styles.settingsButtonText}>Открыть настройки</Text>
                </TouchableOpacity>
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
          <TouchableOpacity style={styles.cancelButton} onPress={this.handleCancelClick}>
            <Text style={styles.cancelButtonText}>Отменить</Text>
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
