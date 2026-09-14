import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionButton, foundationTokens, ProgressMeter } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function WorkplaceAdminSection({
  title,
  description,
  children,
  actions,
  tone = 'paper',
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  tone?: 'paper' | 'soft';
}) {
  const id = useId();
  return (
    <Box
      component="section"
      aria-labelledby={id}
      sx={{
        minWidth: 0,
        bgcolor: tone === 'soft' ? 'var(--dwp-product-soft)' : 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.radius.control + 'px',
        p: { xs: 1.5, md: 2 },
      }}
    >
      <Stack
        direction="row"
        gap={1}
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        sx={{ mb: 1.5 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography id={id} variant="subtitle1" component="h2" fontWeight="fontWeightBold">
            {title}
          </Typography>
          {description && (
            <Typography variant="caption" color="text.secondary">
              {description}
            </Typography>
          )}
        </Box>
        {actions}
      </Stack>
      {children}
    </Box>
  );
}

export function WorkplaceAdminMetric({
  label,
  value,
  icon: Icon,
  detail,
  tone = 'primary',
  onClick,
}: {
  label: string;
  value: number | string | null;
  icon: LucideIcon;
  detail?: string;
  tone?: 'primary' | 'secondary' | 'error' | 'warning';
  onClick?: () => void;
}) {
  const { t } = useTranslation('rooms');
  return (
    <Box
      sx={{
        minWidth: 0,
        p: { xs: 1.5, md: 1.75 },
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.radius.control + 'px',
        bgcolor: 'background.paper',
        borderTop: 3,
        borderTopColor: `${tone}.main`,
      }}
    >
      <Stack direction="row" gap={1} justifyContent="space-between" alignItems="start">
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Box
          sx={{
            p: 0.65,
            display: 'flex',
            borderRadius: foundationTokens.radius.compact + 'px',
            bgcolor: (theme) => alpha(theme.palette[tone].main, 0.1),
            color: `${tone}.main`,
          }}
        >
          <Icon size={16} aria-hidden="true" />
        </Box>
      </Stack>
      <Typography
        variant="h4"
        color={`${tone}.main`}
        fontWeight="fontWeightBold"
        sx={{ mt: 0.5, fontVariantNumeric: 'tabular-nums' }}
      >
        {value ?? t('workplace.experience.unavailable')}
      </Typography>
      {detail && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {detail}
        </Typography>
      )}
      {onClick && (
        <ActionButton
          intent="quiet"
          onClick={onClick}
          sx={{ px: 0, justifyContent: 'start', mt: 0.5 }}
        >
          {t('workplace.experience.review')}
        </ActionButton>
      )}
    </Box>
  );
}

export function WorkplaceAdminFloorRows({
  floors,
  selectedFloorId,
  onSelect,
}: {
  floors: {
    floorId: string;
    floorName: string;
    resourceCount: number;
    summary: { utilizationPercent: number | null; bookingCount: number; noShowCount: number };
  }[];
  selectedFloorId?: string;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation('rooms');
  return (
    <Stack gap={0.5}>
      {floors.map((floor) => (
        <Box
          key={floor.floorId}
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr) auto',
              md: 'minmax(100px, 1fr) auto minmax(140px, 1.7fr) auto',
            },
            alignItems: 'center',
            columnGap: 2,
            rowGap: 0.5,
            py: 1,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Box>
            <ActionButton
              intent={selectedFloorId === floor.floorId ? 'secondary' : 'quiet'}
              onClick={() => onSelect(floor.floorId)}
              sx={{ px: 0.5, justifyContent: 'start' }}
            >
              {floor.floorName}
            </ActionButton>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {t('workplace.experience.resourceCount', { count: floor.resourceCount })}
            </Typography>
          </Box>
          <Typography
            variant="body2"
            fontWeight="fontWeightBold"
            sx={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {floor.summary.bookingCount}{' '}
            <Typography component="span" variant="caption" color="text.secondary">
              {t('workplace.experience.totalBookings')}
            </Typography>
          </Typography>
          <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' }, minWidth: 0 }}>
            {floor.summary.utilizationPercent === null ? (
              <Typography variant="caption">{t('workplace.experience.unavailable')}</Typography>
            ) : (
              <ProgressMeter
                label={t('workplace.experience.utilization')}
                value={floor.summary.utilizationPercent}
                valueLabel={`${floor.summary.utilizationPercent.toFixed(1)}%`}
              />
            )}
          </Box>
          <Typography
            variant="caption"
            color={floor.summary.noShowCount ? 'warning.main' : 'text.secondary'}
          >
            {t('workplace.experience.noShow')}: {floor.summary.noShowCount}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}
