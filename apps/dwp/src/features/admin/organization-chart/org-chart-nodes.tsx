import {
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  ChevronUp,
  MapPin,
  UsersRound,
} from 'lucide-react';
import { Handle, Position } from '@xyflow/react';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { PersonAvatar } from '../people/person-avatar';

import type { Node, NodeProps } from '@xyflow/react';
import type {
  OrganizationChartOrganization,
  OrganizationChartPerson,
  OrganizationChartPosition,
} from '@dwp-frontend/shared-utils';

export const ORGANIZATION_NODE_WIDTH = 276;
export const ORGANIZATION_NODE_HEIGHT = 156;
export const PERSON_NODE_WIDTH = 252;
export const PERSON_NODE_HEIGHT = 116;
export const POSITION_NODE_WIDTH = 264;
export const POSITION_NODE_HEIGHT = 132;

const accentColors: Record<string, string> = {
  SK_RED: '#D71920',
  BLUE: '#2563EB',
  CYAN: '#0891B2',
  VIOLET: '#7C3AED',
  TEAL: '#0F8A7B',
  GREEN: '#288A55',
  AMBER: '#B7791F',
  PINK: '#C24175',
  CORAL: '#D55B42',
  SLATE: '#526577',
};

export type OrganizationNodeData = Record<string, unknown> & {
  organization: OrganizationChartOrganization;
  leader?: OrganizationChartPerson;
  collapsed: boolean;
  matched: boolean;
  headcountLabel: string;
  openPositionLabel: string;
  collapseLabel: string;
  expandLabel: string;
  onToggle: (organizationId: string) => void;
  direction: 'TB' | 'LR';
  accentColor: string;
  surfaceColor: string;
  lensLabel?: string;
  scenarioChanged: boolean;
};

export type PersonNodeData = Record<string, unknown> & {
  person: OrganizationChartPerson;
  organizationName: string;
  collapsed: boolean;
  matched: boolean;
  reportLabel: string;
  collapseLabel: string;
  expandLabel: string;
  onToggle: (personId: string) => void;
  direction: 'TB' | 'LR';
};

export type PositionNodeData = Record<string, unknown> & {
  position: OrganizationChartPosition;
  incumbent?: OrganizationChartPerson;
  organizationName: string;
  collapsed: boolean;
  matched: boolean;
  statusLabel: string;
  criticalityLabel: string;
  subordinateLabel: string;
  collapseLabel: string;
  expandLabel: string;
  onToggle: (positionId: string) => void;
  direction: 'TB' | 'LR';
  scenarioChanged: boolean;
  scenarioChangeLabel: string;
};

export type OrganizationFlowNode = Node<OrganizationNodeData, 'organization'>;
export type PersonFlowNode = Node<PersonNodeData, 'person'>;
export type PositionFlowNode = Node<PositionNodeData, 'position'>;
export type OrgChartFlowNode = OrganizationFlowNode | PersonFlowNode | PositionFlowNode;

const handleStyle = {
  width: 7,
  height: 7,
  border: '2px solid #fff',
  background: '#94A3B8',
};

