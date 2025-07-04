import React, { Component } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  ScrollView,
  DeviceEventEmitter,
  BackHandler,
  ToastAndroid,
  Modal,
  TextInput,
} from 'react-native';
import { NavigationProp, RouteProp } from '@react-navigation/native';
import { handleMessage } from '../../services/MessageHandler';
import { sendTcpRequest, disconnectTcpClientGracefully } from '../../wifi/TcpClient';
import { AuthStoreData } from '../../stores/AuthStore';
import { VectorLogo } from '../../components/VectorLogo';
import { ICreateUsersParams } from '../../db/users';
import {
  CurrentUserResponse,
  SendTcpRequestResponse,
  ICreateKombainerParams,
  ICreateVoditelParams,
  ITcpResponseKombainerData,
  RootStackParamList,
  IPayloadSetTalonOfKombainer,
} from '../../../global';
import KeepAwake from 'react-native-keep-awake';
import {
  ICreateTalonsParams,
  createTalon,
  cancelTalon,
  cancelTalonByKombainer,
} from '../../db/talons_of_combainers';

interface VoditelTicketDetailAfterSetWeightProps {
  navigation: NavigationProp<RootStackParamList>;
  route: RouteProp<RootStackParamList, 'VoditelTicketDetailAfterSetWeightScreen'>;
}

interface VoditelTicketDetailAfterSetWeightState {
  isKombainerData: boolean;
  loadingKombainerData: boolean;
  loadingKombainerDataSuccess: boolean;
  loadingKombainerDataError: boolean;

  isKombainerDataWithWeight: boolean;
  loadingKombainerDataWithWeight: boolean;
  loadingKombainerDataWithWeightSuccess: boolean;
  loadingKombainerDataWithWeightError: boolean;

  canSignTicket: boolean; // Новое состояние для отображения кнопки "Подписать талон"

  waitingForKombainerSign: boolean; // Ожидание события kombainerSignTicket
  kombainerSignReceived: boolean; // Получено ли событие kombainerSignTicket

  cancelInProgress: boolean; // Добавляем флаг для защиты от множественных нажатий кнопки "Отменить"

  // Состояния для отслеживания загрузки кнопок
  confirmDataLoading: boolean; // Загрузка для "Подтвердить данные талона"
  confirmDataDisabled: boolean; // Блокировка после успешного выполнения

  approveTicketLoading: boolean; // Загрузка для "Утвердить талон"
  approveTicketDisabled: boolean; // Блокировка после успешного выполнения

  signTicketLoading: boolean; // Загрузка для "Подписать талон"
  signTicketDisabled: boolean; // Блокировка после успешного выполнения

  // Состояния для модального окна отмены
  cancelModalVisible: boolean;
  cancelComment: string;

  weight: number | null;
  kombainerUserData: ICreateUsersParams | null;
  userData: ICreateUsersParams | null;
  voditelData: ICreateVoditelParams | null;
  kombainerData: ICreateKombainerParams | null;
  talonData: ICreateTalonsParams | null; // Данные талона
}

class VoditelTicketDetailAfterSetWeight extends Component<
  VoditelTicketDetailAfterSetWeightProps,
  VoditelTicketDetailAfterSetWeightState
