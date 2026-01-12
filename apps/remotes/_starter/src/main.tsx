import '@dwp-frontend/design-system/styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@dwp-frontend/design-system';

import { Entry } from './entry';

// ----------------------------------------------------------------------

const root = createRoot(document.getElementById('root')!);

root.render(
  <StrictMode>
    <ThemeProvider>
      <Entry />
    </ThemeProvider>
  </StrictMode>
);
