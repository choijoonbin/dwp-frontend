export const HOME_WAVE2_MODE_LAYOUTS = {
  CLASSIC: {
    layoutScope: 'MODE_SCOPED_VIEW',
    deviceClasses: ['DESKTOP_WIDE', 'DESKTOP_STANDARD', 'MOBILE_STANDARD', 'MOBILE_COMPACT'],
  },
  FLOW_V1: {
    layoutScope: 'MODE_SCOPED_VIEW',
    deviceClasses: ['DESKTOP_WIDE', 'DESKTOP_STANDARD', 'MOBILE_STANDARD', 'MOBILE_COMPACT'],
  },
  MZ_V1: {
    layoutScope: 'MODE_SCOPED_VIEW',
    deviceClasses: ['DESKTOP_WIDE', 'DESKTOP_STANDARD', 'MOBILE_STANDARD', 'MOBILE_COMPACT'],
  },
} as const;

export const HOME_WAVE2_FLOW_WIDGETS = [
  { widgetKey: 'command-rail', visible: true, size: 'large', height: 'standard' },
  { widgetKey: 'schedule', visible: true, size: 'compact', height: 'standard' },
  { widgetKey: 'daily-brief', visible: true, size: 'compact', height: 'standard' },
  { widgetKey: 'focus', visible: true, size: 'compact', height: 'standard' },
  { widgetKey: 'activity', visible: false, size: 'compact', height: 'standard' },
  { widgetKey: 'focus-balance', visible: false, size: 'medium', height: 'short' },
  { widgetKey: 'meeting-load', visible: false, size: 'medium', height: 'short' },
] as const;
