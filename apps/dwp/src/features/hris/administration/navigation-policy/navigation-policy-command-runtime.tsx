import { useCallback, useEffect, useMemo, useState } from 'react';
import { InlineFeedback } from '@dwp-frontend/design-system';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
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
  createNavigationPolicyDraftRevision,
  navigationPolicyDraftBody,
  publishNavigationPolicyRevision,
  restoreNavigationPolicyRevision,
  submitNavigationPolicyDraftRevision,
  updateNavigationPolicyDraftRevision,
  validateNavigationPolicyDraftRevision,
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

export function navigationPolicyHighRiskCommand(command: SealedCommand) {
  const action = command.input.action;
  if (action !== 'APPROVE' && action !== 'PUBLISH' && action !== 'RESTORE') {
    throw new Error('Navigation-policy command is not high risk.');
  }
  const suffix = action.toLowerCase();
  return productSurfaceHighRiskCommand({
    operation: HIGH_RISK_OPERATION[action],
    commandMethod: 'POST',
    commandPath: `/api/platform/v1/admin/hris/navigation-policies/revisions/${encodeURIComponent(
      command.revisionId
    )}/${suffix}`,
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
  const [searchParams] = useSearchParams();
  const requestedScope = selectHrisLegalEntitySelector(searchParams);
  const createAuthority = useProductActionMutation(NAVIGATION_POLICY_ACTION_CONTRACTS.CREATE_DRAFT);
  const updateAuthority = useProductActionMutation(NAVIGATION_POLICY_ACTION_CONTRACTS.SAVE_DRAFT);
  const validateAuthority = useProductActionMutation(NAVIGATION_POLICY_ACTION_CONTRACTS.VALIDATE);
  const submitAuthority = useProductActionMutation(NAVIGATION_POLICY_ACTION_CONTRACTS.SUBMIT);
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

  const execute = useCallback<NavigationPolicyCommandOwner['execute']>(
    async (input) => {
      const sealed = await sealNavigationPolicyCommand(input);
      if (input.action === 'CREATE_DRAFT') {
        return createAuthority((authority) =>
          createNavigationPolicyDraftRevision(
            { ...sealed.envelope, body: navigationPolicyDraftBody(input.draft) },
            authority
          )
        );
      }
      if (input.action === 'SAVE_DRAFT') {
        return updateAuthority((authority) =>
          updateNavigationPolicyDraftRevision(
            sealed.revisionId,
            { ...sealed.envelope, body: navigationPolicyDraftBody(input.draft) },
            authority
          )
        );
      }
      if (input.action === 'VALIDATE') {
        return validateAuthority((authority) =>
          validateNavigationPolicyDraftRevision(
            sealed.revisionId,
            { ...sealed.envelope, body: {} },
            authority
          )
        );
      }
      if (input.action === 'SUBMIT') {
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
          ? approveAuthority
          : input.action === 'PUBLISH'
            ? publishAuthority
            : restoreAuthority;
      return executor.execute((authority, descriptor) => {
        const envelope = {
          ...sealed.envelope,
          idempotencyKey: descriptor?.idempotencyKey ?? sealed.envelope.idempotencyKey,
          body: { reason: requireReason(input.reason) },
        };
        if (input.action === 'APPROVE') {
          return approveNavigationPolicyRevision(sealed.revisionId, envelope, authority);
        }
        if (input.action === 'PUBLISH') {
          return publishNavigationPolicyRevision(sealed.revisionId, envelope, authority);
        }
        return restoreNavigationPolicyRevision(sealed.revisionId, envelope, authority);
      }, sealed);
    },
    [
      approveAuthority,
      createAuthority,
      publishAuthority,
      restoreAuthority,
      submitAuthority,
      updateAuthority,
      validateAuthority,
    ]
  );
  const commandOwner = useMemo<NavigationPolicyCommandOwner>(() => ({ execute }), [execute]);

  return (
    <>
      <Stack gap={2} minWidth={0}>
        <NavigationPolicyRequestedScopeSelector />
        {requestedScope.state === 'INVALID' ? (
          <InlineFeedback severity="error" title="Invalid legal-entity selector">
            The requested legal-entity public ID is not a single UUID. No policy data was requested.
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
    </>
  );
}

function NavigationPolicyRequestedScopeSelector() {
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
          <Typography component="h2" variant="subtitle1" fontWeight={700}>
            Policy scope
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Choose the tenant baseline or request a legal-entity restriction. The browser value is
            only a selector; the People owner revalidates it against the authenticated scope before
            returning or changing policy data.
          </Typography>
        </Stack>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={1.25} alignItems={{ md: 'flex-start' }}>
          <TextField
            select
            size="small"
            label="Policy scope"
            value={scopeKind}
            onChange={(event) =>
              setScopeKind(event.target.value === 'LEGAL_ENTITY' ? 'LEGAL_ENTITY' : 'TENANT')
            }
            sx={{ minWidth: { xs: '100%', md: 220 } }}
          >
            <MenuItem value="TENANT">Tenant baseline</MenuItem>
            <MenuItem value="LEGAL_ENTITY">Legal-entity restriction</MenuItem>
          </TextField>
          {scopeKind === 'LEGAL_ENTITY' ? (
            <TextField
              size="small"
              label="Legal-entity public ID"
              value={legalEntityPublicId}
              error={Boolean(legalEntityPublicId) && !validLegalEntity}
              helperText="UUID requested for server-side People ownership verification"
              inputProps={{ inputMode: 'text', autoComplete: 'off', spellCheck: false }}
              onChange={(event) => setLegalEntityPublicId(event.target.value)}
              sx={{ flex: 1, minWidth: { xs: '100%', md: 360 } }}
            />
          ) : null}
          <Button
            variant="outlined"
            disabled={!canApply}
            onClick={applyScope}
            sx={{ minHeight: 40, alignSelf: { xs: 'stretch', md: 'flex-start' } }}
          >
            Apply scope
          </Button>
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
