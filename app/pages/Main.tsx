import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { handleMessage } from '../services/MessageHandler';
import { connectToTcpServer, sendTcpRequest } from '../wifi/TcpClient';
import { AuthStoreData } from '../stores/AuthStore';
import {
  CurrentUserResponse,
  NeedRedirectResponse,
  SendTcpRequestResponse,
  ITcpResponseConnectEstablishedOk,
  CheckUserRegistrationResponse,
  JoinHotspotPayload,
  JoinHotspotResponse,
  PositionOptionValue,
  RootStackParamList,
} from '../../global';
import { VectorLogo } from '../components/VectorLogo';

const Main = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [values] = useState<Record<PositionOptionValue, string>>({
    kombainer: 'Комбайнер',
    voditel: 'Водитель',
    bunkerist: 'Бункерист',
    admin: 'Администратор',
  });
  const [isUserRegistered, setIsUserRegistered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingRegistration, setCheckingRegistration] = useState(true);

  // Route helper функция (упрощенная версия для React Native)
  const RouteRole = (context: PositionOptionValue, page: string): string => {
    return `/${context}/${page}`;
  };

  // Проверка, зарегистрирован ли пользователь
  useEffect(() => {
    const checkUserRegistration = async () => {
      try {
        setCheckingRegistration(true);
        const response = await handleMessage({
          req: {
            type: 'checkUserRegistration',
          },
          reqId: 'checkUserRegistration_' + Date.now(),
        });

        if (response.type === 'checkUserRegistration') {
          const result = response as CheckUserRegistrationResponse;
          setIsUserRegistered(!!result.isRegistered);
        } else {
          setIsUserRegistered(false);
        }
      } catch (error: unknown) {
        console.error('Ошибка при проверке регистрации пользователя:', error);
        setIsUserRegistered(false);
      } finally {
        setCheckingRegistration(false);
      }
    };

    checkUserRegistration();
  }, []);

  useEffect(() => {}, [navigation]);

  const handleClick = async (context: PositionOptionValue) => {
    AuthStoreData.context = context;
    console.log('Context set to:', context);
    setLoading(true);

    try {
      const response = await handleMessage({
        req: {
          type: 'currentUser',
          data: { context },
        },
        reqId: 'currentUser_' + Date.now(),
      });

      if (response.type !== 'currentUser') {
        throw new Error('Current user request failed');
      }

      console.log('handleClick|currentUser|response=', response);
      console.log('handleClick|currentUser|context=', context);

      switch (response.status) {
        case 'noAuth':
          navigation.navigate('LoginScreen');
          return;
        case 'noUser':
          navigation.navigate('RegistrationScreen');
          break;
        case 'authOk': {
          switch (context) {
            case 'kombainer':
              if (response.kombainerData) {
                navigation.navigate('KombainerCreateTicketScreen');
                return;
              }
              // Если нет данных комбайнера, нужна специальная регистрация комбайнера
              navigation.navigate('KombainerRegistrationScreen');
              return;
            case 'voditel':
              if (response.voditelData) {
                // В React Native версии переходим на создание поездки
                navigation.navigate('VoditelCreateTripScreen');
                return;
              }
              // Если нет данных водителя, нужна специальная регистрация водителя
              navigation.navigate('VoditelRegistrationScreen');
              return;
            case 'bunkerist':
              // В React Native версии пока не реализован экран для бункериста
              Alert.alert('Информация', 'Экран для бункериста находится в разработке');
              return;
            case 'admin':
              // Переходим на панель администратора
              navigation.navigate('AdminPanelScreen');
              return;
          }
          return;
        }
        default:
          Alert.alert('Неизвестный response.status', JSON.stringify(response));
          return;
      }
    } catch (error: unknown) {
      console.error('handleClick|error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      Alert.alert(
        'Ошибка авторизации',
        `Произошла ошибка при проверке авторизации. Пожалуйста, попробуйте еще раз.\n\n${errorMessage}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEditUserClick = () => {
    // TODO: Implement EditProfile screen or navigate to WebView with edit profile URL
    Alert.alert('Информация', 'Экран редактирования профиля находится в разработке');
  };

  if (checkingRegistration) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5a7d2b" />
        <Text style={styles.loadingText}>Проверка регистрации...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <VectorLogo />
        </View>

        <Text style={styles.title}>Выберите Вашу должность</Text>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={() => handleClick('kombainer')}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{values.kombainer}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={() => handleClick('voditel')}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{values.voditel}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={() => handleClick('bunkerist')}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{values.bunkerist}</Text>
          </TouchableOpacity>

          {/* <TouchableOpacity
            style={[styles.adminButton, loading && styles.buttonDisabled]}
            onPress={() => handleClick('admin')}
            disabled={loading}
          >
            <Text style={styles.adminButtonText}>{values.admin}</Text>
          </TouchableOpacity> */}

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={() => navigation.navigate('RegistrationScreen')}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>Регистрация</Text>
          </TouchableOpacity>

          {isUserRegistered && (
            <TouchableOpacity
              style={[styles.editButton, loading && styles.buttonDisabled]}
              onPress={handleEditUserClick}
              disabled={loading}
            >
              <Text style={styles.editButtonText}>Редактировать пользователя</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#5a7d2b" />
          </View>
        )}
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
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 32,
    textAlign: 'center',
    color: '#333333',
  },
  buttonsContainer: {
    width: '100%',
    maxWidth: 300,
  },
  button: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 6,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: '#5a7d2b',
    borderRadius: 6,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
  editButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#5a7d2b',
    borderRadius: 6,
    padding: 16,
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 16,
    color: '#5a7d2b',
    fontWeight: '500',
  },
  adminButton: {
    backgroundColor: '#fd7e14',
    borderRadius: 6,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  adminButtonText: {
    fontSize: 16,
    color: '#ffffff',
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
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
});

export default Main;
