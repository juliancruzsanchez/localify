import { requireNativeModule } from 'expo-modules-core';

let AudioRoute: any = null;
try {
  AudioRoute = requireNativeModule('AudioRoute');
} catch {
  // Native module not available (web or dev)
}

export function getCurrentOutputDeviceName(): Promise<string> {
  if (!AudioRoute) return Promise.resolve('Speaker');
  return AudioRoute.getCurrentOutputDeviceName();
}

export function getCurrentOutputDeviceType(): Promise<string> {
  if (!AudioRoute) return Promise.resolve('speaker');
  return AudioRoute.getCurrentOutputDeviceType();
}

export function showRoutePicker(): void {
  AudioRoute?.showRoutePicker();
}
