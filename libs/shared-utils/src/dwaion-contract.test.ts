import { describe, expect, it } from 'vitest';

import {
  DWAION_APPROVAL_EXPERT_AGENT_KEY,
  dwaionWorkspaceRoute,
  resolveDwaionAgentKey,
} from './dwaion-contract';

describe('dwaion contract', () => {
  it('opens an existing conversation without resubmitting its latest question', () => {
    expect(dwaionWorkspaceRoute('repeat this question', 'conversation-1')).toBe(
      '/dwaion?conversation=conversation-1'
    );
  });

  it('preserves a new question when no conversation exists', () => {
    expect(dwaionWorkspaceRoute('today priorities')).toBe('/dwaion?q=today+priorities');
  });

  it('adds the specialist agent only when explicitly selected', () => {
    expect(dwaionWorkspaceRoute(undefined, undefined, DWAION_APPROVAL_EXPERT_AGENT_KEY)).toBe(
      '/dwaion?agent=DWP_APPROVAL_EXPERT'
    );
    expect(resolveDwaionAgentKey('dwp_approval_expert')).toBe(DWAION_APPROVAL_EXPERT_AGENT_KEY);
  });
});
