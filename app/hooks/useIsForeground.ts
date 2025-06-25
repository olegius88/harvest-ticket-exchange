import { useEffect, useState, useRef } from 'react';
import type { AppStateStatus } from 'react-native';
import { AppState } from 'react-native';

export const useIsForeground = (): boolean => {
  const [isForeground, setIsForeground] = useState(true);
  const listenerRef = useRef<any>(null);

  useEffect(() => {
    const onChange = (state: AppStateStatus): void => {
      setIsForeground(state === 'active');
    };

    // Удаляем предыдущий слушатель, если он существует
    if (listenerRef.current?.remove) {
      listenerRef.current.remove();
    }

    // Создаем новый слушатель
    listenerRef.current = AppState.addEventListener('change', onChange);

    return () => {
      // Очищаем слушатель при размонтировании
      if (listenerRef.current?.remove) {
        listenerRef.current.remove();
        listenerRef.current = null;
      }
    };
  }, []);

  return isForeground;
};
