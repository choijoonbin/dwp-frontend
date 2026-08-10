import { useTranslation } from 'react-i18next';
import { formatNumber } from '@dwp-frontend/shared-i18n';
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CircleUserRound,
  ExternalLink,
  Mail,
  MapPin,
  Network,
  Route,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
  X,
} from 'lucide-react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { PersonAvatar } from '../people/person-avatar';

import type { LucideIcon } from 'lucide-react';
import type { OrganizationChart } from '@dwp-frontend/shared-utils';

export type OrgChartSelection =
  | { kind: 'organization'; id: string }
  | { kind: 'person'; id: string }
  | { kind: 'position'; id: string };

function formatMoney(value?: number | null, currency?: string | null): string {
  if (value == null) return '-';
  return formatNumber(value, {
    style: currency && currency !== 'MIXED' ? 'currency' : 'decimal',
    currency: currency && currency !== 'MIXED' ? currency : undefined,
    maximumFractionDigits: 0,
  });
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value?: string | null;
}) {
  return (
    <Stack direction="row" gap={1.25} alignItems="flex-start" sx={{ py: 0.8 }}>
      <Icon size={16} strokeWidth={1.7} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="caption" color="text.secondary" display="block">
          {label}
        </Typography>
        <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
          {value || '-'}
        </Typography>
      </Box>
    </Stack>
  );
}