> {
  // Слушатель для получения данных комбайнера
  setTalonOfKombainerListener: any = null;
  // Слушатель для события подписания талона комбайнером
  kombainerSignTicketListener: any = null;
  // Слушатель для события отмены талона комбайнером
  kombainerCancelTalonListener: any = null;
  // Слушатель для блокировки кнопки "Назад"
  backHandlerListener: any = null;
  // Контроллер для периодического опроса данных
  waitingKombainerDataWithWeightConfirmCtrl: NodeJS.Timeout | number | null = null;
  // Флаг размонтирования компонента
  _isUnmounted = false;

  constructor(props: VoditelTicketDetailAfterSetWeightProps) {
    super(props);
    this._isUnmounted = false;
    this.state = {
      isKombainerData: true,
      loadingKombainerData: false,
      loadingKombainerDataSuccess: false,
      loadingKombainerDataError: false,

      isKombainerDataWithWeight: false,
      loadingKombainerDataWithWeight: false,
      loadingKombainerDataWithWeightSuccess: false,
      loadingKombainerDataWithWeightError: false,

      canSignTicket: false, // Изначально кнопка скрыта

      waitingForKombainerSign: false,
      kombainerSignReceived: false,

      cancelInProgress: false, // Инициализация флага защиты от множественных нажатий

      // Инициализация состояний для отслеживания загрузки кнопок
      confirmDataLoading: false,
      confirmDataDisabled: false,

      approveTicketLoading: false,
      approveTicketDisabled: false,

      signTicketLoading: false,
      signTicketDisabled: false,

      // Инициализация состояний для модального окна отмены
      cancelModalVisible: false,
      cancelComment: '',

      weight: null,
      kombainerUserData: null,
      userData: null,
      voditelData: null,
      kombainerData: null,
      talonData: null,
    };
  }

  componentDidMount() {
    this.getKombainerData().catch((e: unknown) => {
      console.error('VoditelTicketDetailAfterSetWeight|getKombainerData|error=', e);
      Alert.alert('Ошибка передачи данных комбайнера', e instanceof Error ? e.message : String(e));
    });

    // Удаляем существующие слушатели перед добавлением новых
    this.removeAllListeners();

    // Добавляем слушатель события подписания талона комбайнером
    this.kombainerSignTicketListener = DeviceEventEmitter.addListener(
      'kombainerSignTicket',
      this.handleKombainerSignTicket
    );

    // Добавляем слушатель события отмены талона комбайнером
    this.kombainerCancelTalonListener = DeviceEventEmitter.addListener(
      'kombainerCancelTalon',
      this.handleKombainerCancelTalon
    );

    // Блокируем кнопку "Назад"
    this.backHandlerListener = BackHandler.addEventListener(
      'hardwareBackPress',
      this.handleBackPress
    );

    // Добавляем слушатель события подтверждения от водителя
    this.setTalonOfKombainerListener = DeviceEventEmitter.addListener(
      'setTalonOfKombainer',
      this.handleSetTalonOfKombainer
    );

    // Включаем не гаснущий экран
    KeepAwake.activate();
  }

  componentWillUnmount() {
    this._isUnmounted = true;

    // Останавливаем периодический опрос
    if (this.waitingKombainerDataWithWeightConfirmCtrl !== null) {
      clearTimeout(this.waitingKombainerDataWithWeightConfirmCtrl);
      this.waitingKombainerDataWithWeightConfirmCtrl = null;
    }

    this.removeAllListeners();

    // Отключаем не гаснущий экран
    KeepAwake.deactivate();
  }

  /**
   * Метод для корректного закрытия TCP соединения
   */
  cleanupTcpConnection = async () => {
    try {
      console.log('VoditelTicketDetailAfterSetWeight|cleanupTcpConnection|start');
      await disconnectTcpClientGracefully('Переход на другой экран');
      console.log('VoditelTicketDetailAfterSetWeight|cleanupTcpConnection|success');
    } catch (error) {
      console.error('VoditelTicketDetailAfterSetWeight|cleanupTcpConnection|error=', error);
    }
  };

  /**
   * Безопасный setState - проверяет, не размонтирован ли компонент
   */
  safeSetState = (stateUpdate: any) => {
    if (!this._isUnmounted) {
      this.setState(stateUpdate);
    }
  };

  /**
   * Метод для безопасного удаления всех слушателей
   */
  removeAllListeners = () => {
    this.setTalonOfKombainerListener?.remove();

    this.kombainerSignTicketListener?.remove();
    this.kombainerCancelTalonListener?.remove();
    this.backHandlerListener?.remove();
  };

  handleKombainerSignTicket = () => {
    this.kombainerSignTicketListener?.remove();
    console.log('VoditelTicketDetailAfterSetWeight|handleKombainerSignTicket');

    // Если мы ожидаем подписания, сразу переходим на следующий экран
    if (this.state.waitingForKombainerSign) {
      this.props.navigation.navigate('VoditelTicketCreatedSuccessScreen');
    } else {
      // Если событие пришло до нажатия на "Принять", запоминаем это
      this.setState({ kombainerSignReceived: true });
    }
  };

  // Обработчик события отмены талона комбайнером
  handleKombainerCancelTalon = async (data: { talonId: string; reason: string }) => {
    this.kombainerCancelTalonListener?.remove();

    console.log('handleKombainerCancelTalon|data=', data);

    const { talonId, reason } = data;

    try {
      // Отменяем талон со статусом cancelled_by_kombainer
      try {
        await cancelTalonByKombainer(talonId, reason);
        console.log('handleKombainerCancelTalon: Талон отменен комбайнером');
      } catch (error: any) {
        console.error('handleKombainerCancelTalon|error =', error);
      }

      // Показываем уведомление пользователю
      Alert.alert('Отмена талона', `Комбайнер отменил талон.\nПричина: ${reason}`, [
        {
          text: 'OK',
          onPress: async () => {},
        },
      ]);

      try {
        // Корректно закрываем TCP соединение
        console.log('handleKombainerCancelTalon: Закрытие TCP-соединения...');
        await this.cleanupTcpConnection();
        console.log('handleKombainerCancelTalon: TCP-соединение закрыто успешно');
      } catch (error) {
        console.error('handleKombainerCancelTalon: Ошибка при закрытии соединения:', error);
        // Продолжаем выполнение даже при ошибке
      } finally {
        // После закрытия соединения переходим на экран создания поездки
        this.props.navigation.navigate('VoditelCreateTripScreen');
      }
    } catch (error) {
      console.error('handleKombainerCancelTalon: Ошибка при отмене талона:', error);
      Alert.alert('Ошибка', 'Произошла ошибка при обработке отмены талона комбайнером', [
        {
          text: 'OK',
          onPress: () => this.props.navigation.navigate('VoditelCreateTripScreen'),
        },
      ]);
    }
  };

  handleBackPress = () => {
    // Блокируем возврат назад, возвращая true
    console.log('VoditelTicketDetailAfterSetWeight|handleBackPress - блокировка возврата назад');

    // Показываем toast уведомление
    ToastAndroid.show('Для выхода нажмите кнопку "Отмена" на экране', ToastAndroid.SHORT);

    return true;
  };

  handleSetTalonOfKombainer = (data: IPayloadSetTalonOfKombainer): any => {
    this.setTalonOfKombainerListener?.remove();

    console.log('VoditelTicketDetailAfterSetWeight|handleSetTalonOfKombainer|data=', data);
    const { kombainerData, userData, weight, talonData } = data;

    // Обновляем состояние компонента: данные с весом загружены
    talonData.weight = weight; // Обновляем вес в данных талона

    this.setState({
      loadingKombainerDataWithWeight: false,
      loadingKombainerDataWithWeightSuccess: true,
      weight,
      talonData,
    });
  };

  /**
   * Метод для получения данных текущего пользователя и отправки TCP-запроса для получения данных комбайнера.
   */
  getKombainerData = async () => {
    let currentUser: CurrentUserResponse;
    try {
      const response = await handleMessage({
        req: {
          type: 'currentUser',
          data: { context: 'voditel' },
        },
        reqId: Date.now().toString(),
      });
      currentUser = response as CurrentUserResponse;
    } catch (error: unknown) {
      console.error('VoditelTicketDetailAfterSetWeight|currentUser|error =', error);
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      Alert.alert('Ошибка получения данных текущего пользователя', errorMessage);
      return;
    }

    console.log('VoditelTicketDetailAfterSetWeight|currentUser=', currentUser);

    let tcpResponse: SendTcpRequestResponse;
    let kombainerData: ICreateKombainerParams;
    let kombainerUserData: ICreateUsersParams;
    let talonData: ICreateTalonsParams;

    // В зависимости от контекста отправляем TCP-запрос за данными комбайнера
    switch (AuthStoreData.context) {
      case 'voditel': {
        try {
          const { talonId } = this.props.route.params || {};
          console.log(
            'VoditelTicketDetailAfterSetWeight|getKombainerData|talonId from params=',
            talonId
          );

          const data = await sendTcpRequest({
            type: 'get_kombainer_data',
            talonId,
          });
          console.log('VoditelTicketDetailAfterSetWeight|get_kombainer_data|data=', data);

          tcpResponse = { type: 'sendTcpRequest', data };
          console.log(
            'VoditelTicketDetailAfterSetWeight|get_kombainer_data|tcpResponse=',
            tcpResponse
          );

          // Проверяем, что данные имеют правильную структуру
          if (tcpResponse.type === 'sendTcpRequest' && tcpResponse.data) {
            const tcpData = tcpResponse.data as ITcpResponseKombainerData;
            kombainerData = tcpData.kombainerData;
            kombainerUserData = tcpData.kombainerUserData;
            talonData = tcpData.talonData; // Извлекаем talonData из ответа
          } else {
            throw new Error('Неверная структура ответа TCP');
          }
        } catch (error: unknown) {
          console.error('VoditelTicketDetailAfterSetWeight|error =', error);
          const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
          Alert.alert('Ошибка отправки данных талона', errorMessage);
          return;
        }
        break;
      }
      default:
        console.error(
          'VoditelTicketDetailAfterSetWeight|неизвестный context|AuthStoreData.context=',
          AuthStoreData.context
        );
        Alert.alert('Ошибка', `Неизвестный контекст: ${AuthStoreData.context}`);
        return;
    }

    // Обновляем состояние компонента: данные загружены
    this.setState({
      isKombainerData: true,
      loadingKombainerDataSuccess: true,
      loadingKombainerDataError: false,
      loadingKombainerData: false,
      userData: currentUser.userData,
      voditelData: currentUser.voditelData,
      kombainerData,
      kombainerUserData,
      talonData,
    });

    console.log('VoditelTicketDetailAfterSetWeight|data loaded successfully');
    console.log('VoditelTicketDetailAfterSetWeight|talonData set to state:', {
      id: talonData?.id,
      talonNumber: talonData?.talonNumber,
      voditelId: talonData?.voditelId,
    });
    console.log(
      'VoditelTicketDetailAfterSetWeight|route params talonId:',
      this.props.route.params?.talonId
    );
  };

  /**
   * Подтверждение талона с весом
   */
  confirmKombainerTicketWithWeight = async () => {
    // Устанавливаем состояние загрузки
    this.safeSetState({ approveTicketLoading: true });

    let sendRes: any;
    try {
      const data = await sendTcpRequest({
        type: 'confirm_kombainer_ticket_with_weight',
      });
      console.log(
        'VoditelTicketDetailAfterSetWeight|confirm_kombainer_ticket_with_weight|data=',
        data
      );
      sendRes = data;
    } catch (error: any) {
      console.error(
        'VoditelTicketDetailAfterSetWeight|confirmKombainerTicketWithWeight|error =',
        error
      );
      // При ошибке сбрасываем загрузку, но НЕ блокируем кнопку
      this.safeSetState({ approveTicketLoading: false });
      Alert.alert('Ошибка отправки данных талона', error.message || JSON.stringify(error));
      return;
    }

    if (sendRes.status !== 'ok') {
      // При ошибке сбрасываем загрузку, но НЕ блокируем кнопку
      this.safeSetState({ approveTicketLoading: false });
      Alert.alert('Ошибка подтверждения талона', JSON.stringify(sendRes));
      return;
    }

    // После успешного подтверждения показываем кнопку "Подписать талон" и блокируем текущую
    this.safeSetState({
      canSignTicket: true,
      approveTicketLoading: false,
      approveTicketDisabled: true, // Блокируем кнопку после успешного выполнения
    });
  };

  /**
   * Обработчик клика на кнопку подтверждения талона с весом
   */
  handleSignTicketClick = async () => {
    Alert.alert(
      'Подтверждение',
      'Своим действием Вы подтверждаете правильность созданного талона и записываете его в базу данных.',
      [
        {
          text: 'Отменить',
          style: 'cancel',
        },
        {
          text: 'Принять',
          style: 'default',
          onPress: async () => {
            this.setState({ signTicketLoading: true });
            try {
              console.log('handleSignTicketClick|signTicket|START');
              const { talonData, voditelData } = this.state;
              console.log('handleSignTicketClick|signTicket|talonData=', talonData);

              if (!talonData) {
                throw new Error('Нет данных талона для создания записи');
              }
              // Создаём запись талона комбайнера на основе talonData
              const talonId = await createTalon({
                id: talonData.id,
                kombainerId: talonData.kombainerId,
                voditelId: voditelData.id,
                status: 'voditel_signed',
                startTime: talonData.startTime,
                endTime: talonData.endTime,
                weight: talonData.weight,
                comment: talonData.comment,
                talonNumber: talonData.talonNumber,
              });
              console.log('handleSignTicketClick|createTalon|talonId=', talonId);
              console.log('handleSignTicketClick|createTalon|talonData.id=', talonData.id);
              // Далее стандартная логика
              const data = await sendTcpRequest({
                type: 'voditel_sign_ticket',
              });
              console.log('handleSignTicketClick|voditel_sign_ticket|data=', data);
              this.setState({
                waitingForKombainerSign: true,
                signTicketLoading: false,
                signTicketDisabled: true,
              });
              if (this.state.kombainerSignReceived) {
                this.props.navigation.navigate('VoditelTicketCreatedSuccessScreen');
              }
            } catch (error: any) {
              console.error('handleSignTicketClick|voditel_sign_ticket|error =', error);
              this.setState({ signTicketLoading: false });
              Alert.alert('Ошибка создания талона', error.message || JSON.stringify(error));
            }
          },
        },
      ]
    );
  };

  /**
   * Подтверждение талона без веса
   */
  confirmKombainerTicket = async () => {
    const { voditelData, userData } = this.state;

    if (!voditelData || !userData) {
      Alert.alert('Ошибка', 'Данные водителя или пользователя не найдены');
      return;
    }

    // Устанавливаем состояние загрузки
    this.setState({ confirmDataLoading: true });

    let sendRes: any;
    try {
      const data = await sendTcpRequest({
        type: 'confirm_kombainer_ticket',
        voditelData: voditelData,
        userData: userData,
      });
      console.log('VoditelTicketDetailAfterSetWeight|confirm_kombainer_ticket|data=', data);
      sendRes = data;
    } catch (error: any) {
      console.error('VoditelTicketDetailAfterSetWeight|confirmKombainerTicket|error =', error);
      // При ошибке сбрасываем загрузку, но НЕ блокируем кнопку
      this.setState({ confirmDataLoading: false });
      Alert.alert('Ошибка отправки данных талона', error.message || JSON.stringify(error));
      return;
    }

    if (sendRes.status !== 'ok') {
      // При ошибке сбрасываем загрузку, но НЕ блокируем кнопку
      this.setState({ confirmDataLoading: false });
      Alert.alert('Ошибка подтверждения талона', JSON.stringify(sendRes));
      return;
    }

    // При успешном выполнении блокируем кнопку и переходим к следующему этапу
    this.setState({
      isKombainerData: false,
      loadingKombainerDataSuccess: false,
      loadingKombainerDataError: false,
      loadingKombainerData: false,
      isKombainerDataWithWeight: true,
      confirmDataLoading: false,
      confirmDataDisabled: true, // Блокируем кнопку после успешного выполнения
    });

    console.log('VoditelTicketDetailAfterSetWeight|waitingKombainerDataWithWeightConfirm|init');
  };

  /**
   * Обработчик отмены операции
   */
  handleCancelClick = () => {
    // Защита от множественных нажатий
    if (this.state.cancelInProgress) {
      return;
    }

    // Если талон уже подписан (signTicketDisabled == true), запрашиваем комментарий
    if (this.state.signTicketDisabled) {
      // Открываем модальное окно для ввода комментария
      this.setState({ cancelModalVisible: true, cancelComment: '' });
    } else {
      // Если талон еще не подписан, показываем предупреждение
      Alert.alert('Предупреждение', 'Будет завершена работа с созданием талона. Вы уверены?', [
        {
          text: 'Отмена',
          style: 'cancel',
        },
        {
          text: 'Да',
          onPress: async () => {
            this.setState({ cancelInProgress: true });
            try {
              // Корректно закрываем TCP соединение перед переходом
              await this.cleanupTcpConnection();
              this.props.navigation.navigate('VoditelCreateTripScreen');
            } catch (error) {
              console.error('handleCancelClick|error=', error);
              // Все равно переходим, даже если произошла ошибка
              this.props.navigation.navigate('VoditelCreateTripScreen');
            }
          },
        },
      ]);
    }
  };

  /**
   * Обработчик закрытия модального окна отмены
   */
  handleCancelModalClose = () => {
    this.setState({ cancelModalVisible: false, cancelComment: '' });
  };

  /**
   * Обработчик подтверждения отмены с комментарием
   */
  handleCancelConfirm = async () => {
    const { cancelComment } = this.state;

    // Проверка наличия комментария
    if (!cancelComment || cancelComment.trim() === '') {
      Alert.alert('Ошибка', 'Необходимо указать причину отмены талона');
      return;
    }

    this.setState({ cancelInProgress: true, cancelModalVisible: false });

    try {
      // Сохраняем причину отмены талона в базе данных, если есть идентификатор
      const talonId = this.state.talonData?.id;
      if (talonId) {
        try {
          await cancelTalon(talonId, cancelComment.trim());

          try {
            const data = await sendTcpRequest({
              type: 'voditel_cancel_talon',
              talonId,
              reason: cancelComment.trim(),
            });
            console.log('handleCancelConfirm|voditel_cancel_talon|data=', data);
          } catch (error: any) {
            console.error('handleCancelConfirm|voditel_cancel_talon|error =', error);
          }

          console.log('Талон отменен с комментарием:', cancelComment.trim());
        } catch (error) {
          console.error('handleCancelConfirm|Ошибка при отмене талона:', error);
          // Показываем ошибку пользователю и не переходим на другой экран
          Alert.alert(
            'Ошибка отмены талона',
            error instanceof Error ? error.message : 'Произошла ошибка при отмене талона',
            [{ text: 'OK', onPress: () => this.setState({ cancelInProgress: false }) }]
          );
          return; // Останавливаем выполнение, не переходим на другой экран
        }
      }

      // Корректно закрываем TCP соединение перед переходом
      await this.cleanupTcpConnection();
      this.props.navigation.navigate('VoditelCreateTripScreen');
    } catch (error) {
      console.error('handleCancelConfirm|error=', error);
      // Ошибка при закрытии соединения - показываем уведомление, но все равно переходим
      Alert.alert(
        'Предупреждение',
        'Произошла ошибка при закрытии соединения, но операция отмены выполнена',
        [{ text: 'OK', onPress: () => this.props.navigation.navigate('VoditelCreateTripScreen') }]
      );
    }
  };

  render() {
    const {
      isKombainerData,
      loadingKombainerData,
      loadingKombainerDataSuccess,
      isKombainerDataWithWeight,
      loadingKombainerDataWithWeightSuccess,
      canSignTicket,
      waitingForKombainerSign,
      kombainerSignReceived,
      confirmDataLoading,
      confirmDataDisabled,
      approveTicketLoading,
      approveTicketDisabled,
      signTicketLoading,
      signTicketDisabled,
      weight,
      kombainerData,
      kombainerUserData,
      userData,
      voditelData,
      talonData,
    } = this.state;

    if (loadingKombainerData) {
      return (
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#98d642" />
        </View>
      );
    }

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <VectorLogo />

        <Text style={styles.title}>Талон комбайнера</Text>

        <View style={styles.formContainer}>
          {/* Номер талона комбайнера */}
          <View style={styles.formRow}>
            <Text style={styles.label}>Номер талона:</Text>
            <Text style={[styles.value, styles.talonNumber]}>
              {talonData?.talonNumber ? String(talonData.talonNumber).padStart(5, '0') : '-'}
            </Text>
          </View>

          <View style={styles.formRow}>
            <Text style={styles.label}>Дата:</Text>
            <Text style={styles.value}>
              {talonData?.created_at
                ? new Date(talonData.created_at).toLocaleDateString('ru-RU')
                : '-'}
            </Text>
          </View>

          <View style={styles.formRow}>
            <Text style={styles.label}>Время:</Text>
            <Text style={styles.value}>
              {talonData?.created_at
                ? new Date(talonData.created_at).toLocaleTimeString('ru-RU')
                : '-'}
            </Text>
          </View>

          {[
            ['Комбайн', kombainerData?.combine],
            ['Комбайнер', kombainerUserData?.fio],
            ['Культура', kombainerData?.culture],
            ['Поле', kombainerData?.field],
            ['Бригада', kombainerData?.brigade],
          ].map(([label, value]) => (
            <View key={label as string} style={styles.formRow}>
              <Text style={styles.label}>{label}:</Text>
              <Text style={styles.value}>{value || '-'}</Text>
            </View>
          ))}

          <View style={styles.formRow}>
            <Text style={styles.label}>Вес:</Text>
            <Text style={styles.value}>{weight || 'Будет указан комбайнером'}</Text>
          </View>

          <View style={styles.formRow}>
            <Text style={styles.label}>Физический вес зерна:</Text>
            <Text style={styles.value}>-</Text>
          </View>

          {[
            ['Транспорт', voditelData?.transport],
            ['Водитель', userData?.fio],
          ].map(([label, value]) => (
            <View key={label as string} style={styles.formRow}>
              <Text style={styles.label}>{label}:</Text>
              <Text style={styles.value}>{value}</Text>
            </View>
          ))}
        </View>

        {waitingForKombainerSign && !kombainerSignReceived && (
          <View style={styles.waitingContainer}>
            <ActivityIndicator size="large" color="#98d642" />
            <Text style={styles.waitingText}>Ожидание подписания талона комбайнером...</Text>
          </View>
        )}

        {kombainerSignReceived && (
          <View style={styles.successContainer}>
            <Text style={styles.successText}>✓ Подпись комбайнера получена</Text>
          </View>
        )}

        {isKombainerData && (
          <>
            {loadingKombainerDataSuccess ? (
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (confirmDataLoading || confirmDataDisabled) && styles.disabledButton,
                ]}
                onPress={this.confirmKombainerTicket}
                disabled={confirmDataLoading || confirmDataDisabled}
              >
                {confirmDataLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text
                    style={[
                      styles.submitButtonText,
                      (confirmDataLoading || confirmDataDisabled) && styles.disabledButtonText,
                    ]}
                  >
                    Подтвердить данные талона
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#98d642" />
              </View>
            )}
          </>
        )}

        {isKombainerDataWithWeight && !canSignTicket && (
          <>
            {loadingKombainerDataWithWeightSuccess ? (
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (approveTicketLoading || approveTicketDisabled) && styles.disabledButton,
                ]}
                onPress={this.confirmKombainerTicketWithWeight}
                disabled={approveTicketLoading || approveTicketDisabled}
              >
                {approveTicketLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text
                    style={[
                      styles.submitButtonText,
                      (approveTicketLoading || approveTicketDisabled) && styles.disabledButtonText,
                    ]}
                  >
                    Утвердить талон
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#98d642" />
              </View>
            )}
          </>
        )}

        {isKombainerDataWithWeight && canSignTicket && (
          <TouchableOpacity
            style={[
              styles.submitButton,
              (signTicketLoading || signTicketDisabled) && styles.disabledButton,
            ]}
            onPress={this.handleSignTicketClick}
            disabled={signTicketLoading || signTicketDisabled}
          >
            {signTicketLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text
                style={[
                  styles.submitButtonText,
                  (signTicketLoading || signTicketDisabled) && styles.disabledButtonText,
                ]}
              >
                Подписать талон
              </Text>
            )}
          </TouchableOpacity>
        )}

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
            {this.state.cancelInProgress ? 'Отмена...' : 'Отмена'}
          </Text>
        </TouchableOpacity>

        {/* Модальное окно для ввода комментария при отмене */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={this.state.cancelModalVisible}
          onRequestClose={this.handleCancelModalClose}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Отмена талона</Text>
              <Text style={styles.modalText}>Укажите причину отмены талона:</Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Введите комментарий"
                value={this.state.cancelComment}
                onChangeText={(text) => this.setState({ cancelComment: text })}
                multiline={true}
                numberOfLines={3}
                textAlignVertical="top"
                autoFocus={true}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={this.handleCancelModalClose}
                >
                  <Text style={styles.modalCancelButtonText}>Отмена</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.modalConfirmButton]}
                  onPress={this.handleCancelConfirm}
                >
                  <Text style={styles.modalConfirmButtonText}>Подтвердить</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 20,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  formRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
    alignItems: 'flex-start',
  },
  label: {
    flex: 2,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  value: {
    flex: 3,
    fontSize: 16,
    color: '#666',
    textAlign: 'left',
  },
  talonNumber: {
    fontWeight: 'bold',
    color: '#98d642',
    fontSize: 18,
  },
  submitButton: {
    backgroundColor: '#98d642',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: '#ff4d4f',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#cccccc', // Серый фон для отключенной кнопки
    opacity: 0.7,
  },
  disabledButtonText: {
    color: 'rgba(255, 255, 255, 0.7)', // Полупрозрачный белый для текста отключенной кнопки
  },
  loadingContainer: {
    marginVertical: 20,
  },
  waitingContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  waitingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  successContainer: {
    marginVertical: 20,
    alignItems: 'center',
    backgroundColor: '#f6ffed',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#b7eb8f',
    width: '100%',
  },
  successText: {
    fontSize: 16,
    color: '#52c41a',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Стили для модального окна
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
    minHeight: 80,
    maxHeight: 120,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  modalCancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  modalConfirmButton: {
    backgroundColor: '#98d642',
  },
  modalConfirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VoditelTicketDetailAfterSetWeight;
