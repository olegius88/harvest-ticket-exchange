import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { VectorLogo } from '../../components/VectorLogo';

const VoditelTicketCreatedSuccess: React.FC = () => {
  const navigation = useNavigation<NavigationProp<any>>();

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
