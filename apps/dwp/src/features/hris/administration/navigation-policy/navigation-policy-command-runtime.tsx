import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InlineFeedback, FormField, ActionButton } from '@dwp-frontend/design-system';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useSearchParams } from 'react-router-dom';

import {
  ProductSurfaceHighRiskCommandDialog,
  productSurfaceHighRiskCommand,
} from '../../../../components/product-surface-high-risk-command';
import { useProductActionMutation } from '../../../../components/use-product-action-mutation';
import { useProductSurfaceHighRiskCommandExecutor } from '../../../../components/use-product-surface-high-risk-command-executor';
import {
  approveNavigationPolicyRevision,
  approveNavigationPolicyV2Revision,
  createNavigationPolicyDraftRevision,
  createNavigationPolicyV2DraftRevision,
  navigationPolicyDraftBody,
  NAVIGATION_POLICY_OPERATION_BINDINGS,
  NAVIGATION_POLICY_V2_OPERATION_BINDINGS,
  publishNavigationPolicyRevision,
  publishNavigationPolicyV2Revision,
  restoreNavigationPolicyRevision,
  restoreNavigationPolicyV2Revision,
  submitNavigationPolicyDraftRevision,
  submitNavigationPolicyV2DraftRevision,
  updateNavigationPolicyDraftRevision,
  updateNavigationPolicyV2DraftRevision,
  validateNavigationPolicyDraftRevision,
  validateNavigationPolicyV2DraftRevision,
} from './api/navigation-policy-api';
import { HrisNavigationPolicyWorkspace } from './pages/hris-navigation-policy-workspace';
import {
  HRIS_LEGAL_ENTITY_SELECTOR_PARAM,
  isHrisLegalEntityPublicId,
  replaceHrisLegalEntitySelector,
  selectHrisLegalEntitySelector,
} from '../../shell/navigation-policy/hris-legal-entity-selector';

import type {
  ProductSurfaceHighRiskCommandDescriptor,
  ProductSurfaceHighRiskOperation,
} from '../../../../components/product-surface-high-risk-command';
import type {
  NavigationPolicyCommandInput,
  NavigationPolicyCommandOwner,
} from './model/navigation-policy-model';
import type { NavigationPolicyCommandEnvelope } from './api/navigation-policy-api';

export const NAVIGATION_POLICY_ACTION_CONTRACTS = Object.freeze({
  CREATE_DRAFT: 'route.hcm.configuration.navigation-policy-draft-create.action',
  SAVE_DRAFT: 'route.hcm.configuration.navigation-policy-draft-update.action',
  VALIDATE: 'route.hcm.configuration.navigation-policy-draft-validate.action',
  SUBMIT: 'route.hcm.configuration.navigation-policy-draft-submit.action',
} as const);

export const NAVIGATION_POLICY_V2_ACTION_CONTRACTS = Object.freeze({
  CREATE_DRAFT: 'route.hcm.configuration.navigation-policy-v2-draft-create.action',
  SAVE_DRAFT: 'route.hcm.configuration.navigation-policy-v2-draft-update.action',
  VALIDATE: 'route.hcm.configuration.navigation-policy-v2-draft-validate.action',
  SUBMIT: 'route.hcm.configuration.navigation-policy-v2-draft-submit.action',
} as const);

type SealedCommand = Readonly<{
  input: NavigationPolicyCommandInput;
  revisionId: string;
  envelope: NavigationPolicyCommandEnvelope<Readonly<Record<string, unknown>>>;
}>;

const HIGH_RISK_OPERATION = {
  APPROVE: 'HCM_NAVIGATION_POLICY_APPROVE',
  PUBLISH: 'HCM_NAVIGATION_POLICY_PUBLISH',
  RESTORE: 'HCM_NAVIGATION_POLICY_RESTORE',
} as const satisfies Readonly<Record<string, ProductSurfaceHighRiskOperation>>;

const HIGH_RISK_V2_OPERATION = {
  APPROVE: 'HCM_NAVIGATION_POLICY_V2_APPROVE',
  PUBLISH: 'HCM_NAVIGATION_POLICY_V2_PUBLISH',
  RESTORE: 'HCM_NAVIGATION_POLICY_V2_RESTORE',
} as const satisfies Readonly<Record<string, ProductSurfaceHighRiskOperation>>;

