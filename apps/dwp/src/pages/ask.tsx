import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Search, Sparkles } from 'lucide-react';
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

import { askPlanSteps, askSources } from '../features/work-hub/reference-data';

const promptExamples = [
  'Can I work remotely next Friday?',
  'What is blocking my urgent work?',
  'Where do I request software access?',
] as const;

export default function AskPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);
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
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          gap: 1.5,
        }}
      >
        <Box>
          <Typography component="h1" variant="h4">
            Ask DWP
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Search work, services, and verified knowledge
          </Typography>
        </Box>
        <Chip label="Reference data" variant="outlined" size="small" />
      </Box>

      <Box component="form" onSubmit={submit} sx={{ mt: 4 }}>
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
              endAdornment: (
                <InputAdornment position="end">
                  <Button type="submit" variant="contained" endIcon={<ArrowRight size={16} />}>
                    Ask
                  </Button>
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
        {promptExamples.map((prompt) => (
          <Button key={prompt} size="small" variant="outlined" onClick={() => choosePrompt(prompt)}>
            {prompt}
          </Button>
        ))}
      </Box>

      {submittedQuery && (
        <Box sx={{ mt: 5 }}>
          <Box component="section" aria-labelledby="answer-heading">
            <Box
              sx={{
                display: 'flex',
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Sparkles size={20} strokeWidth={1.8} aria-hidden="true" />
                <Typography id="answer-heading" component="h2" variant="h6">
                  Answer
                </Typography>
              </Box>
              <Chip label="AI generated preview" color="info" variant="outlined" size="small" />
            </Box>
            <Divider sx={{ mt: 1, mb: 3 }} />

            {restricted ? (
              <Alert severity="warning">
                This question includes restricted information. No source content was retrieved in
                this reference session.
              </Alert>
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
                    md: 'minmax(0, 2fr) minmax(260px, 1fr)',
                  },
                  gap: { xs: 4, md: 5 },
                }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Question
                  </Typography>
                  <Typography component="p" variant="subtitle2" sx={{ mt: 0.5 }}>
                    {submittedQuery}
                  </Typography>
                  <Typography sx={{ mt: 2 }}>
                    The flexible work policy allows eligible employees to request up to two remote
                    workdays per week. A manager must approve the dates before the request becomes
                    active. Submit the request before Thursday at 15:00 so the team calendar can be
                    updated.
                  </Typography>
                  <Alert severity="info" variant="outlined" sx={{ mt: 2.5 }}>
                    Eligibility and local workplace rules can change the result. Confirm the request
                    preview before submission.
                  </Alert>
                </Box>
                <Box component="aside" aria-labelledby="sources-heading">
                  <Typography id="sources-heading" component="h3" variant="subtitle2">
                    Sources
                  </Typography>
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
