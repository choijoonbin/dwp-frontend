# 역할 선택 문제 디버깅 체크리스트

역할을 선택했을 때 우측 상세 패널이 업데이트되지 않는 문제를 진단하기 위한 확인 사항입니다.

## 1. 브라우저 개발자 도구 확인

### 1.1 콘솔(Console) 탭
다음 에러가 있는지 확인:
- `role.id is missing` 또는 `role.id is undefined`
- `TypeError: Cannot read property 'id' of undefined`
- API 호출 관련 에러

### 1.2 네트워크(Network) 탭

#### A. 역할 목록 API 호출 확인
**요청 URL**: `GET /api/admin/roles?size=1000`

**확인할 응답 구조**:
```json
{
  "status": "SUCCESS",
  "data": {
    "items": [
      {
        "id": "1",              // ✅ 필수: 문자열 형태의 id
        "roleCode": "ADMIN",
        "roleName": "Administrator",
        "status": "ACTIVE",     // ✅ 필수: "ACTIVE" 또는 "INACTIVE"
        "description": "...",
        "createdAt": "2026-01-21T...",
        "memberCount": 5         // 선택사항
      }
    ]
  }
}
```

**확인 사항**:
- [ ] `id` 필드가 존재하는가? (문자열 형태인가?)
- [ ] `status` 필드가 존재하는가? ("ACTIVE" 또는 "INACTIVE")
- [ ] `comRoleId` 대신 `id`를 사용하는가?

#### B. 역할 상세 API 호출 확인
역할을 클릭했을 때 다음 API가 호출되는지 확인:

**요청 URL**: `GET /api/admin/roles/{roleId}`

예시: `GET /api/admin/roles/1`

**확인 사항**:
- [ ] 역할을 클릭했을 때 이 API가 호출되는가?
- [ ] `roleId` 값이 올바른가? (예: "1", "2" 등)
- [ ] API 응답이 성공(200)인가?

**예상 응답 구조**:
```json
{
  "status": "SUCCESS",
  "data": {
    "id": "1",
    "roleCode": "ADMIN",
    "roleName": "Administrator",
    "status": "ACTIVE",
    "description": "...",
    "createdAt": "2026-01-21T...",
    "updatedAt": "2026-01-21T..."  // 선택사항
  }
}
```

## 2. 확인해야 할 값들

### 2.1 역할 목록 API 응답 (`/api/admin/roles`)
다음 정보를 복사해서 전달해주세요:

```json
{
  "items": [
    {
      "id": "???",           // ← 이 값 확인
      "comRoleId": "???",    // ← 이 값이 여전히 있는지 확인
      "roleCode": "???",
      "roleName": "???",
      "status": "???",       // ← 이 값 확인
      "description": "???",
      "createdAt": "???",
      "memberCount": "???"   // 선택사항
    }
  ]
}
```

### 2.2 역할 클릭 시 네트워크 요청
역할을 클릭했을 때:
1. **어떤 API가 호출되는가?**
   - URL: `???`
   - Method: `GET` / `POST` / `???`
   - Status Code: `200` / `404` / `500` / `???`

2. **요청 URL에 roleId가 포함되어 있는가?**
   - 예: `/api/admin/roles/1` ✅
   - 예: `/api/admin/roles/` ❌ (roleId 누락)
   - 예: `/api/admin/roles/undefined` ❌ (undefined 전달)

3. **응답 내용은?**
   - 성공 시: 응답 JSON 전체
   - 실패 시: 에러 메시지

### 2.3 브라우저 콘솔 로그
다음 명령어를 콘솔에 입력해서 확인:

```javascript
// 역할 목록 데이터 확인
// React DevTools를 사용하거나, 다음 코드를 콘솔에 입력:
// (역할 목록이 렌더링된 후)
document.querySelectorAll('[data-testid*="role"]').forEach(el => console.log(el.textContent));
```

## 3. 프론트엔드 코드 확인 포인트

