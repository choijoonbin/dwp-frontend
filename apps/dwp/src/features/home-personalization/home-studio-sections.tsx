import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  Check,
  Clock3,
  CopyPlus,
  History,
  Laptop,
  LayoutDashboard,
  Plus,
  RotateCcw,
  Smartphone,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { ActionButton, ConfirmDialog, EmptyState, FormField } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import type {
  HomeComposerProposal,
  HomeDeviceClass,
  HomeDeviceLayout,
  HomeTemplate,
  HomeView,
  HomeViewRevision,
  HomeWidgetConfiguration,
  HomeWidgetSize,
} from '@dwp-frontend/shared-utils';
import {
  buildHomeWidgetConfiguration,
  homeWidgetContentContract,
} from './home-widget-content-contract';
import { buildFlowDeviceWidthControls, mergeFlowDeviceWidthOverrides } from './home-device-overlay';
import { homeRevisionSourceLabel, homeRevisionSummaryLabel } from './home-history-localization';
import type { HomeWorkstyleIntent } from './home-personalization-model';

function flowDeviceSizeLabel(size: HomeWidgetSize) {
  if (size === 'compact') return 'device.compactWidth';
  return `device.${size}`;
}

function contentSelectionState(view: HomeView | null, widgetKey: string) {
  const contract = homeWidgetContentContract(widgetKey);
  const saved = view?.widgetConfigurations?.[widgetKey];
  const savedFields = Array.isArray(saved?.fieldKeys)
    ? saved.fieldKeys.filter((field) => contract?.fieldKeys.includes(field))
    : [];
  return {
    rowBudget:
      typeof saved?.itemLimit === 'number'
        ? Math.min(3, Math.max(1, Math.trunc(saved.itemLimit)))
        : 3,
    fieldKeys: savedFields.length > 0 ? savedFields : [...(contract?.fieldKeys ?? [])],
    filterPreset:
      typeof saved?.filterPreset === 'string' &&
      contract?.filterPresets.includes(saved.filterPreset)
        ? saved.filterPreset
        : (contract?.filterPresets[0] ?? ''),
  };
}

export function StudioSectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'stretch', sm: 'flex-start' }}
      justifyContent="space-between"
      gap={2}
      sx={{ mb: 3 }}
    >
      <Box>
        <Typography component="h3" variant="h5" sx={{ letterSpacing: '-0.025em' }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 680 }}>
          {description}
        </Typography>
      </Box>
      {action}
    </Stack>
  );
}

