import { describe, expect, it } from 'vitest';

import enHcm from '../../../../../../libs/shared-i18n/src/locales/en/hcm.json';
import koHcm from '../../../../../../libs/shared-i18n/src/locales/ko/hcm.json';
import { HRIS_IA_CONTRACT_NODES } from '../shell/model/hris-information-architecture.generated';

describe('Work Explorer canonical labels', () => {
  it('provides one explicit Korean and English label for each canonical IA identity', () => {
    const expectedKeys = HRIS_IA_CONTRACT_NODES.map((node) =>
      node.sourceNodeKey.replaceAll('.', '-')
    );
    const en = enHcm.hris.explorer.routes;
    const ko = koHcm.hris.explorer.routes;

    expect(HRIS_IA_CONTRACT_NODES).toHaveLength(98);
    expect(Object.keys(en).sort()).toEqual([...expectedKeys].sort());
    expect(Object.keys(ko).sort()).toEqual([...expectedKeys].sort());
    for (const key of expectedKeys) {
      expect(en[key as keyof typeof en], `missing English ${key}`).toBeTruthy();
      expect(ko[key as keyof typeof ko], `missing Korean ${key}`).toBeTruthy();
      expect(en[key as keyof typeof en]).not.toContain('hris.explorer.routes.');
      expect(ko[key as keyof typeof ko]).not.toContain('hris.explorer.routes.');
    }
  });

  it('keeps the canonical route and label-key transformation collision free', () => {
    const suffixes = HRIS_IA_CONTRACT_NODES.map((node) => node.sourceNodeKey.replaceAll('.', '-'));
    const routeKeys = suffixes.map((suffix) => `hris.explorer.${suffix}`);
    const labelKeys = suffixes.map((suffix) => `hris.explorer.routes.${suffix}`);
    expect(new Set(routeKeys).size).toBe(98);
    expect(new Set(labelKeys).size).toBe(98);
  });

  it('keeps the actual longest catalog labels explicit for narrow-layout evidence', () => {
    const longest = (labels: Record<string, string>) =>
      Object.entries(labels).sort(
        ([leftKey, left], [rightKey, right]) =>
          Array.from(right).length - Array.from(left).length || leftKey.localeCompare(rightKey)
      )[0];

    expect(longest(enHcm.hris.explorer.routes)).toEqual([
      'dwp-extensibility',
      'Extensibility · extension control',
    ]);
    expect(
      Object.entries(koHcm.hris.explorer.routes)
        .filter(([, label]) => Array.from(label).length === 22)
        .map(([key]) => key)
    ).toEqual(expect.arrayContaining(['dwp-integrations', 'dwp-extensibility']));
  });
});
