// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { fireEvent, getAllByRole, getByRole } from '@testing-library/dom';
import { ThemeProvider } from '@mui/material/styles';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildDwpTheme } from '@dwp-frontend/design-system';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';
import en from '@dwp-frontend/shared-i18n/locales/en/homeStudio.json';
import ko from '@dwp-frontend/shared-i18n/locales/ko/homeStudio.json';

import {
  HomeModePresetComparison,
  type HomeModePresetComparisonProps,
  type HomeModeSharedApp,
} from './home-mode-preset-comparison';

const sharedApps: readonly HomeModeSharedApp[] = Array.from({ length: 18 }, (_, index) => ({
  id: `approved-app-${String(index + 1).padStart(2, '0')}`,
  label: `승인 앱 ${index + 1}`,
}));

const theme = buildDwpTheme({
  mode: 'light',
  density: 'compact',
  highContrast: false,
  reduceMotion: true,
  accentColor: foundationTokens.color.product.primary,
  fontFamily: foundationTokens.font.ui,
});

let root: Root;
let container: HTMLDivElement;

async function render(
  patch: Partial<HomeModePresetComparisonProps> = {},
  locale: 'ko' | 'en' = 'ko'
) {
  const i18n = createInstance();
  await i18n.init({
    lng: locale,
    ns: ['homeStudio'],
    defaultNS: 'homeStudio',
    resources: { ko: { homeStudio: ko }, en: { homeStudio: en } },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  const props: HomeModePresetComparisonProps = {
    currentMode: 'CLASSIC',
    selectedMode: 'FLOW_V1',
    sharedAppOrder: sharedApps,
    dirty: true,
    onSelect: vi.fn(),
    onApply: vi.fn(),
    ...patch,
  };

  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <ThemeProvider theme={theme}>
          <HomeModePresetComparison {...props} />
        </ThemeProvider>
      </I18nextProvider>
    );
  });

  return props;
}

describe('HomeModePresetComparison', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it('separates the applied mode from the selected mode and preserves all 18 locked apps', async () => {
    const props = await render();
    const section = container.querySelector<HTMLElement>('[data-home-mode-preset-comparison]');
    const radios = getAllByRole(container, 'radio') as HTMLInputElement[];

    expect(section?.dataset.currentMode).toBe('CLASSIC');
    expect(section?.dataset.selectedMode).toBe('FLOW_V1');
    expect(section?.dataset.dirty).toBe('true');
    expect(radios).toHaveLength(2);
    expect(radios.every((radio) => radio.type === 'radio')).toBe(true);
    expect(radios[0]?.checked).toBe(false);
    expect(radios[1]?.checked).toBe(true);
    expect(
      container.querySelector('[data-mode-choice="CLASSIC"] [data-current-mode-indicator]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-mode-choice="FLOW_V1"] [data-selected-mode-indicator]')
    ).not.toBeNull();

    const lockedRegion = container.querySelector<HTMLElement>('[data-shared-app-order]');
    expect(lockedRegion?.dataset.sharedAppOrder).toBe(sharedApps.map(({ id }) => id).join(','));
    expect(container.querySelectorAll('[data-shared-app-id]')).toHaveLength(18);
    expect(container.textContent).toContain('공통 앱 18개 순서 잠금');

    const applyButton = getByRole(container, 'button', { name: ko.modePreset.apply });
    expect(applyButton.hasAttribute('disabled')).toBe(false);
    await act(async () => fireEvent.click(applyButton));
    expect(props.onApply).toHaveBeenCalledTimes(1);
  });

  it('keeps apply disabled when the selected mode is already current or the surface is disabled', async () => {
    await render({ selectedMode: 'CLASSIC', dirty: false });

    let applyButton = getByRole(container, 'button', { name: ko.modePreset.apply });
    expect(applyButton.hasAttribute('disabled')).toBe(true);
    expect(
      container.querySelector('[data-home-mode-preset-comparison]')?.getAttribute('data-dirty')
    ).toBe('false');
    expect(getByRole(container, 'status').textContent).toBe(ko.modePreset.status.saved);

    await render({ disabled: true });
    applyButton = getByRole(container, 'button', { name: ko.modePreset.apply });
    expect(applyButton.hasAttribute('disabled')).toBe(true);
    expect(getAllByRole(container, 'radio').every((radio) => radio.hasAttribute('disabled'))).toBe(
      true
    );
    expect(getByRole(container, 'status').textContent).toBe(ko.modePreset.status.disabled);
  });

  it('supports arrow, Home, and End selection with native radio controls', async () => {
    const onSelect = vi.fn();
    await render({ selectedMode: 'CLASSIC', dirty: false, onSelect });
    let group = getByRole(container, 'radiogroup', { name: ko.modePreset.groupLabel });
    let radios = getAllByRole(container, 'radio') as HTMLInputElement[];

    await act(async () => radios[0]?.focus());
    await act(async () => fireEvent.keyDown(group, { key: 'ArrowRight' }));
    expect(onSelect).toHaveBeenLastCalledWith('FLOW_V1');
    expect(document.activeElement).toBe(radios[1]);

    await act(async () => fireEvent.keyDown(group, { key: 'End' }));
    expect(onSelect).toHaveBeenLastCalledWith('FLOW_V1');
    expect(document.activeElement).toBe(radios[1]);

    onSelect.mockClear();
    await render({ selectedMode: 'FLOW_V1', dirty: true, onSelect });
    group = getByRole(container, 'radiogroup', { name: ko.modePreset.groupLabel });
    radios = getAllByRole(container, 'radio') as HTMLInputElement[];
    await act(async () => radios[1]?.focus());
    await act(async () => fireEvent.keyDown(group, { key: 'Home' }));
    expect(onSelect).toHaveBeenLastCalledWith('CLASSIC');
    expect(document.activeElement).toBe(radios[0]);

    const radioTouchTarget = radios[0]?.parentElement;
    expect(Number.parseFloat(getComputedStyle(radioTouchTarget!).minWidth)).toBeGreaterThanOrEqual(
      44
    );
    expect(Number.parseFloat(getComputedStyle(radioTouchTarget!).minHeight)).toBeGreaterThanOrEqual(
      44
    );
  });

  it('announces a controlled applying state without initiating persistence', async () => {
    const props = await render({ applying: true }, 'en');

    expect(getByRole(container, 'status').textContent).toBe(en.modePreset.status.applying);
    expect(
      getByRole(container, 'button', { name: en.modePreset.applying }).hasAttribute('disabled')
    ).toBe(true);
    expect(getAllByRole(container, 'radio').every((radio) => radio.hasAttribute('disabled'))).toBe(
      true
    );
    expect(props.onApply).not.toHaveBeenCalled();
    expect(props.onSelect).not.toHaveBeenCalled();
  });
});
