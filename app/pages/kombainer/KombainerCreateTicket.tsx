import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { VectorLogo } from '../../components/VectorLogo';
import { RootStackParamList } from '../../../global';

const KombainerCreateTicket: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const handleCreateTicket = () => {
    navigation.navigate('KombainerTicketDetailScreen');
  };

  const handleEditRegistration = () => {
    navigation.navigate('KombainerRegistrationScreen');
  };

  const handleTalonsRegistry = () => {
    navigation.navigate('KombainerTalonsExportScreen');
  };

  const handleGoBack = () => {
    navigation.navigate('MainScreen');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <VectorLogo />
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleCreateTicket}>
          <Text style={styles.primaryButtonText}>Создать талон комбайнера</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton} onPress={handleEditRegistration}>
          <Text style={styles.linkText}>Изменить регистрационные данные</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton} onPress={handleTalonsRegistry}>
          <Text style={styles.linkText}>Реестр талонов</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.linkButton, styles.backButton]} onPress={handleGoBack}>
          <Text style={styles.linkText}>Назад</Text>
        </TouchableOpacity>
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
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  logoContainer: {
    marginBottom: 40,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#98d642',
    borderRadius: 6,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
    maxWidth: 250,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  linkButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  backButton: {
    marginTop: 8,
  },
  linkText: {
    color: '#5a7d2b',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});

export default KombainerCreateTicket;
