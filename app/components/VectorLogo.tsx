import React from 'react';
import { View, Text } from 'react-native';

/**
 * Простая заглушка логотипа для React Native
 */
export const VectorLogo: React.FC<{ width?: number; height?: number }> = ({
  width = 120,
  height = 120,
}) => {
  return (
    <View
      style={{
        width,
        height,
        backgroundColor: '#5a7d2b',
        borderRadius: width / 2,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: 'bold' }}>LOGO</Text>
    </View>
  );
};
