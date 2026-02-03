/**
 * SynapseX Phase 1 — Data & Trust API
 * /documents, /open-items, /entities, /lineage
 * 기존 /api/synapse/entities/* 활용 + 향후 확장
 */

import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

export type FiDocHeaderRaw = {
  tenantId: number;
  bukrs: string;
  belnr: string;
  gjahr: string;
  budat: string;
  waers: string;
  xblnr: string;
  statusCode: string;
};

export type FiDocHeaderListItem = {
  bukrs: string;
  belnr: string;
  gjahr: string;
  budat: string;
  waers: string;
  xblnr: string;
  statusCode: string;
  docKey: string;
  counterparty?: string;
  counterpartyId?: string;
  wrbtr?: number;
  blart?: string;
  tcode?: string;
  usnam?: string;
  integrityStatus?: 'pass' | 'warn' | 'fail';
  hasReversal?: boolean;
  openItemCount?: number;
  linkedCasesCount?: number;
};

export type FiOpenItemRaw = {
  tenantId: number;
  bukrs: string;
  belnr: string;
  gjahr: string;
  buzei: string;
  itemType: string;
  openAmount: number;
  currency: string;
  dueDate: string;
};

export type FiOpenItemListItem = {
  id: string;
  bukrs: string;
  belnr: string;
  gjahr: string;
  buzei: string;
  docId: string;
  docNumber: string;
  entityId: string;
  entityName: string;
  type: 'AR' | 'AP';
  amount: number;
  currency: string;
  dueDate: string;
  daysPastDue: number;
  status: 'open' | 'partially_cleared' | 'cleared';
  disputeFlag: boolean;
  paymentBlock: boolean;
  blockReason?: string;
  companyCode: string;
};

export type EntityListItem = {
  id: string;
  code: string;
  name: string;
  type: 'vendor' | 'customer';
  country: string;
  riskScore: number;
  openItemsTotal: number;
  openItemsCount: number;
  totalBalance?: number;
  lastChange?: string;
  riskTrend?: 'up' | 'down' | 'stable';
};

export type LineageStep = {
  id: string;
  label: string;
  type: string;
  status: string;
  timestamp?: string;
};

export type LineageResponse = {
  steps: LineageStep[];
  evidence?: unknown;
  timeTravelSnapshots?: unknown;
};

// ----------------------------------------------------------------------
// Documents API
// ----------------------------------------------------------------------

export type DocumentsListParams = {
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
  bukrs?: string;
  status?: string;
  hasReversal?: boolean;
  usnam?: string;
  tcode?: string;
  xblnr?: string;
  amountMin?: number;
  amountMax?: number;
  page?: number;
  size?: number;
  /** sort=필드명,asc | sort=필드명,desc (예: budat,desc) */
  sort?: string;
};

/**
 * GET /api/synapse/entities/fi-doc-headers
 * BE가 지원하는 필터: limit, page, size. dateFrom, dateTo, bukrs, status 등은 BE 확장 시 자동 적용
 */
