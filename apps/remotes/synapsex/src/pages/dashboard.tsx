import { Link } from 'react-router-dom';
import { Label, Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

import { SYNAPSE_ROUTES } from '../routes';
import { SeverityBadge } from '../components/finance/severity-badge';
import {
  mockKPIs,
  mockCases,
  mockActions,
  mockRiskDrivers,
  mockTeamSnapshot,
  mockAgentActivity,
} from '../data/mock-data';

import type { SynapseAction , AgentActivityItem } from '../data/mock-data';

// ----------------------------------------------------------------------

/** KPI 카드 */
const KPICard = ({
  title,
  value,
  suffix,
  subValue,
  trend,
  trendLabel,
  icon,
  iconColor,
  iconBg,
}: {
  title: string;
  value: string | number;
  suffix?: string;
  subValue?: string;
  trend?: number;
  trendLabel?: string;
  icon: string;
  iconColor: string;
  iconBg: string;
}) => (
  <Card variant="outlined" sx={{ height: '100%' }}>
    <CardContent sx={{ p: 2 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
          <Stack direction="row" alignItems="baseline" spacing={0.5}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {value}
            </Typography>
            {suffix && (
              <Typography variant="body2" color="text.secondary">
                {suffix}
              </Typography>
            )}
          </Stack>
          {subValue && (
            <Typography variant="caption" color="text.secondary">
              {subValue}
            </Typography>
          )}
          {trend !== undefined && (
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ pt: 0.5 }}>
              <Iconify
                icon={trend > 0 ? 'solar:arrow-up-bold' : 'solar:arrow-down-bold'}
                width={16}
                sx={{ color: trend > 0 ? 'success.main' : 'error.main' }}
              />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  color: trend > 0 ? 'success.main' : 'error.main',
                }}
              >
                {trend > 0 ? '+' : ''}
                {trend}%
              </Typography>
              {trendLabel && (
                <Typography variant="caption" color="text.secondary">
                  {trendLabel}
                </Typography>
              )}
            </Stack>
          )}
        </Stack>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: iconBg,
            color: iconColor,
            flexShrink: 0,
          }}
        >
          <Iconify icon={icon} width={24} />
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

