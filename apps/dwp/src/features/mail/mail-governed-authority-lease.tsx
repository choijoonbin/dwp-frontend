import { createContext, useContext, useMemo } from 'react';

import type { MailGovernedRequestAuthority } from '@dwp-frontend/shared-utils';
import type { ReactNode } from 'react';

export type MailGovernedAuthorityLease = Readonly<{
  expiresAt: number | null;
  key: string;
}>;

const legacyLease: MailGovernedAuthorityLease = { expiresAt: null, key: 'legacy' };
const MailGovernedAuthorityLeaseContext = createContext<MailGovernedAuthorityLease>(legacyLease);

export function resolveMailGovernedAuthorityLease(
  authority: MailGovernedRequestAuthority
): MailGovernedAuthorityLease {
  if (authority.mode === 'LEGACY_COMPATIBILITY') {
    return { expiresAt: null, key: `legacy:${authority.rolloutState}` };
  }
  const instants = [authority.revalidateAt, authority.scopeValidUntil]
    .filter((value): value is string => typeof value === 'string')
    .map(Date.parse);
  const expiresAt = instants.length && instants.every(Number.isFinite) ? Math.min(...instants) : 0;
  return {
    expiresAt,
    key: [
      authority.rolloutState,
      authority.contextScopeKey ?? '',
      authority.expectedDecisionRevision ?? '',
      authority.revalidateAt ?? '',
      authority.scopeValidUntil ?? '',
    ].join('|'),
  };
}

export function MailGovernedAuthorityLeaseProvider({
  authority,
  children,
}: {
  authority: MailGovernedRequestAuthority;
  children: ReactNode;
}) {
  const lease = useMemo(() => resolveMailGovernedAuthorityLease(authority), [authority]);
  return (
    <MailGovernedAuthorityLeaseContext.Provider value={lease}>
      {children}
    </MailGovernedAuthorityLeaseContext.Provider>
  );
}

export function useMailGovernedAuthorityLease() {
  return useContext(MailGovernedAuthorityLeaseContext);
}
