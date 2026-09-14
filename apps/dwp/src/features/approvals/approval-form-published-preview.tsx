import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { InlineFeedback } from '@dwp-frontend/design-system';
import Stack from '@mui/material/Stack';

import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';
import { ApprovalTypedFormPreview } from './approval-form-builder-typed-preview';
import { approvalPublishedPreviewBinding } from './approval-form-published-preview-binding';
import { ApprovalRequestUserPicker } from './approval-request-user-picker';

import type { ApprovalFormDetail } from '@dwp-frontend/shared-utils/api/approval-management-contract';
import type { CompiledApprovalTypedForm } from './approval-form-typed-model';

export function ApprovalPublishedFormPreview({
  detail,
  compiled,
  sourceReady,
  sourceCacheKey,
  korean,
}: {
  detail: ApprovalFormDetail;
  compiled?: CompiledApprovalTypedForm;
  sourceReady: boolean;
  sourceCacheKey: readonly string[];
  korean: boolean;
}) {
  const { t } = useTranslation('approvals');
  const scope = useProductSurfaceRequestScope({
    productKey: 'approvals',
    surfaceKey: 'approvals.admin',
  });
  const binding = approvalPublishedPreviewBinding(
    detail,
    compiled,
    sourceReady &&
      scope.governed &&
      scope.ready &&
      Boolean(scope.contextScopeKey && scope.queryMeta.decisionRevision) &&
      JSON.stringify(sourceCacheKey) === JSON.stringify(scope.cacheKey)
  );
  const identity = JSON.stringify([binding, scope.cacheKey]);
  const sources = useRef({ identity, proofs: new Map<string, { value: string; until: number }>() });
  if (sources.current.identity !== identity) sources.current = { identity, proofs: new Map() };
  if (!binding || !compiled)
    return (
      <InlineFeedback severity="warning">
        {t('admin.typedForm.userSourceUnavailable')}
      </InlineFeedback>
    );
  return (
    <Stack
      component="section"
      aria-label={t('admin.typedForm.publishedPreview')}
      gap={1.5}
      minWidth={0}
    >
      <InlineFeedback severity="info">
        {t('admin.typedForm.publishedPreviewDescription')}
      </InlineFeedback>
      <ApprovalTypedFormPreview
        key={identity}
        compiled={compiled}
        korean={korean}
        title={korean ? detail.form.nameKo : detail.form.nameEn}
        titleKo={detail.form.nameKo}
        titleEn={detail.form.nameEn}
        canValidateUser={(path, value) => {
          const proof = sources.current.proofs.get(path);
          return (
            sources.current.identity === identity &&
            proof?.value === value &&
            proof.until > Date.now()
          );
        }}
        renderUserField={({
          field,
          groupKey,
          path,
          value,
          label,
          supportingText,
          mandatory,
          onChange,
        }) => (
          <ApprovalRequestUserPicker
            binding={{ ...binding, fieldKey: field.key, ...(groupKey ? { groupKey } : {}) }}
            value={value}
            label={label}
            required={mandatory}
            supportingText={supportingText || undefined}
            sourceUnavailableText={t('admin.typedForm.userSourceUnavailable')}
            onChange={onChange}
            onSourceReadyChange={(state) => {
              if (sources.current.identity !== identity) return;
              const until = Date.parse(state.validUntil ?? '');
              if (state.ready && value && Number.isFinite(until) && until > Date.now())
                sources.current.proofs.set(path, { value, until });
              else sources.current.proofs.delete(path);
              if (!state.ready && value) onChange('');
            }}
          />
        )}
      />
    </Stack>
  );
}
