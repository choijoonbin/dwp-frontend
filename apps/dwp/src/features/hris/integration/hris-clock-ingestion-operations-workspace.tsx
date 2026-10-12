import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import {
  ClockIngestionWorkspace,
  clockIngestionCopy,
  createClockIngestionDataSource,
} from '../time/clock-ingestion';
import { productSurfaceHighRiskCommand } from '../../../components/product-surface-high-risk-command';
import { useContextualProductActionMutation } from '../../../components/use-contextual-product-action-mutation';
import { useProductSurfaceHighRiskCommandExecutor } from '../../../components/use-product-surface-high-risk-command-executor';
import { useProductSurfaceRequestScope } from '../../../components/use-product-surface-request-scope';

import type {
  ClockIngestionOwnerBinding,
  ClockIngestionScope,
  ClockPageEntryMode,
  ClockVoidCommandBinding,
} from '../time/clock-ingestion';

const productionDataSource = createClockIngestionDataSource();

export function timeClockVoidCommand(binding: ClockVoidCommandBinding) {
  return productSurfaceHighRiskCommand({
    operation: 'HCM_TIME_CLOCK_EVENT_VOID',
    commandMethod: 'POST',
    commandPath: `/api/time/v1/clock-events/${encodeURIComponent(binding.eventId)}/voids`,
    targetType: 'CLOCK_EVENT',
    targetId: binding.eventId,
    expectedObjectVersion: binding.expectedObjectVersion,
    payload: binding.request,
    idempotencyKey: binding.idempotencyKey,
  });
}

export type HrisClockIngestionOperationsWorkspaceProps = Readonly<{
  entryMode: ClockPageEntryMode;
}>;

/**
 * Control-owned production adapter for the two TIM PAGE entries. Each reader and command keeps
 * its own generated route key; the adapter never substitutes a neighbouring PAGE/ACTION grant.
 */
export function HrisClockIngestionOperationsWorkspace({
  entryMode,
}: HrisClockIngestionOperationsWorkspaceProps) {
  const { i18n } = useTranslation('hcm');
  const [searchParams, setSearchParams] = useSearchParams();
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
  });
  const scopeIdentity =
    requestScope.contextScopeKey && requestScope.queryMeta.decisionRevision
      ? `${requestScope.contextScopeKey}\u0000${requestScope.queryMeta.decisionRevision}`
      : '';
  const correlationId = useMemo(
    () => (scopeIdentity ? (globalThis.crypto?.randomUUID?.() ?? '') : ''),
    [scopeIdentity]
  );
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const scope = useMemo<ClockIngestionScope>(
    () => ({
      ready:
        requestScope.ready &&
        Boolean(requestScope.contextScopeKey) &&
        Boolean(requestScope.queryMeta.decisionRevision) &&
        Boolean(correlationId),
      contextScopeKey: requestScope.contextScopeKey ?? '',
      decisionRevision: requestScope.queryMeta.decisionRevision,
      locale,
      timeZone,
      correlationId,
    }),
    [
      correlationId,
      locale,
      requestScope.contextScopeKey,
      requestScope.queryMeta.decisionRevision,
      requestScope.ready,
      timeZone,
    ]
  );
  const voidCommand = useProductSurfaceHighRiskCommandExecutor({
    operation: 'HCM_TIME_CLOCK_EVENT_VOID',
    buildCommand: timeClockVoidCommand,
  });
  const recordCommand = useContextualProductActionMutation(
    'route.hcm.personal.time-clock-event-record.action',
    'hcm.personal.time.submit',
    'SELF'
  );
  const ownerBinding = useMemo<ClockIngestionOwnerBinding>(
    () => ({
      eventPage: {
        routeContractKey: 'route.hcm.operations.time-clock-ingestion.page',
        read: productionDataSource.readEvents,
      },
      exceptionPage: {
        routeContractKey: 'route.hcm.operations.time-exceptions.page',
        read: productionDataSource.readExceptions,
      },
      commands: {
        ...(recordCommand.ready && recordCommand.hasWritableCapability
          ? {
              record: {
                routeContractKey: 'route.hcm.personal.time-clock-event-record.action' as const,
                execute: recordCommand.run,
              },
            }
          : {}),
        voidEvent: {
          routeContractKey: 'route.hcm.operations.time-clock-event-void.action',
          execute: voidCommand.execute,
          controller: voidCommand.controller,
        },
      },
    }),
    [
      recordCommand.hasWritableCapability,
      recordCommand.ready,
      recordCommand.run,
      voidCommand.controller,
      voidCommand.execute,
    ]
  );
  const setFocus = useCallback(
    (resourceId: string | null) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        if (resourceId) next.set('focus', resourceId);
        else next.delete('focus');
        return next;
      });
    },
    [setSearchParams]
  );

  return (
    <ClockIngestionWorkspace
      scope={scope}
      copy={clockIngestionCopy(locale)}
      entryMode={entryMode}
      ownerBinding={ownerBinding}
      dataSource={productionDataSource}
      focusResourceId={searchParams.get('focus')}
      onFocusResourceChange={setFocus}
    />
  );
}
