// ----------------------------------------------------------------------

/**
 * Extracts the tenant ID from the current hostname.
 * Example: 'client-a.dwp.com' -> 'client-a'
 * 
 * TODO: 테스트용으로 기본값 "1"을 사용 중입니다.
 * Auth Server 테스트를 위해 X-Tenant-ID 헤더에 "1"을 전달합니다.
 * 향후 실제 테넌트 ID 추출 로직으로 변경 예정입니다.
 * 
 * 테스트 API 호출 예시:
 * - GET http://localhost:8080/api/auth/policy (Headers: X-Tenant-ID: "1")
 * - GET http://localhost:8080/api/auth/idp (Headers: X-Tenant-ID: "1")
 * - POST http://localhost:8080/api/monitoring/page-view (Headers: X-Tenant-ID: "1")
 */
export const getTenantId = (): string => {
  // TODO: 테스트용 하드코딩 - 향후 실제 테넌트 ID 추출 로직으로 변경 필요
  return '1';

  // 아래 코드는 향후 사용 예정
  // const hostname = window.location.hostname;
  // 
  // // Local development or IP address
  // if (hostname === 'localhost' || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
  //   return 'dev'; // DB에 code='dev'인 tenant가 있음
  // }
  //
  // const parts = hostname.split('.');
  // if (parts.length >= 3) {
  //   return parts[0];
  // }
  //
  // return 'dev'; // DB에 code='dev'인 tenant가 있음
};
