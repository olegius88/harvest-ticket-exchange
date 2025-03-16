// app/App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import WebViewV1 from './webviews/WebViewV1';
import { Routes } from './Routes';
import { StyleSheet } from 'react-native';

const Stack = createNativeStackNavigator<Routes>();

export default function App(): React.ReactElement {
  // Определение URL: сначала пытаемся взять из переменной окружения, если её нет – используем локальный файл
  const url = process.env.API_URL || 'file:///android_asset/web/index.html';
  console.log('process.env.API_URL=', process.env.API_URL);
  console.log('url=', url);

  return (
    <NavigationContainer>
      <GestureHandlerRootView style={styles.root}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="WebViewScreen">{() => <WebViewV1 url={url} />}</Stack.Screen>
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
