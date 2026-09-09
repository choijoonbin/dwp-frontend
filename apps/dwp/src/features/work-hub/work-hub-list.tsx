import { useTranslation } from 'react-i18next';
import { CalendarClock, Star, ArrowUpRight } from 'lucide-react';
import { ActionButton, ActionIconButton } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { darken } from '@mui/material/styles';

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
  return (
    <Box
      component="ul"
      aria-label={t('workHub.queue.label')}
      sx={{
        m: 0,
        p: 0,
        listStyle: 'none',
        containerType: 'inline-size',
        containerName: 'work-queue',
      }}
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
              borderColor: 'divider',
              borderRadius: (theme) => `${theme.shape.borderRadius}px`,
              mb: 0.75,
              bgcolor: selected ? 'action.selected' : 'background.paper',
              '&:hover': { bgcolor: selected ? 'action.selected' : 'action.hover' },
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
              }}
            >
              <Stack alignItems="center" sx={{ flexShrink: 0 }}>
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
                      ...(density === 'compact'
                        ? {
                            '@container work-queue (min-width: 540px)': {
                              display: 'grid',
                              gridTemplateColumns: '76px minmax(0,1fr) 100px',
                              gap: '0 12px',
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
                      }}
                    >
                      {item.title}
                    </Typography>
                    <Typography
                      variant="caption"
                      className="work-row-responsibility"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 0.25 }}
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
                      sx={{ mt: 1 }}
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
                              : undefined
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
                gap={0.5}
                alignItems="flex-end"
                sx={{ flexShrink: 0, maxWidth: { xs: 92, sm: 110 } }}
              >
                {primaryAction && onAction ? (
                  <ActionButton
                    size="small"
                    intent={selected ? 'primary' : 'secondary'}
                    disabled={busy}
                    onClick={() => onAction(item, primaryAction.kind)}
                    sx={{ minHeight: 44, minWidth: 64 }}
                  >
                    {t(`workHub.actions.${primaryAction.kind}`)}
                  </ActionButton>
                ) : (
                  <ActionButton
                    size="small"
                    intent={selected ? 'primary' : 'quiet'}
                    onClick={() => onOpen(item, focusToken)}
                    endIcon={item.sourceRoute ? <ArrowUpRight size={14} /> : undefined}
                    sx={{ minHeight: 44, minWidth: 64 }}
                  >
                    {t(
                      item.reference.sourceSystem === 'SERVICE_REQUEST' && item.waitingFor === 'ME'
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
  );
}
