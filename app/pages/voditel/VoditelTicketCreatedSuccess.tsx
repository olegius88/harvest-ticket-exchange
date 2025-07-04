import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, BackHandler, ToastAndroid } from 'react-native';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { VectorLogo } from '../../components/VectorLogo';
import { RootStackParamList } from '../../../global';
import { closeVoditelConnections } from '../../services/ConnectionManager';
import { useResourceCleanup } from '../../hooks/useResourceCleanup';

const VoditelTicketCreatedSuccess: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { safeAddListener } = useResourceCleanup();

  // Закрываем соединения при монтировании компонента
  useEffect(() => {
    const closeConnections = async () => {
      try {
        await closeVoditelConnections('VoditelTicketCreatedSuccess');
      } catch (error) {
        console.error('VoditelTicketCreatedSuccess: Ошибка при закрытии соединений:', error);
      }
    };

    closeConnections();

    // Блокируем кнопку "Назад" с использованием безопасного метода
    const handleBackPress = () => {
      console.log('VoditelTicketCreatedSuccess|handleBackPress - блокировка возврата назад');
      ToastAndroid.show('Для продолжения нажмите кнопку "Ок" на экране', ToastAndroid.SHORT);
      return true;
    };

    // Используем безопасный метод добавления слушателя, который автоматически очистится
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);

    // Возвращаем функцию очистки (хотя useResourceCleanup уже обработает это)
    return () => {
      backHandler?.remove();
    };
  }, []);

  const handleOkPress = () => {
    navigation.navigate('VoditelCreateTripScreen');
  };

  return (
    <View style={styles.container}>
      <VectorLogo />

      <Text style={styles.successText}>Талон успешно создан</Text>

      <TouchableOpacity style={styles.okButton} onPress={handleOkPress}>
        <Text style={styles.okButtonText}>ОК</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 20,
  },
  successText: {
    color: '#5a7d2b',
    fontSize: 16,
    marginTop: 40,
    textAlign: 'center',
    fontWeight: '500',
  },
  okButton: {
    backgroundColor: '#98d642',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginTop: 40,
    minWidth: 250,
    alignItems: 'center',
  },
  okButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default VoditelTicketCreatedSuccess;
