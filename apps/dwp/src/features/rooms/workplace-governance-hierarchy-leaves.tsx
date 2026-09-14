import type { ChangeEvent, ReactNode } from 'react';
import type { TFunction } from 'i18next';
import type {
  WorkplaceResource,
  WorkplaceGovernanceCampusInput,
  WorkplaceGovernanceSpatialState,
  WorkplaceGovernanceZoneType,
} from '@dwp-frontend/shared-utils';
import { EmptyState, FormField, SelectField } from '@dwp-frontend/design-system';
import { Building2 } from 'lucide-react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  GovernancePanel,
  GovernanceLoading,
  GovernanceQueryError,
} from './workplace-admin-governance-ui';
type InputChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
export function jsonObject(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
export function SelectableRow({
  selected,
  icon,
  title,
  detail,
  trailing,
  onClick,
  renderTitle,
}: {
  renderTitle: (title: string) => ReactNode;
  selected: boolean;
  icon: ReactNode;
  title: string;
  detail: string;
  trailing?: ReactNode;
  onClick?: () => void;
}) {
  const interactive = Boolean(onClick);
  return (
    <Box sx={{ position: 'relative', borderBottom: 1, borderColor: 'divider' }}>
      <Box
        component={interactive ? 'button' : 'div'}
        type={interactive ? 'button' : undefined}
        aria-pressed={interactive ? selected : undefined}
        onClick={onClick}
        sx={{
          width: '100%',
          minHeight: 68,
          p: 1.25,
          pr: trailing ? 6 : 1.25,
          border: 0,
          bgcolor: selected ? 'var(--dwp-product-selection)' : 'transparent',
          color: 'text.primary',
          cursor: interactive ? 'pointer' : 'default',
          font: 'inherit',
          textAlign: 'left',
          display: 'grid',
          gridTemplateColumns: '32px minmax(0, 1fr)',
          gap: 1,
          alignItems: 'center',
        }}
      >
        <Box
          aria-hidden="true"
          sx={{
            width: 32,
            height: 32,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'var(--dwp-product-soft)',
            color: 'var(--dwp-product-accent)',
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          {renderTitle(title)}
          <Typography variant="caption" color="text.secondary" noWrap>
            {detail}
          </Typography>
        </Box>
      </Box>
      {trailing ? (
        <Box sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}>
          {trailing}
        </Box>
      ) : null}
    </Box>
  );
}
export function HierarchyResourcePanel({
  t,
  loading,
  failed,
  hasResources,
  resources,
  retry,
  renderName,
}: {
  t: TFunction<'rooms'>;
  loading: boolean;
  failed: boolean;
  hasResources: boolean | undefined;
  resources: WorkplaceResource[];
  retry: () => void;
  renderName: (resource: WorkplaceResource) => ReactNode;
}) {
  return (
    <GovernancePanel
      title={t('workplace.admin.governance.hierarchy.resources')}
      description={t('workplace.admin.governance.hierarchy.resourceDescription')}
    >
      {loading ? (
        <GovernanceLoading rows={2} />
      ) : failed ? (
        <GovernanceQueryError retry={retry} />
      ) : hasResources ? (
        <Stack divider={<Divider flexItem />}>
          {resources.map((resource) => (
            <Stack
              key={resource.resourceId}
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              gap={1}
              sx={{ px: 1.5, py: 1.1 }}
            >
              <Box sx={{ minWidth: 0 }}>
                {renderName(resource)}
                <Typography variant="caption" color="text.secondary">
                  {resource.code} · {resource.type}
                </Typography>
              </Box>
              <Chip size="small" variant="outlined" label={resource.state} />
            </Stack>
          ))}
        </Stack>
      ) : (
        <EmptyState
          size="compact"
          icon={<Building2 size={24} />}
          title={t('workplace.admin.governance.hierarchy.emptyResources')}
          description={t('workplace.admin.governance.hierarchy.emptyResourcesDescription')}
        />
      )}
    </GovernancePanel>
  );
}
export function HierarchyCampusFields({
  t,
  form,
  onCodeChange,
  onNameKoChange,
  onNameEnChange,
  onStateChange,
}: {
  t: TFunction<'rooms'>;
  form: WorkplaceGovernanceCampusInput;
  onCodeChange: InputChange;
  onNameKoChange: InputChange;
  onNameEnChange: InputChange;
  onStateChange: (value: string) => void;
}) {
  return (
    <Stack spacing={2}>
      <FormField
        required
        label={t('workplace.admin.governance.fields.code')}
        value={form.code}
        onChange={onCodeChange}
      />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        <FormField
          required
          label={t('workplace.admin.governance.fields.nameKo')}
          value={form.nameKo}
          onChange={onNameKoChange}
        />
        <FormField
          required
          label={t('workplace.admin.governance.fields.nameEn')}
          value={form.nameEn}
          onChange={onNameEnChange}
        />
      </Box>
      <SelectField
        label={t('workplace.admin.governance.fields.state')}
        value={form.state}
        options={(['ACTIVE', 'MAINTENANCE', 'CLOSED'] as const).map((value) => ({
          value,
          label: t(`workplace.admin.governance.states.${value}`),
        }))}
        onValueChange={onStateChange}
      />
    </Stack>
  );
}
export function HierarchySpatialFields({
  t,
  kind,
  code,
  nameKo,
  nameEn,
  state,
  type,
  boundary,
  parsedBoundary,
  onCodeChange,
  onTypeChange,
  onNameKoChange,
  onNameEnChange,
  onStateChange,
  onBoundaryChange,
}: {
  t: TFunction<'rooms'>;
  kind: 'zone' | 'section';
  code: string;
  nameKo: string;
  nameEn: string;
  state: WorkplaceGovernanceSpatialState;
  type: WorkplaceGovernanceZoneType;
  boundary: string;
  parsedBoundary: Record<string, unknown> | null;
  onCodeChange: InputChange;
  onNameKoChange: InputChange;
  onNameEnChange: InputChange;
  onBoundaryChange: InputChange;
  onTypeChange: (value: string) => void;
  onStateChange: (value: string) => void;
}) {
  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '0.8fr 1fr' }, gap: 1.5 }}>
        <FormField
          required
          label={t('workplace.admin.governance.fields.code')}
          value={code}
          onChange={onCodeChange}
        />
        {kind === 'zone' ? (
          <SelectField
            label={t('workplace.admin.governance.fields.zoneType')}
            value={type}
            options={(
              ['GENERAL', 'WORK_AREA', 'COLLABORATION', 'QUIET', 'SERVICE', 'RESTRICTED'] as const
            ).map((value) => ({
              value,
              label: t(`workplace.admin.governance.zoneTypes.${value}`),
            }))}
            onValueChange={onTypeChange}
          />
        ) : null}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        <FormField
          required
          label={t('workplace.admin.governance.fields.nameKo')}
          value={nameKo}
          onChange={onNameKoChange}
        />
        <FormField
          required
          label={t('workplace.admin.governance.fields.nameEn')}
          value={nameEn}
          onChange={onNameEnChange}
        />
      </Box>
      <SelectField
        label={t('workplace.admin.governance.fields.state')}
        value={state}
        options={(['ACTIVE', 'MAINTENANCE', 'CLOSED'] as const).map((value) => ({
          value,
          label: t(`workplace.admin.governance.states.${value}`),
        }))}
        onValueChange={onStateChange}
      />
      <FormField
        required
        multiline
        minRows={4}
        label={t('workplace.admin.governance.fields.boundary')}
        value={boundary}
        errorMessage={
          !parsedBoundary ? t('workplace.admin.governance.fields.invalidJson') : undefined
        }
        onChange={onBoundaryChange}
      />
    </Stack>
  );
}
