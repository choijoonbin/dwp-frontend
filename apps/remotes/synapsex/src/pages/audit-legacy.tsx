import type { SelectChangeEvent } from '@mui/material/Select';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Label, Iconify } from '@dwp-frontend/design-system';
import { useSynapseAuditEventsQuery } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Menu from '@mui/material/Menu';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import Collapse from '@mui/material/Collapse';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { mockAuditEvents } from '../data/mock-data';

import type { AuditEvent } from '../data/mock-data';

/** API 응답을 AuditEvent 형식으로 변환 */
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

// ----------------------------------------------------------------------

const extendedAuditEvents: AuditEvent[] = [
  ...mockAuditEvents,
  {
    id: 'audit-006',
    timestamp: '2026-01-29T11:30:00Z',
    actor: 'AI Agent',
    actorType: 'system',
    eventType: 'action_executed',
    description: 'Auto-executed low-risk clear item action',
    details: { actionId: 'ACT-002', outcome: 'success', targetSystem: 'SAP' },
    severity: 'info',
  },
  {
    id: 'audit-007',
    timestamp: '2026-01-29T10:45:00Z',
    actor: 'Sarah Chen',
    actorType: 'user',
    eventType: 'case_created',
    description: 'Case assigned to analyst for review',
    details: { caseId: 'case-002', assignee: 'Sarah Chen', previousAssignee: 'Unassigned' },
    severity: 'info',
  },
  {
    id: 'audit-008',
    timestamp: '2026-01-29T09:20:00Z',
    actor: 'System',
    actorType: 'system',
    eventType: 'action_approved',
    description: 'Guardrail blocked auto-execution due to high risk',
    details: { actionId: 'ACT-003', guardrail: 'CFO_APPROVAL_REQUIRED', threshold: 1000000 },
    severity: 'warning',
  },
  {
    id: 'audit-009',
    timestamp: '2026-01-29T08:15:00Z',
    actor: 'John Smith',
    actorType: 'user',
    eventType: 'action_rejected',
    description: 'Rejected payment block action with comment',
    details: { actionId: 'ACT-004', reason: 'False positive - verified vendor' },
    severity: 'warning',
  },
  {
    id: 'audit-010',
    timestamp: '2026-01-28T16:30:00Z',
    actor: 'AI Risk Engine',
    actorType: 'system',
    eventType: 'case_created',
    description: 'New anomaly detected: Bank account change before payment',
    details: { caseId: 'case-001', anomalyType: 'bank_change', confidence: 0.94 },
    severity: 'critical',
  },
  {
    id: 'audit-011',
    timestamp: '2026-01-28T15:00:00Z',
    actor: 'Admin',
    actorType: 'user',
    eventType: 'action_approved',
    description: 'Updated guardrail threshold for CFO approval',
    details: { policy: 'CFO_APPROVAL', oldThreshold: 500000, newThreshold: 1000000 },
    severity: 'info',
  },
  {
    id: 'audit-012',
    timestamp: '2026-01-28T14:20:00Z',
    actor: 'System',
    actorType: 'system',
    eventType: 'simulation_run',
    description: 'Pre-execution simulation completed for reversal action',
    details: { actionId: 'ACT-001', simResult: 'passed', warnings: 0 },
    severity: 'info',
  },
];

const eventTypes = [
  { value: 'action_approved', label: 'Action Approved' },
  { value: 'action_rejected', label: 'Action Rejected' },
  { value: 'action_executed', label: 'Action Executed' },
  { value: 'case_created', label: 'Case Created' },
  { value: 'simulation_run', label: 'Simulation Run' },
  { value: 'comment_added', label: 'Comment Added' },
];

const actorTypes = [
  { value: 'user', label: 'Human User' },
  { value: 'system', label: 'AI/System' },
];

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

