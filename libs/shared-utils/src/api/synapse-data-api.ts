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

/** BE /api/synapse/entities/parties 응답 항목 */
export type PartyRaw = {
  partyId: number;
  type: 'VENDOR' | 'CUSTOMER';
  name: string;
  country: string | null;
  riskScore: number;
  riskTrend?: string;
  openItemsCount: number;
  openItemsTotal: number;
  overdueCount?: number;
  overdueTotal?: number;
  recentAnomaliesCount?: number;
  lastChangedAt?: string | null;
};

/** BE paginated 응답: data.items 또는 data.data */
type PartiesListResponse = {
  items?: PartyRaw[];
  data?: PartyRaw[];
  total?: number;
  pageInfo?: { page?: number; size?: number; hasNext?: boolean };
};

function toEntityListItem(raw: PartyRaw): EntityListItem {
  const typeLower = (raw.type ?? 'VENDOR').toLowerCase() as 'vendor' | 'customer';
  const riskTrend = raw.riskTrend?.toLowerCase() as 'up' | 'down' | 'stable' | undefined;
  return {
    id: String(raw.partyId),
    code: String(raw.partyId),
    name: raw.name ?? '',
    type: typeLower === 'customer' ? 'customer' : 'vendor',
    country: raw.country ?? '',
    riskScore: Number(raw.riskScore) || 0,
    openItemsTotal: Number(raw.openItemsTotal) || 0,
    openItemsCount: Number(raw.openItemsCount) || 0,
    totalBalance: raw.openItemsTotal,
    lastChange: raw.lastChangedAt ?? undefined,
    riskTrend: riskTrend === 'up' || riskTrend === 'down' || riskTrend === 'stable' ? riskTrend : undefined,
  };
}

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
  page?: number;
  size?: number;
  /** BE: fromDueDate. FE dueFrom → BE fromDueDate */
  dueFrom?: string;
  /** BE: toDueDate. FE dueTo → BE toDueDate */
  dueTo?: string;
  bukrs?: string;
  /** BE: type. AP | AR */
  itemType?: 'AP' | 'AR';
  status?: string;
  partyId?: string;
  /** BE: lifnr (vendor ID) */
  lifnr?: string;
  /** BE: kunnr (customer ID) */
  kunnr?: string;
  docKey?: string;
  cleared?: boolean;
  paymentBlock?: boolean;
  disputeFlag?: boolean;
};

/**
 * GET /api/synapse/entities/fi-open-items
 * BE 계약표: bukrs, type, status, fromDueDate, toDueDate, partyId, lifnr, kunnr
 * belnr, gjahr는 BE 미지원 — P1-2a. docs/reference/OPEN_ITEMS_BELNR_GJAHR_BE_REQUEST.md
 */
export const getFiOpenItems = async (
  params?: OpenItemsListParams
): Promise<ApiResponse<FiOpenItemListItem[]>> => {
  const query = new URLSearchParams();
  query.set('limit', String(params?.limit ?? 500));
  if (params?.page != null) query.set('page', String(params.page));
  if (params?.size != null) query.set('size', String(params.size));
  if (params?.bukrs) query.set('bukrs', params.bukrs);
  if (params?.itemType) query.set('type', params.itemType);
  if (params?.status) query.set('status', params.status);
  if (params?.dueFrom) query.set('fromDueDate', params.dueFrom);
  if (params?.dueTo) query.set('toDueDate', params.dueTo);
  if (params?.partyId) query.set('partyId', params.partyId);
  if (params?.lifnr) query.set('lifnr', params.lifnr);
  if (params?.kunnr) query.set('kunnr', params.kunnr);
  if (params?.docKey) query.set('docKey', params.docKey);
  if (params?.cleared != null) query.set('cleared', String(params.cleared));
  if (params?.paymentBlock != null) query.set('paymentBlock', String(params.paymentBlock));
  if (params?.disputeFlag != null) query.set('disputeFlag', String(params.disputeFlag));

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
  type?: 'VENDOR' | 'CUSTOMER';
  country?: string;
  q?: string;
  page?: number;
  size?: number;
};

/**
 * GET /api/synapse/entities/parties — BpParty 기반
 * BE 응답: { data: { items, data, total, pageInfo } }
 */
export const getEntities = async (
  params?: EntitiesListParams
): Promise<ApiResponse<EntityListItem[]>> => {
  const query = new URLSearchParams();
  if (params?.type) query.set('type', params.type);
  if (params?.country) query.set('country', params.country);
  if (params?.q?.trim()) query.set('q', params.q.trim());
  if (params?.page != null) query.set('page', String(params.page));
  if (params?.size != null) query.set('size', String(params.size));

  const url = `/api/synapse/entities/parties${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<PartiesListResponse>>(url);
  const apiRes = res.data;
  const inner = apiRes?.data;
  const rawList = inner?.items ?? inner?.data ?? [];
  const mapped = Array.isArray(rawList)
    ? rawList.map((r) => toEntityListItem(r as PartyRaw))
    : [];
  return { ...apiRes, data: mapped } as ApiResponse<EntityListItem[]>;
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
