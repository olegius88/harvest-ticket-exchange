import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { handleMessage } from '../services/MessageHandler';
import { RootStackParamList } from '../../global';

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

const VoditelCreateTrip: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateTrip = async () => {
    setIsLoading(true);
    try {
      const response = await handleMessage({
        req: {
          type: 'openCodeScannerPage',
        },
        reqId: 'openCodeScannerPage_' + Date.now(),
      });

      if (response.resType !== 'resolve') {
        throw new Error('Не удалось открыть сканер QR-кода');
      }

      // Переходим на страницу сканера QR-кода
      navigation.navigate('CodeScannerPageScreen');
    } catch (error: any) {
      console.error('Ошибка открытия сканера:', error);
      Alert.alert(
        'Ошибка',
        error.message || 'Произошла неизвестная ошибка при открытии сканера QR.'
      );
    } finally {
      // Задержка для отображения состояния загрузки
      setTimeout(() => {
        setIsLoading(false);
      }, 2000);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <VectorLogo />

        <TouchableOpacity
          style={[styles.createButton, isLoading && styles.disabledButton]}
          onPress={handleCreateTrip}
          disabled={isLoading}
        >
          <Text style={styles.createButtonText}>
            {isLoading ? 'Загрузка камеры, ожидайте' : 'Создать Поездку'}
          </Text>
          {isLoading && (
            <ActivityIndicator size="small" color="#ffffff" style={{ marginLeft: 8 }} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => navigation.navigate('VoditelRegistrationScreen')}
        >
          <Text style={styles.linkText}>Изменить регистрационные данные</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.linkButton, { marginTop: 8 }]}
          onPress={() => navigation.navigate('MainScreen')}
        >
          <Text style={styles.linkText}>Назад</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

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
  createButton: {
    backgroundColor: '#98d642',
    borderRadius: 6,
    height: 48,
    width: '100%',
    maxWidth: 250,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 40,
    marginBottom: 16,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.7,
  },
  linkButton: {
    padding: 8,
  },
  linkText: {
    color: '#5a7d2b',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});

export default VoditelCreateTrip;
