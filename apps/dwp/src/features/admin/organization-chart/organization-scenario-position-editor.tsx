import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  addOrganizationScenarioPositionMove,
  closeOrganizationScenarioPosition,
  createOrganizationScenarioPosition,
  getSystemCodeSet,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import type { OrganizationChart, OrganizationScenario } from '@dwp-frontend/shared-utils';

type PositionAction = 'move' | 'create' | 'close';
type PositionType = 'REGULAR' | 'SHARED' | 'ASSISTANT' | 'TEMPORARY';
type PositionCriticality = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const POSITION_TYPES: PositionType[] = ['REGULAR', 'SHARED', 'ASSISTANT', 'TEMPORARY'];
const POSITION_CRITICALITIES: PositionCriticality[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function isPositionType(value: string): value is PositionType {
  return POSITION_TYPES.includes(value as PositionType);
}

function isPositionCriticality(value: string): value is PositionCriticality {
  return POSITION_CRITICALITIES.includes(value as PositionCriticality);
}

type Props = {
  chart: OrganizationChart;
  scenario: OrganizationScenario;
  busy: boolean;
  execute: (
    operation: () => Promise<OrganizationScenario>,
    successMessage: string
  ) => Promise<OrganizationScenario | undefined>;
};

function plannedPositionKey(): string {
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
  return `PLAN-${date}-${suffix}`;
}

export function OrganizationScenarioPositionEditor({ chart, scenario, busy, execute }: Props) {
  const { t, i18n } = useTranslation('admin');
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const positionTypeCatalog = useQuery({
    queryKey: ['system-code-set', 'PEOPLE.POSITION_TYPE', locale],
    queryFn: () => getSystemCodeSet('PEOPLE.POSITION_TYPE', locale),
    staleTime: 5 * 60 * 1000,
  });
  const criticalityCatalog = useQuery({
    queryKey: ['system-code-set', 'PEOPLE.POSITION_CRITICALITY', locale],
    queryFn: () => getSystemCodeSet('PEOPLE.POSITION_CRITICALITY', locale),
    staleTime: 5 * 60 * 1000,
  });
  const positionTypeOptions = useMemo(
    () =>
      positionTypeCatalog.data?.values.filter((value) => isPositionType(value.code)) ??
      POSITION_TYPES.map((code) => ({ code, label: t(`orgChart.positionTypes.${code}`) })),
    [positionTypeCatalog.data, t]
  );
  const criticalityOptions = useMemo(
    () =>
      criticalityCatalog.data?.values.filter((value) => isPositionCriticality(value.code)) ??
      POSITION_CRITICALITIES.map((code) => ({ code, label: t(`orgChart.criticality.${code}`) })),
    [criticalityCatalog.data, t]
  );
  const [action, setAction] = useState<PositionAction>('move');
  const [positionId, setPositionId] = useState('');
  const [parentPositionId, setParentPositionId] = useState('');
  const [positionKey, setPositionKey] = useState(plannedPositionKey);
  const [title, setTitle] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [positionType, setPositionType] = useState<PositionType>('REGULAR');
  const [criticality, setCriticality] = useState<PositionCriticality>('MEDIUM');
  const [budgetedFte, setBudgetedFte] = useState('1');
  const [annualCostAmount, setAnnualCostAmount] = useState('');
  const [costCurrency, setCostCurrency] = useState('KRW');
  const [availabilityDate, setAvailabilityDate] = useState(scenario.effectiveDate);

  useEffect(() => {
    setAvailabilityDate(scenario.effectiveDate);
  }, [scenario.effectiveDate]);

  const disallowedParentIds = useMemo(() => {
    if (!positionId) return new Set<string>();
    const children = new Map<string, string[]>();
    chart.positions.forEach((position) => {
      if (!position.reportsToPositionId) return;
      children.set(position.reportsToPositionId, [
        ...(children.get(position.reportsToPositionId) ?? []),
        position.positionId,
      ]);
    });
    const result = new Set<string>();
    const queue = [positionId];
    while (queue.length) {
      const current = queue.shift();
      if (!current || result.has(current)) continue;
      result.add(current);
      queue.push(...(children.get(current) ?? []));
    }
    return result;
  }, [chart.positions, positionId]);

  const moveParents = chart.positions.filter(
    (position) => !disallowedParentIds.has(position.positionId)
  );
  const closablePositions = chart.positions.filter(
    (position) =>
      position.status === 'OPEN' &&
      position.incumbentPersonIds.length === 0 &&
      position.subordinatePositionCount === 0
  );

  const handleMove = async () => {
    if (!positionId || !parentPositionId) return;
    const next = await execute(
      () => addOrganizationScenarioPositionMove(scenario, positionId, parentPositionId),
      t('orgChart.scenarios.messages.positionMoveAdded')
    );
    if (!next) return;
    setPositionId('');
    setParentPositionId('');
  };

  const handleCreate = async () => {
    const fte = Number(budgetedFte);
    const cost = annualCostAmount.trim() ? Number(annualCostAmount) : undefined;
    if (!title.trim() || !positionKey.trim() || !organizationId || !parentPositionId) return;
    const next = await execute(
      () =>
        createOrganizationScenarioPosition(scenario, {
          positionKey: positionKey.trim().toUpperCase(),
          title: title.trim(),
          organizationId,
          reportsToPositionId: parentPositionId,
          positionType,
          criticality,
          budgetedFte: fte,
          annualCostAmount: cost,
          costCurrency: cost === undefined ? undefined : costCurrency,
          availabilityDate,
        }),
      t('orgChart.scenarios.messages.positionCreated')
    );
    if (!next) return;
    setPositionKey(plannedPositionKey());
    setTitle('');
    setOrganizationId('');
    setParentPositionId('');
  };

  const handleClose = async () => {
    if (!positionId) return;
    const next = await execute(
      () => closeOrganizationScenarioPosition(scenario, positionId),
      t('orgChart.scenarios.messages.positionClosed')
    );
    if (next) setPositionId('');
  };

  return (
    <Stack gap={1.25}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={action}
        fullWidth
        aria-label={t('orgChart.scenarios.positionPlan.actionLabel')}
        onChange={(_event, value: PositionAction | null) => {
          if (!value) return;
          setAction(value);
          setPositionId('');
          setParentPositionId('');
        }}
      >
        <ToggleButton value="move">{t('orgChart.scenarios.positionPlan.move')}</ToggleButton>
        <ToggleButton value="create">{t('orgChart.scenarios.positionPlan.create')}</ToggleButton>
        <ToggleButton value="close">{t('orgChart.scenarios.positionPlan.close')}</ToggleButton>
      </ToggleButtonGroup>

      {action === 'move' && (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
          <PositionSelect
            label={t('orgChart.scenarios.move.position')}
            value={positionId}
            positions={chart.positions}
            onChange={setPositionId}
          />
          <PositionSelect
            label={t('orgChart.scenarios.move.newParentPosition')}
            value={parentPositionId}
            positions={moveParents}
            disabled={!positionId}
            onChange={setParentPositionId}
          />
          <Button
            variant="outlined"
            disabled={busy || !positionId || !parentPositionId}
            onClick={() => void handleMove()}
            sx={{ minWidth: 92 }}
          >
            {t('orgChart.scenarios.move.add')}
          </Button>
        </Stack>
      )}

      {action === 'create' && (
        <Stack gap={1.25}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
            <TextField
              required
              size="small"
              label={t('orgChart.scenarios.positionPlan.positionKey')}
              value={positionKey}
              onChange={(event) => setPositionKey(event.target.value.toUpperCase())}
            />
            <TextField
              required
              size="small"
              label={t('orgChart.scenarios.positionPlan.title')}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <TextField
              required
              select
              size="small"
              label={t('orgChart.scenarios.positionPlan.organization')}
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
            >
              {chart.organizations.map((organization) => (
                <MenuItem key={organization.organizationId} value={organization.organizationId}>
                  {organization.name}
                </MenuItem>
              ))}
            </TextField>
            <PositionSelect
              label={t('orgChart.scenarios.positionPlan.reportsTo')}
              value={parentPositionId}
              positions={chart.positions}
              onChange={(value) => {
                setParentPositionId(value);
                const parent = chart.positions.find((position) => position.positionId === value);
                if (parent) setOrganizationId(parent.organizationId);
              }}
            />
            <TextField
              select
              size="small"
              label={t('orgChart.scenarios.positionPlan.positionType')}
              value={positionType}
              onChange={(event) => setPositionType(event.target.value as typeof positionType)}
            >
              {positionTypeOptions.map((value) => (
                <MenuItem key={value.code} value={value.code}>
                  {value.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label={t('orgChart.scenarios.positionPlan.criticality')}
              value={criticality}
              onChange={(event) => setCriticality(event.target.value as typeof criticality)}
            >
              {criticalityOptions.map((value) => (
                <MenuItem key={value.code} value={value.code}>
                  {value.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              required
              size="small"
              type="number"
              label={t('orgChart.scenarios.positionPlan.fte')}
              value={budgetedFte}
              inputProps={{ min: 0.1, max: 10, step: 0.1 }}
              onChange={(event) => setBudgetedFte(event.target.value)}
            />
            <TextField
              size="small"
              type="number"
              label={t('orgChart.scenarios.positionPlan.annualCost')}
              value={annualCostAmount}
              inputProps={{ min: 0, step: 1000000 }}
              onChange={(event) => setAnnualCostAmount(event.target.value)}
            />
            <TextField
              size="small"
              label={t('orgChart.scenarios.positionPlan.currency')}
              value={costCurrency}
              inputProps={{ maxLength: 3 }}
              onChange={(event) => setCostCurrency(event.target.value.toUpperCase())}
            />
            <TextField
              required
              size="small"
              type="date"
              label={t('orgChart.scenarios.positionPlan.availabilityDate')}
              value={availabilityDate}
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: scenario.effectiveDate }}
              onChange={(event) => setAvailabilityDate(event.target.value)}
            />
          </Box>
          <Stack direction="row" justifyContent="flex-end">
            <Button
              variant="outlined"
              disabled={
                busy ||
                !title.trim() ||
                !positionKey.trim() ||
                !organizationId ||
                !parentPositionId ||
                !availabilityDate ||
                Number(budgetedFte) < 0.1 ||
                Number(budgetedFte) > 10 ||
                (Boolean(annualCostAmount.trim()) && costCurrency.length !== 3)
              }
              onClick={() => void handleCreate()}
            >
              {t('orgChart.scenarios.positionPlan.addCreate')}
            </Button>
          </Stack>
        </Stack>
      )}

      {action === 'close' && (
        <Stack gap={1}>
          <Alert severity="warning">{t('orgChart.scenarios.positionPlan.closeGuard')}</Alert>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            <PositionSelect
              label={t('orgChart.scenarios.positionPlan.positionToClose')}
              value={positionId}
              positions={closablePositions}
              onChange={setPositionId}
            />
            <Button
              color="error"
              variant="outlined"
              disabled={busy || !positionId}
              onClick={() => void handleClose()}
              sx={{ minWidth: 92 }}
            >
              {t('orgChart.scenarios.positionPlan.addClose')}
            </Button>
          </Stack>
          {!closablePositions.length && (
            <Typography variant="caption" color="text.secondary">
              {t('orgChart.scenarios.positionPlan.noClosablePositions')}
            </Typography>
          )}
        </Stack>
      )}
    </Stack>
  );
}

function PositionSelect({
  label,
  value,
  positions,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  positions: OrganizationChart['positions'];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <TextField
      select
      fullWidth
      size="small"
      disabled={disabled}
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {positions.map((position) => (
        <MenuItem key={position.positionId} value={position.positionId}>
          {position.title} · {position.positionKey}
        </MenuItem>
      ))}
    </TextField>
  );
}
