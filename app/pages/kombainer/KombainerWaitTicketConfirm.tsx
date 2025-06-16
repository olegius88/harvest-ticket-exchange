import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { VectorLogo } from '../../components/VectorLogo';
import { handleMessage } from '../../services/MessageHandler';
import { AuthStoreData } from '../../stores/AuthStore';
import {
  CurrentUserResponse,
  IPayloadConfirmKombainerTicket,
  ISendPostResponseCurrentUser,
  ISendPostResponseNeedRedirect,
  NeedRedirectResponse,
  PositionOptionValue,
  RootStackParamList,
} from '../../../global';

interface KombainerWaitTicketConfirmProps {
  navigation: NavigationProp<RootStackParamList>;
}

interface KombainerWaitTicketConfirmState {
  ticketDataSent: boolean;
}

/**
 * Экран ожидания подтверждения талона водителем
 */
class KombainerWaitTicketConfirm extends React.Component<
  KombainerWaitTicketConfirmProps,
  KombainerWaitTicketConfirmState
> {
  // Контроллер для периодического опроса данных
  waitingVoditelTalonConfirmCtrl: number | null = null;

  constructor(props: KombainerWaitTicketConfirmProps) {
    super(props);
    this.state = {
      ticketDataSent: false, // Изначально данные талона не отправлены
    };
  }

  // Метод для отключения точки доступа и TCP-сервера
  cancel = async () => {
    console.log('Покидание страницы: вызывается функция cancel');
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
      const tcpStopResult = await handleMessage({
        req: { type: 'stopTcpServer' },
        reqId: 'stopTcpServer_' + Date.now(),
      });
      console.log('cancel|stopTcpServer|result=', tcpStopResult);
    } catch (error) {
      console.error('cancel|stopTcpServer|error=', error);
    }
  };

  componentDidMount() {
    // Включаем не гаснущий экран
    handleMessage({
      req: { type: 'enableKeepAwake' },
      reqId: 'enableKeepAwake_' + Date.now(),
    })
      .then(() => console.log('Экран не будет гаснуть'))
      .catch((error) => console.error('Ошибка при включении функции не гаснущего экрана:', error));

    // Показываем уведомление об успешном подключении
    Alert.alert(
      'Подключение к устройству прошло успешно',
      'Необходимо дождаться проверки информации талона водителем'
    );

    // Запускаем получение и отправку данных комбайнера
    this.setKombainerData().catch((e: any) => {
      console.error('KombainerWaitTicketConfirm|setKombainerData|error=', e);
      Alert.alert('Ошибка передачи данных комбайнера', e.message || JSON.stringify(e));
    });
  }

  componentWillUnmount() {
    // Отключаем периодический опрос при размонтировании компонента
    if (this.waitingVoditelTalonConfirmCtrl !== null) {
      clearTimeout(this.waitingVoditelTalonConfirmCtrl);
      this.waitingVoditelTalonConfirmCtrl = null;
    }

    // Отключаем функцию не гаснущего экрана при выходе с экрана
    handleMessage({
      req: { type: 'disableKeepAwake' },
      reqId: 'disableKeepAwake_' + Date.now(),
    })
      .then(() => console.log('Функция не гаснущего экрана отключена'))
      .catch((error) => console.error('Ошибка при отключении не гаснущего экрана:', error));

    // Если переходим не на экран деталей талона, то отключаем соединения
    const isNavigatingToTicketDetails =
      AuthStoreData.context === 'kombainer' && this.waitingVoditelTalonConfirmCtrl === null;

    if (!isNavigatingToTicketDetails) {
      // Вызываем cancel только если НЕ переходим на страницу деталей талона
      console.log('Отключаем TCP-сервер и точку доступа при выходе');
      this.cancel();
    } else {
      console.log('Переход на страницу деталей талона - сохраняем TCP-сервер и точку доступа');
    }
  }

  // Метод для получения данных текущего пользователя и отправки TCP-запроса с данными комбайнера
  setKombainerData = async () => {
    try {
      // Проверяем, что контекст установлен
      if (!AuthStoreData.context) {
        AuthStoreData.context = 'kombainer'; // Устанавливаем контекст по умолчанию
      }

      // Отправляем запрос на получение данных текущего пользователя
      const result = await handleMessage({
        req: {
          type: 'currentUser',
          data: { context: AuthStoreData.context },
        },
        reqId: 'getCurrentUser_' + Date.now(),
      });

      if (result.type !== 'currentUser') {
        throw new Error('Failed to get current user');
      }

      const currentUser = result as CurrentUserResponse;
      console.log('KombainerWaitTicketConfirm|currentUser=', currentUser);

      console.log('KombainerWaitTicketConfirm|waitingVoditelConfirm|init');
      // Запускаем периодический опрос для получения подтверждения от водителя
      this.waitingVoditelTalonConfirmCtrl = setTimeout(
        () => this.waitingVoditelConfirm(),
        1000
      ) as unknown as number;
    } catch (error: any) {
      console.error('KombainerWaitTicketConfirm|currentUser|error =', error);
      Alert.alert(
        'Ошибка получения данных текущего пользователя',
        error.message || JSON.stringify(error)
      );
    }
  };

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
        throw new Error('Failed to get needRedirect response');
      }

      const response = result as NeedRedirectResponse;
      console.log('KombainerWaitTicketConfirm|waitingVoditelConfirm|response=', response);

      if (response.status === 'empty') {
        // Если данные ещё не получены – продолжаем опрос
        this.waitingVoditelTalonConfirmCtrl = setTimeout(
          () => this.waitingVoditelConfirm(),
          1000
        ) as unknown as number;
        return;
      }

      // Останавливаем опрос
      if (this.waitingVoditelTalonConfirmCtrl) {
        clearTimeout(this.waitingVoditelTalonConfirmCtrl);
        this.waitingVoditelTalonConfirmCtrl = null;
      }

      if (!response.path) {
        console.error(
          'KombainerWaitTicketConfirm|waitingVoditelConfirm|!response.path|response=',
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

      // Устанавливаем данные подтверждения
      AuthStoreData.payloadConfirmKombainerTicket =
        response.payload as IPayloadConfirmKombainerTicket;

      switch (AuthStoreData.context) {
        case 'kombainer':
          this.props.navigation.navigate('KombainerTicketDetailAfterVoditelConfirmScreen');
          return;
        default:
          Alert.alert('Ошибка', `Неизвестный контекст в switch: ${AuthStoreData.context}`);
          return;
      }
    } catch (e) {
      console.error('KombainerWaitTicketConfirm|waitingVoditelConfirm|error=', e);
      // В случае ошибки продолжаем опрос
      this.waitingVoditelTalonConfirmCtrl = setTimeout(
        () => this.waitingVoditelConfirm(),
        1000
      ) as unknown as number;
    }
  };

  // Обработчик нажатия на кнопку Отмена
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
            this.props.navigation.goBack();
          },
        },
      ]
    );
  };

  render() {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          {/* Логотип */}
          <VectorLogo />

          {/* Текст ожидания */}
          <Text style={styles.statusText}>Подтверждение данных талона водителем</Text>

          {this.state.ticketDataSent && (
            <Text style={styles.statusText}>
              Данные талона отправлены водителю, ожидаем подтверждения талона водителем
            </Text>
          )}

          {/* Индикатор загрузки */}
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#98d642" />
          </View>

          {/* Кнопка Отмена */}
          <TouchableOpacity style={styles.cancelButton} onPress={this.handleCancelClick}>
            <Text style={styles.cancelButtonText}>Отмена</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 24,
  },
  statusText: {
    color: '#5a7d2b',
    fontSize: 16,
    marginTop: 40,
    textAlign: 'center',
    fontWeight: '500',
  },
  loaderContainer: {
    marginTop: 20,
  },
  cancelButton: {
    backgroundColor: '#ff4d4f',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 30,
    width: '80%',
    maxWidth: 300,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default KombainerWaitTicketConfirm;
