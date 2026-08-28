import { GOVERNED_PRODUCT_MANIFESTS } from '../components/product-manifest-registry';
import { buildDraftProductPageRouteContractSource } from './draft-product-page-route-contract-source';
import { OFFICIAL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE } from './official-product-page-route-contracts';

/**
 * Frontend-owned DRAFT routes for W2/W3. They remain fail-closed in 110/111 until the backend
 * publishes matching product flags, contexts, and exact route decisions.
 */
export const DRAFT_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE = buildDraftProductPageRouteContractSource(
  GOVERNED_PRODUCT_MANIFESTS,
  OFFICIAL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE
);
