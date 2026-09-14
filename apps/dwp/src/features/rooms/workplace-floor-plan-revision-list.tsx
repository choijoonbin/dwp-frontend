import { ArchiveRestore, CheckCheck, FileStack, Pencil, Send } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { workplaceGovernanceRevisionActions } from './workplace-admin-governance-model';
import type { ReactNode } from 'react';
import type { TFunction } from 'i18next';
import type {
  WorkplaceGovernanceFloorPlanRevision,
  WorkplaceGovernanceRevisionState,
} from '@dwp-frontend/shared-utils';
type Props = {
  t: TFunction<'rooms'>;
  revisions: readonly WorkplaceGovernanceFloorPlanRevision[];
  canAct: boolean;
  formatInstant: (value: string | null) => string;
  renderRevisionNumber: (revision: WorkplaceGovernanceFloorPlanRevision) => ReactNode;
  onEdit: (revisionId: string) => void;
  onTransition: (
    revision: WorkplaceGovernanceFloorPlanRevision,
    action: 'REVIEW' | 'PUBLISH' | 'RESTORE'
  ) => void;
};
function revisionColor(state: WorkplaceGovernanceRevisionState) {
  if (state === 'PUBLISHED') return 'success';
  if (state === 'REVIEW') return 'warning';
  if (state === 'DRAFT') return 'info';
  return 'default';
}
export function WorkplaceFloorPlanRevisionList({
  t,
  revisions,
  canAct,
  formatInstant,
  renderRevisionNumber,
  onEdit,
  onTransition,
}: Props) {
  return (
    <Stack divider={<Divider flexItem />}>
      {revisions.map((revision) => (
        <Stack
          key={revision.revisionId}
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
          gap={1.25}
          sx={{ px: 1.5, py: 1.25 }}
        >
          <Stack direction="row" gap={1.25} alignItems="flex-start" sx={{ minWidth: 0 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                flex: '0 0 auto',
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'var(--dwp-product-soft)',
                color: 'var(--dwp-product-accent)',
              }}
            >
              <FileStack size={18} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" gap={0.7} alignItems="center" flexWrap="wrap">
                {renderRevisionNumber(revision)}
                <Chip
                  size="small"
                  color={revisionColor(revision.state)}
                  variant="outlined"
                  label={t(`workplace.admin.governance.revisionStates.${revision.state}`)}
                />
              </Stack>
              <Typography variant="body2" noWrap>
                {revision.changeSummary}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('workplace.admin.governance.floorPlans.placementCount', {
                  count: revision.placementCount,
                })}{' '}
                · {revision.planWidth} × {revision.planHeight} ·{' '}
                {formatInstant(revision.publishedAt ?? revision.submittedAt)}
              </Typography>
            </Box>
          </Stack>
          {canAct ? (
            <Stack direction="row" gap={0.75} flexWrap="wrap">
              {revision.state === 'DRAFT' ? (
                <ActionButton
                  intent="secondary"
                  startIcon={<Pencil size={15} />}
                  onClick={() => onEdit(revision.revisionId)}
                >
                  {t('workplace.admin.governance.floorPlans.editDraft')}
                </ActionButton>
              ) : null}
              {workplaceGovernanceRevisionActions(revision).map((action) => (
                <ActionButton
                  key={action}
                  intent={action === 'PUBLISH' ? 'primary' : 'secondary'}
                  startIcon={
                    action === 'REVIEW' ? (
                      <Send size={15} />
                    ) : action === 'PUBLISH' ? (
                      <CheckCheck size={15} />
                    ) : (
                      <ArchiveRestore size={15} />
                    )
                  }
                  onClick={() => onTransition(revision, action)}
                >
                  {t(`workplace.admin.governance.floorPlans.actions.${action}`)}
                </ActionButton>
              ))}
            </Stack>
          ) : null}
        </Stack>
      ))}
    </Stack>
  );
}
