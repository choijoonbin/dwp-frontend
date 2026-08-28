import { useTranslation } from 'react-i18next';
import { ActionButton, FormField } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ProviderEntitlement } from '@dwp-frontend/shared-utils';

import type { ProviderTenantEntitlementDraft } from './provider-tenant-entitlement-draft-model';

import { ProviderSectionHeading } from './provider-ui';

export function ProviderTenantEntitlementsEditor({
  tenantName,
  catalog,
  catalogLoading,
  catalogError,
  catalogReady,
  canWrite,
  busy,
  draft,
  reason,
  onRetryCatalog,
  onAcceptLatest,
  onToggle,
  onReasonChange,
  onSave,
}: {
  tenantName: string;
  catalog: ProviderEntitlement[];
  catalogLoading: boolean;
  catalogError: boolean;
  catalogReady: boolean;
  canWrite: boolean;
  busy: boolean;
  draft: ProviderTenantEntitlementDraft;
  reason: string;
  onRetryCatalog: () => void;
  onAcceptLatest: () => void;
  onToggle: (entitlementKey: string) => void;
  onReasonChange: (reason: string) => void;
  onSave: () => void;
}) {
  const { t } = useTranslation('provider');
  return (
    <Box component="section">
      <ProviderSectionHeading title={t('entitlements.title', { tenant: tenantName })} />
      {draft.conflict && (
        <Alert
          severity="warning"
          sx={{ mt: 1.25 }}
          action={
            <ActionButton intent="quiet" size="small" disabled={busy} onClick={onAcceptLatest}>
              {t('actions.refresh')}
            </ActionButton>
          }
        >
          {t('tenantDetail.live.stale')}
        </Alert>
      )}
      {catalogLoading && (
        <Alert severity="info" sx={{ mt: 1.25 }}>
          {t('tenantDetail.entitlements.catalogLoading')}
        </Alert>
      )}
      {catalogError && (
        <Alert
          severity="warning"
          sx={{ mt: 1.25 }}
          action={
            <ActionButton intent="quiet" size="small" disabled={busy} onClick={onRetryCatalog}>
              {t('actions.retryLoad')}
            </ActionButton>
          }
        >
          {t('tenantDetail.entitlements.catalogUnavailable')}
        </Alert>
      )}
      {catalogReady && (
        <FormGroup
          sx={{
            mt: 1.25,
            py: 1,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            borderBlock: 1,
            borderColor: 'divider',
          }}
        >
          {catalog.map((entitlement) => (
            <FormControlLabel
              key={entitlement.entitlementId}
              control={
                <Checkbox
                  disabled={busy || !canWrite || draft.conflict}
                  checked={draft.selected.has(entitlement.entitlementKey)}
                  onChange={() => onToggle(entitlement.entitlementKey)}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight={700}>
                    {entitlement.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {entitlement.entitlementKey} / {entitlement.entitlementType}
                  </Typography>
                </Box>
              }
              sx={{ m: 0, px: 0.5, alignItems: 'flex-start' }}
            />
          ))}
        </FormGroup>
      )}
      {canWrite && catalogReady && (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.25} sx={{ mt: 2 }}>
          <FormField
            fullWidth
            required
            label={t('fields.justification')}
            value={reason}
            disabled={busy}
            onChange={(event) => onReasonChange(event.target.value)}
          />
          <ActionButton
            intent="primary"
            disabled={
              busy || draft.conflict || !draft.dirty || draft.selected.size === 0 || !reason.trim()
            }
            onClick={onSave}
            sx={{ minWidth: 120 }}
          >
            {t('actions.save')}
          </ActionButton>
        </Stack>
      )}
    </Box>
  );
}
