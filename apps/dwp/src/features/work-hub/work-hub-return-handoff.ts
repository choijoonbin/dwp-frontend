import { workspaceWorkSourceRoute } from '@dwp-frontend/shared-utils/api/workspace-work-policy';

import type { WorkHubItem } from './work-hub-contracts';

export type WorkHubReturnFocus = 'SOURCE' | 'ASSIST';

type WorkHubReturnIntent = {
  focus: WorkHubReturnFocus;
  itemKey: string;
  recordedAt: number;
  returnTo: string;
};

type WorkHubBrowserLocation = Pick<Location, 'hash' | 'pathname' | 'search'>;
type WorkHubSessionStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

const RETURN_INTENT_KEY = 'dwp.work.approval-return.v1';
const RETURN_INTENT_TTL_MS = 10 * 60 * 1000;

function containsControlOrBackslash(value: string): boolean {
  return [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return character === '\\' || code <= 31 || code === 127;
  });
}

function canonicalWorkReturnTarget(value: string): string | null {
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.length > 2048 ||
    containsControlOrBackslash(value)
  )
    return null;
  try {
    const parsed = new URL(value, 'https://dwp.invalid');
    if (parsed.origin !== 'https://dwp.invalid') return null;
    if (parsed.pathname !== '/work' && !parsed.pathname.startsWith('/work/')) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function workHubCurrentLocation(location: WorkHubBrowserLocation): string | null {
  return canonicalWorkReturnTarget(`${location.pathname}${location.search}${location.hash}`);
}

export function workHubApprovalHandoffRoute(sourceRoute: string, returnTo: string): string | null {
  const target = workspaceWorkSourceRoute({ sourceRoute });
  if (!target) return null;
  const parsed = new URL(target, 'https://dwp.invalid');
  if (!parsed.pathname.startsWith('/approvals/')) return target;
  const canonicalReturnTo = canonicalWorkReturnTarget(returnTo);
  if (!canonicalReturnTo) return null;
  parsed.searchParams.set('returnTo', canonicalReturnTo);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function recordWorkHubReturnIntent(
  item: WorkHubItem,
  returnTo: string,
  focus: WorkHubReturnFocus,
  storage: WorkHubSessionStorage = window.sessionStorage,
  now = Date.now()
): boolean {
  const canonicalReturnTo = canonicalWorkReturnTarget(returnTo);
  if (!canonicalReturnTo) return false;
  try {
    storage.setItem(
      RETURN_INTENT_KEY,
      JSON.stringify({ focus, itemKey: item.key, recordedAt: now, returnTo: canonicalReturnTo })
    );
    return true;
  } catch {
    return false;
  }
}

export function consumeWorkHubReturnIntent(
  returnTo: string,
  itemKey: string | null,
  storage: WorkHubSessionStorage = window.sessionStorage,
  now = Date.now()
): WorkHubReturnFocus | null {
  let value: string | null = null;
  try {
    value = storage.getItem(RETURN_INTENT_KEY);
    if (!value) return null;
    const intent = JSON.parse(value) as Partial<WorkHubReturnIntent>;
    const focus = intent.focus;
    if (focus !== 'SOURCE' && focus !== 'ASSIST') return null;
    const valid =
      intent.itemKey === itemKey &&
      intent.returnTo === canonicalWorkReturnTarget(returnTo) &&
      typeof intent.recordedAt === 'number' &&
      now >= intent.recordedAt &&
      now - intent.recordedAt <= RETURN_INTENT_TTL_MS;
    if (!valid) return null;
    return focus;
  } catch {
    return null;
  } finally {
    if (value) {
      try {
        storage.removeItem(RETURN_INTENT_KEY);
      } catch {
        // Storage is optional. A failed cleanup cannot block a safe source return.
      }
    }
  }
}