export function OrganizationNode({ data, selected }: NodeProps<OrganizationFlowNode>) {
  const { organization, leader } = data;
  const accent = data.accentColor || accentColors[organization.colorToken ?? ''] || '#526577';
  const expandable = organization.childOrganizationCount > 0;
  const targetPosition = data.direction === 'LR' ? Position.Left : Position.Top;
  const sourcePosition = data.direction === 'LR' ? Position.Right : Position.Bottom;

  return (
    <Box
      sx={{
        width: ORGANIZATION_NODE_WIDTH,
        height: ORGANIZATION_NODE_HEIGHT,
        bgcolor: data.surfaceColor || 'background.paper',
        border: '1px solid',
        borderColor: selected
          ? 'primary.main'
          : data.scenarioChanged
            ? '#7C3AED'
            : data.matched
              ? '#D71920'
              : 'divider',
        borderTop: `4px solid ${accent}`,
        borderRadius: 1,
        boxShadow: selected
          ? '0 0 0 2px rgba(37, 99, 235, 0.14), 0 8px 22px rgba(15, 23, 42, 0.12)'
          : '0 4px 14px rgba(15, 23, 42, 0.08)',
        overflow: 'hidden',
      }}
    >
      <Handle type="target" position={targetPosition} style={handleStyle} />
      <Stack sx={{ height: 1, px: 1.5, py: 1.25 }} justifyContent="space-between">
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" gap={0.75}>
            <Building2 size={15} color={accent} />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textTransform: 'uppercase' }}
              noWrap
            >
              {organization.organizationTypeName ||
                organization.organizationType.replace(/_/gu, ' ')}
            </Typography>
          </Stack>
          <Typography component="p" variant="subtitle2" sx={{ mt: 0.35, fontWeight: 750 }} noWrap>
            {organization.shortName || organization.name}
          </Typography>
        </Box>

        <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
          {leader ? <PersonAvatar name={leader.displayName} size={30} /> : null}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" fontWeight={650} noWrap>
              {leader?.displayName ?? organization.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" noWrap>
              {leader?.businessTitle ?? organization.organizationKey}
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" alignItems="center" gap={1.25} sx={{ minHeight: 26 }}>
          <Stack direction="row" alignItems="center" gap={0.45}>
            <UsersRound size={14} />
            <Typography variant="caption">{data.headcountLabel}</Typography>
          </Stack>
          {organization.openPositionCount > 0 && (
            <Typography variant="caption" color="warning.dark">
              {data.openPositionLabel}
            </Typography>
          )}
          {data.lensLabel && (
            <Typography variant="caption" fontWeight={700} sx={{ color: accent }} noWrap>
              {data.lensLabel}
            </Typography>
          )}
          {data.scenarioChanged && (
            <Box
              component="span"
              sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#7C3AED', flex: '0 0 7px' }}
            />
          )}
          {expandable && (
            <Tooltip title={data.collapsed ? data.expandLabel : data.collapseLabel}>
              <IconButton
                size="small"
                aria-label={data.collapsed ? data.expandLabel : data.collapseLabel}
                onClick={(event) => {
                  event.stopPropagation();
                  data.onToggle(organization.organizationId);
                }}
                sx={{ ml: 'auto', width: 26, height: 26 }}
              >
                {data.collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Stack>
      <Handle type="source" position={sourcePosition} style={handleStyle} />
    </Box>
  );
}

export function PersonNode({ data, selected }: NodeProps<PersonFlowNode>) {
  const { person } = data;
  const hasReports = person.directReportCount > 0;
  const targetPosition = data.direction === 'LR' ? Position.Left : Position.Top;
  const sourcePosition = data.direction === 'LR' ? Position.Right : Position.Bottom;
  return (
    <Box
      sx={{
        width: PERSON_NODE_WIDTH,
        height: PERSON_NODE_HEIGHT,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: selected ? 'primary.main' : data.matched ? '#D71920' : 'divider',
        borderRadius: 1,
        boxShadow: selected
          ? '0 0 0 2px rgba(37, 99, 235, 0.14), 0 7px 18px rgba(15, 23, 42, 0.11)'
          : '0 3px 12px rgba(15, 23, 42, 0.07)',
        p: 1.25,
      }}
    >
      <Handle type="target" position={targetPosition} style={handleStyle} />
      <Stack direction="row" gap={1.1} sx={{ height: 1 }}>
        <PersonAvatar name={person.displayName} size={38} />
        <Stack sx={{ minWidth: 0, flex: 1 }} justifyContent="space-between">
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" alignItems="center" gap={0.6}>
              <Typography
                component="p"
                variant="subtitle2"
                fontWeight={750}
                noWrap
                sx={{ minWidth: 0 }}
              >
                {person.displayName}
              </Typography>
              <Box
                component="span"
                title={person.workerStatus}
                sx={{
                  width: 7,
                  height: 7,
                  flex: '0 0 7px',
                  borderRadius: '50%',
                  bgcolor: person.workerStatus === 'ACTIVE' ? 'success.main' : 'warning.main',
                }}
              />
            </Stack>
            <Typography variant="caption" color="text.secondary" display="block" noWrap>
              {person.businessTitle || person.jobProfileName}
            </Typography>
          </Box>
          <Stack direction="row" alignItems="center" gap={0.6} sx={{ minWidth: 0 }}>
            <MapPin size={13} />
            <Typography variant="caption" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
              {data.organizationName}
            </Typography>
            {hasReports && (
              <Tooltip title={data.collapsed ? data.expandLabel : data.collapseLabel}>
                <IconButton
                  size="small"
                  aria-label={data.collapsed ? data.expandLabel : data.collapseLabel}
                  onClick={(event) => {
                    event.stopPropagation();
                    data.onToggle(person.personId);
                  }}
                  sx={{ ml: 'auto', width: 25, height: 25 }}
                >
                  {data.collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </IconButton>
              </Tooltip>
            )}
          </Stack>
          {hasReports && (
            <Typography variant="caption" color="primary.main">
              {data.reportLabel}
            </Typography>
          )}
        </Stack>
      </Stack>
      <Handle type="source" position={sourcePosition} style={handleStyle} />
    </Box>
  );
}

export function PositionNode({ data, selected }: NodeProps<PositionFlowNode>) {
  const { position, incumbent } = data;
  const hasSubordinates = position.subordinatePositionCount > 0;
  const targetPosition = data.direction === 'LR' ? Position.Left : Position.Top;
  const sourcePosition = data.direction === 'LR' ? Position.Right : Position.Bottom;
  const critical = position.criticality === 'CRITICAL' || position.criticality === 'HIGH';
  const accent = position.status === 'OPEN' ? '#B7791F' : critical ? '#C2412D' : '#0F8A7B';

  return (
    <Box
      sx={{
        width: POSITION_NODE_WIDTH,
        height: POSITION_NODE_HEIGHT,
        bgcolor: position.status === 'OPEN' ? '#FFFCF5' : 'background.paper',
        border: '1px solid',
        borderColor: selected ? 'primary.main' : data.matched ? '#D71920' : 'divider',
        borderTop: `4px solid ${accent}`,
        borderRadius: 1,
        boxShadow: selected
          ? '0 0 0 2px rgba(37, 99, 235, 0.14), 0 7px 18px rgba(15, 23, 42, 0.11)'
          : '0 3px 12px rgba(15, 23, 42, 0.07)',
        px: 1.4,
        py: 1.15,
      }}
    >
      <Handle type="target" position={targetPosition} style={handleStyle} />
      <Stack sx={{ height: 1 }} justifyContent="space-between">
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" gap={0.65}>
            <BriefcaseBusiness size={14} color={accent} />
            <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
              {position.positionKey}
            </Typography>
            {data.scenarioChanged && (
              <Box
                component="span"
                title={data.scenarioChangeLabel}
                sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#7C3AED' }}
              />
            )}
            <Typography variant="caption" fontWeight={750} sx={{ color: accent }}>
              {data.statusLabel}
            </Typography>
          </Stack>
          <Typography component="p" variant="subtitle2" fontWeight={750} noWrap sx={{ mt: 0.35 }}>
            {position.title}
          </Typography>
        </Box>

        <Stack direction="row" alignItems="center" gap={0.9} sx={{ minWidth: 0 }}>
          {incumbent ? (
            <PersonAvatar name={incumbent.displayName} size={30} />
          ) : (
            <Box
              sx={{
                width: 30,
                height: 30,
                display: 'grid',
                placeItems: 'center',
                borderRadius: '50%',
                bgcolor: 'action.hover',
                color: 'text.secondary',
              }}
            >
              <BriefcaseBusiness size={15} />
            </Box>
          )}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" fontWeight={650} noWrap>
              {incumbent?.displayName ?? data.statusLabel}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" noWrap>
              {data.organizationName}
            </Typography>
          </Box>
          {critical && (
            <Typography variant="caption" color="error.main" fontWeight={700}>
              {data.criticalityLabel}
            </Typography>
          )}
        </Stack>

        <Stack direction="row" alignItems="center" sx={{ minHeight: 25 }}>
          <Typography variant="caption" color="text.secondary">
            {data.subordinateLabel}
          </Typography>
          {hasSubordinates && (
            <Tooltip title={data.collapsed ? data.expandLabel : data.collapseLabel}>
              <IconButton
                size="small"
                aria-label={data.collapsed ? data.expandLabel : data.collapseLabel}
                onClick={(event) => {
                  event.stopPropagation();
                  data.onToggle(position.positionId);
                }}
                sx={{ ml: 'auto', width: 25, height: 25 }}
              >
                {data.collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Stack>
      <Handle type="source" position={sourcePosition} style={handleStyle} />
    </Box>
  );
}
