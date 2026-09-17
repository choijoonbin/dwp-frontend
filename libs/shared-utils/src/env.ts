const configuredApiUrl = import.meta.env.VITE_API_URL || '';

export const API_URL = String(configuredApiUrl).replace(/\/$/, '');

export const WORKSPACE_NAME = String(import.meta.env.VITE_WORKSPACE_NAME || 'DWP Workspace');

export const DWAION_ATTACHMENT_UPLOAD_ORIGINS = String(
  import.meta.env.VITE_DWAION_ATTACHMENT_UPLOAD_ORIGINS || ''
)
  .split(',')
  .map((value) => value.trim())
  .filter((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.origin === value.replace(/\/$/u, '');
    } catch {
      return false;
    }
  });

export const HOME_PERSONALIZATION_V2_ENABLED =
  String(import.meta.env.VITE_HOME_PERSONALIZATION_V2_ENABLED || 'false').toLowerCase() === 'true';

export const HOME_WIDGET_LIBRARY_ENABLED =
  String(import.meta.env.VITE_HOME_WIDGET_LIBRARY_ENABLED || 'false').toLowerCase() === 'true';
