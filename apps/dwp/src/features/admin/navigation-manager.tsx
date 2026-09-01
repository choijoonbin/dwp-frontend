import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';

import Box from '@mui/material/Box';
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

import type {
  CreateNavigationRequest,
  GovernanceResource,
  NavigationLabel,
  NavigationNode,
  RegistryEntry,
} from '@dwp-frontend/shared-utils';

type FlatNode = NavigationNode & { depth: number };

function localizedLabel(node: NavigationNode, language: string): string {
  return (
    node.labels.find((label) => label.locale === language)?.label ??
    node.labels.find((label) => label.locale.startsWith(language))?.label ??
    node.labels.find((label) => label.locale === 'en')?.label ??
    node.labels[0]?.label ??
    node.navigationKey
  );
}

export function NavigationDialog({
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
