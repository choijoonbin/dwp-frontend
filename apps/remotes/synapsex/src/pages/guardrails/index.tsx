/**
 * Guardrails — List + enabled toggle + editor + evaluate panel
 */

import { useMemo, useState } from 'react';
import { Label, Iconify } from '@dwp-frontend/design-system';
import {
  useGuardrailsQuery,
  type GuardrailListDto,
  useCreateGuardrailMutation,
  useUpdateGuardrailMutation,
  useDeleteGuardrailMutation,
  type GuardrailUpsertRequest,
  useEvaluateGuardrailMutation,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CardContent from '@mui/material/CardContent';

import { EvaluatePanel } from './components/evaluate-panel';
import { GuardrailEditorModal } from './components/guardrail-editor-modal';

// ----------------------------------------------------------------------

export const GuardrailsPage = () => {
  const [query, setQuery] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<GuardrailListDto | null>(null);
  const [evaluateResult, setEvaluateResult] = useState<{
    allowed: boolean;
    requiredApprovalLevel?: string;
    violatedRules?: string[];
  } | null>(null);

  const { data, isLoading, error } = useGuardrailsQuery();
  const items: GuardrailListDto[] = (() => {
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object' && 'items' in data) {
      const arr = (data as { items?: unknown[] }).items;
      return Array.isArray(arr) ? (arr as GuardrailListDto[]) : [];
    }
    return [];
  })();
  const createMutation = useCreateGuardrailMutation();
  const updateMutation = useUpdateGuardrailMutation();
  const deleteMutation = useDeleteGuardrailMutation();
  const evaluateMutation = useEvaluateGuardrailMutation();

  const rows = useMemo(
    () =>
      items.filter((g) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return (
          g.name.toLowerCase().includes(q) ||
          g.scope.toLowerCase().includes(q) ||
          JSON.stringify(g.ruleJson ?? {}).toLowerCase().includes(q)
        );
      }),
    [items, query]
  );

  const enabledCount = items.filter((g) => g.isEnabled).length;

  const handleCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const handleEdit = (g: GuardrailListDto) => {
    setEditing(g);
    setEditorOpen(true);
  };

  const handleEditorSubmit = (body: GuardrailUpsertRequest) => {
    if (editing) {
      updateMutation.mutate(
        { guardrailId: editing.guardrailId, body },
        { onSuccess: () => setEditorOpen(false) }
      );
    } else {
      createMutation.mutate(body, { onSuccess: () => setEditorOpen(false) });
    }
  };

  const handleToggleEnabled = (g: GuardrailListDto) => {
    updateMutation.mutate({
      guardrailId: g.guardrailId,
      body: {
        name: g.name,
        scope: g.scope,
        ruleJson: g.ruleJson as Record<string, unknown>,
        isEnabled: !g.isEnabled,
      },
    });
  };

  const handleDelete = (g: GuardrailListDto) => {
    if (window.confirm(`Delete guardrail "${g.name}"?`)) {
      deleteMutation.mutate(g.guardrailId);
    }
  };

  const handleEvaluate = (params: Parameters<typeof evaluateMutation.mutateAsync>[0]) => {
    evaluateMutation.mutate(params, {
      onSuccess: (result) => setEvaluateResult(result),
    });
  };

  if (error) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Card variant="outlined">
          <CardContent sx={{ p: 6, textAlign: 'center' }}>
            <Iconify icon="solar:danger-triangle-bold-duotone" width={48} sx={{ color: 'error.main', mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              Failed to load guardrails
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
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'flex-start' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Iconify icon="solar:shield-check-bold" width={24} sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Guardrails
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Define non-negotiable rules the agent must obey. These rules gate automated actions across all tenants.
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            startIcon={<Iconify icon="solar:add-circle-bold" width={18} />}
            onClick={handleCreate}
          >
            New Guardrail
          </Button>
        </Stack>

        {/* Stats */}
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                  Enabled guardrails
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                  Active protections enforced by the agent
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {enabledCount}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                  Total rules
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                  All guardrails (enabled + disabled)
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {items.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                  Common patterns
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                  Amount caps, bank-change cooldown, SoD
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                  <Chip label="Amount cap" size="small" variant="outlined" />
                  <Chip label="Cooldown" size="small" variant="outlined" />
                  <Chip label="Dual approval" size="small" variant="outlined" />
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          {/* Guardrail List */}
          <Grid size={{ xs: 12, lg: 8 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2.5 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                  <Iconify icon="solar:shield-warning-bold" width={20} sx={{ color: 'primary.main' }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Guardrail Ruleset
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  Toggle guardrails on/off, edit rules, and review the exact constraint enforced.
                </Typography>
                <TextField
                  size="small"
                  placeholder="Search guardrails..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  sx={{ mb: 2, width: '100%', maxWidth: 360 }}
                  InputProps={{
                    startAdornment: (
                      <Iconify icon="solar:magnifer-linear" width={20} sx={{ mr: 1, color: 'text.secondary' }} />
                    ),
                  }}
                />
                <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
                  {isLoading ? (
                    <Box sx={{ p: 8, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        Loading…
                      </Typography>
                    </Box>
                  ) : rows.length === 0 ? (
                    <Box sx={{ p: 10, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        No guardrails match the current filters.
                      </Typography>
                    </Box>
                  ) : (
                    rows.map((g, index) => (
                      <Box key={g.guardrailId}>
                        {index > 0 && <Divider />}
                        <Box sx={{ p: 2.5 }}>
                          <Stack
                            direction={{ xs: 'column', lg: 'row' }}
                            alignItems={{ lg: 'center' }}
                            spacing={2}
                          >
                            <Box sx={{ flex: 1 }}>
                              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {g.name}
                                </Typography>
                                <Chip label={g.scope} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                                {!g.isEnabled && (
                                  <Chip label="disabled" size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />
                                )}
                              </Stack>
                              <Typography variant="body2" color="text.secondary">
                                {typeof g.ruleJson === 'object' && g.ruleJson
                                  ? JSON.stringify(g.ruleJson)
                                  : '—'}
                              </Typography>
                            </Box>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Label
                                color={g.isEnabled ? 'success' : 'default'}
                                sx={{ fontSize: '0.75rem' }}
                              >
                                {g.isEnabled ? 'On' : 'Off'}
                              </Label>
                              <IconButton
                                size="small"
                                onClick={() => handleToggleEnabled(g)}
                                disabled={updateMutation.isPending}
                                title={g.isEnabled ? 'Disable' : 'Enable'}
                              >
                                <Iconify
                                  icon={g.isEnabled ? 'solar:shield-check-bold' : 'solar:shield-cross-bold'}
                                  width={18}
                                />
                              </IconButton>
                              <IconButton size="small" onClick={() => handleEdit(g)} title="Edit">
                                <Iconify icon="solar:pen-bold" width={16} />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDelete(g)}
                                disabled={deleteMutation.isPending}
                                title="Delete"
                              >
                                <Iconify icon="solar:trash-bin-trash-bold" width={16} />
                              </IconButton>
                            </Stack>
                          </Stack>
                        </Box>
                      </Box>
                    ))
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Evaluate Panel */}
          <Grid size={{ xs: 12, lg: 4 }}>
            <EvaluatePanel
              onEvaluate={handleEvaluate}
              result={evaluateResult}
              isLoading={evaluateMutation.isPending}
            />
          </Grid>
        </Grid>
      </Stack>

      <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} maxWidth="md" fullWidth>
        <GuardrailEditorModal
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          onSubmit={handleEditorSubmit}
          isLoading={createMutation.isPending || updateMutation.isPending}
          initial={editing}
        />
      </Dialog>
    </Box>
  );
};
