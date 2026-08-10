import { useId } from 'react';
import { Check, ShieldCheck, ShieldAlert, X } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import ListItem from '@mui/material/ListItem';
import Typography from '@mui/material/Typography';

import { SourceCitationList } from './source-citation-list';

import type { SourceCitation } from './source-citation-list';

export type AgentRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type AgentPlanStep = {
  id: string;
  title: string;
  description?: string;
  tool?: string;
};

export type AgentPlanPreviewProps = {
  title: string;
  summary?: string;
  riskLevel: AgentRiskLevel;
  riskLabel?: string;
  steps: readonly AgentPlanStep[];
  sources?: readonly SourceCitation[];
  approvalRequired?: boolean;
  state?: 'review' | 'approved' | 'rejected';
  onApprove?: () => void;
  onReject?: () => void;
  approveLabel?: string;
  rejectLabel?: string;
  labels?: Partial<AgentPlanPreviewLabels>;
};

export type AgentPlanPreviewLabels = {
  risk: Record<AgentRiskLevel, string>;
  planSteps: string;
  sources: string;
  planSources: string;
  planApproved: string;
  planRejected: string;
  reviewBeforeExecution: string;
  noApprovalRequired: string;
  citationStates: Record<'restricted' | 'stale', string>;
};

const defaultLabels: AgentPlanPreviewLabels = {
  risk: {
    low: 'Low risk',
    medium: 'Medium risk',
    high: 'High risk',
    critical: 'Critical risk',
  },
  planSteps: 'Plan steps',
  sources: 'Sources',
  planSources: 'Plan sources',
  planApproved: 'Plan approved',
  planRejected: 'Plan rejected',
  reviewBeforeExecution: 'Review the sources and changes before execution.',
  noApprovalRequired: 'This plan can run without approval under the current policy.',
  citationStates: { restricted: 'Restricted', stale: 'Refresh needed' },
};

const riskColor = {
  low: 'success',
  medium: 'info',
  high: 'warning',
  critical: 'error',
} as const;

export function AgentPlanPreview({
  title,
  summary,
  riskLevel,
  riskLabel,
  steps,
  sources = [],
  approvalRequired = true,
  state = 'review',
  onApprove,
  onReject,
  approveLabel = 'Approve plan',
  rejectLabel = 'Reject',
  labels,
}: AgentPlanPreviewProps) {
  const settled = state !== 'review';
  const titleId = useId();
  const copy: AgentPlanPreviewLabels = {
    ...defaultLabels,
    ...labels,
    risk: { ...defaultLabels.risk, ...labels?.risk },
    citationStates: { ...defaultLabels.citationStates, ...labels?.citationStates },
  };

  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
        sx={{ px: 2.5, py: 2 }}
      >
        <Box>
          <Typography id={titleId} component="h2" variant="h6">
            {title}
          </Typography>
          {summary && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {summary}
            </Typography>
          )}
        </Box>
        <Chip
          color={riskColor[riskLevel]}
          variant="outlined"
          icon={riskLevel === 'low' ? <ShieldCheck size={15} /> : <ShieldAlert size={15} />}
          label={riskLabel ?? copy.risk[riskLevel]}
        />
      </Stack>

      <Divider />

      <List disablePadding aria-label={copy.planSteps} sx={{ px: 2.5, py: 1 }}>
        {steps.map((step, index) => (
          <ListItem key={step.id} disableGutters sx={{ py: 1.25, alignItems: 'flex-start' }}>
            <Box
              aria-hidden="true"
              sx={{
                width: 24,
                height: 24,
                flexShrink: 0,
                display: 'grid',
                placeItems: 'center',
                borderRadius: '50%',
                bgcolor: 'action.selected',
                color: 'primary.main',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {index + 1}
            </Box>
            <Box sx={{ ml: 1.25, minWidth: 0, flex: 1 }}>
              <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                <Typography variant="body2" fontWeight={600}>
                  {step.title}
                </Typography>
                {step.tool && <Chip label={step.tool} size="small" variant="outlined" />}
              </Stack>
              {step.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {step.description}
                </Typography>
              )}
            </Box>
          </ListItem>
        ))}
      </List>

      {sources.length > 0 && (
        <Box sx={{ px: 2.5, pb: 2 }}>
          <Typography component="h3" variant="subtitle2" sx={{ mb: 0.5 }}>
            {copy.sources}
          </Typography>
          <SourceCitationList
            sources={sources}
            ariaLabel={copy.planSources}
            stateLabels={copy.citationStates}
          />
        </Box>
      )}

      <Divider />

      <Box sx={{ px: 2.5, py: 2 }}>
        {state === 'approved' && <Alert severity="success">{copy.planApproved}</Alert>}
        {state === 'rejected' && <Alert severity="info">{copy.planRejected}</Alert>}
        {!settled && (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ sm: 'center' }}
            gap={1.5}
          >
            <Typography variant="body2" color="text.secondary">
              {approvalRequired ? copy.reviewBeforeExecution : copy.noApprovalRequired}
            </Typography>
            {approvalRequired && (
              <Stack direction="row" gap={1} justifyContent={{ xs: 'stretch', sm: 'flex-end' }}>
                <Button
                  color="inherit"
                  variant="outlined"
                  startIcon={<X size={16} />}
                  onClick={onReject}
                >
                  {rejectLabel}
                </Button>
                <Button variant="contained" startIcon={<Check size={16} />} onClick={onApprove}>
                  {approveLabel}
                </Button>
              </Stack>
            )}
          </Stack>
        )}
      </Box>
    </Box>
  );
}
