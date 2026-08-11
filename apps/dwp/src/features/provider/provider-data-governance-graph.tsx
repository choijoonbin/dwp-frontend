import '@xyflow/react/dist/style.css';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import dagre from '@dagrejs/dagre';
import { Database, GitBranch, KeyRound, ShieldCheck } from 'lucide-react';
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

import type { Edge, Node, NodeProps } from '@xyflow/react';
import type {
  ProviderDataAsset,
  ProviderDataLineageEdge,
  ProviderDataRelationship,
} from '@dwp-frontend/shared-utils';

const NODE_WIDTH = 248;
const NODE_HEIGHT = 112;

const databaseColors: Record<string, string> = {
  auth: '#2f6feb',
  people: '#16866a',
  platform: '#b26a00',
  provider: '#7a4fb7',
};

type AssetNodeData = {
  asset: ProviderDataAsset;
  compact?: boolean;
};

type AssetFlowNode = Node<AssetNodeData, 'asset'>;

function AssetNode({ data, selected }: NodeProps<AssetFlowNode>) {
  const { t } = useTranslation('provider');
  const theme = useTheme();
  const { asset, compact } = data;
  const color = databaseColors[asset.databaseKey] ?? theme.palette.text.secondary;
  return (
    <Box
      sx={{
        width: NODE_WIDTH,
        minHeight: compact ? 86 : NODE_HEIGHT,
        px: 1.5,
        py: 1.25,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: selected ? color : 'divider',
        boxShadow: selected ? `0 0 0 2px ${alpha(color, 0.18)}` : theme.shadows[1],
        borderRadius: 1,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: color }} />
      <Stack direction="row" alignItems="center" gap={0.75}>
        <Database size={15} color={color} />
        <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
          {asset.databaseName} / {asset.schemaName}
        </Typography>
        {asset.primaryKey.length > 0 && <KeyRound size={13} color={color} />}
      </Stack>
      <Typography
        variant="subtitle2"
        fontWeight={750}
        noWrap
        title={asset.objectName}
        sx={{ mt: 0.5 }}
      >
        {asset.objectName}
      </Typography>
      <Typography variant="caption" color="text.secondary" noWrap display="block">
        {asset.businessDomain}
      </Typography>
      {!compact && (
        <Stack direction="row" gap={0.5} sx={{ mt: 0.75 }}>
          <Chip
            size="small"
            variant="outlined"
            label={t('dataGovernance.graph.columns', { count: asset.columns.length })}
          />
          {asset.tenantScoped && (
            <Chip
              size="small"
              variant="outlined"
              icon={<ShieldCheck size={12} />}
              label={t('dataGovernance.graph.tenant')}
            />
          )}
        </Stack>
      )}
      <Handle type="source" position={Position.Right} style={{ background: color }} />
    </Box>
  );
}

const nodeTypes = { asset: AssetNode };

function layout(nodes: AssetFlowNode[], edges: Edge[]): AssetFlowNode[] {
  const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: 'LR', ranksep: 90, nodesep: 34, marginx: 30, marginy: 30 });
  nodes.forEach((node) => graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach((edge) => graph.setEdge(edge.source, edge.target));
  dagre.layout(graph);
  return nodes.map((node) => {
    const position = graph.node(node.id);
    return {
      ...node,
      position: {
        x: position.x - NODE_WIDTH / 2,
        y: position.y - NODE_HEIGHT / 2,
      },
    };
  });
}

export function ProviderDataGovernanceGraph({
  assets,
  relationships = [],
  lineage = [],
  selectedAssetKey,
  onSelectAsset,
}: {
  assets: ProviderDataAsset[];
  relationships?: ProviderDataRelationship[];
  lineage?: ProviderDataLineageEdge[];
  selectedAssetKey?: string | null;
  onSelectAsset: (assetKey: string) => void;
}) {
  const { t } = useTranslation('provider');
  const theme = useTheme();
  const assetMap = useMemo(() => new Map(assets.map((asset) => [asset.assetKey, asset])), [assets]);
  const visibleRelationships = useMemo(
    () =>
      relationships.filter(
        (edge) => assetMap.has(edge.sourceAssetKey) && assetMap.has(edge.targetAssetKey)
      ),
    [assetMap, relationships]
  );
  const visibleLineage = useMemo(
    () =>
      lineage.filter(
        (edge) => assetMap.has(edge.sourceAssetKey) && assetMap.has(edge.targetAssetKey)
      ),
    [assetMap, lineage]
  );
  const edges = useMemo<Edge[]>(
    () => [
      ...visibleRelationships.map((edge) => ({
        id: edge.relationshipId,
        source: edge.sourceAssetKey,
        target: edge.targetAssetKey,
        label: edge.sourceColumns.join(', '),
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
        style: {
          stroke: edge.sourceIndexed ? theme.palette.primary.main : theme.palette.warning.main,
          strokeWidth: 1.35,
          strokeDasharray: edge.sourceIndexed ? undefined : '5 4',
        },
        labelStyle: { fontSize: 10, fill: theme.palette.text.secondary },
        labelBgStyle: { fill: theme.palette.background.paper, fillOpacity: 0.9 },
      })),
      ...visibleLineage.map((edge) => ({
        id: edge.edgeId,
        source: edge.sourceAssetKey,
        target: edge.targetAssetKey,
        label: edge.processKey,
        markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15 },
        animated: edge.edgeType === 'EVENT',
        style: {
          stroke:
            edge.edgeType === 'PROVISIONING'
              ? theme.palette.success.main
              : edge.edgeType === 'EVENT'
                ? theme.palette.info.main
                : theme.palette.secondary.main,
          strokeWidth: 1.8,
        },
        labelStyle: { fontSize: 10, fill: theme.palette.text.secondary },
        labelBgStyle: { fill: theme.palette.background.paper, fillOpacity: 0.92 },
      })),
    ],
    [theme, visibleLineage, visibleRelationships]
  );
  const nodes = useMemo(
    () =>
      layout(
        assets.map<AssetFlowNode>((asset) => ({
          id: asset.assetKey,
          type: 'asset',
          position: { x: 0, y: 0 },
          data: { asset, compact: lineage.length > 0 },
          selected: asset.assetKey === selectedAssetKey,
        })),
        edges
      ),
    [assets, edges, lineage.length, selectedAssetKey]
  );
  const graphKey = useMemo(
    () => `${nodes.map((node) => node.id).join('|')}::${edges.map((edge) => edge.id).join('|')}`,
    [edges, nodes]
  );

  if (!assets.length) {
    return (
      <Box sx={{ minHeight: 420, display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
        <Stack alignItems="center" gap={1}>
          <GitBranch size={28} />
          <Typography variant="body2">{t('dataGovernance.graph.empty')}</Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: { xs: 520, lg: 640 },
        minWidth: 0,
        bgcolor: 'background.default',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        '& .react-flow__attribution': { display: 'none' },
      }}
    >
      <ReactFlow<AssetFlowNode, Edge>
        key={graphKey}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: 0.16, maxZoom: 1.05 }}
        minZoom={0.18}
        maxZoom={1.5}
        onNodeClick={(_event, node) => onSelectAsset(node.id)}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => {
            const data = node.data as AssetNodeData | undefined;
            return databaseColors[data?.asset.databaseKey ?? ''] ?? '#76808f';
          }}
          maskColor={alpha(theme.palette.background.default, 0.76)}
          style={{ border: `1px solid ${theme.palette.divider}` }}
        />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
    </Box>
  );
}
