import { useTranslation } from 'react-i18next';
import { BriefcaseBusiness, IdCard, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import {
  ActionButton,
  DetailInspector,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { HcmQueryState } from '../../../../components/hcm-query-state';
import { getPeople360Copy } from '../model/people-360-copy';
import { people360Decision } from '../model/people-360-view-model';

import type { LucideIcon } from 'lucide-react';
import type {
  People360DetailPresentation,
  People360DetailView,
  People360Field,
} from '../model/people-360-view-model';

function ProjectedFact({
  profile,
  field,
  label,
  value,
}: {
  profile: People360DetailView;
  field: People360Field;
  label: string;
  value?: string | null;
}) {
  const { i18n } = useTranslation();
  const copy = getPeople360Copy(i18n.resolvedLanguage, i18n.language);
  const decision = people360Decision(profile, field);
  if (decision === 'OMIT') return null;
  return (
    <Box minWidth={0} data-field={field} data-field-decision={decision}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap" useFlexGap>
        <Typography variant="body2" sx={{ mt: 0.25, overflowWrap: 'anywhere' }}>
          {value || copy.notAvailable}
        </Typography>
        {decision === 'MASK' && (
          <Chip size="small" color="warning" variant="outlined" label={copy.masked} />
        )}
      </Stack>
    </Box>
  );
}

function DetailSection({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Stack component="section" gap={1.25}>
      <Stack direction="row" gap={0.75} alignItems="center">
        <Icon size={17} aria-hidden="true" />
        <Typography component="h3" variant="subtitle2">
          {title}
        </Typography>
      </Stack>
      {children}
    </Stack>
  );
}

function FactGrid({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
        gap: 1.5,
        minWidth: 0,
      }}
    >
      {children}
    </Box>
  );
}

function People360ProjectionDetail({ profile }: { profile: People360DetailView }) {
  const { i18n } = useTranslation();
  const copy = getPeople360Copy(i18n.resolvedLanguage, i18n.language);
  const employment = profile.employment;
  const assignment = profile.primaryAssignment;
  const decisions = profile.access.fieldDecisions;
  const counts = {
    view: decisions.filter((item) => item.decision === 'VIEW').length,
    mask: decisions.filter((item) => item.decision === 'MASK').length,
    omit: decisions.filter((item) => item.decision === 'OMIT').length,
  };

  return (
    <Stack gap={2} divider={<Divider flexItem />}>
      {profile.state === 'PARTIAL' && (
        <InlineFeedback severity="warning" title={copy.partialTitle}>
          {copy.partialDescription}
        </InlineFeedback>
      )}

      <DetailSection icon={UserRound} title={copy.personSection}>
        <FactGrid>
          <ProjectedFact
            profile={profile}
            field="person.displayName"
            label={copy.displayName}
            value={profile.person.displayName}
          />
          <ProjectedFact
            profile={profile}
            field="person.lifecycleState"
            label={copy.lifecycleState}
            value={profile.person.lifecycleState}
          />
          <ProjectedFact
            profile={profile}
            field="person.preferredLocale"
            label={copy.preferredLocale}
            value={profile.person.preferredLocale}
          />
          <ProjectedFact
            profile={profile}
            field="person.timeZone"
            label={copy.timeZone}
            value={profile.person.timeZone}
          />
        </FactGrid>
      </DetailSection>

      <DetailSection icon={IdCard} title={copy.employmentSection}>
        {employment ? (
          <FactGrid>
            <ProjectedFact
              profile={profile}
              field="employment.workerNumber"
              label={copy.workerNumber}
              value={employment.workerNumber}
            />
            <ProjectedFact
              profile={profile}
              field="employment.workerType"
              label={copy.workerType}
              value={employment.workerType}
            />
            <ProjectedFact
              profile={profile}
              field="employment.workerStatus"
              label={copy.workerStatus}
              value={employment.workerStatus}
            />
            <ProjectedFact
              profile={profile}
              field="employment.originalHireDate"
              label={copy.originalHireDate}
              value={employment.originalHireDate}
            />
            <ProjectedFact
              profile={profile}
              field="employment.relationshipType"
              label={copy.relationshipType}
              value={employment.relationshipType}
            />
            <ProjectedFact
              profile={profile}
              field="employment.relationshipStartDate"
              label={copy.relationshipPeriod}
              value={employment.relationshipStartDate}
            />
            <ProjectedFact
              profile={profile}
              field="employment.relationshipEndDate"
              label={`${copy.relationshipPeriod} · ${copy.current}`}
              value={employment.relationshipEndDate ?? copy.current}
            />
            <ProjectedFact
              profile={profile}
              field="employment.legalEmployerName"
              label={copy.legalEmployer}
              value={employment.legalEmployerName}
            />
          </FactGrid>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {copy.unavailableSection}
          </Typography>
        )}
      </DetailSection>

      <DetailSection icon={BriefcaseBusiness} title={copy.assignmentSection}>
        {assignment ? (
          <FactGrid>
            <ProjectedFact
              profile={profile}
              field="primaryAssignment.assignmentKey"
              label={copy.assignmentKey}
              value={assignment.assignmentKey}
            />
            <ProjectedFact
              profile={profile}
              field="primaryAssignment.assignmentStatus"
              label={copy.assignmentStatus}
              value={assignment.assignmentStatus}
            />
            <ProjectedFact
              profile={profile}
              field="primaryAssignment.businessTitle"
              label={copy.businessTitle}
              value={assignment.businessTitle}
            />
            <ProjectedFact
              profile={profile}
              field="primaryAssignment.organizationName"
              label={copy.organization}
              value={assignment.organizationName}
            />
            <ProjectedFact
              profile={profile}
              field="primaryAssignment.jobProfileName"
              label={copy.jobProfile}
              value={assignment.jobProfileName}
            />
            <ProjectedFact
              profile={profile}
              field="primaryAssignment.jobGradeName"
              label={copy.jobGrade}
              value={assignment.jobGradeName}
            />
            <ProjectedFact
              profile={profile}
              field="primaryAssignment.locationName"
              label={copy.location}
              value={assignment.locationName}
            />
            <ProjectedFact
              profile={profile}
              field="primaryAssignment.managerDisplayName"
              label={copy.manager}
              value={assignment.managerDisplayName}
            />
            <ProjectedFact
              profile={profile}
              field="primaryAssignment.effectiveStartDate"
              label={copy.effectivePeriod}
              value={assignment.effectiveStartDate}
            />
            <ProjectedFact
              profile={profile}
              field="primaryAssignment.effectiveEndDate"
              label={`${copy.effectivePeriod} · ${copy.current}`}
              value={assignment.effectiveEndDate ?? copy.current}
            />
          </FactGrid>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {copy.unavailableSection}
          </Typography>
        )}
      </DetailSection>

      <DetailSection icon={ShieldCheck} title={copy.projectionSection}>
        <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap>
          <Chip size="small" variant="outlined" label={`VIEW ${counts.view}`} />
          <Chip size="small" variant="outlined" color="warning" label={`MASK ${counts.mask}`} />
          <Chip size="small" variant="outlined" label={`OMIT ${counts.omit}`} />
        </Stack>
        <FactGrid>
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              {copy.policyScope}
            </Typography>
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              {profile.access.scope}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              {copy.effectiveDate}
            </Typography>
            <Typography variant="body2">{profile.asOf}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              {copy.policyRevision}
            </Typography>
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              {profile.access.policyRevision}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              {copy.projectionRevision}
            </Typography>
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              {profile.projectionRevision}
            </Typography>
          </Box>
        </FactGrid>
      </DetailSection>
    </Stack>
  );
}

