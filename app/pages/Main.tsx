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
import { AuthStoreData } from '../stores/AuthStore';
import {
  ISendPostResponseCurrentUser,
  ISendPostResponseNeedRedirect,
  ISendTcpResponse,
  ITcpResponseConnectEstablishedOk,
  JoinHotspotResponse,
  PositionOptionValue,
} from '../../global';

type RootStackParamList = {
  LoginScreen: undefined;
  RegistrationScreen: undefined;
  WebViewScreen: undefined;
  CodeScannerPage: undefined;
  MainScreen: undefined;
  EditProfileScreen: undefined;
  KombainerRegistrationScreen: undefined;
  KombainerCreateTicketScreen: undefined;
  KombainerQRCodeScreen: undefined;
};

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

const Main = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [values] = useState<Record<PositionOptionValue, string>>({
    kombainer: 'Комбайнер',
    voditel: 'Водитель',
    bunkerist: 'Бункерист',
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

        if (response.resType === 'resolve') {
          const result = response.res as { isRegistered: boolean; userData?: any };
          setIsUserRegistered(!!result.isRegistered);
        } else {
          setIsUserRegistered(false);
        }
      } catch (error) {
        console.error('Ошибка при проверке регистрации пользователя:', error);
        setIsUserRegistered(false);
      } finally {
        setCheckingRegistration(false);
      }
    };

    checkUserRegistration();
  }, []);

  // useEffect с запросом needRedirect
  useEffect(() => {
    const handleNeedRedirect = async () => {
      try {
        const response = await handleMessage({
          req: {
            type: 'needRedirect',
          },
          reqId: 'needRedirect_' + Date.now(),
        });

        if (response.resType !== 'resolve') {
          console.error('Main|needRedirect|error response:', response);
          return;
        }

        const redirectResponse = response.res as ISendPostResponseNeedRedirect;
        console.log('Main|needRedirect|response =', redirectResponse);

        if (redirectResponse.status === 'empty') {
          return;
        }

        if (!redirectResponse.path) {
          console.error('Main|needRedirect|!response.path|response=', redirectResponse);
          Alert.alert(
            'Ошибка подключения к устройству',
            `Не был получен корректный 'needRedirect': ${JSON.stringify(redirectResponse)}`
          );
          return;
        }

        try {
          // Отправляем запрос на подключение к TCP-серверу
          await handleMessage({
            req: {
              type: 'connectToTcpServer',
              ip: (redirectResponse.payload as JoinHotspotResponse).ip,
            },
            reqId: 'connectToTcpServer_' + Date.now(),
          });
        } catch (error: any) {
          console.error('Main|needRedirect|error =', error);
          Alert.alert('Ошибка подключения к устройству', error.message || JSON.stringify(error));
          return;
        }

        let tcpResponse;
        try {
          // Отправляем запрос на подключение к TCP-серверу
          const tcpResponseResult = await handleMessage({
            req: {
              type: 'sendTcpRequest',
              data: {
                type: 'test',
              },
            },
            reqId: 'sendTcpRequest_' + Date.now(),
          });

          if (tcpResponseResult.resType !== 'resolve') {
            throw new Error('TCP request failed');
          }
          tcpResponse = tcpResponseResult.res as ISendTcpResponse;
        } catch (error: any) {
          console.error('Main|needRedirect|tcp test error =', error);
          Alert.alert('Ошибка подключения к устройству', error.message || JSON.stringify(error));
          return;
        }

        console.log('Main|needRedirect|tcpResponse =', tcpResponse);

        if ((tcpResponse.data as ITcpResponseConnectEstablishedOk).status !== 'ok') {
          Alert.alert(
            'Ошибка подключения к устройству',
            `При подключении к устройству, получен некорректный ответ: ${JSON.stringify(
              tcpResponse
            )}`
          );
          return;
        }

        AuthStoreData.context = redirectResponse.path as PositionOptionValue;

        if (!AuthStoreData.context) {
          Alert.alert(
            'Не определен контекст',
            "Не определен контекст пользователя 'AuthStoreData.context'"
          );
          return;
        }

        let currentUser: ISendPostResponseCurrentUser;
        try {
          // Отправляем запрос на получение данных текущего пользователя
          const currentUserResponse = await handleMessage({
            req: {
              type: 'currentUser',
              data: { context: AuthStoreData.context },
            },
            reqId: 'currentUser_' + Date.now(),
          });

          if (currentUserResponse.resType !== 'resolve') {
            throw new Error('Current user request failed');
          }
          currentUser = currentUserResponse.res as ISendPostResponseCurrentUser;
        } catch (error: any) {
          console.error('Main|needRedirect|currentUser|error =', error);
          Alert.alert(
            'Ошибка получения данных текущего пользователя',
            error.message || JSON.stringify(error)
          );
          return;
        }

        Alert.alert('Подключение к устройству прошло успешно', '', [
          {
            text: 'OK',
            onPress: () => {},
          },
        ]);

        switch (AuthStoreData.context) {
          case 'voditel': {
            if (!currentUser.voditelData || !currentUser.userData) {
              Alert.alert('Ошибка', 'Отсутствуют данные водителя');
              return;
            }

            try {
              // Отправляем запрос на подключение к TCP-серверу
              await handleMessage({
                req: {
                  type: 'sendTcpRequest',
                  data: {
                    type: 'set_voditel_data',
                    voditelData: currentUser.voditelData,
                    voditelUserData: currentUser.userData,
                  },
                },
                reqId: 'set_voditel_data_' + Date.now(),
              });
            } catch (error: any) {
              console.error('Main|needRedirect|set_voditel_data error =', error);
              Alert.alert(
                'Ошибка подключения к устройству',
                error.message || JSON.stringify(error)
              );
              return;
            }

            // В React Native версии используем WebView для навигации к странице водителя
            navigation.navigate('WebViewScreen');
            return;
          }

          default:
            console.error(
              'Main|needRedirect|не известный context|AuthStoreData.context=',
              AuthStoreData.context
            );
            Alert.alert(`Неизвестный контекст в switch: ${AuthStoreData.context}`);
            return;
        }
      } catch (error: any) {
        console.error('Main|needRedirect|error =', error);
        Alert.alert('Ошибка подключения к hotspot', error.message || JSON.stringify(error));
      }
    };

    handleNeedRedirect();
  }, [navigation]);

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

      if (response.resType !== 'resolve') {
        throw new Error('Current user request failed');
      }

      const currentUserResponse = response.res as ISendPostResponseCurrentUser;
      console.log('handleClick|currentUser|response=', currentUserResponse);
      console.log('handleClick|currentUser|context=', context);

      switch (currentUserResponse.status) {
        case 'noAuth':
          navigation.navigate('LoginScreen');
          return;
        case 'noUser':
          navigation.navigate('RegistrationScreen');
          break;
        case 'authOk': {
          switch (context) {
            case 'kombainer':
              if (currentUserResponse.kombainerData) {
                // В React Native версии переходим на WebView
                navigation.navigate('WebViewScreen');
                return;
              }
              // Если нет данных комбайнера, нужна специальная регистрация комбайнера
              navigation.navigate('KombainerRegistrationScreen');
              return;
            case 'voditel':
              if (currentUserResponse.voditelData) {
                // В React Native версии переходим на WebView
                navigation.navigate('WebViewScreen');
                return;
              }
              // Если нет данных водителя, нужна регистрация
              navigation.navigate('RegistrationScreen');
              return;
            case 'bunkerist':
              // В React Native версии переходим на WebView
              navigation.navigate('WebViewScreen');
              return;
          }
          return;
        }
        default:
          Alert.alert('Неизвестный response.status', JSON.stringify(currentUserResponse));
          return;
      }
    } catch (error: any) {
      console.error('handleClick|error:', error);
      Alert.alert(
        'Ошибка авторизации',
        `Произошла ошибка при проверке авторизации. Пожалуйста, попробуйте еще раз.\n\n${
          error.message || ''
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEditUserClick = () => {
    // TODO: Implement EditProfile screen or navigate to WebView with edit profile URL
    navigation.navigate('WebViewScreen');
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
