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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  ArchiveRestore,
  Clock3,
  FileCheck2,
  GitCompareArrows,
  History,
  Plus,
  RefreshCw,
  Save,
  Send,
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
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  ManagementPanelError,
  ManagementPanelLoading,
} from '../../components/management-panel-state';
import { NavigationDialog } from './navigation-manager';
import {
  DiffMetrics,
  RuntimePreview,
  SortableNavigationRow,
  ValidationPanel,
} from './navigation-studio-view-parts';

import type { DragEndEvent } from '@dnd-kit/core';
import type {
  CreateNavigationRequest,
  NavigationDiffSummary,
  NavigationNode,
  NavigationRevision,
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