function PersonLink({
  personId,
  chart,
  secondary,
  onSelect,
}: {
  personId: string;
  chart: OrganizationChart;
  secondary?: string | null;
  onSelect: (selection: OrgChartSelection) => void;
}) {
  const person = chart.people.find((candidate) => candidate.personId === personId);
  if (!person) return null;
  return (
    <ButtonBase
      onClick={() => onSelect({ kind: 'person', id: person.personId })}
      sx={{
        width: 1,
        minHeight: 52,
        px: 1,
        py: 0.75,
        justifyContent: 'flex-start',
        borderRadius: 1,
        textAlign: 'left',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <PersonAvatar name={person.displayName} size={32} />
      <Box sx={{ ml: 1, minWidth: 0, flex: 1 }}>
        <Typography variant="body2" fontWeight={650} noWrap>
          {person.displayName}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" noWrap>
          {secondary || person.businessTitle || person.workEmail}
        </Typography>
      </Box>
      <ExternalLink size={14} />
    </ButtonBase>
  );
}

export function OrgChartInspector({
  chart,
  selection,
  rolesByEmail,
  onClose,
  onSelect,
  onFocusOrganization,
}: {
  chart: OrganizationChart;
  selection: OrgChartSelection;
  rolesByEmail: ReadonlyMap<string, string[]>;
  onClose: () => void;
  onSelect: (selection: OrgChartSelection) => void;
  onFocusOrganization: (organizationId: string) => void;
}) {
  const { t } = useTranslation('admin');
  const organization =
    selection.kind === 'organization'
      ? chart.organizations.find((candidate) => candidate.organizationId === selection.id)
      : undefined;
  const person =
    selection.kind === 'person'
      ? chart.people.find((candidate) => candidate.personId === selection.id)
      : undefined;
  const position =
    selection.kind === 'position'
      ? chart.positions.find((candidate) => candidate.positionId === selection.id)
      : undefined;

  if (!organization && !person && !position) return null;

  const title = organization?.name ?? person?.displayName ?? position?.title ?? '';
  const subtitle = organization
    ? t(`orgChart.organizationTypes.${organization.organizationType}`, {
        defaultValue: organization.organizationTypeName || organization.organizationType,
      })
    : person
      ? person.businessTitle || person.jobProfileName || t('people.notAvailable')
      : position
        ? `${position.positionKey} · ${t(`orgChart.positionStatus.${position.status}`, {
            defaultValue: position.status,
          })}`
        : '';

  return (
    <Stack sx={{ height: 1, minHeight: 0, bgcolor: 'background.paper' }}>
      <Stack direction="row" alignItems="flex-start" gap={1.25} sx={{ px: 2, py: 1.75 }}>
        {person ? (
          <PersonAvatar name={person.displayName} size={42} />
        ) : (
          <Box
            sx={{
              width: 42,
              height: 42,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 1,
              bgcolor: 'action.selected',
              color: 'primary.main',
            }}
          >
            {position ? <BriefcaseBusiness size={21} /> : <Building2 size={21} />}
          </Box>
        )}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography component="h2" variant="subtitle1" fontWeight={750} sx={{ lineHeight: 1.25 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3 }}>
            {subtitle}
          </Typography>
        </Box>
        <Tooltip title={t('orgChart.actions.closeDetails')}>
          <IconButton
            size="small"
            aria-label={t('orgChart.actions.closeDetails')}
            onClick={onClose}
          >
            <X size={18} />
          </IconButton>
        </Tooltip>
      </Stack>
      <Divider />

      <Box sx={{ minHeight: 0, overflowY: 'auto', px: 2, py: 1.5 }}>
        {organization && (
          <OrganizationDetails
            chart={chart}
            organizationId={organization.organizationId}
            onSelect={onSelect}
            onFocusOrganization={onFocusOrganization}
          />
        )}
        {person && (
          <PersonDetails
            chart={chart}
            personId={person.personId}
            rolesByEmail={rolesByEmail}
            onSelect={onSelect}
          />
        )}
        {position && (
          <PositionDetails chart={chart} positionId={position.positionId} onSelect={onSelect} />
        )}
      </Box>
    </Stack>
  );
}

function OrganizationDetails({
  chart,
  organizationId,
  onSelect,
  onFocusOrganization,
}: {
  chart: OrganizationChart;
  organizationId: string;
  onSelect: (selection: OrgChartSelection) => void;
  onFocusOrganization: (organizationId: string) => void;
}) {
  const { t } = useTranslation('admin');
  const organization = chart.organizations.find(
    (candidate) => candidate.organizationId === organizationId
  );
  if (!organization) return null;
  const leader = organization.leaderPersonId
    ? chart.people.find((person) => person.personId === organization.leaderPersonId)
    : undefined;
  const members = organization.directMemberIds.filter((personId) => personId !== leader?.personId);
  const openPositions = chart.openPositions.filter(
    (position) => position.organizationId === organization.organizationId
  );

  return (
    <Stack gap={2}>
      {organization.description && (
        <Typography variant="body2" color="text.secondary">
          {organization.description}
        </Typography>
      )}
      <Button
        variant="outlined"
        size="small"
        startIcon={<Network size={16} />}
        onClick={() => onFocusOrganization(organization.organizationId)}
      >
        {t('orgChart.actions.focusOrganization')}
      </Button>
      <Box>
        <Typography variant="overline" color="text.secondary">
          {t('orgChart.details.organization')}
        </Typography>
        <DetailRow
          icon={UsersRound}
          label={t('orgChart.details.headcount')}
          value={t('orgChart.details.headcountValue', {
            total: organization.totalHeadcount,
            direct: organization.directHeadcount,
          })}
        />
        <DetailRow
          icon={Building2}
          label={t('orgChart.details.costCenter')}
          value={organization.costCenterKey}
        />
        <DetailRow
          icon={BriefcaseBusiness}
          label={t('orgChart.details.openPositions')}
          value={String(organization.openPositionCount)}
        />
        <DetailRow
          icon={Route}
          label={t('orgChart.details.layerAndSpan')}
          value={t('orgChart.details.layerAndSpanValue', {
            layer: organization.layerDepth,
            span: organization.averageManagerSpan.toFixed(1),
          })}
        />
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.8 }}>
          <Typography variant="caption" color="text.secondary">
            {t('orgChart.details.health')}
          </Typography>
          <Chip
            size="small"
            variant="outlined"
            color={
              organization.healthStatus === 'HEALTHY'
                ? 'success'
                : organization.healthStatus === 'CRITICAL'
                  ? 'error'
                  : 'warning'
            }
            label={t(`orgChart.health.${organization.healthStatus}`, {
              defaultValue: organization.healthStatus,
            })}
          />
        </Stack>
      </Box>

      {leader && (
        <Box>
          <Typography variant="overline" color="text.secondary">
            {t('orgChart.details.leader')}
          </Typography>
          <PersonLink personId={leader.personId} chart={chart} onSelect={onSelect} />
        </Box>
      )}

      {members.length > 0 && (
        <Box>
          <Typography variant="overline" color="text.secondary">
            {t('orgChart.details.directMembers', { count: members.length })}
          </Typography>
          <Stack sx={{ mt: 0.5 }}>
            {members.slice(0, 10).map((personId) => (
              <PersonLink key={personId} personId={personId} chart={chart} onSelect={onSelect} />
            ))}
          </Stack>
        </Box>
      )}

      {openPositions.length > 0 && (
        <Box>
          <Typography variant="overline" color="text.secondary">
            {t('orgChart.details.openPositions')}
          </Typography>
          <Stack divider={<Divider flexItem />} sx={{ mt: 0.5 }}>
            {openPositions.map((position) => (
              <Box key={position.positionKey} sx={{ py: 1 }}>
                <Typography variant="body2" fontWeight={650}>
                  {position.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {[position.locationName, position.availabilityDate].filter(Boolean).join(' / ')}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}

function PersonDetails({
  chart,
  personId,
  rolesByEmail,
  onSelect,
}: {
  chart: OrganizationChart;
  personId: string;
  rolesByEmail: ReadonlyMap<string, string[]>;
  onSelect: (selection: OrgChartSelection) => void;
}) {
  const { t } = useTranslation('admin');
  const person = chart.people.find((candidate) => candidate.personId === personId);
  if (!person) return null;
  const organization = chart.organizations.find(
    (candidate) => candidate.organizationId === person.organizationId
  );
  const manager = person.managerPersonId
    ? chart.people.find((candidate) => candidate.personId === person.managerPersonId)
    : undefined;
  const reports = chart.people.filter((candidate) => candidate.managerPersonId === person.personId);
  const roles = person.workEmail ? (rolesByEmail.get(person.workEmail.toLowerCase()) ?? []) : [];

  return (
    <Stack gap={2}>
      <Box>
        <Typography variant="overline" color="text.secondary">
          {t('orgChart.details.profile')}
        </Typography>
        <DetailRow icon={Mail} label={t('orgChart.details.email')} value={person.workEmail} />
        <DetailRow
          icon={Building2}
          label={t('orgChart.details.organization')}
          value={organization?.name}
        />
        <DetailRow
          icon={UserRoundCheck}
          label={t('orgChart.details.grade')}
          value={[person.jobGradeName, person.jobGradeKey].filter(Boolean).join(' / ')}
        />
        <DetailRow
          icon={MapPin}
          label={t('orgChart.details.location')}
          value={person.locationName}
        />
        <DetailRow
          icon={CircleUserRound}
          label={t('orgChart.details.workerType')}
          value={t(`orgChart.workerTypes.${person.workerType}`, {
            defaultValue: person.workerType,
          })}
        />
        <DetailRow
          icon={CalendarDays}
          label={t('orgChart.details.status')}
          value={t(`people.status.${person.workerStatus}`, {
            defaultValue: person.workerStatus,
          })}
        />
        <DetailRow
          icon={BriefcaseBusiness}
          label={t('orgChart.details.position')}
          value={person.positionKey}
        />
      </Box>

      <Box>
        <Typography variant="overline" color="text.secondary">
          {t('orgChart.details.accessRoles')}
        </Typography>
        <Stack direction="row" gap={0.6} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
          {roles.length ? (
            roles.map((role) => (
              <Chip key={role} icon={<ShieldCheck size={14} />} label={role} size="small" />
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">
              {t('orgChart.details.noAccessRole')}
            </Typography>
          )}
        </Stack>
      </Box>

      {manager && (
        <Box>
          <Typography variant="overline" color="text.secondary">
            {t('orgChart.details.manager')}
          </Typography>
          <PersonLink personId={manager.personId} chart={chart} onSelect={onSelect} />
        </Box>
      )}

      {reports.length > 0 && (
        <Box>
          <Typography variant="overline" color="text.secondary">
            {t('orgChart.details.directReports', { count: reports.length })}
          </Typography>
          <Stack sx={{ mt: 0.5 }}>
            {reports.map((report) => (
              <PersonLink
                key={report.personId}
                personId={report.personId}
                chart={chart}
                secondary={report.businessTitle}
                onSelect={onSelect}
              />
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}

function PositionDetails({
  chart,
  positionId,
  onSelect,
}: {
  chart: OrganizationChart;
  positionId: string;
  onSelect: (selection: OrgChartSelection) => void;
}) {
  const { t } = useTranslation('admin');
  const position = chart.positions.find((candidate) => candidate.positionId === positionId);
  if (!position) return null;
  const organization = chart.organizations.find(
    (candidate) => candidate.organizationId === position.organizationId
  );
  const parent = position.reportsToPositionId
    ? chart.positions.find((candidate) => candidate.positionId === position.reportsToPositionId)
    : undefined;
  const subordinates = chart.positions.filter(
    (candidate) => candidate.reportsToPositionId === position.positionId
  );

  return (
    <Stack gap={2}>
      <Box>
        <Typography variant="overline" color="text.secondary">
          {t('orgChart.details.positionProfile')}
        </Typography>
        <Stack direction="row" gap={0.6} sx={{ mb: 1 }}>
          <Chip
            size="small"
            color={position.status === 'OPEN' ? 'warning' : 'success'}
            variant="outlined"
            label={t(`orgChart.positionStatus.${position.status}`, {
              defaultValue: position.status,
            })}
          />
          <Chip
            size="small"
            color={position.criticality === 'CRITICAL' ? 'error' : 'default'}
            variant="outlined"
            label={t(`orgChart.criticality.${position.criticality}`, {
              defaultValue: position.criticality,
            })}
          />
        </Stack>
        <DetailRow
          icon={BriefcaseBusiness}
          label={t('orgChart.details.positionKey')}
          value={position.positionKey}
        />
        <DetailRow
          icon={Building2}
          label={t('orgChart.details.organization')}
          value={organization?.name}
        />
        <DetailRow
          icon={CircleUserRound}
          label={t('orgChart.details.positionType')}
          value={position.positionType}
        />
        <DetailRow
          icon={UserRoundCheck}
          label={t('orgChart.details.jobProfile')}
          value={position.jobProfileName}
        />
        <DetailRow
          icon={MapPin}
          label={t('orgChart.details.location')}
          value={position.locationName}
        />
        <DetailRow
          icon={UsersRound}
          label={t('orgChart.details.budgetedFte')}
          value={position.budgetedFte.toFixed(2)}
        />
        <DetailRow
          icon={BadgeDollarSign}
          label={t('orgChart.details.annualCost')}
          value={formatMoney(position.annualCostAmount, position.costCurrency)}
        />
        <DetailRow
          icon={CalendarDays}
          label={t('orgChart.details.availabilityDate')}
          value={position.availabilityDate}
        />
      </Box>

      {position.incumbentPersonIds.length > 0 && (
        <Box>
          <Typography variant="overline" color="text.secondary">
            {t('orgChart.details.incumbents', { count: position.incumbentPersonIds.length })}
          </Typography>
          {position.incumbentPersonIds.map((personId) => (
            <PersonLink key={personId} personId={personId} chart={chart} onSelect={onSelect} />
          ))}
        </Box>
      )}

      {parent && (
        <Box>
          <Typography variant="overline" color="text.secondary">
            {t('orgChart.details.reportsToPosition')}
          </Typography>
          <PositionLink positionId={parent.positionId} chart={chart} onSelect={onSelect} />
        </Box>
      )}

      {subordinates.length > 0 && (
        <Box>
          <Typography variant="overline" color="text.secondary">
            {t('orgChart.details.subordinatePositions', { count: subordinates.length })}
          </Typography>
          {subordinates.map((subordinate) => (
            <PositionLink
              key={subordinate.positionId}
              positionId={subordinate.positionId}
              chart={chart}
              onSelect={onSelect}
            />
          ))}
        </Box>
      )}
    </Stack>
  );
}

function PositionLink({
  positionId,
  chart,
  onSelect,
}: {
  positionId: string;
  chart: OrganizationChart;
  onSelect: (selection: OrgChartSelection) => void;
}) {
  const { t } = useTranslation('admin');
  const position = chart.positions.find((candidate) => candidate.positionId === positionId);
  if (!position) return null;
  return (
    <ButtonBase
      onClick={() => onSelect({ kind: 'position', id: position.positionId })}
      sx={{
        width: 1,
        minHeight: 50,
        px: 1,
        py: 0.75,
        justifyContent: 'flex-start',
        borderRadius: 1,
        textAlign: 'left',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <BriefcaseBusiness size={17} />
      <Box sx={{ ml: 1, minWidth: 0, flex: 1 }}>
        <Typography variant="body2" fontWeight={650} noWrap>
          {position.title}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" noWrap>
          {position.positionKey} ·{' '}
          {t(`orgChart.positionStatus.${position.status}`, { defaultValue: position.status })}
        </Typography>
      </Box>
      <ExternalLink size={14} />
    </ButtonBase>
  );
}