export function navigationPolicyHighRiskCommand(command: SealedCommand) {
  const action = command.input.action;
  if (action !== 'APPROVE' && action !== 'PUBLISH' && action !== 'RESTORE') {
    throw new Error('Navigation-policy command is not high risk.');
  }
  const v2 = command.input.draft.scopeKind === 'LEGAL_ENTITY';
  const operationIndex = action === 'APPROVE' ? 5 : action === 'PUBLISH' ? 6 : 7;
  const pathTemplate = (
    v2 ? NAVIGATION_POLICY_V2_OPERATION_BINDINGS : NAVIGATION_POLICY_OPERATION_BINDINGS
  )[operationIndex][1];
  return productSurfaceHighRiskCommand({
    operation: v2 ? HIGH_RISK_V2_OPERATION[action] : HIGH_RISK_OPERATION[action],
    commandMethod: 'POST',
    commandPath: pathTemplate.replace('{revisionId}', encodeURIComponent(command.revisionId)),
    targetType: 'HRIS_NAVIGATION_POLICY_REVISION',
    targetId: command.revisionId,
    expectedObjectVersion: command.envelope.expectedVersion,
    payload: Object.freeze({
      ...command.envelope.body,
      expectedVersion: command.envelope.expectedVersion,
      requestDigest: command.envelope.requestDigest,
    }),
    idempotencyKey: command.envelope.idempotencyKey,
  });
}

