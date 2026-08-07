const configuredApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const API_URL = String(configuredApiUrl).replace(/\/$/, '');
