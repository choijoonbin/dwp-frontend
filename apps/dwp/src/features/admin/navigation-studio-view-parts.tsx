import { useTranslation } from 'react-i18next';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CirclePlay,
  CircleStop,
  Eye,
  GripVertical,
  Languages,
  LockKeyhole,
  Pencil,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { ActionIconButton, FormField } from '@dwp-frontend/design-system';

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

import type {
  GovernanceResource,
  NavigationDiffSummary,
  NavigationNode,
  NavigationValidationReport,
} from '@dwp-frontend/shared-utils';

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

export function SortableNavigationRow({
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

export function DiffMetrics({ diff }: { diff: NavigationDiffSummary }) {
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

export function ValidationPanel({
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

export function RuntimePreview({
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
