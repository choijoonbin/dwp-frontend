import { ArrowUpRight, LayoutGrid, RefreshCw, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  ActionButton,
  InlineFeedback,
  LoadingState,
  LocalErrorState,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useHrisSystemWorkspace } from '../hooks/use-hris-system';
import { HRIS_APP_GOVERNANCE_ROUTE } from '../model/hris-system-model';

import type { HrisSystemDataSource } from '../api/hris-system-api';
import type {
  HrisProjectionMenu,
  HrisSystemWorkspaceModel,
  OwnerCommandReceipt,
} from '../model/hris-system-model';

export type HrisSystemWorkspaceProps = {
  dataSource?: HrisSystemDataSource;
  ownerReceipt?: OwnerCommandReceipt;
  reconcilingOwnerReceipt?: boolean;
  onReconcileOwnerReceipt?: () => void;
};

function SourceStateChip({ source, state }: { source: string; state: string }) {
  const color = state === 'AVAILABLE' ? 'success' : state === 'UNAVAILABLE' ? 'error' : 'warning';
  return (
    <Chip
      size="small"
      variant="outlined"
      color={color}
      label={`${source}: ${state}`}
      sx={{ maxWidth: '100%', '& .MuiChip-label': { overflowWrap: 'anywhere' } }}
    />
  );
}

function MenuTree({ items }: { items: readonly HrisProjectionMenu[] }) {
  return (
    <Stack component="ul" gap={1} sx={{ p: 0, m: 0, listStyle: 'none', minWidth: 0 }}>
      {items.map((item) => (
        <Box component="li" key={item.navigationKey} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          <Typography variant="body2" fontWeight="fontWeightMedium">
            {item.label}
          </Typography>
          {item.description && (
            <Typography variant="caption" color="text.secondary">
              {item.description}
            </Typography>
          )}
          {item.children.length > 0 && (
            <Box sx={{ pl: 2, pt: 1, minWidth: 0 }}>
              <MenuTree items={item.children} />
            </Box>
          )}
        </Box>
      ))}
    </Stack>
  );
}

function OwnerReceiptNotice({
  receipt,
  reconciling,
  onReconcile,
}: {
  receipt: OwnerCommandReceipt;
  reconciling?: boolean;
  onReconcile?: () => void;
}) {
  const { t } = useTranslation('hcm');
  const unknown = receipt.status === 'RESULT_UNKNOWN';
  return (
    <InlineFeedback
      severity={unknown ? 'warning' : 'success'}
      action={
        unknown && onReconcile ? (
          <ActionButton
            intent="quiet"
            size="small"
            loading={reconciling}
            loadingLabel={t('system.owner.reconciling', {
              defaultValue: 'Reconciling owner request',
            })}
            onClick={onReconcile}
            startIcon={<RefreshCw size={16} aria-hidden="true" />}
          >
            {t('system.owner.reconcile', { defaultValue: 'Reconcile result' })}
          </ActionButton>
        ) : undefined
      }
    >
      {unknown
        ? t('system.owner.resultUnknown', {
            defaultValue:
              'The request result is unknown. Do not submit it again automatically; reconcile the original idempotency receipt first.',
          })
        : t('system.owner.receiptConfirmed', {
            defaultValue: 'The owner request receipt has been reconciled with governance state.',
          })}
    </InlineFeedback>
  );
}

