import React, { Component } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  DeviceEventEmitter,
  BackHandler,
  ToastAndroid,
  Modal,
} from 'react-native';
import { NavigationProp, RouteProp } from '@react-navigation/native';
import { handleMessage } from '../../services/MessageHandler';
import { tcpServerSendRequest } from '../../wifi/TcpServer';
import { closeKombainerConnections } from '../../services/ConnectionManager';
import { VectorLogo } from '../../components/VectorLogo';
import {
  ICreateTalonsParams,
  getTalonById,
  updateTalonWeight,
  cancelTalon,
  cancelTalonByVoditel,
} from '../../db/talons_of_combainers';
import { AuthStoreData } from '../../stores/AuthStore';
import { ICreateUsersParams } from '../../db/users';
import {
  CurrentUserResponse,
  ICreateVoditelParams,
  IPayloadConfirmKombainerTicket,
  ISendPostResponseCurrentUser,
  ISendPostResponseNeedRedirect,
  ISendTcpResponse,
  NeedRedirectResponse,
  PositionOptionValue,
  RootStackParamList,
  ICreateUserParams,
} from '../../../global';
import KeepAwake from 'react-native-keep-awake';

interface KombainerTicketDetailAfterVoditelConfirmProps {
  navigation: NavigationProp<RootStackParamList>;
  route: RouteProp<RootStackParamList, 'KombainerTicketDetailAfterVoditelConfirmScreen'>;
}

interface KombainerTicketDetailAfterVoditelConfirmState {
  loading: boolean;
  confirmDataError: boolean;
  connectDataError: boolean;
  data: CurrentUserResponse | null;
  voditelData: ICreateVoditelParams | null;
  voditelUserData: ICreateUserParams | null;
  isVoditelTalonConfirm: boolean;
  isVoditelTalonConfirmSuccess: boolean;
  isVoditelTalonConfirmError: boolean;
  isVoditelTalonConfirmAfterSetWeight: boolean;
  isVoditelTalonConfirmAfterSetWeightSuccess: boolean;
  isVoditelTalonConfirmAfterSetWeightError: boolean;
  weightValue: string;
  weightError: string | null;
  isWaitingVoditelWeightConfirm?: boolean; // новое состояние
  canApproveTicket?: boolean; // новое состояние для кнопки "Подписать талон"
  waitingForVoditelSign?: boolean; // Ожидание события voditelSignTicket
  voditelSignReceived?: boolean; // Получено ли событие voditelSignTicket (kombainerSignReceived)
  cancelInProgress?: boolean; // Добавляем флаг для защиты от множественных нажатий кнопки "Отменить"

  // Состояния для отслеживания загрузки кнопок
  confirmWeightLoading?: boolean; // Загрузка для "Подтвердить введенный вес и данные водителя"
  confirmWeightDisabled?: boolean; // Блокировка после успешного выполнения

  signTicketLoading?: boolean; // Загрузка для "Подписать талон"
  signTicketDisabled?: boolean; // Блокировка после успешного выполнения

  // Состояния для модального окна отмены
  cancelModalVisible?: boolean;
  cancelComment?: string;

  talonData?: ICreateTalonsParams | null; // Данные талона с правильной типизацией
  talonId?: string; // ID талона для загрузки данных
  closingConnections?: boolean; // Новое состояние для отслеживания закрытия соединений
}

/**
 * Страница "Талон комбайнера N" после подключения водителя,
 * реализованная в виде классового компонента для React Native.
 */
class KombainerTicketDetailAfterVoditelConfirm extends Component<
  KombainerTicketDetailAfterVoditelConfirmProps,
  KombainerTicketDetailAfterVoditelConfirmState
