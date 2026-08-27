const configuredApiUrl = import.meta.env.VITE_API_URL || '';

export const API_URL = String(configuredApiUrl).replace(/\/$/, '');

export const WORKSPACE_NAME = String(import.meta.env.VITE_WORKSPACE_NAME || 'DWP Workspace');

export const HOME_PERSONALIZATION_V2_ENABLED =
  String(import.meta.env.VITE_HOME_PERSONALIZATION_V2_ENABLED || 'false').toLowerCase() === 'true';

export const HOME_WIDGET_LIBRARY_ENABLED =
  String(import.meta.env.VITE_HOME_WIDGET_LIBRARY_ENABLED || 'false').toLowerCase() === 'true';
