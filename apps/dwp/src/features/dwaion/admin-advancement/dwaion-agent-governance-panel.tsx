import { useMemo, useState } from 'react';
import { Ban, FlaskConical, Rocket, RotateCcw, ShieldCheck } from 'lucide-react';
import { ActionButton, FormField, SelectField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { RegistryEntry } from '@dwp-frontend/shared-utils';

import { useDwaionAdminAdvancementCopy } from './dwaion-admin-advancement-copy';
import { DwaionAdminSection } from './dwaion-admin-advancement-ui';
import {
  DwaionGovernedCommandDialog,
  type DwaionCommandIntent,
} from './dwaion-governed-command-dialog';

type AgentDraft = {
  allowedWork: string;
  prohibitedWork: string;
  inputSchema: string;
  outputSchema: string;
  modelRoute: string;
  sourceBindings: string;
  toolBindings: string;
  semanticDiff: string;
  evaluationEvidence: string;
  rolloutPercent: string;
  memoryPolicy: 'DISABLED' | 'SESSION' | 'SCOPED';
};

const EMPTY_DRAFT: AgentDraft = {
  allowedWork: '',
  prohibitedWork: '',
  inputSchema: '',
  outputSchema: '',
  modelRoute: '',
  sourceBindings: '',
  toolBindings: '',
  semanticDiff: '',
  evaluationEvidence: '',
  rolloutPercent: '10',
  memoryPolicy: 'DISABLED',
};

export function DwaionAgentGovernancePanel({
  agents,
  onRefresh,
}: {
  agents: RegistryEntry[];
  onRefresh: () => void | Promise<void>;
}) {
  const copy = useDwaionAdminAdvancementCopy();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AgentDraft | null>(null);
  const [intent, setIntent] = useState<DwaionCommandIntent | null>(null);
  const selected = useMemo(
    () => agents.find((agent) => `${agent.entryKey}:${agent.revision}` === selectedId) ?? agents[0],
    [agents, selectedId]
  );
  const activeDraft = selected ? (draft ?? agentDraft(selected)) : EMPTY_DRAFT;

  const open = (
    kind: 'AGENT_PROMOTE' | 'AGENT_EVALUATE' | 'AGENT_ROLLBACK' | 'AGENT_KILL_SWITCH'
  ) => {
    if (!selected) return;
    setIntent({
      title:
        kind === 'AGENT_PROMOTE'
          ? copy.agents.promote
          : kind === 'AGENT_EVALUATE'
            ? 'Sandbox evaluation'
            : kind === 'AGENT_ROLLBACK'
              ? copy.agents.rollback
              : copy.agents.kill,
      description: copy.command.description,
      kind,
      target: { type: 'AGENT_REVISION', id: `${selected.entryKey}:${selected.revision}` },
      expectedVersion: selected.version,
      changes: [
        { label: 'Lifecycle', before: selected.lifecycleState, after: commandAfter(kind) },
        {
          label: 'Model route',
          before: selected.artifactVersion,
          after: activeDraft.modelRoute || '—',
        },
        { label: 'Memory', before: 'Registry default', after: activeDraft.memoryPolicy },
        {
          label: 'Semantic diff',
          before: 'Current immutable revision',
          after: activeDraft.semanticDiff || '—',
        },
        {
          label: 'Canary traffic',
          before: '0%',
          after: `${activeDraft.rolloutPercent || '0'}%`,
        },
      ],
      impacts: [
        selected.ownerRef,
        `${selected.riskTier} risk tier`,
        'Bound sources and tools',
        activeDraft.evaluationEvidence || 'Evaluation evidence pending',
      ],
      recoveryPlan:
        'Restore the previous active agent revision, disable changed bindings, and rerun the pinned evaluation suite.',
      payload: activeDraft,
      destructive: kind === 'AGENT_ROLLBACK' || kind === 'AGENT_KILL_SWITCH',
    });
  };

  if (!selected) return null;

  return (
    <>
      <Box sx={{ mt: 2.5 }}>
        <DwaionAdminSection title={copy.agents.title} description={copy.agents.description}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: '15rem minmax(0,1fr) 18rem' },
              minHeight: { lg: 410 },
            }}
          >
            <Stack
              sx={{
                borderRight: { lg: 1 },
                borderBottom: { xs: 1, lg: 0 },
                borderColor: 'divider',
              }}
            >
              {agents.map((agent) => {
                const id = `${agent.entryKey}:${agent.revision}`;
                const active = id === `${selected.entryKey}:${selected.revision}`;
                return (
                  <ButtonBase
                    key={id}
                    aria-pressed={active}
                    onClick={() => {
                      setSelectedId(id);
                      setDraft(null);
                    }}
                    sx={{
                      width: 1,
                      px: 1.75,
                      py: 1.5,
                      textAlign: 'left',
                      bgcolor: active ? 'action.selected' : undefined,
                    }}
                  >
                    <Box sx={{ width: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2" noWrap>
                        {agent.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        rev {agent.revision} · {agent.lifecycleState}
                      </Typography>
                    </Box>
                  </ButtonBase>
                );
              })}
            </Stack>

            <Stack spacing={1.5} sx={{ p: 2, minWidth: 0 }}>
              <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                <Typography component="h3" variant="h6">
                  {selected.name}
                </Typography>
                <Chip size="small" label={`v${selected.version}`} />
                <Chip size="small" variant="outlined" label={selected.riskTier} />
              </Stack>
              <FormField
                multiline
                minRows={2}
                label="Allowed work"
                value={activeDraft.allowedWork}
                onChange={(event) => setDraft({ ...activeDraft, allowedWork: event.target.value })}
              />
              <FormField
                multiline
                minRows={2}
                label="Prohibited work"
                value={activeDraft.prohibitedWork}
                onChange={(event) =>
                  setDraft({ ...activeDraft, prohibitedWork: event.target.value })
                }
              />
              <FormField
                multiline
                minRows={2}
                label="Semantic version diff"
                value={activeDraft.semanticDiff}
                onChange={(event) => setDraft({ ...activeDraft, semanticDiff: event.target.value })}
              />
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 1.5,
                }}
              >
                <FormField
                  label="Input schema"
                  value={activeDraft.inputSchema}
                  onChange={(event) =>
                    setDraft({ ...activeDraft, inputSchema: event.target.value })
                  }
                />
                <FormField
                  label="Output schema"
                  value={activeDraft.outputSchema}
                  onChange={(event) =>
                    setDraft({ ...activeDraft, outputSchema: event.target.value })
                  }
                />
                <FormField
                  label="Source bindings"
                  value={activeDraft.sourceBindings}
                  onChange={(event) =>
                    setDraft({ ...activeDraft, sourceBindings: event.target.value })
                  }
                />
                <FormField
                  label="Tool bindings"
                  value={activeDraft.toolBindings}
                  onChange={(event) =>
                    setDraft({ ...activeDraft, toolBindings: event.target.value })
                  }
                />
              </Box>
            </Stack>

            <Stack
              spacing={1.5}
              sx={{
                p: 2,
                borderLeft: { lg: 1 },
                borderTop: { xs: 1, lg: 0 },
                borderColor: 'divider',
              }}
            >
              <Stack direction="row" gap={1} alignItems="center">
                <FlaskConical size={17} aria-hidden="true" />
                <Typography variant="subtitle2">Pinned rollout contract</Typography>
              </Stack>
              <FormField
                label="Model route"
                value={activeDraft.modelRoute}
                onChange={(event) => setDraft({ ...activeDraft, modelRoute: event.target.value })}
              />
              <SelectField
                label="Memory policy"
                value={activeDraft.memoryPolicy}
                options={(['DISABLED', 'SESSION', 'SCOPED'] as const).map((value) => ({
                  value,
                  label: value,
                }))}
                onValueChange={(value) =>
                  value && setDraft({ ...activeDraft, memoryPolicy: value })
                }
              />
              <FormField
                multiline
                minRows={2}
                label="Pinned evaluation evidence"
                value={activeDraft.evaluationEvidence}
                onChange={(event) =>
                  setDraft({ ...activeDraft, evaluationEvidence: event.target.value })
                }
              />
              <FormField
                type="number"
                label="Canary traffic percent"
                value={activeDraft.rolloutPercent}
                onChange={(event) =>
                  setDraft({ ...activeDraft, rolloutPercent: event.target.value })
                }
              />
              <Divider />
              <ActionButton
                intent="secondary"
                startIcon={<FlaskConical size={16} />}
                onClick={() => open('AGENT_EVALUATE')}
              >
                Sandbox evaluation
              </ActionButton>
              <ActionButton
                intent="primary"
                startIcon={<Rocket size={16} />}
                disabled={!promotionReady(activeDraft)}
                onClick={() => open('AGENT_PROMOTE')}
              >
                {copy.agents.promote}
              </ActionButton>
              <ActionButton
                intent="secondary"
                startIcon={<RotateCcw size={16} />}
                onClick={() => open('AGENT_ROLLBACK')}
              >
                {copy.agents.rollback}
              </ActionButton>
              <ActionButton
                intent="danger"
                startIcon={<Ban size={16} />}
                onClick={() => open('AGENT_KILL_SWITCH')}
              >
                {copy.agents.kill}
              </ActionButton>
              <Stack direction="row" gap={0.75} alignItems="center">
                <ShieldCheck size={15} aria-hidden="true" />
                <Typography variant="caption" color="text.secondary">
                  expectedVersion · UUID · Maker-Checker · receipt
                </Typography>
              </Stack>
            </Stack>
          </Box>
        </DwaionAdminSection>
      </Box>
      <DwaionGovernedCommandDialog
        intent={intent}
        onClose={() => setIntent(null)}
        onReconcile={async () => {
          setDraft(null);
          await onRefresh();
        }}
        onCompleted={async () => {
          setIntent(null);
          setDraft(null);
          await onRefresh();
        }}
      />
    </>
  );
}