> {
  // Для отслеживания предыдущего значения поля weight
  previousWeight: string = '';
  // Слушатель события подключения водителя
  voditelConnectedListener: any = null;
  // Слушатель события подтверждения веса водителем
  voditelConfirmWithWeightListener: any = null;
  // Слушатель для события подписания талона водителем
  voditelSignTicketListener: any = null;
  // Слушатель для события отмены талона водителем
  voditelCancelTalonListener: any = null;
  // Слушатель для блокировки кнопки "Назад"
  backHandlerListener: any = null;

  constructor(props: KombainerTicketDetailAfterVoditelConfirmProps) {
    super(props);
    this.state = {
      loading: true,
      confirmDataError: false,
      connectDataError: false,
      data: null,
      voditelData: null,
      voditelUserData: null,
      isVoditelTalonConfirm: true,
      isVoditelTalonConfirmError: false,
      isVoditelTalonConfirmSuccess: false,
      isVoditelTalonConfirmAfterSetWeight: false,
      isVoditelTalonConfirmAfterSetWeightSuccess: false,
      isVoditelTalonConfirmAfterSetWeightError: false,
      weightValue: '',
      weightError: null,
      isWaitingVoditelWeightConfirm: false, // Изначально не ждем подтверждения веса
      canApproveTicket: false, // по умолчанию скрыта
      waitingForVoditelSign: false,
      voditelSignReceived: false,
      cancelInProgress: false, // Инициализация флага защиты от множественных нажатий

      // Инициализация состояний для отслеживания загрузки кнопок
      confirmWeightLoading: false,
      confirmWeightDisabled: false,

      signTicketLoading: false,
      signTicketDisabled: false,

      // Инициализация состояний для модального окна отмены
      cancelModalVisible: false,
      cancelComment: '',

      talonData: null, // Инициализация данных талона
      talonId: props.route?.params?.talonId || '', // Получаем talonId из параметров навигации
      closingConnections: false, // Инициализируем новое состояние
    };
  }

  componentDidMount() {
    console.log('KombainerTicketDetailAfterVoditelConfirm|componentDidMount');

    // Получаем данные из параметров навигации
    const voditelConnectedData = this.props.route?.params?.data;

    if (!voditelConnectedData) {
      this.setState({
        connectDataError: true,
      });
      return;
    }
    // Включаем не гаснущий экран
    KeepAwake.activate();

    // Удаляем существующие слушатели перед добавлением новых
    this.removeAllListeners();

    // Блокируем кнопку "Назад"
    this.backHandlerListener = BackHandler.addEventListener(
      'hardwareBackPress',
      this.handleBackPress
    );

    // Добавляем слушатель события подписания талона водителем
    this.voditelSignTicketListener = DeviceEventEmitter.addListener(
      'voditelSignTicket',
      this.handleVoditelSignTicket
    );

    // Добавляем слушатель события отмены талона водителем
    this.voditelCancelTalonListener = DeviceEventEmitter.addListener(
      'voditelCancelTalon',
      this.handleVoditelCancelTalon
    );

    // Добавляем слушатель события подтверждения от водителя здесь, один раз
    this.voditelConnectedListener = DeviceEventEmitter.addListener(
      'voditelConfirmAfterConnect',
      this.handleVoditelConfirmAfterConnect
    );

    // Добавляем слушатель события подтверждения веса водителем
    this.voditelConfirmWithWeightListener = DeviceEventEmitter.addListener(
      'voditelConfirmWithWeight',
      this.handleVoditelConfirmWithWeight
    );

    Alert.alert(
      'Подключение к устройству прошло успешно',
      'Необходимо дождаться проверки информации талона водителем'
    );

    // Сохраняем данные водителя в состоянии компонента
    this.setState(
      {
        voditelData: voditelConnectedData.voditelData,
        voditelUserData: voditelConnectedData.voditelUserData,
      },
      () => {
        // После обновления состояния загружаем данные комбайнера
        this.fetchData();
        // Также загружаем данные талона
        this.fetchTalonData();
      }
    );
  }

  // Асинхронный метод загрузки данных текущего пользователя.
  async fetchData() {
    try {
      const response = await handleMessage({
        req: {
          type: 'currentUser',
          data: { context: 'kombainer' as PositionOptionValue },
        },
        reqId: 'getCurrentUser_' + Date.now(),
      });

      if (response.type !== 'currentUser') {
        throw new Error('Failed to get current user');
      }

      this.setState({
        data: response as CurrentUserResponse,
      });

      console.log('KombainerWaitTicketConfirm|waitingVoditelConfirm|init');
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    } finally {
      this.setState({ loading: false });
    }
  }

  // Асинхронный метод загрузки данных талона по ID
  async fetchTalonData() {
    const { talonId } = this.state;

    if (!talonId) {
      console.warn('fetchTalonData: talonId отсутствует');
      return;
    }

    try {
      const talonData = await getTalonById(talonId);

      console.log('fetchTalonData|talonData=', talonData);

      this.setState({
        talonData: talonData,
      });
    } catch (error) {
      console.error('Ошибка загрузки данных талона:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить данные талона');
    }
  }

  handleVoditelConfirmAfterConnect = (data: IPayloadConfirmKombainerTicket): any => {
    this.voditelConnectedListener?.remove();
    console.log(
      'KombainerTicketDetailAfterVoditelConfirm|handleVoditelConfirmAfterConnect|data=',
      data
    );
    this.setState({
      isVoditelTalonConfirm: true,
      isVoditelTalonConfirmSuccess: true,
      isVoditelTalonConfirmError: false,
    });
  };

  // Обработчик события подтверждения веса водителем
  handleVoditelConfirmWithWeight = (data: any): any => {
    this.voditelConfirmWithWeightListener?.remove();

    console.log(
      'KombainerTicketDetailAfterVoditelConfirm|handleVoditelConfirmWithWeight|data=',
      data
    );

    // Показываем кнопку "Подписать талон"
    this.setState({
      canApproveTicket: true,
      isWaitingVoditelWeightConfirm: false,
    });
  };

  // Валидация веса перед отправкой
  validateWeight = (): boolean => {
    const { weightValue } = this.state;

    if (!weightValue || weightValue.trim() === '') {
      this.setState({ weightError: 'Поле "Вес" обязательно для заполнения' });
      return false;
    }

    // Проверка корректности числового значения
    const regex = /^[0-9]+(\.[0-9]*)?$/;
    if (!regex.test(weightValue)) {
      this.setState({ weightError: 'Введите корректное числовое значение' });
      return false;
    }

    this.setState({ weightError: null });
    return true;
  };

  // Дополнительная валидация для мобильного приложения
  validateWeightInput = (text: string): boolean => {
    // Проверяем, что значение не слишком большое (например, не больше 999999)
    const numValue = parseFloat(text);
    if (!isNaN(numValue) && numValue > 999999) {
      return false;
    }

    // Проверяем количество знаков после запятой (не больше 3)
    if (text.includes('.')) {
      const [, decimalPart] = text.split('.');
      if (decimalPart && decimalPart.length > 3) {
        return false;
      }
    }

    return true;
  };

  // Обработчик успешной отправки формы.
  onSubmitForm = async () => {
    if (!this.validateWeight()) return;

    const { data, weightValue, talonId } = this.state;

    // Проверка наличия необходимых данных
    if (!data || !data.kombainerData || !data.userData) {
      Alert.alert('Ошибка', 'Отсутствуют необходимые данные комбайнера для отправки');
      return;
    }
    if (!talonId) {
      Alert.alert('Ошибка', 'Не найден ID талона для обновления веса');
      return;
    }

    // Устанавливаем состояние загрузки
    this.setState({ confirmWeightLoading: true });

    console.log('onSubmitForm|this.state.talonData=', this.state.talonData);

    try {
      const talonData = await getTalonById(talonId);

      // Сначала обновляем вес талона в базе данных
      await updateTalonWeight(talonId, parseFloat(weightValue));

      // Отправляем запрос через TCP
      const tcpResponse = await tcpServerSendRequest({
        type: 'set_talon_of_kombainer',
        kombainerData: data.kombainerData,
        userData: data.userData,
        weight: parseFloat(weightValue),
        talonData,
      });

      console.log('onFinish|set_talon_of_kombainer|tcpResponse=', tcpResponse);

      // После успешной отправки блокируем кнопку и показываем состояние ожидания
      this.setState({
        isWaitingVoditelWeightConfirm: true,
        confirmWeightLoading: false,
        confirmWeightDisabled: true, // Блокируем кнопку после успешного выполнения
      });
    } catch (error: any) {
      console.error('onFinish|set_talon_of_kombainer|error =', error);
      // При ошибке сбрасываем загрузку, но НЕ блокируем кнопку
      this.setState({ confirmWeightLoading: false });
      Alert.alert('Ошибка', error.message || JSON.stringify(error));
    }
  };

  // Обработчик клика "Назад".
  handleBack = () => {
    this.props.navigation.goBack();
  };

  // Обработчик аппаратной кнопки "Назад"
  handleBackPress = () => {
    // Блокируем возврат назад, возвращая true
    console.log(
      'KombainerTicketDetailAfterVoditelConfirm|handleBackPress - блокировка возврата назад'
    );

    // Показываем toast уведомление
    ToastAndroid.show('Для выхода нажмите кнопку "Отмена" на экране', ToastAndroid.SHORT);

    return true;
  };

  handleCancelClick = async () => {
    // Защита от множественных нажатий
    if (this.state.cancelInProgress) {
      return;
    }

    // Открываем модальное окно для ввода комментария
    this.setState({ cancelModalVisible: true, cancelComment: '' });
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

    // Показываем уведомление о закрытии TCP-соединения
    Alert.alert(
      'Закрытие TCP-соединения',
      'TCP-соединение с устройством водителя будет закрыто. Обмен данными прекратится.',
      [
        {
          text: 'Отмена',
          style: 'cancel',
          onPress: () => this.setState({ cancelInProgress: false }),
        },
        {
          text: 'Закрыть',
          style: 'destructive',
          onPress: async () => {
            try {
              // Сохраняем причину отмены талона в базе данных
              if (this.state.talonId) {
                try {
                  await cancelTalon(this.state.talonId, cancelComment.trim());

                  try {
                    const tcpResponse = await tcpServerSendRequest({
                      type: 'kombainer_cancel_talon',
                      talonId: this.state.talonId,
                      reason: cancelComment.trim(),
                    });

                    console.log(
                      'handleCancelConfirm|kombainer_cancel_talon|tcpResponse=',
                      tcpResponse
                    );
                  } catch (error) {
                    console.error('Ошибка при отправке TCP-запроса:', error);
                  }

                  console.log(
                    'handleCancelConfirm|Талон отменен с комментарием:',
                    cancelComment.trim()
                  );
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

              await this.cancel();
              console.log('handleCancelConfirm|Соединения закрыты');
            } catch (error) {
              console.error('handleCancelConfirm|Ошибка при закрытии соединений:', error);
              // Ошибка при закрытии соединения - показываем уведомление, но все равно переходим
              Alert.alert(
                'Предупреждение',
                'Произошла ошибка при закрытии соединения, но операция отмены выполнена',
                [
                  {
                    text: 'OK',
                    onPress: () => this.props.navigation.navigate('KombainerCreateTicketScreen'),
                  },
                ]
              );
              return;
            }
            this.props.navigation.navigate('KombainerCreateTicketScreen');
          },
        },
      ]
    );
  };

  cancel = async () => {
    console.log('KombainerTicketDetailAfterVoditelConfirm: Вызывается функция cancel');

    try {
      await closeKombainerConnections('KombainerTicketDetailAfterVoditelConfirm.cancel');
    } catch (error) {
      console.error(
        'KombainerTicketDetailAfterVoditelConfirm.cancel: Ошибка при закрытии соединений:',
        error
      );
    }
  };

  handleVoditelSignTicket = async () => {
    this.voditelSignTicketListener?.remove();
    console.log('KombainerTicketDetailAfterVoditelConfirm|handleVoditelSignTicket');

    // Если мы ожидаем подписания, закрываем соединения и переходим на следующий экран
    if (this.state.waitingForVoditelSign) {
      // Показываем прелоадер
      this.setState({ closingConnections: true });

      try {
        // Закрываем соединения
        console.log('handleVoditelSignTicket: Закрытие TCP-соединения...');
        await closeKombainerConnections(
          'KombainerTicketDetailAfterVoditelConfirm.handleVoditelSignTicket'
        );
        console.log('handleVoditelSignTicket: TCP-соединение закрыто успешно');
      } catch (error) {
        console.error('handleVoditelSignTicket: Ошибка при закрытии соединений:', error);
        // Продолжаем выполнение даже при ошибке
      } finally {
        // После закрытия соединений переходим на следующий экран
        this.props.navigation.navigate('KombainerTicketCreatedSuccessScreen');
      }
    } else {
      // Если событие пришло до нажатия на "Принять", запоминаем это для отображения в UI
      this.setState({ voditelSignReceived: true });
    }
  };

  // Обработчик события отмены талона водителем
  handleVoditelCancelTalon = async (data: { talonId: string; reason: string }) => {
    this.voditelCancelTalonListener?.remove();
    console.log('KombainerTicketDetailAfterVoditelConfirm|handleVoditelCancelTalon|data=', data);

    const { talonId, reason } = data;

    try {
      // Отменяем талон со статусом cancelled_by_voditel
      await cancelTalonByVoditel(talonId, reason);
      console.log('handleVoditelCancelTalon: Талон отменен водителем');

      // Показываем прелоадер
      this.setState({ closingConnections: true });

      try {
        // Закрываем соединения
        console.log('handleVoditelCancelTalon: Закрытие TCP-соединения...');
        await closeKombainerConnections(
          'KombainerTicketDetailAfterVoditelConfirm.handleVoditelCancelTalon'
        );
        console.log('handleVoditelCancelTalon: TCP-соединение закрыто успешно');
      } catch (error) {
        console.error('handleVoditelCancelTalon: Ошибка при закрытии соединений:', error);
        // Продолжаем выполнение даже при ошибке
      } finally {
        // После закрытия соединений переходим на экран создания талона
        this.props.navigation.navigate('KombainerCreateTicketScreen');
      }

      // Показываем уведомление пользователю
      Alert.alert('Отмена талона', `Водитель отменил талон.\nПричина: ${reason}`, [
        {
          text: 'OK',
          onPress: async () => {},
        },
      ]);
    } catch (error) {
      console.error('handleVoditelCancelTalon: Ошибка при отмене талона:', error);
      Alert.alert('Ошибка', 'Произошла ошибка при обработке отмены талона водителем', [
        {
          text: 'OK',
          onPress: () => this.props.navigation.navigate('KombainerCreateTicketScreen'),
        },
      ]);
    }
  };

  handleApproveClick = async () => {
    // Показываем диалог подтверждения перед подписанием талона
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
            // Устанавливаем состояние загрузки
            this.setState({ signTicketLoading: true });

            try {
              // Отправляем TCP-запрос для подписания талона комбайнером
              const data = await tcpServerSendRequest({
                type: 'kombainer_sign_ticket',
              });
              console.log(
                'KombainerTicketDetailAfterVoditelConfirm|kombainer_sign_ticket|data=',
                data
              );

              // Успешное выполнение - блокируем кнопку и устанавливаем состояние ожидания
              this.setState({
                waitingForVoditelSign: true,
                signTicketLoading: false,
                signTicketDisabled: true, // Блокируем кнопку после успешного выполнения
              });

              // Если событие уже получено, сразу переходим
              if (this.state.voditelSignReceived) {
                this.props.navigation.navigate('KombainerTicketCreatedSuccessScreen');
              }
            } catch (error: any) {
              console.error(
                'KombainerTicketDetailAfterVoditelConfirm|kombainer_sign_ticket|error =',
                error
              );
              // При ошибке сбрасываем загрузку, но НЕ блокируем кнопку
              this.setState({ signTicketLoading: false });
              Alert.alert('Ошибка подписания талона', error.message || JSON.stringify(error));
            }
          },
        },
      ]
    );
  }; // Дополнительная обработка для контроля ввода

  handleWeightChangeWithValidation = (text: string) => {
    // Проверяем дополнительные ограничения
    if (!this.validateWeightInput(text)) {
      return; // Не обновляем состояние, если валидация не прошла
    }

    // Сохраняем предыдущее значение для сравнения
    const prevValue = this.previousWeight;

    // Обработка случая, когда пользователь удаляет символы из '0.'
    if (prevValue === '0.' && (text === '0' || text === '.')) {
      this.setState({ weightValue: '', weightError: null });
      this.previousWeight = '';
      return;
    }

    // Обработка случая, когда после удаления остается только точка
    if (text === '.' && prevValue !== '0.') {
      this.setState({ weightValue: '0.', weightError: null });
      this.previousWeight = '0.';
      return;
    }

    // Вызываем основную логику
    this.handleWeightChange(text);
  };

  // Обработчик изменения значения веса
  handleWeightChange = (text: string) => {
    // Разрешаем только цифры и точку
    const regex = /^[0-9]*\.?[0-9]*$/;
    if (!regex.test(text)) return;

    // Предотвращаем ввод нескольких точек
    if ((text.match(/\./g) || []).length > 1) return;

    // Если пытаются удалить автоматически вставленный '0.' (text='.' после удаления '0')
    if (text === '.' && this.previousWeight === '0.') {
      this.setState({ weightValue: '', weightError: null });
      this.previousWeight = '';
      return;
    }

    const previousValue = this.previousWeight;

    // Удаление всего значения
    if (text === '') {
      this.setState({ weightValue: '', weightError: null });
      this.previousWeight = '';
      return;
    }

    // Ввод точки в пустое поле -> 0.
    if (text === '.') {
      const newValue = '0.';
      this.setState({ weightValue: newValue, weightError: null });
      this.previousWeight = newValue;
      return;
    }

    // Ввод нуля в пустое поле или удаление точки -> очистка
    if (text === '0') {
      if (previousValue === '0.') {
        this.setState({ weightValue: '', weightError: null });
        this.previousWeight = '';
        return;
      }
      const newValue = '0.';
      this.setState({ weightValue: newValue, weightError: null });
      this.previousWeight = newValue;
      return;
    }

    // Предотвращение ввода более двух нулей в начале
    if (/^0{2}/.test(text)) {
      const newValue = '0.' + text.slice(2);
      this.setState({ weightValue: newValue, weightError: null });
      this.previousWeight = newValue;
      return;
    }

    // Обычный ввод (например '0.5', '12', '12.3')
    this.setState({ weightValue: text, weightError: null });
    this.previousWeight = text;
  };

  // Обработчик потери фокуса - усекает лишние нули
  handleWeightBlur = () => {
    const { weightValue } = this.state;
    if (!weightValue || !weightValue.includes('.')) return;

    const [integerPart, decimalPart] = weightValue.split('.');
    const trimmed = decimalPart.replace(/0+$/, '');
    const formatted = trimmed ? `${integerPart}.${trimmed}` : integerPart;

    // Обновляем состояние только если значение изменилось
    if (formatted !== weightValue) {
      this.setState({ weightValue: formatted });
      this.previousWeight = formatted;
    }
  };

  /**
   * Метод для безопасного удаления всех слушателей
   */
  removeAllListeners = () => {
    this.voditelConnectedListener?.remove();
    this.voditelConfirmWithWeightListener?.remove();
    this.voditelSignTicketListener?.remove();
    this.voditelCancelTalonListener?.remove();
    this.backHandlerListener?.remove();
  };

  componentWillUnmount() {
    // Отключаем не гаснущий экран
    KeepAwake.deactivate();

    // Удаляем все слушатели
    this.removeAllListeners();
  }

  render() {
    const {
      loading,
      confirmDataError,
      connectDataError,
      data,
      voditelData,
      voditelUserData,
      isVoditelTalonConfirm,
      isVoditelTalonConfirmSuccess,
      isVoditelTalonConfirmError,
      isVoditelTalonConfirmAfterSetWeight,
      isVoditelTalonConfirmAfterSetWeightSuccess,
      isVoditelTalonConfirmAfterSetWeightError,
      weightValue,
      weightError,
      isWaitingVoditelWeightConfirm,
      canApproveTicket,
      confirmWeightLoading,
      confirmWeightDisabled,
      signTicketLoading,
      signTicketDisabled,
      closingConnections,
    } = this.state;

    if (confirmDataError) {
      return (
        <View style={styles.container}>
          <Text style={styles.errorText}>Ошибка переданного confirmData</Text>
        </View>
      );
    }

    if (connectDataError) {
      return (
        <View style={styles.container}>
          <Text style={styles.errorText}>
            Отсутствуют необходимые данные, которые должны быть получены при подключении устройства
          </Text>
        </View>
      );
    }

    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#98d642" />
          <Text style={styles.loadingText}>Загрузка данных...</Text>
        </View>
      );
    }

    // Отображаем прелоадер закрытия соединений, если необходимо
    if (closingConnections) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#98d642" />
          <Text style={styles.loadingText}>Закрытие соединений...</Text>
          <Text style={styles.loadingSubText}>Пожалуйста, подождите</Text>
        </View>
      );
    }

    const ticketData = [
      [
        'Номер талона',
        this.state.talonData?.talonNumber
          ? String(this.state.talonData.talonNumber).padStart(5, '0')
          : 'Не указан',
      ],
      ['Дата', new Date(this.state.talonData.created_at).toLocaleDateString('ru-RU')],
      ['Время', new Date(this.state.talonData.created_at).toLocaleTimeString('ru-RU')],
      ['Комбайн', data?.kombainerData?.combine],
      ['Комбайнер', data?.userData?.fio],
      ['Культура', data?.kombainerData?.culture],
      ['Поле', data?.kombainerData?.field],
      ['Бригада', data?.kombainerData?.brigade],
    ];

    const voditelTicketData = [
      ['Транспорт', voditelData?.transport],
      ['Водитель', voditelUserData?.fio],
    ];

    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
          <View style={styles.content}>
            {/* Логотип */}
            <View style={styles.logoContainer}>
              <VectorLogo />
            </View>

            {/* Заголовок */}
            <Text style={styles.title}>Талон комбайнера</Text>

            {/* Данные талона */}
            <View style={styles.formContainer}>
              {ticketData.map(([label, value], index) => (
                <View key={index} style={styles.formRow}>
                  <View style={styles.labelContainer}>
                    <Text style={styles.labelText}>{label}:</Text>
                  </View>
                  <View style={styles.valueContainer}>
                    <Text style={index === 0 ? styles.talonNumberText : styles.valueText}>
                      {value || '-'}
                    </Text>
                  </View>
                </View>
              ))}

              {/* Поле для ввода веса */}
              <View style={styles.formRow}>
                <View style={styles.labelContainer}>
                  <Text style={styles.labelText}>Вес:</Text>
                </View>
                <View style={styles.valueContainer}>
                  <TextInput
                    style={[
                      styles.input,
                      weightError ? styles.inputError : null,
                      isVoditelTalonConfirmAfterSetWeight ? styles.inputDisabled : null,
                    ]}
                    placeholder="Введите вес"
                    value={weightValue}
                    onChangeText={this.handleWeightChangeWithValidation}
                    onBlur={this.handleWeightBlur}
                    keyboardType="decimal-pad"
                    editable={
                      !isVoditelTalonConfirmAfterSetWeight &&
                      !isWaitingVoditelWeightConfirm &&
                      !canApproveTicket
                    }
                  />
                  {weightError ? <Text style={styles.errorHint}>{weightError}</Text> : null}
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.labelContainer}>
                  <Text style={styles.labelText}>Физический вес зерна:</Text>
                </View>
                <View style={styles.valueContainer}>
                  <Text style={styles.valueText}>-</Text>
                </View>
              </View>

              {/* Данные водителя */}
              {voditelTicketData.map(([label, value], index) => (
                <View key={index} style={styles.formRow}>
                  <View style={styles.labelContainer}>
                    <Text style={styles.labelText}>{label}:</Text>
                  </View>
                  <View style={styles.valueContainer}>
                    <Text style={styles.valueText}>{value || '-'}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Состояние ожидания подтверждения от водителя и кнопки */}
            {!canApproveTicket && !isWaitingVoditelWeightConfirm && isVoditelTalonConfirm && (
              <View style={styles.actionsContainer}>
                {isVoditelTalonConfirmSuccess ? (
                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      (confirmWeightLoading || confirmWeightDisabled) && styles.disabledButton,
                    ]}
                    onPress={this.onSubmitForm}
                    disabled={confirmWeightLoading || confirmWeightDisabled}
                  >
                    {confirmWeightLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text
                        style={[
                          styles.submitButtonText,
                          (confirmWeightLoading || confirmWeightDisabled) &&
                            styles.disabledButtonText,
                        ]}
                      >
                        Подтвердить введенный вес и данные водителя
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={styles.loadingStateContainer}>
                    <Text style={styles.loadingStateText}>Ожидание подтверждения от водителя</Text>
                    <ActivityIndicator
                      size="large"
                      color="#98d642"
                      style={styles.loadingIndicator}
                    />
                  </View>
                )}
              </View>
            )}

            {/* Новый блок: ожидание подтверждения веса водителем */}
            {isWaitingVoditelWeightConfirm && (
              <View style={styles.actionsContainer}>
                <View style={styles.loadingStateContainer}>
                  <Text style={styles.loadingStateText}>
                    Данные талона, а так же указанный вес были отправлены водителю
                  </Text>
                  {/* Отображаем статус получения подписи водителя */}
                  {this.state.voditelSignReceived && (
                    <View style={styles.statusContainer}>
                      <Text style={styles.successStatusText}>✓ Подпись водителя получена</Text>
                    </View>
                  )}
                  <ActivityIndicator size="large" color="#98d642" style={styles.loadingIndicator} />
                </View>
              </View>
            )}

            {/* Кнопка "Подписать талон" появляется после подтверждения водителем */}
            {canApproveTicket && (
              <View style={styles.actionsContainer}>
                {/* Отображаем статус получения подписи водителя */}
                {this.state.voditelSignReceived && (
                  <View style={styles.statusContainer}>
                    <Text style={styles.successStatusText}>✓ Подпись водителя получена</Text>
                  </View>
                )}

                {/* Если ожидаем подпись талона водителем */}
                {!this.state.voditelSignReceived ? (
                  <View style={styles.loadingStateContainer}>
                    <Text style={styles.loadingStateText}>
                      Ожидание подписи талона водителем...
                    </Text>
                    <ActivityIndicator
                      size="large"
                      color="#98d642"
                      style={styles.loadingIndicator}
                    />
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      (signTicketLoading || signTicketDisabled) && styles.disabledButton,
                    ]}
                    onPress={this.handleApproveClick}
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
              </View>
            )}

            {/* Кнопка отмены */}
            <TouchableOpacity
              style={[
                styles.cancelButton,
                (isWaitingVoditelWeightConfirm || this.state.cancelInProgress) &&
                  styles.disabledButton,
              ]}
              onPress={this.handleCancelClick}
              disabled={isWaitingVoditelWeightConfirm || this.state.cancelInProgress}
            >
              <Text
                style={[
                  styles.cancelButtonText,
                  (isWaitingVoditelWeightConfirm || this.state.cancelInProgress) &&
                    styles.disabledButtonText,
                ]}
              >
                {this.state.cancelInProgress ? 'Отмена...' : 'Отмена'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Модальное окно для ввода комментария при отмене */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={this.state.cancelModalVisible || false}
          onRequestClose={this.handleCancelModalClose}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Отмена талона</Text>
              <Text style={styles.modalText}>Укажите причину отмены талона:</Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Введите комментарий"
                value={this.state.cancelComment || ''}
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
      </KeyboardAvoidingView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  logoContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 32,
    textAlign: 'center',
    color: '#333333',
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 24,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f0f8e8',
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#98d642',
  },
  labelContainer: {
    flex: 2,
    justifyContent: 'center',
  },
  labelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  valueContainer: {
    flex: 3,
    justifyContent: 'center',
  },
  valueText: {
    fontSize: 16,
    color: '#333333',
  },
  talonNumberText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#98d642',
  },
  input: {
    height: 40,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 4,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#333333',
  },
  inputError: {
    borderColor: '#ff4d4f',
  },
  inputDisabled: {
    backgroundColor: '#f5f5f5',
    color: '#999999',
  },
  errorHint: {
    color: '#ff4d4f',
    fontSize: 12,
    marginTop: 4,
  },
  actionsContainer: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#98d642',
    borderRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginVertical: 8,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#ff4d4f',
    borderRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Стили для отключенной кнопки
  disabledButton: {
    backgroundColor: '#cccccc', // Серый фон для отключенной кнопки основного действия
    opacity: 0.7,
  },
  disabledButtonText: {
    color: 'rgba(255, 255, 255, 0.7)', // Полупрозрачный белый для текста отключенной кнопки
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  loadingSubText: {
    marginTop: 8,
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
  },
  loadingStateContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingStateText: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 16,
  },
  loadingIndicator: {
    marginTop: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#ff4d4f',
    textAlign: 'center',
    padding: 20,
  },
  statusContainer: {
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f6ffed',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#b7eb8f',
    alignSelf: 'stretch',
  },
  successStatusText: {
    fontSize: 16,
    color: '#52c41a',
    fontWeight: '600',
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

export default KombainerTicketDetailAfterVoditelConfirm;