/** 감사 추적 로그 */
export const AuditPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('category') ?? undefined;
  const eventTypeParam = searchParams.get('type') ?? undefined;
  const resourceType = searchParams.get('resourceType') ?? undefined;
  const outcome = searchParams.get('outcome') ?? undefined;
  const severity = searchParams.get('severity') ?? undefined;
  const actor = searchParams.get('actor') ?? undefined;
  const qParam = searchParams.get('q') ?? undefined;

  const apiParams = useMemo(
    () =>
      category || eventTypeParam || resourceType || outcome || severity || actor || qParam
        ? {
            category,
            type: eventTypeParam,
            resourceType,
            outcome,
            severity,
            actor,
            q: qParam,
            page: 0,
            size: 100,
          }
        : undefined,
    [category, eventTypeParam, resourceType, outcome, severity, actor, qParam]
  );

  const { data: apiAuditData } = useSynapseAuditEventsQuery(apiParams ?? undefined, {
    enabled: Boolean(apiParams),
  });

  const baseEvents = useMemo((): (AuditEvent & { details?: Record<string, unknown> })[] => {
    if (apiParams && apiAuditData?.items?.length) {
      return apiAuditData.items.map(mapApiEventToAuditEvent);
    }
    return extendedAuditEvents;
  }, [apiParams, apiAuditData]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
  const [selectedActorTypes, setSelectedActorTypes] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState('all');
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [eventTypeAnchor, setEventTypeAnchor] = useState<null | HTMLElement>(null);
  const [actorTypeAnchor, setActorTypeAnchor] = useState<null | HTMLElement>(null);

  const filteredEvents = useMemo(
    () =>
      baseEvents.filter((event) => {
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          if (
            !event.description.toLowerCase().includes(query) &&
            !event.actor.toLowerCase().includes(query) &&
            !event.id.toLowerCase().includes(query)
          ) {
            return false;
          }
        }
        if (selectedEventTypes.length > 0 && !selectedEventTypes.includes(event.eventType)) {
          return false;
        }
        if (selectedActorTypes.length > 0 && !selectedActorTypes.includes(event.actorType)) {
          return false;
        }
        return true;
      }),
    [baseEvents, searchQuery, selectedEventTypes, selectedActorTypes]
  );

  const userActionsCount = baseEvents.filter((e) => e.actorType === 'user').length;
  const systemActionsCount = baseEvents.filter((e) => e.actorType === 'system').length;

  const toggleEventType = (value: string) => {
    setSelectedEventTypes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  };

  const toggleActorType = (value: string) => {
    setSelectedActorTypes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  };

  const updateUrlFilter = (key: string, value: string | undefined) => {
    setSearchParams(
      (prev: URLSearchParams) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true }
    );
  };

  const categories = [
    { value: 'CASE', label: 'Case' },
    { value: 'ACTION', label: 'Action' },
    { value: 'POLICY', label: 'Policy' },
    { value: 'GUARDRAIL', label: 'Guardrail' },
    { value: 'AUDIT', label: 'Audit' },
  ];
  const outcomes = [
    { value: 'SUCCESS', label: 'Success' },
    { value: 'FAILURE', label: 'Failure' },
    { value: 'PENDING', label: 'Pending' },
  ];
  const severities = [
    { value: 'info', label: 'Info' },
    { value: 'warning', label: 'Warning' },
    { value: 'critical', label: 'Critical' },
  ];

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, width: '100%' }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Iconify icon="solar:history-bold" width={24} sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Audit Trail
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Complete audit history of all system activities and decisions
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Iconify icon="solar:download-minimalistic-bold" width={18} />}
            sx={{ bgcolor: 'transparent' }}
          >
            Export
          </Button>
        </Stack>

        {/* Stats */}
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Total Events
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 700 }}>
                      {baseEvents.length}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 1.5,
                      bgcolor: 'primary.lighter',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
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
                      User Actions
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 700, color: 'info.main' }}>
                      {userActionsCount}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 1.5,
                      bgcolor: 'info.lighter',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
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
                      System Actions
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 700, color: 'success.main' }}>
                      {systemActionsCount}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 1.5,
                      bgcolor: 'success.lighter',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Iconify icon="solar:robot-bold" width={24} sx={{ color: 'success.main' }} />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
              <TextField
                size="small"
                placeholder="Search (q)..."
                value={qParam ?? ''}
                onChange={(e) => updateUrlFilter('q', e.target.value || undefined)}
                sx={{ minWidth: 180, maxWidth: { xs: '100%', sm: 280 } }}
                InputProps={{
                  startAdornment: (
                    <Iconify icon="solar:magnifer-linear" width={20} sx={{ mr: 1, color: 'text.secondary' }} />
                  ),
                }}
              />
              <Select
                size="small"
                value={eventTypeParam ?? ''}
                onChange={(e) => updateUrlFilter('type', e.target.value || undefined)}
                displayEmpty
                sx={{ minWidth: 140 }}
              >
                <MenuItem value="">All Types</MenuItem>
                {eventTypes.map((t) => (
                  <MenuItem key={t.value} value={t.value}>
                    {t.label}
                  </MenuItem>
                ))}
              </Select>
              <Select
                size="small"
                value={category ?? ''}
                onChange={(e) => updateUrlFilter('category', e.target.value || undefined)}
                displayEmpty
                sx={{ minWidth: 120 }}
              >
                <MenuItem value="">All Categories</MenuItem>
                {categories.map((c) => (
                  <MenuItem key={c.value} value={c.value}>
                    {c.label}
                  </MenuItem>
                ))}
              </Select>
              <Select
                size="small"
                value={outcome ?? ''}
                onChange={(e) => updateUrlFilter('outcome', e.target.value || undefined)}
                displayEmpty
                sx={{ minWidth: 120 }}
              >
                <MenuItem value="">All Outcomes</MenuItem>
                {outcomes.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
              <Select
                size="small"
                value={severity ?? ''}
                onChange={(e) => updateUrlFilter('severity', e.target.value || undefined)}
                displayEmpty
                sx={{ minWidth: 110 }}
              >
                <MenuItem value="">All Severities</MenuItem>
                {severities.map((s) => (
                  <MenuItem key={s.value} value={s.value}>
                    {s.label}
                  </MenuItem>
                ))}
              </Select>
              <TextField
                size="small"
                placeholder="Actor..."
                value={actor ?? ''}
                onChange={(e) => updateUrlFilter('actor', e.target.value || undefined)}
                sx={{ minWidth: 120 }}
              />
              <TextField
                size="small"
                placeholder="Resource type..."
                value={resourceType ?? ''}
                onChange={(e) => updateUrlFilter('resourceType', e.target.value || undefined)}
                sx={{ minWidth: 120 }}
              />
              {/* Event Type Filter (client-side when using mock) */}
              <Button
                variant="outlined"
                size="small"
                onClick={(e) => setEventTypeAnchor(e.currentTarget)}
                startIcon={<Iconify icon="solar:filter-bold" width={16} />}
                endIcon={
                  selectedEventTypes.length > 0 ? (
                    <Chip label={selectedEventTypes.length} size="small" sx={{ height: 18 }} />
                  ) : null
                }
                sx={{ bgcolor: 'transparent' }}
              >
                Event Type
              </Button>
              <Menu
                anchorEl={eventTypeAnchor}
                open={Boolean(eventTypeAnchor)}
                onClose={() => setEventTypeAnchor(null)}
              >
                {eventTypes.map((type) => (
                  <MenuItem key={type.value} onClick={() => toggleEventType(type.value)} dense>
                    <FormControlLabel
                      control={<Checkbox checked={selectedEventTypes.includes(type.value)} size="small" />}
                      label={type.label}
                      sx={{ width: '100%', ml: 0 }}
                    />
                  </MenuItem>
                ))}
              </Menu>

              {/* Actor Type Filter */}
              <Button
                variant="outlined"
                size="small"
                onClick={(e) => setActorTypeAnchor(e.currentTarget)}
                startIcon={<Iconify icon="solar:filter-bold" width={16} />}
                endIcon={
                  selectedActorTypes.length > 0 ? (
                    <Chip label={selectedActorTypes.length} size="small" sx={{ height: 18 }} />
                  ) : null
                }
                sx={{ bgcolor: 'transparent' }}
              >
                Actor Type
              </Button>
              <Menu
                anchorEl={actorTypeAnchor}
                open={Boolean(actorTypeAnchor)}
                onClose={() => setActorTypeAnchor(null)}
              >
                {actorTypes.map((type) => (
                  <MenuItem key={type.value} onClick={() => toggleActorType(type.value)} dense>
                    <FormControlLabel
                      control={
                        <>
                          <Checkbox checked={selectedActorTypes.includes(type.value)} size="small" />
                          <Iconify
                            icon={type.value === 'user' ? 'solar:user-bold' : 'solar:robot-bold'}
                            width={14}
                            sx={{ ml: 1, mr: 0.5, color: 'text.secondary' }}
                          />
                        </>
                      }
                      label={type.label}
                      sx={{ width: '100%', ml: 0 }}
                    />
                  </MenuItem>
                ))}
              </Menu>

              {/* Time Range */}
              <Select
                size="small"
                value={timeRange}
                onChange={(e: SelectChangeEvent) => setTimeRange(e.target.value)}
                startAdornment={
                  <Iconify icon="solar:calendar-bold" width={16} sx={{ mr: 1, color: 'text.secondary' }} />
                }
                sx={{ minWidth: 150 }}
              >
                <MenuItem value="all">All Time</MenuItem>
                <MenuItem value="today">Today</MenuItem>
                <MenuItem value="week">This Week</MenuItem>
                <MenuItem value="month">This Month</MenuItem>
              </Select>
            </Stack>
          </CardContent>
        </Card>

        {/* Audit Log */}
        <Card variant="outlined">
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ p: 2.5, pb: 1.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Audit Events
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {filteredEvents.length} events matching your filters
              </Typography>
            </Box>
            <Divider />
            <Box sx={{ maxHeight: 600, overflow: 'auto' }}>
              {filteredEvents.map((event, index) => {
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
                        {/* Icon */}
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 1.5,
                            bgcolor:
                              event.severity === 'critical'
                                ? 'error.main'
                                : event.severity === 'warning'
                                  ? 'warning.main'
                                  : 'action.selected',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'common.white',
                            flexShrink: 0,
                          }}
                        >
                          <Iconify icon={icon} width={20} />
                        </Box>

                        {/* Content */}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {event.description}
                            </Typography>
                            {event.severity === 'critical' && (
                              <Label color="error" sx={{ fontSize: '0.625rem' }}>
                                Critical
                              </Label>
                            )}
                            {event.severity === 'warning' && (
                              <Label color="warning" sx={{ fontSize: '0.625rem' }}>
                                Warning
                              </Label>
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
                            <Typography variant="caption" color="text.disabled">
                              |
                            </Typography>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <Iconify icon="solar:clock-circle-bold" width={14} sx={{ color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary">
                                {new Date(event.timestamp).toLocaleString()}
                              </Typography>
                            </Stack>
                            <Typography variant="caption" color="text.disabled">
                              |
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                              {event.eventType.replace(/_/g, ' ')}
                            </Typography>
                          </Stack>

                          {/* Expanded Details */}
                          <Collapse in={isExpanded}>
                            {event.details && (
                              <Box
                                sx={{
                                  mt: 2,
                                  p: 2,
                                  bgcolor: 'background.neutral',
                                  borderRadius: 1,
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  sx={{ fontWeight: 600, color: 'text.secondary', mb: 1, display: 'block' }}
                                >
                                  Event Details
                                </Typography>
                                <Grid container spacing={1.5}>
                                  {Object.entries(event.details).map(([key, value]) => (
                                    <Grid size={{ xs: 12, sm: 6 }} key={key}>
                                      <Stack direction="row" spacing={1}>
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                          sx={{ textTransform: 'capitalize' }}
                                        >
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

                        {/* Expand Icon */}
                        <IconButton size="small" sx={{ flexShrink: 0 }}>
                          <Iconify
                            icon={isExpanded ? 'solar:alt-arrow-down-bold' : 'solar:alt-arrow-right-bold'}
                            width={16}
                            sx={{ color: 'text.secondary' }}
                          />
                        </IconButton>
                      </Stack>
                    </Box>
                  </Box>
                );
              })}

              {filteredEvents.length === 0 && (
                <Box sx={{ p: 10, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No audit events match the current filters.
                  </Typography>
                </Box>
              )}
            </Box>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};