export const getFiDocHeaders = async (
  params?: DocumentsListParams
): Promise<ApiResponse<FiDocHeaderListItem[]>> => {
  const query = new URLSearchParams();
  query.set('limit', String(params?.limit ?? 500));
  if (params?.page != null) query.set('page', String(params.page));
  if (params?.size != null) query.set('size', String(params.size));
  if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params?.dateTo) query.set('dateTo', params.dateTo);
  if (params?.bukrs) query.set('bukrs', params.bukrs);
  if (params?.status) query.set('status', params.status);
  if (params?.hasReversal != null) query.set('hasReversal', String(params.hasReversal));
  if (params?.usnam) query.set('usnam', params.usnam);
  if (params?.tcode) query.set('tcode', params.tcode);
  if (params?.xblnr) query.set('xblnr', params.xblnr);
  if (params?.amountMin != null) query.set('amountMin', String(params.amountMin));
  if (params?.amountMax != null) query.set('amountMax', String(params.amountMax));
  if (params?.sort) query.set('sort', params.sort);

  const res = await axiosInstance.get<ApiResponse<FiDocHeaderRaw[]>>(
    `/api/synapse/entities/fi-doc-headers?${query.toString()}`
  );
  const apiRes = res.data;

  if (!apiRes?.data) {
    return apiRes as unknown as ApiResponse<FiDocHeaderListItem[]>;
  }

  const mapped: FiDocHeaderListItem[] = apiRes.data.map((r) => ({
    belnr: r.belnr,
    blart: undefined,
    budat: String(r.budat),
    bukrs: r.bukrs,
    counterparty: undefined,
    counterpartyId: undefined,
    docKey: `${r.bukrs}-${r.belnr}-${r.gjahr}`,
    gjahr: r.gjahr,
    hasReversal: undefined,
    integrityStatus: undefined,
    linkedCasesCount: undefined,
    openItemCount: undefined,
    statusCode: r.statusCode,
    tcode: undefined,
    usnam: undefined,
    waers: r.waers,
    wrbtr: undefined,
    xblnr: r.xblnr,
  }));

  return { ...apiRes, data: mapped };
};

/** BE 전표 상세 응답 (확장 가능) */
export type FiDocDetailRaw = {
  bukrs?: string;
  belnr?: string;
  gjahr?: string;
  budat?: string;
  bldat?: string;
  blart?: string;
  tcode?: string;
  usnam?: string;
  counterparty?: string;
  counterpartyId?: string;
  wrbtr?: number;
  waers?: string;
  xblnr?: string;
  bktxt?: string;
  statusCode?: string;
  integrityStatus?: 'pass' | 'warn' | 'fail';
  reversalFlag?: boolean;
  reversedByDoc?: string;
  reversesDoc?: string;
  linkedCasesCount?: number;
  createdAt?: string;
  lineItems?: Array<{
    id?: string;
    buzei?: number | string;
    hkont?: string;
    hkontName?: string;
    shkzg?: 'S' | 'H';
    wrbtr?: number;
    mwskz?: string;
    kostl?: string;
    zuonr?: string;
    sgtxt?: string;
  }>;
  integrityChecks?: Array<{
    id?: string;
    ruleName?: string;
    severity?: 'info' | 'warn' | 'critical';
    passed?: boolean;
    evidence?: string;
    recommendation?: string;
    relatedCaseId?: string;
  }>;
  relatedCases?: Array<{ id?: string; caseNumber?: string; title?: string; severity?: string; status?: string }>;
  relatedActions?: Array<{ id?: string; caseId?: string; description?: string; status?: string }>;
  reversalChain?: Array<{ bukrs?: string; belnr?: string; gjahr?: string; budat?: string; blart?: string; wrbtr?: number; waers?: string }>;
};

/**
 * 전표 상세 — BE 404 시 mock fallback 없음 (Phase 1 mock 제거)
 * GET /api/synapse/entities/fi-doc-headers/{bukrs}/{belnr}/{gjahr}
 */
export const getFiDocDetail = async (
  bukrs: string,
  belnr: string,
  gjahr: string
): Promise<ApiResponse<FiDocDetailRaw | null>> => {
  const res = await axiosInstance.get<ApiResponse<FiDocDetailRaw | null>>(
    `/api/synapse/entities/fi-doc-headers/${encodeURIComponent(bukrs)}/${encodeURIComponent(belnr)}/${encodeURIComponent(gjahr)}`
  );
  return res.data;
};

// ----------------------------------------------------------------------
// Open Items API
// ----------------------------------------------------------------------

export type OpenItemsListParams = {
  limit?: number;
  dueFrom?: string;
  dueTo?: string;
  cleared?: boolean;
  paymentBlock?: boolean;
  disputeFlag?: boolean;
  itemType?: 'AP' | 'AR';
  bukrs?: string;
  partyId?: string;
  docKey?: string;
  page?: number;
  size?: number;
};

/**
 * GET /api/synapse/entities/fi-open-items
 */
