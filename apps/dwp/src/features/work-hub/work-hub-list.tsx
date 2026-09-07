import { useTranslation } from 'react-i18next';
import {
  BriefcaseBusiness,
  CalendarClock,
  CheckSquare2,
  FileCheck2,
  Headphones,
  ShieldCheck,
} from 'lucide-react';
import { ActionIconButton } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workHubUrgency, type WorkHubItem } from './work-hub-contracts';

const terminalLifecycle = new Set(['COMPLETED', 'CANCELLED', 'ARCHIVED']);

function WorkSourceIcon({ item }: { item: WorkHubItem }) {
  const common = { size: 18, strokeWidth: 1.8, 'aria-hidden': true } as const;
  if (item.reference.sourceSystem === 'PERSONAL_TASK') return <CheckSquare2 {...common} />;
  if (item.reference.sourceSystem === 'IDENTITY_GOVERNANCE') return <ShieldCheck {...common} />;
  if (item.reference.sourceSystem.startsWith('APPROVAL')) return <FileCheck2 {...common} />;
  if (item.reference.sourceSystem === 'SERVICE_REQUEST') return <Headphones {...common} />;
  return <BriefcaseBusiness {...common} />;
}

export type WorkHubListProps = {
  items: readonly WorkHubItem[];
  selectedKey: string | null;
  checkedKeys: ReadonlySet<string>;
  now: number;
  canCheck: (item: WorkHubItem) => boolean;
  onCheck: (item: WorkHubItem, checked: boolean) => void;
  onOpen: (item: WorkHubItem) => void;
  onSchedule?: (item: WorkHubItem) => void;
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
}: WorkHubListProps) {
  const { t } = useTranslation('work');
  return (
    <Box
      component="ul"
      aria-label={t('workHub.queue.label')}
      sx={{ m: 0, p: 0, listStyle: 'none' }}
    >
      {items.map((item) => {
        const selected = item.key === selectedKey;
        const urgency = workHubUrgency(item, now);
        const checkable = canCheck(item);
        const active = !terminalLifecycle.has(item.lifecycle);
        return (
          <Box
            component="li"
            key={item.key}
            data-work-key={item.key}
            sx={{
              position: 'relative',
              borderBottom: 1,
              borderColor: 'divider',
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
              sx={{ width: 1, minHeight: 104, pl: { xs: 0.75, sm: 1.25 }, pr: 1, py: 1.5 }}
            >
              <Checkbox
                checked={checkedKeys.has(item.key)}
                disabled={!checkable}
                inputProps={{ 'aria-label': t('workHub.queue.selectItem', { title: item.title }) }}
                onChange={(event) => onCheck(item, event.target.checked)}
                sx={{ mt: -0.75, minWidth: 44, minHeight: 44 }}
              />
              <ButtonBase
                data-work-open
                aria-current={selected ? 'true' : undefined}
                aria-label={t('workHub.queue.openItem', { title: item.title })}
                onClick={() => onOpen(item)}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  textAlign: 'left',
                  borderRadius: 'shape.borderRadius',
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
                    aria-hidden="true"
                    sx={{
                      width: 36,
                      height: 36,
                      flex: '0 0 auto',
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: 'shape.borderRadius',
                      bgcolor: 'var(--dwp-product-soft)',
                      color: 'var(--dwp-product-accent)',
                    }}
                  >
                    <WorkSourceIcon item={item} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      component="span"
                      variant="subtitle2"
                      sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
                    >
                      {item.title}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 0.25 }}
                    >
                      {t(`workHub.sources.${item.reference.sourceSystem}`, {
                        defaultValue: t('workHub.sources.OTHER'),
                      })}
                      {' · '}
                      {t(`workHub.responsibility.${item.waitingFor}`)}
                    </Typography>
                    <Stack
                      direction="row"
                      gap={0.75}
                      alignItems="center"
                      flexWrap="wrap"
                      sx={{ mt: 1 }}
                    >
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t(`workHub.lifecycle.${item.lifecycle}`)}
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
                      {active && (
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
              {onSchedule && !terminalLifecycle.has(item.lifecycle) && (
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
          </Box>
        );
      })}
    </Box>
  );
}
