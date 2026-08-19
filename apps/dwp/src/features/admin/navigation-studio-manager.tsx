import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertCircle,
  ArchiveRestore,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CirclePlay,
  CircleStop,
  Clock3,
  Eye,
  FileCheck2,
  GitCompareArrows,
  GripVertical,
  History,
  Languages,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  cancelNavigationDraft,
  createNavigationDraft,
  getNavigationStudio,
  listGovernanceResources,
  listRegistryEntries,
  publishNavigationDraft,
  restoreNavigationRevision,
  saveNavigationDraft,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  ConfirmDialog,
  FormField,
  GuidedEmptyState,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import {
  ManagementPanelError,
  ManagementPanelLoading,
} from '../../components/management-panel-state';
import { NavigationDialog } from './navigation-manager';

import type { DragEndEvent } from '@dnd-kit/core';
import type {
  CreateNavigationRequest,
  GovernanceResource,
  NavigationDiffSummary,
  NavigationNode,
  NavigationRevision,
  NavigationValidationReport,
  RegistryEntry,
} from '@dwp-frontend/shared-utils';

type FlatNode = NavigationNode & { depth: number };
type PendingAction =
  | { type: 'PUBLISH' }
  | { type: 'CANCEL' }
  | { type: 'RESTORE'; revision: NavigationRevision }
  | null;

const EMPTY_DIFF: NavigationDiffSummary = {
  added: 0,
  removed: 0,
  changed: 0,
  reordered: 0,
  lifecycleChanged: 0,
};

function flatten(nodes: NavigationNode[], depth = 0): FlatNode[] {
  return nodes.flatMap((node) => [{ ...node, depth }, ...flatten(node.children ?? [], depth + 1)]);
}

function localizedLabel(node: NavigationNode, language: string): string {
  const canonical = language.split('-')[0];
  return (
    node.labels.find((label) => label.locale === language)?.label ??
    node.labels.find((label) => label.locale.split('-')[0] === canonical)?.label ??
    node.labels.find((label) => label.locale === 'en')?.label ??
    node.labels[0]?.label ??
    node.navigationKey
  );
}

function normalizeTree(nodes: NavigationNode[], parentId: number | null = null): NavigationNode[] {
  return nodes.map((node, index) => ({
    ...node,
    parentNavigationItemId: parentId,
    sortOrder: index * 10,
    children: normalizeTree(node.children ?? [], node.navigationItemId),
  }));
}

function mapNode(
  nodes: NavigationNode[],
  itemId: number,
  transform: (node: NavigationNode) => NavigationNode
): NavigationNode[] {
  return nodes.map((node) =>
    node.navigationItemId === itemId
      ? transform(node)
      : { ...node, children: mapNode(node.children ?? [], itemId, transform) }
  );
}

function removeNode(
  nodes: NavigationNode[],
  itemId: number
): { tree: NavigationNode[]; removed?: NavigationNode } {
  let removed: NavigationNode | undefined;
  const tree = nodes
    .filter((node) => {
      if (node.navigationItemId !== itemId) return true;
      removed = node;
      return false;
    })
    .map((node) => {
      const nested = removeNode(node.children ?? [], itemId);
      if (nested.removed) removed = nested.removed;
      return { ...node, children: nested.tree };
    });
  return { tree, removed };
}

function insertNode(
  nodes: NavigationNode[],
  node: NavigationNode,
  parentId: number | null
): NavigationNode[] {
  if (parentId === null) return [...nodes, { ...node, parentNavigationItemId: null }];
  return nodes.map((candidate) =>
    candidate.navigationItemId === parentId
      ? {
          ...candidate,
          children: [
            ...(candidate.children ?? []),
            { ...node, parentNavigationItemId: parentId, children: [] },
          ],
        }
      : { ...candidate, children: insertNode(candidate.children ?? [], node, parentId) }
  );
}