export const getFiOpenItems = async (
  params?: OpenItemsListParams
): Promise<ApiResponse<FiOpenItemListItem[]>> => {
  const query = new URLSearchParams();
  query.set('limit', String(params?.limit ?? 500));
  if (params?.page != null) query.set('page', String(params.page));
  if (params?.size != null) query.set('size', String(params.size));

  const res = await axiosInstance.get<ApiResponse<FiOpenItemRaw[]>>(
    `/api/synapse/entities/fi-open-items?${query.toString()}`
  );
  const apiRes = res.data;

  if (!apiRes?.data) {
    return apiRes as unknown as ApiResponse<FiOpenItemListItem[]>;
  }

  const mapped: FiOpenItemListItem[] = apiRes.data.map((r, idx) => {
    const openAmount = typeof r.openAmount === 'number' ? r.openAmount : Number(r.openAmount) || 0;
    const dueDate = String(r.dueDate ?? '');
    const dueMs = dueDate ? new Date(dueDate).getTime() : 0;
    const daysPastDue = dueMs ? Math.max(0, Math.floor((Date.now() - dueMs) / 86400000)) : 0;

    return {
      amount: openAmount,
      belnr: r.belnr,
      blockReason: undefined,
      bukrs: r.bukrs,
      buzei: r.buzei,
      companyCode: r.bukrs,
      currency: r.currency ?? '',
      docId: `${r.bukrs}-${r.belnr}-${r.gjahr}`,
      docNumber: r.belnr,
      disputeFlag: false,
      dueDate,
      daysPastDue,
      entityId: '',
      entityName: '',
      gjahr: r.gjahr,
      id: `oi-${r.bukrs}-${r.belnr}-${r.gjahr}-${r.buzei}-${idx}`,
      paymentBlock: false,
      status: 'open',
      type: (r.itemType === 'AR' ? 'AR' : 'AP') as 'AR' | 'AP',
    };
  });

  return { ...apiRes, data: mapped };
};

// ----------------------------------------------------------------------
// Entities API (BE 미구현 — placeholder)
// ----------------------------------------------------------------------

export type EntitiesListParams = {
  type?: 'vendor' | 'customer';
  riskLevel?: string;
  highExposure?: boolean;
  page?: number;
  size?: number;
};

/**
 * GET /api/synapse/entities/parties — BpParty 기반, Controller 미구현
 * (경로: /entities와 fi-doc-headers 등과 구분)
 */
export const getEntities = async (
  params?: EntitiesListParams
): Promise<ApiResponse<EntityListItem[]>> => {
  const query = new URLSearchParams();
  if (params?.type) query.set('type', params.type);
  if (params?.page != null) query.set('page', String(params.page));
  if (params?.size != null) query.set('size', String(params.size));

  const url = `/api/synapse/entities/parties${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<EntityListItem[]>>(url);
  return res.data;
};

/**
 * GET /api/synapse/entities/parties/{partyId} — Entity 360
 */
export const getEntityDetail = async (
  partyId: string
): Promise<ApiResponse<unknown>> => {
  const res = await axiosInstance.get<ApiResponse<unknown>>(
    `/api/synapse/entities/parties/${encodeURIComponent(partyId)}`
  );
  return res.data;
};

// ----------------------------------------------------------------------
// Lineage API (BE 미구현 — placeholder)
// ----------------------------------------------------------------------

export type LineageParams = {
  caseId?: string;
  docKey?: string;
  rawEventId?: string;
  partyId?: string;
  asOf?: string;
};

/**
 * GET /api/synapse/lineage
 */
export const getLineage = async (
  params?: LineageParams
): Promise<ApiResponse<LineageResponse>> => {
  const query = new URLSearchParams();
  if (params?.caseId) query.set('caseId', params.caseId);
  if (params?.docKey) query.set('docKey', params.docKey);
  if (params?.rawEventId) query.set('rawEventId', params.rawEventId);
  if (params?.partyId) query.set('partyId', params.partyId);
  if (params?.asOf) query.set('asOf', params.asOf);

  const url = `/api/synapse/lineage${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<LineageResponse>>(url);
  return res.data;
};
