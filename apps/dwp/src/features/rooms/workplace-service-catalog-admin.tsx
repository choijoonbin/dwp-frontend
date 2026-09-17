import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  createWorkplaceIdempotencyKey,
  getWorkplaceServiceAdminCatalog,
  resolveIdempotentMutationIntent,
  setWorkplaceServiceCatalogItemActive,
  useProductSurfaceAuthority,
} from '@dwp-frontend/shared-utils';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  EmptyState,
  FormDialog,
  FormField,
  InlineFeedback,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useRoomsCapabilities } from './rooms-capabilities';
import { CatalogEditor } from './workplace-service-catalog-editor';
import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';
import { requireWorkplaceServiceWrite, workplaceServicesCopy } from './workplace-services-ui-model';

import type {
  IdempotentMutationIntent,
  WorkplaceServiceCatalogAdminItem,
} from '@dwp-frontend/shared-utils';

export default function WorkplaceServiceCatalogAdminPage() {
  const { t, i18n } = useTranslation('rooms');
  const capabilities = useRoomsCapabilities();
  const authority = useProductSurfaceAuthority();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lifecycleCandidate, setLifecycleCandidate] =
    useState<WorkplaceServiceCatalogAdminItem | null>(null);
  const [lifecycleReason, setLifecycleReason] = useState('');
  const stateIntent = useRef<IdempotentMutationIntent | null>(null);
  const query = useQuery({
    queryKey: ['workplace', 'services', 'admin-catalog'],
    queryFn: getWorkplaceServiceAdminCatalog,
    enabled: capabilities.isLoaded && capabilities.canViewWorkplaceAdmin,
  });
  const selected = query.data?.items.find((item) => item.item.catalogItemId === selectedId) ?? null;
  const stateMutation = useMutation({
    mutationFn: ({ item, reason }: { item: WorkplaceServiceCatalogAdminItem; reason: string }) => {
      requireWorkplaceServiceWrite(
        capabilities.canManageWorkplaceAdmin && elevated && Boolean(reason.trim())
      );
      const input = {
        expectedVersion: item.item.version,
        active: item.lifecycleState !== 'ACTIVE',
        explicitConfirmation: true as const,
        reason: reason.trim(),
      };
      const intent = resolveIdempotentMutationIntent(stateIntent.current, input, () =>
        createWorkplaceIdempotencyKey('service-catalog-state')
      );
      stateIntent.current = intent;
      return setWorkplaceServiceCatalogItemActive(item.item.catalogItemId, input, {
        idempotencyKey: intent.key,
        activeAccessMode: 'ELEVATED',
      });
    },
    retry: false,
    onSuccess: () => {
      stateIntent.current = null;
      setLifecycleCandidate(null);
      setLifecycleReason('');
      void queryClient.invalidateQueries({ queryKey: ['workplace', 'services', 'admin-catalog'] });
    },
    onError: () =>
      void queryClient.invalidateQueries({ queryKey: ['workplace', 'services', 'admin-catalog'] }),
  });
  const elevated = authority.snapshot?.envelope.activeAccessMode === 'ELEVATED';
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const korean = locale === 'ko';
  const screenCopy = workplaceServicesCopy(locale);

  return (
    <Box
      data-testid="workplace-service-catalog-admin"
      sx={{ width: '100%', maxWidth: 1440, mx: 'auto', p: { xs: 2, md: 3 } }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        gap={1.5}
        mb={2.5}
      >
        <Box>
          <Typography variant="overline" color="primary.main">
            {t('workplace.services.adminEyebrow')}
          </Typography>
          <Typography component="h1" variant="h4" fontWeight="fontWeightBold">
            {t('workplace.services.catalog.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            {t('workplace.services.catalog.description')}
          </Typography>
        </Box>
        <ActionButton
          intent="primary"
          startIcon={<Plus size={17} />}
          onClick={() => setSelectedId(null)}
        >
          {t('workplace.services.catalog.new')}
        </ActionButton>
      </Stack>
      {!capabilities.isLoaded || query.isLoading ? (
        <Typography color="text.secondary">{t('workplace.services.loading')}</Typography>
      ) : !capabilities.canViewWorkplaceAdmin ? (
        <InlineFeedback severity="warning">{t('workplace.services.adminDenied')}</InlineFeedback>
      ) : query.isError ? (
        <InlineFeedback
          severity="error"
          action={
            <ActionButton
              intent="quiet"
              startIcon={<RefreshCw size={16} />}
              onClick={() => void query.refetch()}
            >
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('workplace.services.catalogError')}
        </InlineFeedback>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(300px, 0.75fr) minmax(0, 1.35fr)' },
            gap: 2,
          }}
        >
          <Stack component="ul" spacing={1} sx={{ p: 0, m: 0 }}>
            {(query.data?.items ?? []).map((item) => (
              <Box
                component="li"
                key={item.item.catalogItemId}
                sx={(theme) => ({
                  ...workplaceMemberSoftSurface(theme),
                  p: 1.25,
                  listStyle: 'none',
                  border: '1px solid',
                  borderColor: selectedId === item.item.catalogItemId ? 'primary.main' : 'divider',
                })}
              >
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <Box minWidth={0}>
                    <Typography component="h2" variant="subtitle2">
                      {korean ? item.item.nameKo : item.item.nameEn}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.item.serviceCode}
                    </Typography>
                  </Box>
                  <Stack direction="row" gap={0.5}>
                    <Chip
                      size="small"
                      label={
                        item.lifecycleState === 'ACTIVE'
                          ? screenCopy.lifecycleActive
                          : screenCopy.lifecycleInactive
                      }
                      color={item.lifecycleState === 'ACTIVE' ? 'success' : 'default'}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t(`workplace.services.providerStates.${item.item.providerState}`)}
                    />
                  </Stack>
                </Stack>
                <Typography variant="caption" color="text.secondary" display="block" mt={0.75}>
                  {t('workplace.services.catalog.slaSummary', {
                    response: item.item.slaResponseMinutes,
                    fulfillment: item.item.slaFulfillmentLeadMinutes,
                  })}
                </Typography>
                <Stack direction="row" gap={0.75} mt={1}>
                  <ActionButton
                    size="small"
                    intent="quiet"
                    onClick={() => setSelectedId(item.item.catalogItemId)}
                  >
                    {t('actions.edit')}
                  </ActionButton>
                  <ActionButton
                    size="small"
                    intent={item.lifecycleState === 'ACTIVE' ? 'danger' : 'secondary'}
                    disabled={
                      !capabilities.canManageWorkplaceAdmin || !elevated || stateMutation.isPending
                    }
                    onClick={() => {
                      setLifecycleReason('');
                      setLifecycleCandidate(item);
                    }}
                  >
                    {item.lifecycleState === 'ACTIVE'
                      ? t('workplace.services.catalog.deactivate')
                      : t('workplace.services.catalog.activate')}
                  </ActionButton>
                </Stack>
              </Box>
            ))}
            {!query.data?.items.length && (
              <EmptyState title={t('workplace.services.catalog.empty')} />
            )}
          </Stack>
          <Box component="aside" sx={(theme) => ({ ...workplaceMemberCard(theme), p: 2 })}>
            <CatalogEditor
              selected={selected}
              onSaved={(item) => {
                setSelectedId(item.item.catalogItemId);
                void queryClient.invalidateQueries({
                  queryKey: ['workplace', 'services', 'admin-catalog'],
                });
              }}
            />
          </Box>
        </Box>
      )}
      <FormDialog
        open={Boolean(lifecycleCandidate)}
        title={
          lifecycleCandidate?.lifecycleState === 'ACTIVE'
            ? screenCopy.deactivateTitle
            : screenCopy.activateTitle
        }
        description={
          lifecycleCandidate?.lifecycleState === 'ACTIVE'
            ? screenCopy.deactivateDescription
            : screenCopy.activateDescription
        }
        cancelLabel={t('actions.cancel')}
        submitLabel={
          lifecycleCandidate?.lifecycleState === 'ACTIVE'
            ? t('workplace.services.catalog.deactivate')
            : t('workplace.services.catalog.activate')
        }
        submittingLabel={t('actions.saving')}
        submitIntent={lifecycleCandidate?.lifecycleState === 'ACTIVE' ? 'danger' : 'primary'}
        submitDisabled={!lifecycleReason.trim()}
        busy={stateMutation.isPending}
        onClose={() => {
          setLifecycleCandidate(null);
          setLifecycleReason('');
          stateMutation.reset();
        }}
        onSubmit={() => {
          if (lifecycleCandidate && lifecycleReason.trim()) {
            stateMutation.mutate({ item: lifecycleCandidate, reason: lifecycleReason });
          }
        }}
      >
        <Stack spacing={1.25}>
          <InlineFeedback
            severity={lifecycleCandidate?.lifecycleState === 'ACTIVE' ? 'warning' : 'info'}
          >
            {lifecycleCandidate?.lifecycleState === 'ACTIVE'
              ? screenCopy.deactivateDescription
              : screenCopy.activateDescription}
          </InlineFeedback>
          <FormField
            required
            autoFocus
            label={screenCopy.lifecycleReason}
            value={lifecycleReason}
            inputProps={{ maxLength: 500 }}
            disabled={stateMutation.isPending}
            onChange={(event) => setLifecycleReason(event.target.value)}
          />
          {stateMutation.isError ? (
            <InlineFeedback severity="error">{t('workplace.services.commandError')}</InlineFeedback>
          ) : null}
        </Stack>
      </FormDialog>
    </Box>
  );
}
