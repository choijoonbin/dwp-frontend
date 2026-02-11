/**
 * Case RAG Evidence Tab — API 바인딩
 * @see docs/job/PROMPT_B_Frontend_Cases_TabsBind_P1_v2.txt
 * @see docs/job/PROMPT_FE_CASE_TABS_DEBUG_UX_P11.txt — Debug payload
 */

import { useEffect } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { getErrorMessage, useCaseRagEvidenceQuery } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';

import { RagCitationList } from '../../../components/evidence';
import { useCaseTabsDebug } from '../context/case-tabs-debug-context';
import { TabEmptyState, CaseTabQueryBoundary } from '../../../components/ux';

import type { RagCitation } from '../../../components/evidence';

type CaseRagEvidenceTabProps = {
  caseId: string | undefined;
  enabled: boolean;
  tabKey?: string;
};

const mapApiItemToCitation = (item: {
  id?: string;
  sourceId?: string;
  title?: string;
  excerpt?: string;
  score?: number;
  [key: string]: unknown;
}): RagCitation => ({
  id: item.id ?? item.sourceId,
  title: item.title ?? '',
  docTitle: item.title,
  quote: item.excerpt as string | undefined,
  relevanceScore: item.score,
  source: item.sourceId as string | undefined,
});

export const CaseRagEvidenceTab = ({ caseId, enabled, tabKey = 'policies' }: CaseRagEvidenceTabProps) => {
  const { t } = useTranslation('common');
  const debugCtx = useCaseTabsDebug();
  const { data, isLoading, isError, error, refetch } = useCaseRagEvidenceQuery(caseId, { enabled });

  const setPayload = debugCtx?.setPayload;
  useEffect(() => {
    if (!enabled || !setPayload) return;
    if (isError && error) {
      setPayload(tabKey, {
        status: 'error',
        payload: { message: getErrorMessage(error) ?? String(error) },
        error: getErrorMessage(error) ?? String(error),
      });
    } else if (!isLoading && data !== undefined) {
      setPayload(tabKey, { status: 'success', payload: data });
    }
  }, [enabled, setPayload, isLoading, isError, error, data, tabKey]);

  const rawItems = data?.items ?? data?.citations ?? [];
  const citations: RagCitation[] = rawItems.map(mapApiItemToCitation).filter((c) => c.title);
  const isEmpty = rawItems.length === 0;

  return (
    <CaseTabQueryBoundary
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      errorTitle={t('cases.tabs.ragEvidence.error.title')}
      skeletonCards={3}
      empty={isEmpty}
      emptyContent={
        <Box sx={{ p: 2 }}>
          <TabEmptyState
            icon="solar:shield-check-bold-duotone"
            title={t('cases.tabs.ragEvidence.empty.title')}
            description={t('cases.tabs.ragEvidence.empty.description')}
            reason={t('cases.tabs.ragEvidence.empty.reason.itemsZero')}
          />
        </Box>
      }
    >
    <Box sx={{ p: 2 }}>
      <Box sx={{ mb: 2 }}>
        <Box component="span" sx={{ typography: 'body2', color: 'text.secondary' }}>
          {t('caseDetail.policyClickHint')}
        </Box>
      </Box>
      <RagCitationList
        citations={citations}
        title=""
        maxItems={0}
        onOpenSource={(source) => {
          console.log('Open policy source:', source);
        }}
      />
    </Box>
    </CaseTabQueryBoundary>
  );
};
