import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import goldenFixture from '../../../../../docs/05-features/DWP-R1-ADM-009-widget-ecosystem-governance/fixtures/widget-manifests.v1.golden.json';
import firstPartyFixture from '../../../../../architecture/widget-registry-native-manifests.v1.json';
import { workspaceWidgetCatalogDefinition } from './workspace-widget-catalog';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

describe('first-party widget registry fixture parity', () => {
  it('keeps the complete native manifest semantics aligned with the static catalog', () => {
    expect(firstPartyFixture.fixtureVersion).toBe(3);
    expect(firstPartyFixture.fixtures).toHaveLength(7);
    firstPartyFixture.fixtures.forEach(({ legacyWidgetKey, manifest }) => {
      const definition = workspaceWidgetCatalogDefinition(legacyWidgetKey)!;
      expect(manifest, legacyWidgetKey).toEqual({
        schemaVersion: definition.manifestVersion,
        definitionKey: expect.any(String),
        owner: {
          productKey: definition.ownerProduct,
          sourceAppResourceKey: definition.sourceAppResourceKey,
        },
        renderer: {
          kind: definition.runtime,
          rendererKey: `home.${definition.key}`,
          minimumHostApiVersion: 1,
        },
        supportedSurfaces: ['workspace-home'],
        requiredAuthorities: definition.requiredAuthorities,
        placement: {
          supportedContexts: definition.supportedContexts,
          policyClass: definition.policyClass,
          canHide: definition.canHide,
          defaultSize: definition.defaultSize,
          allowedSizes: definition.allowedSizes,
          defaultHeight: definition.defaultHeight,
          allowedHeights: definition.allowedHeights,
        },
        configurationContract: definition.configuration,
        dataCapabilities: definition.dataCapabilities,
        actionCapabilities: [],
        sharing: { presetEligible: definition.shareableAsPreset },
        operations: {
          analyticsKey: definition.analyticsKey,
          freshnessSeconds: definition.freshnessSeconds,
        },
        privacy: {
          classification: definition.privacyClass,
          retention: definition.retention,
          recipientContextBinding: definition.recipientContextBinding,
        },
      });
    });
  });

  it('preserves exact parity with all five resealed ADM-009 golden manifests', () => {
    expect(firstPartyFixture.sourceGoldenFixture.exactFixtureCount).toBe(5);
    for (const fixture of goldenFixture.fixtures) {
      const native = firstPartyFixture.fixtures.find((candidate) => candidate.legacyWidgetKey === fixture.legacyWidgetKey)!;
      expect(native.manifest).toEqual(fixture.manifest);
      expect(native.expectedSha256).toBe(fixture.expectedSha256);
      expect(native.semanticVersion).toBe('semanticVersion' in fixture ? fixture.semanticVersion : '1.0.0');
    }
  });

  it('verifies every complete manifest digest and the versioned fixture semantic digest', () => {
    firstPartyFixture.fixtures.forEach(({ manifest, expectedSha256, legacyWidgetKey, semanticVersion }) => {
      expect(createHash('sha256').update(canonical(manifest)).digest('hex'), legacyWidgetKey)
        .toBe(expectedSha256);
      expect(semanticVersion).toBe(
        ['command-rail', 'focus-balance', 'meeting-load'].includes(legacyWidgetKey) ? '1.0.1' : '1.0.0'
      );
    });
    expect(createHash('sha256').update(`${canonical(firstPartyFixture)}\n`).digest('hex'))
      .toBe('3838b553235923be694a1a334bd6652abe9cb380603293dd4c6bd15337f5732e');
  });
});
