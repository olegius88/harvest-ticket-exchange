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
      <Svg width={width} height={height} viewBox="0 0 200 200">
        {/* Левый (темно-зеленый) лист */}
        <Path d="M80,40 Q120,100 80,160" fill="#5a7d2b" fillRule="evenodd" />
        {/* Средний (светло-зеленый) лист */}
        <Path d="M100,30 Q140,100 100,170" fill="#98d642" fillRule="evenodd" />
        {/* Правый (ярко-зеленый) лист */}
        <Path d="M120,40 Q160,100 120,160" fill="#b5e878" fillRule="evenodd" />
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
