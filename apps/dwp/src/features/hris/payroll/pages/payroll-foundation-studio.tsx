import { useTranslation } from 'react-i18next';
import {
  Edit3,
  FileCheck2,
  FlaskConical,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import {
  ActionButton,
  FormDialog,
  GlyphSurface,
  InlineFeedback,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { HcmQueryState } from '../../../../components/hcm-query-state';
import { PayrollFoundationEditor } from '../components/payroll-foundation-editor';
import {
  FoundationCommandNotice,
  FoundationEmpty,
  PayrollFoundationDetail,
} from '../components/payroll-foundation-panels';
import { usePayrollFoundationStudio } from '../hooks/use-payroll-foundation-studio';
import { foundationCopyValue, getPayrollFoundationCopy } from '../model/payroll-foundation-copy';

import type { PayrollFoundationDataSource } from '../api/payroll-foundation-api';
import type { ProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';

export type PayrollFoundationStudioProps = Readonly<{
  requestScope: ProductSurfaceRequestScope;
  dataSource?: PayrollFoundationDataSource;
}>;

function FreshnessNotice({
  state,
  copy,
}: {
  state: 'LIVE' | 'STALE' | 'PARTIAL' | 'UNAVAILABLE';
  copy: ReturnType<typeof getPayrollFoundationCopy>;
}) {
  if (state === 'LIVE') return null;
  const content = {
    STALE: [copy.staleTitle, copy.staleDescription],
    PARTIAL: [copy.partialTitle, copy.partialDescription],
    UNAVAILABLE: [copy.unavailableTitle, copy.unavailableDescription],
  }[state];
  return (
    <InlineFeedback severity={state === 'UNAVAILABLE' ? 'error' : 'warning'} title={content[0]}>
      {content[1]}
    </InlineFeedback>
  );
}

export function PayrollFoundationStudioRuntime({
  requestScope,
  dataSource,
}: Required<Pick<PayrollFoundationStudioProps, 'requestScope'>> &
  Pick<PayrollFoundationStudioProps, 'dataSource'>) {
  const { i18n } = useTranslation('hcm');
  const copy = getPayrollFoundationCopy(i18n.resolvedLanguage, i18n.language);
  const studio = usePayrollFoundationStudio({ requestScope, dataSource });

  if (studio.loading || studio.blockingError) {
    return (
      <HcmQueryState
        loading={studio.loading}
        error={studio.blockingError}
        retrying={studio.fetching}
        onRetry={studio.ready ? () => void studio.refresh() : undefined}
        size="page"
      />
    );
  }
  if (!studio.workspace) return null;

  const freshness =
    studio.workspace.freshness === 'LIVE'
      ? (studio.selected?.freshness.state ?? 'LIVE')
      : studio.workspace.freshness;
  const actionBusy = studio.busy || studio.receiptBusy || studio.mutationBlocked;
  return (
    <Stack gap={2} data-testid="payroll-foundation-studio" data-slice="BASE-TFR-PAY-007">
      <Paper component="header" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} gap={1.5}>
          <GlyphSurface size={44} variant="soft">
            <FileCheck2 size={22} aria-hidden="true" />
          </GlyphSurface>
          <Box minWidth={0} flex={1}>
            <Typography variant="overline" color="text.secondary">
              {copy.eyebrow}
            </Typography>
            <Typography component="h2" variant="h5" sx={{ overflowWrap: 'anywhere' }}>
              {copy.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {copy.description}
            </Typography>
          </Box>
          <Stack direction="row" gap={1} flexWrap="wrap" useFlexGap>
            <ActionButton
              intent="quiet"
              size="small"
              loading={studio.fetching}
              startIcon={<RefreshCw size={15} aria-hidden="true" />}
              onClick={() => void studio.refresh()}
            >
              {copy.refresh}
            </ActionButton>
            <ActionButton
              intent="primary"
              size="small"
              startIcon={<Plus size={15} aria-hidden="true" />}
              disabled={!studio.access?.canCreate || actionBusy}
              onClick={studio.beginCreate}
            >
              {copy.create}
            </ActionButton>
          </Stack>
        </Stack>
      </Paper>

      <FreshnessNotice state={freshness} copy={copy} />
      {studio.backgroundError && (
        <InlineFeedback
          severity="warning"
          title={copy.partialTitle}
          action={
            <ActionButton
              intent="quiet"
              size="small"
              loading={studio.fetching}
              onClick={() => void studio.refresh()}
            >
              {copy.retry}
            </ActionButton>
          }
        >
          {copy.partialDescription}
        </InlineFeedback>
      )}

      <FoundationCommandNotice
        receipt={studio.receipt}
        failure={studio.failure}
        copy={copy}
        busy={studio.receiptBusy || studio.fetching}
        canReconcile={Boolean(studio.access?.canReconcile)}
        onRefresh={() => void studio.refresh()}
        onCheck={studio.checkReceipt}
        onReconcile={studio.reconcileReceipt}
      />

      {!studio.workspace.configurations.length ? (
        <FoundationEmpty copy={copy} />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              lg: 'minmax(220px, 280px) minmax(0, 1fr)',
            },
            gap: 2,
            alignItems: 'start',
          }}
        >
          <Paper
            component="nav"
            aria-label={copy.configurations}
            variant="outlined"
            sx={{ minWidth: 0 }}
          >
            <Box sx={{ p: 1.5, pb: 0.5 }}>
              <Typography component="h3" variant="subtitle1">
                {copy.configurations}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {foundationCopyValue(copy.configurationCount, {
                  count: studio.workspace.configurations.length,
                })}
              </Typography>
            </Box>
            <List disablePadding>
              {studio.workspace.configurations.map((configuration) => (
                <ListItem key={configuration.id} disablePadding>
                  <ListItemButton
                    selected={configuration.id === studio.selectedId}
                    aria-label={foundationCopyValue(copy.selectConfiguration, {
                      name: configuration.definition.legalEntity.displayName,
                    })}
                    onClick={() => studio.selectConfiguration(configuration.id)}
                    sx={{ alignItems: 'flex-start', minWidth: 0 }}
                  >
                    <ListItemText
                      primary={configuration.definition.legalEntity.displayName}
                      secondary={`${configuration.definition.payrollGroup.code} · ${foundationCopyValue(
                        copy.versionLabel,
                        { version: configuration.version }
                      )}`}
                      primaryTypographyProps={{ sx: { overflowWrap: 'anywhere' } }}
                      secondaryTypographyProps={{ sx: { overflowWrap: 'anywhere' } }}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={configuration.status}
                      sx={{ ml: 1 }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Paper>

          {studio.selected && (
            <Stack gap={1.5} minWidth={0}>
              <Paper component="section" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  alignItems={{ md: 'center' }}
                  gap={1.5}
                >
                  <Box minWidth={0} flex={1}>
                    <Stack
                      direction="row"
                      gap={0.75}
                      flexWrap="wrap"
                      useFlexGap
                      alignItems="center"
                    >
                      <Typography component="h3" variant="h6" sx={{ overflowWrap: 'anywhere' }}>
                        {studio.selected.definition.legalEntity.displayName}
                      </Typography>
                      <Chip
                        size="small"
                        label={foundationCopyValue(copy.versionLabel, {
                          version: studio.selected.version,
                        })}
                      />
                      <Chip size="small" variant="outlined" label={studio.selected.status} />
                      <Chip
                        size="small"
                        variant="outlined"
                        color={studio.selected.freshness.state === 'LIVE' ? 'success' : 'warning'}
                        label={studio.selected.freshness.state}
                      />
                    </Stack>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.5, overflowWrap: 'anywhere' }}
                    >
                      {studio.selected.definition.payrollGroup.code} ·{' '}
                      {studio.selected.definition.payCalendar.cadence}
                    </Typography>
                  </Box>
                  <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap>
                    <ActionButton
                      intent="quiet"
                      size="small"
                      startIcon={<Edit3 size={14} aria-hidden="true" />}
                      disabled={
                        !studio.access?.canEdit ||
                        studio.selected.status === 'PUBLISHED' ||
                        actionBusy
                      }
                      onClick={studio.beginEdit}
                    >
                      {copy.edit}
                    </ActionButton>
                    <ActionButton
                      intent="secondary"
                      size="small"
                      loading={studio.busy}
                      startIcon={<FlaskConical size={14} aria-hidden="true" />}
                      disabled={!studio.canSimulate || actionBusy}
                      onClick={studio.simulate}
                    >
                      {copy.simulate}
                    </ActionButton>
                    <ActionButton
                      intent="primary"
                      size="small"
                      startIcon={<ShieldCheck size={14} aria-hidden="true" />}
                      disabled={!studio.canPublish || actionBusy}
                      aria-describedby="payroll-publish-requirements"
                      onClick={() => studio.setPublishReviewOpen(true)}
                    >
                      {copy.publish}
                    </ActionButton>
                    {studio.selected.status === 'PUBLISHED' && (
                      <ActionButton
                        intent="danger"
                        size="small"
                        loading={studio.busy}
                        startIcon={<RotateCcw size={14} aria-hidden="true" />}
                        disabled={!studio.canReverse || actionBusy}
                        onClick={() => studio.setReverseReviewOpen(true)}
                      >
                        {copy.reverse}
                      </ActionButton>
                    )}
                  </Stack>
                </Stack>
              </Paper>

              <InlineFeedback severity="info" title={copy.authorPublisher}>
                {copy.authorPublisherDescription}
              </InlineFeedback>

              {studio.publishBlockers.length > 0 && (
                <Paper
                  id="payroll-publish-requirements"
                  component="section"
                  variant="outlined"
                  sx={{ p: 1.5 }}
                >
                  <Typography component="h4" variant="subtitle2">
                    {copy.publishBlocked}
                  </Typography>
                  <Stack component="ul" sx={{ pl: 2.5, mb: 0 }}>
                    {studio.publishBlockers.map((blocker) => (
                      <Typography
                        component="li"
                        variant="caption"
                        key={blocker}
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {blocker}
                      </Typography>
                    ))}
                  </Stack>
                </Paper>
              )}

              <PayrollFoundationDetail
                configuration={studio.selected}
                versions={studio.versions}
                versionsError={studio.versionsError}
                copy={copy}
              />
            </Stack>
          )}
        </Box>
      )}

      <PayrollFoundationEditor
        draft={studio.draft}
        copy={copy}
        valid={Boolean(studio.validation?.valid)}
        busy={studio.busy}
        submitBlocked={studio.mutationBlocked}
        onChange={(update) => studio.setDraft((current) => (current ? update(current) : current))}
        onClose={studio.closeDraft}
        onSave={studio.saveDraft}
      />

      <FormDialog
        open={studio.publishReviewOpen}
        title={copy.publishReviewTitle}
        description={copy.publishReviewDescription}
        cancelLabel={copy.cancel}
        submitLabel={copy.publishConfirm}
        submitIntent="primary"
        busy={studio.busy}
        submitDisabled={!studio.canPublish}
        onClose={() => studio.setPublishReviewOpen(false)}
        onSubmit={() => {
          studio.publish();
        }}
      >
        {studio.selected && (
          <Stack gap={1}>
            <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
              {studio.selected.definition.legalEntity.displayName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {`${foundationCopyValue(copy.versionLabel, {
                version: studio.selected.version,
              })} · ${studio.selected.status} · ${studio.selected.freshness.state}`}
            </Typography>
            <Typography variant="body2">
              {studio.selected.definition.effectivePeriod.startsOn} —{' '}
              {studio.selected.definition.effectivePeriod.endsOn ?? copy.openEnded}
            </Typography>
          </Stack>
        )}
      </FormDialog>

      <FormDialog
        open={studio.reverseReviewOpen}
        title={copy.reverseReviewTitle}
        description={copy.reverseReviewDescription}
        cancelLabel={copy.cancel}
        submitLabel={copy.reverseConfirm}
        submitIntent="danger"
        busy={studio.busy}
        submitDisabled={!studio.canReverse}
        onClose={() => studio.setReverseReviewOpen(false)}
        onSubmit={() => {
          studio.reverse();
        }}
      >
        {studio.selected && (
          <Stack gap={1}>
            <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
              {studio.selected.definition.legalEntity.displayName}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              {`${foundationCopyValue(copy.versionLabel, {
                version: studio.selected.version,
              })} · ${studio.selected.lastCommandId}`}
            </Typography>
          </Stack>
        )}
      </FormDialog>
    </Stack>
  );
}

export function PayrollFoundationStudio({
  requestScope,
  dataSource,
}: PayrollFoundationStudioProps) {
  return <PayrollFoundationStudioRuntime requestScope={requestScope} dataSource={dataSource} />;
}

export default PayrollFoundationStudio;
