import { Fragment, useMemo, useState } from 'react';
import { FileText, Plus, Search } from 'lucide-react';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
  ActionButton,
  GuidedEmptyState,
  InlineFeedback,
  SelectField,
} from '@dwp-frontend/design-system';

import { DWAION_ARTIFACT_COPY_KO } from './dwaion-artifact-copy';

import type { DwaionArtifactCopy } from './dwaion-artifact-copy';
import type { DwaionArtifactState, DwaionArtifactSummary } from './dwaion-artifact-model';

export type DwaionArtifactNavigationCapabilities = {
  teamWorkspaceAvailable: boolean;
  teamWorkspaceReason?: string | null;
  teamArtifactIds?: readonly string[];
  reviewRequestsAvailable: boolean;
  reviewRequestsReason?: string | null;
};

type ArtifactTab = 'MINE' | 'TEAM' | 'REVIEW';
type ArtifactFilter = 'ALL' | DwaionArtifactState;
type ArtifactGroup = 'RECENT' | 'PROJECTS' | 'ARCHIVED';

export function DwaionArtifactConversationRail({
  artifacts,
  selectedId,
  onSelect,
  onCreate,
  canCreate = true,
  navigationCapabilities,
  copy = DWAION_ARTIFACT_COPY_KO,
  formatTimestamp = (value) => value,
}: {
  artifacts: readonly DwaionArtifactSummary[];
  selectedId?: string;
  onSelect: (artifact: DwaionArtifactSummary) => void;
  onCreate: () => void;
  canCreate?: boolean;
  navigationCapabilities?: DwaionArtifactNavigationCapabilities;
  copy?: DwaionArtifactCopy;
  formatTimestamp?: (value: string) => string;
}) {
  const [tab, setTab] = useState<ArtifactTab>('MINE');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ArtifactFilter>('ALL');
  const [authorFilter, setAuthorFilter] = useState('ALL');
  const [tagFilter, setTagFilter] = useState('ALL');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const teamArtifactIds = useMemo(
    () => new Set(navigationCapabilities?.teamArtifactIds ?? []),
    [navigationCapabilities?.teamArtifactIds]
  );
  const tabArtifacts = useMemo(() => {
    if (tab === 'TEAM') {
      return artifacts.filter(
        (artifact) =>
          artifact.capabilities.collaborativeEditingAvailable ||
          teamArtifactIds.has(artifact.artifactId)
      );
    }
    if (tab === 'REVIEW')
      return artifacts.filter((artifact) => artifact.state === 'REVIEW_REQUIRED');
    return artifacts;
  }, [artifacts, tab, teamArtifactIds]);
  const visibleArtifacts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return tabArtifacts.filter((artifact) => {
      if (filter !== 'ALL' && artifact.state !== filter) return false;
      if (authorFilter !== 'ALL' && artifact.authorSubjectId !== authorFilter) return false;
      if (tagFilter !== 'ALL' && !artifact.tags.includes(tagFilter)) return false;
      if (projectFilter !== 'ALL' && artifact.projectKey !== projectFilter) return false;
      if (!query) return true;
      return [
        artifact.title,
        artifact.artifactType,
        artifact.state,
        artifact.authorSubjectId ?? '',
        artifact.projectKey ?? '',
        ...artifact.tags,
      ].some((value) => value.toLocaleLowerCase().includes(query));
    });
  }, [authorFilter, filter, projectFilter, search, tabArtifacts, tagFilter]);
  const metadataOptions = useMemo(
    () => ({
      authors: unique(tabArtifacts.map((artifact) => artifact.authorSubjectId)),
      tags: unique(tabArtifacts.flatMap((artifact) => artifact.tags)),
      projects: unique(tabArtifacts.map((artifact) => artifact.projectKey)),
    }),
    [tabArtifacts]
  );
  const groupedArtifacts = useMemo(() => {
    const groups: Record<ArtifactGroup, DwaionArtifactSummary[]> = {
      RECENT: [],
      PROJECTS: [],
      ARCHIVED: [],
    };
    visibleArtifacts.forEach((artifact) => {
      if (artifact.state === 'ARCHIVED') groups.ARCHIVED.push(artifact);
      else if (artifact.projectKey) groups.PROJECTS.push(artifact);
      else groups.RECENT.push(artifact);
    });
    return (Object.keys(groups) as ArtifactGroup[]).filter((key) => groups[key].length).map(
      (key) => ({ key, artifacts: groups[key] })
    );
  }, [visibleArtifacts]);
  const unavailableReason =
    tab === 'TEAM' && !navigationCapabilities?.teamWorkspaceAvailable
      ? (navigationCapabilities?.teamWorkspaceReason ?? copy.teamWorkspaceUnavailable)
      : tab === 'REVIEW' && !navigationCapabilities?.reviewRequestsAvailable
        ? (navigationCapabilities?.reviewRequestsReason ?? copy.reviewRequestsUnavailable)
        : null;
  const tabs: Array<{ key: ArtifactTab; label: string; count: number }> = [
    { key: 'MINE', label: copy.artifactTabs.MINE, count: artifacts.length },
    {
      key: 'TEAM',
      label: copy.artifactTabs.TEAM,
      count: artifacts.filter(
        (artifact) =>
          artifact.capabilities.collaborativeEditingAvailable ||
          teamArtifactIds.has(artifact.artifactId)
      ).length,
    },
    {
      key: 'REVIEW',
      label: copy.artifactTabs.REVIEW,
      count: artifacts.filter((artifact) => artifact.state === 'REVIEW_REQUIRED').length,
    },
  ];

  return (
    <Box component="section" aria-labelledby="dwaion-artifact-list-title" sx={{ minWidth: 0 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Typography id="dwaion-artifact-list-title" component="h2" variant="subtitle2">
          {copy.artifacts}
        </Typography>
        <ActionButton
          intent="quiet"
          aria-label={copy.create}
          disabled={!canCreate}
          onClick={onCreate}
          sx={{ minWidth: 44, minHeight: 44, px: 1 }}
        >
          <Plus size={18} aria-hidden="true" />
        </ActionButton>
      </Stack>
      <Box
        role="tablist"
        aria-label={copy.artifactTabsLabel}
        sx={{ display: 'flex', gap: 0.5, mt: 1, overflowX: 'auto', pb: 0.25 }}
      >
        {tabs.map((item) => (
          <ButtonBase
            key={item.key}
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => {
              setTab(item.key);
              setFilter('ALL');
              setAuthorFilter('ALL');
              setTagFilter('ALL');
              setProjectFilter('ALL');
            }}
            sx={{
              minHeight: 44,
              flexShrink: 0,
              px: 1,
              borderBottom: 2,
              borderColor: tab === item.key ? 'primary.main' : 'transparent',
              color: tab === item.key ? 'primary.main' : 'text.secondary',
              fontWeight: 'fontWeightBold',
              fontSize: 'caption.fontSize',
            }}
          >
            {item.label} ({item.count})
          </ButtonBase>
        ))}
      </Box>
      <Stack gap={1} sx={{ mt: 1 }}>
        <TextField
          label={copy.artifactSearchLabel}
          placeholder={copy.artifactSearchPlaceholder}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          size="small"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} aria-hidden="true" />
                </InputAdornment>
              ),
            },
          }}
        />
        <SelectField
          label={copy.artifactFilterLabel}
          value={filter}
          options={(['ALL', 'DRAFT', 'REVIEW_REQUIRED', 'PUBLISHED', 'ARCHIVED'] as const).map(
            (value) => ({ value, label: copy.artifactFilters[value] })
          )}
          onValueChange={(value) => setFilter((value || 'ALL') as ArtifactFilter)}
        />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
            gap: 1,
          }}
        >
          <SelectField
            label={copy.artifactAuthorFilterLabel}
            value={authorFilter}
            options={filterOptions(metadataOptions.authors, copy.artifactFilterAll)}
            onValueChange={(value) => setAuthorFilter(value || 'ALL')}
          />
          <SelectField
            label={copy.artifactTagFilterLabel}
            value={tagFilter}
            options={filterOptions(metadataOptions.tags, copy.artifactFilterAll)}
            onValueChange={(value) => setTagFilter(value || 'ALL')}
          />
          <SelectField
            label={copy.artifactProjectFilterLabel}
            value={projectFilter}
            options={filterOptions(metadataOptions.projects, copy.artifactFilterAll)}
            onValueChange={(value) => setProjectFilter(value || 'ALL')}
          />
        </Box>
        <Typography variant="caption" color="text.secondary">
          {copy.artifactSearchCapabilityNotice}
        </Typography>
      </Stack>
      {unavailableReason ? (
        <InlineFeedback severity="info" sx={{ mt: 1 }}>
          {unavailableReason}
        </InlineFeedback>
      ) : null}
      {artifacts.length === 0 ? (
        <GuidedEmptyState
          kind="first-use"
          title={copy.emptyTitle}
          description={copy.emptyDescription}
          actionLabel={canCreate ? copy.create : undefined}
          onAction={canCreate ? onCreate : undefined}
          size="compact"
          announce={false}
        />
      ) : visibleArtifacts.length === 0 ? (
        <GuidedEmptyState
          kind="empty"
          title={copy.artifactFilterEmpty}
          description={
            unavailableReason ??
            (tab === 'TEAM'
              ? copy.teamWorkspaceEmpty
              : tab === 'REVIEW'
                ? copy.reviewRequestsEmpty
                : copy.artifactFilterEmptyHelp)
          }
          size="compact"
          announce={false}
        />
      ) : (
        <Box sx={{ borderBlock: 1, borderColor: 'divider' }}>
          {groupedArtifacts.map((group) => (
            <Fragment key={group.key}>
              <Typography
                component="h3"
                variant="overline"
                color="text.secondary"
                sx={{ display: 'block', px: 1, pt: 1.25 }}
              >
                {copy.artifactGroups[group.key]} ({group.artifacts.length})
              </Typography>
              {group.artifacts.map((artifact, index) => (
                <Box key={artifact.artifactId}>
                  {index > 0 ? <Divider /> : null}
              <Box
                component="button"
                type="button"
                aria-pressed={artifact.artifactId === selectedId}
                onClick={() => onSelect(artifact)}
                sx={{
                  width: '100%',
                  minHeight: 64,
                  display: 'grid',
                  gridTemplateColumns: '32px minmax(0, 1fr)',
                  alignItems: 'start',
                  gap: 1,
                  border: 0,
                  px: 1,
                  py: 1.25,
                  bgcolor:
                    artifact.artifactId === selectedId ? 'var(--dwp-product-soft)' : 'transparent',
                  color: 'text.primary',
                  textAlign: 'left',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                  '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: -2,
                  },
                  '@media (forced-colors: active)': {
                    border: artifact.artifactId === selectedId ? '1px solid Highlight' : 0,
                  },
                }}
              >
                <FileText size={18} aria-hidden="true" />
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    fontWeight="fontWeightBold"
                    sx={{ overflowWrap: 'anywhere' }}
                  >
                    {artifact.title}
                  </Typography>
                  <Stack
                    direction="row"
                    gap={0.5}
                    alignItems="center"
                    flexWrap="wrap"
                    sx={{ mt: 0.5 }}
                  >
                    <Chip
                      size="small"
                      variant="outlined"
                      label={copy.artifactTypes[artifact.artifactType]}
                    />
                    <Chip
                      size="small"
                      color={artifact.state === 'PUBLISHED' ? 'success' : 'default'}
                      variant="outlined"
                      label={copy.artifactStates[artifact.state]}
                    />
                    {artifact.projectKey ? (
                      <Chip size="small" variant="outlined" label={artifact.projectKey} />
                    ) : null}
                    {artifact.tags.slice(0, 2).map((tag) => (
                      <Chip size="small" variant="outlined" label={`#${tag}`} key={tag} />
                    ))}
                    <Chip
                      size="small"
                      color={
                        artifact.reviewSlaDueAt && Date.parse(artifact.reviewSlaDueAt) < Date.now()
                          ? 'warning'
                          : 'default'
                      }
                      variant="outlined"
                      label={
                        artifact.reviewSlaDueAt
                          ? `${
                              Date.parse(artifact.reviewSlaDueAt) < Date.now()
                                ? copy.artifactSla.overdue
                                : copy.artifactSla.due
                            } ${formatTimestamp(artifact.reviewSlaDueAt)}`
                          : copy.artifactSla.none
                      }
                    />
                    <Typography variant="caption" color="text.secondary">
                      {copy.revisionPrefix}
                      {artifact.revision} {copy.separator} {formatTimestamp(artifact.updatedAt)}
                    </Typography>
                  </Stack>
                </Box>
              </Box>
                </Box>
              ))}
            </Fragment>
          ))}
        </Box>
      )}
    </Box>
  );
}

function unique(values: readonly (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function filterOptions(values: readonly string[], allLabel: string) {
  return [
    { value: 'ALL', label: allLabel },
    ...values.map((value) => ({ value, label: value })),
  ];
}
