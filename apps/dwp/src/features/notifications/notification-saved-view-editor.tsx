import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AtSign, Bell, Bookmark, Inbox, X, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getNotificationInbox } from '@dwp-frontend/shared-utils/api/notification-api';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { ActionIconButton } from '@dwp-frontend/design-system/components/actions/action-icon-button';
import { FormField } from '@dwp-frontend/design-system/components/forms/form-field';
import { SelectField } from '@dwp-frontend/design-system/components/forms/select-field';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import {
  canonicalNotificationContextFilters,
  canonicalNotificationIncludedTypes,
  MAX_NOTIFICATION_CONTEXT_FILTERS,
  MAX_NOTIFICATION_INCLUDED_TYPES,
  NOTIFICATION_INCLUDED_TYPES,
  NOTIFICATION_REASONS,
  notificationFiltersForView,
  notificationQueryFacets,
  type NotificationCenterScope,
  type NotificationContextOption,
  type NotificationIncludedType,
} from './notification-filter-model';
import {
  NOTIFICATION_SAVED_VIEW_COLORS,
  NOTIFICATION_SAVED_VIEW_ICONS,
  type NotificationCenterPresentation,
  type NotificationSavedViewColor,
  type NotificationSavedViewIcon,
} from './notification-saved-view-model';

import type { SavedViewScope } from '@dwp-frontend/shared-utils';

export type NotificationSavedViewEditorDraft = {
  name: string;
  visibility: SavedViewScope;
  ownerGroupRef: string;
  favorite: boolean;
  defaultView: boolean;
  scope: NotificationCenterScope;
  presentation: NotificationCenterPresentation;
};

