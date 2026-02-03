/**
 * Case detail hook — API with mock fallback
 */

import { useMemo } from 'react';
import { useCaseDetailQuery } from '@dwp-frontend/shared-utils';

import {
  mockCases,
  mockFiDocs,
  mockActions,
  mockFiDocItems,
  mockAuditEvents,
} from '../../../data/mock-data';

export const useCaseDetail = (caseId: string | undefined) => {
  const query = useCaseDetailQuery(caseId);

  return useMemo(() => {
    const caseData = caseId ? mockCases.find((c) => c.id === caseId) ?? mockCases[0] : mockCases[0];
    const fiDoc = mockFiDocs.find((d) => d.id === caseData.fiDocId) ?? mockFiDocs[0];
    const fiDocItems = mockFiDocItems.filter((i) => i.docId === fiDoc?.id);
    const relatedActions = mockActions.filter((a) => a.caseId === caseData.id);

    if (query.data && !query.isError) {
      const api = query.data;
      return {
        caseData,
        evidence: api.evidence,
        reasoning: api.reasoning,
        action: api.action,
        fiDoc,
        fiDocItems,
        relatedActions,
        auditEvents: mockAuditEvents.filter((e) => e.caseId === caseData.id || !e.caseId),
        fromApi: true,
      };
    }

    return {
      caseData,
      evidence: undefined,
      reasoning: undefined,
      action: undefined,
      fiDoc,
      fiDocItems,
      relatedActions,
      auditEvents: mockAuditEvents.filter((e) => e.caseId === caseData.id || !e.caseId),
      fromApi: false,
    };
  }, [caseId, query.data, query.isError]);
};
