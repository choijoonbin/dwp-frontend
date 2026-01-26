// ----------------------------------------------------------------------

import type { PlanStep, ThoughtChain, AgentMessage, TimelineStep, ActionExecution } from '@dwp-frontend/shared-utils/aura/use-aura-store';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';

import { ResultViewer } from '../../../components/aura/result-viewer';
import { ThoughtChainUI } from '../../../components/aura/thought-chain-ui';
import { DynamicPlanBoard } from '../../../components/aura/dynamic-plan-board';
import { ReasoningTimeline } from '../../../components/aura/reasoning-timeline';
import { ActionExecutionView } from '../../../components/aura/action-execution-view';

// ----------------------------------------------------------------------

type WorkspaceTabsProps = {
  value: number;
  onChange: (next: number) => void;
  thoughtChains: ThoughtChain[];
  timelineSteps: TimelineStep[];
  currentStepIndex: number;
  planSteps: PlanStep[];
  actionExecutions: ActionExecution[];
  messages: AgentMessage[];
  onReorderPlanSteps: (ids: string[]) => void;
  onUpdatePlanStep: (id: string, updates: Partial<PlanStep>) => void;
  onApprovePlanStep: (id: string) => void;
  onSkipPlanStep: (id: string) => void;
  isCompact?: boolean;
};

const TAB_ITEMS = [
  { label: '사고 과정', icon: 'solar:brain-bold' },
  { label: '작업 계획', icon: 'solar:list-check-bold' },
  { label: '실행 로그', icon: 'solar:terminal-bold' },
  { label: '결과', icon: 'solar:check-circle-bold' },
];

export const WorkspaceTabs = ({
  value,
  onChange,
  thoughtChains,
  timelineSteps,
  currentStepIndex,
  planSteps,
  actionExecutions,
  messages,
  onReorderPlanSteps,
  onUpdatePlanStep,
  onApprovePlanStep,
  onSkipPlanStep,
  isCompact = false,
}: WorkspaceTabsProps) => {
  const resultMessages = messages.filter((msg) => msg.role === 'assistant' && msg.metadata?.result);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tabs
          value={value}
          onChange={(_, next) => onChange(next)}
          variant={isCompact ? 'scrollable' : 'standard'}
          allowScrollButtonsMobile
        >
          {TAB_ITEMS.map((tab) => (
            <Tab
              key={tab.label}
              label={tab.label}
              icon={<Iconify icon={tab.icon} width={16} />}
              iconPosition="start"
            />
          ))}
        </Tabs>
      </Box>

      <Scrollbar
        sx={{
          flex: 1,
          minHeight: 0,
          '& .simplebar-wrapper': { height: '100%' },
          '& .simplebar-mask': { height: '100%' },
          '& .simplebar-offset': { height: '100%' },
          '& .simplebar-content-wrapper': { height: '100%', overflow: 'hidden auto !important' },
          '& .simplebar-content': { height: '100%', display: 'flex', flexDirection: 'column' },
        }}
      >
        <Box sx={{ p: { xs: 2, md: 3 }, flexGrow: 1 }}>
          {value === 0 && (
            <Stack spacing={3}>
              {thoughtChains.length > 0 ? (
                <Box>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    사고 체인
                  </Typography>
                  <ThoughtChainUI thoughts={thoughtChains} />
                </Box>
              ) : (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    사고 과정이 아직 기록되지 않았습니다.
                  </Typography>
                </Paper>
              )}
              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  실행 타임라인
                </Typography>
                <ReasoningTimeline steps={timelineSteps} currentStepIndex={currentStepIndex} />
              </Box>
            </Stack>
          )}

          {value === 1 && (
            <DynamicPlanBoard
              steps={planSteps}
              onReorder={onReorderPlanSteps}
              onUpdate={onUpdatePlanStep}
              onApprove={onApprovePlanStep}
              onSkip={onSkipPlanStep}
            />
          )}

          {value === 2 && (
            <Stack spacing={2}>
              <ActionExecutionView executions={actionExecutions} />
              {actionExecutions.length === 0 && (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    실행 로그가 없습니다.
                  </Typography>
                </Paper>
              )}
            </Stack>
          )}

          {value === 3 && (
            <Stack spacing={2}>
              {resultMessages.map((msg) => (
                <ResultViewer
                key={msg.id}
                result={
                  (msg.metadata?.result as { type: 'text' | 'diff' | 'preview' | 'checklist'; content: unknown; title?: string }) ?? {
                    type: 'text' as const,
                    content: '',
                  }
                }
              />
              ))}
              {resultMessages.length === 0 && (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    결과가 여기에 표시됩니다.
                  </Typography>
                </Paper>
              )}
            </Stack>
          )}
        </Box>
      </Scrollbar>
    </Box>
  );
};
