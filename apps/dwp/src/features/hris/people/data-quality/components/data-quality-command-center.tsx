import { useEffect, useMemo, useState } from 'react';
import { DatabaseZap, Eye, ShieldCheck } from 'lucide-react';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  EnterpriseDataGrid,
  GuidedEmptyState,
  InlineFeedback,
  LiveStatus,
  OperationalContextBar,
  ResourcePageHeader,
  foundationTokens,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import { DataQualityInspector } from './data-quality-inspector';

import type { GridColDef, GridRowSelectionModel } from '@mui/x-data-grid';
import type { Hrm012Copy } from '../data-quality-copy';
import type {
  Hrm012FieldDecision,
  Hrm012Item,
  Hrm012Projection,
  Hrm012TrustedScope,
} from '../data-quality-contract';

function decisionLabel(decision: Hrm012FieldDecision | undefined, copy: Hrm012Copy): string {
  if (!decision) return '';
  if (decision.decision === 'MASK') return copy.masked;
  const value = decision.value;
  if ('code' in value) return value.code.replaceAll('_', ' ');
  if ('decisionCode' in value) return value.decisionCode.replaceAll('_', ' ');
  return value.state.replaceAll('_', ' ');
}

function MobileList({
  items,
  selectedId,
  copy,
  onSelect,
}: Readonly<{
  items: readonly Hrm012Item[];
  selectedId: string | null;
  copy: Hrm012Copy;
  onSelect: (item: Hrm012Item) => void;
}>) {
  return (
    <Paper component="section" variant="outlined" sx={{ p: 1, minWidth: 0 }}>
      <Typography component="h2" variant="subtitle1" sx={{ px: 0.5, mb: 1 }}>
        {copy.listLabel}
      </Typography>
      <Box component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
        {items.map((item) => {
          const active = item.itemPublicId === selectedId;
          return (
            <Box component="li" key={item.itemPublicId} sx={{ '& + &': { mt: 0.75 } }}>
              <Box
                component="button"
                type="button"
                data-focus-ring="keyboard-visible"
                aria-pressed={active}
                onClick={() => onSelect(item)}
                sx={{
                  width: '100%',
                  minHeight: 56,
                  p: 1.25,
                  border: 1,
                  borderColor: active ? 'primary.main' : 'divider',
                  borderRadius: foundationTokens.radius.surface + 'px',
                  bgcolor: active ? 'action.selected' : 'background.paper',
                  color: 'text.primary',
                  textAlign: 'left',
                  cursor: 'pointer',
                  '@media (forced-colors: active)': { borderColor: 'ButtonText' },
                  '@media (prefers-reduced-motion: reduce)': { scrollBehavior: 'auto' },
                  '&:focus-visible': { outline: '3px solid', outlineOffset: 2 },
                }}
              >
                <Typography
                  component="span"
                  variant="body2"
                  fontWeight={foundationTokens.home.typography.weightEmphasis}
                  display="block"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {item.title}
                </Typography>
                <Typography component="span" variant="caption" color="text.secondary">
                  {item.statusCode.replaceAll('_', ' ')}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

export function DataQualityCommandCenter({
  projection,
  scope,
  copy,
  stale,
  fetching,
  canPrevious,
  canNext,
  onRefresh,
  onPrevious,
  onNext,
}: Readonly<{
  projection: Hrm012Projection;
  scope: Hrm012TrustedScope;
  copy: Hrm012Copy;
  stale: boolean;
  fetching: boolean;
  canPrevious: boolean;
  canNext: boolean;
  onRefresh: () => void;
  onPrevious: () => void;
  onNext: () => void;
}>) {
  const theme = useTheme();
  const compactViewport = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
  const forcedColors = useMediaQuery('(forced-colors: active)', { noSsr: true });
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)', { noSsr: true });
  const [selectedId, setSelectedId] = useState<string | null>(
    compactViewport ? null : (projection.items[0]?.itemPublicId ?? null)
  );

  useEffect(() => {
    if (selectedId && !projection.items.some((item) => item.itemPublicId === selectedId)) {
      setSelectedId(compactViewport ? null : (projection.items[0]?.itemPublicId ?? null));
    }
  }, [compactViewport, projection.items, selectedId]);

  const selectedIndex = projection.items.findIndex((item) => item.itemPublicId === selectedId);
  const selected = selectedIndex < 0 ? null : projection.items[selectedIndex]!;
  const selectionModel = useMemo<GridRowSelectionModel>(
    () => ({ type: 'include', ids: new Set(selectedId ? [selectedId] : []) }),
    [selectedId]
  );
  const columns = useMemo<GridColDef<Hrm012Item>[]>(
    () => [
      { field: 'title', headerName: copy.title, minWidth: 220, flex: 1.5, sortable: false },
      {
        field: 'statusCode',
        headerName: copy.state,
        minWidth: 150,
        flex: 0.8,
        sortable: false,
        valueFormatter: (value: string) => value.replaceAll('_', ' '),
      },
      {
        field: 'ingestionStatus',
        headerName: copy.fieldLabels.INGESTION_STATUS,
        minWidth: 170,
        flex: 0.9,
        sortable: false,
        renderCell: ({ row }) => decisionLabel(row.fieldGroups.INGESTION_STATUS, copy),
      },
      {
        field: 'qualityFinding',
        headerName: copy.fieldLabels.QUALITY_FINDING,
        minWidth: 180,
        flex: 0.9,
        sortable: false,
        renderCell: ({ row }) => decisionLabel(row.fieldGroups.QUALITY_FINDING, copy),
      },
      {
        field: 'commandReceipt',
        headerName: copy.fieldLabels.COMMAND_RECEIPT,
        minWidth: 170,
        flex: 0.9,
        sortable: false,
        renderCell: ({ row }) => decisionLabel(row.fieldGroups.COMMAND_RECEIPT, copy),
      },
    ],
    [copy]
  );
  const runtimeState = stale ? 'stale' : projection.queryState.state.toLowerCase();
  const liveState = fetching
    ? 'syncing'
    : stale
      ? 'stale'
      : projection.queryState.state === 'PARTIAL'
        ? 'degraded'
        : 'live';
  const liveLabel = fetching
    ? copy.syncing
    : stale
      ? copy.stale
      : projection.queryState.state === 'PARTIAL'
        ? copy.degraded
        : copy.live;
  const formattedAsOf = formatDate(
    projection.asOf,
    { dateStyle: 'medium', timeStyle: 'short', timeZone: scope.timeZone },
    resolveSupportedLocale(scope.locale)
  );
  const select = (item: Hrm012Item) => setSelectedId(item.itemPublicId);
  const selectIndex = (index: number) => {
    const item = projection.items[index];
    if (item) setSelectedId(item.itemPublicId);
  };

  return (
    <Stack
      gap={{ xs: 2, md: 2.5 }}
      minWidth={0}
      data-testid="hrm-012-data-quality-workbench"
      data-runtime-state={runtimeState}
      data-query-id="IAQ-012"
      data-page-archetype="command-center-with-list-detail-inspector"
      data-layout-density={compactViewport ? 'compact' : 'fluid'}
      data-color-scheme={theme.palette.mode}
      data-forced-colors={forcedColors ? 'active' : 'inactive'}
      data-reduced-motion={reducedMotion ? 'active' : 'inactive'}
      sx={{
        inlineSize: '100%',
        maxInlineSize: '100%',
        overflowX: 'clip',
        '@media (forced-colors: active)': { outline: '1px solid CanvasText', outlineOffset: 2 },
        '@media (prefers-reduced-motion: reduce)': {
          '& *, & *::before, & *::after': {
            animationDuration: '0s !important',
            animationIterationCount: foundationTokens.home.motion.reducedIterationCount,
            scrollBehavior: 'auto !important',
            transitionDuration: '0s !important',
          },
        },
      }}
    >
      <ResourcePageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        scope={
          <Chip
            size="small"
            variant="outlined"
            icon={<ShieldCheck size={14} aria-hidden="true" />}
            label={copy.scopeLabel}
          />
        }
        status={
          <LiveStatus
            state={liveState}
            label={liveLabel}
            detail={formattedAsOf}
            refreshLabel={copy.refresh}
            onRefresh={onRefresh}
            refreshing={fetching}
          />
        }
      />

      <OperationalContextBar
        label={copy.contextLabel}
        items={[
          { label: copy.asOf, value: formattedAsOf, icon: <DatabaseZap size={16} /> },
          { label: copy.visibleItems, value: copy.itemCount(projection.items.length) },
          {
            label: copy.decisions,
            value: copy.decisionSummary(projection.queryState.fieldDecisionSummary),
            icon: <Eye size={16} />,
          },
        ]}
      />

      {stale && (
        <InlineFeedback severity="warning" title={copy.staleTitle}>
          {copy.staleDescription}
        </InlineFeedback>
      )}
      {projection.queryState.state === 'PARTIAL' && (
        <InlineFeedback severity="warning" title={copy.partialTitle}>
          {copy.partialDescription}
          <Box component="ul" sx={{ mb: 0, mt: 0.75, pl: 2.5 }}>
            {projection.queryState.partialFailures.map((failure) => (
              <li key={`${failure.componentKey}:${failure.correlationId}`}>
                {failure.componentKey} · {failure.errorCode}
              </li>
            ))}
          </Box>
        </InlineFeedback>
      )}

      {projection.items.length === 0 ? (
        <GuidedEmptyState
          kind="empty"
          title={copy.emptyTitle}
          description={copy.emptyDescription}
          size="page"
        />
      ) : (
        <Box
          data-archetype-composition="command-center-list-detail"
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              lg: 'minmax(0, 1fr) minmax(320px, 420px)',
            },
            gap: 2,
            alignItems: 'start',
            minWidth: 0,
          }}
        >
          {compactViewport ? (
            <MobileList
              items={projection.items}
              selectedId={selectedId}
              copy={copy}
              onSelect={select}
            />
          ) : (
            <Paper component="section" variant="outlined" sx={{ minWidth: 0, overflow: 'hidden' }}>
              <EnterpriseDataGrid<Hrm012Item>
                ariaLabel={copy.listLabel}
                rows={projection.items}
                columns={columns}
                getRowId={(row) => row.itemPublicId}
                rowSelectionModel={selectionModel}
                onRowClick={({ row }) => select(row)}
                hideFooter
                minVisibleRows={5}
                maxVisibleRows={10}
                toolbar={false}
                sx={{ border: 0, borderRadius: 0 }}
              />
            </Paper>
          )}
          {!compactViewport && (
            <Paper variant="outlined" sx={{ minWidth: 0, overflow: 'hidden' }}>
              <DataQualityInspector
                item={selected}
                copy={copy}
                locale={scope.locale}
                timeZone={scope.timeZone}
                variant="inline"
                onClose={() => setSelectedId(null)}
                onPrevious={() => selectIndex(selectedIndex - 1)}
                onNext={() => selectIndex(selectedIndex + 1)}
                previousDisabled={selectedIndex <= 0}
                nextDisabled={selectedIndex < 0 || selectedIndex >= projection.items.length - 1}
              />
            </Paper>
          )}
        </Box>
      )}

      {compactViewport && (
        <DataQualityInspector
          item={selected}
          copy={copy}
          locale={scope.locale}
          timeZone={scope.timeZone}
          variant="drawer"
          onClose={() => setSelectedId(null)}
          onPrevious={() => selectIndex(selectedIndex - 1)}
          onNext={() => selectIndex(selectedIndex + 1)}
          previousDisabled={selectedIndex <= 0}
          nextDisabled={selectedIndex < 0 || selectedIndex >= projection.items.length - 1}
        />
      )}

      <Stack direction="row" gap={1} justifyContent="flex-end" aria-live="polite">
        <ActionButton
          intent="quiet"
          disabled={!canPrevious || fetching}
          onClick={onPrevious}
          sx={{ minHeight: 44 }}
        >
          {copy.previousPage}
        </ActionButton>
        <ActionButton
          intent="quiet"
          disabled={!canNext || fetching}
          onClick={onNext}
          sx={{ minHeight: 44 }}
        >
          {copy.nextPage}
        </ActionButton>
      </Stack>
    </Stack>
  );
}
