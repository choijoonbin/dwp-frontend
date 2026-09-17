import { useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppWindow, Check, ChevronDown, ListTree, Rows3 } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { notificationArrivalContent } from '../../components/notification-arrival-policy';
import { NotificationActionCard } from './notification-action-card';
import { groupNotificationItemsForPresentation } from './notification-inbox-model';

import type {
  NotificationCenterDensity,
  NotificationCenterGrouping,
  NotificationCenterPresentation,
} from './notification-saved-view-model';
import type {
  NotificationDeliveryProfile,
  NotificationItem,
  NotificationTriageAction,
} from '@dwp-frontend/shared-utils/api/notification-api';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  KeyboardEventHandler,
  MutableRefObject,
} from 'react';

export interface NotificationCenterPresentationLabels {
  presentation: string;
  density: string;
  dense: string;
  detailed: string;
  grouping: string;
  groupingNone: string;
  groupingSource: string;
  groupingContext: string;
  contextGroup: string;
  sourceFallback: string;
}

export const DEFAULT_NOTIFICATION_CENTER_PRESENTATION_LABELS: NotificationCenterPresentationLabels =
  {
    presentation: 'Notification presentation',
    density: 'Display density',
    dense: 'Compact',
    detailed: 'Detailed',
    grouping: 'Group notifications',
    groupingNone: 'No grouping',
    groupingSource: 'Source app',
    groupingContext: 'Context',
    contextGroup: 'context',
    sourceFallback: 'Other source',
  };

export function useNotificationCenterPresentationLabels(
  overrides?: Partial<NotificationCenterPresentationLabels>
): NotificationCenterPresentationLabels {
  const { t } = useTranslation('notifications');
  return useMemo(
    () => ({
      presentation: t('workbench.presentation.label'),
      density: t('workbench.presentation.density.label'),
      dense: t('workbench.presentation.density.dense'),
      detailed: t('workbench.presentation.density.detailed'),
      grouping: t('workbench.presentation.grouping.label'),
      groupingNone: t('workbench.presentation.grouping.none'),
      groupingSource: t('workbench.presentation.grouping.source'),
      groupingContext: t('workbench.presentation.grouping.context'),
      contextGroup: t('workbench.presentation.contextGroup'),
      sourceFallback: t('workbench.presentation.sourceFallback'),
      ...overrides,
    }),
    [overrides, t]
  );
}

const DENSITY_OPTIONS: Array<{
  value: NotificationCenterDensity;
  labelKey: 'dense' | 'detailed';
  icon: typeof Rows3;
}> = [
  { value: 'DENSE', labelKey: 'dense', icon: Rows3 },
  { value: 'DETAILED', labelKey: 'detailed', icon: ListTree },
];

const GROUPING_OPTIONS: Array<{
  value: NotificationCenterGrouping;
  labelKey: 'groupingNone' | 'groupingSource' | 'groupingContext';
}> = [
  { value: 'NONE', labelKey: 'groupingNone' },
  { value: 'SOURCE', labelKey: 'groupingSource' },
  { value: 'CONTEXT', labelKey: 'groupingContext' },
];

function resolvedLabels(
  overrides?: Partial<NotificationCenterPresentationLabels>
): NotificationCenterPresentationLabels {
  return { ...DEFAULT_NOTIFICATION_CENTER_PRESENTATION_LABELS, ...overrides };
}

