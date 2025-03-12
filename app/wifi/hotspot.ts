// Файл: app/wifi/hotspot.ts

import HotspotManager, { Device, TetheringError, Network } from '@react-native-tethering/hotspot';
import { ToastAndroid } from 'react-native';

export const isHotspotEnabled = async () => {
  try {
    const state = await HotspotManager.isHotspotEnabled();
    ToastAndroid.show(`Hotspot state: ${state}`, ToastAndroid.SHORT);
  } catch (error) {
    if (error instanceof TetheringError) {
      ToastAndroid.show(error.message, ToastAndroid.LONG);
    }
    console.log(error);
  }
};
