import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  Fingerprint,
  ShieldCheck,
  UserRoundCheck,
} from 'lucide-react';
import { ActionButton, FormDialog, SelectField } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import {
  buildApprovalDelegationWorkflowReference,
  isApprovalDelegationDirection,
} from './approval-delegation-model';
import { ApprovalDelegationInspector } from './approval-delegation-inspector';
import { StatusChip } from './approval-ui';

import type { ApprovalDelegation } from '@dwp-frontend/shared-utils';

type Props = {
  delegations: readonly ApprovalDelegation[];
  selectedId?: string;
  canManage: boolean;
  sourceReady: boolean;
  pending: boolean;
  onSelect: (delegation: ApprovalDelegation) => void;
  onEdit: (delegation: ApprovalDelegation) => void;
  onRevoke: (delegation: ApprovalDelegation) => void;
};

export function ApprovalDelegationWorkspace({
  delegations,
  selectedId,
  canManage,
  sourceReady,
  pending,
  onSelect,
  onEdit,
  onRevoke,
}: Props) {
  const { t } = useTranslation('approvals');
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('lg'));
  const [direction, setDirection] = useState<'ALL' | 'OUTGOING' | 'INCOMING'>('ALL');
  const [status, setStatus] = useState('ALL');
  const [detailOpen, setDetailOpen] = useState(false);
  useEffect(() => {
    if (!sourceReady) setDetailOpen(false);
  }, [sourceReady]);
  const filtered = useMemo(
    () =>
      delegations.filter(
        (item) =>
          (direction === 'ALL' || item.direction === direction) &&
          (status === 'ALL' || item.lifecycleState === status)
      ),
    [delegations, direction, status]
  );
  const selected = filtered.find((item) => item.delegationId === selectedId) ?? filtered[0];
  const states = [...new Set(delegations.map((item) => item.lifecycleState))].sort();
  const count = (kind: 'OUTGOING' | 'INCOMING') =>
    delegations.filter((item) => item.direction === kind && item.lifecycleState === 'ACTIVE')
      .length;
  const label = (item: ApprovalDelegation) =>
    item.direction === 'INCOMING'
      ? t('delegations.receivedFrom', { userId: item.delegatorUserId })
      : item.delegateDisplayName;
  const scope = (item: ApprovalDelegation) => {
    const reference = buildApprovalDelegationWorkflowReference(item);
    return item.scopeType === 'ALL'
      ? t('delegations.scopes.all')
      : reference.displayKey
        ? t('delegations.scopeWorkflow', { key: reference.displayKey })
        : t('delegations.scopeWorkflowUnavailable');
  };
  const open = (item: ApprovalDelegation) => {
    onSelect(item);
    if (mobile) setDetailOpen(true);
  };
  const inspector = selected && (
    <ApprovalDelegationInspector
      delegation={selected}
      canManage={canManage}
      sourceReady={sourceReady}
      pending={pending}
      onEdit={(delegation) => {
        setDetailOpen(false);
        onEdit(delegation);
      }}
      onRevoke={onRevoke}
    />
  );
  const signals = [
    {
      key: 'outgoing',
      title: t('delegations.directions.outgoing'),
      value: count('OUTGOING'),
      icon: ArrowUpRight,
      tone: 'primary.main',
    },
    {
      key: 'incoming',
      title: t('delegations.directions.incoming'),
      value: count('INCOMING'),
      icon: ArrowDownLeft,
      tone: 'success.main',
    },
    {
      key: 'active',
      title: t('delegations.workspace.active'),
      value: delegations.filter(
        (item) => isApprovalDelegationDirection(item.direction) && item.lifecycleState === 'ACTIVE'
      ).length,
      icon: ShieldCheck,
      tone: 'info.main',
    },
    {
      key: 'history',
      title: t('delegations.workspace.history'),
      value: delegations.length,
      icon: CalendarClock,
      tone: 'text.secondary',
    },
  ];
  return (
    <Stack
      gap={2}
      sx={{
        p: { xs: 1.5, md: 2 },
        '& .MuiChip-root': { height: 'auto', minHeight: 24, maxWidth: '100%' },
        '& .MuiChip-label': { py: 0.25, whiteSpace: 'normal', overflowWrap: 'anywhere' },
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} justifyContent="space-between">
        <Tabs
          value={direction}
          onChange={(_, next: 'ALL' | 'OUTGOING' | 'INCOMING') => setDirection(next)}
          aria-label={t('delegations.fields.scope')}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minWidth: 0, bgcolor: 'action.hover', alignSelf: { xs: 'stretch', sm: 'center' } }}
        >
          <Tab value="ALL" label={t('delegations.workspace.all')} />
          <Tab
            value="OUTGOING"
            label={t('delegations.directions.outgoing')}
            icon={<ArrowUpRight size={16} />}
            iconPosition="start"
          />
          <Tab
            value="INCOMING"
            label={t('delegations.directions.incoming')}
            icon={<ArrowDownLeft size={16} />}
            iconPosition="start"
          />
        </Tabs>
        <Box sx={{ width: { xs: '100%', sm: 200 }, flexShrink: 0 }}>
          <SelectField
            label={t('delegations.workspace.status')}
            value={status}
            options={[
              { value: 'ALL', label: t('delegations.workspace.allStatuses') },
              ...states.map((value) => ({
                value,
                label: t(`status.${value}`, { defaultValue: value }),
              })),
            ]}
            onValueChange={setStatus}
          />
        </Box>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
          gap: 1.5,
        }}
      >
        {signals.map(({ key, title, value, icon: Icon, tone }) => (
          <Box
            key={key}
            component="section"
            sx={{
              p: 1.5,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderTop: 2,
              borderTopColor: tone,
              minWidth: 0,
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
              <Typography variant="caption" color="text.secondary">
                {title}
              </Typography>
              <Box sx={{ color: tone, display: 'flex' }}>
                <Icon size={17} aria-hidden="true" />
              </Box>
            </Stack>
            <Typography component="p" variant="h5" sx={{ mt: 0.75 }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1.8fr) minmax(270px, .8fr)' },
          alignItems: 'start',
          border: 1,
          borderColor: 'divider',
        }}
      >
        <Box minWidth={0}>
          <Stack
            direction="row"
            alignItems="center"
            gap={1}
            sx={{
              px: 2,
              py: 1.5,
              bgcolor: 'action.hover',
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Typography component="h2" variant="subtitle2">
              {t('delegations.workspace.history')}
            </Typography>
            <Chip size="small" variant="outlined" label={filtered.length} />
          </Stack>
          {filtered.length === 0 ? (
            <Stack alignItems="center" gap={1} sx={{ py: 6, px: 2, color: 'text.secondary' }}>
              <CalendarClock size={32} aria-hidden="true" />
              <Typography component="p" variant="subtitle2">
                {t('delegations.empty')}
              </Typography>
              <Typography variant="body2" textAlign="center">
                {t('delegations.emptyDescription')}
              </Typography>
            </Stack>
          ) : mobile ? (
            <List disablePadding aria-label={t('delegations.workspace.history')}>
              {filtered.map((item) => (
                <ListItem key={item.delegationId} disablePadding divider>
                  <ListItemButton
                    selected={item.delegationId === selected?.delegationId}
                    onClick={() => open(item)}
                    sx={{ px: 2, py: 1.75, minWidth: 0 }}
                  >
                    <Stack gap={0.75} minWidth={0} width="100%">
                      <Typography variant="subtitle2">{label(item)}</Typography>
                      <Stack
                        direction="row"
                        alignItems="center"
                        gap={0.75}
                        useFlexGap
                        flexWrap="wrap"
                      >
                        <StatusChip status={item.lifecycleState} />
                        <Typography variant="caption" color="text.secondary">
                          {scope(item)}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(item.startsAt)} - {formatDate(item.endsAt)}
                      </Typography>
                      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                        {item.reason}
                      </Typography>
                    </Stack>
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          ) : (
            <TableContainer>
              <Table
                size="small"
                aria-label={t('delegations.workspace.history')}
                sx={{
                  tableLayout: 'fixed',
                  minWidth: 630,
                  '& td, & th': { overflowWrap: 'anywhere', verticalAlign: 'top' },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell width="19%">{t('delegations.workspace.status')}</TableCell>
                    <TableCell width="24%">{t('delegations.fields.delegate')}</TableCell>
                    <TableCell width="22%">{t('delegations.fields.scope')}</TableCell>
                    <TableCell>{t('delegations.workspace.period')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map((item) => (
                    <TableRow
                      key={item.delegationId}
                      selected={item.delegationId === selected?.delegationId}
                    >
                      <TableCell>
                        <StatusChip status={item.lifecycleState} />
                      </TableCell>
                      <TableCell>
                        <ActionButton
                          intent="quiet"
                          size="small"
                          startIcon={<UserRoundCheck size={15} />}
                          onClick={() => open(item)}
                          sx={{
                            textAlign: 'left',
                            justifyContent: 'flex-start',
                            whiteSpace: 'normal',
                          }}
                        >
                          {label(item)}
                        </ActionButton>
                        {item.delegateEmail && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {item.delegateEmail}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary" display="block">
                          {isApprovalDelegationDirection(item.direction)
                            ? t(`delegations.directions.${item.direction.toLowerCase()}`)
                            : t('delegations.workspace.unknownDirection')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{scope(item)}</Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                          sx={{ mt: 0.5 }}
                        >
                          {item.reason}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" display="block">
                          {formatDate(item.startsAt, { dateStyle: 'medium', timeStyle: 'short' })}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {formatDate(item.endsAt, { dateStyle: 'medium', timeStyle: 'short' })}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
        <Box
          component="aside"
          aria-label={t('delegations.workspace.details')}
          sx={{
            display: { xs: 'none', lg: 'block' },
            borderLeft: 1,
            borderColor: 'divider',
            minWidth: 0,
            p: 2,
          }}
        >
          {inspector}
        </Box>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          gap: 2,
        }}
      >
        {[
          { key: 'scope', icon: ShieldCheck },
          { key: 'evidence', icon: Fingerprint },
          { key: 'revoke', icon: CalendarClock },
        ].map(({ key, icon: Icon }) => (
          <Box
            key={key}
            component="section"
            sx={{ minWidth: 0, borderTop: 1, borderColor: 'divider', pt: 1.5 }}
          >
            <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 0.75 }}>
              <Box sx={{ color: 'primary.main', display: 'flex' }}>
                <Icon size={17} aria-hidden="true" />
              </Box>
              <Typography component="h3" variant="subtitle2">
                {t(`delegations.workspace.${key}Title`)}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {t(`delegations.workspace.${key}Detail`)}
            </Typography>
          </Box>
        ))}
      </Box>
      <FormDialog
        open={mobile && detailOpen && Boolean(selected)}
        title={t('delegations.workspace.details')}
        cancelLabel={t('actions.close')}
        submitLabel={t('actions.close')}
        onSubmit={() => setDetailOpen(false)}
        showSubmit={false}
        mobileFullScreen
        busy={pending}
        onClose={() => {
          if (!pending) setDetailOpen(false);
        }}
      >
        {inspector}
      </FormDialog>
    </Stack>
  );
}
