import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { VectorLogo } from '../../components/VectorLogo';
import { handleMessage } from '../../services/MessageHandler';
import { stopTcpServer } from '../../wifi/TcpServer';
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
import KeepAwake from 'react-native-keep-awake';

interface KombainerWaitTicketWithWeightConfirmProps {
  navigation: NavigationProp<RootStackParamList>;
}

interface KombainerWaitTicketWithWeightConfirmState {
  ticketDataSent: boolean;
}

/**
 * Экран ожидания подтверждения талона с весом водителем
 */
class KombainerWaitTicketWithWeightConfirm extends React.Component<
  KombainerWaitTicketWithWeightConfirmProps,
  KombainerWaitTicketWithWeightConfirmState
> {
  // Контроллер для периодического опроса данных
  waitingVoditelWeightConfirmCtrl: number | null = null;

  constructor(props: KombainerWaitTicketWithWeightConfirmProps) {
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
      const message = await stopTcpServer();
      console.log('cancel|stopTcpServer|message=', message);
    } catch (error) {
      console.error('cancel|stopTcpServer|error=', error);
    }
  };

  componentDidMount() {
    // Включаем не гаснущий экран
    KeepAwake.activate();

    this.getKombainerData().catch((e: unknown) => {
      console.error('KombainerWaitTicketWithWeightConfirm|setKombainerData|error=', e);
      Alert.alert('Ошибка передачи данных комбайнера', e instanceof Error ? e.message : String(e));
    });
  }

  componentWillUnmount() {
    // Отключаем периодический опрос при размонтировании компонента
    if (this.waitingVoditelWeightConfirmCtrl !== null) {
      clearTimeout(this.waitingVoditelWeightConfirmCtrl);
      this.waitingVoditelWeightConfirmCtrl = null;
    }

    // Отключаем функцию не гаснущего экрана при выходе с экрана
    KeepAwake.deactivate();

    // Если переходим не на экран успешного создания талона, то отключаем соединения
    const isNavigatingToSuccessPage =
      AuthStoreData.context === 'kombainer' && this.waitingVoditelWeightConfirmCtrl === null;

    if (!isNavigatingToSuccessPage) {
      // Вызываем cancel только если НЕ переходим на страницу успешного создания талона
      console.log('Отключаем TCP-сервер и точку доступа при выходе');
      this.cancel();
    } else {
      console.log(
        'Переход на страницу успешного создания талона - сохраняем TCP-сервер и точку доступа'
      );
    }
  }

  // Метод для получения данных текущего пользователя и отправки TCP-запроса с данными комбайнера
  getKombainerData = async () => {
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
      console.log('getKombainerData|currentUser=', currentUser);

      console.log('getKombainerData|waitingVoditelWeightConfirm|init');

      // this.props.navigation.navigate('KombainerTicketCreatedSuccessScreen');
    } catch (error: any) {
      console.error('getKombainerData|currentUser|error =', error);
      Alert.alert(
        'Ошибка получения данных текущего пользователя',
        error.message || JSON.stringify(error)
      );
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
            this.props.navigation.navigate('MainScreen');
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
          <Text style={styles.statusText}>Ожидаем подтверждения талона водителем</Text>

          {this.state.ticketDataSent && (
            <Text style={styles.statusText}>
              Данные талона, а так же указанный вес были отправлены водителю
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

export default KombainerWaitTicketWithWeightConfirm;
