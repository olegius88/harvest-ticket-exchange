import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { NavigationProp, useNavigation } from '@react-navigation/native';
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
} from '../../../global';

interface VoditelTicketDetailAfterSetWeightState {
  isKombainerData: boolean;
  loadingKombainerData: boolean;
  loadingKombainerDataSuccess: boolean;
  loadingKombainerDataError: boolean;

  isKombainerDataWithWeight: boolean;
  loadingKombainerDataWithWeight: boolean;
  loadingKombainerDataWithWeightSuccess: boolean;
  loadingKombainerDataWithWeightError: boolean;

  weight: number | null;
  kombainerUserData: ICreateUsersParams | null;
  userData: ICreateUsersParams | null;
  voditelData: ICreateVoditelParams | null;
  kombainerData: ICreateKombainerParams | null;
}

const VoditelTicketDetailAfterSetWeight: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  // Контроллер для периодического опроса данных
  const waitingKombainerDataWithWeightConfirmCtrl = useRef<NodeJS.Timeout | null>(null);

  const [state, setState] = useState<VoditelTicketDetailAfterSetWeightState>({
    isKombainerData: true,
    loadingKombainerData: false,
    loadingKombainerDataSuccess: false,
    loadingKombainerDataError: false,

    isKombainerDataWithWeight: false,
    loadingKombainerDataWithWeight: false,
    loadingKombainerDataWithWeightSuccess: false,
    loadingKombainerDataWithWeightError: false,

    weight: null,
    kombainerUserData: null,
    userData: null,
    voditelData: null,
    kombainerData: null,
  });

  useEffect(() => {
    getKombainerData().catch((e: any) => {
      console.error('VoditelTicketDetailAfterSetWeight|getKombainerData|error=', e);
      Alert.alert('Ошибка передачи данных комбайнера', e.message || JSON.stringify(e));
    });

    // Cleanup function для очистки таймера при размонтировании компонента
    return () => {
      if (waitingKombainerDataWithWeightConfirmCtrl.current) {
        clearTimeout(waitingKombainerDataWithWeightConfirmCtrl.current);
        waitingKombainerDataWithWeightConfirmCtrl.current = null;
      }
    };
  }, []);

  /**
   * Метод для получения данных текущего пользователя и отправки TCP-запроса для получения данных комбайнера.
   */
  const getKombainerData = async () => {
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
    setState((prevState) => ({
      ...prevState,
      isKombainerData: true,
      loadingKombainerDataSuccess: true,
      loadingKombainerDataError: false,
      loadingKombainerData: false,
      userData: currentUser.userData,
      voditelData: currentUser.voditelData,
      kombainerData,
      kombainerUserData,
    }));

    console.log('VoditelTicketDetailAfterSetWeight|data loaded successfully');
  };

  /**
   * Метод для периодического опроса ответа needRedirect
   */
  const waitingKombainerDataWithWeightConfirm = async () => {
    if (waitingKombainerDataWithWeightConfirmCtrl.current === null) {
      console.log(
        'VoditelTicketDetailAfterSetWeight|waitingKombainerDataWithWeightConfirm|controller stopped'
      );
      return;
    }

    let response: any;
    try {
      const result = await handleMessage({
        req: {
          type: 'needRedirect',
        },
        reqId: Date.now().toString(),
      });
      response = result;
    } catch (e) {
      console.error(
        'VoditelTicketDetailAfterSetWeight|waitingKombainerDataWithWeightConfirm|error=',
        e
      );
      return;
    }

    console.log(
      'VoditelTicketDetailAfterSetWeight|waitingKombainerDataWithWeightConfirm|response=',
      response
    );

    if (response.status === 'empty') {
      // Если данные ещё не получены – продолжаем опрос
      waitingKombainerDataWithWeightConfirmCtrl.current = setTimeout(
        () => waitingKombainerDataWithWeightConfirm(),
        1000
      );
      return;
    }

    // Останавливаем опрос
    if (waitingKombainerDataWithWeightConfirmCtrl.current) {
      clearTimeout(waitingKombainerDataWithWeightConfirmCtrl.current);
      waitingKombainerDataWithWeightConfirmCtrl.current = null;
    }

    if (!response.path) {
      console.error(
        'VoditelTicketDetailAfterSetWeight|waitingKombainerDataWithWeightConfirm|!response.path|response=',
        response
      );
      Alert.alert(
        'Ошибка подключения к устройству',
        `Не был получен корректный "needRedirect": ${JSON.stringify(response)}`
      );
      return;
    }

    AuthStoreData.context = response.path;

    if (!AuthStoreData.context) {
      Alert.alert('Ошибка', 'Не определен контекст пользователя "AuthStoreData.context"');
      return;
    }

    switch (AuthStoreData.context) {
      case 'voditel':
        console.log(
          'VoditelTicketDetailAfterSetWeight|waitingKombainerDataWithWeightConfirm|response.payload=',
          response.payload
        );
        (AuthStoreData as any).payloadSetTalonOfKombainer = response.payload;

        waitingKombainerDataWithWeight().catch((e: any) => {
          console.error(
            'VoditelTicketDetailAfterSetWeight|waitingKombainerDataWithWeight|error=',
            e
          );
          Alert.alert('Ошибка передачи данных комбайнера', e.message || JSON.stringify(e));
        });
        return;
      default:
        Alert.alert('Ошибка', `Неизвестный контекст в switch: ${AuthStoreData.context}`);
        return;
    }
  };

  /**
   * Метод для получения данных комбайнера с весом
   */
  const waitingKombainerDataWithWeight = async () => {
    let currentUser: any;
    try {
      const response = await handleMessage({
        req: {
          type: 'currentUser',
          data: { context: AuthStoreData.context || 'voditel' },
        },
        reqId: Date.now().toString(),
      });
      currentUser = response;
    } catch (error: any) {
      console.error(
        'VoditelTicketDetailAfterSetWeight|waitingKombainerDataWithWeight|currentUser|error =',
        error
      );
      Alert.alert(
        'Ошибка получения данных текущего пользователя',
        error.message || JSON.stringify(error)
      );
      return;
    }

    console.log(
      'VoditelTicketDetailAfterSetWeight|waitingKombainerDataWithWeight|currentUser=',
      currentUser
    );

    console.log(
      'VoditelTicketDetailAfterSetWeight|payloadSetTalonOfKombainer=',
      (AuthStoreData as any).payloadSetTalonOfKombainer
    );

    if (!(AuthStoreData as any).payloadSetTalonOfKombainer?.weight) {
      console.error('VoditelTicketDetailAfterSetWeight|!weight');
      Alert.alert('Ошибка получения веса', 'Данные о весе не были получены');
      return;
    }

    const { weight } = (AuthStoreData as any).payloadSetTalonOfKombainer;

    // Обновляем состояние компонента: данные с весом загружены
    setState((prevState) => ({
      ...prevState,
      loadingKombainerDataWithWeight: false,
      loadingKombainerDataWithWeightSuccess: true,
      weight,
    }));
  };

  /**
   * Подтверждение талона с весом
   */
  const confirmKombainerTicketWithWeight = async () => {
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

    navigation.navigate('VoditelTicketCreatedSuccessScreen');
  };

  /**
   * Подтверждение талона без веса
   */
  const confirmKombainerTicket = async () => {
    if (!state.voditelData || !state.userData) {
      Alert.alert('Ошибка', 'Данные водителя или пользователя не найдены');
      return;
    }

    let sendRes: any;
    try {
      const data = await sendTcpRequest({
        type: 'confirm_kombainer_ticket',
        voditelData: state.voditelData,
        userData: state.userData,
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

    setState((prevState) => ({
      ...prevState,
      isKombainerData: false,
      loadingKombainerDataSuccess: false,
      loadingKombainerDataError: false,
      loadingKombainerData: false,
      isKombainerDataWithWeight: true,
    }));

    console.log('VoditelTicketDetailAfterSetWeight|waitingKombainerDataWithWeightConfirm|init');
    waitingKombainerDataWithWeightConfirmCtrl.current = setTimeout(
      () => waitingKombainerDataWithWeightConfirm(),
      1000
    );
  };

  /**
   * Обработчик отмены операции
   */
  const handleCancelClick = () => {
    Alert.alert(
      'Закрытие соединения',
      'Вы уверены, что хотите отменить процесс и вернуться назад?',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Да', onPress: () => navigation.goBack() },
      ]
    );
  };

  const {
    isKombainerData,
    loadingKombainerData,
    loadingKombainerDataSuccess,
    isKombainerDataWithWeight,
    loadingKombainerDataWithWeightSuccess,
    weight,
    kombainerData,
    kombainerUserData,
    userData,
    voditelData,
  } = state;

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
          <View key={label} style={styles.formRow}>
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
          <View key={label} style={styles.formRow}>
            <Text style={styles.label}>{label}:</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}
      </View>

      {isKombainerData && (
        <>
          {loadingKombainerDataSuccess ? (
            <TouchableOpacity style={styles.submitButton} onPress={confirmKombainerTicket}>
              <Text style={styles.submitButtonText}>Подтвердить данные талона</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#98d642" />
            </View>
          )}
        </>
      )}

      {isKombainerDataWithWeight && (
        <>
          {loadingKombainerDataWithWeightSuccess ? (
            <TouchableOpacity
              style={styles.submitButton}
              onPress={confirmKombainerTicketWithWeight}
            >
              <Text style={styles.submitButtonText}>
                Подтвердить данные талона и веса и подписать талон
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#98d642" />
            </View>
          )}
        </>
      )}

      <TouchableOpacity style={styles.cancelButton} onPress={handleCancelClick}>
        <Text style={styles.cancelButtonText}>Отмена</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

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
});

export default VoditelTicketDetailAfterSetWeight;
