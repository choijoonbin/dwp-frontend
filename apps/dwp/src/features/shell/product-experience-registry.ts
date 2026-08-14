export type ProductExperienceKey = 'hcm' | 'calendar' | 'approvals';

export type ProductExperienceProfile = {
  key: ProductExperienceKey;
  concept: 'people-flow' | 'temporal-flow' | 'decision-flow';
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
} as const satisfies Record<ProductExperienceKey, ProductExperienceProfile>;

export function getProductExperienceProfile(key: ProductExperienceKey): ProductExperienceProfile {
  return productExperienceRegistry[key];
}