function moveWithinParent(
  nodes: NavigationNode[],
  parentId: number | null,
  activeId: number,
  overId: number
): NavigationNode[] {
  if (parentId === null) {
    const oldIndex = nodes.findIndex((node) => node.navigationItemId === activeId);
    const newIndex = nodes.findIndex((node) => node.navigationItemId === overId);
    return oldIndex < 0 || newIndex < 0 ? nodes : arrayMove(nodes, oldIndex, newIndex);
  }
  return nodes.map((node) =>
    node.navigationItemId === parentId
      ? {
          ...node,
          children: moveWithinParent(node.children ?? [], null, activeId, overId).map((child) => ({
            ...child,
            parentNavigationItemId: parentId,
          })),
        }
      : {
          ...node,
          children: moveWithinParent(node.children ?? [], parentId, activeId, overId),
        }
  );
}

function retireBranch(node: NavigationNode): NavigationNode {
  return {
    ...node,
    lifecycleState: 'RETIRED',
    children: (node.children ?? []).map(retireBranch),
  };
}

function treeFingerprint(tree: NavigationNode[]): string {
  return JSON.stringify(tree);
}

function SortableNavigationRow({
  node,
  language,
  editing,
  busy,
  expanded,
  onToggle,
  onEdit,
  onLifecycle,
}: {
  node: NavigationNode;
  language: string;
  editing: boolean;
  busy: boolean;
  expanded: Set<number>;
  onToggle: (itemId: number) => void;
  onEdit: (node: NavigationNode) => void;
  onLifecycle: (node: NavigationNode) => void;
}) {
  const { t } = useTranslation('admin');
  const isExpanded = expanded.has(node.navigationItemId);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.navigationItemId,
    data: { parentId: node.parentNavigationItemId ?? null },
    disabled: !editing || busy,
  });

  return (
    <Box
      component="li"
      ref={setNodeRef}
      sx={{
        listStyle: 'none',
        opacity: isDragging ? 0.35 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        gap={0.75}
        sx={{
          minHeight: 58,
          px: 1.25,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: node.itemType === 'GROUP' ? 'action.hover' : 'transparent',
        }}
      >
        <ActionIconButton
          label={t('navigationManager.studio.dragItem', {
            name: localizedLabel(node, language),
          })}
          tooltip={t('navigationManager.studio.drag')}
          size="small"
          disabled={!editing || busy}
          {...attributes}
          {...listeners}
          sx={{ cursor: editing ? 'grab' : 'default', touchAction: 'none' }}
        >
          <GripVertical size={16} />
        </ActionIconButton>
        <ActionIconButton
          size="small"
          disabled={!node.children.length}
          label={
            isExpanded
              ? t('navigationManager.actions.collapse')
              : t('navigationManager.actions.expand')
          }
          onClick={() => onToggle(node.navigationItemId)}
        >
          {node.children.length ? (
            isExpanded ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )
          ) : (
            <Box sx={{ width: 16 }} />
          )}
        </ActionIconButton>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
            <Typography variant="body2" fontWeight={node.itemType === 'GROUP' ? 750 : 650}>
              {localizedLabel(node, language)}
            </Typography>
            <Chip
              size="small"
              variant="outlined"
              label={t(`navigationManager.types.${node.itemType}`)}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block" noWrap>
            {node.navigationKey}
            {node.route ? ` · ${node.route}` : ''}
            {node.requiredResourceKey
              ? ` · ${node.requiredResourceKey}:${node.requiredPermissionCode}`
              : ''}
          </Typography>
        </Box>
        <Chip
          size="small"
          variant={node.lifecycleState === 'ACTIVE' ? 'filled' : 'outlined'}
          color={
            node.lifecycleState === 'ACTIVE'
              ? 'success'
              : node.lifecycleState === 'DRAFT'
                ? 'warning'
                : 'default'
          }
          label={t(`common.lifecycle.${node.lifecycleState}`)}
        />
        <ActionIconButton
          label={t('common.actions.edit')}
          size="small"
          disabled={!editing || busy}
          onClick={() => onEdit(node)}
        >
          <Pencil size={16} />
        </ActionIconButton>
        <ActionIconButton
          label={
            node.lifecycleState === 'ACTIVE'
              ? t('navigationManager.actions.retire')
              : t('navigationManager.actions.activate')
          }
          size="small"
          disabled={!editing || busy}
          onClick={() => onLifecycle(node)}
        >
          {node.lifecycleState === 'ACTIVE' ? <CircleStop size={16} /> : <CirclePlay size={16} />}
        </ActionIconButton>
      </Stack>
      {node.children.length > 0 && isExpanded ? (
        <SortableContext
          items={node.children.map((child) => child.navigationItemId)}
          strategy={verticalListSortingStrategy}
        >
          <Box component="ul" sx={{ p: 0, m: 0, ml: 3, borderLeft: 1, borderColor: 'divider' }}>
            {node.children.map((child) => (
              <SortableNavigationRow
                key={child.navigationItemId}
                node={child}
                language={language}
                editing={editing}
                busy={busy}
                expanded={expanded}
                onToggle={onToggle}
                onEdit={onEdit}
                onLifecycle={onLifecycle}
              />
            ))}
          </Box>
        </SortableContext>
      ) : null}
    </Box>
  );
}

