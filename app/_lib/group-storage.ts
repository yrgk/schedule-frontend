export const GROUP_STORAGE_KEY = "schedule_group";

function getStorage() {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function readStoredGroup() {
  try {
    return getStorage()?.getItem(GROUP_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function saveStoredGroup(groupId: string) {
  const storage = getStorage();

  if (!storage) {
    return false;
  }

  try {
    storage.setItem(GROUP_STORAGE_KEY, groupId);
    return true;
  } catch {
    return false;
  }
}
