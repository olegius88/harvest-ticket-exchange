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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { handleMessage } from '../../services/MessageHandler';
import { AuthStoreData } from '../../stores/AuthStore';
import {
  IEditKombainerParams,
  IKombainerForm,
  ISendPostResponseCurrentUser,
  RootStackParamList,
} from '../../../global';

const KombainerRegistration: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [form, setForm] = useState<IKombainerForm>({
    combine: '',
    brigade: '',
    culture: '',
    field: '',
  });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [kombainerId, setKombainerId] = useState<string | null>(null);
  const [userFio, setUserFio] = useState<string>('');
  const [errors, setErrors] = useState<{
    combine?: string;
    brigade?: string;
    culture?: string;
    field?: string;
  }>({});

  // Получаем данные текущего пользователя и проверяем наличие kombainerData
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        setLoading(true);

        // Получаем данные текущего пользователя
        const response = await handleMessage({
          req: {
            type: 'currentUser',
            data: { context: 'kombainer' },
          },
          reqId: 'getCurrentUser_' + Date.now(),
        });

        if (response.resType !== 'resolve') {
          throw new Error('Failed to get current user');
        }

        const currentUser = response.res as ISendPostResponseCurrentUser;

        if (currentUser.kombainerData) {
          setEditing(true);
          setKombainerId(currentUser.kombainerData.id || null);
          // Предзаполнение формы данными для редактирования
          setForm({
            combine: currentUser.kombainerData.combine || '',
            brigade: currentUser.kombainerData.brigade || '',
            culture: currentUser.kombainerData.culture || '',
            field: currentUser.kombainerData.field || '',
          });
        }

        // Добавляем установку ФИО пользователя
        if (currentUser.userData && currentUser.userData.fio) {
          setUserFio(currentUser.userData.fio);
        }
      } catch (error) {
        console.error('Ошибка получения данных текущего пользователя:', error);
        Alert.alert('Ошибка', 'Не удалось получить данные пользователя. Попробуйте еще раз.');
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentUser();
  }, []);

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!form.combine.trim()) {
      newErrors.combine = 'Введите название комбайна';
    }

    if (!form.brigade.trim()) {
      newErrors.brigade = 'Введите номер бригады или название';
    }

    if (!form.culture.trim()) {
      newErrors.culture = 'Укажите культуру';
    }

    if (!form.field.trim()) {
      newErrors.field = 'Укажите поле';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof IKombainerForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Обработка отправки формы
  const onFinish = async () => {
    if (!validateForm()) return;

    console.log('KombainerRegistration|data=', form);
    setSubmitting(true);

    try {
      // Получаем актуальные данные пользователя
      const currentUserResponse = await handleMessage({
        req: {
          type: 'currentUser',
          data: { context: 'kombainer' },
        },
        reqId: 'getCurrentUserForSubmit_' + Date.now(),
      });

      if (currentUserResponse.resType !== 'resolve') {
        throw new Error('Failed to get current user for submit');
      }

      const currentUser = currentUserResponse.res as ISendPostResponseCurrentUser;
      const { userData, kombainerData } = currentUser;

      if (!userData) {
        throw new Error('User data not found');
      }

      if (editing && kombainerId && kombainerData) {
        // Отправляем запрос на обновление данных комбайнера
        const requestData: IEditKombainerParams = {
          kombainerId,
          userId: userData.id,
          combine: form.combine,
          brigade: form.brigade,
          culture: form.culture,
          field: form.field,
          created_at: kombainerData.created_at,
          updated_at: Date.now(),
        };

        const response = await handleMessage({
          req: {
            type: 'editKombainer',
            data: requestData,
          },
          reqId: 'editKombainer_' + Date.now(),
        });

        if (response.resType !== 'resolve') {
          throw new Error('Failed to edit kombainer');
        }

        console.log('Response from handleMessage (editKombainer):', response);
      } else {
        // Отправляем запрос на создание комбайнера
        const response = await handleMessage({
          req: {
            type: 'createKombainer',
            data: { ...form, userId: userData.id },
          },
          reqId: 'createKombainer_' + Date.now(),
        });

        if (response.resType !== 'resolve') {
          throw new Error('Failed to create kombainer');
        }

        console.log('Response from handleMessage (createKombainer):', response);
      }

      Alert.alert(
        editing ? 'Данные комбайнера обновлены' : 'Успешная регистрация данных комбайнера',
        editing
          ? 'Данные комбайнера успешно обновлены. Нажмите OK для перехода на страницу создания талона.'
          : 'Данные комбайнера успешно сохранены. Нажмите OK для перехода на страницу создания талона.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (!editing) {
                // После создания комбайнера переходим на экран создания талона
                navigation.navigate('KombainerCreateTicketScreen');
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
          editing ? 'обновлении данных комбайнера' : 'регистрации данных комбайнера'
        }. Пожалуйста, попробуйте еще раз.\n\n${error.message || ''}`
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5a7d2b" />
        <Text style={styles.loadingText}>Загрузка данных...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>
            {editing ? 'Редактирование данных комбайнера' : 'Регистрация Комбайнера'}
          </Text>

          <View style={styles.userInfoContainer}>
            <Text style={styles.userInfoLabel}>ФИО:</Text>
            <Text style={styles.userInfoValue}>{userFio}</Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Комбайн *</Text>
              <TextInput
                style={[styles.input, errors.combine && styles.inputError]}
                placeholder="Например, ACROS-530"
                value={form.combine}
                onChangeText={(value) => handleInputChange('combine', value)}
                autoCapitalize="none"
              />
              {errors.combine && <Text style={styles.errorText}>{errors.combine}</Text>}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Бригада *</Text>
              <TextInput
                style={[styles.input, errors.brigade && styles.inputError]}
                placeholder="Бригада №1"
                value={form.brigade}
                onChangeText={(value) => handleInputChange('brigade', value)}
                autoCapitalize="words"
              />
              {errors.brigade && <Text style={styles.errorText}>{errors.brigade}</Text>}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Культура *</Text>
              <TextInput
                style={[styles.input, errors.culture && styles.inputError]}
                placeholder="Пшеница, Ячмень и т.п."
                value={form.culture}
                onChangeText={(value) => handleInputChange('culture', value)}
                autoCapitalize="words"
              />
              {errors.culture && <Text style={styles.errorText}>{errors.culture}</Text>}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Поле *</Text>
              <TextInput
                style={[styles.input, errors.field && styles.inputError]}
                placeholder="Например, поле №7"
                value={form.field}
                onChangeText={(value) => handleInputChange('field', value)}
                autoCapitalize="words"
              />
              {errors.field && <Text style={styles.errorText}>{errors.field}</Text>}
            </View>

            <TouchableOpacity
              style={[styles.button, submitting && styles.buttonDisabled]}
              onPress={onFinish}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>{editing ? 'Обновить данные' : 'Сохранить'}</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.backContainer}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.backText}>Назад</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContainer: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
    color: '#333333',
  },
  userInfoContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
  },
  userInfoLabel: {
    fontWeight: 'bold',
    marginRight: 12,
    color: '#333333',
    fontSize: 16,
  },
  userInfoValue: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
  },
  formContainer: {
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: '#333333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  inputError: {
    borderColor: '#ff4d4f',
  },
  errorText: {
    color: '#ff4d4f',
    fontSize: 14,
    marginTop: 4,
  },
  button: {
    backgroundColor: '#5a7d2b',
    borderRadius: 6,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  backContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  backText: {
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

export default KombainerRegistration;
