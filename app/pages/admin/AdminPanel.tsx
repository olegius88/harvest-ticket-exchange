import React, { useState } from 'react';
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
import { handleMessage } from '../../services/MessageHandler';
import { RootStackParamList } from '../../../global';
import { VectorLogo } from '../../components/VectorLogo';

const AdminPanel = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [loading, setLoading] = useState(false);

  const handleDeleteAllTalons = async () => {
    Alert.alert(
      'Подтверждение удаления',
      'Вы уверены, что хотите удалить ВСЕ талоны? Это действие нельзя отменить!',
      [
        {
          text: 'Отмена',
          style: 'cancel',
        },
        {
          text: 'Удалить ВСЕ',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const response = await handleMessage({
                req: {
                  type: 'deleteAllTalons',
                },
                reqId: 'deleteAllTalons_' + Date.now(),
              });

              if (response.type === 'deleteAllTalons') {
                Alert.alert('Успешно', `Удалено ${response.deletedCount} талонов`, [
                  { text: 'ОК' },
                ]);
              }
            } catch (error: unknown) {
              console.error('Ошибка при удалении талонов:', error);
              const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
              Alert.alert('Ошибка', `Произошла ошибка при удалении талонов:\n\n${errorMessage}`, [
                { text: 'ОК' },
              ]);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <VectorLogo />
        </View>

        <Text style={styles.title}>Панель администратора</Text>

        <View style={styles.sectionsContainer}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Управление данными</Text>

            <TouchableOpacity
              style={[styles.dangerButton, loading && styles.buttonDisabled]}
              onPress={handleDeleteAllTalons}
              disabled={loading}
            >
              <Text style={styles.dangerButtonText}>🗑️ Удалить все талоны</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Системная информация</Text>

            <TouchableOpacity
              style={[styles.infoButton, loading && styles.buttonDisabled]}
              onPress={() => Alert.alert('Информация', 'Функция в разработке')}
              disabled={loading}
            >
              <Text style={styles.infoButtonText}>📊 Статистика БД</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.infoButton, loading && styles.buttonDisabled]}
              onPress={() => Alert.alert('Информация', 'Функция в разработке')}
              disabled={loading}
            >
              <Text style={styles.infoButtonText}>🔧 Настройки системы</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Экспорт и резервное копирование</Text>

            <TouchableOpacity
              style={[styles.secondaryButton, loading && styles.buttonDisabled]}
              onPress={() => Alert.alert('Информация', 'Функция в разработке')}
              disabled={loading}
            >
              <Text style={styles.secondaryButtonText}>💾 Создать бэкап</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, loading && styles.buttonDisabled]}
              onPress={() => Alert.alert('Информация', 'Функция в разработке')}
              disabled={loading}
            >
              <Text style={styles.secondaryButtonText}>📤 Экспорт всех данных</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.backButton, loading && styles.buttonDisabled]}
          onPress={handleGoBack}
          disabled={loading}
        >
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#5a7d2b" />
            <Text style={styles.loadingText}>Выполняется операция...</Text>
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
  },
  logoContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 32,
    textAlign: 'center',
    color: '#333333',
  },
  sectionsContainer: {
    flex: 1,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333333',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 8,
  },
  dangerButton: {
    backgroundColor: '#dc3545',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  dangerButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
  infoButton: {
    backgroundColor: '#17a2b8',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  infoButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
  secondaryButton: {
    backgroundColor: '#6c757d',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
  backButton: {
    backgroundColor: '#5a7d2b',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
});

export default AdminPanel;
