/**
 * 거래처 목록 필터 (API spec: type, country, q)
 */
export type EntityFilters = {
  type?: 'VENDOR' | 'CUSTOMER' | '';
  country?: string;
  q?: string;
};
