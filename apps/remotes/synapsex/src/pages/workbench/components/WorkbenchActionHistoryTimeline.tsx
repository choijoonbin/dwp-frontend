/**
 * 조치 이력 타임라인 — agent_case_action_history 바인딩
 * 조치자, 조치 일시, 조치 사유(Comment) 표시
 */

import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Timeline from '@mui/lab/Timeline';
import TimelineDot from '@mui/lab/TimelineDot';
import TimelineItem from '@mui/lab/TimelineItem';
import Typography from '@mui/material/Typography';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineSeparator from '@mui/lab/TimelineSeparator';

export type AgentCaseActionHistoryItem = {
  id?: string;
  /** 조치자 이름 */
  actorName: string;
  /** 조치 일시 (ISO 또는 표시용 문자열) */
  actionAt: string;
  /** 사용자 입력 조치 사유(Comment) */
  comment?: string;
};

export type WorkbenchActionHistoryTimelineProps = {
  items: AgentCaseActionHistoryItem[];
};

const formatActionAt = (actionAt: string): string => {
  try {
    const d = new Date(actionAt);
    if (Number.isNaN(d.getTime())) return actionAt;
    return d.toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return actionAt;
  }
};

export const WorkbenchActionHistoryTimeline = ({ items }: WorkbenchActionHistoryTimelineProps) => {
  const { t } = useTranslation('common');

  if (items.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'background.neutral' }}>
        <Iconify icon="solar:history-bold-duotone" width={40} sx={{ color: 'text.disabled', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          {t('workbench.historyEmpty')}
        </Typography>
      </Paper>
    );
  }

  return (
    <Timeline
      position="right"
      sx={{
        p: 0,
        m: 0,
        '& .MuiTimelineItem-root:before': { flex: 0, padding: 0 },
      }}
    >
      {items.map((item, index) => (
        <TimelineItem key={item.id ?? index}>
          <TimelineSeparator>
            <TimelineDot color="primary" variant="outlined">
              <Iconify icon="solar:user-bold" width={14} />
            </TimelineDot>
            {index < items.length - 1 && <TimelineConnector />}
          </TimelineSeparator>
          <TimelineContent sx={{ pb: 2 }}>
            <Paper
              sx={{
                p: 2,
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
                bgcolor: 'background.paper',
              }}
            >
              <Stack spacing={1}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {item.actorName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatActionAt(item.actionAt)}
                  </Typography>
                </Stack>
                {item.comment != null && String(item.comment).trim() !== '' && (
                  <Box
                    sx={{
                      pl: 1.5,
                      borderLeft: 2,
                      borderColor: 'primary.main',
                      bgcolor: 'action.hover',
                      py: 1,
                      pr: 1,
                      borderRadius: 0.5,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                      {t('workbench.historyComment')}
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {item.comment}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Paper>
          </TimelineContent>
        </TimelineItem>
      ))}
    </Timeline>
  );
};