function agentDraft(agent: RegistryEntry): AgentDraft {
  return {
    ...EMPTY_DRAFT,
    allowedWork: agent.description ?? '',
    inputSchema: `${agent.entryKey}.input.v${agent.revision}`,
    outputSchema: `${agent.entryKey}.output.v${agent.revision}`,
    modelRoute: agent.artifactVersion,
  };
}

function commandAfter(
  kind: 'AGENT_PROMOTE' | 'AGENT_EVALUATE' | 'AGENT_ROLLBACK' | 'AGENT_KILL_SWITCH'
) {
  if (kind === 'AGENT_PROMOTE') return 'CANARY_PENDING';
  if (kind === 'AGENT_EVALUATE') return 'SANDBOX_EVALUATION_PENDING';
  if (kind === 'AGENT_ROLLBACK') return 'ROLLBACK_PENDING';
  return 'KILL_PENDING';
}

function promotionReady(draft: AgentDraft) {
  const rolloutPercent = Number(draft.rolloutPercent);
  return Boolean(
    draft.allowedWork.trim() &&
    draft.inputSchema.trim() &&
    draft.outputSchema.trim() &&
    draft.modelRoute.trim() &&
    draft.semanticDiff.trim() &&
    draft.evaluationEvidence.trim() &&
    Number.isFinite(rolloutPercent) &&
    rolloutPercent > 0 &&
    rolloutPercent <= 100
  );
}