### 3.1 역할 카드 클릭 핸들러
파일: `apps/remotes/admin/src/pages/roles/components/role-list-panel.tsx`

```typescript
const handleClick = () => {
  if (role.id) {  // ← role.id가 있는지 확인
    onSelect(role.id);  // ← 이 함수가 호출되는지 확인
  }
};
```

**확인 사항**:
- [ ] `role.id`가 존재하는가?
- [ ] `onSelect(role.id)`가 호출되는가?

### 3.2 역할 선택 상태 관리
파일: `apps/remotes/admin/src/pages/roles/page.tsx`

```typescript
const { selectedRoleId, setSelectedRoleId, ... } = useRoleTableState();
```

**확인 사항**:
- [ ] `selectedRoleId`가 업데이트되는가?
- [ ] `RoleDetailPanel`에 `roleId` prop이 전달되는가?

## 4. 전달해주실 정보

다음 정보를 복사해서 전달해주세요:

### A. 역할 목록 API 응답
```
GET /api/admin/roles?size=1000
응답:
{여기에 전체 응답 JSON 복사}
```

### B. 역할 클릭 시 API 호출
```
클릭한 역할: Administrator (ADMIN)
호출된 API: GET /api/admin/roles/{roleId}
요청 URL: {실제 URL}
응답 상태: {200 / 404 / 500 등}
응답 내용: {응답 JSON 또는 에러 메시지}
```

### C. 브라우저 콘솔 에러
```
{콘솔에 표시된 모든 에러 메시지 복사}
```

### D. 역할 카드의 id 값
브라우저 개발자 도구에서 역할 카드 요소를 선택하고:
- `role.id` 값이 무엇인지 확인
- 또는 네트워크 탭에서 목록 API 응답의 `id` 값 확인

## 5. 예상되는 문제 시나리오

### 시나리오 1: API 응답에 `id` 필드가 없음
**증상**: 역할 목록은 보이지만 클릭해도 반응 없음
**원인**: 백엔드가 `comRoleId`를 `id`로 변경하지 않았거나, `id`가 숫자 형태로 전달됨
**해결**: 백엔드에 `id` 필드(문자열) 추가 요청

### 시나리오 2: `roleId`가 `undefined`로 전달됨
**증상**: 역할 클릭 시 `/api/admin/roles/undefined` 호출
**원인**: `role.id`가 `undefined`이거나 빈 문자열
**해결**: 역할 목록 API 응답의 `id` 필드 확인

### 시나리오 3: API 호출 자체가 안 됨
**증상**: 역할 클릭해도 네트워크 탭에 요청이 없음
**원인**: `onSelect` 핸들러가 호출되지 않거나, `roleId`가 빈 문자열
**해결**: `RoleCard`의 `handleClick` 함수 확인

### 시나리오 4: API는 호출되지만 상세 패널이 업데이트 안 됨
**증상**: 네트워크 탭에서 API 호출은 보이지만 UI가 변경되지 않음
**원인**: `useAdminRoleDetailQuery`가 `roleId` 변경을 감지하지 못함
**해결**: `roleId` prop 전달 확인 및 React Query 캐시 확인

## 6. 빠른 확인 방법

브라우저 개발자 도구 콘솔에 다음을 입력:

```javascript
// 1. 역할 목록 API 직접 호출
fetch('/api/admin/roles?size=1000')
  .then(r => r.json())
  .then(data => {
    console.log('역할 목록:', data);
    console.log('첫 번째 역할의 id:', data.data?.items?.[0]?.id);
    console.log('첫 번째 역할의 comRoleId:', data.data?.items?.[0]?.comRoleId);
  });

// 2. 역할 상세 API 직접 호출 (roleId를 실제 값으로 변경)
fetch('/api/admin/roles/1')  // ← roleId를 실제 값으로 변경
  .then(r => r.json())
  .then(data => {
    console.log('역할 상세:', data);
  });
```

이 결과를 복사해서 전달해주시면 정확한 원인을 파악할 수 있습니다.
