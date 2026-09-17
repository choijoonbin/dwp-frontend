import { useTranslation } from 'react-i18next';
import { CalendarClock, Star, ArrowUpRight } from 'lucide-react';
import { ActionButton, ActionIconButton, foundationTokens } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { darken } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import { workHubUrgency, type WorkHubItem, type WorkHubActionKind } from './work-hub-contracts';
import { canUseWorkHubGenericAdjunct } from './work-hub-command-authority';
import { workHubStatusLabelKey, workHubDisplayId } from './work-hub-presentation';

const terminalLifecycle = new Set(['COMPLETED', 'CANCELLED', 'ARCHIVED']);

function opaqueFocusToken(key: string) {
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;
  for (const character of key) {
    const code = character.codePointAt(0)!;
    left = Math.imul(left ^ code, 0x01000193);
    right = Math.imul(right ^ code, 0x85ebca6b);
  }
  return `work-row-${(left >>> 0).toString(36)}-${(right >>> 0).toString(36)}`;
}

export type WorkHubListProps = {
  items: readonly WorkHubItem[];
  selectedKey: string | null;
  checkedKeys: ReadonlySet<string>;
  now: number;
  canCheck: (item: WorkHubItem) => boolean;
  onCheck: (item: WorkHubItem, checked: boolean) => void;
  onOpen: (item: WorkHubItem, focusToken?: string) => void;
  onSchedule?: (item: WorkHubItem) => void;
  inTodayPlan?: (item: WorkHubItem) => boolean;
  onTogglePlan?: (item: WorkHubItem) => void;
  onAction?: (item: WorkHubItem, kind: WorkHubActionKind) => void;
  busy?: boolean;
  density?: 'comfortable' | 'compact';
  selectionMode?: boolean;
};

