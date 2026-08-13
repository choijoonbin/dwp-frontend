# DWP-R1-ADM-007 API·권한 계약

## Navigation API

- `GET /api/platform/v1/admin/navigation-studio`
- Draft 생성·수정·검증·게시·취소 API
- Published Revision 복원 API

## App Access API

- 구성원 조회·요청·취소 API는 Session User만 대상으로 한다.
- `/api/platform/v1/admin/app-access-requests` Queue와 결정 API는 Reviewer만 사용한다.

서버가 Tenant, Resource, Permission과 Reviewer 권한을 다시 계산한다. 자기 요청의 자기 승인과
Stale Version을 거부하며 승인·반려는 Decision Note를 요구한다. IAM Adapter가 없을 때 성공을
합성하지 않고 `IAM_SYNC_PENDING`을 반환한다.
