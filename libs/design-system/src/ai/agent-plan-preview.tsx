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
  riskLabel = `${riskLevel[0].toUpperCase()}${riskLevel.slice(1)} risk`,
  steps,
  sources = [],
  approvalRequired = true,
  state = 'review',
  onApprove,
  onReject,
  approveLabel = 'Approve plan',
  rejectLabel = 'Reject',
}: AgentPlanPreviewProps) {
  const settled = state !== 'review';
  const titleId = useId();

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
          label={riskLabel}
        />
      </Stack>

      <Divider />

      <List disablePadding aria-label="Plan steps" sx={{ px: 2.5, py: 1 }}>
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
            Sources
          </Typography>
          <SourceCitationList sources={sources} ariaLabel="Plan sources" />
        </Box>
      )}

      <Divider />

      <Box sx={{ px: 2.5, py: 2 }}>
        {state === 'approved' && <Alert severity="success">Plan approved</Alert>}
        {state === 'rejected' && <Alert severity="info">Plan rejected</Alert>}
        {!settled && (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ sm: 'center' }}
            gap={1.5}
          >
            <Typography variant="body2" color="text.secondary">
              {approvalRequired
                ? 'Review the sources and changes before execution.'
                : 'This plan can run without approval under the current policy.'}
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
