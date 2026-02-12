import { useQuery } from '@tanstack/react-query';

import { getAgentCatalog } from '@dwp-frontend/shared-utils';

const CATALOG_QUERY_KEY = ['synapse', 'agents', 'catalog'];

const CATALOG_ERROR_MESSAGE = '기초 코드 정보를 불러오지 못했습니다';

/** 에이전트 스튜디오/ RAG 등에서 사용하는 코드 목록. BE catalog API 동기화. */
export const useAgentCatalog = () => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: CATALOG_QUERY_KEY,
    queryFn: () => getAgentCatalog(),
  });
  const catalog = data?.data;
  return {
    models: catalog?.models ?? [],
    domains: catalog?.domains ?? [],
    docTypes: catalog?.docTypes ?? [],
    isLoading,
    isError,
    errorMessage: isError ? (error instanceof Error ? error.message : CATALOG_ERROR_MESSAGE) : null,
    catalogErrorMessage: CATALOG_ERROR_MESSAGE,
  };
};
