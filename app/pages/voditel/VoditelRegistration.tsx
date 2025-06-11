import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { AuthStoreData } from '../../stores/AuthStore';
import { handleMessage } from '../../services/MessageHandler';
import { IEditVoditelParams, RootStackParamList } from '../../../global';

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

interface IVoditelForm {
  transport: string;
}

const VoditelRegistration: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [voditelId, setVoditelId] = useState<string | null>(null);
  const [fio, setFio] = useState<string>('');
  const [transport, setTransport] = useState<string>('');
  const [transportError, setTransportError] = useState<string | null>(null);

  // Получаем данные текущего пользователя и проверяем наличие данных водителя
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
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

        const currentUser = response.res;

        // Устанавливаем ФИО из userData
        if (currentUser.userData) {
          setFio(currentUser.userData.fio || '');
        }

        if (currentUser.voditelData) {
          setEditing(true);
          setVoditelId(currentUser.voditelData.id);
          // Предзаполнение формы данными для редактирования
          setTransport(currentUser.voditelData.transport || '');
        }
      } catch (error) {
        console.error('Ошибка получения данных текущего пользователя:', error);
        Alert.alert(
          'Ошибка',
          'Не удалось загрузить данные пользователя. Пожалуйста, попробуйте еще раз.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentUser();
  }, []);

  const validateForm = (): boolean => {
    let isValid = true;

    if (!transport.trim()) {
      setTransportError('Введите данные транспорта');
      isValid = false;
    } else {
      setTransportError(null);
    }

    return isValid;
  };

  // Обработка отправки формы
  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      const response = await handleMessage({
        req: {
          type: 'currentUser',
          data: { context: 'voditel' },
        },
        reqId: 'currentUser_for_submit_' + Date.now(),
      });

      if (response.resType !== 'resolve') {
        throw new Error('Failed to fetch current user');
      }

      const currentUser = response.res;
      const userData = currentUser.userData;
      const voditelData = currentUser.voditelData;

      if (editing && voditelId) {
        // Отправляем запрос на обновление данных водителя
        const requestData: IEditVoditelParams = {
          voditelId,
          userId: userData.id,
          transport,
          created_at: voditelData.created_at, // используем существующее значение created_at
          updated_at: Date.now(),
        };

        const editResponse = await handleMessage({
          req: {
            type: 'editVoditel',
            data: requestData,
          },
          reqId: 'editVoditel_' + Date.now(),
        });

        if (editResponse.resType !== 'resolve') {
          throw new Error('Не удалось обновить данные водителя');
        }

        console.log('Response from editVoditel:', editResponse.res);
      } else {
        // Отправляем запрос на создание водителя
        const createResponse = await handleMessage({
          req: {
            type: 'createVoditel',
            data: { transport, userId: userData.id },
          },
          reqId: 'createVoditel_' + Date.now(),
        });

        if (createResponse.resType !== 'resolve') {
          throw new Error('Не удалось создать водителя');
        }

        console.log('Response from createVoditel:', createResponse.res);
      }

      Alert.alert(
        editing ? 'Данные водителя обновлены' : 'Успешная регистрация водителя',
        editing ? 'Данные водителя успешно обновлены.' : 'Данные водителя успешно сохранены.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (!editing) {
                navigation.navigate('VoditelCreateTripScreen');
              } else {
                navigation.navigate('MainScreen');
              }
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Ошибка отправки данных:', error);
      Alert.alert(
        editing ? 'Ошибка обновления данных' : 'Ошибка регистрации',
        `Произошла ошибка при ${
          editing ? 'обновлении данных водителя' : 'регистрации водителя'
        }. Пожалуйста, попробуйте еще раз.\n\n${error.message || ''}`
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5a7d2b" />
        <Text style={styles.loadingText}>Загрузка...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.logoContainer}>
        <VectorLogo />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>
          {editing ? 'Редактирование данных водителя' : 'Регистрация водителя'}
        </Text>

        {/* Отображаем ФИО из currentUser */}
        <Text style={styles.fioText}>ФИО: {fio}</Text>

        <View style={styles.formContainer}>
          <Text style={styles.label}>Транспорт (марка, гос номер)</Text>
          <TextInput
            style={[styles.input, transportError ? styles.inputError : null]}
            placeholder="Например, Mercedes A-Class, А123BC"
            value={transport}
            onChangeText={setTransport}
          />
          {transportError && <Text style={styles.errorText}>{transportError}</Text>}

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>{editing ? 'Обновить данные' : 'Сохранить'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>Назад</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginVertical: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#333333',
    textAlign: 'center',
  },
  fioText: {
    fontSize: 16,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  formContainer: {
    width: '100%',
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#333333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  inputError: {
    borderColor: '#ff4d4f',
  },
  errorText: {
    color: '#ff4d4f',
    fontSize: 14,
    marginTop: -12,
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#5a7d2b',
    borderRadius: 6,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  backLink: {
    marginTop: 24,
  },
  backLinkText: {
    color: '#5a7d2b',
    fontSize: 16,
    textDecorationLine: 'underline',
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
  },
});

export default VoditelRegistration;
