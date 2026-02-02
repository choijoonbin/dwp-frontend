// ----------------------------------------------------------------------

/**
 * Admin 페이지 등에서 사용자가 Tenant를 선택했을 때의 override.
 * 설정 시 getTenantId()가 이 값을 반환하여 API 호출 시 X-Tenant-ID로 사용됨.
 */
let tenantIdOverride: string | null = null;

/**
 * Tenant ID override 설정 (Admin Tenant Selector 등에서 사용)
 * @param id - Tenant ID 문자열, null이면 override 해제
 */
export const setTenantIdOverride = (id: string | null): void => {
  tenantIdOverride = id;
};

/**
 * Extracts the tenant ID from the current hostname.
 * Example: 'client-a.dwp.com' -> 'client-a'
 *
 * Admin Tenant Selector에서 setTenantIdOverride()로 설정된 값이 있으면 우선 반환.
 *
 * TODO: 테스트용으로 기본값 "1"을 사용 중입니다.
 * Auth Server 테스트를 위해 X-Tenant-ID 헤더에 "1"을 전달합니다.
 * 향후 실제 테넌트 ID 추출 로직으로 변경 예정입니다.
 *
 * 테스트 API 호출 예시:
 * - GET http://localhost:8080/api/auth/policy (Headers: X-Tenant-ID: "1")
 * - GET http://localhost:8080/api/auth/idp (Headers: X-Tenant-ID: "1")
 * - POST http://localhost:8080/api/monitoring/page-view (Headers: X-Tenant-ID: "1")
 *
 * 향후 구현 예정 로직:
 * - const hostname = window.location.hostname;
 * - Local development or IP address 처리
 * - Subdomain 기반 tenant ID 추출
 */
export const getTenantId = (): string => tenantIdOverride ?? '1';
