/**
 * 감사 추적 로그 Advanced 필터 — Drawer, Add Filter 패턴
 * 필요한 필터만 추가하면 입력폼이 나타나는 방식 (Jira/Notion 스타일)
 */

import { memo } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';

import type { AuditFilters } from '../types';

// ----------------------------------------------------------------------

const ADVANCED_FILTER_OPTIONS: { key: keyof AuditFilters; labelKey: string; multi?: boolean }[] = [
  { key: 'eventType', labelKey: 'audit.eventType', multi: true },
  { key: 'severity', labelKey: 'audit.allSeverities', multi: true },
  { key: 'resourceType', labelKey: 'audit.resourceTypePlaceholder', multi: true },
  { key: 'resourceId', labelKey: 'audit.resourceId' },
  { key: 'actorUserId', labelKey: 'audit.actorPlaceholder' },
  { key: 'actorAgentId', labelKey: 'audit.actorAgentId' },
  { key: 'traceId', labelKey: 'audit.traceId' },
  { key: 'spanId', labelKey: 'audit.spanId' },
  { key: 'gatewayRequestId', labelKey: 'audit.gatewayRequestId' },
  { key: 'ipAddress', labelKey: 'audit.ipAddress' },
  { key: 'userAgent', labelKey: 'audit.userAgent' },
  { key: 'tags', labelKey: 'audit.tags', multi: true },
];

const SEVERITY_OPTIONS = ['INFO', 'WARN', 'HIGH', 'CRITICAL'] as const;

// ----------------------------------------------------------------------

type AuditAdvancedFiltersDrawerProps = {
  open: boolean;
  onClose: () => void;
  filters: AuditFilters;
  onUpdate: <K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) => void;
  onResetAdvanced: () => void;
  activeAdvancedKeys: (keyof AuditFilters)[];
  onToggleActive: (key: keyof AuditFilters) => void;
};

export const AuditAdvancedFiltersDrawer = memo(({
  open,
  onClose,
  filters,
  onUpdate,
  onResetAdvanced,
  activeAdvancedKeys,
  onToggleActive,
}: AuditAdvancedFiltersDrawerProps) => {
  const { t } = useTranslation('common');

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', sm: 400 } },
      }}
    >
      <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {t('audit.advanced')}
          </Typography>
          <Button
            size="small"
            startIcon={<Iconify icon="solar:refresh-bold" width={16} />}
            onClick={onResetAdvanced}
          >
            {t('audit.filterReset')}
          </Button>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('audit.addFilter')}
        </Typography>

        <Stack spacing={2} sx={{ flex: 1, overflow: 'auto' }}>
          {ADVANCED_FILTER_OPTIONS.map((opt) => {
            const isActive = activeAdvancedKeys.includes(opt.key);
            const value = filters[opt.key];

            return (
              <Box key={opt.key}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={isActive}
                      onChange={() => onToggleActive(opt.key)}
                      size="small"
                    />
                  }
                  label={t(opt.labelKey)}
                />
                {isActive && (
                  <Box sx={{ mt: 1, pl: 4 }}>
                    {opt.multi ? (
                      opt.key === 'severity' ? (
                        <Stack direction="row" flexWrap="wrap" gap={1}>
                          {SEVERITY_OPTIONS.map((sev) => {
                            const arr = (value as string[]) ?? [];
                            const checked = arr.includes(sev);
                            return (
                              <Chip
                                key={sev}
                                label={sev}
                                size="small"
                                variant={checked ? 'filled' : 'outlined'}
                                onClick={() => {
                                  const next = checked
                                    ? arr.filter((s) => s !== sev)
                                    : [...arr, sev];
                                  onUpdate(opt.key, next as AuditFilters[typeof opt.key]);
                                }}
                                sx={{ cursor: 'pointer' }}
                              />
                            );
                          })}
                        </Stack>
                      ) : (
                        <TextField
                          size="small"
                          fullWidth
                          placeholder={t('audit.searchPlaceholder')}
                          value={Array.isArray(value) ? value.join(', ') : ''}
                          onChange={(e) =>
                            onUpdate(
                              opt.key,
                              e.target.value
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean) as AuditFilters[typeof opt.key]
                            )
                          }
                        />
                      )
                    ) : (
                      <TextField
                        size="small"
                        fullWidth
                        placeholder={String(opt.key)}
                        value={typeof value === 'string' ? value : ''}
                        onChange={(e) => onUpdate(opt.key, e.target.value as AuditFilters[typeof opt.key])}
                      />
                    )}
                  </Box>
                )}
              </Box>
            );
          })}
        </Stack>
      </Box>
    </Drawer>
  );
});

AuditAdvancedFiltersDrawer.displayName = 'AuditAdvancedFiltersDrawer';
