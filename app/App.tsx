// app/App.tsx

import React, { useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DeviceEventEmitter, StyleSheet } from 'react-native';
import { Routes } from './Routes';
import { VoditelQrCodeScanner } from './pages/voditel/VoditelQrCodeScanner';
import Login from './pages/Login';
import Registration from './pages/Registration';
import Main from './pages/Main';
import KombainerRegistration from './pages/kombainer/KombainerRegistration';
import KombainerQRCode from './pages/kombainer/KombainerQRCode';
import KombainerTicketDetail from './pages/kombainer/KombainerTicketDetail';
import KombainerCreateTicket from './pages/kombainer/KombainerCreateTicket';
import { RootStackParamList } from '../global';
import VoditelRegistration from './pages/voditel/VoditelRegistration';
import VoditelCreateTrip from './pages/voditel/VoditelCreateTrip';
import VoditelTicketDetailAfterSetWeight from './pages/voditel/VoditelTicketDetailAfterSetWeight';
import VoditelTicketCreatedSuccess from './pages/voditel/VoditelTicketCreatedSuccess';
import KombainerTicketDetailAfterVoditelConfirm from './pages/kombainer/KombainerTicketDetailAfterVoditelConfirm';
import KombainerTicketCreatedSuccess from './pages/kombainer/KombainerTicketCreatedSuccess';
import KombainerTalonsExport from './pages/kombainer/KombainerTalonsExport';
import VoditelTalonsExport from './pages/voditel/VoditelTalonsExport';
import VoditelTalonsRegistry from './pages/voditel/VoditelTalonsRegistry';
import VoditelTalonDetailScreen from './pages/voditel/VoditelTalonDetailScreen';
import VoditelWeighingQrScannerScreen from './pages/voditel/VoditelWeighingQrScannerScreen';
import AdminPanel from './pages/admin/AdminPanel';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App(): React.ReactElement {
  // Создаем реф для навигации
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const subscriptionRef = useRef<any>(null);

  // Подписка на событие openCodeScannerPage для навигации на VoditelQrCodeScanner
  useEffect(() => {
    // Удаляем предыдущую подписку, если она существует
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
    }

    // Создаем новую подписку
    subscriptionRef.current = DeviceEventEmitter.addListener('openCodeScannerPage', () => {
      if (navigationRef.current) {
        navigationRef.current.navigate('CodeScannerPageScreen');
      }
    });

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
    };
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      <GestureHandlerRootView style={styles.root}>
        <Stack.Navigator
          id={undefined}
          screenOptions={{
            headerShown: false,
          }}
          initialRouteName="MainScreen"
        >
          <Stack.Screen name="MainScreen" component={Main} />
          <Stack.Screen name="LoginScreen" component={Login} />
          <Stack.Screen name="RegistrationScreen" component={Registration} />
          <Stack.Screen name="AdminPanelScreen" component={AdminPanel} />

          <Stack.Screen name="KombainerRegistrationScreen" component={KombainerRegistration} />
          <Stack.Screen name="KombainerTicketDetailScreen" component={KombainerTicketDetail} />
          <Stack.Screen
            name="KombainerTicketCreatedSuccessScreen"
            component={KombainerTicketCreatedSuccess}
          />

          <Stack.Screen name="KombainerTicketDetailAfterVoditelConfirmScreen">
            {(props) => <KombainerTicketDetailAfterVoditelConfirm {...props} />}
          </Stack.Screen>
          <Stack.Screen name="KombainerCreateTicketScreen" component={KombainerCreateTicket} />
          <Stack.Screen name="KombainerTalonsExportScreen" component={KombainerTalonsExport} />
          <Stack.Screen name="KombainerQRCodeScreen">
            {(props) => <KombainerQRCode {...props} />}
          </Stack.Screen>

          <Stack.Screen name="CodeScannerPageScreen" component={VoditelQrCodeScanner} />
          <Stack.Screen name="VoditelRegistrationScreen" component={VoditelRegistration} />
          <Stack.Screen name="VoditelCreateTripScreen" component={VoditelCreateTrip} />
          <Stack.Screen name="VoditelTalonsExportScreen" component={VoditelTalonsExport} />
          <Stack.Screen name="VoditelTalonsRegistry" component={VoditelTalonsRegistry} />
          <Stack.Screen name="VoditelTalonDetailScreen" component={VoditelTalonDetailScreen} />
          <Stack.Screen
            name="VoditelWeighingQrScannerScreen"
            component={VoditelWeighingQrScannerScreen}
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