/** 에이전트 활동 로그 한 줄 */
const ActivityLogItem = ({ activity }: { activity: AgentActivityItem }) => {
  const time = new Date(activity.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const actionColors: Record<string, string> = {
    SCAN: 'info.main',
    DETECT: 'warning.main',
    EXECUTE: 'success.main',
    SIMULATE: 'primary.main',
    ANALYZE: 'info.main',
    MATCH: 'primary.main',
  };
  const statusColors: Record<string, string> = {
    complete: 'text.secondary',
    success: 'success.main',
    alert: 'warning.main',
    error: 'error.main',
  };
  const actionColor = actionColors[activity.action] ?? 'text.primary';
  const statusColor = statusColors[activity.status] ?? 'text.primary';

  return (
    <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
        {time}
      </Typography>
      <Typography variant="caption" sx={{ color: actionColor, flexShrink: 0 }}>
        [{activity.action}]
      </Typography>
      <Typography variant="caption" sx={{ color: statusColor, flex: 1 }}>
        {activity.message}
      </Typography>
    </Stack>
  );
};

/** 통합 관제 센터 (Intelligence Command Center) */
export const DashboardPage = () => {
  const pendingActions = mockActions.filter((a) => a.status === 'pending');

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, width: '100%' }}>
      <Stack spacing={3}>
        {/* Page Header */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Intelligence Command Center
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              Real-time overview of autonomous finance operations
            </Typography>
          </Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Iconify icon="solar:refresh-bold" width={18} />}
              sx={{ bgcolor: 'transparent' }}
            >
              <Typography component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                Refresh
              </Typography>
            </Button>
            <Button
              component={Link}
              to={SYNAPSE_ROUTES.CASES}
              variant="contained"
              size="small"
              startIcon={<Iconify icon="solar:eye-bold" width={18} />}
            >
              <Typography component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                View All Cases
              </Typography>
            </Button>
          </Stack>
        </Stack>

        {/* KPI Cards */}
        <Stack
          direction="row"
          flexWrap="wrap"
          useFlexGap
          spacing={2}
          sx={{ '& > *': { minWidth: 240, flex: '1 1 200px' } }}
        >
          <KPICard
            title="Financial Health Index"
            value={mockKPIs.financialHealthIndex}
            suffix="/100"
            trend={mockKPIs.financialHealthTrend}
            trendLabel="vs last month"
            icon="solar:heart-bold-duotone"
            iconColor="success.main"
            iconBg="success.lighter"
          />
          <KPICard
            title="Open Cases by Severity"
            value={
              mockKPIs.openCasesBySeverity.critical + mockKPIs.openCasesBySeverity.high
            }
            suffix=" critical/high"
            subValue={`${mockKPIs.openCasesBySeverity.medium + mockKPIs.openCasesBySeverity.low} medium/low`}
            icon="solar:danger-triangle-bold-duotone"
            iconColor="warning.main"
            iconBg="warning.lighter"
          />
          <KPICard
            title="AI Action Success Rate"
            value={mockKPIs.aiActionSuccessRate}
            suffix="%"
            trend={mockKPIs.aiActionSuccessTrend}
            trendLabel="vs last week"
            icon="solar:bolt-bold-duotone"
            iconColor="primary.main"
            iconBg="primary.lighter"
          />
          <KPICard
            title="Est. Prevented Loss"
            value={`$${(mockKPIs.estimatedPreventedLoss / 1_000_000).toFixed(2)}M`}
            trend={mockKPIs.preventedLossTrend}
            trendLabel="this quarter"
            icon="solar:wallet-money-bold-duotone"
            iconColor="success.main"
            iconBg="success.lighter"
          />
        </Stack>

        {/* Main Content Grid */}
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} sx={{ alignItems: 'stretch' }}>
          <Stack spacing={3} sx={{ flex: { lg: '2 1 0%' }, minWidth: 0 }}>
            {/* Action Required Queue */}
            <Card variant="outlined">
              <CardContent sx={{ pb: 2 }}>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ mb: 2 }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Iconify
                      icon="solar:clock-circle-bold-duotone"
                      width={20}
                      sx={{ color: 'warning.main' }}
                    />
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        Action Required
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Approvals waiting for your review
                      </Typography>
                    </Box>
                  </Stack>
                  <Label color="warning" variant="soft">
                    {pendingActions.length} Pending
                  </Label>
                </Stack>
                <Stack spacing={1.5}>
                  {pendingActions.slice(0, 3).map((action: SynapseAction) => {
                    const relatedCase = mockCases.find((c) => c.id === action.caseId);
                    return (
                      <Stack
                        key={action.id}
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        spacing={2}
                        sx={{
                          p: 1.5,
                          borderRadius: 1,
                          border: 1,
                          borderColor: 'divider',
                          bgcolor: 'background.neutral',
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                      >
                        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              bgcolor:
                                action.riskLevel === 'critical'
                                  ? 'error.lighter'
                                  : action.riskLevel === 'high'
                                    ? 'warning.lighter'
                                    : 'info.lighter',
                            }}
                          >
                            <Iconify
                              icon="solar:bolt-bold-duotone"
                              width={20}
                              sx={{
                                color:
                                  action.riskLevel === 'critical'
                                    ? 'error.main'
                                    : action.riskLevel === 'high'
                                      ? 'warning.main'
                                      : 'info.main',
                              }}
                            />
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                              {action.description}
                            </Typography>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.25 }}>
                              <Typography variant="caption" color="text.secondary">
                                {relatedCase?.caseNumber ?? action.caseId}
                              </Typography>
                              <SeverityBadge severity={action.riskLevel} size="sm" showIcon={false} />
                            </Stack>
                          </Box>
                        </Stack>
                        <Button
                          component={Link}
                          to={`${SYNAPSE_ROUTES.ACTIONS}?id=${action.id}`}
                          variant="contained"
                          size="small"
                          endIcon={<Iconify icon="solar:arrow-right-bold" width={16} />}
                        >
                          Review
                        </Button>
                      </Stack>
                    );
                  })}
                </Stack>
                <Button
                  component={Link}
                  to={SYNAPSE_ROUTES.ACTIONS}
                  variant="text"
                  fullWidth
                  sx={{ mt: 1.5, color: 'text.secondary' }}
                  startIcon={<Iconify icon="solar:arrow-right-bold" width={16} />}
                >
                  View All Pending Actions
                </Button>
              </CardContent>
            </Card>

            {/* Top Risk Drivers */}
            <Card variant="outlined">
              <CardContent sx={{ pb: 2 }}>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ mb: 2 }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Iconify
                      icon="solar:chart-2-bold-duotone"
                      width={20}
                      sx={{ color: 'primary.main' }}
                    />
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        Top Risk Drivers
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Primary anomaly categories requiring attention
                      </Typography>
                    </Box>
                  </Stack>
                  <Button variant="outlined" size="small">
                    View Analytics
                  </Button>
                </Stack>
                <Stack spacing={2}>
                  {mockRiskDrivers.map((driver) => (
                    <Box key={driver.id}>
                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ mb: 0.5 }}
                      >
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {driver.label}
                          </Typography>
                          <Label color="default" variant="soft" sx={{ fontSize: '0.75rem' }}>
                            {driver.count} cases
                          </Label>
                          {driver.trend === 'up' && (
                            <Iconify
                              icon="solar:arrow-up-bold"
                              width={14}
                              sx={{ color: 'error.main' }}
                            />
                          )}
                          {driver.trend === 'down' && (
                            <Iconify
                              icon="solar:arrow-down-bold"
                              width={14}
                              sx={{ color: 'success.main' }}
                            />
                          )}
                        </Stack>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          ${(driver.amount / 1000).toFixed(0)}K
                        </Typography>
                      </Stack>
                      <Box
                        sx={{
                          height: 8,
                          borderRadius: 1,
                          bgcolor: 'action.hover',
                          overflow: 'hidden',
                        }}
                      >
                        <Box
                          sx={{
                            height: '100%',
                            width: `${Math.min(100, (driver.amount / 500_000) * 100)}%`,
                            borderRadius: 1,
                            bgcolor:
                              driver.type === 'duplicate_invoice'
                                ? 'error.main'
                                : driver.type === 'bank_change'
                                  ? 'warning.main'
                                  : driver.type === 'policy_violation'
                                    ? 'info.main'
                                    : 'primary.main',
                          }}
                        />
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>

            {/* Team Snapshot */}
            <Card variant="outlined">
              <CardContent sx={{ pb: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                  <Iconify
                    icon="solar:users-group-rounded-bold-duotone"
                    width={20}
                    sx={{ color: 'primary.main' }}
                  />
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      Team Snapshot
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Workload and performance metrics
                    </Typography>
                  </Box>
                </Stack>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>
                        Analyst
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                        Open Cases
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                        SLA Risk
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                        Avg Lead Time
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {mockTeamSnapshot.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {member.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {member.role}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {member.openCases}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          {member.slaRisk > 0 ? (
                            <Label color="error" variant="soft" sx={{ fontSize: '0.75rem' }}>
                              {member.slaRisk} at risk
                            </Label>
                          ) : (
                            <Label color="success" variant="soft" sx={{ fontSize: '0.75rem' }}>
                              On track
                            </Label>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {member.avgLeadTime}h
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Stack>

          {/* Right Column - Agent Activity Stream & Quick Stats */}
          <Stack spacing={3} sx={{ flex: { lg: '1 1 0%' }, minWidth: 0 }}>
            <Card variant="outlined" sx={{ alignSelf: { lg: 'flex-start' } }}>
              <CardContent sx={{ pb: 2 }}>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ mb: 2 }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Iconify
                      icon="solar:bot-bold-duotone"
                      width={20}
                      sx={{ color: 'primary.main' }}
                    />
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        Agent Execution Stream
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Real-time AI agent activity
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: 'success.main',
                        animation: 'ping 1.5s ease-in-out infinite',
                        '@keyframes ping': {
                          '75%, 100%': { transform: 'scale(1.5)', opacity: 0 },
                        },
                      }}
                    />
                    <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>
                      Live
                    </Typography>
                  </Stack>
                </Stack>
                <Box
                  sx={{
                    borderRadius: 1,
                    border: 1,
                    borderColor: 'divider',
                    bgcolor: 'background.neutral',
                    overflow: 'hidden',
                  }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{
                      px: 1,
                      py: 0.75,
                      borderBottom: 1,
                      borderColor: 'divider',
                      bgcolor: 'action.hover',
                    }}
                  >
                    <Stack direction="row" spacing={0.25}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'error.main', opacity: 0.6 }} />
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'warning.main', opacity: 0.6 }} />
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'success.main', opacity: 0.6 }} />
                    </Stack>
                    <Typography variant="caption" fontFamily="monospace" color="text.secondary">
                      agent-stream.log
                    </Typography>
                  </Stack>
                  <Stack spacing={1} sx={{ p: 1.5, maxHeight: 400, overflow: 'auto' }}>
                    {mockAgentActivity.map((activity) => (
                      <ActivityLogItem key={activity.id} activity={activity} />
                    ))}
                  </Stack>
                </Box>
                <Button
                  variant="text"
                  fullWidth
                  size="small"
                  sx={{ mt: 1.5, color: 'text.secondary' }}
                  startIcon={<Iconify icon="solar:arrow-right-bold" width={14} />}
                >
                  View Full Audit Log
                </Button>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ alignSelf: { lg: 'flex-start' } }}>
              <CardContent sx={{ pb: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                  <Iconify
                    icon="solar:shield-check-bold-duotone"
                    width={20}
                    sx={{ color: 'primary.main' }}
                  />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Quick Stats
                  </Typography>
                </Stack>
                <Stack spacing={2}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Pending Approvals
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {mockKPIs.pendingApprovals}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      SLA at Risk
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'warning.main' }}>
                      {mockKPIs.slaAtRisk}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Avg Lead Time
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {mockKPIs.avgLeadTime}h
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Backlog
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {mockKPIs.backlogCount}
                    </Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Stack>
      </Stack>
    </Box>
  );
};
