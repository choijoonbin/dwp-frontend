import '@xyflow/react/dist/style.css';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import dagre from '@dagrejs/dagre';
import {
  AppWindow,
  Braces,
  Boxes,
  Database,
  FileCode2,
  FolderTree,
  KeyRound,
  Network,
  PlugZap,
  ServerCog,
  ShieldCheck,
} from 'lucide-react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
} from '@xyflow/react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

import type { LucideIcon } from 'lucide-react';
import type { Edge, Node, NodeProps } from '@xyflow/react';
import type {
  CatalogCriticality,
  CatalogEntityKind,
  CatalogGraph,
  CatalogGraphNode,
} from '@dwp-frontend/shared-utils';

const NODE_WIDTH = 252;
const NODE_HEIGHT = 124;

const kindIcons: Partial<Record<CatalogEntityKind, LucideIcon>> = {
  APP: AppWindow,
  CONNECTOR: PlugZap,
  CONNECTOR_INSTANCE: PlugZap,
  API: FileCode2,
  DATA_PRODUCT: Database,
  CODE_SET: Braces,
  REFERENCE_SET: Database,
  NAVIGATION: FolderTree,
  PERMISSION: KeyRound,
  SERVICE: ServerCog,
  POLICY: ShieldCheck,
  AGENT: Network,
  TOOL: Boxes,
};

const kindColors: Partial<Record<CatalogEntityKind, string>> = {
  APP: '#2563EB',
  CONNECTOR: '#0F766E',
  CONNECTOR_INSTANCE: '#0D9488',
  API: '#7C3AED',
  DATA_PRODUCT: '#B45309',
  CODE_SET: '#475569',
  REFERENCE_SET: '#0369A1',
  NAVIGATION: '#4F46E5',
  PERMISSION: '#BE123C',
  SERVICE: '#334155',
  POLICY: '#9F1239',
  AGENT: '#6D28D9',
  TOOL: '#A16207',
};

const criticalityColors: Record<CatalogCriticality, string> = {
  INFORMATIONAL: '#64748B',
  OPERATIONAL: '#0284C7',
  CRITICAL: '#DC2626',
};

type CatalogNodeData = { node: CatalogGraphNode };
type CatalogFlowNode = Node<CatalogNodeData, 'catalog'>;

function CatalogNode({ data, selected }: NodeProps<CatalogFlowNode>) {
  const { t } = useTranslation('admin');
  const theme = useTheme();
  const { entity, incomingCount, outgoingCount, orphan } = data.node;
  const color = kindColors[entity.kind] ?? theme.palette.text.secondary;
  const Icon = kindIcons[entity.kind] ?? Boxes;
  return (
    <Box
      sx={{
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
        px: 1.5,
        py: 1.25,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: selected ? color : 'divider',
        boxShadow: selected ? `0 0 0 3px ${alpha(color, 0.18)}` : theme.shadows[1],
        borderRadius: 1,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: color }} />
      <Stack direction="row" alignItems="center" gap={0.75}>
        <Box
          aria-hidden="true"
          sx={{
            width: 28,
            height: 28,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 1,
            color,
            bgcolor: alpha(color, 0.1),
          }}
        >
          <Icon size={15} strokeWidth={1.9} />
        </Box>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
          {entity.kind.replace(/_/g, ' ')}
        </Typography>
        {entity.scope === 'GLOBAL_PRODUCT' && (
          <Chip label={t('catalog.graph.global')} size="small" variant="outlined" />
        )}
      </Stack>
      <Typography variant="subtitle2" fontWeight={750} noWrap title={entity.name} sx={{ mt: 0.7 }}>
        {entity.name}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        noWrap
        display="block"
        title={entity.ref}
      >
        {entity.key}
      </Typography>
      <Stack direction="row" alignItems="center" gap={0.75} sx={{ mt: 0.8 }}>
        <Chip size="small" variant="outlined" label={`${incomingCount} in`} />
        <Chip size="small" variant="outlined" label={`${outgoingCount} out`} />
        {orphan && (
          <Chip size="small" color="warning" variant="outlined" label={t('catalog.graph.orphan')} />
        )}
      </Stack>
      <Handle type="source" position={Position.Right} style={{ background: color }} />
    </Box>
  );
}

