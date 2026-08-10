import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  CirclePlay,
  CircleStop,
  FolderTree,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  changeNavigationLifecycle,
  createNavigationItem,
  listGovernanceResources,
  listNavigationTree,
  listRegistryEntries,
  reorderNavigation,
  updateNavigationItem,
  useToast,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { AdminPanelError, AdminPanelLoading } from './admin-ui';

import type {
  CreateNavigationRequest,
  GovernanceResource,
  NavigationLabel,
  NavigationNode,
  RegistryEntry,
} from '@dwp-frontend/shared-utils';

type FlatNode = NavigationNode & { depth: number };

function flatten(nodes: NavigationNode[], depth = 0): FlatNode[] {
  return nodes.flatMap((node) => [{ ...node, depth }, ...flatten(node.children, depth + 1)]);
}

function localizedLabel(node: NavigationNode, language: string): string {
  return (
    node.labels.find((label) => label.locale === language)?.label ??
    node.labels.find((label) => label.locale.startsWith(language))?.label ??
    node.labels.find((label) => label.locale === 'en')?.label ??
    node.labels[0]?.label ??
    node.navigationKey
  );
}

function NavigationDialog({
  item,
  groups,
  registryEntries,
  resources,
  open,
  busy,
  onClose,
  onSave,
}: {
  item: NavigationNode | null;
  groups: FlatNode[];
  registryEntries: RegistryEntry[];
  resources: GovernanceResource[];
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (request: CreateNavigationRequest) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [navigationKey, setNavigationKey] = useState(item?.navigationKey ?? '');
  const [itemType, setItemType] = useState<'GROUP' | 'APP'>(item?.itemType ?? 'APP');
  const [parentId, setParentId] = useState(
    item?.parentNavigationItemId ? String(item.parentNavigationItemId) : ''
  );
  const [registryEntryKey, setRegistryEntryKey] = useState(item?.registryEntryKey ?? '');
  const [route, setRoute] = useState(item?.route ?? '');
  const [iconKey, setIconKey] = useState(item?.iconKey ?? '');
  const [resourceKey, setResourceKey] = useState(item?.requiredResourceKey ?? '');
  const [permissionCode, setPermissionCode] = useState(item?.requiredPermissionCode ?? 'VIEW');
  const [sortOrder, setSortOrder] = useState(item?.sortOrder ?? 0);
  const [labels, setLabels] = useState<NavigationLabel[]>(
    item?.labels.length
      ? item.labels
      : [
          { locale: 'ko', label: '', description: '' },
          { locale: 'en', label: '', description: '' },
        ]
  );

  const updateLabel = (index: number, patch: Partial<NavigationLabel>) => {
    setLabels((current) =>
      current.map((label, labelIndex) => (labelIndex === index ? { ...label, ...patch } : label))
    );
  };
  const validLabels = labels.filter((label) => label.locale.trim() && label.label.trim());
  const valid =
    navigationKey.trim() &&
    validLabels.length &&
    (itemType === 'GROUP' ||
      (registryEntryKey.trim() && route.startsWith('/') && resourceKey.trim()));

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {t(item ? 'navigationManager.dialog.edit' : 'navigationManager.dialog.create')}
      </DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        <Stack gap={2.25}>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField
              fullWidth
              required
              disabled={Boolean(item)}
              label={t('navigationManager.fields.key')}
              value={navigationKey}
              onChange={(event) => setNavigationKey(event.target.value)}
            />
            <TextField
              fullWidth
              select
              disabled={Boolean(item)}
              label={t('navigationManager.fields.type')}
              value={itemType}
              onChange={(event) => {
                const nextType = event.target.value as 'GROUP' | 'APP';
                setItemType(nextType);
                if (nextType === 'GROUP') setParentId('');
              }}
            >
              <MenuItem value="GROUP">{t('navigationManager.types.GROUP')}</MenuItem>
              <MenuItem value="APP">{t('navigationManager.types.APP')}</MenuItem>
            </TextField>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField
              fullWidth
              select
              disabled={itemType === 'GROUP'}
              label={t('navigationManager.fields.parent')}
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
            >
              <MenuItem value="">{t('navigationManager.root')}</MenuItem>
              {groups
                .filter(
                  (group) =>
                    group.itemType === 'GROUP' && group.navigationItemId !== item?.navigationItemId
                )
                .map((group) => (
                  <MenuItem key={group.navigationItemId} value={group.navigationItemId}>
                    {'  '.repeat(group.depth)}
                    {localizedLabel(group, 'ko')}
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              fullWidth
              type="number"
              label={t('navigationManager.fields.order')}
              value={sortOrder}
              onChange={(event) => setSortOrder(Math.max(0, Number(event.target.value)))}
            />
          </Stack>
          {itemType === 'APP' && (
            <>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
                <TextField
                  fullWidth
                  required
                  select
                  label={t('navigationManager.fields.registry')}
                  value={registryEntryKey}
                  onChange={(event) => setRegistryEntryKey(event.target.value)}
                >
                  <MenuItem value="" disabled>
                    {t('navigationManager.fields.registry')}
                  </MenuItem>
                  {registryEntries.map((entry) => (
                    <MenuItem key={entry.entryKey} value={entry.entryKey}>
                      {entry.name} ({entry.entryKey})
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  fullWidth
                  required
                  label={t('navigationManager.fields.route')}
                  value={route}
                  onChange={(event) => setRoute(event.target.value)}
                />
                <TextField
                  fullWidth
                  label={t('navigationManager.fields.icon')}
                  value={iconKey}
                  onChange={(event) => setIconKey(event.target.value)}
                />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
                <TextField
                  fullWidth
                  required
                  select
                  label={t('navigationManager.fields.resource')}
                  value={resourceKey}
                  onChange={(event) => setResourceKey(event.target.value)}
                >
                  <MenuItem value="" disabled>
                    {t('navigationManager.fields.resource')}
                  </MenuItem>
                  {resources.map((resource) => (
                    <MenuItem key={resource.resourceId} value={resource.key}>
                      {resource.name} ({resource.key})
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  fullWidth
                  required
                  select
                  label={t('navigationManager.fields.permission')}
                  value={permissionCode}
                  onChange={(event) => setPermissionCode(event.target.value)}
                >
                  {['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'MANAGE'].map((code) => (
                    <MenuItem key={code} value={code}>
                      {code}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
            </>
          )}
          <Box>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 1 }}
            >
              <Typography variant="subtitle2">{t('navigationManager.labels.title')}</Typography>
              <Button
                size="small"
                startIcon={<Plus size={15} />}
                onClick={() =>
                  setLabels((current) => [...current, { locale: '', label: '', description: '' }])
                }
              >
                {t('navigationManager.labels.add')}
              </Button>
            </Stack>
            <Stack gap={1}>
              {labels.map((label, index) => (
                <Stack
                  key={`${index}:${label.locale}`}
                  direction={{ xs: 'column', sm: 'row' }}
                  gap={1}
                  alignItems={{ sm: 'center' }}
                >
                  <TextField
                    size="small"
                    required
                    label={t('navigationManager.labels.locale')}
                    value={label.locale}
                    onChange={(event) => updateLabel(index, { locale: event.target.value })}
                    sx={{ width: { xs: 1, sm: 120 } }}
                  />
                  <TextField
                    size="small"
                    required
                    label={t('navigationManager.labels.label')}
                    value={label.label}
                    onChange={(event) => updateLabel(index, { label: event.target.value })}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    size="small"
                    label={t('navigationManager.labels.description')}
                    value={label.description ?? ''}
                    onChange={(event) => updateLabel(index, { description: event.target.value })}
                    sx={{ flex: 1.4 }}
                  />
                  <Tooltip title={t('navigationManager.labels.remove')}>
                    <span>
                      <IconButton
                        size="small"
                        disabled={labels.length === 1}
                        onClick={() =>
                          setLabels((current) =>
                            current.filter((_value, labelIndex) => labelIndex !== index)
                          )
                        }
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              ))}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={busy || !valid}
          onClick={() =>
            void onSave({
              navigationKey: navigationKey.trim(),
              itemType,
              parentNavigationItemId: parentId ? Number(parentId) : null,
              registryEntryKey: itemType === 'APP' ? registryEntryKey.trim() : undefined,
              route: itemType === 'APP' ? route.trim() : undefined,
              iconKey: itemType === 'APP' ? iconKey.trim() : undefined,
              requiredResourceKey: itemType === 'APP' ? resourceKey.trim() : undefined,
              requiredPermissionCode: permissionCode,
              sortOrder,
              labels: validLabels.map((label) => ({
                ...label,
                locale: label.locale.trim(),
                label: label.label.trim(),
                description: label.description?.trim(),
              })),
            })
          }
        >
          {t('common.actions.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function NavigationRow({
  node,
  siblings,
  index,
  language,
  busy,
  expanded,
  onToggle,
  onEdit,
  onLifecycle,
  onMove,
}: {
  node: NavigationNode;
  siblings: NavigationNode[];
  index: number;
  language: string;
  busy: boolean;
  expanded: Set<number>;
  onToggle: (id: number) => void;
  onEdit: (node: NavigationNode) => void;
  onLifecycle: (node: NavigationNode) => void;
  onMove: (siblings: NavigationNode[], index: number, delta: number) => void;
}) {
  const { t } = useTranslation('admin');
  const isExpanded = expanded.has(node.navigationItemId);
  return (
    <Box component="li" sx={{ listStyle: 'none' }}>
      <Stack
        direction="row"
        alignItems="center"
        gap={1}
        sx={{
          minHeight: 52,
          px: 1.5,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: node.itemType === 'GROUP' ? 'action.hover' : 'transparent',
        }}
      >
        <IconButton
          size="small"
          disabled={!node.children.length}
          aria-label={
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
        </IconButton>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" alignItems="center" gap={0.75}>
            <Typography variant="body2" fontWeight={node.itemType === 'GROUP' ? 750 : 650} noWrap>
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
            {node.route ? ` / ${node.route}` : ''}
            {node.requiredResourceKey
              ? ` / ${node.requiredResourceKey}:${node.requiredPermissionCode}`
              : ''}
          </Typography>
        </Box>
        <Chip
          size="small"
          variant="outlined"
          color={
            node.lifecycleState === 'ACTIVE'
              ? 'success'
              : node.lifecycleState === 'DRAFT'
                ? 'warning'
                : 'default'
          }
          label={t(`common.lifecycle.${node.lifecycleState}`)}
        />
        <Stack direction="row">
          <Tooltip title={t('navigationManager.actions.moveUp')}>
            <span>
              <IconButton
                size="small"
                disabled={busy || index === 0}
                onClick={() => onMove(siblings, index, -1)}
              >
                <ArrowUp size={16} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t('navigationManager.actions.moveDown')}>
            <span>
              <IconButton
                size="small"
                disabled={busy || index === siblings.length - 1}
                onClick={() => onMove(siblings, index, 1)}
              >
                <ArrowDown size={16} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t('common.actions.edit')}>
            <IconButton size="small" onClick={() => onEdit(node)}>
              <Pencil size={16} />
            </IconButton>
          </Tooltip>
          <Tooltip
            title={
              node.lifecycleState === 'ACTIVE'
                ? t('navigationManager.actions.retire')
                : t('navigationManager.actions.activate')
            }
          >
            <span>
              <IconButton
                size="small"
                disabled={busy || node.lifecycleState === 'RETIRED'}
                onClick={() => onLifecycle(node)}
              >
                {node.lifecycleState === 'ACTIVE' ? (
                  <CircleStop size={16} />
                ) : (
                  <CirclePlay size={16} />
                )}
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>
      {node.children.length > 0 && isExpanded && (
        <Box component="ul" sx={{ p: 0, m: 0, ml: 3, borderLeft: 1, borderColor: 'divider' }}>
          {node.children.map((child, childIndex) => (
            <NavigationRow
              key={child.navigationItemId}
              node={child}
              siblings={node.children}
              index={childIndex}
              language={language}
              busy={busy}
              expanded={expanded}
              onToggle={onToggle}
              onEdit={onEdit}
              onLifecycle={onLifecycle}
              onMove={onMove}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

export function NavigationManager() {
  const { t, i18n } = useTranslation('admin');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NavigationNode | null>(null);
  const [busy, setBusy] = useState(false);
  const tree = useQuery({ queryKey: ['admin', 'navigation'], queryFn: listNavigationTree });
  const registry = useQuery({
    queryKey: ['admin', 'navigation', 'app-registry'],
    queryFn: () => listRegistryEntries({ registryType: 'APP', lifecycle: 'ACTIVE' }),
  });
  const resources = useQuery({
    queryKey: ['admin', 'navigation', 'resources'],
    queryFn: listGovernanceResources,
  });
  const allNodes = useMemo(() => flatten(tree.data ?? []), [tree.data]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const mutate = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: ['admin', 'navigation'] });
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('common.operationError'));
    } finally {
      setBusy(false);
    }
  };

  if (tree.isLoading || registry.isLoading || resources.isLoading) {
    return <AdminPanelLoading label={t('navigationManager.loading')} />;
  }
  const dependencyError = tree.error || registry.error || resources.error;
  if (dependencyError)
    return (
      <AdminPanelError
        message={
          dependencyError instanceof Error ? dependencyError.message : t('common.operationError')
        }
      />
    );

  const move = (siblings: NavigationNode[], index: number, delta: number) => {
    const reordered = [...siblings];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(index + delta, 0, moved);
    void mutate(
      () =>
        reorderNavigation(
          reordered.map((node, order) => ({
            navigationItemId: node.navigationItemId,
            parentNavigationItemId: node.parentNavigationItemId,
            sortOrder: order * 10,
            version: node.version,
          }))
        ),
      t('navigationManager.toasts.reordered')
    );
  };

  return (
    <>
      <Box sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          gap={1}
          sx={{ p: 2 }}
        >
          <Stack direction="row" alignItems="center" gap={1}>
            <FolderTree size={18} />
            <Typography component="h2" variant="subtitle1">
              {t('navigationManager.title')}
            </Typography>
            <Chip size="small" variant="outlined" label={allNodes.length} />
          </Stack>
          <Stack direction="row" justifyContent="flex-end">
            <Tooltip title={t('common.actions.refresh')}>
              <IconButton onClick={() => void tree.refetch()}>
                <RefreshCw size={18} />
              </IconButton>
            </Tooltip>
            <Button
              startIcon={<Plus size={17} />}
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              {t('navigationManager.actions.new')}
            </Button>
          </Stack>
        </Stack>
        {(tree.data ?? []).length ? (
          <Box component="ul" aria-label={t('navigationManager.treeLabel')} sx={{ p: 0, m: 0 }}>
            {(tree.data ?? []).map((node, index, siblings) => (
              <NavigationRow
                key={node.navigationItemId}
                node={node}
                siblings={siblings}
                index={index}
                language={i18n.resolvedLanguage ?? 'en'}
                busy={busy}
                expanded={expanded}
                onToggle={(id) =>
                  setExpanded((current) => {
                    const next = new Set(current);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
                onEdit={(value) => {
                  setEditing(value);
                  setDialogOpen(true);
                }}
                onLifecycle={(value) =>
                  void mutate(
                    () =>
                      changeNavigationLifecycle(
                        value,
                        value.lifecycleState === 'ACTIVE' ? 'RETIRED' : 'ACTIVE'
                      ),
                    t('navigationManager.toasts.lifecycle')
                  )
                }
                onMove={move}
              />
            ))}
          </Box>
        ) : (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {t('navigationManager.empty')}
            </Typography>
          </Box>
        )}
      </Box>
      {dialogOpen && (
        <NavigationDialog
          item={editing}
          groups={allNodes}
          registryEntries={registry.data?.content ?? []}
          resources={(resources.data ?? []).filter((resource) => resource.enabled)}
          open
          busy={busy}
          onClose={() => setDialogOpen(false)}
          onSave={async (request) => {
            await mutate(
              () =>
                editing
                  ? updateNavigationItem(editing.navigationItemId, {
                      parentNavigationItemId: request.parentNavigationItemId,
                      registryEntryKey: request.registryEntryKey,
                      route: request.route,
                      iconKey: request.iconKey,
                      requiredResourceKey: request.requiredResourceKey,
                      requiredPermissionCode: request.requiredPermissionCode || 'VIEW',
                      sortOrder: request.sortOrder,
                      labels: request.labels,
                      version: editing.version,
                    })
                  : createNavigationItem(request),
              t(editing ? 'navigationManager.toasts.updated' : 'navigationManager.toasts.created')
            );
            setDialogOpen(false);
          }}
        />
      )}
    </>
  );
}