export function HrisNavigationPolicyCommandRuntime() {
  const { t } = useTranslation('hcm');
  const [searchParams] = useSearchParams();
  const requestedScope = selectHrisLegalEntitySelector(searchParams);
  const createAuthority = useProductActionMutation(NAVIGATION_POLICY_ACTION_CONTRACTS.CREATE_DRAFT);
  const updateAuthority = useProductActionMutation(NAVIGATION_POLICY_ACTION_CONTRACTS.SAVE_DRAFT);
  const validateAuthority = useProductActionMutation(NAVIGATION_POLICY_ACTION_CONTRACTS.VALIDATE);
  const submitAuthority = useProductActionMutation(NAVIGATION_POLICY_ACTION_CONTRACTS.SUBMIT);
  const createV2Authority = useProductActionMutation(
    NAVIGATION_POLICY_V2_ACTION_CONTRACTS.CREATE_DRAFT
  );
  const updateV2Authority = useProductActionMutation(
    NAVIGATION_POLICY_V2_ACTION_CONTRACTS.SAVE_DRAFT
  );
  const validateV2Authority = useProductActionMutation(
    NAVIGATION_POLICY_V2_ACTION_CONTRACTS.VALIDATE
  );
  const submitV2Authority = useProductActionMutation(NAVIGATION_POLICY_V2_ACTION_CONTRACTS.SUBMIT);
  const approveAuthority = useProductSurfaceHighRiskCommandExecutor({
    operation: HIGH_RISK_OPERATION.APPROVE,
    buildCommand: navigationPolicyHighRiskCommand,
  });
  const publishAuthority = useProductSurfaceHighRiskCommandExecutor({
    operation: HIGH_RISK_OPERATION.PUBLISH,
    buildCommand: navigationPolicyHighRiskCommand,
  });
  const restoreAuthority = useProductSurfaceHighRiskCommandExecutor({
    operation: HIGH_RISK_OPERATION.RESTORE,
    buildCommand: navigationPolicyHighRiskCommand,
  });
  const approveV2Authority = useProductSurfaceHighRiskCommandExecutor({
    operation: HIGH_RISK_V2_OPERATION.APPROVE,
    buildCommand: navigationPolicyHighRiskCommand,
  });
  const publishV2Authority = useProductSurfaceHighRiskCommandExecutor({
    operation: HIGH_RISK_V2_OPERATION.PUBLISH,
    buildCommand: navigationPolicyHighRiskCommand,
  });
  const restoreV2Authority = useProductSurfaceHighRiskCommandExecutor({
    operation: HIGH_RISK_V2_OPERATION.RESTORE,
    buildCommand: navigationPolicyHighRiskCommand,
  });

  const execute = useCallback<NavigationPolicyCommandOwner['execute']>(
    async (input) => {
      const sealed = await sealNavigationPolicyCommand(input);
      const useV2 = input.draft.scopeKind === 'LEGAL_ENTITY';
      if (input.action === 'CREATE_DRAFT') {
        if (useV2) {
          return createV2Authority((authority) =>
            createNavigationPolicyV2DraftRevision(
              { ...sealed.envelope, body: navigationPolicyDraftBody(input.draft) },
              authority
            )
          );
        }
        return createAuthority((authority) =>
          createNavigationPolicyDraftRevision(
            { ...sealed.envelope, body: navigationPolicyDraftBody(input.draft) },
            authority
          )
        );
      }
      if (input.action === 'SAVE_DRAFT') {
        if (useV2) {
          return updateV2Authority((authority) =>
            updateNavigationPolicyV2DraftRevision(
              sealed.revisionId,
              { ...sealed.envelope, body: navigationPolicyDraftBody(input.draft) },
              authority
            )
          );
        }
        return updateAuthority((authority) =>
          updateNavigationPolicyDraftRevision(
            sealed.revisionId,
            { ...sealed.envelope, body: navigationPolicyDraftBody(input.draft) },
            authority
          )
        );
      }
      if (input.action === 'VALIDATE') {
        if (useV2) {
          return validateV2Authority((authority) =>
            validateNavigationPolicyV2DraftRevision(
              sealed.revisionId,
              { ...sealed.envelope, body: {} },
              authority
            )
          );
        }
        return validateAuthority((authority) =>
          validateNavigationPolicyDraftRevision(
            sealed.revisionId,
            { ...sealed.envelope, body: {} },
            authority
          )
        );
      }
      if (input.action === 'SUBMIT') {
        if (useV2) {
          return submitV2Authority((authority) =>
            submitNavigationPolicyV2DraftRevision(
              sealed.revisionId,
              { ...sealed.envelope, body: {} },
              authority
            )
          );
        }
        return submitAuthority((authority) =>
          submitNavigationPolicyDraftRevision(
            sealed.revisionId,
            { ...sealed.envelope, body: {} },
            authority
          )
        );
      }
      const executor =
        input.action === 'APPROVE'
          ? useV2
            ? approveV2Authority
            : approveAuthority
          : input.action === 'PUBLISH'
            ? useV2
              ? publishV2Authority
              : publishAuthority
            : useV2
              ? restoreV2Authority
              : restoreAuthority;
      return executor.execute((authority, descriptor) => {
        const envelope = {
          ...sealed.envelope,
          idempotencyKey: descriptor?.idempotencyKey ?? sealed.envelope.idempotencyKey,
          body: { reason: requireReason(input.reason) },
        };
        if (input.action === 'APPROVE') {
          if (useV2) {
            return approveNavigationPolicyV2Revision(sealed.revisionId, envelope, authority);
          }
          return approveNavigationPolicyRevision(sealed.revisionId, envelope, authority);
        }
        if (input.action === 'PUBLISH') {
          if (useV2) {
            return publishNavigationPolicyV2Revision(sealed.revisionId, envelope, authority);
          }
          return publishNavigationPolicyRevision(sealed.revisionId, envelope, authority);
        }
        if (useV2) {
          return restoreNavigationPolicyV2Revision(sealed.revisionId, envelope, authority);
        }
        return restoreNavigationPolicyRevision(sealed.revisionId, envelope, authority);
      }, sealed);
    },
    [
      approveAuthority,
      approveV2Authority,
      createAuthority,
      createV2Authority,
      publishAuthority,
      publishV2Authority,
      restoreAuthority,
      restoreV2Authority,
      submitAuthority,
      submitV2Authority,
      updateAuthority,
      updateV2Authority,
      validateAuthority,
      validateV2Authority,
    ]
  );
  const commandOwner = useMemo<NavigationPolicyCommandOwner>(() => ({ execute }), [execute]);

  return (
    <>
      <Stack gap={2} minWidth={0}>
        <NavigationPolicyRequestedScopeSelector />
        {requestedScope.state === 'INVALID' ? (
          <InlineFeedback
            severity="error"
            title={t('administration.navigation.runtime.invalidTitle')}
          >
            {t('administration.navigation.runtime.invalidDescription')}
          </InlineFeedback>
        ) : (
          <HrisNavigationPolicyWorkspace
            scopeKind={requestedScope.state}
            scopePublicId={requestedScope.legalEntityPublicId}
            commandOwner={commandOwner}
          />
        )}
      </Stack>
      <ProductSurfaceHighRiskCommandDialog controller={approveAuthority.controller} />
      <ProductSurfaceHighRiskCommandDialog controller={publishAuthority.controller} />
      <ProductSurfaceHighRiskCommandDialog controller={restoreAuthority.controller} />
      <ProductSurfaceHighRiskCommandDialog controller={approveV2Authority.controller} />
      <ProductSurfaceHighRiskCommandDialog controller={publishV2Authority.controller} />
      <ProductSurfaceHighRiskCommandDialog controller={restoreV2Authority.controller} />
    </>
  );
}

