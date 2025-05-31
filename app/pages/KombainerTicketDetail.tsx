import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { handleMessage } from '../services/MessageHandler';
import { VectorLogo } from '../components/VectorLogo';
import {
  ISendPostResponseCurrentUser,
  PositionOptionValue,
  RootStackParamList,
} from '../../global';

/**
 * Страница "Талон комбайнера N"
 */
const KombainerTicketDetail: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ISendPostResponseCurrentUser | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await handleMessage({
          req: {
            type: 'currentUser',
            data: { context: 'kombainer' as PositionOptionValue },
          },
          reqId: 'getCurrentUser_' + Date.now(),
        });

        if (response.resType === 'resolve') {
          setData(response.res as ISendPostResponseCurrentUser);
        } else {
          throw new Error('Failed to get current user');
        }
      } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        Alert.alert('Ошибка', 'Не удалось загрузить данные комбайнера. Попробуйте еще раз.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleConnectDriver = () => {
    // Переходим на экран QR-кода для подключения водителя
    navigation.navigate('KombainerQRCodeScreen');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#98d642" />
        <Text style={styles.loadingText}>Загрузка данных...</Text>
      </View>
    );
  }

  const ticketData = [
    ['Комбайн', data?.kombainerData?.combine],
    ['Комбайнер', data?.userData?.fio],
    ['Культура', data?.kombainerData?.culture],
    ['Поле', data?.kombainerData?.field],
    ['Бригада', data?.kombainerData?.brigade],
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.content}>
        {/* Логотип */}
        <View style={styles.logoContainer}>
          <VectorLogo />
        </View>

        {/* Заголовок */}
        <Text style={styles.title}>Талон комбайнера</Text>

        {/* Данные талона */}
        <View style={styles.ticketForm}>
          {ticketData.map(([label, value]) => (
            <View key={label} style={styles.formRow}>
              <View style={styles.labelContainer}>
                <Text style={styles.label}>{label}:</Text>
              </View>
              <View style={styles.valueContainer}>
                <Text style={styles.value}>{value || '-'}</Text>
              </View>
            </View>
          ))}

          {/* Кнопка подключить водителя */}
          <TouchableOpacity style={styles.submitButton} onPress={handleConnectDriver}>
            <Text style={styles.submitButtonText}>Подключить водителя</Text>
          </TouchableOpacity>
        </View>

        {/* Кнопка назад */}
        <View style={styles.backContainer}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>Назад</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  logoContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 32,
    textAlign: 'center',
    color: '#333333',
  },
  ticketForm: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 24,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f0f8e8',
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#98d642',
  },
  labelContainer: {
    flex: 2,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  valueContainer: {
    flex: 3,
  },
  value: {
    fontSize: 16,
    color: '#333333',
  },
  submitButton: {
    backgroundColor: '#98d642',
    borderRadius: 6,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  submitButtonText: {
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

export default KombainerTicketDetail;