export function People360Detail({
  personId,
  detail,
  onClose,
}: {
  personId: string | null;
  detail: People360DetailPresentation;
  onClose: () => void;
}) {
  const { i18n } = useTranslation();
  const copy = getPeople360Copy(i18n.resolvedLanguage, i18n.language);
  const profile = detail.profile;
  const title = profile?.person.displayName || copy.detailTitle;
  const subtitle = profile?.primaryAssignment?.businessTitle || personId || undefined;

  return (
    <DetailInspector
      open={Boolean(personId)}
      variant="drawer"
      width={560}
      title={title}
      subtitle={subtitle}
      closeLabel={copy.closeDetail}
      onClose={onClose}
      status={
        profile ? (
          <Chip
            size="small"
            variant="outlined"
            color={profile.state === 'PARTIAL' || detail.stale ? 'warning' : 'success'}
            label={detail.stale ? 'STALE' : profile.state}
          />
        ) : undefined
      }
    >
      {detail.loading ? (
        <LoadingState label={copy.detailLoading} size="standard" embedded />
      ) : detail.blockingError ? (
        <HcmQueryState
          error={detail.blockingError}
          retrying={detail.refreshing}
          onRetry={detail.retry}
          size="compact"
        />
      ) : profile ? (
        <Stack gap={1.5}>
          {detail.stale && (
            <InlineFeedback
              severity="warning"
              title={copy.staleTitle}
              action={
                <ActionButton
                  intent="quiet"
                  size="small"
                  loading={detail.refreshing}
                  startIcon={<RefreshCw size={14} aria-hidden="true" />}
                  onClick={detail.retry}
                >
                  {copy.retry}
                </ActionButton>
              }
            >
              {copy.staleDescription}
            </InlineFeedback>
          )}
          <People360ProjectionDetail profile={profile} />
        </Stack>
      ) : null}
    </DetailInspector>
  );
}
