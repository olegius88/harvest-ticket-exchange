// Файл: app/wifi/hotspot.ts

import HotspotManager, { Network } from '@react-native-tethering/hotspot';
import { isHotspotEnabled as checkHotspotStatus } from '../services/MessageHandler';

export const isHotspotEnabled = async () => {
  try {
    const result = await checkHotspotStatus();
    console.log('isHotspotEnabled|state=', result.status);
    // ToastAndroid.show(`isHotspotEnabled state: ${state}`, ToastAndroid.SHORT);
    return result.status === 'running';
  } catch (error) {
    // if (error instanceof TetheringError) {
    //   ToastAndroid.show(error.message, ToastAndroid.LONG);
    // }
    console.error('isHotspotEnabled|error=', error);
    return false;
  }
};

export const setHotspotEnabled = async (): Promise<Network> => {
  return HotspotManager.setLocalHotspotEnabled(true);
};

export const setHotspotDisabled = async (): Promise<void> => {
  try {
    const state = await HotspotManager.setLocalHotspotEnabled(false);
    console.log('setHotspotDisabled|state=', state);
    // ToastAndroid.show(`setHotspotDisabled state: ${state}`, ToastAndroid.SHORT);
  } catch (error) {
    // if (error instanceof TetheringError) {
    //   ToastAndroid.show(error.message, ToastAndroid.LONG);
    // }
    console.error('setHotspotDisabled|error=', error);
  }
};
