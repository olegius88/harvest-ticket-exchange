import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  FlatList,
} from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { handleMessage } from '../services/MessageHandler';
import { IRegistrationForm, IOption, RegistrationResponse, RootStackParamList } from '../../global';

const positionOptions: IOption[] = [
  { value: 'kombainer', label: 'Комбайнер' },
  { value: 'voditel', label: 'Водитель' },
  { value: 'bunkerist', label: 'Бункерист' },
];

const Registration = () => {
  const [form, setForm] = useState<IRegistrationForm>({
    fio: '',
    phone: '',
    position: '',
    password: '',
    confirmPassword: '',
    from_remote: false,
  });
  const [loading, setLoading] = useState(false);
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [errors, setErrors] = useState<{
    fio?: string;
    phone?: string;
    position?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const validateForm = (): boolean => {
    const newErrors: {
      fio?: string;
      phone?: string;
      position?: string;
      password?: string;
      confirmPassword?: string;
    } = {};

    if (!form.fio) {
      newErrors.fio = 'Введите ФИО';
    }

    if (!form.phone) {
      newErrors.phone = 'Введите номер телефона';
    } else if (!/^\+?[78][0-9]{10}$/.test(form.phone)) {
      newErrors.phone = 'Введите корректный номер';
    }

    if (!form.position) {
      newErrors.position = 'Выберите должность';
    }

    if (!form.password) {
      newErrors.password = 'Введите пароль';
    }

    if (!form.confirmPassword) {
      newErrors.confirmPassword = 'Подтвердите пароль';
    } else if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = 'Пароли не совпадают';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const onFinish = async () => {
    if (!validateForm()) return;

    console.log('Form values|data=', form);
    // Извлекаем confirmPassword, чтобы отправить на сервер только данные типа ICreateUsersParams
    const { confirmPassword, ...userData } = form;
    setLoading(true);

    try {
      const response = await handleMessage({
        req: {
          type: 'registration',
          data: userData,
        },
        reqId: 'registration_' + Date.now(),
      });

      console.log('Response from handleMessage:', response);

      if (response.type === 'registration') {
        Alert.alert(
          'Успешная регистрация',
          'Регистрация прошла успешно. Нажмите OK для перехода на страницу авторизации.',
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.navigate('LoginScreen');
              },
            },
          ]
        );
      } else {
        throw new Error('Ошибка регистрации');
      }
    } catch (error: unknown) {
      console.error('Error sending message:', error);
      Alert.alert(
        'Ошибка регистрации',
        `Произошла ошибка при регистрации. Пожалуйста, попробуйте еще раз.\n\n${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof IRegistrationForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>WELCOME</Text>

          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>ФИО</Text>
              <TextInput
                style={[styles.input, errors.fio && styles.inputError]}
                placeholder="Введите ФИО"
                value={form.fio}
                onChangeText={(value) => handleInputChange('fio', value)}
                autoCapitalize="words"
              />
              {errors.fio && <Text style={styles.errorText}>{errors.fio}</Text>}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Номер телефона</Text>
              <TextInput
                style={[styles.input, errors.phone && styles.inputError]}
                placeholder="+7XXXXXXXXXX"
                value={form.phone}
                onChangeText={(value) => handleInputChange('phone', value)}
                keyboardType="phone-pad"
                autoCapitalize="none"
              />
              {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Должность</Text>
              <TouchableOpacity
                style={[styles.input, styles.selectInput, errors.position && styles.inputError]}
                onPress={() => setShowPositionModal(true)}
              >
                <Text style={[styles.selectText, !form.position && styles.placeholder]}>
                  {form.position
                    ? positionOptions.find((opt) => opt.value === form.position)?.label
                    : 'Выберите должность'}
                </Text>
              </TouchableOpacity>
              {errors.position && <Text style={styles.errorText}>{errors.position}</Text>}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Пароль</Text>
              <TextInput
                style={[styles.input, errors.password && styles.inputError]}
                placeholder="Введите пароль"
                value={form.password}
                onChangeText={(value) => handleInputChange('password', value)}
                secureTextEntry
                autoCapitalize="none"
              />
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Повторите пароль</Text>
              <TextInput
                style={[styles.input, errors.confirmPassword && styles.inputError]}
                placeholder="Повторите пароль"
                value={form.confirmPassword}
                onChangeText={(value) => handleInputChange('confirmPassword', value)}
                secureTextEntry
                autoCapitalize="none"
              />
              {errors.confirmPassword && (
                <Text style={styles.errorText}>{errors.confirmPassword}</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={onFinish}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Регистрация</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.linksContainer}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.linkText}>Назад</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Modal for position selection */}
        <Modal
          visible={showPositionModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowPositionModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Выберите должность</Text>
              <FlatList
                data={positionOptions}
                keyExtractor={(item) => item.value}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                      handleInputChange('position', item.value);
                      setShowPositionModal(false);
                    }}
                  >
                    <Text style={styles.modalItemText}>{item.label}</Text>
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowPositionModal(false)}
              >
                <Text style={styles.modalCloseText}>Отмена</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
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
    color: '#333333',
  },
  inputError: {
    borderColor: '#ff4d4f',
  },
  selectInput: {
    justifyContent: 'center',
  },
  selectText: {
    fontSize: 16,
    color: '#333333',
  },
  placeholder: {
    color: '#999999',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 6,
    backgroundColor: '#ffffff',
  },
  picker: {
    height: 50,
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
  linksContainer: {
    alignItems: 'center',
  },
  linkText: {
    color: '#5a7d2b',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    maxHeight: '60%',
    minWidth: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#333333',
  },
  modalItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalItemText: {
    fontSize: 16,
    color: '#333333',
  },
  modalCloseButton: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    color: '#666666',
  },
});

export default Registration;
