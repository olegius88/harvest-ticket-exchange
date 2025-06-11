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
} from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { handleMessage } from '../services/MessageHandler';
import { ISendPostMessageRequest, ISendPostResponse, RootStackParamList } from '../../global';

interface ILoginForm {
  phone: string;
  password: string;
}

const Login = () => {
  const [form, setForm] = useState<ILoginForm>({ phone: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ phone?: string; password?: string }>({});
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const validateForm = (): boolean => {
    const newErrors: { phone?: string; password?: string } = {};

    if (!form.phone) {
      newErrors.phone = 'Введите номер телефона';
    } else if (!/^\+?[78][0-9]{10}$/.test(form.phone)) {
      newErrors.phone = 'Введите корректный номер';
    }

    if (!form.password) {
      newErrors.password = 'Введите пароль';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const onFinish = async () => {
    if (!validateForm()) return;

    console.log('Form values|data=', form);
    setLoading(true);

    try {
      const response = await handleMessage({
        req: {
          type: 'login',
          data: form,
        },
        reqId: `login_${Date.now()}`,
      });

      console.log('Login successful', response);

      Alert.alert(
        'Успешный вход',
        'Вы успешно вошли в систему. Нажмите OK для перехода на главную страницу.',
        [
          {
            text: 'OK',
            onPress: () => {
              // TODO: Navigate to appropriate screen based on user role
              navigation.navigate('MainScreen');
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error sending message:', error);
      Alert.alert(
        'Ошибка входа',
        error?.message ||
          'Произошла ошибка при входе. Пожалуйста, проверьте свои данные и попробуйте снова.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof ILoginForm, value: string) => {
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
          <Text style={styles.title}>Вход в систему</Text>

          <View style={styles.formContainer}>
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

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={onFinish}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Войти</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.linksContainer}>
            <TouchableOpacity
              onPress={() => {
                navigation.navigate('RegistrationScreen');
              }}
            >
              <Text style={styles.linkText}>Зарегистрироваться</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Text style={styles.linkText}>Назад</Text>
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
  linksContainer: {
    alignItems: 'center',
  },
  linkText: {
    color: '#5a7d2b',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  backButton: {
    marginTop: 8,
  },
});

export default Login;
