// Файл: app/wifi/hotspot.ts

import {
  isHotspotEnabled as checkHotspotStatus,
  setHotspotDisabled as disableHotspot,
} from '../services/MessageHandler';

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

export const setHotspotDisabled = async (): Promise<void> => {
  try {
    const result = await disableHotspot();
    console.log('setHotspotDisabled|result=', result);
    // ToastAndroid.show(`setHotspotDisabled state: ${result.state}`, ToastAndroid.SHORT);
  } catch (error) {
    // if (error instanceof TetheringError) {
    //   ToastAndroid.show(error.message, ToastAndroid.LONG);
    // }
    console.error('setHotspotDisabled|error=', error);
  }
};
