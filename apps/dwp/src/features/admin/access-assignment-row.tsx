import { useTranslation } from 'react-i18next';
import { formatDate, resolveSupportedLocale, useRoleDisplay } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { IdentityEffectiveAccess } from '@dwp-frontend/shared-utils';

import { projectionScopeLabelKey } from './tenant-access-projection-model';

function dateTime(value: string, locale: string): string {
  return formatDate(
    value,
    { dateStyle: 'medium', timeStyle: 'short' },
    resolveSupportedLocale(locale)
  );
}

const SOURCE_TYPE_LABEL_KEYS: Record<string, string> = {
  DIRECT: 'access.sources.direct',
  GROUP: 'access.sources.group',
  PRIVILEGED: 'access.sources.privileged',
  APP_ACCESS_REQUEST: 'access.sources.app_access_request',
  ADMIN_DIRECT: 'access.sources.admin_direct',
  ACCESS_PACKAGE: 'access.sources.access_package',
};

function sourceTypeLabelKey(sourceType: string): string {
  return SOURCE_TYPE_LABEL_KEYS[sourceType] ?? 'access.sources.unknown';
}

export function AccessAssignmentRow({
  assignment,
  locale,
}: {
  assignment: IdentityEffectiveAccess;
  locale: string;
}) {
  const { t } = useTranslation('admin');
  const roleDisplay = useRoleDisplay();
  const roleName = roleDisplay(
    assignment.roleCode,
    assignment.roleName?.trim() || t('access.unknownRole')
  ).name;
  const sourceType = t(sourceTypeLabelKey(assignment.sourceType));
  const source = assignment.sourceName?.trim() || sourceType;
  const validity = assignment.validTo
    ? t('access.inspector.validUntil', { date: dateTime(assignment.validTo, locale) })
    : t('access.inspector.noExpiry');

  return (
    <Box sx={{ py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
            <Typography variant="body2" fontWeight={700}>
              {roleName}
            </Typography>
            {assignment.privileged && (
              <Chip
                size="small"
                color="warning"
                variant="outlined"
                label={t('access.inspector.privileged')}
              />
            )}
          </Stack>
        </Box>
        <Chip
          size="small"
          color={assignment.sourceType === 'GROUP' ? 'info' : 'default'}
          variant="outlined"
          label={sourceType}
        />
      </Stack>
      <Stack gap={0.35} sx={{ mt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {t('access.inspector.sourceValue', { source })}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('access.inspector.scopeValue', {
            scope: t(projectionScopeLabelKey(assignment.scopeType)),
          })}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {validity}
        </Typography>
      </Stack>
    </Box>
  );
}
