import {
  Boxes,
  Copy,
  Download,
  FileDiff,
  FileJson,
  LibraryBig,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { ActionButton, FormField, InlineFeedback } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  AdminV2FactGrid,
  AdminV2GovernedAction,
  AdminV2InspectorPaper,
  AdminV2MetricStrip,
  AdminV2RecordButton,
  AdminV2Section,
  AdminV2StateBoundary,
  AdminV2StatusPill,
  AdminV2Timeline,
  AdminV2WorkspaceFrame,
} from './admin-v2-foundation';

import type {
  AdminV2Fact,
  AdminV2Metric,
  AdminV2SourceState,
  AdminV2StateCopy,
  AdminV2Status,
  AdminV2WorkspaceHeader,
} from './admin-v2-types';

export type ApprovalTemplateDependency = {
  id: string;
  name: string;
  detail: string;
  status: AdminV2Status;
  meta?: string;
};

export type ApprovalTemplateRecord = {
  id: string;
  name: string;
  summary: string;
  categoryId: string;
  categoryLabel: string;
  ownerLabel: string;
  versionLabel: string;
  usageLabel: string;
  updatedLabel: string;
  status: AdminV2Status;
  featured?: boolean;
  installed?: boolean;
  facts: readonly AdminV2Fact[];
  dependencies: readonly ApprovalTemplateDependency[];
  releaseNotes: readonly string[];
};

export type ApprovalTemplatePackagePreview = Readonly<{
  schemaSha256: string;
  fields: readonly Readonly<{
    id: string;
    label: string;
    type: string;
    required: boolean;
  }>[];
}>;

export type ApprovalTemplateComparison = Readonly<{
  installedVersion: number;
  availableVersion: number;
  updateAvailable: boolean;
  compatible: boolean;
}>;

export type TemplateLibraryCopy = {
  header: AdminV2WorkspaceHeader;
  state: AdminV2StateCopy;
  searchLabel: string;
  categoriesLabel: string;
  allCategoryLabel: string;
  catalogTitle: string;
  catalogDescription: string;
  detailTitle: string;
  detailDescription: string;
  factsTitle: string;
  dependenciesTitle: string;
  releaseNotesTitle: string;
  featuredLabel: string;
  installedLabel: string;
  importLabel: string;
  compareLabel: string;
  installLabel: string;
  mobileInstallLabel: string;
  mobileInstallReason: string;
  installReadyTitle: string;
  installReadyDescription: string;
  previewTitle?: string;
  previewDescription?: string;
  requiredLabel?: string;
  optionalLabel?: string;
  downloadPackageLabel?: string;
  cloneLabel?: string;
  comparisonCompatibleLabel?: string;
  comparisonBlockedLabel?: string;
};

export type TemplateLibraryWorkspaceProps = {
  state: AdminV2SourceState;
  copy: TemplateLibraryCopy;
  metrics: readonly AdminV2Metric[];
  categories: readonly { id: string; label: string; count: number }[];
  activeCategoryId: string;
  search: string;
  templates: readonly ApprovalTemplateRecord[];
  selectedTemplateId: string | null;
  packagePreview: ApprovalTemplatePackagePreview | null;
  packageLoading: boolean;
  comparison: ApprovalTemplateComparison | null;
  importReady: boolean;
  importDisabledReason?: string;
  compareReady: boolean;
  compareDisabledReason?: string;
  installReady: boolean;
  installDisabledReason?: string;
  downloadReady: boolean;
  cloneReady: boolean;
  cloneDisabledReason?: string;
  onSearchChange: (value: string) => void;
  onCategoryChange: (categoryId: string) => void;
  onSelectTemplate: (templateId: string) => void;
  onImport: () => void;
  onCompare: (templateId: string) => void;
  onDownloadPackage: (templateId: string) => void;
  onClone: (templateId: string) => void;
  onInstall: (templateId: string) => void;
  onRetry?: () => void;
  onResolveConflict?: () => void;
};

