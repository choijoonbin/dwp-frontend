/**
 * Case RAG Evidence Tab — API 바인딩
 * @see docs/job/PROMPT_B_Frontend_Cases_TabsBind_P1_v2.txt
 */

import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useCaseRagEvidenceQuery } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';

import { RagCitationList } from '../../../components/evidence';
import { TabEmptyState } from '../../../components/ux/tab-empty-state';
import { TabErrorState } from '../../../components/ux/tab-error-state';
import { TabContentSkeleton } from '../../../components/ux/tab-content-skeleton';

import type { RagCitation } from '../../../components/evidence';

type CaseRagEvidenceTabProps = {
  caseId: string | undefined;
  enabled: boolean;
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

export const CaseRagEvidenceTab = ({ caseId, enabled }: CaseRagEvidenceTabProps) => {
  const { t } = useTranslation('common');
  const { data, isLoading, isError, error, refetch } = useCaseRagEvidenceQuery(caseId, { enabled });

  if (isLoading) {
    return <TabContentSkeleton cards={3} />;
  }

  if (isError) {
    return (
      <Box sx={{ p: 2 }}>
        <TabErrorState
          title={t('cases.tabs.ragEvidence.error.title')}
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => refetch()}
        />
      </Box>
    );
  }

  const rawItems = data?.items ?? data?.citations ?? [];
  const citations: RagCitation[] = rawItems.map(mapApiItemToCitation).filter((c) => c.title);

  if (citations.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <TabEmptyState
          icon="solar:shield-check-bold-duotone"
          title={t('cases.tabs.ragEvidence.empty.title')}
          description={t('cases.tabs.ragEvidence.empty.description')}
        />
      </Box>
    );
  }

  return (
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
  );
};
