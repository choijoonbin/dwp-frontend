/**
 * Documents (전표) 모듈 타입
 */

import type { FiDocHeaderListItem } from '@dwp-frontend/shared-utils';

export type DocumentFilters = {
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
};

export type DocumentListItem = FiDocHeaderListItem;

export type DocumentDetailParams = {
  bukrs: string;
  belnr: string;
  gjahr: string;
};
