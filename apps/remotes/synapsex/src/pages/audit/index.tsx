/**
 * 감사 추적 로그 — FilterCard 활용, 정돈된 UX
 * 기본 6개 필터 + Advanced(Drawer) + Chip 요약
 */

import { useMemo, useState, useCallback } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { Label, Iconify } from '@dwp-frontend/design-system';
import { useSynapseAuditEventsQuery } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

import { mockAuditEvents } from '../../data/mock-data';
import { useAuditFilters } from './hooks/use-audit-filters';
import { AuditFilterBar } from './components/audit-filter-bar';
import { useAuditFilterOptions } from './hooks/use-audit-filter-options';
import { AuditAdvancedFiltersDrawer } from './components/audit-advanced-filters-drawer';

import type { AuditEvent } from '../../data/mock-data';
import type { AuditFilters, AuditBasicFilters, AuditAdvancedFilters } from './types';

// ----------------------------------------------------------------------

const ADVANCED_KEYS: (keyof AuditAdvancedFilters)[] = [
  'eventType',
  'severity',
  'resourceType',
  'resourceId',
  'actorUserId',
  'actorAgentId',
  'traceId',
  'spanId',
  'gatewayRequestId',
  'ipAddress',
  'userAgent',
  'tags',
];

const isAdvancedKey = (k: keyof AuditFilters): k is keyof AuditAdvancedFilters =>
  ADVANCED_KEYS.includes(k as keyof AuditAdvancedFilters);

const mapApiEventToAuditEvent = (
  item: {
    auditId: string;
    createdAt: string;
    eventCategory?: string;
    eventType?: string;
    resourceType?: string;
    actorType?: string;
    actorDisplayName?: string;
    severity?: string;
    evidenceJson?: unknown;
  }
): AuditEvent & { details: Record<string, unknown> } => {
  const actorTypeMap =
    item.actorType === 'HUMAN' ? 'user' : item.actorType === 'AGENT' ? 'agent' : 'system';
  return {
    id: item.auditId,
    timestamp: item.createdAt,
    actor: item.actorDisplayName ?? 'System',
    actorType: actorTypeMap as 'user' | 'system' | 'agent',
    eventType: (item.eventType ?? item.eventCategory ?? 'comment_added') as AuditEvent['eventType'],
    description: [item.eventCategory, item.eventType, item.resourceType]
      .filter(Boolean)
      .join(' · ') || 'Audit event',
    details: (item.evidenceJson as Record<string, unknown>) ?? {},
    severity: (item.severity?.toLowerCase() as 'info' | 'warning' | 'critical') ?? 'info',
  };
};

const getEventIcon = (eventType: string): string => {
  switch (eventType) {
    case 'action_approved':
    case 'APPROVE':
      return 'solar:check-circle-bold';
    case 'action_rejected':
    case 'REJECT':
      return 'solar:close-circle-bold';
    case 'action_executed':
    case 'EXECUTE':
      return 'solar:bolt-circle-bold';
    case 'case_created':
    case 'CREATE':
      return 'solar:document-add-bold';
    case 'simulation_run':
      return 'solar:database-bold';
    case 'comment_added':
    case 'UPDATE':
      return 'solar:chat-round-dots-bold';
    case 'DELETE':
      return 'solar:trash-bin-trash-bold';
    default:
      return 'solar:history-bold';
  }
};

// ----------------------------------------------------------------------

/** 적용된 필터 Chip 목록 생성 */
const getActiveFilterChips = (
  filters: AuditFilters,
  t: (key: string) => string
): { key: string; label: string }[] => {
  const chips: { key: string; label: string }[] = [];
  if (filters.datePreset && filters.datePreset !== '24h') {
    chips.push({ key: 'datePreset', label: t(`audit.datePresets.${filters.datePreset}`) });
  }
  if (filters.eventCategory) {
    chips.push({ key: 'eventCategory', label: `${t('audit.allCategories')}: ${t(`audit.categories.${filters.eventCategory}`)}` });
  }
  if (filters.eventTypeFilter?.trim()) {
    chips.push({
      key: 'eventTypeFilter',
      label: `${t('audit.eventType')}: ${t(`audit.eventTypes.${filters.eventTypeFilter}`) || filters.eventTypeFilter}`,
    });
  }
  if (filters.outcome) {
    chips.push({ key: 'outcome', label: `${t('audit.allOutcomes')}: ${t(`audit.outcomes.${filters.outcome}`)}` });
  }
  if (filters.actorType) {
    chips.push({ key: 'actorType', label: `${t('audit.actorType')}: ${t(`audit.actorTypes.${filters.actorType}`)}` });
  }
  if (filters.q?.trim()) {
    chips.push({ key: 'q', label: `q: ${filters.q.trim()}` });
  }
  ADVANCED_KEYS.forEach((k) => {
    const v = filters[k];
    if (Array.isArray(v) && v.length) {
      chips.push({ key: k, label: `${String(k)}: ${v.join(', ')}` });
    } else if (typeof v === 'string' && v.trim()) {
      chips.push({ key: k, label: `${String(k)}: ${v.trim()}` });
    }
  });
  return chips;
};

