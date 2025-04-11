// Файл: app/views/ScanningOverlay.tsx

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

/**
 * Компонент ScanningOverlay создает оверлей с центральной рамкой и анимированной линией.
 * Это имитирует процесс поиска/сканирования.
 */
const ScanningOverlay = () => {
  // Анимированное значение для вертикального смещения линии
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const SCANNING_AREA_SIZE = 250; // Размер рамки для сканирования (ширина и высота)
  const ANIMATION_DURATION = 2000; // Длительность анимации в мс

  useEffect(() => {
    const animateLine = () => {
      // Сброс значения анимации
      scanLineAnim.setValue(0);
      Animated.timing(scanLineAnim, {
        toValue: SCANNING_AREA_SIZE,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }).start(() => animateLine());
    };
    animateLine();
  }, [scanLineAnim]);

  return (
    <View style={styles.overlayContainer}>
      {/* Центральная рамка */}
      <View style={styles.scanningArea}>
        {/* Анимированная линия */}
        <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanLineAnim }] }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanningArea: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: 'white',
    borderRadius: 10,
    overflow: 'hidden',
  },
  scanLine: {
    width: '100%',
    height: 2,
    backgroundColor: 'red', // Можно заменить на нужный цвет (например, белый или зеленый)
  },
});

export default ScanningOverlay;
