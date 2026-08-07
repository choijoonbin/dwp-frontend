import '@dwp-frontend/design-system/styles/global.css';

import { useEffect } from 'react';
import { DwpThemeProvider, useAppearance } from '@dwp-frontend/design-system';

import type { Decorator, Preview } from '@storybook/react-vite';
import type { DensityPreference, ColorModePreference } from '@dwp-frontend/design-system';

type FoundationStateProps = {
  mode: ColorModePreference;
  density: DensityPreference;
  highContrast: boolean;
  children: React.ReactNode;
};

function FoundationState({ mode, density, highContrast, children }: FoundationStateProps) {
  const { setMode, setDensity, setHighContrast } = useAppearance();

  useEffect(() => setMode(mode), [mode, setMode]);
  useEffect(() => setDensity(density), [density, setDensity]);
  useEffect(() => setHighContrast(highContrast), [highContrast, setHighContrast]);

  return children;
}

const withDwpFoundation: Decorator = (Story, context) => {
  const mode: ColorModePreference = context.globals.theme === 'dark' ? 'dark' : 'light';
  const density: DensityPreference = context.globals.density || 'standard';
  const highContrast = context.globals.contrast === 'high';

  return (
    <DwpThemeProvider>
      <FoundationState mode={mode} density={density} highContrast={highContrast}>
        <Story />
      </FoundationState>
    </DwpThemeProvider>
  );
};

const preview: Preview = {
  decorators: [withDwpFoundation],
  globalTypes: {
    theme: {
      description: 'Color mode',
      defaultValue: 'light',
      toolbar: {
        icon: 'contrast',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
      },
    },
    density: {
      description: 'Interface density',
      defaultValue: 'standard',
      toolbar: {
        icon: 'component',
        items: [
          { value: 'compact', title: 'Compact' },
          { value: 'standard', title: 'Standard' },
          { value: 'comfortable', title: 'Comfortable' },
        ],
      },
    },
    contrast: {
      description: 'Contrast level',
      defaultValue: 'standard',
      toolbar: {
        icon: 'eye',
        items: [
          { value: 'standard', title: 'Standard' },
          { value: 'high', title: 'High contrast' },
        ],
      },
    },
  },
  parameters: {
    a11y: { test: 'error' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
