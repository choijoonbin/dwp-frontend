import { describe, expect, it } from 'vitest';

import {
  resolveWave2LoadedFlowEvidence,
  resolveWave2ModePresetEvidence,
  resolveWave2ResourceEvidence,
} from './home-wave2-evidence-adapter';

const params = (value: string) => new URLSearchParams(value);

describe('Wave 2 evidence adapter', () => {
  it.each([
    ['partial', 'handbook', 'DWP_KNOWLEDGE'],
    ['forbidden', 'it', 'DWP_IT_SUPPORT'],
    ['stale', 'workplace', 'DWP_WORKPLACE'],
    ['initial-loading', 'workplace', 'DWP_WORKPLACE'],
    ['background-refresh', 'workplace', 'DWP_WORKPLACE'],
  ] as const)('maps %s to its accepted Classic resource slot', (kind, targetKey, source) => {
    expect(resolveWave2ResourceEvidence(params(`wave2ResourceState=${kind}`))).toMatchObject({
      kind,
      targetKey,
      source,
    });
  });

  it('rejects unknown resource evidence states', () => {
    expect(resolveWave2ResourceEvidence(params('wave2ResourceState=ready'))).toBeUndefined();
    expect(resolveWave2ResourceEvidence(params('wave2ResourceState=invented'))).toBeUndefined();
  });

  it('loads all five governed Flow references only for the explicit evidence request', () => {
    expect(resolveWave2LoadedFlowEvidence(params('wave2FlowState=loaded'))).toEqual({
      'meetings-prep-decisions': 'loaded',
      'space-change-feed': 'loaded',
      'dwaion-artifact': 'loaded',
      'workplace-booking': 'loaded',
      'learning-progress': 'loaded',
    });
    expect(resolveWave2LoadedFlowEvidence(params(''))).toBeUndefined();
  });

  it('exposes the accepted Classic-to-Flow comparison only for its evidence request', () => {
    expect(resolveWave2ModePresetEvidence(params('wave2ModePreset=comparison'))).toEqual({
      currentMode: 'CLASSIC',
      initialSelectedMode: 'FLOW_V1',
    });
    expect(resolveWave2ModePresetEvidence(params(''))).toBeUndefined();
  });
});
