import { describe, expect, it } from 'vitest';

import firstPartyFixture from '../../../../../architecture/widget-registry-native-manifests.v1.json';
import { workspaceWidgetCatalogDefinition } from './workspace-widget-catalog';

describe('first-party widget registry fixture parity', () => {
  it('keeps shared identity, geometry, configuration, and privacy aligned with the manifests', () => {
    expect(firstPartyFixture.fixtures).toHaveLength(7);
    firstPartyFixture.fixtures.forEach(({ legacyWidgetKey, manifest }) => {
      const definition = workspaceWidgetCatalogDefinition(legacyWidgetKey);
      expect(definition, legacyWidgetKey).not.toBeNull();
      expect(definition).toMatchObject({
        key: legacyWidgetKey,
        manifestVersion: manifest.schemaVersion,
        analyticsKey: manifest.operations.analyticsKey,
        freshnessSeconds: manifest.operations.freshnessSeconds,
        privacyClass: manifest.privacy.classification,
        retention: manifest.privacy.retention,
        canHide: manifest.placement.canHide,
        defaultSize: manifest.placement.defaultSize,
        allowedSizes: manifest.placement.allowedSizes,
        defaultHeight: manifest.placement.defaultHeight,
        allowedHeights: manifest.placement.allowedHeights,
        recipientContextBinding: manifest.privacy.recipientContextBinding,
        configuration: manifest.configurationContract,
      });
    });
  });

  it('records the exact legacy static differences without applying shadow metadata to Home', () => {
    const differences = firstPartyFixture.fixtures.flatMap(({ legacyWidgetKey, manifest }) => {
      const definition = workspaceWidgetCatalogDefinition(legacyWidgetKey)!;
      const staticMetadata = {
        ownerProduct: definition.ownerProduct,
        sourceAppResourceKey: definition.sourceAppResourceKey,
        policyClass: definition.policyClass,
        shareableAsPreset: definition.shareableAsPreset,
      };
      const controlPlaneMetadata = {
        ownerProduct: manifest.owner.productKey,
        sourceAppResourceKey: manifest.owner.sourceAppResourceKey,
        policyClass: manifest.placement.policyClass,
        shareableAsPreset: manifest.sharing.presetEligible,
      };
      return (Object.keys(staticMetadata) as Array<keyof typeof staticMetadata>).flatMap((field) =>
        staticMetadata[field] === controlPlaneMetadata[field]
          ? []
          : [
              {
                key: legacyWidgetKey,
                field,
                static: staticMetadata[field],
                shadow: controlPlaneMetadata[field],
              },
            ]
      );
    });

    expect(differences).toEqual([
      { key: 'command-rail', field: 'policyClass', static: 'PERSONAL', shadow: 'GOVERNED' },
      { key: 'focus-balance', field: 'ownerProduct', static: 'core.calendar', shadow: 'core.work' },
      {
        key: 'focus-balance',
        field: 'sourceAppResourceKey',
        static: 'APP.CALENDAR',
        shadow: 'APP.WORK',
      },
      { key: 'focus-balance', field: 'shareableAsPreset', static: false, shadow: true },
      { key: 'meeting-load', field: 'shareableAsPreset', static: false, shadow: true },
    ]);
  });
});
