const configuredApiUrl = import.meta.env.VITE_API_URL || '';

export const API_URL = String(configuredApiUrl).replace(/\/$/, '');

export const WORKSPACE_NAME = String(import.meta.env.VITE_WORKSPACE_NAME || 'DWP Workspace');