export function NotificationCenterPresentationControls({
  presentation,
  labels: labelOverrides,
  onDensityChange,
  onGroupingChange,
}: {
  presentation: NotificationCenterPresentation;
  labels?: Partial<NotificationCenterPresentationLabels>;
  onDensityChange: (density: NotificationCenterDensity) => void;
  onGroupingChange: (grouping: NotificationCenterGrouping) => void;
}) {
  const labels = resolvedLabels(labelOverrides);
  const densityLabelId = useId();
  const groupingMenuId = useId();
  const densityRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [groupingAnchor, setGroupingAnchor] = useState<HTMLElement | null>(null);
  const groupingOpen = Boolean(groupingAnchor);
  const selectedGrouping = GROUPING_OPTIONS.find(
    (option) => option.value === presentation.grouping
  );

  const handleDensityKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + DENSITY_OPTIONS.length) % DENSITY_OPTIONS.length;
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % DENSITY_OPTIONS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = DENSITY_OPTIONS.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    const option = DENSITY_OPTIONS[nextIndex];
    if (!option) return;
    onDensityChange(option.value);
    densityRefs.current[nextIndex]?.focus();
  };

  const selectGrouping = (grouping: NotificationCenterGrouping) => {
    onGroupingChange(grouping);
    setGroupingAnchor(null);
  };

  return (
    <Stack
      component="section"
      aria-label={labels.presentation}
      direction="row"
      alignItems="center"
      justifyContent="flex-end"
      gap={0.75}
      sx={{ mt: 1 }}
    >
      <Stack direction="row" alignItems="center" gap={0.75} minWidth={0}>
        <Typography
          id={densityLabelId}
          variant="caption"
          color="text.secondary"
          sx={{ display: { xs: 'none', sm: 'block' }, flexShrink: 0 }}
        >
          {labels.density}
        </Typography>
        <Box
          role="radiogroup"
          aria-labelledby={densityLabelId}
          sx={{
            minWidth: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            border: 1,
            borderColor: 'divider',
            borderRadius: (theme) => `${theme.shape.borderRadius}px`,
            overflow: 'hidden',
          }}
        >
          {DENSITY_OPTIONS.map((option, index) => {
            const selected = option.value === presentation.density;
            const Icon = option.icon;
            return (
              <ButtonBase
                key={option.value}
                ref={(element) => {
                  densityRefs.current[index] = element;
                }}
                role="radio"
                aria-checked={selected}
                aria-label={labels[option.labelKey]}
                tabIndex={selected ? 0 : -1}
                onClick={() => onDensityChange(option.value)}
                onKeyDown={(event) => handleDensityKeyDown(event, index)}
                sx={{
                  minWidth: { xs: 40, sm: 104 },
                  minHeight: 36,
                  px: 1,
                  display: 'flex',
                  gap: 0.65,
                  borderLeft: index === 0 ? 0 : 1,
                  borderColor: 'divider',
                  bgcolor: selected ? 'action.selected' : 'background.paper',
                  color: selected ? 'primary.main' : 'text.secondary',
                  '&:hover': { bgcolor: selected ? 'action.selected' : 'action.hover' },
                  '&:focus-visible': {
                    position: 'relative',
                    zIndex: 1,
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: -2,
                  },
                }}
              >
                <Icon size={15} aria-hidden="true" />
                <Typography
                  component="span"
                  variant="caption"
                  fontWeight="fontWeightBold"
                  sx={{ display: { xs: 'none', sm: 'inline' } }}
                >
                  {labels[option.labelKey]}
                </Typography>
              </ButtonBase>
            );
          })}
        </Box>
      </Stack>

      <ActionButton
        intent="secondary"
        size="small"
        startIcon={<AppWindow size={16} />}
        endIcon={<ChevronDown size={16} />}
        aria-haspopup="menu"
        aria-controls={groupingOpen ? groupingMenuId : undefined}
        aria-expanded={groupingOpen}
        onClick={(event) => setGroupingAnchor(event.currentTarget)}
        aria-label={`${labels.grouping}: ${selectedGrouping ? labels[selectedGrouping.labelKey] : labels.groupingNone}`}
        sx={{ minHeight: 36, minWidth: 0, justifyContent: 'space-between' }}
      >
        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
          {labels.grouping}:{' '}
        </Box>
        {selectedGrouping ? labels[selectedGrouping.labelKey] : labels.groupingNone}
      </ActionButton>
      <Menu
        id={groupingMenuId}
        anchorEl={groupingAnchor}
        open={groupingOpen}
        onClose={() => setGroupingAnchor(null)}
        MenuListProps={{ 'aria-label': labels.grouping }}
      >
        {GROUPING_OPTIONS.map((option) => {
          const selected = option.value === presentation.grouping;
          return (
            <MenuItem
              key={option.value}
              role="menuitemradio"
              aria-checked={selected}
              selected={selected}
              onClick={() => selectGrouping(option.value)}
              sx={{ gap: 1, minWidth: 200 }}
            >
              <Box
                component="span"
                aria-hidden="true"
                sx={{ width: 18, display: 'inline-grid', placeItems: 'center' }}
              >
                {selected && <Check size={16} />}
              </Box>
              {labels[option.labelKey]}
            </MenuItem>
          );
        })}
      </Menu>
    </Stack>
  );
}

function NotificationCenterPresentationGroupHeading({
  id,
  label,
  count,
  grouping,
}: {
  id: string;
  label: string;
  count: number;
  grouping: Exclude<NotificationCenterGrouping, 'NONE'>;
}) {
  const Icon = grouping === 'SOURCE' ? AppWindow : ListTree;
  return (
    <Stack direction="row" alignItems="center" gap={0.75} sx={{ pb: 0.75, pt: 0.5 }}>
      <Box aria-hidden="true" sx={{ color: 'text.secondary', display: 'grid' }}>
        <Icon size={16} />
      </Box>
      <Typography id={id} component="h2" variant="subtitle2" fontWeight="fontWeightBold">
        {label}
      </Typography>
      <Chip size="small" label={count} sx={{ height: 20 }} />
    </Stack>
  );
}

