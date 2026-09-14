import { useTranslation } from 'react-i18next';
import { Braces, Check, GitBranch, PencilLine, Rocket } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  getApprovalFormReferenceWorkflow,
  isApprovalTypedFormSchema,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';

import { ApprovalSurface, StatusChip, approvalTone } from './approval-ui';
import { useApprovalManagementScopeReady } from './approval-management-scope';
import { useApprovalManagementRequestScope } from './use-approval-experience';
import { ApprovalTypedDefinitionInspector } from './approval-form-typed-definition-inspector';
import { ApprovalPublishedFormPreview } from './approval-form-published-preview';

import type { getApprovalForm } from '@dwp-frontend/shared-utils';
import type { CompiledApprovalTypedForm } from './approval-form-typed-model';

export function approvalFormReferenceQueryEnabled(
  scopeReady: boolean,
  workflowId: string | undefined
): boolean {
  return scopeReady && typeof workflowId === 'string' && workflowId.length > 0;
}

export function ApprovalFormInspector({
  detail,
  locale,
  canEdit,
  canPublish,
  publishing,
  onEdit,
  onPublish,
  previewCompiled,
  previewSourceReady = false,
  previewSourceCacheKey = [],
}: {
  detail: Awaited<ReturnType<typeof getApprovalForm>>;
  locale?: string;
  canEdit: boolean;
  canPublish: boolean;
  publishing: boolean;
  onEdit: () => void;
  onPublish: () => void;
  previewCompiled?: CompiledApprovalTypedForm;
  previewSourceReady?: boolean;
  previewSourceCacheKey?: readonly string[];
}) {
  const { t, i18n } = useTranslation('approvals');
  const requestScope = useApprovalManagementRequestScope();
  const scopeReady = useApprovalManagementScopeReady(requestScope);
  const form = detail.form;
  const korean = resolveSupportedLocale(locale, i18n.resolvedLanguage, i18n.language) === 'ko';
  const route = detail.routes.find((item) => item.bindingType === 'DEFAULT');
  const routeDetail = useQuery({
    queryKey: [
      'approvals',
      'admin',
      'workflows',
      route?.workflowId,
      'view',
      'reference',
      ...requestScope.cacheKey,
    ],
    queryFn: ({ signal }) =>
      getApprovalFormReferenceWorkflow(route!.workflowId, requestScope.contextScopeKey, signal),
    enabled: approvalFormReferenceQueryEnabled(scopeReady, route?.workflowId),
    staleTime: 30_000,
  });
  const routeReady = route?.workflowLifecycleState === 'PUBLISHED';
  const isDraft = form.lifecycleState === 'DRAFT';

  return (
    <Stack gap={2} minWidth={0}>
      <Box
        component="section"
        sx={{
          p: { xs: 2, md: 2.5 },
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
          <Box minWidth={0}>
            <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
              <Box component="h2" sx={{ m: 0, typography: 'h5' }}>
                {korean ? form.nameKo : form.nameEn}
              </Box>
              <StatusChip status={form.lifecycleState} />
              <Chip
                size="small"
                variant="outlined"
                label={korean ? form.categoryNameKo : form.categoryNameEn}
              />
            </Stack>
            <Box sx={{ mt: 0.75, typography: 'body1', color: 'text.secondary' }}>
              {korean ? form.descriptionKo : form.descriptionEn}
            </Box>
            <Box sx={{ mt: 1, typography: 'caption', color: 'text.secondary' }}>
              {form.formKey} · {detail.schemaHash.slice(0, 12)}
            </Box>
          </Box>
          <Stack direction="row" gap={1} alignItems="flex-start">
            {canEdit && isDraft ? (
              <ActionButton
                intent="secondary"
                startIcon={<PencilLine size={16} />}
                onClick={onEdit}
              >
                {t('admin.studio.editForm')}
              </ActionButton>
            ) : null}
            {canPublish && isDraft ? (
              <ActionButton
                intent="primary"
                startIcon={<Rocket size={16} />}
                loading={publishing}
                disabled={!routeReady}
                onClick={onPublish}
              >
                {t('actions.publish')}
              </ActionButton>
            ) : null}
          </Stack>
        </Stack>
        <Box
          sx={{
            mt: 2,
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2,minmax(0,1fr))',
              md: 'repeat(4,minmax(0,1fr))',
            },
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          {[
            [t('admin.formCatalog.inspector.fields'), form.fieldCount],
            [t('admin.formCatalog.inspector.routes'), form.routeCount],
            [t('admin.formCatalog.inspector.usage'), form.usageCount],
            [t('admin.formCatalog.inspector.version'), `v${form.currentVersion}`],
          ].map(([label, value]) => (
            <Box key={String(label)} sx={{ pt: 1.5, pr: 2 }}>
              <Box sx={{ typography: 'caption', color: 'text.secondary' }}>{String(label)}</Box>
              <Box sx={{ typography: 'body2', fontWeight: 'fontWeightBold' }}>{String(value)}</Box>
            </Box>
          ))}
        </Box>
      </Box>

      <ApprovalSurface
        title={t('admin.formCatalog.route.title')}
        meta={t('admin.formCatalog.route.meta')}
        action={<GitBranch size={18} />}
      >
        {route ? (
          <Box>
            <Box
              sx={{
                px: 2,
                py: 1.75,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'minmax(0,1fr) auto auto' },
                gap: 1.5,
                alignItems: 'center',
              }}
            >
              <Box minWidth={0}>
                <Box sx={{ typography: 'body2', fontWeight: 'fontWeightBold' }}>
                  {korean ? route.workflowNameKo : route.workflowNameEn}
                </Box>
                <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                  {t('admin.workflowRevision', {
                    key: route.workflowKey,
                    version: route.workflowVersion,
                  })}
                </Box>
              </Box>
              <Box sx={{ typography: 'caption' }}>
                {t('admin.minutes', { count: route.slaMinutes })}
              </Box>
              <StatusChip status={route.workflowLifecycleState} />
            </Box>
            {routeDetail.data ? (
              <Box sx={{ px: 2, py: 2, borderTop: 1, borderColor: 'divider' }}>
                <Box sx={{ typography: 'overline', color: 'text.secondary' }}>
                  {t('admin.formCatalog.route.stepsMeta', {
                    count: routeDetail.data.definition.steps.length,
                  })}
                </Box>
                <Box
                  component="ol"
                  sx={{
                    mt: 1,
                    mb: 0,
                    p: 0,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
                    gap: 1,
                    listStyle: 'none',
                  }}
                >
                  {routeDetail.data.definition.steps.map((step, index) => (
                    <Box
                      component="li"
                      key={step.key}
                      sx={{
                        minHeight: 92,
                        p: 1.5,
                        border: 1,
                        borderColor: 'divider',
                        bgcolor: 'background.default',
                      }}
                    >
                      <Stack direction="row" gap={1.25} alignItems="flex-start">
                        <Box
                          sx={{
                            width: 26,
                            height: 26,
                            flex: '0 0 auto',
                            display: 'grid',
                            placeItems: 'center',
                            bgcolor: alpha(approvalTone.primary, 0.1),
                            color: approvalTone.primary,
                            typography: 'caption',
                            fontWeight: 'fontWeightBold',
                          }}
                        >
                          {index + 1}
                        </Box>
                        <Box minWidth={0}>
                          <Box sx={{ typography: 'body2', fontWeight: 'fontWeightBold' }}>
                            {step.name}
                          </Box>
                          <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                            {step.candidateRole}
                          </Box>
                          <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                            {step.mode} · {t('admin.minutes', { count: step.slaMinutes })}
                          </Box>
                        </Box>
                      </Stack>
                    </Box>
                  ))}
                </Box>
              </Box>
            ) : null}
            {routeDetail.isError ? (
              <InlineFeedback severity="warning">
                {t('admin.formCatalog.route.previewError')}
              </InlineFeedback>
            ) : null}
          </Box>
        ) : (
          <InlineFeedback severity="warning">{t('admin.formCatalog.route.missing')}</InlineFeedback>
        )}
      </ApprovalSurface>

      <ApprovalSurface
        title={t('admin.studio.formFields')}
        meta={t('admin.studio.formFieldsMeta', { count: detail.schema.fields.length })}
        action={<Braces size={18} />}
      >
        {isApprovalTypedFormSchema(detail.schema) ? (
          <ApprovalTypedDefinitionInspector schema={detail.schema} korean={korean} />
        ) : (
          <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {detail.schema.fields.map((field, index) => (
              <Box
                component="li"
                key={field.key}
                sx={{
                  minHeight: 64,
                  px: 2,
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '36px minmax(0,1fr) auto',
                    sm: '40px minmax(0,1.4fr) minmax(90px,.5fr) 82px',
                  },
                  gap: 1.25,
                  alignItems: 'center',
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                  {String(index + 1).padStart(2, '0')}
                </Box>
                <Box minWidth={0}>
                  <Box sx={{ typography: 'body2', fontWeight: 'fontWeightBold' }}>
                    {korean ? (field.labelKo ?? field.key) : (field.labelEn ?? field.key)}
                  </Box>
                  <Box sx={{ typography: 'caption', color: 'text.secondary' }}>{field.key}</Box>
                </Box>
                <Chip size="small" variant="outlined" label={field.type} />
                <Stack
                  direction="row"
                  gap={0.5}
                  alignItems="center"
                  sx={{ display: { xs: 'none', sm: 'flex' } }}
                >
                  {field.required ? <Check size={14} color={approvalTone.teal} /> : null}
                  <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                    {t(field.required ? 'admin.studio.required' : 'admin.studio.optional')}
                  </Box>
                </Stack>
              </Box>
            ))}
          </Box>
        )}
      </ApprovalSurface>

      {form.lifecycleState === 'PUBLISHED' && isApprovalTypedFormSchema(detail.schema) ? (
        <ApprovalPublishedFormPreview
          detail={detail}
          compiled={previewCompiled}
          sourceReady={previewSourceReady}
          sourceCacheKey={previewSourceCacheKey}
          korean={korean}
        />
      ) : null}

      <InlineFeedback severity={routeReady ? 'info' : 'warning'} icon={<GitBranch size={19} />}>
        <Box sx={{ typography: 'subtitle2' }}>{t('admin.formCatalog.route.title')}</Box>
        <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
          {t(routeReady ? 'admin.formCatalog.route.meta' : 'admin.formCatalog.route.missing')}
        </Box>
      </InlineFeedback>
    </Stack>
  );
}
