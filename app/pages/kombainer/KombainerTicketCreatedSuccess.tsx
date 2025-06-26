import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, BackHandler, ToastAndroid } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { VectorLogo } from '../../components/VectorLogo';
import { RootStackParamList } from '../../../global';
import { closeKombainerConnections } from '../../services/ConnectionManager';
import { useResourceCleanup } from '../../hooks/useResourceCleanup';

/**
 * Компонент отображения успешного создания талона комбайнера для мобильного приложения
 */
const KombainerTicketCreatedSuccess: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  // Закрываем соединения при монтировании компонента
  useEffect(() => {
    const closeConnections = async () => {
      try {
        await closeKombainerConnections('KombainerTicketCreatedSuccess');
      } catch (error) {
        console.error('KombainerTicketCreatedSuccess: Ошибка при закрытии соединений:', error);
      }
    };

    closeConnections();

    // Блокируем кнопку "Назад"
    const handleBackPress = () => {
      console.log('KombainerTicketCreatedSuccess|handleBackPress - блокировка возврата назад');
      ToastAndroid.show('Для продолжения нажмите кнопку "Ок" на экране', ToastAndroid.SHORT);
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);

    return () => {
      if (backHandler?.remove) {
        backHandler.remove();
      }
    };
  }, []);

  const handleOkPress = () => {
    navigation.navigate('MainScreen');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <VectorLogo />
        <Text style={styles.successText}>Талон успешно создан</Text>
        <TouchableOpacity style={styles.button} onPress={handleOkPress}>
          <Text style={styles.buttonText}>ОК</Text>
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
  successText: {
    color: '#5a7d2b',
    fontSize: 16,
    marginTop: 40,
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#98d642',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    width: '100%',
    maxWidth: 250,
    height: 48,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default KombainerTicketCreatedSuccess;
