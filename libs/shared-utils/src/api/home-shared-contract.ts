export const HOME_EXPERIENCE_VARIANTS = ['CLASSIC', 'FLOW_V1', 'MZ_V1'] as const;
export type HomeExperienceVariant = (typeof HOME_EXPERIENCE_VARIANTS)[number];
export type HomeWidgetHeight = 'short' | 'standard' | 'tall' | 'expanded';