const nodeTypes = { catalog: CatalogNode };

function layout(nodes: CatalogFlowNode[], edges: Edge[]): CatalogFlowNode[] {
  const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: 'LR', ranksep: 100, nodesep: 42, marginx: 36, marginy: 36 });
  nodes.forEach((node) => graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach((edge) => graph.setEdge(edge.source, edge.target));
  dagre.layout(graph);
  return nodes.map((node) => {
    const position = graph.node(node.id);
    return {
      ...node,
      position: { x: position.x - NODE_WIDTH / 2, y: position.y - NODE_HEIGHT / 2 },
    };
  });
}

export function CatalogGraphView({
  graph,
  selectedRef,
  onSelect,
}: {
  graph: CatalogGraph;
  selectedRef?: string | null;
  onSelect: (ref: string) => void;
}) {
  const { t } = useTranslation('admin');
  const theme = useTheme();
  const nodeRefs = useMemo(
    () => new Set(graph.nodes.map((node) => node.entity.ref)),
    [graph.nodes]
  );
  const edges = useMemo<Edge[]>(
    () =>
      graph.relations
        .filter((relation) => nodeRefs.has(relation.sourceRef) && nodeRefs.has(relation.targetRef))
        .map((relation, index) => ({
          id:
            relation.relationId ??
            `${relation.sourceRef}:${relation.relationType}:${relation.targetRef}:${index}`,
          source: relation.sourceRef,
          target: relation.targetRef,
          label: relation.relationType.replace(/_/g, ' '),
          markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
          animated: relation.relationType === 'SYNCHRONIZES',
          style: {
            stroke: criticalityColors[relation.criticality],
            strokeWidth: relation.criticality === 'CRITICAL' ? 2 : 1.35,
            strokeDasharray: relation.relationOrigin === 'DECLARED' ? undefined : '5 4',
          },
          labelStyle: { fontSize: 9, fill: theme.palette.text.secondary },
          labelBgStyle: { fill: theme.palette.background.paper, fillOpacity: 0.92 },
        })),
    [graph.relations, nodeRefs, theme]
  );
  const nodes = useMemo(
    () =>
      layout(
        graph.nodes.map<CatalogFlowNode>((node) => ({
          id: node.entity.ref,
          type: 'catalog',
          position: { x: 0, y: 0 },
          data: { node },
          selected: node.entity.ref === selectedRef,
        })),
        edges
      ),
    [edges, graph.nodes, selectedRef]
  );
  const graphKey = useMemo(
    () => `${nodes.map((node) => node.id).join('|')}::${edges.map((edge) => edge.id).join('|')}`,
    [edges, nodes]
  );

  if (!nodes.length) {
    return (
      <Box sx={{ minHeight: 520, display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
        <Stack alignItems="center" gap={1}>
          <Network size={30} />
          <Typography variant="body2">{t('catalog.graph.empty')}</Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: {
          xs: 500,
          md: 'clamp(500px, calc(100dvh - 300px), 720px)',
        },
        minWidth: 0,
        bgcolor: 'background.default',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        '& .react-flow__attribution': { display: 'none' },
      }}
    >
      <ReactFlow<CatalogFlowNode, Edge>
        key={graphKey}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
        minZoom={0.16}
        maxZoom={1.45}
        onNodeClick={(_event, node) => onSelect(node.id)}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => {
            const data = node.data as CatalogNodeData | undefined;
            return kindColors[data?.node.entity.kind ?? 'SERVICE'] ?? '#64748B';
          }}
          maskColor={alpha(theme.palette.background.default, 0.78)}
          style={{ border: `1px solid ${theme.palette.divider}` }}
        />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
    </Box>
  );
}