// ----------------------------------------------------------------------

export const AuditPage = () => {
  const { t } = useTranslation('common');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [activeAdvancedKeys, setActiveAdvancedKeys] = useState<(keyof AuditFilters)[]>([]);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const {
    filters,
    updateBasic,
    updateAdvanced,
    reset,
    resetAdvanced,
    apiParams,
    hasActiveFilters,
  } = useAuditFilters();
  const filterOptions = useAuditFilterOptions();

  const { data: apiData } = useSynapseAuditEventsQuery(apiParams, {
    enabled: Boolean(apiParams),
  });

  const baseEvents = useMemo((): (AuditEvent & { details?: Record<string, unknown> })[] => {
    if (apiParams && apiData?.items?.length) {
      return apiData.items.map(mapApiEventToAuditEvent);
    }
    return mockAuditEvents;
  }, [apiParams, apiData]);

  const userActionsCount = baseEvents.filter((e) => e.actorType === 'user').length;
  const systemActionsCount = baseEvents.filter((e) => e.actorType === 'system' || e.actorType === 'agent').length;

  const handleToggleActive = useCallback((key: keyof AuditFilters) => {
    setActiveAdvancedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  const handleResetAdvanced = useCallback(() => {
    setActiveAdvancedKeys([]);
    resetAdvanced();
  }, [resetAdvanced]);

  const handleRemoveChip = useCallback(
    (chipKey: string) => {
      if (chipKey === 'datePreset') updateBasic('datePreset', '24h');
      else if (chipKey === 'eventCategory') updateBasic('eventCategory', '');
      else if (chipKey === 'eventTypeFilter') updateBasic('eventTypeFilter', '');
      else if (chipKey === 'outcome') updateBasic('outcome', '');
      else if (chipKey === 'actorType') updateBasic('actorType', '');
      else if (chipKey === 'q') updateBasic('q', '');
      else if (isAdvancedKey(chipKey as keyof AuditFilters)) {
        updateAdvanced(chipKey as keyof AuditAdvancedFilters, (Array.isArray((filters as Record<string, unknown>)[chipKey]) ? [] : '') as never);
        setActiveAdvancedKeys((prev) => prev.filter((k) => k !== chipKey));
      }
    },
    [updateBasic, updateAdvanced, filters]
  );

  const activeChips = useMemo(() => getActiveFilterChips(filters, t), [filters, t]);

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, width: '100%' }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={2}>
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Iconify icon="solar:history-bold" width={24} sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {t('audit.title')}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {t('audit.subtitle')}
            </Typography>
          </Box>
          <Button variant="outlined" size="small" startIcon={<Iconify icon="solar:download-minimalistic-bold" width={18} />} sx={{ bgcolor: 'transparent' }}>
            {t('audit.export')}
          </Button>
        </Stack>

        {/* KPI Cards */}
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('audit.totalEvents')}
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 700 }}>
                      {baseEvents.length}
                    </Typography>
                  </Box>
                  <Box sx={{ width: 48, height: 48, borderRadius: 1.5, bgcolor: 'primary.lighter', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Iconify icon="solar:history-bold" width={24} sx={{ color: 'primary.main' }} />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('audit.userActions')}
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 700, color: 'info.main' }}>
                      {userActionsCount}
                    </Typography>
                  </Box>
                  <Box sx={{ width: 48, height: 48, borderRadius: 1.5, bgcolor: 'info.lighter', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Iconify icon="solar:user-bold" width={24} sx={{ color: 'info.main' }} />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('audit.systemActions')}
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 700, color: 'success.main' }}>
                      {systemActionsCount}
                    </Typography>
                  </Box>
                  <Box sx={{ width: 48, height: 48, borderRadius: 1.5, bgcolor: 'success.lighter', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Iconify icon="solar:robot-bold" width={24} sx={{ color: 'success.main' }} />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filter Bar — 선택된 필터 칩은 FilterCard title 옆에 표시 */}
        <AuditFilterBar
          filters={filters}
          options={filterOptions}
          onUpdate={(k, v) => {
            if (isAdvancedKey(k)) updateAdvanced(k, v);
            else updateBasic(k as keyof AuditBasicFilters, v as AuditBasicFilters[keyof AuditBasicFilters]);
          }}
          onReset={reset}
          onAdvancedOpen={() => setAdvancedOpen(true)}
          hasActiveFilters={hasActiveFilters}
          chips={
            activeChips.length > 0 ? (
              <Stack component="span" direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ gap: 0.5 }}>
                {activeChips.map((chip) => (
                  <Chip
                    key={chip.key}
                    label={chip.label}
                    size="small"
                    onDelete={() => handleRemoveChip(chip.key)}
                    sx={{ fontSize: '0.75rem' }}
                  />
                ))}
              </Stack>
            ) : undefined
          }
        />

        {/* Audit Log */}
        <Card variant="outlined">
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ p: 2.5, pb: 1.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {t('audit.auditEvents')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('audit.eventsMatching', { count: baseEvents.length })}
              </Typography>
            </Box>
            <Divider />
            <Box sx={{ maxHeight: 600, overflow: 'auto' }}>
              {baseEvents.map((event, index) => {
                const isExpanded = expandedEvent === event.id;
                const icon = getEventIcon(event.eventType);
                const bgColor =
                  event.severity === 'critical'
                    ? 'error.lighter'
                    : event.severity === 'warning'
                      ? 'warning.lighter'
                      : 'transparent';

                return (
                  <Box key={event.id}>
                    {index > 0 && <Divider />}
                    <Box
                      sx={{
                        p: 2.5,
                        bgcolor: bgColor,
                        cursor: 'pointer',
                        transition: (theme) => theme.transitions.create(['background-color']),
                        '&:hover': { bgcolor: isExpanded ? bgColor : 'action.hover' },
                      }}
                      onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                    >
                      <Stack direction="row" alignItems="flex-start" spacing={2}>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 1.5,
                            bgcolor: event.severity === 'critical' ? 'error.main' : event.severity === 'warning' ? 'warning.main' : 'action.selected',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'common.white',
                            flexShrink: 0,
                          }}
                        >
                          <Iconify icon={icon} width={20} />
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {event.description}
                            </Typography>
                            {event.severity === 'critical' && (
                              <Label color="error" sx={{ fontSize: '0.625rem' }}>{t('audit.severities.critical')}</Label>
                            )}
                            {event.severity === 'warning' && (
                              <Label color="warning" sx={{ fontSize: '0.625rem' }}>{t('audit.severities.warning')}</Label>
                            )}
                          </Stack>
                          <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <Iconify
                                icon={event.actorType === 'user' ? 'solar:user-bold' : 'solar:robot-bold'}
                                width={14}
                                sx={{ color: 'text.secondary' }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {event.actor}
                              </Typography>
                            </Stack>
                            <Typography variant="caption" color="text.disabled">|</Typography>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <Iconify icon="solar:clock-circle-bold" width={14} sx={{ color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary">
                                {new Date(event.timestamp).toLocaleString()}
                              </Typography>
                            </Stack>
                            <Typography variant="caption" color="text.disabled">|</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                              {event.eventType.replace(/_/g, ' ')}
                            </Typography>
                          </Stack>
                          <Collapse in={isExpanded}>
                            {event.details && Object.keys(event.details).length > 0 && (
                              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.neutral', borderRadius: 1 }}>
                                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 1, display: 'block' }}>
                                  {t('audit.eventDetails')}
                                </Typography>
                                <Grid container spacing={1.5}>
                                  {Object.entries(event.details).map(([key, value]) => (
                                    <Grid size={{ xs: 12, sm: 6 }} key={key}>
                                      <Stack direction="row" spacing={1}>
                                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                                          {key.replace(/([A-Z])/g, ' $1')}:
                                        </Typography>
                                        <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                          {String(value)}
                                        </Typography>
                                      </Stack>
                                    </Grid>
                                  ))}
                                </Grid>
                              </Box>
                            )}
                          </Collapse>
                        </Box>
                        <IconButton size="small" sx={{ flexShrink: 0 }}>
                          <Iconify icon={isExpanded ? 'solar:alt-arrow-down-bold' : 'solar:alt-arrow-right-bold'} width={16} sx={{ color: 'text.secondary' }} />
                        </IconButton>
                      </Stack>
                    </Box>
                  </Box>
                );
              })}
              {baseEvents.length === 0 && (
                <Box sx={{ p: 10, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('audit.empty')}
                  </Typography>
                </Box>
              )}
            </Box>
          </CardContent>
        </Card>

        <AuditAdvancedFiltersDrawer
          open={advancedOpen}
          onClose={() => setAdvancedOpen(false)}
          filters={filters}
          onUpdate={(k, v) => {
            if (isAdvancedKey(k)) updateAdvanced(k, v);
            else updateBasic(k as keyof AuditBasicFilters, v as AuditBasicFilters[keyof AuditBasicFilters]);
          }}
          onResetAdvanced={handleResetAdvanced}
          activeAdvancedKeys={activeAdvancedKeys}
          onToggleActive={handleToggleActive}
        />
      </Stack>
    </Box>
  );
};