export function NotificationCenterPresentationList({
  items,
  presentation,
  labels: labelOverrides,
  listLabel,
  profile,
  protectedTitle,
  now,
  selectedId,
  selectedIds,
  detailItemId,
  detailOpen,
  compactDetail,
  busy,
  rowRefs,
  onKeyDown,
  onFocusItem,
  onToggleChecked,
  onOpenDetails,
  onTriage,
  onOpenTarget,
  onQuickReply,
}: {
  items: readonly NotificationItem[];
  presentation: NotificationCenterPresentation;
  labels?: Partial<NotificationCenterPresentationLabels>;
  listLabel: string;
  profile?: NotificationDeliveryProfile;
  protectedTitle: string;
  now: number;
  selectedId: string | null;
  selectedIds: ReadonlySet<string>;
  detailItemId: string | null;
  detailOpen: boolean;
  compactDetail: boolean;
  busy: boolean;
  rowRefs: MutableRefObject<Array<HTMLButtonElement | null>>;
  onKeyDown: KeyboardEventHandler<HTMLUListElement>;
  onFocusItem: (item: NotificationItem) => void;
  onToggleChecked: (item: NotificationItem, checked: boolean) => void;
  onOpenDetails: (item: NotificationItem) => void;
  onTriage: (item: NotificationItem, action: NotificationTriageAction) => void;
  onOpenTarget?: (href: string) => void;
  onQuickReply: (
    item: NotificationItem,
    target: { conversationId: string; replyToMessageId?: string },
    body: string,
    idempotencyKey: string
  ) => Promise<void>;
}) {
  const labels = resolvedLabels(labelOverrides);
  const groups = useMemo(
    () =>
      groupNotificationItemsForPresentation(items, presentation.grouping, {
        context: labels.contextGroup,
        sourceFallback: labels.sourceFallback,
      }),
    [items, labels.contextGroup, labels.sourceFallback, presentation.grouping]
  );
  const orderedItems = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const itemIndexById = useMemo(
    () => new Map(orderedItems.map((item, index) => [item.notificationId, index])),
    [orderedItems]
  );
  const compact = presentation.density === 'DENSE';

  return (
    <Box
      component="ul"
      aria-label={listLabel}
      data-notification-density={presentation.density}
      data-notification-grouping={presentation.grouping}
      onKeyDown={onKeyDown}
      sx={{ p: 0, m: 0, listStyle: 'none' }}
    >
      {groups.map((group, groupIndex) => {
        const headingId = group.label ? `notification-presentation-group-${groupIndex}` : undefined;
        return (
          <Box component="li" key={group.key} sx={{ listStyle: 'none' }}>
            {group.label && presentation.grouping !== 'NONE' && headingId && (
              <NotificationCenterPresentationGroupHeading
                id={headingId}
                label={group.label}
                count={group.items.length}
                grouping={presentation.grouping}
              />
            )}
            <Stack
              component="ul"
              aria-labelledby={headingId}
              gap={compact ? 0.45 : 0.85}
              sx={{ p: 0, m: 0, listStyle: 'none' }}
            >
              {group.items.map((item) => {
                const index = itemIndexById.get(item.notificationId) ?? 0;
                const content = notificationArrivalContent(item, profile, protectedTitle);
                const displayItem = { ...item, title: content.title, preview: content.preview };
                const concealContext =
                  item.sensitive || !profile || profile.presentation.previewMode === 'HIDDEN';
                return (
                  <Box component="li" key={item.notificationId}>
                    <NotificationActionCard
                      item={displayItem}
                      now={now}
                      active={item.notificationId === selectedId}
                      checked={selectedIds.has(item.notificationId)}
                      busy={busy}
                      concealContext={concealContext}
                      tabIndex={
                        item.notificationId === selectedId || (!selectedId && index === 0) ? 0 : -1
                      }
                      rowRef={(element) => {
                        rowRefs.current[index] = element;
                      }}
                      onFocus={() => onFocusItem(item)}
                      onToggleChecked={(checked) => onToggleChecked(item, checked)}
                      onOpenDetails={() => onOpenDetails(item)}
                      onTriage={(action) => onTriage(item, action)}
                      onOpenTarget={onOpenTarget}
                      onQuickReply={(target, body, idempotencyKey) =>
                        onQuickReply(item, target, body, idempotencyKey)
                      }
                      showPrimaryActions={
                        compactDetail || !detailOpen || item.notificationId !== detailItemId
                      }
                      density={compact ? 'compact' : 'standard'}
                    />
                  </Box>
                );
              })}
            </Stack>
          </Box>
        );
      })}
    </Box>
  );
}
