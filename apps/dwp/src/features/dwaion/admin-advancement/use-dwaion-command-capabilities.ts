import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getDwaionCommandCapabilities,
  type DwaionAdminCommandCapability,
  type DwaionGovernedCommandKind,
} from '@dwp-frontend/shared-utils';

const VERIFYING: DwaionAdminCommandCapability = {
  kind: 'MODEL_ROUTING_UPDATE',
  family: 'A01',
  executionMode: 'INTERNAL',
  status: 'UNAVAILABLE',
  configured: false,
  reason: 'The governed command capability is still being verified.',
  recoveryHint: 'Wait for capability verification to complete and retry.',
};

export function useDwaionCommandCapabilities() {
  const query = useQuery({
    queryKey: ['dwaion', 'admin', 'control-plane', 'command-capabilities'],
    queryFn: getDwaionCommandCapabilities,
    staleTime: 10_000,
  });
  const byKind = useMemo(
    () => new Map(query.data?.commands.map((entry) => [entry.kind, entry]) ?? []),
    [query.data?.commands]
  );
  const capability = useCallback(
    (kind: DwaionGovernedCommandKind): DwaionAdminCommandCapability => {
      const resolved = byKind.get(kind);
      if (resolved) return resolved;
      return {
        ...VERIFYING,
        kind,
        reason: query.isError
          ? 'The governed command capability could not be verified.'
          : VERIFYING.reason,
        recoveryHint: query.isError
          ? 'Restore the control-plane capability endpoint and retry.'
          : VERIFYING.recoveryHint,
      };
    },
    [byKind, query.isError]
  );
  const available = useCallback(
    (kind: DwaionGovernedCommandKind) => {
      const entry = capability(kind);
      return entry.status === 'AVAILABLE' && entry.configured;
    },
    [capability]
  );
  const message = useCallback(
    (kind: DwaionGovernedCommandKind) => {
      const entry = capability(kind);
      return [entry.reason, entry.recoveryHint].filter(Boolean).join(' ');
    },
    [capability]
  );
  const gate = useCallback(
    (kind: DwaionGovernedCommandKind, disabled = false) => ({
      disabled: disabled || !available(kind),
      title: available(kind) ? undefined : message(kind),
    }),
    [available, message]
  );
  return { query, capability, available, message, gate };
}
