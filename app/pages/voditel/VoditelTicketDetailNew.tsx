import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { handleMessage } from '../../services/MessageHandler';
import { sendTcpRequest } from '../../wifi/TcpClient';
import {
  CurrentUserResponse,
  ICreateKombainerParams,
  ICreateUserParams,
  ISendPostResponseCurrentUser,
  ISendTcpResponse,
  ITcpResponseConfirmKombainerTicket,
  ITcpResponseKombainerData,
  RootStackParamList,
  SendTcpRequestResponse,
} from '../../../global';
import { AuthStoreData } from '../../stores/AuthStore';
import { ICreateUsersParams } from '../../db/users';

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

/**
 * Страница "Талон комбайнера" для React Native
 */
const VoditelTicketDetail: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CurrentUserResponse | null>(null);

  /**
   * Метод для получения данных текущего пользователя и отправки TCP-запроса
   * для получения данных комбайнера.
   */
  const getKombainerData = async () => {
    try {
      // Отправляем запрос на получение данных текущего пользователя
      const response = await handleMessage({
        req: {
          type: 'currentUser',
          data: { context: 'voditel' },
        },
        reqId: 'currentUser_' + Date.now(),
      });

      if (response.type !== 'currentUser') {
        throw new Error('Failed to fetch current user');
      }

      const currentUser = response as CurrentUserResponse;
      console.log('VoditelTicketDetail|currentUser=', currentUser);

      // В зависимости от контекста (для водителя) отправляем запрос за данными комбайнера
      if (AuthStoreData.context === 'voditel') {
        try {
          const data = await sendTcpRequest({
            type: 'get_kombainer_data',
          });
          console.log('VoditelTicketDetail|sendTcpRequest|data=', data);

          const kombainerData = (data as ITcpResponseKombainerData).kombainerData;
          const kombainerUserData = (data as ITcpResponseKombainerData).kombainerUserData;

          // Обновляем данные текущего пользователя, подставляя полученные данные комбайнера
          const updatedUser: CurrentUserResponse = {
            ...currentUser,
            kombainerData,
            kombainerUserData,
          };

          // Обновляем состояние компонента
          setData(updatedUser);
          setLoading(false);
          console.log('VoditelTicketDetail|updatedUser=', updatedUser);
        } catch (error: unknown) {
          console.error('VoditelTicketDetail|error=', error);
          Alert.alert(
            'Ошибка',
            'Ошибка получения данных комбайнера: ' +
              (error instanceof Error ? error.message : String(error))
          );
          setLoading(false);
        }
      } else {
        console.error('VoditelTicketDetail|неизвестный context=', AuthStoreData.context);
        Alert.alert('Ошибка', `Неизвестный контекст: ${AuthStoreData.context}`);
        setLoading(false);
      }
    } catch (error: any) {
      console.error('VoditelTicketDetail|currentUser|error=', error);
      Alert.alert(
        'Ошибка',
        'Ошибка получения данных пользователя: ' + (error.message || JSON.stringify(error))
      );
      setLoading(false);
    }
  };

  // Подтверждение талона комбайнера
  const confirmKombainerTicket = async () => {
    try {
      if (!data || !data.voditelData || !data.userData) {
        Alert.alert('Ошибка', 'Отсутствуют необходимые данные для подтверждения');
        return;
      }

      const tcpData = await sendTcpRequest({
        type: 'confirm_kombainer_ticket',
        voditelData: data.voditelData,
        userData: data.userData,
      });

      const sendRes = tcpData as ITcpResponseConfirmKombainerTicket;

      if (sendRes.status !== 'ok') {
        Alert.alert('Ошибка', 'Ошибка подтверждения талона: ' + JSON.stringify(sendRes));
        return;
      }

      // Переходим на страницу ожидания данных от комбайнера
      navigation.navigate('VoditelWaitKombainerDataScreen');
    } catch (error: any) {
      console.error('VoditelTicketDetail|confirmKombainerTicket|error=', error);
      Alert.alert(
        'Ошибка',
        'Ошибка отправки данных талона: ' + (error.message || JSON.stringify(error))
      );
    }
  };

  // Обработчик возврата назад
  const handleBack = () => {
    navigation.goBack();
  };

  useEffect(() => {
    getKombainerData();
  }, []);

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
        <TouchableOpacity style={styles.submitButton} onPress={confirmKombainerTicket}>
          <Text style={styles.submitButtonText}>Подтвердить данные талона</Text>
        </TouchableOpacity>

        {/* Кнопка "Назад" */}
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>Назад</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

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
