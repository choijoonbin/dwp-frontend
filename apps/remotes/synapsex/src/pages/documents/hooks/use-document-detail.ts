/**
 * Document 상세 훅 — API 시도 후 mock fallback
 */

import { useMemo } from 'react';
import { useDocumentDetailQuery } from '@dwp-frontend/shared-utils';

import {
  mockCases,
  mockFiDocs,
  mockActions,
  mockFiDocItems,
  type FiDocItem,
  type FiDocHeader,
  type SynapseCase,
  type SynapseAction,
  mockIntegrityChecks,
  type IntegrityCheck,
} from '../../../data/mock-data';

type DocumentKey = { bukrs: string; belnr: string; gjahr: string } | { id: string };

const findMockDoc = (key: DocumentKey): FiDocHeader | undefined => {
  if ('id' in key) {
    return mockFiDocs.find((d: FiDocHeader) => d.id === key.id);
  }
  return mockFiDocs.find(
    (d: FiDocHeader) => d.bukrs === key.bukrs && d.belnr === key.belnr && d.gjahr === key.gjahr
  );
};

export const useDocumentDetail = (key: DocumentKey | null) => {
  const bukrs = key && 'bukrs' in key ? key.bukrs : undefined;
  const belnr = key && 'belnr' in key ? key.belnr : undefined;
  const gjahr = key && 'gjahr' in key ? key.gjahr : undefined;

  const { data: apiData, isLoading, error } = useDocumentDetailQuery(bukrs, belnr, gjahr);

  const doc = useMemo(() => {
    if (apiData && typeof apiData === 'object' && 'belnr' in apiData) {
      return apiData as unknown as FiDocHeader;
    }
    if (key) {
      return findMockDoc(key);
    }
    return undefined;
  }, [apiData, key]);

  const lineItems = useMemo((): FiDocItem[] => {
    if (!doc) return [];
    const docId = doc.id;
    return mockFiDocItems.filter((item: FiDocItem) => item.docId === docId);
  }, [doc]);

  const integrityChecks = useMemo((): IntegrityCheck[] => {
    if (!doc) return [];
    const docId = doc.id;
    return mockIntegrityChecks.filter((chk: IntegrityCheck) => chk.docId === docId);
  }, [doc]);

  const relatedCases = useMemo(() => {
    if (!doc) return [];
    return mockCases.filter((c: SynapseCase) => c.fiDocId === doc.id);
  }, [doc]);

  const relatedActions = useMemo(() => mockActions.filter((a: SynapseAction) =>
      relatedCases.some((c: SynapseCase) => c.id === a.caseId)
    ), [relatedCases]);

  return {
    doc,
    lineItems,
    integrityChecks,
    relatedCases,
    relatedActions,
    isLoading,
    error,
    fromApi: Boolean(apiData),
  };
};
