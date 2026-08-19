# DWP-R1-ADM-008 API 권한 계약

Base path는 `/api/platform/v1/admin/localization`이다.

| 동작 | Method·Path | 통제 |
| ------------- | ------------------------------- | --------------------------- | ----------- |
| 작업공간 조회 | `GET /` | 현재 테넌트 관리자 |
| 번들 생성 | `POST /bundles` | 관리자, Key·언어·내용 검증 |
| 개정 조회 | `GET /bundles/{id}/revisions` | 동일 테넌트 |
| 다음 초안 | `POST /bundles/{id}/drafts` | 게시본 존재, 열린 개정 없음 |
| 초안 저장 | `PUT /revisions/{id}` | DRAFT와 일치하는 version |
| Diff·Preview | `GET /revisions/{id}/diff       | preview` | 동일 테넌트 |
| 검토 제출 | `POST /revisions/{id}/submit` | 품질 검사 통과 |
| 승인·반려 | `POST /revisions/{id}/decision` | 제출자와 다른 관리자 |
| 게시 | `POST /revisions/{id}/publish` | APPROVED와 일치하는 version |
| 복원 | `POST /revisions/{id}/restore` | 닫힌 과거 개정에서 새 DRAFT |

Gateway가 검증한 Tenant·User·Correlation Header만 신뢰한다. 클라이언트가 임의로 보낸
Identity Header는 Gateway에서 제거되며 모든 변경은 Platform Audit에 전후 상태를 남긴다.
