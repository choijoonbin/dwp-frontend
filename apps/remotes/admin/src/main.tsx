import '@dwp-frontend/design-system/styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@dwp-frontend/design-system';

import { AdminApp } from './admin-app';

// ----------------------------------------------------------------------

const root = createRoot(document.getElementById('root')!);

root.render(
  <StrictMode>
    <ThemeProvider>
      <AdminApp standalone />
    </ThemeProvider>
  </StrictMode>
);
