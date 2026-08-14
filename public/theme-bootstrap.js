(() => {
  const key = 'dwp.appearance.v1';
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  let requestedMode = 'system';

  try {
    const preference = JSON.parse(window.localStorage.getItem(key) || '{}');
    if (['system', 'light', 'dark'].includes(preference.mode)) requestedMode = preference.mode;
  } catch {
    requestedMode = 'system';
  }

  const resolvedMode =
    requestedMode === 'system' ? (systemDark ? 'dark' : 'light') : requestedMode;
  document.documentElement.dataset.colorScheme = resolvedMode;
})();