function DiffMetrics({ diff }: { diff: NavigationDiffSummary }) {
  const { t } = useTranslation('admin');
  const metrics: Array<[keyof NavigationDiffSummary, number]> = [
    ['added', diff.added],
    ['changed', diff.changed],
    ['reordered', diff.reordered],
    ['lifecycleChanged', diff.lifecycleChanged],
    ['removed', diff.removed],
  ];
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
        borderTop: 1,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      {metrics.map(([key, value], index) => (
        <Box
          key={key}
          sx={{
            px: { xs: 0.75, sm: 2 },
            py: { xs: 1, sm: 1.5 },
            borderLeft: index ? 1 : 0,
            borderColor: 'divider',
            minWidth: 0,
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            noWrap
            title={t(`navigationManager.studio.diff.${key}`)}
          >
            {t(`navigationManager.studio.diff.${key}`)}
          </Typography>
          <Typography variant="h6" sx={{ mt: 0.25, fontSize: { xs: '0.95rem', sm: '1.125rem' } }}>
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function ValidationPanel({
  report,
  stale,
}: {
  report: NavigationValidationReport;
  stale: boolean;
}) {
  const { t } = useTranslation('admin');
  return (
    <Box component="section" aria-labelledby="navigation-validation-title">
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.25 }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <ShieldCheck size={18} />
          <Typography id="navigation-validation-title" component="h3" variant="subtitle1">
            {t('navigationManager.studio.validation.title')}
          </Typography>
        </Stack>
        <Stack direction="row" gap={0.75}>
          <Chip
            size="small"
            color={report.errorCount ? 'error' : 'success'}
            variant="outlined"
            label={t('navigationManager.studio.validation.errors', { count: report.errorCount })}
          />
          <Chip
            size="small"
            color={report.warningCount ? 'warning' : 'default'}
            variant="outlined"
            label={t('navigationManager.studio.validation.warnings', {
              count: report.warningCount,
            })}
          />
        </Stack>
      </Stack>
      {stale ? (
        <Alert severity="info" sx={{ mb: 1.25 }}>
          {t('navigationManager.studio.validation.unsaved')}
        </Alert>
      ) : null}
      {report.issues.length ? (
        <Stack
          divider={<Divider flexItem />}
          sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider' }}
        >
          {report.issues.slice(0, 8).map((issue, index) => (
            <Stack
              key={`${issue.code}:${issue.navigationItemId ?? index}`}
              direction="row"
              gap={1.25}
              sx={{ py: 1.25 }}
            >
              <Box
                sx={{ color: issue.severity === 'ERROR' ? 'error.main' : 'warning.main', mt: 0.2 }}
              >
                {issue.severity === 'ERROR' ? (
                  <AlertCircle size={17} />
                ) : (
                  <TriangleAlert size={17} />
                )}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" fontWeight={650}>
                  {issue.navigationKey ?? issue.code}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {issue.message}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      ) : (
        <Stack direction="row" gap={1} alignItems="center" sx={{ py: 2, color: 'success.main' }}>
          <CheckCircle2 size={18} />
          <Typography variant="body2">{t('navigationManager.studio.validation.ready')}</Typography>
        </Stack>
      )}
    </Box>
  );
}

function RuntimePreview({
  tree,
  locale,
  resource,
  onLocaleChange,
  onResourceChange,
  resources,
}: {
  tree: NavigationNode[];
  locale: string;
  resource: string;
  onLocaleChange: (locale: string) => void;
  onResourceChange: (resource: string) => void;
  resources: GovernanceResource[];
}) {
  const { t } = useTranslation('admin');
  const visible = tree
    .filter((group) => group.lifecycleState === 'ACTIVE')
    .map((group) => ({
      ...group,
      children: (group.children ?? []).filter(
        (child) =>
          child.lifecycleState === 'ACTIVE' &&
          (resource === 'ALL' || child.requiredResourceKey === resource)
      ),
    }))
    .filter((group) => group.itemType === 'APP' || group.children.length > 0);

  return (
    <Box component="section" aria-labelledby="navigation-preview-title">
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 0.5 }}>
        <Eye size={18} />
        <Typography id="navigation-preview-title" component="h3" variant="subtitle1">
          {t('navigationManager.studio.preview.title')}
        </Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {t('navigationManager.studio.preview.description')}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ mt: 1.5, mb: 1.5 }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={locale}
          onChange={(_event, value: string | null) => value && onLocaleChange(value)}
          aria-label={t('navigationManager.studio.preview.locale')}
        >
          <ToggleButton value="ko">{t('navigationManager.studio.preview.locales.ko')}</ToggleButton>
          <ToggleButton value="en">{t('navigationManager.studio.preview.locales.en')}</ToggleButton>
        </ToggleButtonGroup>
        <FormField
          select
          size="small"
          label={t('navigationManager.studio.preview.permissionView')}
          value={resource}
          onChange={(event) => onResourceChange(event.target.value)}
          sx={{ minWidth: 210, flex: 1 }}
        >
          <MenuItem value="ALL">{t('navigationManager.studio.preview.allResources')}</MenuItem>
          {resources.map((candidate) => (
            <MenuItem key={candidate.resourceId} value={candidate.key}>
              {candidate.name}
            </MenuItem>
          ))}
        </FormField>
      </Stack>
      <Box
        sx={{
          minHeight: 300,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.default',
          overflow: 'hidden',
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          gap={1}
          sx={{ px: 1.5, py: 1.25, borderBottom: 1, borderColor: 'divider' }}
        >
          <Languages size={16} />
          <Typography variant="caption" fontWeight={700}>
            {t('navigationManager.studio.preview.runtimeMenu')}
          </Typography>
        </Stack>
        {visible.length ? (
          <Stack divider={<Divider flexItem />}>
            {visible.map((group) => (
              <Box key={group.navigationItemId} sx={{ px: 1.5, py: 1.25 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  {localizedLabel(group, locale)}
                </Typography>
                <Stack gap={0.5} sx={{ mt: 0.75 }}>
                  {(group.itemType === 'APP' ? [group] : group.children).map((app) => (
                    <Stack
                      key={app.navigationItemId}
                      direction="row"
                      alignItems="center"
                      gap={1}
                      sx={{ py: 0.75 }}
                    >
                      <Box
                        sx={{ width: 3, height: 24, bgcolor: 'primary.main', borderRadius: 2 }}
                      />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" noWrap>
                          {localizedLabel(app, locale)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap display="block">
                          {app.route}
                        </Typography>
                      </Box>
                      <Tooltip title={`${app.requiredResourceKey}:${app.requiredPermissionCode}`}>
                        <LockKeyhole size={15} />
                      </Tooltip>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            {t('navigationManager.studio.preview.empty')}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export function NavigationManager() {
  const { t, i18n } = useTranslation('admin');
  const toast = useToast();
  const queryClient = useQueryClient();
  const temporaryId = useRef(-1);
  const [tree, setTree] = useState<NavigationNode[]>([]);
  const [changeSummary, setChangeSummary] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NavigationNode | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [previewLocale, setPreviewLocale] = useState('ko');
  const [previewResource, setPreviewResource] = useState('ALL');
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);

  const workspace = useQuery({
    queryKey: ['admin', 'navigation', 'studio'],
    queryFn: getNavigationStudio,
  });
  const registry = useQuery({
    queryKey: ['admin', 'navigation', 'app-registry'],
    queryFn: () => listRegistryEntries({ registryType: 'APP', lifecycle: 'ACTIVE' }),
  });
  const resources = useQuery({
    queryKey: ['admin', 'navigation', 'resources'],
    queryFn: listGovernanceResources,
  });

  const draft = workspace.data?.draft ?? null;
  const sourceTree = useMemo(
    () => draft?.tree ?? workspace.data?.published.tree ?? [],
    [draft?.tree, workspace.data?.published.tree]
  );
  const allNodes = useMemo(() => flatten(tree), [tree]);
  const activeResources = useMemo(
    () => (resources.data ?? []).filter((resource) => resource.enabled),
    [resources.data]
  );
  const dirty = Boolean(
    draft &&
      (treeFingerprint(tree) !== treeFingerprint(draft.tree) ||
        changeSummary !== (draft.changeSummary ?? ''))
  );
  const validation = draft?.validation ?? workspace.data?.currentValidation;
  const diff = draft?.diff ?? EMPTY_DIFF;

  useEffect(() => {
    setTree(sourceTree);
    setChangeSummary(draft?.changeSummary ?? '');
    setExpanded(
      new Set(
        flatten(sourceTree)
          .filter((node) => node.itemType === 'GROUP')
          .map((node) => node.navigationItemId)
      )
    );
  }, [
    draft?.changeSummary,
    draft?.navigationRevisionId,
    draft?.version,
    sourceTree,
    workspace.data?.published.navigationRevisionId,
  ]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 240, tolerance: 7 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'navigation'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'catalog'] }),
    ]);
  };

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await action();
      await refresh();
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('common.operationError'));
    } finally {
      setBusy(false);
    }
  };

  const save = async (): Promise<NavigationRevision | null> => {
    if (!draft) return null;
    let saved: NavigationRevision | null = null;
    await run(async () => {
      saved = await saveNavigationDraft(draft.navigationRevisionId, {
        tree: normalizeTree(tree),
        changeSummary: changeSummary.trim() || undefined,
        version: draft.version,
      });
    }, t('navigationManager.studio.toasts.saved'));
    return saved;
  };

  const confirmPendingAction = async () => {
    const action = pendingAction;
    if (!action) return;
    try {
      if (action.type === 'PUBLISH' && draft) {
        await run(async () => {
          let version = draft.version;
          if (dirty) {
            const saved = await saveNavigationDraft(draft.navigationRevisionId, {
              tree: normalizeTree(tree),
              changeSummary: changeSummary.trim() || undefined,
              version,
            });
            version = saved.version;
          }
          await publishNavigationDraft(draft.navigationRevisionId, version);
        }, t('navigationManager.studio.toasts.published'));
      } else if (action.type === 'CANCEL' && draft) {
        await run(
          () => cancelNavigationDraft(draft.navigationRevisionId, draft.version),
          t('navigationManager.studio.toasts.cancelled')
        );
      } else if (action.type === 'RESTORE') {
        await run(
          () =>
            restoreNavigationRevision(
              action.revision.navigationRevisionId,
              t('navigationManager.studio.restoreSummary', {
                revision: action.revision.revisionNumber,
              })
            ),
          t('navigationManager.studio.toasts.restored')
        );
      }
    } finally {
      setPendingAction(null);
    }
  };

  const onDialogSave = async (request: CreateNavigationRequest) => {
    if (!draft) return;
    const current = editing;
    const item: NavigationNode = current
      ? {
          ...current,
          parentNavigationItemId: request.parentNavigationItemId ?? null,
          registryEntryKey: request.registryEntryKey ?? null,
          route: request.route ?? null,
          iconKey: request.iconKey ?? null,
          requiredResourceKey: request.requiredResourceKey ?? null,
          requiredPermissionCode: request.requiredPermissionCode ?? 'VIEW',
          sortOrder: request.sortOrder,
          labels: request.labels,
        }
      : {
          navigationItemId: temporaryId.current--,
          navigationKey: request.navigationKey,
          itemType: request.itemType,
          parentNavigationItemId: request.parentNavigationItemId ?? null,
          registryEntryKey: request.registryEntryKey ?? null,
          route: request.route ?? null,
          iconKey: request.iconKey ?? null,
          requiredResourceKey: request.requiredResourceKey ?? null,
          requiredPermissionCode: request.requiredPermissionCode ?? 'VIEW',
          sortOrder: request.sortOrder,
          lifecycleState: 'DRAFT',
          version: 0,
          labels: request.labels,
          children: [],
        };
    const withoutCurrent = current ? removeNode(tree, current.navigationItemId).tree : tree;
    const parentId = item.itemType === 'GROUP' ? null : (request.parentNavigationItemId ?? null);
    setTree(normalizeTree(insertNode(withoutCurrent, item, parentId)));
    setDialogOpen(false);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!draft || !over || active.id === over.id) return;
    const activeParent = (active.data.current?.parentId as number | null | undefined) ?? null;
    const overParent = (over.data.current?.parentId as number | null | undefined) ?? null;
    if (activeParent !== overParent) return;
    setTree(
      normalizeTree(moveWithinParent(tree, activeParent, Number(active.id), Number(over.id)))
    );
  };

  if (workspace.isLoading || registry.isLoading || resources.isLoading) {
    return <ManagementPanelLoading label={t('navigationManager.loading')} />;
  }
  const dependencyError = workspace.error || registry.error || resources.error;
  if (dependencyError) {
    return (
      <ManagementPanelError
        message={
          dependencyError instanceof Error ? dependencyError.message : t('common.operationError')
        }
      />
    );
  }
  if (!workspace.data || !validation) return null;

  const confirmCopy = pendingAction
    ? pendingAction.type === 'PUBLISH'
      ? {
          title: t('navigationManager.studio.confirm.publishTitle'),
          description: t('navigationManager.studio.confirm.publishDescription'),
          confirmLabel: t('navigationManager.studio.actions.publish'),
          intent: 'primary' as const,
        }
      : pendingAction.type === 'CANCEL'
        ? {
            title: t('navigationManager.studio.confirm.cancelTitle'),
            description: t('navigationManager.studio.confirm.cancelDescription'),
            confirmLabel: t('navigationManager.studio.actions.cancelDraft'),
            intent: 'danger' as const,
          }
        : {
            title: t('navigationManager.studio.confirm.restoreTitle', {
              revision: pendingAction.revision.revisionNumber,
            }),
            description: t('navigationManager.studio.confirm.restoreDescription'),
            confirmLabel: t('navigationManager.studio.actions.restore'),
            intent: 'primary' as const,
          }
    : null;

  return (
    <>
      <Stack gap={{ xs: 2, md: 3 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
          gap={1.5}
        >
          <Box>
            <Stack direction="row" alignItems="center" gap={1}>
              <GitCompareArrows size={20} />
              <Typography component="h2" variant="h6">
                {t('navigationManager.studio.title')}
              </Typography>
              <Chip
                size="small"
                color={draft ? 'warning' : 'success'}
                label={
                  draft
                    ? t('navigationManager.studio.states.draft', {
                        revision: draft.revisionNumber,
                      })
                    : t('navigationManager.studio.states.published', {
                        revision: workspace.data.published.revisionNumber,
                      })
                }
              />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('navigationManager.studio.description')}
            </Typography>
          </Box>
          <Stack direction="row" gap={1} flexWrap="wrap" justifyContent="flex-end">
            <ActionIconButton
              label={t('common.actions.refresh')}
              disabled={busy}
              onClick={() => void workspace.refetch()}
            >
              <RefreshCw size={18} />
            </ActionIconButton>
            {draft ? (
              <>
                <ActionButton
                  intent="quiet"
                  startIcon={<X size={17} />}
                  disabled={busy}
                  onClick={() => setPendingAction({ type: 'CANCEL' })}
                >
                  {t('navigationManager.studio.actions.cancelDraft')}
                </ActionButton>
                <ActionButton
                  startIcon={<Save size={17} />}
                  disabled={busy || !dirty}
                  onClick={() => void save()}
                >
                  {t('navigationManager.studio.actions.save')}
                </ActionButton>
                <ActionButton
                  intent="primary"
                  startIcon={<Send size={17} />}
                  disabled={busy || (!dirty && !draft.validation.valid)}
                  onClick={() => setPendingAction({ type: 'PUBLISH' })}
                >
                  {t('navigationManager.studio.actions.publish')}
                </ActionButton>
              </>
            ) : (
              <ActionButton
                intent="primary"
                startIcon={<Plus size={17} />}
                disabled={busy}
                onClick={() =>
                  void run(
                    () => createNavigationDraft(),
                    t('navigationManager.studio.toasts.created')
                  )
                }
              >
                {t('navigationManager.studio.actions.createDraft')}
              </ActionButton>
            )}
          </Stack>
        </Stack>

        <DiffMetrics diff={diff} />

        {draft ? (
          <FormField
            fullWidth
            label={t('navigationManager.studio.changeSummary')}
            value={changeSummary}
            onChange={(event) => setChangeSummary(event.target.value)}
            supportingText={t('navigationManager.studio.changeSummaryHelp')}
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
        ) : (
          <Alert severity="info" icon={<FileCheck2 size={20} />}>
            {t('navigationManager.studio.readOnly')}
          </Alert>
        )}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              xl: 'minmax(0, 1.55fr) minmax(320px, 0.75fr)',
            },
            gap: 3,
            alignItems: 'start',
          }}
        >
          <Box component="section" aria-labelledby="navigation-tree-title" sx={{ minWidth: 0 }}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 1 }}
            >
              <Stack direction="row" alignItems="center" gap={1}>
                <Typography id="navigation-tree-title" component="h3" variant="subtitle1">
                  {t('navigationManager.title')}
                </Typography>
                <Chip size="small" variant="outlined" label={allNodes.length} />
              </Stack>
              <ActionButton
                startIcon={<Plus size={16} />}
                disabled={!draft || busy}
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                {t('navigationManager.actions.new')}
              </ActionButton>
            </Stack>
            {tree.length ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={tree.map((node) => node.navigationItemId)}
                  strategy={verticalListSortingStrategy}
                >
                  <Box
                    component="ul"
                    aria-label={t('navigationManager.treeLabel')}
                    sx={{ p: 0, m: 0, borderBottom: 1, borderColor: 'divider' }}
                  >
                    {tree.map((node) => (
                      <SortableNavigationRow
                        key={node.navigationItemId}
                        node={node}
                        language={i18n.resolvedLanguage ?? 'en'}
                        editing={Boolean(draft)}
                        busy={busy}
                        expanded={expanded}
                        onToggle={(itemId) =>
                          setExpanded((current) => {
                            const next = new Set(current);
                            if (next.has(itemId)) next.delete(itemId);
                            else next.add(itemId);
                            return next;
                          })
                        }
                        onEdit={(nodeToEdit) => {
                          setEditing(nodeToEdit);
                          setDialogOpen(true);
                        }}
                        onLifecycle={(changed) =>
                          setTree(
                            normalizeTree(
                              mapNode(tree, changed.navigationItemId, (node) =>
                                node.lifecycleState === 'ACTIVE'
                                  ? retireBranch(node)
                                  : { ...node, lifecycleState: 'ACTIVE' }
                              )
                            )
                          )
                        }
                      />
                    ))}
                  </Box>
                </SortableContext>
              </DndContext>
            ) : (
              <GuidedEmptyState
                kind="first-use"
                title={t('navigationManager.emptyState.title')}
                description={t('navigationManager.emptyState.description')}
                actionLabel={draft ? t('navigationManager.actions.new') : undefined}
                onAction={
                  draft
                    ? () => {
                        setEditing(null);
                        setDialogOpen(true);
                      }
                    : undefined
                }
                size="standard"
              />
            )}
          </Box>
          <RuntimePreview
            tree={tree}
            locale={previewLocale}
            resource={previewResource}
            onLocaleChange={setPreviewLocale}
            onResourceChange={setPreviewResource}
            resources={activeResources}
          />
        </Box>

        <ValidationPanel report={validation} stale={dirty} />

        <Box component="section" aria-labelledby="navigation-history-title">
          <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
            <History size={18} />
            <Typography id="navigation-history-title" component="h3" variant="subtitle1">
              {t('navigationManager.studio.history.title')}
            </Typography>
          </Stack>
          <Stack
            divider={<Divider flexItem />}
            sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider' }}
          >
            {workspace.data.history.slice(0, 10).map((revision) => (
              <Stack
                key={revision.navigationRevisionId}
                direction={{ xs: 'column', md: 'row' }}
                alignItems={{ xs: 'stretch', md: 'center' }}
                gap={1.5}
                sx={{ py: 1.25 }}
              >
                <Stack direction="row" gap={1} alignItems="center" sx={{ minWidth: 180 }}>
                  <Clock3 size={16} />
                  <Typography variant="body2" fontWeight={700}>
                    {t('navigationManager.studio.history.revision', {
                      revision: revision.revisionNumber,
                    })}
                  </Typography>
                  <Chip size="small" variant="outlined" label={revision.lifecycleState} />
                </Stack>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" noWrap>
                    {revision.changeSummary || t('navigationManager.studio.history.noSummary')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(new Date(revision.publishedAt ?? revision.updatedAt), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </Typography>
                </Box>
                <Stack direction="row" gap={0.75} alignItems="center">
                  <Chip size="small" variant="outlined" label={`+${revision.diff.added}`} />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`~${revision.diff.changed + revision.diff.reordered}`}
                  />
                  <ActionButton
                    size="small"
                    startIcon={<ArchiveRestore size={15} />}
                    disabled={Boolean(draft) || busy || revision.lifecycleState === 'CANCELLED'}
                    onClick={() => setPendingAction({ type: 'RESTORE', revision })}
                  >
                    {t('navigationManager.studio.actions.restore')}
                  </ActionButton>
                </Stack>
              </Stack>
            ))}
          </Stack>
        </Box>
      </Stack>

      {dialogOpen ? (
        <NavigationDialog
          item={editing}
          groups={allNodes}
          registryEntries={(registry.data?.content ?? []) as RegistryEntry[]}
          resources={activeResources}
          open
          busy={busy}
          onClose={() => setDialogOpen(false)}
          onSave={onDialogSave}
        />
      ) : null}

      {confirmCopy ? (
        <ConfirmDialog
          open
          title={confirmCopy.title}
          description={confirmCopy.description}
          cancelLabel={t('common.actions.cancel')}
          confirmLabel={confirmCopy.confirmLabel}
          intent={confirmCopy.intent}
          busy={busy}
          onClose={() => setPendingAction(null)}
          onConfirm={confirmPendingAction}
        />
      ) : null}
    </>
  );
}
