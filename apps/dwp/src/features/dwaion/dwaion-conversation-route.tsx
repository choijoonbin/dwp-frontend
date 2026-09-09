import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ErrorState, LoadingState, PageCanvas } from '@dwp-frontend/design-system';
import { getDwaionConversation, HttpError, useAuth } from '@dwp-frontend/shared-utils';
import {
  DWAION_AGENT_KEY,
  DWAION_APPROVAL_EXPERT_AGENT_KEY,
  dwaionWorkspaceRoute,
  type DwaionAgentKey,
} from './dwaion-contract';

const USER_AGENT_KEYS: ReadonlySet<string> = new Set([
  DWAION_AGENT_KEY,
  DWAION_APPROVAL_EXPERT_AGENT_KEY,
]);

/** Resolves untagged saved links before the workspace renders; explicit agent links remain strict. */
export function DwaionConversationRoute({
  children,
}: {
  children: (onVerified: (id: string, agent: DwaionAgentKey) => void) => ReactNode;
}) {
  const { t } = useTranslation('work');
  const { user } = useAuth();
  const { conversationId: routeId } = useParams<{ conversationId: string }>();
  const [search] = useSearchParams();
  const conversationId = routeId?.trim() || search.get('conversation')?.trim() || null;
  const explicitAgent = search.get('agent');
  const invalidAgent =
    explicitAgent !== null &&
    (!USER_AGENT_KEYS.has(explicitAgent.trim().toUpperCase()) ||
      search.getAll('agent').length !== 1);
  const [verified, setVerified] = useState<{
    id: string;
    agent: DwaionAgentKey;
    owner: string;
  } | null>(null);
  const identity = `${user?.identityPlane ?? ''}:${user?.tenantId ?? ''}:${user?.userId ?? ''}:${user?.personPublicId ?? ''}`;
  const remember = useCallback(
    (id: string, agent: DwaionAgentKey) => setVerified({ id, agent, owner: identity }),
    [identity]
  );
  const verifiedAssistant =
    verified !== null &&
    verified.id === conversationId &&
    verified.owner === identity &&
    verified.agent === DWAION_AGENT_KEY;
  const needsResolution = Boolean(conversationId) && explicitAgent === null && !verifiedAssistant;
  const resolution = useQuery({
    queryKey: ['dwaion', 'conversation-resolution', conversationId, identity],
    queryFn: async (): Promise<DwaionAgentKey> => {
      // The shared decoder still verifies the requested conversation ID and every selected-work binding.
      const detail = await getDwaionConversation(conversationId!);
      const keys = new Set(
        detail.messages
          .filter((message) => message.role === 'ASSISTANT')
          .map((message) => message.agentKey ?? DWAION_AGENT_KEY)
      );
      if (keys.size > 1 || [...keys].some((key) => !USER_AGENT_KEYS.has(key))) {
        throw new HttpError('Saved conversation agent scope is inconsistent.', 409);
      }
      return ([...keys][0] ?? DWAION_AGENT_KEY) as DwaionAgentKey;
    },
    enabled: needsResolution,
    staleTime: 10_000,
    retry: (count, error) =>
      !(error instanceof HttpError && [403, 404, 409].includes(error.status)) && count < 1,
  });
  if (invalidAgent || (needsResolution && resolution.isError)) {
    return (
      <PageCanvas>
        <ErrorState
          size="compact"
          title={t('dwaionStudio.conversationUnavailable')}
          retryLabel={invalidAgent ? undefined : t('dwaionStudio.retry')}
          onRetry={invalidAgent ? undefined : () => void resolution.refetch()}
        />
      </PageCanvas>
    );
  }
  if (!needsResolution) return children(remember);
  if (!resolution.data)
    return (
      <PageCanvas>
        <LoadingState
          embedded
          variant="skeleton"
          skeletonRows={1}
          skeletonHeight={240}
          label={t('askPage.history.loading')}
        />
      </PageCanvas>
    );
  if (resolution.data === DWAION_APPROVAL_EXPERT_AGENT_KEY)
    return (
      <Navigate replace to={dwaionWorkspaceRoute(undefined, conversationId!, resolution.data)} />
    );
  return children(remember);
}
