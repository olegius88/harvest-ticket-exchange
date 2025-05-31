// app/App.tsx

import React, { useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DeviceEventEmitter, StyleSheet } from 'react-native';
import WebViewV1 from './webviews/WebViewV1';
import { Routes } from './Routes';
import { CodeScannerPage } from './pages/CodeScannerPage';
import Login from './pages/Login';
import Registration from './pages/Registration';
import Main from './pages/Main';
import KombainerRegistration from './pages/KombainerRegistration';
import KombainerQRCode from './pages/KombainerQRCode';
import KombainerTicketDetail from './pages/KombainerTicketDetail';
import KombainerCreateTicket from './pages/KombainerCreateTicket';

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
          <Stack.Screen name="WebViewScreen">{() => <WebViewV1 url={url} />}</Stack.Screen>
          <Stack.Screen name="CodeScannerPageScreen" component={CodeScannerPage} />
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