type Props = {
  editing: boolean;
  draft: NotificationSavedViewEditorDraft;
  busy: boolean;
  canPublish: boolean;
  groups: Array<{ groupRef: string; displayName: string }>;
  appOptions: Array<[string, string]>;
  contextOptions: NotificationContextOption[];
  onChange: (draft: NotificationSavedViewEditorDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
};

const SAVED_VIEW_ICON = {
  BELL: Bell,
  INBOX: Inbox,
  AT_SIGN: AtSign,
  BOLT: Zap,
  BOOKMARK: Bookmark,
} as const;

const SAVED_VIEW_COLOR: Record<NotificationSavedViewColor, string> = {
  BLUE: foundationTokens.color.data.cobalt,
  TEAL: foundationTokens.color.data.teal,
  VIOLET: foundationTokens.color.data.violet,
  AMBER: foundationTokens.color.data.saffron,
  RED: foundationTokens.color.data.coral,
};

export function NotificationSavedViewEditor({
  editing,
  draft,
  busy,
  canPublish,
  groups,
  appOptions,
  contextOptions,
  onChange,
  onClose,
  onSubmit,
}: Props) {
  const { t } = useTranslation('common');
  const { t: tn } = useTranslation('notifications');
  const editorContexts = contextOptionsWithSelected(contextOptions, draft.scope.contextFilters);
  const selectedContextIds = draft.scope.contextFilters.map(contextId);
  const previewFilters = notificationFiltersForView(draft.scope, draft.scope.view);
  const canonicalTypes = canonicalNotificationIncludedTypes(previewFilters.includedTypes);
  const canonicalContexts = canonicalNotificationContextFilters(previewFilters.contextFilters);
  const previewFacets = useMemo(
    () =>
      canonicalTypes && canonicalContexts
        ? notificationQueryFacets(canonicalTypes, canonicalContexts)
        : null,
    [canonicalContexts, canonicalTypes]
  );
  const previewQuery = useQuery({
    queryKey: [
      'notifications',
      'saved-view-preview',
      draft.scope.view,
      previewFilters.query,
      previewFilters.appKey,
      previewFilters.priority,
      previewFilters.readState,
      previewFilters.reason,
      previewFilters.attentionEffect,
      previewFacets,
    ],
    queryFn: ({ signal }) =>
      getNotificationInbox(
        {
          view: draft.scope.view,
          limit: 1,
          query: previewFilters.query || undefined,
          appKey: previewFilters.appKey || undefined,
          priority: previewFilters.priority,
          readState: previewFilters.readState,
          reason: previewFilters.reason,
          attentionEffect: previewFilters.attentionEffect,
          includedTypes: previewFacets?.includedTypes ?? [],
          contexts: previewFacets?.contexts ?? [],
        },
        signal
      ),
    enabled: Boolean(previewFacets),
    staleTime: 10_000,
    retry: 1,
  });

  const patchScope = (patch: Partial<NotificationCenterScope>) =>
    onChange({ ...draft, scope: { ...draft.scope, ...patch } });
  const patchPresentation = (patch: Partial<NotificationCenterPresentation>) =>
    onChange({ ...draft, presentation: { ...draft.presentation, ...patch } });

  return (
    <Box
      component="form"
      aria-label={editing ? t('savedViews.editor.editTitle') : t('savedViews.editor.createTitle')}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      sx={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', height: '100%' }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2.5, py: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Typography component="h2" variant="h6">
          {editing ? t('savedViews.editor.editTitle') : t('savedViews.editor.createTitle')}
        </Typography>
        <ActionIconButton label={t('actions.close')} onClick={onClose}>
          <X size={18} />
        </ActionIconButton>
      </Stack>

      <Stack spacing={2.25} sx={{ p: 2.5, overflowY: 'auto' }}>
        <FormField
          autoFocus
          label={t('savedViews.editor.name')}
          value={draft.name}
          inputProps={{ maxLength: 160 }}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
        />
        <Box>
          <Typography variant="caption" color="text.secondary">
            {tn('savedViews.icon')}
          </Typography>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={draft.presentation.icon}
            onChange={(_event, icon: NotificationSavedViewIcon | null) =>
              icon && patchPresentation({ icon })
            }
            sx={{ mt: 0.75 }}
          >
            {NOTIFICATION_SAVED_VIEW_ICONS.map((icon) => {
              const Icon = SAVED_VIEW_ICON[icon];
              return (
                <ToggleButton key={icon} value={icon} aria-label={icon}>
                  <Tooltip title={icon}>
                    <Icon size={16} />
                  </Tooltip>
                </ToggleButton>
              );
            })}
          </ToggleButtonGroup>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {tn('savedViews.color')}
          </Typography>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={draft.presentation.color}
            onChange={(_event, color: NotificationSavedViewColor | null) =>
              color && patchPresentation({ color })
            }
            sx={{ mt: 0.75 }}
          >
            {NOTIFICATION_SAVED_VIEW_COLORS.map((color) => (
              <ToggleButton key={color} value={color} aria-label={color}>
                <Tooltip title={color}>
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      bgcolor: SAVED_VIEW_COLOR[color],
                    }}
                  />
                </Tooltip>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        <SelectField
          label={t('savedViews.editor.visibility')}
          value={draft.visibility}
          options={visibilityOptions(canPublish, groups.length > 0, t)}
          onValueChange={(visibility) =>
            onChange({ ...draft, visibility: visibility as SavedViewScope })
          }
        />
        {draft.visibility === 'TEAM' && (
          <SelectField
            label={t('savedViews.editor.team')}
            value={draft.ownerGroupRef}
            options={groups.map((group) => ({ value: group.groupRef, label: group.displayName }))}
            onValueChange={(ownerGroupRef) =>
              onChange({ ...draft, ownerGroupRef: String(ownerGroupRef) })
            }
          />
        )}
        <FormControlLabel
          control={
            <Switch
              checked={draft.scope.readState === 'UNREAD'}
              onChange={(event) =>
                patchScope({ readState: event.target.checked ? 'UNREAD' : 'ALL' })
              }
            />
          }
          label={tn('filters.read.UNREAD')}
        />
        <SelectField
          label={tn('filters.app')}
          value={draft.scope.appKey}
          options={[
            { value: '', label: tn('filters.allApps') },
            ...appOptions.map(([value, label]) => ({ value, label })),
          ]}
          onValueChange={(appKey) => patchScope({ appKey: String(appKey) })}
        />
        <SelectField
          label={tn('filters.attentionEffect')}
          value={draft.scope.attentionEffect}
          options={[
            { value: 'ALL', label: tn('filters.allAttention') },
            {
              value: 'PRIORITIZE',
              label: tn('filters.prioritized'),
            },
          ]}
          onValueChange={(attentionEffect) =>
            patchScope({
              attentionEffect: attentionEffect as NotificationCenterScope['attentionEffect'],
            })
          }
        />
        <SelectField
          label={tn('filters.reason')}
          value={draft.scope.reason}
          options={[
            { value: 'ALL', label: tn('filters.allReasons') },
            ...NOTIFICATION_REASONS.map((reason) => ({
              value: reason,
              label: tn(`reason.${reason}`),
            })),
          ]}
          onValueChange={(reason) =>
            patchScope({
              reason: reason as NotificationCenterScope['reason'],
              includedTypes: [],
            })
          }
        />
        <Box>
          <Typography variant="caption" color="text.secondary">
            {tn('filters.includedTypes')}
          </Typography>
          <Select
            multiple
            fullWidth
            size="small"
            value={draft.scope.includedTypes}
            onChange={(event) => {
              const values = Array.isArray(event.target.value)
                ? (event.target.value as NotificationIncludedType[])
                : (String(event.target.value).split(',') as NotificationIncludedType[]);
              patchScope({
                reason: 'ALL',
                includedTypes: values.slice(0, MAX_NOTIFICATION_INCLUDED_TYPES),
              });
            }}
            renderValue={(selected) =>
              selected.length === 0
                ? tn('filters.allTypes')
                : selected.map((type) => includedTypeLabel(type, tn)).join(', ')
            }
            displayEmpty
            inputProps={{
              'aria-label': tn('filters.includedTypes'),
            }}
            sx={{ mt: 0.75 }}
          >
            {NOTIFICATION_INCLUDED_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                <Checkbox checked={draft.scope.includedTypes.includes(type)} />
                {includedTypeLabel(type, tn)}
              </MenuItem>
            ))}
          </Select>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {tn('filters.context')}
          </Typography>
          <Select
            multiple
            fullWidth
            size="small"
            value={selectedContextIds}
            onChange={(event) => {
              const values = Array.isArray(event.target.value)
                ? event.target.value
                : String(event.target.value).split(',');
              patchScope({
                contextFilters: editorContexts
                  .filter((context) => values.includes(contextId(context)))
                  .slice(0, MAX_NOTIFICATION_CONTEXT_FILTERS),
              });
            }}
            renderValue={(selected) =>
              selected
                .map(
                  (identity) =>
                    editorContexts.find((context) => contextId(context) === identity)?.label ||
                    editorContexts.find((context) => contextId(context) === identity)?.key ||
                    identity
                )
                .join(', ') || tn('filters.allContexts')
            }
            inputProps={{ 'aria-label': tn('filters.context') }}
            sx={{ mt: 0.75 }}
          >
            {editorContexts.map((context) => (
              <MenuItem
                key={contextId(context)}
                value={contextId(context)}
                disabled={
                  selectedContextIds.length >= MAX_NOTIFICATION_CONTEXT_FILTERS &&
                  !selectedContextIds.includes(contextId(context))
                }
              >
                <Checkbox checked={selectedContextIds.includes(contextId(context))} />
                {context.label || context.key}
              </MenuItem>
            ))}
          </Select>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {tn('workbench.presentation.density.label')}
          </Typography>
          <ToggleButtonGroup
            aria-label={tn('workbench.presentation.density.label')}
            exclusive
            fullWidth
            size="small"
            value={draft.presentation.density}
            onChange={(_event, density) => density && patchPresentation({ density })}
            sx={{ mt: 0.75 }}
          >
            <ToggleButton value="DENSE">{tn('workbench.presentation.density.dense')}</ToggleButton>
            <ToggleButton value="DETAILED">
              {tn('workbench.presentation.density.detailed')}
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <SelectField
          label={tn('workbench.presentation.grouping.label')}
          value={draft.presentation.grouping}
          options={(['NONE', 'SOURCE', 'CONTEXT'] as const).map((grouping) => ({
            value: grouping,
            label: tn(`workbench.presentation.grouping.${grouping.toLocaleLowerCase()}`),
          }))}
          onValueChange={(grouping) =>
            patchPresentation({ grouping: grouping as NotificationCenterPresentation['grouping'] })
          }
        />
        {!editing && (
          <Stack>
            <FormControlLabel
              control={
                <Switch
                  checked={draft.favorite}
                  onChange={(event) => onChange({ ...draft, favorite: event.target.checked })}
                />
              }
              label={t('savedViews.editor.favorite')}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={draft.defaultView}
                  onChange={(event) => onChange({ ...draft, defaultView: event.target.checked })}
                />
              }
              label={t('savedViews.editor.defaultView')}
            />
          </Stack>
        )}
        <Box
          role="status"
          aria-live="polite"
          sx={{
            p: 1.5,
            borderRadius: foundationTokens.radius.surface,
            bgcolor: 'action.hover',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {previewQuery.isFetching
              ? tn('savedViews.previewLoading')
              : previewQuery.data?.approximateTotal == null
                ? tn('savedViews.previewUnavailable')
                : tn('savedViews.previewCount', {
                    count: previewQuery.data.approximateTotal,
                  })}
          </Typography>
        </Box>
      </Stack>

      <Stack direction="row" justifyContent="flex-end" gap={1} sx={drawerFooterSx}>
        <ActionButton intent="secondary" onClick={onClose}>
          {t('actions.cancel')}
        </ActionButton>
        <ActionButton
          type="submit"
          intent="primary"
          loading={busy}
          disabled={!draft.name.trim() || (draft.visibility === 'TEAM' && !draft.ownerGroupRef)}
        >
          {editing ? t('actions.save') : t('actions.create')}
        </ActionButton>
      </Stack>
    </Box>
  );
}

function includedTypeLabel(
  type: NotificationIncludedType,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  return type === 'ASSIGNED'
    ? t('reason.ROLE')
    : t(`reason.${type}`, { defaultValue: type });
}

function contextId(context: NotificationContextOption): string {
  return `${context.kind}:${encodeURIComponent(context.key)}`;
}

function contextOptionsWithSelected(
  options: readonly NotificationContextOption[],
  selected: readonly NotificationContextOption[]
): NotificationContextOption[] {
  const values = new Map(options.map((option) => [contextId(option), option]));
  selected.forEach((context) => values.set(contextId(context), context));
  return [...values.values()];
}

function visibilityOptions(canPublish: boolean, hasGroups: boolean, t: (key: string) => string) {
  return [
    { value: 'PERSONAL', label: t('savedViews.scope.personal') },
    ...(hasGroups ? [{ value: 'TEAM', label: t('savedViews.scope.team') }] : []),
    ...(canPublish ? [{ value: 'TENANT', label: t('savedViews.scope.organization') }] : []),
  ];
}

const drawerFooterSx = {
  p: 2,
  pb: 'max(16px, env(safe-area-inset-bottom))',
  borderTop: 1,
  borderColor: 'divider',
  bgcolor: 'background.paper',
} as const;
