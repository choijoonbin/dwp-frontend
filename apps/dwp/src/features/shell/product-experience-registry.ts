export type ProductExperienceKey =
  | 'hcm'
  | 'calendar'
  | 'rooms'
  | 'approvals'
  | 'mail'
  | 'messaging'
  | 'notifications'
  | 'spaces';

export type ProductExperienceProfile = {
  key: ProductExperienceKey;
  concept:
    | 'people-flow'
    | 'temporal-flow'
    | 'resource-flow'
    | 'decision-flow'
    | 'communication-flow'
    | 'conversation-flow'
    | 'collaboration-flow'
    | 'attention-flow';
  density: 'comfortable' | 'standard';
  accent: string;
  secondary: string;
  softSurface: string;
  canvas: string;
  sidebar: string;
  selection: string;
};

export const productExperienceRegistry = {
  hcm: {
    key: 'hcm',
    concept: 'people-flow',
    density: 'comfortable',
    accent: '#11756D',
    secondary: '#C94F68',
    softSurface: '#E7F4F1',
    canvas: '#F5F8F7',
    sidebar: '#FBFCFC',
    selection: '#E3F1EE',
  },
  calendar: {
    key: 'calendar',
    concept: 'temporal-flow',
    density: 'standard',
    accent: '#2764C4',
    secondary: '#008C95',
    softSurface: '#EAF2FF',
    canvas: '#F5F7FB',
    sidebar: '#FAFBFD',
    selection: '#E7EFFC',
  },
  rooms: {
    key: 'rooms',
    concept: 'resource-flow',
    density: 'standard',
    accent: '#176F6A',
    secondary: '#B24F5E',
    softSurface: '#E5F3F0',
    canvas: '#F5F8F8',
    sidebar: '#FBFCFC',
    selection: '#E1F0ED',
  },
  mail: {
    key: 'mail',
    concept: 'communication-flow',
    density: 'standard',
    accent: '#176B63',
    secondary: '#C24E63',
    softSurface: '#E5F3F0',
    canvas: '#F5F8F8',
    sidebar: '#FBFCFC',
    selection: '#E1F0ED',
  },
  messaging: {
    key: 'messaging',
    concept: 'conversation-flow',
    density: 'standard',
    accent: '#2856C7',
    secondary: '#0F8B8D',
    softSurface: '#E8F0FF',
    canvas: '#F6F8FC',
    sidebar: '#FBFCFF',
    selection: '#E8EFFD',
  },
  notifications: {
    key: 'notifications',
    concept: 'attention-flow',
    density: 'standard',
    accent: '#245B78',
    secondary: '#B3533E',
    softSurface: '#E8F1F4',
    canvas: '#F5F8F9',
    sidebar: '#FBFCFC',
    selection: '#E4EEF2',
  },
  approvals: {
    key: 'approvals',
    concept: 'decision-flow',
    density: 'standard',
    accent: '#28517A',
    secondary: '#B66A0A',
    softSurface: '#EAF0F5',
    canvas: '#F7F7F5',
    sidebar: '#FCFCFB',
    selection: '#E7EDF2',
  },
  spaces: {
    key: 'spaces',
    concept: 'collaboration-flow',
    density: 'comfortable',
    accent: '#315B7A',
    secondary: '#C0524F',
    softSurface: '#E8F0F4',
    canvas: '#F5F7F7',
    sidebar: '#FBFCFC',
    selection: '#E5EDF2',
  },
} as const satisfies Record<ProductExperienceKey, ProductExperienceProfile>;

export function getProductExperienceProfile(key: ProductExperienceKey): ProductExperienceProfile {
  return productExperienceRegistry[key];
}
