import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { replaceProviderTenantEntitlements, useToast } from '@dwp-frontend/shared-utils';

import type { Dispatch, SetStateAction } from 'react';
import type { ProviderTenant } from '@dwp-frontend/shared-utils';

import { providerError } from './provider-ui';
import {
  createProviderTenantEntitlementSaveCommand,
  emptyProviderTenantEntitlementDraft,
  hydrateProviderTenantEntitlementDraft,
  markProviderTenantEntitlementDraftConflict,
  PROVIDER_TENANT_ENTITLEMENT_SERVER_DRIFT,
  providerTenantEntitlementSaveTokenMatches,
  rebaseProviderTenantEntitlementServerState,
  rebaseProviderTenantEntitlementSaveResponse,
  toggleProviderTenantEntitlementDraft,
} from './provider-tenant-entitlement-draft-model';

type ProviderTenantEntitlementDraftOptions = {
  tenantId: string;
  tenant: ProviderTenant | undefined;
  busy: boolean;
  setBusy: Dispatch<SetStateAction<boolean>>;
  invalidate: () => Promise<unknown>;
};

export function useProviderTenantEntitlementDraft({
  tenantId,
  tenant,
  busy,
  setBusy,
  invalidate,
}: ProviderTenantEntitlementDraftOptions) {
  const { t } = useTranslation('provider');
  const toast = useToast();
  const [draft, setDraft] = useState(emptyProviderTenantEntitlementDraft);
  const [reason, setReason] = useState('');
  const saveInFlightRef = useRef(false);
  const currentRef = useRef({ draft, tenantId, server: tenant });
  currentRef.current = { draft, tenantId, server: tenant };

  useEffect(() => {
    if (tenant) {
      setDraft((current) =>
        hydrateProviderTenantEntitlementDraft(
          current,
          tenantId,
          tenant.entitlements.map((entitlement) => entitlement.entitlementKey)
        )
      );
    }
  }, [tenant, tenantId]);
  useEffect(() => setReason(''), [tenantId]);

  const blocked = () => busy || saveInFlightRef.current;
  const save = async () => {
    const command = createProviderTenantEntitlementSaveCommand(
      draft,
      tenantId,
      tenant,
      reason,
      blocked()
    );
    if (command === PROVIDER_TENANT_ENTITLEMENT_SERVER_DRIFT) {
      setDraft((current) => markProviderTenantEntitlementDraftConflict(current, tenantId));
      return;
    }
    if (!tenant || !command) return;
    saveInFlightRef.current = true;
    setBusy(true);
    try {
      const updated = await replaceProviderTenantEntitlements(
        tenant,
        command.selected,
        command.justification
      );
      const current = currentRef.current;
      const savedDraft = rebaseProviderTenantEntitlementSaveResponse(
        command.token,
        current.tenantId,
        current.draft,
        current.server,
        updated
      );
      if (savedDraft) {
        setDraft(savedDraft);
        setReason('');
        toast.success(t('entitlements.saved'));
      }
      await invalidate();
    } catch (error) {
      const current = currentRef.current;
      if (
        providerTenantEntitlementSaveTokenMatches(
          command.token,
          current.tenantId,
          current.draft,
          current.server
        )
      ) {
        toast.error(providerError(error, t('errors.operation')));
      }
    } finally {
      saveInFlightRef.current = false;
      setBusy(false);
    }
  };

  return {
    draft,
    reason,
    acceptLatest: () => {
      if (blocked() || !tenant) return;
      setDraft(rebaseProviderTenantEntitlementServerState(tenant));
      setReason('');
    },
    toggle: (entitlementKey: string) => {
      if (blocked()) return;
      setDraft((current) => toggleProviderTenantEntitlementDraft(current, entitlementKey));
    },
    changeReason: (nextReason: string) => {
      if (!blocked()) setReason(nextReason);
    },
    save,
  };
}
