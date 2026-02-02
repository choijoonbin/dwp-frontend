# Admin API 성공 응답 형식 약속 요청 (FE → BE)

- **작성일**: 2026-02-02
- **목적**: Admin 사용자/역할 등 API 호출 시 **성공 여부 판단**을 프론트와 백엔드가 동일한 기준으로 사용할 수 있도록 응답 형식을 약속합니다.
- **관련**: 사용자 삭제, 역할 할당 저장 등에서 “요청이 성공적으로 처리되었습니다” 메시지는 나오나 팝업이 닫히지 않거나, 토스트가 빨간색(에러)으로 표시되던 문제를 방지하기 위함.

---

## 1. 배경

- FE는 `ApiResponse<T>` 형식을 기준으로 성공/실패를 판단합니다.
- 일부 Admin API(삭제, 역할 할당 등)가 **HTTP 200 + status: "SUCCESS" + message** 로 성공을 반환하지만, **data** 필드가 없거나 **data.success** 가 없는 경우가 있습니다.
- FE는 초기에 **`res.data?.success === true`** 일 때만 성공으로 처리했고, 위와 같은 응답에서는 **실패로 간주**하여:
  - 다이얼로그/팝업을 닫지 않거나
  - 에러(빨간색) 토스트로 메시지를 표시하는 문제가 있었습니다.
- 현재 FE는 **임시로** `res.status === 'SUCCESS'` 이면 성공으로 처리하는 fallback을 넣었습니다. 장기적으로는 **BE 응답 형식을 한 번 약속**하는 것이 좋습니다.

---

## 2. 요청 사항 (BE 측 검토 요청)

### 2.1 성공 응답 시 공통 규칙

다음 중 **하나**를 선택해 통일해 주시면 FE가 그에 맞춰 처리하겠습니다.

**옵션 A (권장)**  
- 성공 시 **항상** `data` 에 성공 여부를 명시합니다.
- 예: `{ "status": "SUCCESS", "message": "요청이 성공적으로 처리되었습니다", "data": { "success": true }, "timestamp": "..." }`
- FE: `res.data?.success === true` 또는 `res.status === 'SUCCESS'` 둘 다 만족할 때만 성공으로 처리 가능.

**옵션 B**  
- 성공 시 `data` 없이 `status` 와 `message` 만 반환해도 됨을 스펙으로 명시합니다.
- 예: `{ "status": "SUCCESS", "message": "요청이 성공적으로 처리되었습니다", "data": null, "timestamp": "..." }`
- FE: `res.status === 'SUCCESS'` 이면 성공으로 처리 (현재 fallback과 동일).

**옵션 C**  
- 기존 dwp-core `ApiResponse<T>` 규격에서, **성공 시 data 필수/선택** 및 **성공 여부 판단 기준**을 문서로 한 줄 정의해 주세요.
- 예: “성공 시에는 반드시 `status: 'SUCCESS'` 를 담고, payload가 없는 경우 `data: { success: true }` 를 권장한다” 등.

### 2.2 대상 API (우선 적용 희망)

| 메서드 | 경로 | 비고 |
|--------|------|------|
| DELETE | `/api/admin/users/:userId` | 사용자 삭제 |
| PUT | `/api/admin/users/:userId/roles` | 사용자 역할 할당 |
| POST | `/api/admin/users/:userId/reset-password` | 비밀번호 초기화 |
| (기타) | Admin 영역에서 “성공 시 UI 닫기/초록 토스트” 가 필요한 모든 API | 동일 규칙 적용 |

---

## 3. FE 현재 동작 (참고)

- **성공 판단**: `res.status === 'SUCCESS'` **또는** `res.data?.success === true` 이면 성공으로 처리합니다.
- **삭제**: `DELETE /api/admin/users/:userId` 호출 (문서대로 DELETE 사용).
- **역할 할당**: 성공 시 `onClose()` 호출로 팝업 닫기, `showSnackbar(..., 'success')` 로 초록 토스트 표시.

---

## 4. 요청 정리

1. **성공 응답** 시 `status` / `data` / `data.success` 사용 규칙을 **한 가지로 정리**해 주세요.
2. 위 규칙을 **공통 스펙 또는 Admin API 스펙**에 반영해 주시면, FE는 해당 스펙에 맞춰 유지/정리하겠습니다.
3. (선택) 응답 예시(성공 1종, 실패 1종)를 스펙 문서에 추가해 주시면 FE 연동 시 혼선이 줄어듭니다.

---

## 5. 결과 공유

- 확정된 규칙은 `docs/api-spec/` 또는 `docs/api-spec/synapse-spec/` 쪽 **기존 Admin 스펙 문서**에 반영해 주시거나,
- `FRONTEND_API_REQUEST_ADMIN_SUCCESS_RESPONSE_CONTRACT_result.md` 형태로 요약해 주시면 FE에서 그에 맞춰 코드/주석을 정리하겠습니다.
