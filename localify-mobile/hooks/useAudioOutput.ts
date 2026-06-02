import { useEffect, useState, useCallback } from 'react';
import { getCurrentOutputDeviceName, getCurrentOutputDeviceType, showRoutePicker } from '../modules/audio-route/src';

export interface AudioDeviceInfo {
  name: string;
  type: 'speaker' | 'headphones' | 'bluetooth' | 'airplay' | 'hdmi' | 'lineout' | 'earpiece' | 'usb' | 'other';
}

export function useAudioOutput() {
  const [device, setDevice] = useState<AudioDeviceInfo>({ name: 'Speaker', type: 'speaker' });

  const refresh = useCallback(async () => {
    try {
      const [name, type] = await Promise.all([
        getCurrentOutputDeviceName(),
        getCurrentOutputDeviceType(),
      ]);
      setDevice({ name, type: type as AudioDeviceInfo['type'] });
    } catch {
      // Native module not available (web or error)
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const openRoutePicker = useCallback(() => {
    try {
      showRoutePicker();
    } catch {
      // Native module not available
    }
  }, []);

  return { device, openRoutePicker };
}
