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
} from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { handleMessage } from '../../services/MessageHandler';
import { stopTcpServer } from '../../wifi/TcpServer';
import { VectorLogo } from '../../components/VectorLogo';
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
  SendTcpRequestResponse,
  ICreateUserParams,
} from '../../../global';

interface KombainerTicketDetailAfterVoditelConfirmProps {
  navigation: NavigationProp<RootStackParamList>;
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
  // Контроллер для периодического опроса данных (например, для needRedirect)
  waitingVoditelTalonConfirmCtrl: number | null = null;
  // Контроллер для ожидания подтверждения веса водителем
  waitingVoditelWeightConfirmCtrl: number | null = null;

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
    };
  }

  componentDidMount() {
    console.log('KombainerTicketDetailAfterVoditelConfirm|componentDidMount');
    if (!AuthStoreData.payloadVoditelConnectSuccess) {
      this.setState({
        connectDataError: true,
      });
      return;
    }
    // Включаем не гаснущий экран
    handleMessage({
      req: { type: 'enableKeepAwake' },
      reqId: 'enableKeepAwake_' + Date.now(),
    })
      .then(() => console.log('Экран не будет гаснуть'))
      .catch((error) => console.error('Ошибка при включении функции не гаснущего экрана:', error));

    Alert.alert(
      'Подключение к устройству прошло успешно',
      'Необходимо дождаться проверки информации талона водителем'
    );

    this.fetchData();
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

      // Получаем данные водителя
      const payloadData = AuthStoreData.payloadVoditelConnectSuccess;
      if (!payloadData) {
        throw new Error('No voditel connect data available');
      }
      const { voditelData, voditelUserData } = payloadData;
      AuthStoreData.payloadVoditelConnectSuccess = null;

      this.setState({
        data: response as CurrentUserResponse,
        voditelData,
        voditelUserData,
      });

      console.log('KombainerWaitTicketConfirm|waitingVoditelConfirm|init');
      // Запускаем периодический опрос для получения подтверждения от водителя
      this.waitingVoditelTalonConfirmCtrl = setTimeout(
        () => this.waitingVoditelConfirm(),
        1000
      ) as unknown as number;
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    } finally {
      this.setState({ loading: false });
    }
  }

  /**
   * Метод для периодического опроса ответа needRedirect
   */
  waitingVoditelConfirm = async () => {
    if (this.waitingVoditelTalonConfirmCtrl === null) {
      console.log(
        'KombainerWaitTicketConfirm|waitingVoditelConfirm|!waitingVoditelTalonConfirmCtrl'
      );
      return;
    }

    try {
      const result = await handleMessage({
        req: { type: 'needRedirect' },
        reqId: 'needRedirect_' + Date.now(),
      });

      if (result.type !== 'needRedirect') {
        throw new Error('Failed to get needRedirect');
      }

      const response = result as NeedRedirectResponse;

      console.log('KombainerWaitTicketConfirm|waitingVoditelConfirm|response=', response);

      if (!response.payload) {
        // Если данные ещё не получены – продолжаем опрос
        this.waitingVoditelTalonConfirmCtrl = setTimeout(
          () => this.waitingVoditelConfirm(),
          1000
        ) as unknown as number;
        return;
      }

      // Останавливаем опрос
      clearTimeout(this.waitingVoditelTalonConfirmCtrl);
      this.waitingVoditelTalonConfirmCtrl = null;

      this.setState({
        isVoditelTalonConfirm: true,
        isVoditelTalonConfirmSuccess: true,
        isVoditelTalonConfirmError: false,
      });
    } catch (e) {
      console.error('KombainerWaitTicketConfirm|waitingVoditelConfirm|error=', e);
      // Продолжаем опрос даже при ошибке
      this.waitingVoditelTalonConfirmCtrl = setTimeout(
        () => this.waitingVoditelConfirm(),
        1000
      ) as unknown as number;
      return;
    }
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

  // Обработчик успешной отправки формы.
  onSubmitForm = async () => {
    if (!this.validateWeight()) return;

    const { data, weightValue } = this.state;

    // Проверка наличия необходимых данных
    if (!data || !data.kombainerData || !data.userData) {
      Alert.alert('Ошибка', 'Отсутствуют необходимые данные комбайнера для отправки');
      return;
    }

    try {
      // Отправляем запрос на подключение к TCP-серверу
      const tcpResult = await handleMessage({
        req: {
          type: 'sendTcpRequest',
          data: {
            type: 'set_talon_of_kombainer',
            kombainerData: data.kombainerData,
            userData: data.userData,
            weight: parseFloat(weightValue),
          },
        },
        reqId: 'set_talon_of_kombainer_' + Date.now(),
      });

      if (tcpResult.type !== 'sendTcpRequest') {
        throw new Error('TCP request failed');
      }

      const tcpResponse = tcpResult as SendTcpRequestResponse;
      console.log('onFinish|set_talon_of_kombainer|tcpResponse=', tcpResponse);

      // Успешно отправили данные - переходим на экран ожидания подтверждения веса водителем
      this.props.navigation.navigate('KombainerWaitTicketWithWeightConfirmScreen');
    } catch (error: any) {
      console.error('onFinish|set_talon_of_kombainer|error =', error);
      Alert.alert('Ошибка подключения к устройству', error.message || JSON.stringify(error));
    }
  };

  /**
   * Метод для периодического опроса ответа needRedirect
   */
  waitingVoditelWeightConfirm = async () => {
    if (this.waitingVoditelWeightConfirmCtrl === null) {
      console.log(
        'KombainerWaitTicketWithWeightConfirm|waitingVoditelWeightConfirm|!waitingVoditelWeightConfirmCtrl'
      );
      return;
    }

    try {
      const result = await handleMessage({
        req: { type: 'needRedirect' },
        reqId: 'needRedirect_' + Date.now(),
      });

      if (result.type !== 'needRedirect') {
        throw new Error('Failed to get needRedirect');
      }

      const response = result as NeedRedirectResponse;

      console.log(
        'KombainerWaitTicketWithWeightConfirm|waitingVoditelWeightConfirm|response=',
        response
      );

      if (!response.payload) {
        // Если данные ещё не получены – продолжаем опрос
        this.waitingVoditelWeightConfirmCtrl = setTimeout(
          () => this.waitingVoditelWeightConfirm(),
          1000
        ) as unknown as number;
        return;
      }

      // Останавливаем опрос
      clearTimeout(this.waitingVoditelWeightConfirmCtrl);
      this.waitingVoditelWeightConfirmCtrl = null;

      if (!response.path) {
        console.error(
          'KombainerWaitTicketWithWeightConfirm|waitingVoditelWeightConfirm|!response.path|response=',
          response
        );
        Alert.alert(
          'Ошибка подключения к устройству',
          `Не был получен корректный "needRedirect": ${JSON.stringify(response)}`
        );
        return;
      }

      AuthStoreData.context = response.path as PositionOptionValue;

      if (!AuthStoreData.context) {
        Alert.alert(
          'Не определен контекст',
          'Не определен контекст пользователя "AuthStoreData.context"'
        );
        return;
      }

      this.setState({
        isVoditelTalonConfirmAfterSetWeight: true,
        isVoditelTalonConfirmAfterSetWeightSuccess: true,
        isVoditelTalonConfirmAfterSetWeightError: false,
      });
    } catch (e) {
      console.error('KombainerWaitTicketWithWeightConfirm|waitingVoditelWeightConfirm|error=', e);
      // Продолжаем опрос даже при ошибке
      this.waitingVoditelWeightConfirmCtrl = setTimeout(
        () => this.waitingVoditelWeightConfirm(),
        1000
      ) as unknown as number;
    }
  };

  // Обработчик клика "Назад".
  handleBack = () => {
    this.props.navigation.goBack();
  };

  handleCancelClick = async () => {
    // Показываем уведомление о закрытии TCP-соединения
    Alert.alert(
      'Закрытие TCP-соединения',
      'TCP-соединение с устройством водителя будет закрыто. Обмен данными прекратится.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Закрыть',
          style: 'destructive',
          onPress: async () => {
            try {
              await this.cancel();
              console.log('handleCancelClick|Соединения закрыты');
            } catch (error) {
              console.error('handleCancelClick|Ошибка при закрытии соединений:', error);
            }
            this.props.navigation.navigate('MainScreen');
          },
        },
      ]
    );
  };

  cancel = async () => {
    // Очищаем таймеры перед закрытием
    if (this.waitingVoditelTalonConfirmCtrl !== null) {
      clearTimeout(this.waitingVoditelTalonConfirmCtrl);
      this.waitingVoditelTalonConfirmCtrl = null;
    }

    if (this.waitingVoditelWeightConfirmCtrl !== null) {
      clearTimeout(this.waitingVoditelWeightConfirmCtrl);
      this.waitingVoditelWeightConfirmCtrl = null;
    }

    try {
      // Отключаем точку доступа
      await handleMessage({
        req: { type: 'setHotspotDisabled' },
        reqId: 'setHotspotDisabled_' + Date.now(),
      });
      console.log('Точка доступа отключена при покидании страницы');
    } catch (error) {
      console.error('Ошибка при отключении точки доступа на выходе:', error);
    }

    try {
      // Остановка TCP-сервера при выходе
      const message = await stopTcpServer();
      console.log('cancel|stopTcpServer|message=', message);
    } catch (error) {
      console.error('cancel|stopTcpServer|error=', error);
    }
  };

  handleApproveClick = async () => {
    this.props.navigation.navigate('KombainerTicketCreatedSuccessScreen');
  };

  // Обработчик изменения значения веса
  handleWeightChange = (text: string) => {
    // Разрешаем только цифры и точку
    const regex = /^[0-9]*\.?[0-9]*$/;
    if (!regex.test(text)) return;

    // Для очистки поля
    if (text === '') {
      this.setState({ weightValue: '', weightError: null });
      this.previousWeight = '';
      return;
    }

    const previousValue = this.previousWeight;

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

    this.setState({ weightValue: formatted });
    this.previousWeight = formatted;
  };

  componentWillUnmount() {
    // Отключаем не гаснущий экран
    handleMessage({
      req: { type: 'disableKeepAwake' },
      reqId: 'disableKeepAwake_' + Date.now(),
    }).catch((e) => console.error('disableKeepAwake|error=', e));

    // Очищаем таймеры
    if (this.waitingVoditelTalonConfirmCtrl !== null) {
      clearTimeout(this.waitingVoditelTalonConfirmCtrl);
      this.waitingVoditelTalonConfirmCtrl = null;
    }
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

    const ticketData = [
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
              {ticketData.map(([label, value]) => (
                <View key={label as string} style={styles.formRow}>
                  <View style={styles.labelContainer}>
                    <Text style={styles.labelText}>{label}:</Text>
                  </View>
                  <View style={styles.valueContainer}>
                    <Text style={styles.valueText}>{value || '-'}</Text>
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
                    onChangeText={this.handleWeightChange}
                    onBlur={this.handleWeightBlur}
                    keyboardType="decimal-pad"
                    editable={!isVoditelTalonConfirmAfterSetWeight}
                  />
                  {weightError ? <Text style={styles.errorHint}>{weightError}</Text> : null}
                </View>
              </View>

              {/* Данные водителя */}
              {voditelTicketData.map(([label, value]) => (
                <View key={label as string} style={styles.formRow}>
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
            {isVoditelTalonConfirm && (
              <View style={styles.actionsContainer}>
                {isVoditelTalonConfirmSuccess ? (
                  <TouchableOpacity style={styles.submitButton} onPress={this.onSubmitForm}>
                    <Text style={styles.submitButtonText}>
                      Подтвердить введенный вес и данные водителя
                    </Text>
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

            {/* Состояние после подтверждения веса водителем */}
            {isVoditelTalonConfirmAfterSetWeight && (
              <View style={styles.actionsContainer}>
                {isVoditelTalonConfirmAfterSetWeightSuccess ? (
                  <TouchableOpacity style={styles.submitButton} onPress={this.handleApproveClick}>
                    <Text style={styles.submitButtonText}>Подписать талон</Text>
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

            {/* Кнопка отмены */}
            <TouchableOpacity style={styles.cancelButton} onPress={this.handleCancelClick}>
              <Text style={styles.cancelButtonText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
});

export default KombainerTicketDetailAfterVoditelConfirm;