export function HrisSystemWorkspaceView({
  model,
  ownerReceipt,
  reconcilingOwnerReceipt,
  onReconcileOwnerReceipt,
}: {
  model: HrisSystemWorkspaceModel;
  ownerReceipt?: OwnerCommandReceipt;
  reconcilingOwnerReceipt?: boolean;
  onReconcileOwnerReceipt?: () => void;
}) {
  const { t } = useTranslation('hcm');
  return (
    <Stack
      gap={2.5}
      data-testid="hris-system-workspace"
      sx={{
        minWidth: 0,
        maxWidth: '100%',
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        gap={1.5}
        minWidth={0}
      >
        <Box minWidth={0}>
          <Typography component="h1" variant="h4" sx={{ overflowWrap: 'anywhere' }}>
            {t('system.title', { defaultValue: 'HRIS system access' })}
          </Typography>
          <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {t('system.description', {
              defaultValue:
                'Effective tenant, scope, menu, widget, and configuration evidence for this session.',
            })}
          </Typography>
        </Box>
        {model.canOpenGovernance && (
          <ActionButton
            component={Link}
            to={HRIS_APP_GOVERNANCE_ROUTE}
            intent="secondary"
            startIcon={<ShieldCheck size={17} aria-hidden="true" />}
            endIcon={<ArrowUpRight size={16} aria-hidden="true" />}
            sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' }, whiteSpace: 'normal' }}
          >
            {t('system.governance.open', { defaultValue: 'Open app governance' })}
          </ActionButton>
        )}
      </Stack>

      {model.state === 'DENIED' && (
        <InlineFeedback severity="error">
          {t('system.denied', {
            defaultValue: 'HRIS access is unavailable for this session. Reason: {{reason}}',
            reason: model.reasonCode ?? 'DENIED',
          })}
        </InlineFeedback>
      )}
      {model.state === 'CONFIGURATION_REQUIRED' && (
        <InlineFeedback severity="warning">
          {t('system.configurationRequired', {
            defaultValue:
              'No current authorized menu or widget projection is available. Configuration or publication is required.',
          })}
        </InlineFeedback>
      )}
      {model.state === 'PARTIAL' && (
        <InlineFeedback severity="info">
          {t('system.partial', {
            defaultValue:
              'Part of the HRIS projection is unavailable. Available sections remain read-only and current.',
          })}
        </InlineFeedback>
      )}
      {ownerReceipt && (
        <OwnerReceiptNotice
          receipt={ownerReceipt}
          reconciling={reconcilingOwnerReceipt}
          onReconcile={onReconcileOwnerReceipt}
        />
      )}

      <Paper component="section" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
        <Stack gap={1.5} minWidth={0}>
          <Stack direction="row" gap={1} alignItems="center" minWidth={0}>
            <ShieldCheck size={18} aria-hidden="true" />
            <Typography component="h2" variant="subtitle1" sx={{ overflowWrap: 'anywhere' }}>
              {t('system.authority.title', { defaultValue: 'Effective authority' })}
            </Typography>
          </Stack>
          <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap minWidth={0}>
            {model.roleGroups.map((group) => (
              <Chip key={group} size="small" label={group} />
            ))}
            {model.readOnly && (
              <Chip
                size="small"
                color="info"
                label={t('system.readOnly', { defaultValue: 'Read only' })}
              />
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {t('system.authority.boundary', {
              defaultValue:
                'This projection controls presentation only. Every owner or configuration command is re-authorized by its owning API.',
            })}
          </Typography>
          <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap>
            {model.sources.map((source) => (
              <SourceStateChip key={source.source} source={source.source} state={source.state} />
            ))}
          </Stack>
        </Stack>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' },
          gap: 2,
          minWidth: 0,
        }}
      >
        <Paper component="section" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
          <Stack gap={1.5} minWidth={0}>
            <Stack direction="row" gap={1} alignItems="center">
              <LayoutGrid size={18} aria-hidden="true" />
              <Typography component="h2" variant="subtitle1">
                {t('system.menu.title', { defaultValue: 'Current menu projection' })}
              </Typography>
            </Stack>
            <Divider />
            {model.menus.length > 0 ? (
              <MenuTree items={model.menus} />
            ) : (
              <Typography variant="body2" color="text.secondary">
                {t('system.menu.empty', { defaultValue: 'No current authorized menu items.' })}
              </Typography>
            )}
          </Stack>
        </Paper>

        <Paper component="section" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
          <Stack gap={1.5} minWidth={0}>
            <Stack direction="row" gap={1} alignItems="center">
              <SlidersHorizontal size={18} aria-hidden="true" />
              <Typography component="h2" variant="subtitle1">
                {t('system.widget.title', { defaultValue: 'Current widget projection' })}
              </Typography>
            </Stack>
            <Divider />
            {model.widgets.length > 0 ? (
              <Stack component="ul" gap={1} sx={{ p: 0, m: 0, listStyle: 'none', minWidth: 0 }}>
                {model.widgets.map((widget) => (
                  <Box component="li" key={`${widget.templateId}:${widget.widgetKey}`} minWidth={0}>
                    <Typography
                      variant="body2"
                      fontWeight="fontWeightMedium"
                      sx={{ overflowWrap: 'anywhere' }}
                    >
                      {widget.widgetKey}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ overflowWrap: 'anywhere' }}
                    >
                      {widget.templateName}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {t('system.widget.empty', { defaultValue: 'No current authorized widgets.' })}
              </Typography>
            )}
          </Stack>
        </Paper>
      </Box>
    </Stack>
  );
}

export function HrisSystemWorkspace({
  dataSource,
  ownerReceipt,
  reconcilingOwnerReceipt,
  onReconcileOwnerReceipt,
}: HrisSystemWorkspaceProps) {
  const { t } = useTranslation('hcm');
  const query = useHrisSystemWorkspace(dataSource);
  if (query.isLoading) {
    return (
      <LoadingState
        embedded
        size="page"
        label={t('system.loading', { defaultValue: 'Loading HRIS system evidence' })}
      />
    );
  }
  if (query.isError || !query.data) {
    return (
      <LocalErrorState
        size="page"
        title={t('system.error.title', { defaultValue: 'HRIS system evidence is unavailable' })}
        description={t('system.error.description', {
          defaultValue: 'Nothing was changed. Retry to request a fresh tenant-bound projection.',
        })}
        retryLabel={t('common.actions.retry', { defaultValue: 'Retry' })}
        retrying={query.isFetching}
        onRetry={() => void query.refetch()}
      />
    );
  }
  return (
    <HrisSystemWorkspaceView
      model={query.data}
      ownerReceipt={ownerReceipt}
      reconcilingOwnerReceipt={reconcilingOwnerReceipt}
      onReconcileOwnerReceipt={onReconcileOwnerReceipt}
    />
  );
}
