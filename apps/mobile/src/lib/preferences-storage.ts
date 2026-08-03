import * as SecureStore from 'expo-secure-store';

export function getPreference(key: string) {
  return SecureStore.getItem(key);
}

export function setPreference(key: string, value: string) {
  SecureStore.setItem(key, value);
}
