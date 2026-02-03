/**
 * Document Detail API 응답 → UI 모델 변환
 * BE FiDocDetailRaw → FiDocHeader, FiDocItem, IntegrityCheck 등
 */

import type { FiDocDetailRaw } from '@dwp-frontend/shared-utils';

export type DocumentDetailUi = {
  id: string;
  belnr: string;
  bukrs: string;
  gjahr: string;
  budat: string;
  bldat: string;
  blart: string;
  tcode: string;
  usnam: string;
  counterparty: string;
  counterpartyId: string;
  wrbtr: number;
  waers: string;
  xblnr: string;
  bktxt: string;
  tenantId: number;
  integrityStatus: 'pass' | 'warn' | 'fail';
  reversalFlag: boolean;
  reversedByDoc?: string;
  reversesDoc?: string;
  createdAt: string;
  linkedCasesCount: number;
};

export type LineItemUi = {
  id: string;
  docId: string;
  buzei: number;
  hkont: string;
  hkontName: string;
  shkzg: 'S' | 'H';
  wrbtr: number;
  mwskz?: string;
  kostl?: string;
  zuonr?: string;
  sgtxt: string;
};

export type IntegrityCheckUi = {
  id: string;
  docId: string;
  ruleName: string;
  severity: 'info' | 'warn' | 'critical';
  passed: boolean;
  evidence: string;
  recommendation: string;
  relatedCaseId?: string;
};

export type RelatedCaseUi = {
  id: string;
  caseNumber: string;
  title: string;
  severity: string;
  status: string;
};

export type RelatedActionUi = {
  id: string;
  caseId: string;
  description: string;
  status: string;
};

export type ReversalChainItemUi = {
  bukrs: string;
  belnr: string;
  gjahr: string;
  budat: string;
  blart: string;
  wrbtr: number;
  waers: string;
};

const docKey = (bukrs: string, belnr: string, gjahr: string) =>
  `${bukrs}-${belnr}-${gjahr}`;

export const toDocumentDetailUi = (raw: FiDocDetailRaw): DocumentDetailUi => {
  const bukrs = raw.bukrs ?? '';
  const belnr = raw.belnr ?? '';
  const gjahr = raw.gjahr ?? '';
  return {
    id: docKey(bukrs, belnr, gjahr),
    belnr,
    bukrs,
    gjahr,
    budat: raw.budat ?? '',
    bldat: raw.bldat ?? raw.budat ?? '',
    blart: raw.blart ?? '',
    tcode: raw.tcode ?? '',
    usnam: raw.usnam ?? '',
    counterparty: raw.counterparty ?? '',
    counterpartyId: raw.counterpartyId ?? '',
    wrbtr: typeof raw.wrbtr === 'number' ? raw.wrbtr : 0,
    waers: raw.waers ?? '',
    xblnr: raw.xblnr ?? '',
    bktxt: raw.bktxt ?? '',
    tenantId: 0,
    integrityStatus: (raw.integrityStatus as 'pass' | 'warn' | 'fail') ?? 'pass',
    reversalFlag: Boolean(raw.reversalFlag),
    reversedByDoc: raw.reversedByDoc,
    reversesDoc: raw.reversesDoc,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    linkedCasesCount: raw.linkedCasesCount ?? 0,
  };
};

export const toLineItemsUi = (
  raw: FiDocDetailRaw,
  docId: string
): LineItemUi[] => {
  const items = raw.lineItems ?? [];
  return items.map((it, idx) => ({
    id: (it.id as string) ?? `li-${docId}-${idx}`,
    docId,
    buzei: typeof it.buzei === 'number' ? it.buzei : Number(it.buzei) || idx + 1,
    hkont: it.hkont ?? '',
    hkontName: it.hkontName ?? '',
    shkzg: (it.shkzg === 'H' ? 'H' : 'S') as 'S' | 'H',
    wrbtr: typeof it.wrbtr === 'number' ? it.wrbtr : 0,
    mwskz: it.mwskz,
    kostl: it.kostl,
    zuonr: it.zuonr,
    sgtxt: it.sgtxt ?? '',
  }));
};

export const toIntegrityChecksUi = (
  raw: FiDocDetailRaw,
  docId: string
): IntegrityCheckUi[] => {
  const checks = raw.integrityChecks ?? [];
  return checks.map((c, idx) => ({
    id: (c.id as string) ?? `ic-${docId}-${idx}`,
    docId,
    ruleName: c.ruleName ?? '',
    severity: (c.severity as 'info' | 'warn' | 'critical') ?? 'info',
    passed: Boolean(c.passed),
    evidence: c.evidence ?? '',
    recommendation: c.recommendation ?? '',
    relatedCaseId: c.relatedCaseId,
  }));
};

export const toRelatedCasesUi = (raw: FiDocDetailRaw): RelatedCaseUi[] => {
  const cases = raw.relatedCases ?? [];
  return cases.map((c, idx) => ({
    id: (c.id as string) ?? `rc-${idx}`,
    caseNumber: c.caseNumber ?? '',
    title: c.title ?? '',
    severity: c.severity ?? '',
    status: c.status ?? '',
  }));
};

export const toRelatedActionsUi = (raw: FiDocDetailRaw): RelatedActionUi[] => {
  const actions = raw.relatedActions ?? [];
  return actions.map((a, idx) => ({
    id: (a.id as string) ?? `ra-${idx}`,
    caseId: a.caseId ?? '',
    description: a.description ?? '',
    status: a.status ?? '',
  }));
};

export const toReversalChainUi = (
  raw: FiDocDetailRaw,
  currentDocId: string
): ReversalChainItemUi[] => {
  const chain = raw.reversalChain ?? [];
  if (chain.length === 0 && (raw.reversesDoc || raw.reversedByDoc)) {
    return [];
  }
  return chain.map((c) => ({
    bukrs: c.bukrs ?? '',
    belnr: c.belnr ?? '',
    gjahr: c.gjahr ?? '',
    budat: c.budat ?? '',
    blart: c.blart ?? '',
    wrbtr: typeof c.wrbtr === 'number' ? c.wrbtr : 0,
    waers: c.waers ?? '',
  }));
};
