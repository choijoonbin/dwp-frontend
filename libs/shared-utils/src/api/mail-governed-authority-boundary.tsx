import { useInsertionEffect } from 'react';

import { registerMailGovernedRequestAuthority } from './mail-governed-transport';

import type { ReactNode } from 'react';
import type { MailGovernedRequestAuthority } from './mail-governed-transport';

/**
 * Installs Mail request authority before descendant layout/passive effects can start data work.
 * The boundary intentionally renders children while authority is absent: any request attempted
 * during render still fails closed and cannot escape as legacy traffic.
 */
export function MailGovernedAuthorityBoundary({
  authority,
  children,
}: {
  authority: MailGovernedRequestAuthority;
  children: ReactNode;
}) {
  useInsertionEffect(() => registerMailGovernedRequestAuthority(authority), [authority]);
  return children;
}
