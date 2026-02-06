import { useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Checkbox from '@mui/material/Checkbox';
import ListItem from '@mui/material/ListItem';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import ListItemButton from '@mui/material/ListItemButton';
import CircularProgress from '@mui/material/CircularProgress';

type CatalogItem = { bukrs?: string; waers?: string; docCount?: number };

type CatalogAddDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  keyField: 'bukrs' | 'waers';
  items: CatalogItem[];
  existingKeys: string[];
  onConfirm: (selectedKeys: string[]) => Promise<void>;
  isLoading?: boolean;
  catalogError?: Error | null;
};

export const CatalogAddDialog = ({
  open,
  onClose,
  title,
  keyField,
  items,
  existingKeys,
  onConfirm,
  isLoading = false,
  catalogError,
}: CatalogAddDialogProps) => {
  const { t } = useTranslation('common');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const getKey = (item: CatalogItem) => (keyField === 'bukrs' ? item.bukrs : item.waers) ?? '';
  const availableItems = items.filter((item) => {
    const key = getKey(item);
    return key && !existingKeys.includes(key);
  });

  const handleToggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selected.size === availableItems.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(availableItems.map((i) => getKey(i))));
    }
  };

  const handleConfirm = async () => {
    const keys = Array.from(selected);
    if (keys.length === 0) return;
    setSubmitting(true);
    try {
      await onConfirm(keys);
      setSelected(new Set());
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setSelected(new Set());
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Iconify icon="solar:add-circle-bold" width={20} />
          <span>{title}</span>
        </Stack>
      </DialogTitle>
      <DialogContent>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : catalogError ? (
          <Typography variant="body2" color="error.main" sx={{ py: 3 }}>
            {t('tenantScope.catalogLoadFailed')} ({catalogError.message})
          </Typography>
        ) : availableItems.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
            {t('tenantScope.noItemsToAdd')}
          </Typography>
        ) : (
          <Card variant="outlined" sx={{ maxHeight: 320, overflow: 'auto' }}>
            <List dense>
              <ListItem disablePadding>
                <ListItemButton onClick={handleSelectAll}>
                  <ListItemIcon>
                    <Checkbox
                      edge="start"
                      checked={selected.size === availableItems.length && availableItems.length > 0}
                      indeterminate={selected.size > 0 && selected.size < availableItems.length}
                      tabIndex={-1}
                      disableRipple
                    />
                  </ListItemIcon>
                  <ListItemText primary={t('tenantScope.selectAll')} primaryTypographyProps={{ fontWeight: 600 }} />
                </ListItemButton>
              </ListItem>
              {availableItems.map((item) => {
                const key = getKey(item);
                const isChecked = selected.has(key);
                return (
                  <ListItem key={key} disablePadding>
                    <ListItemButton onClick={() => handleToggle(key)}>
                      <ListItemIcon>
                        <Checkbox edge="start" checked={isChecked} tabIndex={-1} disableRipple />
                      </ListItemIcon>
                      <ListItemText
                        primary={key}
                        secondary={item.docCount != null ? t('tenantScope.docCount', { count: item.docCount }) : undefined}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Card>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          {t('tenantScope.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={submitting || selected.size === 0}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {submitting ? t('tenantScope.adding') : t('tenantScope.addWithCount', { count: selected.size })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
