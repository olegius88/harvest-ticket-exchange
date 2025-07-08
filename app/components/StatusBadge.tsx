import React from 'react';
import { Text, View, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { getReadableStatus, getStatusColor } from '../utils/statusUtils';

interface StatusBadgeProps {
  status: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
  showBackground?: boolean;
}

/**
 * Компонент для отображения статуса с правильным цветом и читаемым текстом
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  style,
  textStyle,
  showBackground = false,
}) => {
  const statusColor = getStatusColor(status);
  const readableStatus = getReadableStatus(status);

  if (showBackground) {
    return (
      <View
        style={[
          styles.badge,
          { backgroundColor: statusColor + '20', borderColor: statusColor },
          style,
        ]}
      >
        <Text style={[styles.badgeText, { color: statusColor }, textStyle]}>{readableStatus}</Text>
      </View>
    );
  }

  return <Text style={[{ color: statusColor }, textStyle]}>{readableStatus}</Text>;
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default StatusBadge;
