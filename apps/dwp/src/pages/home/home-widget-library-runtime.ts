import { HOME_WIDGET_LIBRARY_ENABLED } from '@dwp-frontend/shared-utils';

export function homeWidgetLibraryQueryEnabled(
  legacyHomeEnabled: boolean,
  widgetLibraryEnabled = HOME_WIDGET_LIBRARY_ENABLED
): boolean {
  return legacyHomeEnabled && widgetLibraryEnabled;
}
