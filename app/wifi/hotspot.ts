// Файл: app/wifi/hotspot.ts

import HotspotManager, { Network } from '@react-native-tethering/hotspot';

export const isHotspotEnabled = async () => {
  try {
    const state = await HotspotManager.isHotspotEnabled();
    console.log('isHotspotEnabled|state=', state);
    // ToastAndroid.show(`isHotspotEnabled state: ${state}`, ToastAndroid.SHORT);
    return state;
  } catch (error) {
    // if (error instanceof TetheringError) {
    //   ToastAndroid.show(error.message, ToastAndroid.LONG);
    // }
    console.error('isHotspotEnabled|error=', error);
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
