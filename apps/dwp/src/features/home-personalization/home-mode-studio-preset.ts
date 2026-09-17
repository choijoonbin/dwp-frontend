import type { HomeExperienceVariant } from '@dwp-frontend/shared-utils';

import type { HomeModeSharedApp } from './home-mode-preset-comparison';

export interface HomeModeStudioPreset {
  currentMode: HomeExperienceVariant;
  initialSelectedMode: HomeExperienceVariant;
  allowedModes: readonly HomeExperienceVariant[];
  enabledModes?: readonly HomeExperienceVariant[];
  disabledModeReasons?: Partial<Record<HomeExperienceVariant, string>>;
  defaultMode: HomeExperienceVariant;
  sharedAppOrder: readonly HomeModeSharedApp[];
  disabled?: boolean;
  applying?: boolean;
  onApply?: (mode: HomeExperienceVariant) => void | Promise<void>;
}
