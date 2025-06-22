import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * Векторный логотип для React Native приложения
 */
export const VectorLogo: React.FC<{ width?: number; height?: number }> = ({
  width = 120,
  height = 120,
}) => {
  return (
    <View style={styles.container}>
      <Svg width={width} height={height} viewBox="0 0 200 200" fill="none">
        <Path fill="#98d642" d="M100,10 C130,50 140,100 100,190 C60,100 70,50 100,10 Z" />
        <Path fill="#7ebc2b" d="M80,20 C110,60 120,110 80,190 C40,110 50,60 80,20 Z" />
        <Path fill="#5a7d2b" d="M60,30 C90,70 100,120 60,190 C20,120 30,70 60,30 Z" />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