export function WorkHubList({
  items,
  selectedKey,
  checkedKeys,
  now,
  canCheck,
  onCheck,
  onOpen,
  onSchedule,
  inTodayPlan,
  onTogglePlan,
  onAction,
  busy = false,
  density = 'comfortable',
  selectionMode = true,
}: WorkHubListProps) {
  const { t } = useTranslation('work');
  // A container can still be wide at 200% text zoom while the viewport has already
  // become a mobile-sized interaction surface. Keep the five-column data-grid
  // treatment for actual desktop viewports only; otherwise retain readable cards.
  const desktopViewport = useMediaQuery('(min-width:900px)');
  const desktopGrid = desktopViewport ? '@container work-queue (min-width: 440px)' : null;
  return (
    <Box
      data-testid="work-hub-queue"
      sx={{
        containerType: 'inline-size',
        containerName: 'work-queue',
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          display: 'none',
          ...(desktopGrid
            ? {
                [desktopGrid]: {
                  display: 'grid',
                  gridTemplateColumns: '44px 68px minmax(0,1fr) 82px 76px',
                  gap: 1,
                  alignItems: 'center',
                  px: 1,
                  py: 0.75,
                  bgcolor: 'var(--dwp-product-soft)',
                  borderRadius: foundationTokens.radius.surface + 'px',
                  color: 'text.secondary',
                },
              }
            : {}),
        }}
      >
        <Typography variant="caption" textAlign="center">
          {t('workHub.scopes.TODAY')}
        </Typography>
        <Typography variant="caption">{t('workHub.filters.sourceLabel')}</Typography>
        <Typography variant="caption">{t('workHub.queue.label')}</Typography>
        <Typography variant="caption">
          {t('workHub.detail.status')} / {t('workHub.detail.due')}
        </Typography>
        <Typography variant="caption" textAlign="right">
          {t('workHub.batch.selectMode')}
        </Typography>
      </Box>
      <Box
        component="ul"
        aria-label={t('workHub.queue.label')}
        sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 0.75 }}
      >
        {items.map((item) => {
          const focusToken = opaqueFocusToken(item.key);
          const selected = item.key === selectedKey;
          const urgency = workHubUrgency(item, now);
          const genericActionsAllowed = canUseWorkHubGenericAdjunct(item, 'BATCH');
          const checkable = genericActionsAllowed && canCheck(item);
          const active = !terminalLifecycle.has(item.lifecycle);
          const planned = inTodayPlan?.(item) ?? false;
          const displayId = workHubDisplayId(item);
          const sourceLabel = t(`workHub.sources.${item.reference.sourceSystem}`, {
            defaultValue: t('workHub.sources.OTHER'),
          });
          const assignment =
            item.sourceContext?.kind === 'WORK_ASSIGNMENT' ? item.sourceContext : null;
          const primaryAction = genericActionsAllowed
            ? item.actions.find(
                (action) =>
                  action.availability === 'AVAILABLE' &&
                  [
                    'PERSONAL_START',
                    'PERSONAL_COMPLETE',
                    'WORKSPACE_START',
                    'WORKSPACE_COMPLETE',
                  ].includes(action.kind)
              )
            : undefined;
          return (
            <Box
              component="li"
              key={item.key}
              data-work-key={focusToken}
              sx={{
                position: 'relative',
                border: 1,
                borderColor: selected ? 'primary.main' : 'divider',
                borderRadius: (theme) => `${theme.shape.borderRadius}px`,
                bgcolor: selected ? 'action.selected' : 'background.paper',
                boxShadow: selected ? 1 : 0,
                '&:hover': { bgcolor: selected ? 'action.selected' : 'action.hover' },
                '@media (forced-colors: active)': {
                  borderColor: selected ? 'Highlight' : 'CanvasText',
                },
                '&::before': selected
                  ? {
                      content: '""',
                      position: 'absolute',
                      insetBlock: 0,
                      insetInlineStart: 0,
                      width: 3,
                      bgcolor: 'primary.main',
                    }
                  : undefined,
              }}
            >
              <Stack
                direction="row"
                gap={0.5}
                alignItems="flex-start"
                sx={{
                  width: 1,
                  minHeight: density === 'compact' ? 76 : 92,
                  pl: { xs: 0.5, sm: 1 },
                  pr: 1,
                  py: density === 'compact' ? 0.75 : 1.25,
                  '@container work-queue (max-width: 439px)': {
                    display: 'grid',
                    gridTemplateColumns: '44px minmax(0, 1fr)',
                    gridTemplateRows: 'auto auto',
                    columnGap: 0.5,
                    rowGap: 0.5,
                    minHeight: density === 'compact' ? 132 : 146,
                    px: 1,
                    py: 1.25,
                  },
                }}
              >
                <Stack
                  className="work-row-leading"
                  alignItems="center"
                  sx={{
                    flexShrink: 0,
                    '@container work-queue (max-width: 439px)': {
                      gridColumn: 1,
                      gridRow: 1,
                      alignSelf: 'start',
                    },
                  }}
                >
                  {onTogglePlan &&
                    active &&
                    !selectionMode &&
                    canUseWorkHubGenericAdjunct(item, 'DAY_PLAN') && (
                      <ActionIconButton
                        label={
                          t(
                            planned ? 'workHub.actions.removeFromPlan' : 'workHub.actions.addToPlan'
                          ) +
                          ': ' +
                          item.title
                        }
                        tooltip={t(
                          planned ? 'workHub.actions.removeFromPlan' : 'workHub.actions.addToPlan'
                        )}
                        aria-pressed={planned}
                        onClick={() => onTogglePlan(item)}
                        disabled={busy}
                        sx={{
                          color: planned ? 'primary.main' : 'text.secondary',
                          width: 44,
                          height: 44,
                        }}
                      >
                        <Star size={18} fill={planned ? 'currentColor' : 'none'} />
                      </ActionIconButton>
                    )}
                  {checkable && selectionMode && (
                    <Checkbox
                      checked={checkedKeys.has(item.key)}
                      disabled={busy}
                      inputProps={{
                        'aria-label': t('workHub.queue.selectItem', { title: item.title }),
                      }}
                      onChange={(event) => onCheck(item, event.target.checked)}
                      sx={{ mt: -0.75, minWidth: 44, minHeight: 44 }}
                    />
                  )}
                </Stack>
                <ButtonBase
                  data-work-open
                  aria-current={selected ? 'true' : undefined}
                  aria-label={t('workHub.queue.openItem', { title: item.title })}
                  // WebKit can scroll a partly obscured button for mouse-compatible focus between
                  // mouse down and click. The fixed Work navigation can then cover the row and cancel
                  // activation. Suppress only primary-button focus; click, keyboard, and restored
                  // programmatic focus keep the button's normal contracts.
                  onMouseDown={(event) => {
                    if (event.button === 0) event.preventDefault();
                  }}
                  onClick={() => onOpen(item, focusToken)}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: 'left',
                    borderRadius: (theme) => `${theme.shape.borderRadius}px`,
                    p: 0.25,
                    '&:focus-visible': {
                      outline: '2px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: 2,
                    },
                    '@container work-queue (max-width: 439px)': {
                      gridColumn: 2,
                      gridRow: 1,
                      width: 1,
                      alignSelf: 'stretch',
                    },
                  }}
                >
                  <Stack
                    direction="row"
                    gap={1.25}
                    alignItems="flex-start"
                    sx={{ width: 1, minWidth: 0 }}
                  >
                    <Box
                      sx={{
                        minWidth: 0,
                        flex: 1,
                        '@container work-queue (max-width: 439px)': {
                          display: 'flex',
                          flexDirection: 'column',
                          minHeight: 76,
                        },
                        ...(density === 'compact' && desktopGrid
                          ? {
                              [desktopGrid]: {
                                display: 'grid',
                                gridTemplateColumns: '68px minmax(0,1fr) 82px',
                                gap: '0 8px',
                                alignItems: 'center',
                                '& .work-row-identity': { gridColumn: 1, gridRow: '1 / 3', m: 0 },
                                '& .work-row-title': { gridColumn: 2, gridRow: 1 },
                                '& .work-row-responsibility': { gridColumn: 2, gridRow: 2 },
                                '& .work-row-state': {
                                  gridColumn: 3,
                                  gridRow: '1 / 3',
                                  m: 0,
                                  flexDirection: 'column',
                                  alignItems: 'flex-start',
                                },
                                '& .work-source-inline': { display: 'none' },
                                '& .work-source-column': { display: 'block' },
                              },
                            }
                          : {}),
                      }}
                    >
                      <Typography
                        className="work-row-identity"
                        variant="caption"
                        color={selected ? 'primary.main' : 'text.secondary'}
                        sx={{
                          display: 'block',
                          fontWeight: 'fontWeightBold',
                          mb: 0.25,
                          overflowWrap: 'anywhere',
                          '@container work-queue (max-width: 439px)': {
                            display: 'inline-flex',
                            alignSelf: 'flex-start',
                            px: 0.75,
                            py: 0.25,
                            mb: 0.5,
                            bgcolor: 'var(--dwp-product-soft)',
                            borderRadius:
                              foundationTokens.radius.surface -
                              foundationTokens.radius.compact +
                              'px',
                          },
                        }}
                      >
                        <Box component="span">{displayId ?? sourceLabel}</Box>
                        <Box
                          component="span"
                          className="work-source-column"
                          sx={{
                            display: 'none',
                            color: 'text.secondary',
                            fontWeight: 'fontWeightRegular',
                          }}
                        >
                          {sourceLabel}
                        </Box>
                      </Typography>
                      <Typography
                        component="span"
                        className="work-row-title"
                        variant="subtitle2"
                        sx={{
                          minWidth: 0,
                          overflowWrap: 'anywhere',
                          fontWeight: selected ? 'fontWeightBold' : 'fontWeightMedium',
                          '@container work-queue (max-width: 439px)': {
                            fontSize: 'subtitle1.fontSize',
                            lineHeight: 'subtitle1.lineHeight',
                            fontWeight: 'fontWeightBold',
                          },
                        }}
                      >
                        {item.title}
                      </Typography>
                      <Typography
                        variant="caption"
                        className="work-row-responsibility"
                        color="text.secondary"
                        sx={{
                          display: 'block',
                          mt: 0.25,
                          '@container work-queue (max-width: 439px)': { mt: 0.5 },
                        }}
                      >
                        <Box component="span" className="work-source-inline">
                          {sourceLabel}
                          {' · '}
                        </Box>
                        {t(`workHub.responsibility.${item.waitingFor}`)}
                        {planned && (
                          <Box
                            component="span"
                            sx={{ ml: 1, color: 'primary.main', fontWeight: 'fontWeightBold' }}
                          >
                            {t('workHub.scopes.TODAY')}
                          </Box>
                        )}
                      </Typography>
                      <Stack
                        className="work-row-state"
                        direction="row"
                        gap={0.75}
                        alignItems="center"
                        flexWrap="wrap"
                        sx={{
                          mt: 1,
                          '@container work-queue (max-width: 439px)': {
                            mt: 'auto',
                            pt: 0.75,
                            gap: 0.5,
                          },
                        }}
                      >
                        {assignment && (
                          <>
                            <Chip
                              size="small"
                              variant="outlined"
                              label={t('workHub.assignment.listAssignmentState', {
                                state: t(
                                  `workHub.assignment.assignmentStates.${assignment.assignmentState}`
                                ),
                              })}
                            />
                            {assignment.sourceAvailability === 'NOT_REQUESTED' && (
                              <Typography
                                component="span"
                                variant="caption"
                                color="text.secondary"
                                sx={{ minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' }}
                              >
                                {t('workHub.assignment.listSourceReviewNotice')}
                              </Typography>
                            )}
                          </>
                        )}
                        <Chip
                          size="small"
                          variant="outlined"
                          label={t(workHubStatusLabelKey(item))}
                          sx={
                            item.lifecycle === 'COMPLETED'
                              ? (theme) => ({
                                  color:
                                    theme.palette.mode === 'dark'
                                      ? theme.palette.success.light
                                      : theme.palette.success.dark,
                                })
                              : item.lifecycle === 'WAITING'
                                ? (theme) => ({
                                    color:
                                      theme.palette.mode === 'dark'
                                        ? theme.palette.warning.light
                                        : darken(theme.palette.warning.main, 0.15),
                                  })
                                : item.lifecycle === 'CANCELLED'
                                  ? undefined
                                  : (theme) => ({
                                      color:
                                        theme.palette.mode === 'dark'
                                          ? theme.palette.info.light
                                          : darken(theme.palette.info.main, 0.25),
                                    })
                          }
                          color={
                            item.lifecycle === 'COMPLETED'
                              ? 'success'
                              : item.lifecycle === 'WAITING'
                                ? 'warning'
                                : item.lifecycle === 'CANCELLED'
                                  ? 'default'
                                  : 'info'
                          }
                        />
                        {active && ['OVERDUE', 'DUE_SOON'].includes(urgency) && (
                          <Chip
                            size="small"
                            variant="outlined"
                            label={t(`workHub.urgency.${urgency}`)}
                            color={
                              urgency === 'OVERDUE'
                                ? 'error'
                                : urgency === 'DUE_SOON'
                                  ? 'warning'
                                  : 'default'
                            }
                          />
                        )}
                        <Typography variant="caption" color="text.secondary">
                          {item.dueAt
                            ? formatDate(item.dueAt, { dateStyle: 'medium', timeStyle: 'short' })
                            : t('workHub.urgency.NO_DUE_DATE')}
                        </Typography>
                      </Stack>
                    </Box>
                  </Stack>
                </ButtonBase>
                <Stack
                  className="work-row-actions"
                  gap={0.5}
                  alignItems="flex-end"
                  sx={{
                    flexShrink: 0,
                    maxWidth: { xs: 92, sm: 76 },
                    '@container work-queue (max-width: 439px)': {
                      gridColumn: '1 / -1',
                      gridRow: 2,
                      maxWidth: 'none',
                      width: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      pl: 5.5,
                    },
                  }}
                >
                  {primaryAction && onAction ? (
                    <ActionButton
                      size="small"
                      intent={selected ? 'primary' : 'secondary'}
                      disabled={busy}
                      onClick={() => onAction(item, primaryAction.kind)}
                      sx={{ minHeight: 44, minWidth: { xs: 92, sm: 64 } }}
                    >
                      {t(`workHub.actions.${primaryAction.kind}`)}
                    </ActionButton>
                  ) : (
                    <ActionButton
                      size="small"
                      intent={selected ? 'primary' : 'quiet'}
                      onClick={() => onOpen(item, focusToken)}
                      endIcon={item.sourceRoute ? <ArrowUpRight size={14} /> : undefined}
                      sx={{ minHeight: 44, minWidth: { xs: 92, sm: 64 } }}
                    >
                      {t(
                        item.reference.sourceSystem === 'SERVICE_REQUEST' &&
                          item.waitingFor === 'ME'
                          ? 'workHub.queue.respond'
                          : 'workHub.queue.review'
                      )}
                    </ActionButton>
                  )}
                  {onSchedule &&
                    density !== 'compact' &&
                    !terminalLifecycle.has(item.lifecycle) &&
                    canUseWorkHubGenericAdjunct(item, 'CALENDAR') && (
                      <ActionIconButton
                        label={t('workHub.actions.scheduleNamed', { title: item.title })}
                        tooltip={t('workHub.actions.schedule')}
                        size="small"
                        onClick={() => onSchedule(item)}
                        sx={{ minWidth: 44, minHeight: 44, mt: -0.75 }}
                      >
                        <CalendarClock size={17} aria-hidden="true" />
                      </ActionIconButton>
                    )}
                </Stack>
              </Stack>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