export function TemplateLibraryWorkspace({
  state,
  copy,
  metrics,
  categories,
  activeCategoryId,
  search,
  templates,
  selectedTemplateId,
  packagePreview,
  packageLoading,
  comparison,
  importReady,
  importDisabledReason,
  compareReady,
  compareDisabledReason,
  installReady,
  installDisabledReason,
  downloadReady,
  cloneReady,
  cloneDisabledReason,
  onSearchChange,
  onCategoryChange,
  onSelectTemplate,
  onImport,
  onCompare,
  onDownloadPackage,
  onClone,
  onInstall,
  onRetry,
  onResolveConflict,
}: TemplateLibraryWorkspaceProps) {
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null;
  const commandReady = state === 'ready' && Boolean(selectedTemplate);

  return (
    <AdminV2WorkspaceFrame
      header={copy.header}
      icon={LibraryBig}
      primaryAction={
        <Stack alignItems={{ xs: 'stretch', sm: 'flex-end' }} gap={0.5} maxWidth={320}>
          <ActionButton
            intent="primary"
            startIcon={<Download size={16} />}
            disabled={!importReady}
            onClick={onImport}
          >
            {copy.importLabel}
          </ActionButton>
          {!importReady && importDisabledReason ? (
            <Typography variant="caption" color="text.secondary" textAlign={{ sm: 'right' }}>
              {importDisabledReason}
            </Typography>
          ) : null}
        </Stack>
      }
    >
      <AdminV2StateBoundary
        state={state}
        copy={copy.state}
        actions={{ onRetry, onResolveConflict }}
      >
        <AdminV2MetricStrip metrics={metrics} />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              lg: 'minmax(168px, .55fr) minmax(280px, .95fr) minmax(0, 1.65fr)',
            },
            gap: { xs: 1.5, lg: 2 },
            alignItems: 'start',
          }}
        >
          <AdminV2InspectorPaper>
            <AdminV2Section title={copy.categoriesLabel} labelledBy="admin-v2-template-categories">
              <Stack
                component="nav"
                aria-label={copy.categoriesLabel}
                direction={{ xs: 'row', lg: 'column' }}
                sx={{ overflowX: 'auto' }}
              >
                {[
                  { id: 'ALL', label: copy.allCategoryLabel, count: templates.length },
                  ...categories,
                ].map((category) => (
                  <ButtonBase
                    key={category.id}
                    aria-current={activeCategoryId === category.id ? 'page' : undefined}
                    onClick={() => onCategoryChange(category.id)}
                    sx={{
                      minWidth: { xs: 'max-content', lg: 0 },
                      width: { lg: 1 },
                      px: 1.5,
                      py: 1.1,
                      justifyContent: 'space-between',
                      gap: 1,
                      borderInlineStart: 3,
                      borderColor:
                        activeCategoryId === category.id ? 'primary.main' : 'transparent',
                      color: activeCategoryId === category.id ? 'primary.main' : 'text.primary',
                      bgcolor: activeCategoryId === category.id ? 'action.selected' : 'transparent',
                    }}
                  >
                    <Typography variant="body2" fontWeight="fontWeightBold">
                      {category.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {category.count}
                    </Typography>
                  </ButtonBase>
                ))}
              </Stack>
            </AdminV2Section>
          </AdminV2InspectorPaper>

          <AdminV2InspectorPaper>
            <AdminV2Section
              title={copy.catalogTitle}
              description={copy.catalogDescription}
              labelledBy="admin-v2-template-catalog"
            >
              <Box sx={{ p: 1.5, borderBlockEnd: 1, borderColor: 'divider' }}>
                <FormField
                  fullWidth
                  size="small"
                  value={search}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder={copy.searchLabel}
                  inputProps={{ 'aria-label': copy.searchLabel }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search size={16} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
              <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                {templates.map((template) => (
                  <Box component="li" key={template.id}>
                    <AdminV2RecordButton
                      selected={template.id === selectedTemplateId}
                      title={template.name}
                      description={template.summary}
                      meta={`${template.categoryLabel} · ${template.versionLabel} · ${template.usageLabel}`}
                      status={template.status}
                      onClick={() => onSelectTemplate(template.id)}
                    />
                  </Box>
                ))}
              </Box>
            </AdminV2Section>
          </AdminV2InspectorPaper>

          <AdminV2InspectorPaper>
            <AdminV2Section
              title={selectedTemplate?.name ?? copy.detailTitle}
              description={selectedTemplate?.summary ?? copy.detailDescription}
              labelledBy="admin-v2-template-detail"
              action={
                selectedTemplate ? (
                  <AdminV2StatusPill status={selectedTemplate.status} />
                ) : undefined
              }
            >
              {selectedTemplate ? (
                <Stack gap={0}>
                  <Stack
                    direction="row"
                    gap={0.75}
                    flexWrap="wrap"
                    sx={{ px: 1.5, py: 1.25, borderBlockEnd: 1, borderColor: 'divider' }}
                  >
                    {selectedTemplate.featured ? (
                      <AdminV2StatusPill status={{ label: copy.featuredLabel, tone: 'info' }} />
                    ) : null}
                    {selectedTemplate.installed ? (
                      <AdminV2StatusPill status={{ label: copy.installedLabel, tone: 'success' }} />
                    ) : null}
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                      {selectedTemplate.ownerLabel} · {selectedTemplate.updatedLabel}
                    </Typography>
                  </Stack>
                  <AdminV2FactGrid facts={selectedTemplate.facts} />
                  <Box sx={{ px: 1.5, py: 1.25, borderBlockStart: 1, borderColor: 'divider' }}>
                    <Stack direction="row" justifyContent="space-between" gap={1} flexWrap="wrap">
                      <Box>
                        <Typography variant="subtitle2" fontWeight="fontWeightBold">
                          {copy.previewTitle ?? copy.factsTitle}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {copy.previewDescription ?? copy.detailDescription}
                        </Typography>
                      </Box>
                      {packagePreview ? (
                        <Typography variant="caption" color="text.secondary">
                          {packagePreview.schemaSha256}
                        </Typography>
                      ) : null}
                    </Stack>
                    {packagePreview ? (
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: {
                            xs: 'minmax(0,1fr)',
                            sm: 'repeat(2,minmax(0,1fr))',
                          },
                          gap: 1,
                          mt: 1.25,
                        }}
                      >
                        {packagePreview.fields.map((field) => (
                          <Box
                            key={field.id}
                            sx={{
                              minWidth: 0,
                              p: 1.25,
                              border: 1,
                              borderColor: 'divider',
                              borderRadius: 1,
                              bgcolor: 'action.hover',
                            }}
                          >
                            <Typography variant="body2" fontWeight="fontWeightBold">
                              {field.label}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {field.type} ·{' '}
                              {field.required
                                ? (copy.requiredLabel ?? copy.factsTitle)
                                : (copy.optionalLabel ?? copy.detailDescription)}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {packageLoading ? copy.state.loadingDescription : copy.detailDescription}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ px: 1.5, py: 1.25 }}>
                    <InlineFeedback
                      severity="success"
                      title={copy.installReadyTitle}
                      icon={<ShieldCheck size={18} />}
                    >
                      {copy.installReadyDescription}
                    </InlineFeedback>
                  </Box>
                  {comparison ? (
                    <Box sx={{ px: 1.5, pb: 1.5 }}>
                      <InlineFeedback
                        severity={comparison.compatible ? 'success' : 'warning'}
                        title={
                          comparison.compatible
                            ? (copy.comparisonCompatibleLabel ?? copy.installReadyTitle)
                            : (copy.comparisonBlockedLabel ?? copy.detailDescription)
                        }
                      >
                        {`${comparison.installedVersion} → ${comparison.availableVersion}`}
                      </InlineFeedback>
                    </Box>
                  ) : null}
                  <Box sx={{ px: 1.5, pb: 1.5 }}>
                    <Typography variant="subtitle2" fontWeight="fontWeightBold" sx={{ mb: 0.75 }}>
                      {copy.dependenciesTitle}
                    </Typography>
                    <AdminV2Timeline
                      items={selectedTemplate.dependencies.map((dependency) => ({
                        ...dependency,
                        title: dependency.name,
                      }))}
                    />
                  </Box>
                  <Box sx={{ px: 1.5, py: 1.25, borderBlockStart: 1, borderColor: 'divider' }}>
                    <Typography variant="subtitle2" fontWeight="fontWeightBold" sx={{ mb: 0.75 }}>
                      {copy.releaseNotesTitle}
                    </Typography>
                    <Stack component="ul" gap={0.6} sx={{ m: 0, pl: 2.25 }}>
                      {selectedTemplate.releaseNotes.map((note) => (
                        <Typography
                          component="li"
                          variant="body2"
                          key={note}
                          sx={{ overflowWrap: 'anywhere' }}
                        >
                          {note}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="flex-end"
                    gap={1}
                    sx={{ p: 1.5, borderBlockStart: 1, borderColor: 'divider' }}
                  >
                    <ActionButton
                      intent="secondary"
                      startIcon={<FileJson size={16} />}
                      disabled={!commandReady || !downloadReady}
                      onClick={() => onDownloadPackage(selectedTemplate.id)}
                    >
                      {copy.downloadPackageLabel ?? copy.detailTitle}
                    </ActionButton>
                    <Stack gap={0.5}>
                      <ActionButton
                        intent="secondary"
                        startIcon={<Copy size={16} />}
                        disabled={!commandReady || !cloneReady}
                        onClick={() => onClone(selectedTemplate.id)}
                      >
                        {copy.cloneLabel ?? copy.installLabel}
                      </ActionButton>
                      {!cloneReady && cloneDisabledReason ? (
                        <Typography variant="caption" color="text.secondary">
                          {cloneDisabledReason}
                        </Typography>
                      ) : null}
                    </Stack>
                    <Stack gap={0.5}>
                      <ActionButton
                        intent="secondary"
                        startIcon={<FileDiff size={16} />}
                        disabled={!commandReady || !compareReady}
                        onClick={() => onCompare(selectedTemplate.id)}
                      >
                        {copy.compareLabel}
                      </ActionButton>
                      {(!commandReady || !compareReady) && compareDisabledReason ? (
                        <Typography variant="caption" color="text.secondary">
                          {compareDisabledReason}
                        </Typography>
                      ) : null}
                    </Stack>
                    <AdminV2GovernedAction
                      desktopLabel={copy.installLabel}
                      mobileLabel={copy.mobileInstallLabel}
                      mobileReason={copy.mobileInstallReason}
                      disabled={!commandReady || !installReady}
                      disabledReason={installDisabledReason}
                      onAction={() => onInstall(selectedTemplate.id)}
                      icon={<Boxes size={16} />}
                    />
                  </Stack>
                </Stack>
              ) : (
                <Box sx={{ px: 2, py: 5, textAlign: 'center' }}>
                  <LibraryBig size={28} aria-hidden="true" />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {copy.detailDescription}
                  </Typography>
                </Box>
              )}
            </AdminV2Section>
          </AdminV2InspectorPaper>
        </Box>
      </AdminV2StateBoundary>
    </AdminV2WorkspaceFrame>
  );
}
