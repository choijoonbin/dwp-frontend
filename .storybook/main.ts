import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vite';

import type { StorybookConfig } from '@storybook/react-vite';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(configDirectory, '..');

const config: StorybookConfig = {
  stories: ['../libs/design-system/src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    defaultName: 'Documentation',
  },
  async viteFinal(currentConfig) {
    return mergeConfig(currentConfig, {
      resolve: {
        alias: {
          '@dwp-frontend/design-system': path.resolve(workspaceRoot, 'libs/design-system/src'),
          '@dwp-frontend/shared-utils': path.resolve(workspaceRoot, 'libs/shared-utils/src'),
          '@dwp-frontend/shared-i18n': path.resolve(workspaceRoot, 'libs/shared-i18n/src'),
        },
      },
    });
  },
};

export default config;
