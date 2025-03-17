// app/App.tsx

import React, { useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DeviceEventEmitter, StyleSheet } from 'react-native';
import WebViewV1 from './webviews/WebViewV1';
import { Routes } from './Routes';
import { CodeScannerPage } from './CodeScannerPage';

const Stack = createNativeStackNavigator<Routes>();

export default function App(): React.ReactElement {
  // Создаем реф для навигации
  const navigationRef = useRef<NavigationContainerRef>(null);

  // Определение URL: сначала пытаемся взять из переменной окружения, если её нет – используем локальный файл
  const url = process.env.API_URL || 'file:///android_asset/web/index.html';
  console.log('process.env.API_URL=', process.env.API_URL);
  console.log('url=', url);

  // Подписка на событие openQRScanner для навигации на CodeScannerPage
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('openQRScanner', () => {
      if (navigationRef.current) {
        navigationRef.current.navigate('CodeScannerPage');
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
        >
          <Stack.Screen name="WebViewScreen">{() => <WebViewV1 url={url} />}</Stack.Screen>
          <Stack.Screen name="CodeScannerPage" component={CodeScannerPage} />
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