export function HomeProfilesSection({
  views,
  selectedViewId,
  busy,
  seedAvailable,
  onSelect,
  onCreate,
  onActivate,
  onDelete,
  onEdit,
}: {
  views: readonly HomeView[];
  selectedViewId: string | null;
  busy: boolean;
  seedAvailable: boolean;
  onSelect: (view: HomeView) => void;
  onCreate: (name: string) => void;
  onActivate: (view: HomeView) => void;
  onDelete: (view: HomeView) => void;
  onEdit: (view: HomeView) => void;
}) {
  const { t } = useTranslation('homeStudio');
  const [name, setName] = useState('');
  const [deleting, setDeleting] = useState<HomeView | null>(null);
  const canCreate = name.trim().length > 0 && views.length < 10 && seedAvailable;

  return (
    <>
      <StudioSectionHeading title={t('profiles.title')} description={t('profiles.description')} />
      <Stack
        component="form"
        direction={{ xs: 'column', sm: 'row' }}
        gap={1}
        onSubmit={(event) => {
          event.preventDefault();
          if (!canCreate) return;
          onCreate(name.trim());
          setName('');
        }}
        sx={{ mb: 3, maxWidth: 620 }}
      >
        <FormField
          size="small"
          label={t('profiles.newName')}
          value={name}
          inputProps={{ maxLength: 80 }}
          onChange={(event) => setName(event.target.value)}
        />
        <ActionButton
          type="submit"
          intent="primary"
          startIcon={<Plus size={17} />}
          disabled={!canCreate || busy}
          sx={{ minWidth: 132 }}
        >
          {t('profiles.create')}
        </ActionButton>
      </Stack>

      {views.length === 0 ? (
        <EmptyState
          size="standard"
          icon={<LayoutDashboard size={28} />}
          title={t('profiles.empty')}
        />
      ) : (
        <Stack
          component="ul"
          sx={{ listStyle: 'none', p: 0, m: 0, borderTop: 1, borderColor: 'divider' }}
        >
          {views.map((view) => {
            const selected = selectedViewId === view.viewId;
            const canDelete = views.length > 1 && !view.isDefault;
            return (
              <Box
                component="li"
                key={view.viewId}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
                  alignItems: 'center',
                  gap: 1,
                  py: 1.25,
                  borderBottom: 1,
                  borderColor: 'divider',
                  bgcolor: selected ? 'action.selected' : 'transparent',
                }}
              >
                <ButtonBase
                  aria-pressed={selected}
                  onClick={() => onSelect(view)}
                  sx={{
                    minWidth: 0,
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    px: 1.5,
                    py: 1,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                      <Typography variant="subtitle1" noWrap>
                        {view.name}
                      </Typography>
                      {view.isDefault && (
                        <Chip size="small" color="primary" label={t('common.active')} />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {t('common.updated', {
                        time: formatDate(new Date(view.updatedAt), {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }),
                      })}
                    </Typography>
                  </Box>
                </ButtonBase>
                <Stack direction="row" gap={0.75} px={1.5} flexWrap="wrap">
                  {!view.isDefault && (
                    <ActionButton
                      size="small"
                      intent="secondary"
                      onClick={() => onActivate(view)}
                      disabled={busy}
                    >
                      {t('profiles.activate')}
                    </ActionButton>
                  )}
                  <ActionButton
                    size="small"
                    intent="quiet"
                    onClick={() => onEdit(view)}
                    disabled={busy || !view.isDefault}
                    title={!view.isDefault ? t('profiles.activateBeforeEdit') : undefined}
                  >
                    {t('profiles.edit')}
                  </ActionButton>
                  <ActionButton
                    size="small"
                    intent="quiet"
                    startIcon={<Trash2 size={15} />}
                    disabled={busy || !canDelete}
                    title={!canDelete ? t('profiles.cannotDelete') : undefined}
                    onClick={() => setDeleting(view)}
                    sx={{ color: 'error.main' }}
                  >
                    {t('common.delete')}
                  </ActionButton>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('common.delete')}
        description={deleting?.name ?? ''}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        intent="danger"
        busy={busy}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) onDelete(deleting);
          setDeleting(null);
        }}
      />
    </>
  );
}

export function HomeContentSection({
  view,
  busy,
  onSave,
}: {
  view: HomeView | null;
  busy: boolean;
  onSave: (widgetKey: string, configuration: HomeWidgetConfiguration) => void;
}) {
  const { t } = useTranslation('homeStudio');
  const widgets = useMemo(
    () =>
      view?.layout.widgets.filter((widget) =>
        Boolean(homeWidgetContentContract(widget.widgetKey))
      ) ?? [],
    [view]
  );
  const [widgetKey, setWidgetKey] = useState('');
  const [rowBudget, setRowBudget] = useState(3);
  const contract = homeWidgetContentContract(widgetKey);

  useEffect(() => {
    const nextKey = widgets.some((widget) => widget.widgetKey === widgetKey)
      ? widgetKey
      : (widgets[0]?.widgetKey ?? '');
    const nextState = contentSelectionState(view, nextKey);
    setWidgetKey(nextKey);
    setRowBudget(nextState.rowBudget);
  }, [view, widgetKey, widgets]);

  if (!view) return <EmptyState title={t('common.noSelection')} size="standard" />;

  return (
    <>
      <StudioSectionHeading title={t('content.title')} description={t('content.description')} />
      <Stack gap={2.5} sx={{ maxWidth: 620 }}>
        <FormControl fullWidth size="small">
          <InputLabel id="home-studio-widget-label">{t('content.widget')}</InputLabel>
          <Select
            labelId="home-studio-widget-label"
            label={t('content.widget')}
            value={widgetKey}
            onChange={(event) => {
              const nextKey = event.target.value;
              const nextState = contentSelectionState(view, nextKey);
              setWidgetKey(nextKey);
              setRowBudget(nextState.rowBudget);
            }}
          >
            {widgets.map((widget) => (
              <MenuItem key={widget.widgetKey} value={widget.widgetKey}>
                {t(`content.widgetLabels.${widget.widgetKey}`, {
                  defaultValue: widget.widgetKey,
                })}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth size="small">
          <InputLabel id="home-studio-row-budget-label">{t('content.rowBudget')}</InputLabel>
          <Select
            labelId="home-studio-row-budget-label"
            label={t('content.rowBudget')}
            value={rowBudget}
            onChange={(event) => setRowBudget(Number(event.target.value))}
          >
            {[1, 2, 3].map((rows) => (
              <MenuItem key={rows} value={rows}>
                {rows}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <ActionButton
          intent="primary"
          disabled={!widgetKey || !contract || busy}
          loading={busy}
          onClick={() => {
            const selection = contentSelectionState(view, widgetKey);
            onSave(
              widgetKey,
              buildHomeWidgetConfiguration(
                widgetKey,
                selection.fieldKeys,
                selection.filterPreset,
                rowBudget
              )
            );
          }}
          sx={{ alignSelf: 'flex-start' }}
        >
          {t('common.save')}
        </ActionButton>
      </Stack>
    </>
  );
}

export function HomeDeviceSection({
  view,
  layouts,
  busy,
  onSave,
}: {
  view: HomeView | null;
  layouts: readonly HomeDeviceLayout[];
  busy: boolean;
  onSave: (
    deviceClass: HomeDeviceClass,
    density: 'comfortable' | 'compact',
    widgetSizes: Record<string, HomeWidgetSize>
  ) => void;
}) {
  const { t } = useTranslation('homeStudio');
  const [deviceClass, setDeviceClass] = useState<HomeDeviceClass>('DESKTOP');
  const saved = layouts.find((layout) => layout.deviceClass === deviceClass);
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [widgetSizes, setWidgetSizes] = useState<Record<string, HomeWidgetSize>>({});
  const widthControls = useMemo(
    () => buildFlowDeviceWidthControls(view?.layout.widgets ?? []),
    [view]
  );

  useEffect(() => {
    setDensity(saved?.overlay.density ?? 'comfortable');
    setWidgetSizes(
      Object.fromEntries(
        widthControls.map((control) => {
          const candidate = saved?.overlay.widgetSizes[control.storageKey] ?? control.sourceSize;
          const allowed = control.allowedSizes;
          return [
            control.storageKey,
            allowed.includes(candidate as never) ? (candidate as HomeWidgetSize) : allowed[0],
          ];
        })
      )
    );
  }, [
    deviceClass,
    saved?.version,
    saved?.overlay.density,
    saved?.overlay.widgetSizes,
    widthControls,
  ]);

  if (!view) return <EmptyState title={t('common.noSelection')} size="standard" />;

  return (
    <>
      <StudioSectionHeading title={t('device.title')} description={t('device.description')} />
      <Stack gap={3} sx={{ maxWidth: 620 }}>
        <ToggleButtonGroup
          exclusive
          value={deviceClass}
          aria-label={t('device.title')}
          onChange={(_, next: HomeDeviceClass | null) => next && setDeviceClass(next)}
        >
          <ToggleButton value="DESKTOP">
            <Laptop size={17} />
            <Box component="span" sx={{ ml: 1 }}>
              {t('device.desktop')}
            </Box>
          </ToggleButton>
          <ToggleButton value="MOBILE">
            <Smartphone size={17} />
            <Box component="span" sx={{ ml: 1 }}>
              {t('device.mobile')}
            </Box>
          </ToggleButton>
        </ToggleButtonGroup>
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t('device.density')}
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={density}
            aria-label={t('device.density')}
            onChange={(_, next: 'comfortable' | 'compact' | null) => next && setDensity(next)}
          >
            <ToggleButton value="comfortable">{t('device.comfortable')}</ToggleButton>
            <ToggleButton value="compact">{t('device.compact')}</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        {deviceClass === 'DESKTOP' && widthControls.length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {t('device.widgetSizes')}
            </Typography>
            <Stack gap={1.5}>
              {widthControls.map((control) => {
                const label = t(control.labelKey, {
                  defaultValue: control.storageKey,
                });
                const labelId = `home-studio-device-size-${control.storageKey}`;
                const allowed = control.allowedSizes;
                const selectedSize = widgetSizes[control.storageKey] ?? allowed[0];
                return (
                  <FormControl key={control.storageKey} fullWidth size="small">
                    <InputLabel id={labelId}>{label}</InputLabel>
                    <Select
                      labelId={labelId}
                      label={label}
                      value={selectedSize}
                      onChange={(event) =>
                        setWidgetSizes((current) => ({
                          ...current,
                          [control.storageKey]: event.target.value as HomeWidgetSize,
                        }))
                      }
                    >
                      {allowed.map((size) => (
                        <MenuItem key={size} value={size}>
                          {t(flowDeviceSizeLabel(size))}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                );
              })}
            </Stack>
          </Box>
        )}
        <ActionButton
          intent="primary"
          loading={busy}
          onClick={() =>
            onSave(
              deviceClass,
              density,
              deviceClass === 'DESKTOP'
                ? mergeFlowDeviceWidthOverrides(saved?.overlay.widgetSizes ?? {}, widgetSizes)
                : mergeFlowDeviceWidthOverrides(saved?.overlay.widgetSizes ?? {}, {})
            )
          }
          sx={{ alignSelf: 'flex-start' }}
        >
          {t('common.save')}
        </ActionButton>
      </Stack>
    </>
  );
}

export function HomeTemplatesSection({
  templates,
  view,
  canManage,
  busy,
  onApply,
  onDraft,
  onPublish,
  onRevoke,
}: {
  templates: readonly HomeTemplate[];
  view: HomeView | null;
  canManage: boolean;
  busy: boolean;
  onApply: (template: HomeTemplate) => void;
  onDraft: () => void;
  onPublish: (template: HomeTemplate) => void;
  onRevoke: (template: HomeTemplate) => void;
}) {
  const { t } = useTranslation('homeStudio');
  const [pendingAction, setPendingAction] = useState<{
    template: HomeTemplate;
    action: 'apply' | 'publish' | 'revoke';
  } | null>(null);
  return (
    <>
      <StudioSectionHeading
        title={t('templates.title')}
        description={t('templates.description')}
        action={
          canManage && view ? (
            <ActionButton
              intent="secondary"
              startIcon={<CopyPlus size={17} />}
              onClick={onDraft}
              disabled={busy}
            >
              {t('templates.draftFromCurrent')}
            </ActionButton>
          ) : undefined
        }
      />
      {templates.length === 0 ? (
        <EmptyState title={t('templates.empty')} size="standard" />
      ) : (
        <Stack
          component="ul"
          sx={{ listStyle: 'none', p: 0, m: 0, borderTop: 1, borderColor: 'divider' }}
        >
          {templates.map((template) => (
            <Stack
              component="li"
              key={template.templateId}
              direction={{ xs: 'column', md: 'row' }}
              alignItems={{ xs: 'stretch', md: 'center' }}
              justifyContent="space-between"
              gap={2}
              sx={{ py: 2, px: 1, borderBottom: 1, borderColor: 'divider' }}
            >
              <Box>
                <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="subtitle1">{template.name}</Typography>
                  <Chip
                    size="small"
                    label={template.lifecycle}
                    color={template.lifecycle === 'PUBLISHED' ? 'success' : 'default'}
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {t('templates.audience', {
                    audience:
                      template.audience.type === 'ALL'
                        ? 'ALL'
                        : template.audience.values.join(', '),
                  })}
                </Typography>
              </Box>
              <Stack direction="row" gap={0.75} flexWrap="wrap">
                {template.lifecycle === 'PUBLISHED' && (
                  <ActionButton
                    intent="primary"
                    size="small"
                    disabled={!view || busy}
                    onClick={() => setPendingAction({ template, action: 'apply' })}
                  >
                    {t('templates.apply')}
                  </ActionButton>
                )}
                {canManage && template.lifecycle === 'DRAFT' && (
                  <ActionButton
                    size="small"
                    onClick={() => setPendingAction({ template, action: 'publish' })}
                    disabled={busy}
                  >
                    {t('templates.publish')}
                  </ActionButton>
                )}
                {canManage && template.lifecycle === 'PUBLISHED' && (
                  <ActionButton
                    size="small"
                    intent="quiet"
                    onClick={() => setPendingAction({ template, action: 'revoke' })}
                    disabled={busy}
                    sx={{ color: 'error.main' }}
                  >
                    {t('templates.revoke')}
                  </ActionButton>
                )}
              </Stack>
            </Stack>
          ))}
        </Stack>
      )}
      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={t(`templates.confirm.${pendingAction?.action ?? 'apply'}.title`)}
        description={t(`templates.confirm.${pendingAction?.action ?? 'apply'}.description`, {
          name: pendingAction?.template.name ?? '',
        })}
        cancelLabel={t('common.cancel')}
        confirmLabel={t(`templates.confirm.${pendingAction?.action ?? 'apply'}.action`)}
        intent={pendingAction?.action === 'revoke' ? 'danger' : 'primary'}
        busy={busy}
        onClose={() => setPendingAction(null)}
        onConfirm={() => {
          if (!pendingAction) return;
          if (pendingAction.action === 'apply') onApply(pendingAction.template);
          else if (pendingAction.action === 'publish') onPublish(pendingAction.template);
          else onRevoke(pendingAction.template);
          setPendingAction(null);
        }}
      />
    </>
  );
}

export function HomeHistorySection({
  view,
  revisions,
  busy,
  onRestore,
}: {
  view: HomeView | null;
  revisions: readonly HomeViewRevision[];
  busy: boolean;
  onRestore: (revision: HomeViewRevision) => void;
}) {
  const { t } = useTranslation('homeStudio');
  const [restoring, setRestoring] = useState<HomeViewRevision | null>(null);
  if (!view) return <EmptyState title={t('common.noSelection')} size="standard" />;
  return (
    <>
      <StudioSectionHeading title={t('history.title')} description={t('history.description')} />
      {revisions.length === 0 ? (
        <EmptyState icon={<History size={28} />} title={t('history.empty')} size="standard" />
      ) : (
        <Stack
          component="ol"
          sx={{ listStyle: 'none', p: 0, m: 0, borderTop: 1, borderColor: 'divider' }}
        >
          {revisions.map((revision) => (
            <Stack
              component="li"
              key={revision.revisionId}
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              gap={2}
              sx={{ py: 1.75, px: 1, borderBottom: 1, borderColor: 'divider' }}
            >
              <Stack direction="row" gap={1.5} alignItems="flex-start">
                <Clock3 size={18} aria-hidden="true" />
                <Box>
                  <Typography variant="subtitle2">
                    {t('history.revision', { number: revision.revisionNumber })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {homeRevisionSummaryLabel(t, revision.changeSummary)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {homeRevisionSourceLabel(t, revision.source)} ·{' '}
                    {formatDate(new Date(revision.createdAt), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </Typography>
                </Box>
              </Stack>
              <ActionButton
                size="small"
                intent="quiet"
                startIcon={<RotateCcw size={15} />}
                disabled={busy}
                onClick={() => setRestoring(revision)}
              >
                {t('history.restore')}
              </ActionButton>
            </Stack>
          ))}
        </Stack>
      )}
      <ConfirmDialog
        open={Boolean(restoring)}
        title={t('history.restore')}
        description={restoring ? t('history.revision', { number: restoring.revisionNumber }) : ''}
        confirmLabel={t('history.restore')}
        cancelLabel={t('common.cancel')}
        busy={busy}
        onClose={() => setRestoring(null)}
        onConfirm={() => {
          if (restoring) onRestore(restoring);
          setRestoring(null);
        }}
      />
    </>
  );
}

export function HomeAiSection({
  view,
  proposal,
  busy,
  onRequest,
  onApply,
  onUndo,
}: {
  view: HomeView | null;
  proposal: HomeComposerProposal | null;
  busy: boolean;
  onRequest: (intent: HomeWorkstyleIntent) => void;
  onApply: (proposal: HomeComposerProposal) => void;
  onUndo: (proposal: HomeComposerProposal) => void;
}) {
  const { t } = useTranslation('homeStudio');
  const [intent, setIntent] = useState<HomeWorkstyleIntent>('FOCUS_DEADLINES');
  if (!view) return <EmptyState title={t('common.noSelection')} size="standard" />;

  return (
    <>
      <StudioSectionHeading title={t('ai.title')} description={t('ai.description')} />
      <Alert severity="info" icon={<Bot size={20} />} sx={{ mb: 3, maxWidth: 760 }}>
        {t('ai.warning')}
      </Alert>
      <ToggleButtonGroup
        exclusive
        value={intent}
        aria-label={t('ai.title')}
        onChange={(_, next: HomeWorkstyleIntent | null) => next && setIntent(next)}
        sx={{ mb: 2, flexWrap: 'wrap' }}
      >
        <ToggleButton value="FOCUS_DEADLINES">{t('ai.focus')}</ToggleButton>
        <ToggleButton value="BALANCE_DAY">{t('ai.balance')}</ToggleButton>
        <ToggleButton value="REDUCE_NOISE">{t('ai.noise')}</ToggleButton>
      </ToggleButtonGroup>
      <Box>
        <ActionButton
          intent="secondary"
          startIcon={<Sparkles size={17} />}
          loading={busy}
          onClick={() => onRequest(intent)}
        >
          {t('ai.request')}
        </ActionButton>
      </Box>

      {proposal && (
        <Box
          component="section"
          aria-labelledby="home-ai-preview-title"
          sx={{ mt: 4, maxWidth: 760 }}
        >
          <Divider sx={{ mb: 3 }} />
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
            <Typography id="home-ai-preview-title" component="h4" variant="h6">
              {t('ai.previewTitle')}
            </Typography>
            <Chip
              label={proposal.state}
              color={proposal.state === 'APPLIED' ? 'success' : 'primary'}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            {t('ai.reason')}: {proposal.reasonCodes.join(', ')}
          </Typography>
          {proposal.changes.length === 0 ? (
            <Typography sx={{ mt: 2 }}>{t('ai.noChanges')}</Typography>
          ) : (
            <Stack component="ol" gap={1} sx={{ mt: 2, pl: 3 }}>
              {proposal.changes.map((change, index) => (
                <Typography
                  component="li"
                  variant="body2"
                  key={`${change.operation}-${change.widgetKey ?? change.appId ?? index}`}
                >
                  {t(`ai.operations.${change.operation}`, {
                    target: change.widgetKey ?? change.appId ?? '',
                  })}
                </Typography>
              ))}
            </Stack>
          )}
          {proposal.warnings.length > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {proposal.warnings.join(' · ')}
            </Alert>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ mt: 3 }}>
            {proposal.state === 'PREVIEWED' && proposal.changes.length > 0 && (
              <ActionButton
                intent="primary"
                startIcon={<Check size={17} />}
                loading={busy}
                onClick={() => onApply(proposal)}
              >
                {t('ai.approve')}
              </ActionButton>
            )}
            {proposal.state === 'APPLIED' && (
              <ActionButton
                intent="secondary"
                startIcon={<RotateCcw size={17} />}
                loading={busy}
                onClick={() => onUndo(proposal)}
              >
                {t('ai.undo')}
              </ActionButton>
            )}
          </Stack>
        </Box>
      )}
    </>
  );
}
