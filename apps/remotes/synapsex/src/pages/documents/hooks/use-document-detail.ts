/**
 * Document 상세 훅 — API 전용 (mock 제거)
 */

import { useMemo } from 'react';
import { useDocumentDetailQuery } from '@dwp-frontend/shared-utils';

import {
  toLineItemsUi,
  type LineItemUi,
  toRelatedCasesUi,
  toReversalChainUi,
  toDocumentDetailUi,
  toRelatedActionsUi,
  type RelatedCaseUi,
  toIntegrityChecksUi,
  type RelatedActionUi,
  type DocumentDetailUi,
  type IntegrityCheckUi,
  type ReversalChainItemUi,
} from '../adapters/document-detail-adapter';

type DocumentKey = { bukrs: string; belnr: string; gjahr: string } | { id: string };

export const useDocumentDetail = (key: DocumentKey | null) => {
  const bukrs = key && 'bukrs' in key ? key.bukrs : undefined;
  const belnr = key && 'belnr' in key ? key.belnr : undefined;
  const gjahr = key && 'gjahr' in key ? key.gjahr : undefined;

  const { data: apiData, isLoading, error } = useDocumentDetailQuery(bukrs, belnr, gjahr);

  const doc = useMemo((): DocumentDetailUi | undefined => {
    if (!apiData || typeof apiData !== 'object') return undefined;
    const raw = apiData as Parameters<typeof toDocumentDetailUi>[0];
    if (!raw.bukrs && !raw.belnr && !raw.gjahr) return undefined;
    return toDocumentDetailUi(raw);
  }, [apiData]);

  const docId = doc?.id ?? '';

  const lineItems = useMemo((): LineItemUi[] => {
    if (!doc || !apiData) return [];
    return toLineItemsUi(apiData as Parameters<typeof toLineItemsUi>[0], docId);
  }, [apiData, doc, docId]);

  const integrityChecks = useMemo((): IntegrityCheckUi[] => {
    if (!doc || !apiData) return [];
    return toIntegrityChecksUi(apiData as Parameters<typeof toIntegrityChecksUi>[0], docId);
  }, [apiData, doc, docId]);

  const relatedCases = useMemo((): RelatedCaseUi[] => {
    if (!apiData) return [];
    return toRelatedCasesUi(apiData as Parameters<typeof toRelatedCasesUi>[0]);
  }, [apiData]);

  const relatedActions = useMemo((): RelatedActionUi[] => {
    if (!apiData) return [];
    return toRelatedActionsUi(apiData as Parameters<typeof toRelatedActionsUi>[0]);
  }, [apiData]);

  const reversalChain = useMemo((): ReversalChainItemUi[] => {
    if (!doc || !apiData) return [];
    return toReversalChainUi(apiData as Parameters<typeof toReversalChainUi>[0], docId);
  }, [apiData, doc, docId]);

  return {
    doc,
    lineItems,
    integrityChecks,
    relatedCases,
    relatedActions,
    reversalChain,
    isLoading,
    error,
  };
};
