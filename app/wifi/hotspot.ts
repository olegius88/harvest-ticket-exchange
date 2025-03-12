// Файл: app/wifi/hotspot.ts

import HotspotManager, { Device, TetheringError, Network } from '@react-native-tethering/hotspot';
import { ToastAndroid } from 'react-native';

export const isHotspotEnabled = async () => {
  try {
    const state = await HotspotManager.isHotspotEnabled();
    ToastAndroid.show(`isHotspotEnabled state: ${state}`, ToastAndroid.SHORT);
    return state;
  } catch (error) {
    if (error instanceof TetheringError) {
      ToastAndroid.show(error.message, ToastAndroid.LONG);
    }
    console.log(error);
  }
};

export const setHotspotEnabled = async () => {
  try {
    const state = await HotspotManager.setLocalHotspotEnabled(true);
    ToastAndroid.show(`setHotspotEnabled state: ${state}`, ToastAndroid.SHORT);
    return state;
  } catch (error) {
    if (error instanceof TetheringError) {
      ToastAndroid.show(error.message, ToastAndroid.LONG);
    }
    console.log(error);
  }
};

export const setHotspotDisabled = async () => {
  try {
    const state = await HotspotManager.setLocalHotspotEnabled(false);
    ToastAndroid.show(`setHotspotDisabled state: ${state}`, ToastAndroid.SHORT);
    return state;
  } catch (error) {
    if (error instanceof TetheringError) {
      ToastAndroid.show(error.message, ToastAndroid.LONG);
    }
    console.log(error);
  }
};
