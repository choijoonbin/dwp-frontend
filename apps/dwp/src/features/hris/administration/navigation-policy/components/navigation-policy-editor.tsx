import { ActionIconButton } from '@dwp-frontend/design-system';
import { ArrowDown, ArrowUp } from 'lucide-react';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  moveNavigationPolicyGroup,
  moveNavigationPolicyNode,
  setNavigationPolicyDefaultNode,
  setNavigationPolicyGroupEnabled,
  setNavigationPolicyNodeEnabled,
} from '../model/navigation-policy-model';

import type { NavigationPolicyCopy } from '../model/navigation-policy-copy';
import type {
  NavigationPolicyDraft,
  NavigationPolicyRevision,
} from '../model/navigation-policy-model';

export type NavigationPolicyEditorProps = Readonly<{
  draft: NavigationPolicyDraft;
  tenantBaseline?: NavigationPolicyRevision | null;
  disabled: boolean;
  copy: NavigationPolicyCopy;
  onChange(draft: NavigationPolicyDraft): void;
}>;

export function NavigationPolicyEditor({
  draft,
  tenantBaseline,
  disabled,
  copy,
  onChange,
}: NavigationPolicyEditorProps) {
  const groups = [...draft.groups].sort((left, right) => left.displayOrder - right.displayOrder);
  return (
    <Paper component="section" variant="outlined" sx={{ minWidth: 0, overflow: 'hidden' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        gap={1.5}
        justifyContent="space-between"
        sx={{ p: { xs: 2, sm: 2.5 }, bgcolor: 'action.hover' }}
      >
        <Stack gap={0.25} minWidth={0}>
          <Typography component="h2" variant="h6">
            {copy.groupsTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            7 groups · 17 canonical nodes · HRIS-WB-HR-OPERATIONS
          </Typography>
        </Stack>
        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 180 } }}>
          <InputLabel id="navigation-policy-rollout-label">{copy.rollout}</InputLabel>
          <Select
            labelId="navigation-policy-rollout-label"
            label={copy.rollout}
            value={draft.rolloutMode}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...draft,
                rolloutMode: event.target.value as NavigationPolicyDraft['rolloutMode'],
              })
            }
          >
            <MenuItem value="OFF">OFF</MenuItem>
            <MenuItem value="SHADOW">SHADOW</MenuItem>
            <MenuItem value="ENFORCED">ENFORCED</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      <Stack divider={<Box role="separator" sx={{ borderTop: 1, borderColor: 'divider' }} />}>
        {groups.map((group, groupIndex) => {
          const enabledNodes = group.nodes.filter((node) => node.enabled);
          return (
            <Box
              component="fieldset"
              key={group.groupId}
              disabled={disabled}
              sx={{ border: 0, m: 0, p: { xs: 2, sm: 2.5 }, minWidth: 0 }}
            >
              <Stack gap={1.5}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  gap={1}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                  justifyContent="space-between"
                >
                  <FormControlLabel
                    sx={{ m: 0, minWidth: 0 }}
                    control={
                      <Checkbox
                        checked={group.enabled}
                        onChange={(event) =>
                          onChange(
                            setNavigationPolicyGroupEnabled(
                              draft,
                              group.groupId,
                              event.target.checked,
                              tenantBaseline
                            )
                          )
                        }
                      />
                    }
                    label={
                      <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                        <Typography
                          component="span"
                          fontWeight="fontWeightBold"
                          sx={{ wordBreak: 'keep-all' }}
                        >
                          {group.label}
                        </Typography>
                        <Chip size="small" variant="outlined" label={group.groupId} />
                      </Stack>
                    }
                  />
                  <OrderButtons
                    label={group.label}
                    first={groupIndex === 0}
                    last={groupIndex === groups.length - 1}
                    disabled={disabled}
                    copy={copy}
                    onMove={(direction) =>
                      onChange(moveNavigationPolicyGroup(draft, group.groupId, direction))
                    }
                  />
                </Stack>

                <Stack gap={0.75}>
                  {[...group.nodes]
                    .sort((left, right) => left.displayOrder - right.displayOrder)
                    .map((node, nodeIndex) => {
                      const baselineEnabled = isTenantEnabled(
                        tenantBaseline,
                        group.groupId,
                        node.nodeId
                      );
                      const overlayCeiling = draft.scopeKind === 'LEGAL_ENTITY' && !baselineEnabled;
                      return (
                        <Box
                          key={node.nodeId}
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: {
                              xs: 'minmax(0, 1fr) auto',
                              sm: 'minmax(0, 1fr) auto',
                            },
                            gap: 1,
                            alignItems: 'center',
                            pl: { xs: 0, sm: 2 },
                          }}
                        >
                          <FormControlLabel
                            sx={{ m: 0, minWidth: 0 }}
                            control={
                              <Checkbox
                                size="small"
                                checked={node.enabled}
                                disabled={disabled || !group.enabled || overlayCeiling}
                                onChange={(event) =>
                                  onChange(
                                    setNavigationPolicyNodeEnabled(
                                      draft,
                                      group.groupId,
                                      node.nodeId,
                                      event.target.checked,
                                      tenantBaseline
                                    )
                                  )
                                }
                              />
                            }
                            label={
                              <Stack minWidth={0}>
                                <Stack
                                  direction="row"
                                  gap={0.75}
                                  alignItems="center"
                                  flexWrap="wrap"
                                >
                                  <Typography
                                    component="span"
                                    variant="body2"
                                    fontWeight="subtitle2.fontWeight"
                                  >
                                    {node.label}
                                  </Typography>
                                  {overlayCeiling ? (
                                    <Chip size="small" label="Tenant disabled" />
                                  ) : null}
                                </Stack>
                                <Typography
                                  component="span"
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ overflowWrap: 'anywhere' }}
                                >
                                  {node.route}
                                </Typography>
                              </Stack>
                            }
                          />
                          <OrderButtons
                            label={node.label}
                            first={nodeIndex === 0}
                            last={nodeIndex === group.nodes.length - 1}
                            disabled={disabled || !group.enabled}
                            copy={copy}
                            compact
                            onMove={(direction) =>
                              onChange(
                                moveNavigationPolicyNode(
                                  draft,
                                  group.groupId,
                                  node.nodeId,
                                  direction
                                )
                              )
                            }
                          />
                        </Box>
                      );
                    })}
                </Stack>

                <FormControl size="small" sx={{ width: { xs: '100%', sm: 320 } }}>
                  <InputLabel id={`default-node-${group.groupId}`}>{copy.defaultNode}</InputLabel>
                  <Select
                    labelId={`default-node-${group.groupId}`}
                    label={copy.defaultNode}
                    value={group.defaultNodeId}
                    disabled={disabled || !group.enabled || enabledNodes.length === 0}
                    onChange={(event) =>
                      onChange(
                        setNavigationPolicyDefaultNode(draft, group.groupId, event.target.value)
                      )
                    }
                  >
                    {enabledNodes.map((node) => (
                      <MenuItem key={node.nodeId} value={node.nodeId}>
                        {node.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
}

function OrderButtons({
  label,
  first,
  last,
  disabled,
  copy,
  onMove,
  compact = false,
}: Readonly<{
  label: string;
  first: boolean;
  last: boolean;
  disabled: boolean;
  copy: NavigationPolicyCopy;
  compact?: boolean;
  onMove(direction: -1 | 1): void;
}>) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="flex-end">
      <ActionIconButton
        size="small"
        label={`${copy.moveUp}: ${label}`}
        disabled={disabled || first}
        onClick={() => onMove(-1)}
      >
        <ArrowUp size={compact ? 16 : 18} aria-hidden="true" />
      </ActionIconButton>
      <ActionIconButton
        size="small"
        label={`${copy.moveDown}: ${label}`}
        disabled={disabled || last}
        onClick={() => onMove(1)}
      >
        <ArrowDown size={compact ? 16 : 18} aria-hidden="true" />
      </ActionIconButton>
    </Stack>
  );
}

function isTenantEnabled(
  tenant: NavigationPolicyRevision | null | undefined,
  groupId: string,
  nodeId: string
) {
  if (!tenant) return false;
  const group = tenant.groups.find((candidate) => candidate.groupId === groupId);
  return Boolean(
    group?.enabled && group.nodes.some((node) => node.nodeId === nodeId && node.enabled)
  );
}
