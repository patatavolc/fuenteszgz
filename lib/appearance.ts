export type AppearancePreference = "system" | "light" | "dark";

const STORAGE_KEY = "fuenteszgz:appearance:v1";
const validPreferences: AppearancePreference[] = ["system", "light", "dark"];
type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;

export function getAppearancePreference(storage: PreferenceStorage = localStorage): AppearancePreference {
  try {
    const value = storage.getItem(STORAGE_KEY);
    return validPreferences.includes(value as AppearancePreference) ? value as AppearancePreference : "system";
  } catch {
    return "system";
  }
}

export function saveAppearancePreference(preference: AppearancePreference, storage: PreferenceStorage = localStorage) {
  try {
    storage.setItem(STORAGE_KEY, preference);
  } catch {
    // Appearance still changes for this session when local storage is unavailable.
  }
}
