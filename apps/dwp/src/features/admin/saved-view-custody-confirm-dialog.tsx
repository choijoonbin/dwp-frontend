import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { countSavedViewScopes } from './saved-view-custody-model';
import { displayDate, userIdentityLabel } from './saved-view-custody-ui';

import type {
  SavedViewCustodyUser,
  SavedViewOwnershipDisposition,
  SavedViewOwnershipPreview,
  SavedViewOwnershipReason,
} from '@dwp-frontend/shared-utils';

export function SavedViewCustodyConfirmDialog({
  open,
  preview,
  disposition,
  sourceOwner,
  targetOwner,
  retentionUntil,
  reasonCode,
  reason,
  sourceReference,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  preview: SavedViewOwnershipPreview | null;
  disposition: SavedViewOwnershipDisposition;
  sourceOwner: SavedViewCustodyUser | null;
  targetOwner: SavedViewCustodyUser | null;
  retentionUntil: string | null;
  reasonCode: SavedViewOwnershipReason;
  reason: string;
  sourceReference: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const scopeCounts = countSavedViewScopes(preview?.views ?? []);
  const teamGroups = Array.from(
    new Set(
      (preview?.views ?? [])
        .filter((view) => view.scope === 'TEAM')
        .map((view) => view.ownerGroupRef?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );
  const title =
    disposition === 'TRANSFER'
      ? t('savedViewCustody.confirm.transferTitle', {
          count: preview?.affectedCount ?? 0,
        })
      : t('savedViewCustody.confirm.suspendTitle', {
          count: preview?.affectedCount ?? 0,
        });
  const executeLabel =
    disposition === 'TRANSFER'
      ? t('savedViewCustody.actions.transfer', {
          count: preview?.affectedCount ?? 0,
          name: targetOwner?.displayName ?? '',
        })
      : t('savedViewCustody.actions.suspend', {
          count: preview?.affectedCount ?? 0,
        });

  return (
    <ConfirmDialog
      open={open}
      title={title}
      description={t(
        disposition === 'TRANSFER'
          ? 'savedViewCustody.confirm.transferDescription'
          : 'savedViewCustody.confirm.suspendDescription'
      )}
      cancelLabel={t('savedViewCustody.actions.cancel')}
      confirmLabel={executeLabel}
      confirmingLabel={t('savedViewCustody.actions.executing')}
      busy={busy}
      intent="primary"
      onClose={onClose}
      onConfirm={onConfirm}
      details={
        preview ? (
          <Stack
            component="dl"
            gap={1.25}
            sx={{
              m: 0,
              p: 1.5,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <Box component="div">
              <Typography component="dt" variant="caption" color="text.secondary">
                {t('savedViewCustody.confirm.ownerChange')}
              </Typography>
              <Typography component="dd" variant="body2" fontWeight={700} sx={{ m: 0 }}>
                {sourceOwner ? userIdentityLabel(sourceOwner) : '-'} {' → '}
                {disposition === 'TRANSFER'
                  ? targetOwner
                    ? userIdentityLabel(targetOwner)
                    : '-'
                  : t('savedViewCustody.confirm.noOwner')}
              </Typography>
            </Box>
            <Box component="div">
              <Typography component="dt" variant="caption" color="text.secondary">
                {t('savedViewCustody.confirm.scope')}
              </Typography>
              <Typography component="dd" variant="body2" sx={{ m: 0 }}>
                {t('savedViewCustody.confirm.scopeSummary', {
                  total: preview.affectedCount,
                  personal: scopeCounts.PERSONAL,
                  team: scopeCounts.TEAM,
                  tenant: scopeCounts.TENANT,
                })}
              </Typography>
            </Box>
            {teamGroups.length > 0 && (
              <Box component="div">
                <Typography component="dt" variant="caption" color="text.secondary">
                  {t('savedViewCustody.confirm.teamGroups')}
                </Typography>
                <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
                  {teamGroups.join(', ')}
                </Typography>
              </Box>
            )}
            {disposition === 'RETAIN_ORPHANED' && (
              <Box component="div">
                <Typography component="dt" variant="caption" color="text.secondary">
                  {t('savedViewCustody.confirm.archiveDate')}
                </Typography>
                <Typography component="dd" variant="body2" fontWeight={700} sx={{ m: 0 }}>
                  {displayDate(retentionUntil)}
                </Typography>
              </Box>
            )}
            <Box component="div">
              <Typography component="dt" variant="caption" color="text.secondary">
                {t('savedViewCustody.confirm.reasonType')}
              </Typography>
              <Typography component="dd" variant="body2" sx={{ m: 0 }}>
                {t('savedViewCustody.reasons.' + reasonCode)}
              </Typography>
            </Box>
            <Box component="div">
              <Typography component="dt" variant="caption" color="text.secondary">
                {t('savedViewCustody.confirm.sourceReference')}
              </Typography>
              <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
                {sourceReference.trim()}
              </Typography>
            </Box>
            <Box component="div">
              <Typography component="dt" variant="caption" color="text.secondary">
                {t('savedViewCustody.confirm.administratorNote')}
              </Typography>
              <Typography
                component="dd"
                variant="body2"
                sx={{ m: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
              >
                {reason.trim()}
              </Typography>
            </Box>
          </Stack>
        ) : null
      }
    />
  );
}
