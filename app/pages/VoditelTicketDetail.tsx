import React, { Component } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { handleMessage } from '../services/MessageHandler';
import {
  ICreateKombainerParams,
  ICreateUserParams,
  ISendPostResponseCurrentUser,
  ISendTcpResponse,
  ITcpResponseConfirmKombainerTicket,
  ITcpResponseKombainerData,
  RootStackParamList,
} from '../../global';
import { AuthStoreData } from '../stores/AuthStore';
import { ICreateUsersParams } from '../../app/db/users';

// Компонент логотипа
const VectorLogo: React.FC<{ width?: number; height?: number }> = ({
  width = 120,
  height = 120,
}) => {
  return (
    <View
      style={{
        width,
        height,
        backgroundColor: '#5a7d2b',
        borderRadius: width / 2,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: 'bold' }}>LOGO</Text>
    </View>
  );
};

// Определение типа для навигации
interface NavigationProps {
  navigation: NavigationProp<RootStackParamList>;
}

// Интерфейс состояния компонента
interface VoditelTicketDetailState {
  loading: boolean;
  data: ISendPostResponseCurrentUser | null;
  weight: string;
}

/**
 * Страница "Талон комбайнера" для React Native
 */
const VoditelTicketDetail: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<ISendPostResponseCurrentUser | null>(null);
  const [weight, setWeight] = React.useState('');

  React.useEffect(() => {
    getKombainerData();
  }, []);

  /**
   * Метод для получения данных текущего пользователя и отправки TCP-запроса
   * для получения данных комбайнера.
   */
  getKombainerData = async () => {
    try {
      // Отправляем запрос на получение данных текущего пользователя
      const response = await handleMessage({
        req: {
          type: 'currentUser',
          data: { context: 'voditel' },
        },
        reqId: 'currentUser_' + Date.now(),
      });

      if (response.resType !== 'resolve') {
        throw new Error('Failed to fetch current user');
      }

      const currentUser = response.res as ISendPostResponseCurrentUser;
      console.log('VoditelTicketDetail|currentUser=', currentUser);

      // В зависимости от контекста (для водителя) отправляем запрос за данными комбайнера
      if (AuthStoreData.context === 'voditel') {
        try {
          const tcpResponse = await handleMessage({
            req: {
              type: 'sendTcpRequest',
              data: {
                type: 'get_kombainer_data',
              },
            },
            reqId: 'sendTcpRequest_get_kombainer_data_' + Date.now(),
          });

          if (tcpResponse.resType !== 'resolve') {
            throw new Error('Failed to get kombainer data');
          }

          console.log('VoditelTicketDetail|tcpResponse=', tcpResponse.res);
          const tcpData = tcpResponse.res as ISendTcpResponse;
          const kombainerData = (tcpData.data as ITcpResponseKombainerData).kombainerData;
          const kombainerUserData = (tcpData.data as ITcpResponseKombainerData).kombainerUserData;

          // Обновляем данные текущего пользователя, подставляя полученные данные комбайнера
          const updatedUser: ISendPostResponseCurrentUser = {
            ...currentUser,
            kombainerData,
            kombainerUserData,
          };

          // Обновляем состояние компонента
          this.setState({ loading: false, data: updatedUser });
          console.log('VoditelTicketDetail|updatedUser=', updatedUser);

        } catch (error: any) {
          console.error('VoditelTicketDetail|error=', error);
          Alert.alert(
            'Ошибка',
            'Ошибка получения данных комбайнера: ' + (error.message || JSON.stringify(error))
          );
          this.setState({ loading: false });
        }
      } else {
        console.error('VoditelTicketDetail|неизвестный context=', AuthStoreData.context);
        Alert.alert('Ошибка', `Неизвестный контекст: ${AuthStoreData.context}`);
        this.setState({ loading: false });
      }
    } catch (error: any) {
      console.error('VoditelTicketDetail|currentUser|error=', error);
      Alert.alert(
        'Ошибка',
        'Ошибка получения данных пользователя: ' + (error.message || JSON.stringify(error))
      );
      this.setState({ loading: false });
    }
  };

  // Подтверждение талона комбайнера
  confirmKombainerTicket = async () => {
    try {
      if (!this.state.data || !this.state.data.voditelData || !this.state.data.userData) {
        Alert.alert('Ошибка', 'Отсутствуют необходимые данные для подтверждения');
        return;
      }

      const tcpResponse = await handleMessage({
        req: {
          type: 'sendTcpRequest',
          data: {
            type: 'confirm_kombainer_ticket',
            voditelData: this.state.data.voditelData,
            userData: this.state.data.userData,
          },
        },
        reqId: 'sendTcpRequest_confirm_kombainer_ticket_' + Date.now(),
      });

      if (tcpResponse.resType !== 'resolve') {
        throw new Error('Failed to confirm kombainer ticket');
      }

      const tcpData = tcpResponse.res as ISendTcpResponse;
      const sendRes = tcpData.data as ITcpResponseConfirmKombainerTicket;

      if (sendRes.status !== 'ok') {
        Alert.alert('Ошибка', 'Ошибка подтверждения талона: ' + JSON.stringify(sendRes));
        return;
      }

      // Переходим на страницу ожидания данных от комбайнера
      this.props.navigation.navigate('VoditelWaitKombainerDataScreen');

    } catch (error: any) {
      console.error('VoditelTicketDetail|confirmKombainerTicket|error=', error);
      Alert.alert(
        'Ошибка',
        'Ошибка отправки данных талона: ' + (error.message || JSON.stringify(error))
      );
    }
  };

  // Обработчик возврата назад
  handleBack = () => {
    this.props.navigation.goBack();
  };

  render() {
    const { loading, data } = this.state;

    if (loading) {
      return (
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#5a7d2b" />
          <Text style={styles.loadingText}>Загрузка данных...</Text>
        </View>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.logoContainer}>
          <VectorLogo />
        </View>

        <Text style={styles.title}>Талон комбайнера N</Text>

        <View style={styles.formContainer}>
          {/* Данные комбайнера и комбайна */}
          {[
            ['Комбайн', data?.kombainerData?.combine],
            ['Комбайнер', data?.kombainerUserData?.fio],
            ['Культура', data?.kombainerData?.culture],
            ['Поле', data?.kombainerData?.field],
            ['Бригада', data?.kombainerData?.brigade],
          ].map(([label, value]) => (
            <View key={label} style={styles.formRow}>
              <Text style={styles.formLabel}>{label}:</Text>
              <Text style={styles.formValue}>{value || '-'}</Text>
            </View>
          ))}

          {/* Данные о весе */}
          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Вес:</Text>
            <Text style={styles.formValue}>Будет указан комбайнером</Text>
          </View>

          {/* Данные водителя */}
          {[
            ['Транспорт', data?.voditelData?.transport],
            ['Водитель', data?.userData?.fio],
          ].map(([label, value]) => (
            <View key={label} style={styles.formRow}>
              <Text style={styles.formLabel}>{label}:</Text>
              <Text style={styles.formValue}>{value || '-'}</Text>
            </View>
          ))}

          {/* Кнопка подтверждения */}
          <TouchableOpacity
            style={styles.submitButton}
            onPress={this.confirmKombainerTicket}
          >
            <Text style={styles.submitButtonText}>
              Подтвердить данные талона
            </Text>
          </TouchableOpacity>

          {/* Кнопка "Назад" */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={this.handleBack}
          >
            <Text style={styles.backButtonText}>
              Назад
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666666',
  },
  logoContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 20,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  formLabel: {
    flex: 1,
    fontWeight: 'bold',
    color: '#5a7d2b',
    fontSize: 16,
  },
  formValue: {
    flex: 2,
    fontSize: 16,
    color: '#333333',
  },
  submitButton: {
    backgroundColor: '#5a7d2b',
    borderRadius: 6,
    padding: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#5a7d2b',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});

export default VoditelTicketDetail;