function NavigationPolicyRequestedScopeSelector() {
  const { t } = useTranslation('hcm');
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedScope = selectHrisLegalEntitySelector(searchParams);
  const routedValue = searchParams.get(HRIS_LEGAL_ENTITY_SELECTOR_PARAM) ?? '';
  const [scopeKind, setScopeKind] = useState<'TENANT' | 'LEGAL_ENTITY'>(() =>
    requestedScope.state === 'TENANT' ? 'TENANT' : 'LEGAL_ENTITY'
  );
  const [legalEntityPublicId, setLegalEntityPublicId] = useState(
    requestedScope.legalEntityPublicId ?? routedValue
  );

  useEffect(() => {
    setScopeKind(requestedScope.state === 'TENANT' ? 'TENANT' : 'LEGAL_ENTITY');
    setLegalEntityPublicId(requestedScope.legalEntityPublicId ?? routedValue);
  }, [requestedScope.legalEntityPublicId, requestedScope.state, routedValue]);

  const validLegalEntity = isHrisLegalEntityPublicId(legalEntityPublicId.trim());
  const canApply = scopeKind === 'TENANT' || validLegalEntity;
  const applyScope = () => {
    if (!canApply) return;
    setSearchParams(replaceHrisLegalEntitySelector(searchParams, scopeKind, legalEntityPublicId), {
      replace: true,
    });
  };

  return (
    <Paper component="section" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Stack gap={1.5}>
        <Stack gap={0.25}>
          <Typography component="h2" variant="subtitle1" fontWeight="fontWeightBold">
            {t('administration.navigation.runtime.scopeTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('administration.navigation.runtime.scopeDescription')}
          </Typography>
        </Stack>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={1.25} alignItems={{ md: 'flex-start' }}>
          <FormField
            fullWidth={false}
            select
            size="small"
            label={t('administration.navigation.runtime.scopeTitle')}
            value={scopeKind}
            onChange={(event) =>
              setScopeKind(event.target.value === 'LEGAL_ENTITY' ? 'LEGAL_ENTITY' : 'TENANT')
            }
            sx={{ minWidth: { xs: '100%', md: 220 } }}
          >
            <MenuItem value="TENANT">
              {t('administration.navigation.runtime.tenantBaseline')}
            </MenuItem>
            <MenuItem value="LEGAL_ENTITY">
              {t('administration.navigation.runtime.legalEntityRestriction')}
            </MenuItem>
          </FormField>
          {scopeKind === 'LEGAL_ENTITY' ? (
            <FormField
              fullWidth={false}
              size="small"
              label={t('administration.navigation.runtime.legalEntityPublicId')}
              value={legalEntityPublicId}
              errorMessage={
                Boolean(legalEntityPublicId) && !validLegalEntity
                  ? t('administration.navigation.runtime.uuidHelp')
                  : undefined
              }
              supportingText={t('administration.navigation.runtime.uuidHelp')}
              inputProps={{ inputMode: 'text', autoComplete: 'off', spellCheck: false }}
              onChange={(event) => setLegalEntityPublicId(event.target.value)}
              sx={{ flex: 1, minWidth: { xs: '100%', md: 360 } }}
            />
          ) : null}
          <ActionButton
            intent="secondary"
            disabled={!canApply}
            onClick={applyScope}
            sx={{ minHeight: 40, alignSelf: { xs: 'stretch', md: 'flex-start' } }}
          >
            {t('administration.navigation.runtime.applyScope')}
          </ActionButton>
        </Stack>
      </Stack>
    </Paper>
  );
}

async function sealNavigationPolicyCommand(
  input: NavigationPolicyCommandInput
): Promise<SealedCommand> {
  const revisionId = input.action === 'RESTORE' ? input.targetRevisionId : input.revisionId;
  if (input.action !== 'CREATE_DRAFT' && !revisionId?.trim()) {
    throw new Error('Navigation-policy revision is required.');
  }
  const body =
    input.action === 'CREATE_DRAFT' || input.action === 'SAVE_DRAFT'
      ? navigationPolicyDraftBody(input.draft)
      : input.action === 'APPROVE' || input.action === 'PUBLISH' || input.action === 'RESTORE'
        ? { reason: requireReason(input.reason) }
        : {};
  const expectedVersion = input.action === 'CREATE_DRAFT' ? 0 : input.expectedVersion;
  const requestDigest = await sha256({
    action: input.action,
    revisionId: revisionId ?? null,
    expectedVersion,
    body,
  });
  return Object.freeze({
    input,
    revisionId: revisionId ?? 'create',
    envelope: Object.freeze({
      body: Object.freeze({ ...body }),
      expectedVersion,
      requestDigest,
      idempotencyKey: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
    }),
  });
}

function requireReason(value?: string) {
  const reason = value?.trim() ?? '';
  if (!reason || reason.length > 500) throw new Error('A valid decision reason is required.');
  return reason;
}

async function sha256(value: unknown) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(canonicalize(value)))
  );
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, candidate]) => [key, canonicalize(candidate)])
  );
}

export type { ProductSurfaceHighRiskCommandDescriptor as NavigationPolicyHighRiskDescriptor };
