import { describe, expect, it } from 'vitest';

import {
  effectiveSettingLineageLabelKey,
  effectiveSettingSourceLabelKey,
  effectiveSettingValuePresentation,
} from './tenant-governance-evidence-model';

describe('tenant governance effective-setting presentation', () => {
  it('maps only known login and MFA values to normal states', () => {
    expect(
      effectiveSettingValuePresentation('authentication.defaultLoginType', 'LOCAL').labelKey
    ).toContain('.login.LOCAL');
    expect(
      effectiveSettingValuePresentation('authentication.defaultLoginType', 'OIDC').labelKey
    ).toContain('.unknownValue');
    expect(
      effectiveSettingValuePresentation('authentication.requireMfa', false).labelKey
    ).toContain('.optional');
    expect(
      effectiveSettingValuePresentation('authentication.requireMfa', 'false').labelKey
    ).toContain('.unknownValue');
  });

  it('does not mislabel unknown sources or lineage levels as tenant policy', () => {
    expect(effectiveSettingSourceLabelKey('USER')).toContain('.USER');
    expect(effectiveSettingSourceLabelKey('FUTURE_OWNER')).toContain('.UNKNOWN');
    expect(effectiveSettingLineageLabelKey('TENANT')).toContain('.TENANT');
    expect(effectiveSettingLineageLabelKey('FUTURE_OWNER')).toContain('.UNKNOWN');
  });

  it('keeps unsupported locale and invalid duration values unavailable', () => {
    expect(
      effectiveSettingValuePresentation('identity.preferredLocale', 'internal-code').labelKey
    ).toContain('.unknownValue');
    expect(effectiveSettingValuePresentation('authentication.tokenTtlSec', -1).labelKey).toContain(
      '.unknownValue'
    );
  });
});
