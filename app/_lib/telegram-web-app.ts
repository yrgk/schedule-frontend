export type HapticStyle = "light" | "medium" | "heavy" | "rigid" | "soft";

type CloudStorage = Readonly<{
  getItem: (
    key: string,
    callback: (error: string | null, value: string | null) => void,
  ) => void;
  setItem: (
    key: string,
    value: string,
    callback?: (error: string | null, success: boolean) => void,
  ) => void;
}>;

type TelegramWebApp = Readonly<{
  CloudStorage?: CloudStorage;
  HapticFeedback?: {
    impactOccurred: (style: HapticStyle) => void;
  };
  isVersionAtLeast?: (version: string) => boolean;
  ready?: () => void;
}>;

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export const GROUP_STORAGE_KEY = "schedule_group";

function getWebApp() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.Telegram?.WebApp;
}

export function prepareTelegramWebApp() {
  getWebApp()?.ready?.();
}

export function impactOccurred(style: HapticStyle) {
  getWebApp()?.HapticFeedback?.impactOccurred(style);
}

export function readStoredGroup() {
  const webApp = getWebApp();
  const cloudStorage = webApp?.CloudStorage;

  if (!cloudStorage || webApp.isVersionAtLeast?.("6.9") === false) {
    return Promise.resolve<string | null>(null);
  }

  return new Promise<string | null>((resolve) => {
    try {
      cloudStorage.getItem(GROUP_STORAGE_KEY, (error, value) => {
        resolve(error ? null : value);
      });
    } catch {
      resolve(null);
    }
  });
}

export function saveStoredGroup(groupId: string) {
  const webApp = getWebApp();
  const cloudStorage = webApp?.CloudStorage;

  if (!cloudStorage || webApp.isVersionAtLeast?.("6.9") === false) {
    return Promise.resolve(false);
  }

  return new Promise<boolean>((resolve) => {
    try {
      cloudStorage.setItem(GROUP_STORAGE_KEY, groupId, (error, success) => {
        resolve(!error && success);
      });
    } catch {
      resolve(false);
    }
  });
}
