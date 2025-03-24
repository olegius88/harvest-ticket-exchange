// app/CodeScannerPage.tsx

import * as React from 'react';
import { useCallback, useRef, useState } from 'react';
import type { AlertButton } from 'react-native';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import type { Code } from 'react-native-vision-camera';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { CONTENT_SPACING, CONTROL_BUTTON_SIZE, SAFE_AREA_PADDING } from './Constants';
import { useIsForeground } from './hooks/useIsForeground';
import { StatusBarBlurBackground } from './views/StatusBarBlurBackground';
import { PressableOpacity } from 'react-native-pressable-opacity';
import IonIcon from 'react-native-vector-icons/Ionicons';
import type { Routes } from './Routes';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/core';
import ScanningOverlay from './views/ScanningOverlay';

/**
 * Функция отображения алерта с отсканированным значением.
 */
const showCodeAlert = (value: string, onDismissed: () => void): void => {
  const buttons: AlertButton[] = [
    {
      text: 'Close',
      style: 'cancel',
      onPress: onDismissed,
    },
  ];
  if (value.startsWith('http')) {
    buttons.push({
      text: 'Open URL',
      onPress: () => {
        Linking.openURL(value);
        onDismissed();
      },
    });
  }
  Alert.alert('Scanned Code', value, buttons);
};

type Props = NativeStackScreenProps<Routes, 'CodeScannerPage'>;
export function CodeScannerPage({ navigation }: Props): React.ReactElement {
  // 1. Используем заднюю камеру
  const device = useCameraDevice('back');

  // 2. Камера активна только если экран в фокусе и приложение на переднем плане
  const isFocused = useIsFocused();
  const isForeground = useIsForeground();
  const isActive = isFocused && isForeground;

  // 3. (Опционально) включение фонарика
  const [torch, setTorch] = useState(false);

  // 4. Обработка отсканированных кодов
  const isShowingAlert = useRef(false);
  const onCodeScanned = useCallback((codes: Code[]) => {
    console.log(`Scanned ${codes.length} codes:`, codes);
    const value = codes[0]?.value;
    if (value == null) return;
    if (isShowingAlert.current) return;
    showCodeAlert(value, () => {
      isShowingAlert.current = false;
    });
    isShowingAlert.current = true;
  }, []);

  // 5. Инициализация сканера с поддержкой QR и штрих-кодов (ean-13)
  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13'],
    onCodeScanned: onCodeScanned,
  });

  return (
    <View style={styles.container}>
      {device != null && (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isActive}
          codeScanner={codeScanner}
          torch={torch ? 'on' : 'off'}
          enableZoomGesture={true}
        />
      )}

      <StatusBarBlurBackground />

      {/* Оверлей для сканирования */}
      <ScanningOverlay />

      <View style={styles.rightButtonRow}>
        <PressableOpacity
          style={styles.button}
          onPress={() => setTorch(!torch)}
          disabledOpacity={0.4}
        >
          <IonIcon name={torch ? 'flash' : 'flash-off'} color="white" size={24} />
        </PressableOpacity>
      </View>

      {/* Кнопка "Назад" */}
      <PressableOpacity style={styles.backButton} onPress={navigation.goBack}>
        <IonIcon name="chevron-back" color="white" size={35} />
      </PressableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  button: {
    marginBottom: CONTENT_SPACING,
    width: CONTROL_BUTTON_SIZE,
    height: CONTROL_BUTTON_SIZE,
    borderRadius: CONTROL_BUTTON_SIZE / 2,
    backgroundColor: 'rgba(140, 140, 140, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightButtonRow: {
    position: 'absolute',
    right: SAFE_AREA_PADDING.paddingRight,
    top: SAFE_AREA_PADDING.paddingTop,
  },
  backButton: {
    position: 'absolute',
    left: SAFE_AREA_PADDING.paddingLeft,
    top: SAFE_AREA_PADDING.paddingTop,
  },
});
