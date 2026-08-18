import { describe, expect, it } from 'vitest';

import { WORKSPACE_WIDGET_SIZE_POLICY } from '../../components/workspace-composer/workspace-widget-layout-policy';
import { HOME_WIDGET_KEYS, HOME_WIDGET_REGISTRY } from './home-widget-registry';
import {
  HOME_GOVERNED_ZONE_KEYS,
  HOME_PERSONAL_ZONE_KEYS,
  defaultHomeCompositionPolicy,
  governedHomeZone,
  reconcileHomeCompositionPolicy,
} from './home-composition-policy';

describe('home composition policy', () => {
  it('keeps tenant-governed zones outside personal widget preferences', () => {
    const personalWidgetKeys = new Set<string>(HOME_WIDGET_KEYS);

    expect(HOME_GOVERNED_ZONE_KEYS).toEqual(['announcements']);
    expect(HOME_PERSONAL_ZONE_KEYS).toEqual(['workspace-tools']);
    expect(HOME_GOVERNED_ZONE_KEYS.filter((key) => personalWidgetKeys.has(key))).toEqual([]);
    expect(personalWidgetKeys.has('command-rail')).toBe(true);
  });

  it('defaults announcements and the personal command rail to a one-third/two-thirds row', () => {
    const policy = defaultHomeCompositionPolicy();
    const announcements = governedHomeZone(policy, 'announcements');
    const commandRail = HOME_WIDGET_REGISTRY.find((widget) => widget.key === 'command-rail');

    expect(WORKSPACE_WIDGET_SIZE_POLICY[announcements.size].lg).toBe(20);
    expect(WORKSPACE_WIDGET_SIZE_POLICY[commandRail!.defaultSize].lg).toBe(40);
    expect(announcements.height).toBe('short');
    expect(commandRail!.defaultHeight).toBe('short');
  });

  it('reconciles malformed client data back to the versioned governed contract', () => {
    const policy = reconcileHomeCompositionPolicy({
      schemaVersion: 99,
      personalCustomizationEnabled: false,
      governedZones: [
        {
          zoneKey: 'announcements',
          placement: 'HERO',
          visible: false,
          size: 'fifth',
          height: 'expanded',
          sortOrder: -1,
        },
        { zoneKey: 'unknown', visible: true, size: 'full', sortOrder: 1 },
      ],
    });

    expect(policy.schemaVersion).toBe(2);
    expect(policy.personalCustomizationEnabled).toBe(false);
    expect(governedHomeZone(policy, 'announcements')).toMatchObject({
      placement: 'CANVAS',
      visible: false,
      size: 'compact',
      height: 'short',
      sortOrder: 20,
    });
    expect(policy.governedZones).toHaveLength(1);
  });

  it('fails closed when the tenant policy is missing or omits the personal switch', () => {
    expect(reconcileHomeCompositionPolicy(undefined).personalCustomizationEnabled).toBe(false);
    expect(
      reconcileHomeCompositionPolicy({ schemaVersion: 2, governedZones: [] })
        .personalCustomizationEnabled
    ).toBe(false);
  });
});
