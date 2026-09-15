import { describe, expect, it } from 'vitest';

import firstPartyFixture from '../../../../../architecture/widget-registry-native-manifests.v1.json';
import { workspaceWidgetCatalogDefinition } from './workspace-widget-catalog';

describe('first-party widget registry fixture parity', () => {
  it('keeps all seven static bridge definitions aligned with their immutable manifests', () => {
    expect(firstPartyFixture.fixtures).toHaveLength(7);
    firstPartyFixture.fixtures.forEach(({ legacyWidgetKey, manifest }) => {
      const definition = workspaceWidgetCatalogDefinition(legacyWidgetKey);
      expect(definition, legacyWidgetKey).not.toBeNull();
      expect(definition).toMatchObject({
        key: legacyWidgetKey,
        manifestVersion: manifest.schemaVersion,
        ownerProduct: manifest.owner.productKey,
        sourceAppResourceKey: manifest.owner.sourceAppResourceKey,
        analyticsKey: manifest.operations.analyticsKey,
        freshnessSeconds: manifest.operations.freshnessSeconds,
        privacyClass: manifest.privacy.classification,
        retention: manifest.privacy.retention,
        policyClass: manifest.placement.policyClass,
        canHide: manifest.placement.canHide,
        defaultSize: manifest.placement.defaultSize,
        allowedSizes: manifest.placement.allowedSizes,
        defaultHeight: manifest.placement.defaultHeight,
        allowedHeights: manifest.placement.allowedHeights,
        recipientContextBinding: manifest.privacy.recipientContextBinding,
        shareableAsPreset: manifest.sharing.presetEligible,
      });
    });
  });
});
