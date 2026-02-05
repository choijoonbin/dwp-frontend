/**
 * Feedback — Submit feedback for case/doc/entity + list by targetId
 */

import type { SelectChangeEvent } from '@mui/material/Select';

import { useState } from 'react';
import { Label, Iconify } from '@dwp-frontend/design-system';
import {
  useFeedbackQuery,
  type FeedbackLabelDto,
  useCreateFeedbackMutation,
  type FeedbackCreateRequest,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputLabel from '@mui/material/InputLabel';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';
import DialogContentText from '@mui/material/DialogContentText';

// ----------------------------------------------------------------------

const TARGET_TYPES: { value: FeedbackCreateRequest['targetType']; label: string }[] = [
  { value: 'CASE', label: 'Case' },
  { value: 'DOC', label: 'Document' },
  { value: 'ENTITY', label: 'Entity' },
];

const LABELS: { value: FeedbackCreateRequest['label']; label: string; color: 'success' | 'error' | 'default' }[] = [
  { value: 'VALID', label: 'Valid', color: 'success' },
  { value: 'INVALID', label: 'Invalid', color: 'error' },
  { value: 'NEEDS_REVIEW', label: 'Needs Review', color: 'default' },
];

// ----------------------------------------------------------------------

export const FeedbackPage = () => {
  const [targetType, setTargetType] = useState<FeedbackCreateRequest['targetType']>('CASE');
  const [targetId, setTargetId] = useState('');
  const [label, setLabel] = useState<FeedbackCreateRequest['label']>('NEEDS_REVIEW');
  const [comment, setComment] = useState('');
  const [submitOpen, setSubmitOpen] = useState(false);
  const [filterTargetType, setFilterTargetType] = useState<string>('');
  const [filterTargetId, setFilterTargetId] = useState('');
  const [appliedTargetType, setAppliedTargetType] = useState<string>('');
  const [appliedTargetId, setAppliedTargetId] = useState('');

  const { data, isLoading, error } = useFeedbackQuery(
    appliedTargetType || undefined,
    appliedTargetId || undefined
  );
  const feedbackList: FeedbackLabelDto[] = (() => {
    if (Array.isArray(data)) return data as FeedbackLabelDto[];
    if (data && typeof data === 'object' && 'items' in data) {
      const arr = (data as { items?: FeedbackLabelDto[] }).items;
      return Array.isArray(arr) ? arr : [];
    }
    return [];
  })();

  const createMutation = useCreateFeedbackMutation();

  const handleApplyFilter = () => {
    setAppliedTargetType(filterTargetType);
    setAppliedTargetId(filterTargetId.trim());
  };

  const handleSubmitFeedback = () => {
    const body: FeedbackCreateRequest = {
      targetType,
      targetId: targetId.trim(),
      label,
      comment: comment.trim() || undefined,
    };
    if (!body.targetId) return;
    createMutation.mutate(body, {
      onSuccess: () => {
        setSubmitOpen(false);
        setTargetId('');
        setComment('');
        setLabel('NEEDS_REVIEW');
        setAppliedTargetType(targetType);
        setAppliedTargetId(body.targetId);
        setFilterTargetType(targetType);
        setFilterTargetId(body.targetId);
      },
    });
  };

  if (error) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Card variant="outlined">
          <CardContent sx={{ p: 6, textAlign: 'center' }}>
            <Iconify icon="solar:danger-triangle-bold-duotone" width={48} sx={{ color: 'error.main', mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              Failed to load feedback
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {error instanceof Error ? error.message : 'Unknown error'}
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, width: '100%' }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          alignItems={{ lg: 'flex-end' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Iconify icon="solar:chat-round-like-bold" width={20} sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Feedback & Labeling
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Human-in-the-loop quality loop: label outcomes for cases, documents, or entities.
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            startIcon={<Iconify icon="solar:add-circle-bold" width={18} />}
            onClick={() => setSubmitOpen(true)}
          >
            Submit Feedback
          </Button>
        </Stack>

        {/* Filter by target */}
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              List feedback by target
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Filter feedback by target type and ID (e.g., case-123, doc-456).
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel id="filter-target-type-label">Target Type</InputLabel>
                <Select
                  labelId="filter-target-type-label"
                  label="Target Type"
                  value={filterTargetType}
                  onChange={(e: SelectChangeEvent) => setFilterTargetType(e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  {TARGET_TYPES.map((t) => (
                    <MenuItem key={t.value} value={t.value}>
                      {t.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                label="Target ID"
                value={filterTargetId}
                onChange={(e) => setFilterTargetId(e.target.value)}
                placeholder="e.g., case-123"
                sx={{ flex: 1, maxWidth: 240 }}
              />
              <Button variant="outlined" onClick={handleApplyFilter} startIcon={<Iconify icon="solar:magnifer-linear" width={18} />}>
                Search
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {/* Feedback list */}
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Iconify icon="solar:chat-round-dots-bold" width={18} sx={{ color: 'text.secondary' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Feedback List
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              {appliedTargetType || appliedTargetId
                ? `Showing feedback for ${appliedTargetType || 'any type'} ${appliedTargetId ? `· ${appliedTargetId}` : ''}`
                : 'Enter target type and ID above, then click Search.'}
            </Typography>
            <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell>Target</TableCell>
                    <TableCell sx={{ width: 120 }}>Label</TableCell>
                    <TableCell>Comment</TableCell>
                    <TableCell sx={{ width: 160 }}>Created</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 8 }}>
                        <Typography variant="body2" color="text.secondary">
                          Loading…
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : feedbackList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 10 }}>
                        <Stack alignItems="center" spacing={1}>
                          <Iconify icon="solar:chat-round-like-bold" width={48} sx={{ color: 'text.disabled' }} />
                          <Typography variant="body2" color="text.secondary">
                            No feedback found
                          </Typography>
                          <Typography variant="caption" color="text.disabled">
                            {appliedTargetType || appliedTargetId
                              ? 'Try different filters'
                              : 'Submit feedback or filter by target'}
                          </Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ) : (
                    feedbackList.map((f) => {
                      const labelMeta = LABELS.find((l) => l.value === f.label);
                      return (
                        <TableRow key={f.feedbackId} hover>
                          <TableCell>
                            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                              {f.targetType}:{f.targetId}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Label color={labelMeta?.color ?? 'default'} sx={{ fontSize: '0.75rem' }}>
                              {f.label}
                            </Label>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {f.comment ?? '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">
                              {f.createdAt ? new Date(f.createdAt).toLocaleString() : '—'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Stack>

      {/* Submit Feedback Dialog */}
      <Dialog open={submitOpen} onClose={() => setSubmitOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Submit Feedback</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 3 }}>
            Submit feedback for a case, document, or entity. Labels help improve model quality.
          </DialogContentText>
          <Stack spacing={2.5}>
            <FormControl fullWidth>
              <InputLabel id="submit-target-type-label">Target Type</InputLabel>
              <Select
                labelId="submit-target-type-label"
                label="Target Type"
                value={targetType}
                onChange={(e: SelectChangeEvent) => setTargetType(e.target.value as FeedbackCreateRequest['targetType'])}
              >
                {TARGET_TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>
                    {t.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              fullWidth
              label="Target ID"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              placeholder="e.g., case-123, doc-456"
              required
            />
            <FormControl fullWidth>
              <InputLabel id="submit-label-label">Label</InputLabel>
              <Select
                labelId="submit-label-label"
                label="Label"
                value={label}
                onChange={(e: SelectChangeEvent) => setLabel(e.target.value as FeedbackCreateRequest['label'])}
              >
                {LABELS.map((l) => (
                  <MenuItem key={l.value} value={l.value}>
                    {l.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              fullWidth
              multiline
              rows={3}
              label="Comment (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Additional context or rationale"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubmitOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmitFeedback}
            disabled={!targetId.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? 'Submitting…' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
