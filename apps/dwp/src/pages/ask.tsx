import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { AgentPlanPreview, SourceCitationList } from '@dwp-frontend/design-system';
import { useToast } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';

import { PageHeader, ReferenceModeChip, SectionHeading } from '../features/work-hub/workspace-ui';
import { askPlanSteps, askSources } from '../features/work-hub/reference-data';

const promptExamples = [
  'Can I work remotely next Friday?',
  'What is blocking my urgent work?',
  'Where do I request software access?',
] as const;

const contextItems = [
  ['Customer discovery', 'Meeting at 11:00 / 6 sources'],
  ['Software access', 'Approval due at 10:30'],
  ['Benefits enrollment', 'Window closes at 17:00'],
] as const;

export default function AskPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(initialQuery || null);
  const restricted = Boolean(submittedQuery && /salary|confidential/i.test(submittedQuery));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    if (value) setSubmittedQuery(value);
  };

  const choosePrompt = (value: string) => {
    setQuery(value);
    setSubmittedQuery(value);
  };

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 4 } }}>
      <PageHeader
        eyebrow="Enterprise intelligence"
        title="Ask DWP"
        description="Find trusted context and prepare governed actions"
        action={<ReferenceModeChip />}
      />

      <Box
        component="form"
        onSubmit={submit}
        sx={{
          mt: 3,
          p: { xs: 2, sm: 2.5 },
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) auto' },
          gap: 1.5,
          alignItems: 'end',
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderTop: 3,
          borderTopColor: 'primary.main',
          borderRadius: 1,
          boxShadow: (theme) =>
            theme.palette.mode === 'dark'
              ? '0 12px 32px rgba(0, 0, 0, 0.22)'
              : '0 12px 32px rgba(15, 21, 29, 0.06)',
        }}
      >
        <TextField
          fullWidth
          label="Ask a work question"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ask about a policy, task, service, or application"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={19} strokeWidth={1.8} aria-hidden="true" />
                </InputAdornment>
              ),
            },
          }}
        />
        <Button
          type="submit"
          variant="contained"
          endIcon={<ArrowRight size={16} />}
          sx={{ minWidth: 112 }}
        >
          Ask DWP
        </Button>
      </Box>

      <Box
        sx={{
          mt: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
          Suggested
        </Typography>
        {promptExamples.map((prompt) => (
          <Button key={prompt} size="small" variant="text" onClick={() => choosePrompt(prompt)}>
            {prompt}
          </Button>
        ))}
      </Box>

      {!submittedQuery && (
        <Box
          component="section"
          aria-labelledby="recent-context-heading"
          sx={{ mt: 5, borderTop: 1, borderBottom: 1, borderColor: 'divider' }}
        >
          <Box sx={{ py: 2.5 }}>
            <SectionHeading
              id="recent-context-heading"
              icon={Sparkles}
              title="Recent work context"
            />
          </Box>
          <Box
            component="ul"
            sx={{
              p: 0,
              m: 0,
              listStyle: 'none',
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            }}
          >
            {contextItems.map(([title, detail], index) => (
              <Box
                component="li"
                key={title}
                sx={{
                  py: 2.5,
                  px: { xs: 0, md: 2.5 },
                  borderTop: 1,
                  borderLeft: { xs: 0, md: index === 0 ? 0 : 1 },
                  borderColor: 'divider',
                }}
              >
                <Typography component="h3" variant="subtitle2">
                  {title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                  {detail}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {submittedQuery && (
        <Box sx={{ mt: 4 }}>
          <Box
            aria-label="AI response status"
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
              borderTop: 1,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            {[
              [ShieldCheck, 'Permission checked', 'Employee scope'],
              [
                BookOpenCheck,
                restricted ? 'Retrieval stopped' : 'Sources verified',
                restricted ? 'Policy protected' : '2 current records',
              ],
              [
                CheckCircle2,
                restricted ? 'No answer generated' : 'Action preview ready',
                restricted ? 'Human handoff' : 'No mutation',
              ],
            ].map(([Icon, label, detail], index) => {
              const StatusIcon = Icon as typeof ShieldCheck;
              return (
                <Box
                  key={label as string}
                  sx={{
                    py: 1.75,
                    px: { xs: 0, sm: 2.5 },
                    display: 'grid',
                    gridTemplateColumns: '26px minmax(0, 1fr)',
                    alignItems: 'center',
                    gap: 1,
                    borderLeft: { xs: 0, sm: index === 0 ? 0 : 1 },
                    borderTop: { xs: index === 0 ? 0 : 1, sm: 0 },
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ color: restricted && index > 0 ? 'warning.main' : 'success.main' }}>
                    <StatusIcon size={18} strokeWidth={1.8} aria-hidden="true" />
                  </Box>
                  <Box>
                    <Typography component="p" variant="subtitle2">
                      {label as string}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {detail as string}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>

          <Box component="section" aria-labelledby="answer-heading" sx={{ mt: 4 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 1,
              }}
            >
              <SectionHeading id="answer-heading" icon={Sparkles} title="Answer" />
              <Chip
                label="AI generated / review required"
                color="info"
                variant="outlined"
                size="small"
              />
            </Box>
            <Divider sx={{ mt: 1.5 }} />

            {restricted ? (
              <Alert severity="warning" icon={<LockKeyhole size={20} />} sx={{ mt: 3 }}>
                This question includes restricted information. No source content was retrieved and
                no answer was sent to an AI model in this reference session.
              </Alert>
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
                    lg: 'minmax(0, 1.8fr) minmax(300px, 0.8fr)',
                  },
                  gap: { xs: 4, lg: 5 },
                  mt: 3,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary">
                    Your question
                  </Typography>
                  <Typography component="h3" variant="subtitle1" sx={{ mt: 0.4 }}>
                    {submittedQuery}
                  </Typography>
                  <Box sx={{ mt: 2.5, pl: 2.5, borderLeft: 3, borderColor: 'primary.main' }}>
                    <Typography sx={{ fontSize: '1rem', lineHeight: 1.75 }}>
                      The flexible work policy allows eligible employees to request up to two remote
                      workdays per week. A manager must approve the dates before the request becomes
                      active. Submit the request before Thursday at 15:00 so the team calendar can
                      be updated.
                    </Typography>
                  </Box>
                  <Alert severity="info" variant="outlined" sx={{ mt: 2.5 }}>
                    Eligibility and local workplace rules can change the result. Confirm the request
                    preview before submission.
                  </Alert>
                </Box>
                <Box component="aside" aria-labelledby="sources-heading" sx={{ minWidth: 0 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: 2,
                    }}
                  >
                    <Typography id="sources-heading" component="h3" variant="subtitle2">
                      Verified sources
                    </Typography>
                    <Typography variant="caption" color="success.main" fontWeight={700}>
                      2 current
                    </Typography>
                  </Box>
                  <SourceCitationList sources={askSources} ariaLabel="Answer sources" />
                </Box>
              </Box>
            )}
          </Box>

          {!restricted && (
            <Box sx={{ mt: 4 }}>
              <AgentPlanPreview
                title="Flexible work request preview"
                summary="No external system will be changed from this reference flow."
                riskLevel="medium"
                riskLabel="Approval required"
                steps={askPlanSteps}
                sources={askSources}
                approveLabel="Open service preview"
                rejectLabel="Dismiss"
                onApprove={() => {
                  toast.success('Employee services preview opened.');
                  navigate('/apps?app=service');
                }}
                onReject={() => setSubmittedQuery(null)}
              />
            </Box>
          )}
        </Box>
      )}
    </Container>
  );
}
