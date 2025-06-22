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
} from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { handleMessage } from '../../services/MessageHandler';
import { sendTcpRequest } from '../../wifi/TcpClient';
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

interface VoditelTicketDetailAfterSetWeightProps {
  navigation: NavigationProp<RootStackParamList>;
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

  weight: number | null;
  kombainerUserData: ICreateUsersParams | null;
  userData: ICreateUsersParams | null;
  voditelData: ICreateVoditelParams | null;
  kombainerData: ICreateKombainerParams | null;
}

class VoditelTicketDetailAfterSetWeight extends Component<
  VoditelTicketDetailAfterSetWeightProps,
  VoditelTicketDetailAfterSetWeightState
> {
  // Слушатель для получения данных комбайнера
  setTalonOfKombainerListener: any = null;
  // Слушатель для события подписания талона комбайнером
  kombainerSignTicketListener: any = null;

  constructor(props: VoditelTicketDetailAfterSetWeightProps) {
    super(props);
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

      weight: null,
      kombainerUserData: null,
      userData: null,
      voditelData: null,
      kombainerData: null,
    };
  }

  componentDidMount() {
    this.getKombainerData().catch((e: unknown) => {
      console.error('VoditelTicketDetailAfterSetWeight|getKombainerData|error=', e);
      Alert.alert('Ошибка передачи данных комбайнера', e instanceof Error ? e.message : String(e));
    });

    // Добавляем слушатель события подписания талона комбайнером
    this.kombainerSignTicketListener = DeviceEventEmitter.addListener(
      'kombainerSignTicket',
      this.handleKombainerSignTicket
    );

    // Включаем не гаснущий экран
    KeepAwake.activate();
  }

  componentWillUnmount() {
    this.setTalonOfKombainerListener?.remove();
    this.kombainerSignTicketListener?.remove();

    // Отключаем не гаснущий экран
    KeepAwake.deactivate();
  }

  handleKombainerSignTicket = () => {
    console.log('VoditelTicketDetailAfterSetWeight|handleKombainerSignTicket');

    // Если мы ожидаем подписания, сразу переходим на следующий экран
    if (this.state.waitingForKombainerSign) {
      this.props.navigation.navigate('VoditelTicketCreatedSuccessScreen');
    } else {
      // Если событие пришло до нажатия на "Принять", запоминаем это
      this.setState({ kombainerSignReceived: true });
    }
  };

  handleSetTalonOfKombainer = (data: IPayloadSetTalonOfKombainer): any => {
    console.log('VoditelTicketDetailAfterSetWeight|handleSetTalonOfKombainer|data=', data);
    const { kombainerData, userData, weight } = data;

    // Обновляем состояние компонента: данные с весом загружены
    this.setState({
      loadingKombainerDataWithWeight: false,
      loadingKombainerDataWithWeightSuccess: true,
      weight,
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

    // В зависимости от контекста отправляем TCP-запрос за данными комбайнера
    switch (AuthStoreData.context) {
      case 'voditel': {
        try {
          const data = await sendTcpRequest({
            type: 'get_kombainer_data',
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
    });

    console.log('VoditelTicketDetailAfterSetWeight|data loaded successfully');
  };

  /**
   * Подтверждение талона с весом
   */
  confirmKombainerTicketWithWeight = async () => {
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
      Alert.alert('Ошибка отправки данных талона', error.message || JSON.stringify(error));
      return;
    }

    if (sendRes.status !== 'ok') {
      Alert.alert('Ошибка подтверждения талона', JSON.stringify(sendRes));
      return;
    }

    // После успешного подтверждения показываем кнопку "Подписать талон"
    this.setState({
      canSignTicket: true,
    });
  };

  /**
   * Обработчик клика на кнопку подтверждения талона с весом
   */
  handleSignTicketClick = async () => {
    // Если событие kombainerSignTicket уже получено, сразу переходим
    if (this.state.kombainerSignReceived) {
      try {
        // Отправляем TCP-запрос для подписания талона водителем
        const data = await sendTcpRequest({
          type: 'voditel_sign_ticket',
        });
        console.log('VoditelTicketDetailAfterSetWeight|voditel_sign_ticket|data=', data);

        this.props.navigation.navigate('VoditelTicketCreatedSuccessScreen');
      } catch (error: any) {
        console.error('VoditelTicketDetailAfterSetWeight|voditel_sign_ticket|error =', error);
        Alert.alert('Ошибка подписания талона', error.message || JSON.stringify(error));
      }
      return;
    }

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
            try {
              // Отправляем TCP-запрос для подписания талона водителем
              const data = await sendTcpRequest({
                type: 'voditel_sign_ticket',
              });
              console.log('VoditelTicketDetailAfterSetWeight|voditel_sign_ticket|data=', data);

              // Устанавливаем состояние ожидания подписания
              this.setState({ waitingForKombainerSign: true });

              // Если событие уже получено, сразу переходим
              if (this.state.kombainerSignReceived) {
                this.props.navigation.navigate('VoditelTicketCreatedSuccessScreen');
              }
            } catch (error: any) {
              console.error('VoditelTicketDetailAfterSetWeight|voditel_sign_ticket|error =', error);
              Alert.alert('Ошибка подписания талона', error.message || JSON.stringify(error));
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
      Alert.alert('Ошибка отправки данных талона', error.message || JSON.stringify(error));
      return;
    }

    if (sendRes.status !== 'ok') {
      Alert.alert('Ошибка подтверждения талона', JSON.stringify(sendRes));
      return;
    }

    this.setState({
      isKombainerData: false,
      loadingKombainerDataSuccess: false,
      loadingKombainerDataError: false,
      loadingKombainerData: false,
      isKombainerDataWithWeight: true,
    });

    console.log('VoditelTicketDetailAfterSetWeight|waitingKombainerDataWithWeightConfirm|init');

    // Добавляем слушатель события подтверждения от водителя
    this.setTalonOfKombainerListener = DeviceEventEmitter.addListener(
      'setTalonOfKombainer',
      this.handleSetTalonOfKombainer
    );
  };

  /**
   * Обработчик отмены операции
   */
  handleCancelClick = () => {
    Alert.alert(
      'Закрытие соединения',
      'Вы уверены, что хотите отменить процесс и вернуться назад?',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Да', onPress: () => this.props.navigation.goBack() },
      ]
    );
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
      weight,
      kombainerData,
      kombainerUserData,
      userData,
      voditelData,
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

        <Text style={styles.title}>Талон комбайнера N</Text>

        <View style={styles.formContainer}>
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
              <TouchableOpacity style={styles.submitButton} onPress={this.confirmKombainerTicket}>
                <Text style={styles.submitButtonText}>Подтвердить данные талона</Text>
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
                style={styles.submitButton}
                onPress={this.confirmKombainerTicketWithWeight}
              >
                <Text style={styles.submitButtonText}>Утвердить талон</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#98d642" />
              </View>
            )}
          </>
        )}

        {isKombainerDataWithWeight && canSignTicket && (
          <TouchableOpacity style={styles.submitButton} onPress={this.handleSignTicketClick}>
            <Text style={styles.submitButtonText}>Подписать талон</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.cancelButton} onPress={this.handleCancelClick}>
          <Text style={styles.cancelButtonText}>Отмена</Text>
        </TouchableOpacity>
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
});

export default VoditelTicketDetailAfterSetWeight;
