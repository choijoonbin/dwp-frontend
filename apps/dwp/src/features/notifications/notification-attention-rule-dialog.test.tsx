// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationAttentionRuleDialog } from './notification-attention-rule-dialog';

import type { NotificationAttentionRule } from '@dwp-frontend/shared-utils/api/notification-attention-api';

vi.mock('@mui/material/useMediaQuery', () => ({ default: () => false }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'actions.cancel': 'Cancel',
        'actions.save': 'Save',
        'attention.dialog.createTitle': 'Create attention rule',
        'attention.dialog.editTitle': 'Edit attention rule',
        'attention.dialog.description': 'Choose a discoverable attention target.',
        'attention.dialog.scopeKind': 'Scope kind',
        'attention.dialog.scopeKey': 'Existing exact key',
        'attention.dialog.scopeKeyHelp': 'This immutable key is retained for the existing rule.',
        'attention.dialog.displayLabel': 'Display label',
        'attention.dialog.effect': 'Effect',
        'attention.dialog.channels': 'Channels',
        'attention.dialog.expiresAt': 'Ends at',
        'attention.dialog.preview': 'Preview',
        'attention.dialog.saving': 'Saving',
        'attention.scopeKinds.APP_TYPE': 'App and notification type',
        'attention.scopeKinds.RESOURCE': 'Recent project or work item',
        'attention.effects.PRIORITIZE': 'Prioritize',
        'attention.effects.FOLLOW': 'Follow',
        'attention.effects.MUTE': 'Mute',
        'attention.emptyDescription': 'No matching context',
        'attention.dialog.startsAt': 'Starts at',
      })[key] ?? key,
  }),
}));

const existingResourceRule: NotificationAttentionRule = {
  ruleId: 'rule-1',
  scopeKind: 'RESOURCE',
  scopeKey: 'project:legacy',
  displayLabel: 'Legacy project',
  effect: 'FOLLOW',
  channels: { IN_APP: true },
  startsAt: null,
  expiresAt: null,
  source: 'USER',
  managed: false,
  exceptionAllowed: true,
  enabled: true,
  version: '1',
  createdAt: '2026-09-16T00:00:00Z',
  updatedAt: '2026-09-16T00:00:00Z',
};

let host: HTMLDivElement;
let root: Root;

async function renderDialog(initialRule: NotificationAttentionRule | null) {
  await act(async () => {
    root.render(
      <NotificationAttentionRuleDialog
        open
        initialRule={initialRule}
        preview={null}
        busy={false}
        previewing={false}
        onClose={vi.fn()}
        onPreview={vi.fn()}
        onSave={vi.fn()}
        onDraftChange={vi.fn()}
        scopeCatalog={{
          APP_TYPE: [
            {
              kind: 'APP_TYPE',
              key: 'messaging:MESSAGE_MENTION',
              label: 'Space Messenger / Mention',
            },
          ],
          RESOURCE: [],
        }}
        discoveryStates={{ APP_TYPE: 'READY', RESOURCE: 'READY' }}
      />
    );
  });
}

describe('NotificationAttentionRuleDialog discovery UX', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  it('uses labeled discovery for new rules without exposing an exact-key editor', async () => {
    await renderDialog(null);

    expect(document.body.textContent).toContain('App and notification type');
    expect(document.body.textContent).not.toContain('Existing exact key');
    expect(document.body.textContent).not.toContain('Advanced');
  });

  it('keeps an undiscoverable existing key readable but immutable while editing', async () => {
    await renderDialog(existingResourceRule);

    const exactKey = document.body.querySelector<HTMLInputElement>('input[value="project:legacy"]');
    expect(document.body.textContent).toContain('Existing exact key');
    expect(exactKey).not.toBeNull();
    expect(exactKey?.disabled).toBe(true);
    expect(document.body.textContent).not.toContain('Advanced');
  });
});
