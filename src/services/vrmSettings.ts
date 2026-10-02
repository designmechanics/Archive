export type MannequinType = '12point' | 'default' | 'custom';

export interface VRMSettings {
  mannequinType: MannequinType;
  customMannequinUrl: string | null;
  customMannequinName: string | null;
  autoRotate: boolean;
  showGrid: boolean;
  wireframe: boolean;
  springBones: boolean;
  playbackSpeed: number;
  environment: 'blueprint' | 'black' | 'studio' | 'slate';
}

const STORAGE_KEY = 'archive_3d_vrm_settings';

export const DEFAULT_VRM_SETTINGS: VRMSettings = {
  mannequinType: '12point',
  customMannequinUrl: null,
  customMannequinName: null,
  autoRotate: false,
  showGrid: true,
  wireframe: false,
  springBones: true,
  playbackSpeed: 1,
  environment: 'blueprint'
};

export const DEFAULT_AVATAR_URL = '/models/default_avatar.vrm';
export const DEFAULT_AVATAR_NAME = 'Seed-san (VRM Consortium Reference)';

export function getVRMSettings(): VRMSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VRM_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_VRM_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_VRM_SETTINGS };
  }
}

export function saveVRMSettings(updates: Partial<VRMSettings>): VRMSettings {
  const current = getVRMSettings();
  const next = { ...current, ...updates };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('archive-vrm-settings-changed', { detail: next }));
  } catch (err) {
    console.error('Failed to save 3D/VRM settings to localStorage:', err);
  }
  return next;
}

export function setMannequinType(mannequinType: MannequinType): VRMSettings {
  return saveVRMSettings({ mannequinType });
}

export function setCustomVRMMannequin(url: string, name: string): VRMSettings {
  return saveVRMSettings({
    mannequinType: 'custom',
    customMannequinUrl: url,
    customMannequinName: name
  });
}

export function resetVRMMannequinToDefault(): VRMSettings {
  return saveVRMSettings({
    mannequinType: '12point',
    customMannequinUrl: null,
    customMannequinName: null
  });
}
