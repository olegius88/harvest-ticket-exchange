// app/App.tsx

import React, { useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DeviceEventEmitter, StyleSheet } from 'react-native';
import { Routes } from './Routes';
import { CodeScannerPage } from './pages/kombainer/CodeScannerPage';
import Login from './pages/Login';
import Registration from './pages/Registration';
import Main from './pages/Main';
import KombainerRegistration from './pages/kombainer/KombainerRegistration';
import KombainerQRCode from './pages/kombainer/KombainerQRCode';
import KombainerTicketDetail from './pages/kombainer/KombainerTicketDetail';
import KombainerCreateTicket from './pages/kombainer/KombainerCreateTicket';
import { RootStackParamList } from '../global';
import VoditelRegistration from './pages/VoditelRegistration';
import VoditelCreateTrip from './pages/VoditelCreateTrip';
import VoditelTicketDetail from './pages/VoditelTicketDetailNew';
import VoditelWaitKombainerData from './pages/VoditelWaitKombainerData';
import VoditelTicketDetailAfterSetWeight from './pages/VoditelTicketDetailAfterSetWeight';
import VoditelTicketCreatedSuccess from './pages/VoditelTicketCreatedSuccess';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App(): React.ReactElement {
  // Создаем реф для навигации
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  // Определение URL: сначала пытаемся взять из переменной окружения, если её нет – используем локальный файл
  const url = process.env.API_URL || 'file:///android_asset/web/index.html';
  console.log('process.env.API_URL=', process.env.API_URL);
  console.log('url=', url);

  // Подписка на событие openCodeScannerPage для навигации на CodeScannerPage
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('openCodeScannerPage', () => {
      if (navigationRef.current) {
        navigationRef.current.navigate('CodeScannerPageScreen');
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      <GestureHandlerRootView style={styles.root}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
          }}
          initialRouteName="MainScreen"
        >
          <Stack.Screen name="MainScreen" component={Main} />
          <Stack.Screen name="LoginScreen" component={Login} />
          <Stack.Screen name="RegistrationScreen" component={Registration} />
          <Stack.Screen name="KombainerRegistrationScreen" component={KombainerRegistration} />
          <Stack.Screen name="KombainerTicketDetailScreen" component={KombainerTicketDetail} />
          <Stack.Screen name="KombainerCreateTicketScreen" component={KombainerCreateTicket} />
          <Stack.Screen name="KombainerQRCodeScreen">
            {(props) => <KombainerQRCode {...props} />}
          </Stack.Screen>
          <Stack.Screen name="CodeScannerPageScreen" component={CodeScannerPage} />
          <Stack.Screen name="VoditelRegistrationScreen" component={VoditelRegistration} />
          <Stack.Screen name="VoditelCreateTripScreen" component={VoditelCreateTrip} />
          <Stack.Screen name="VoditelTicketDetailScreen" component={VoditelTicketDetail} />
          <Stack.Screen
            name="VoditelWaitKombainerDataScreen"
            component={VoditelWaitKombainerData}
          />
          <Stack.Screen
            name="VoditelTicketDetailAfterSetWeightScreen"
            component={VoditelTicketDetailAfterSetWeight}
          />
          <Stack.Screen
            name="VoditelTicketCreatedSuccessScreen"
            component={VoditelTicketCreatedSuccess}
          />
        </Stack.Navigator>
      </GestureHandlerRootView>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
