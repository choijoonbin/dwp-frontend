# FE/BE 계약 정합성 체크리스트 (FE 시점)

> **최종 업데이트**: 2026-01-22  
> **목적**: FE가 안정화된 지금, FE/BE 계약이 "운영 수준으로 맞는지" 점검

---

## 🎯 목표

1. **FE/BE 계약 불일치** 조기 발견
2. **운영 위험 요소** 사전 제거
3. **수동 검증 시나리오** 정립

---

## 📋 4대 핵심 점검 항목

### 1️⃣ Menu Tree 권한 필터링 정합성 ✅

#### 확인 API
```
GET /api/auth/menus/tree
```

#### 검증 포인트

**1-1. 권한 없는 유저로 로그인 시 트리 필터링**
- ✅ 권한 없는 메뉴가 **아예 제외**되어 내려오는가?
- ✅ `children` 구조가 FE가 렌더링하기 충분히 안정적인가?
- ❌ FE에서 권한 체크를 "추가로" 해야 하는가? (이러면 안 됨)

**1-2. sortOrder 기반 정렬**
- ✅ `sortOrder` 필드가 모든 메뉴에 존재하는가?
- ✅ `sortOrder` 누락 시 fallback 정렬이 FE에서 적용되는가?
- ✅ Sidebar가 FE 추론 없이 API `children` 트리 그대로 렌더링 가능한가?

**1-3. 계층 구조 안정성**
- ✅ 부모-자식 관계가 명확한가?
- ✅ 순환 참조가 없는가?
- ✅ `parentMenuId`가 실제 존재하는 메뉴를 가리키는가?

#### ✅ Pass 기준
- Sidebar는 FE 추론 없이 API `children` 트리 그대로 정상 렌더링
- 권한 필터링이 100% 백엔드에서 처리됨

#### ❌ Fail 징후
- FE에서 `menu.*` dotted key를 파싱하여 트리를 "추론"해야 함
- FE에서 권한 체크를 추가로 해야 메뉴가 정상 작동함
- 순환 참조로 인한 무한 루프

#### 🔍 수동 검증 시나리오
```bash
# 1. Admin 계정으로 로그인
# 2. Sidebar 메뉴 확인 → 모든 메뉴 표시됨

# 3. 권한 제한 계정으로 로그인 (또는 권한 제거)
# 4. Sidebar 메뉴 확인 → 제한된 메뉴가 보이지 않음
# 5. 제한된 메뉴 URL 직접 접근 → 403 or 리다이렉트

# 6. Network 탭에서 /api/auth/menus/tree 응답 확인
# 7. children 구조가 실제 Sidebar와 일치하는지 확인
```

---

### 2️⃣ Permissions API가 UI_COMPONENT까지 커버하는지 ✅

#### 확인 API
```
GET /api/auth/permissions
```

#### 검증 포인트

**2-1. UI_COMPONENT 권한 타입 지원**
- ✅ `MENU` 뿐 아니라 `UI_COMPONENT`(버튼/탭/액션 단위)가 함께 내려오는가?
- ✅ `PermissionGate`가 필요한 화면에서 버튼 숨김/disabled가 규칙대로 동작하는가?
- ❌ 메뉴 숨김만으로 보안이 끝이라고 가정하는가? (이러면 안 됨)

**2-2. Permission 응답 구조**
- ✅ `resourceKey` + `actionKey` 조합이 명확한가?
- ✅ FE가 `hasPermission(resourceKey, actionKey)` 형태로 간단히 체크 가능한가?
- ✅ 응답이 tenant별로 격리되는가?

**2-3. PermissionGate 동작**
- ✅ 권한 없는 버튼이 숨겨지는가?
- ✅ 권한 없는 탭이 비활성화되는가?
- ✅ 권한 없을 때 "403 UX"가 표시되는가? (빈 화면 아님)

#### ✅ Pass 기준
- "메뉴 숨김만으로 보안이 끝"이 아니라 **버튼 단위도 적용**됨
- FE는 `hasPermission` 유틸로 간단히 권한 체크 가능

#### ❌ Fail 징후
- `UI_COMPONENT` 타입이 없고 `MENU`만 있음
- PermissionGate가 제대로 작동하지 않음 (버튼이 항상 표시됨)
- 권한 없을 때 빈 화면 or 크래시

#### 🔍 수동 검증 시나리오
```bash
# 1. Admin 계정으로 로그인
# 2. Users 페이지 → "추가" 버튼 표시됨

# 3. 권한 제한 계정으로 로그인 (USER_CREATE 권한 제거)
# 4. Users 페이지 → "추가" 버튼 숨겨짐 또는 disabled
# 5. Network 탭에서 /api/auth/permissions 응답 확인
# 6. UI_COMPONENT 타입 권한이 포함되어 있는지 확인
```

---

### 3️⃣ CodeUsage API 테넌트 격리/보안 ✅

#### 확인 API
```
GET /api/admin/codes/usage?resourceKey=menu.admin.users
```

#### 검증 포인트

**3-1. Tenant ID 필터링 강제**
- ✅ `tenant_id` 필터링이 서버에서 강제되는가?
- ✅ 다른 tenant의 CodeUsage가 절대 노출되지 않는가?
- ❌ FE에서 tenant_id를 직접 넣어야 하는가? (이러면 안 됨)

**3-2. ResourceKey 기반 매핑**
- ✅ 특정 메뉴(`menu.admin.users`)에서 그 메뉴에 매핑된 코드 그룹**만** 내려오는가?
- ✅ FE는 메뉴별로 필요한 코드만 받아서 렌더링하는가?
- ❌ `/api/admin/codes/all`을 FE에서 사용하는가? (보안 위험)

**3-3. 매핑 없을 때 UX**
- ✅ 매핑이 없으면 dropdown이 disabled + "코드 매핑 필요" helper text가 표시되는가?
- ✅ 매핑 없어도 페이지가 크래시하지 않는가?

#### ✅ Pass 기준
- FE는 메뉴별로 필요한 코드만 받아서 렌더링
- 매핑 없으면 **"disabled + 코드 매핑 필요" UX** 유지
- Tenant 격리 100% 서버에서 처리

#### ❌ Fail 징후
- FE에서 tenant_id를 직접 넣어야 함
- `/api/admin/codes/all`을 사용 (모든 코드 노출 위험)
- 매핑 없을 때 페이지 크래시 또는 빈 dropdown (helper text 없음)

#### 🔍 수동 검증 시나리오
```bash
# 1. Admin 계정으로 로그인
# 2. Users 페이지 → "추가" 클릭
# 3. Form에서 selectbox(상태, 역할 등) 확인

# 4. Network 탭에서 /api/admin/codes/usage 요청 확인
# 5. resourceKey가 제대로 전달되는지 확인
# 6. 응답에 매핑된 코드 그룹만 있는지 확인

# 7. Code Usages 관리 페이지에서 특정 매핑 삭제
# 8. Users 페이지 다시 진입 → selectbox disabled + helper text 확인
```

---

### 4️⃣ Monitoring Events 필터가 표준 UI_ACTION 기반인지 ✅

#### 확인 API
```
GET /api/admin/monitoring/events?action=VIEW&...
POST /api/monitoring/event
```

#### 검증 포인트

**4-1. action 필드 normalize**
- ✅ `action`이 대소문자 섞여 들어와도 BE에서 normalize 되는가?
- ✅ FE는 `trackEvent({ action: 'CLICK' })`로 전송하면 되는가?
- ❌ FE에서 대소문자를 맞춰야 하는가? (이러면 안 됨)

**4-2. Events 탭 selectbox**
- ✅ Events 탭 action selectbox는 **하드코딩 없이** 코드 기반으로 로딩되는가?
- ✅ 표준 액션(`CLICK`, `VIEW`, `EXECUTE`, `SEARCH`, `FILTER` 등)만 노출되는가?
- ❌ FE에서 action 리스트를 하드코딩하는가? (이러면 안 됨)

**4-3. 조회 필터 조건**
- ✅ `action` / `eventType` 필터 조건이 실제 서버 필터와 일치하는가?
- ✅ FE에서 보낸 필터가 BE에서 정확히 적용되는가?
- ✅ 페이징이 정상 작동하는가?

#### ✅ Pass 기준
- **"CLICK/VIEW/EXECUTE…" 표준 액션**으로 수집/조회가 일관됨
- Events 탭 selectbox는 코드 기반 (하드코딩 없음)
- action normalize가 BE에서 처리됨

#### ❌ Fail 징후
- FE에서 action 리스트를 하드코딩 (`['CLICK', 'VIEW', ...]`)
- action 대소문자가 안 맞으면 필터링 안 됨
- Events 탭에서 조회 시 결과가 맞지 않음

#### 🔍 수동 검증 시나리오
```bash
# 1. Admin 계정으로 로그인
# 2. Monitoring 페이지 → "Events" 탭 선택
# 3. Action selectbox 확인 → 표준 액션만 표시되는지 확인

# 4. "CLICK" 선택 후 조회
# 5. Network 탭에서 /api/admin/monitoring/events 요청 확인
# 6. action=CLICK 파라미터가 제대로 전달되는지 확인
# 7. 응답이 CLICK 액션만 포함하는지 확인

# 8. Users 페이지에서 "추가" 버튼 클릭
# 9. Monitoring Events 탭에서 해당 이벤트가 기록되는지 확인
```

---

## 🔍 FE 최종 확인 시나리오 (10분 체크리스트)

### ✅ 시나리오 1: Admin 계정 로그인
```bash
1. 로그인 → /admin/monitoring
2. Sidebar 메뉴 확인 (모든 메뉴 표시)
3. Events 탭 → action selectbox 옵션 확인 (표준 액션만)
4. "CLICK" 선택 → 조회 결과 확인
```

### ✅ 시나리오 2: Monitoring Events 필터 동작
```bash
1. Monitoring 페이지 → Events 탭
2. Action: "VIEW" 선택 → 조회
3. Network 탭 → action=VIEW 전달되는지 확인
4. 응답이 VIEW 액션만 포함하는지 확인
```

### ✅ 시나리오 3: User CRUD 전체 플로우
```bash
1. Users 페이지 → "추가" 버튼 클릭
2. Form 열림 → selectbox(상태/역할) 옵션 로딩 확인
3. 정보 입력 → "저장" → 성공 메시지
4. 목록에서 방금 추가한 사용자 확인
5. "편집" → 정보 수정 → "저장" → 성공
6. "삭제" → ConfirmDialog → "확인" → 삭제 완료
```

### ✅ 시나리오 4: CodeUsage Dropdown Disabled (매핑 없음)
```bash
1. Code Usages 관리 페이지
2. 특정 resourceKey(예: menu.admin.test) 매핑이 없는 상태 확인
3. Test 페이지 진입 (또는 User 페이지)
4. Form 열림 → selectbox disabled + "코드 매핑 필요" helper text 확인
```

### ✅ 시나리오 5: 권한 제한 계정 테스트
```bash
1. 권한 제한 계정으로 로그인 (또는 권한 제거)
2. Sidebar 메뉴 확인 → 제한된 메뉴 숨겨짐
3. Users 페이지 → "추가" 버튼 숨겨짐 또는 disabled
4. 제한된 메뉴 URL 직접 접근 → 403 or 리다이렉트
5. 무한 루프 없이 안정적인 상태 유지
```

### ✅ 시나리오 6: E2E Smoke Test PASS
```bash
1. yarn dev
2. yarn test:e2e:auth-setup (인증 파일 생성)
3. yarn test:e2e (전체 테스트 실행)
4. Desktop + Mobile 모두 PASS 확인
```

---

## 📊 점검 결과 기록 템플릿

```markdown
### FE/BE 계약 정합성 점검 결과

**점검 날짜**: YYYY-MM-DD  
**점검자**: [이름]

#### 1️⃣ Menu Tree 권한 필터링
- [ ] 권한 필터링 서버 처리 확인
- [ ] sortOrder 기반 정렬 확인
- [ ] Sidebar 렌더링 정상
- **결과**: ✅ PASS / ❌ FAIL
- **이슈**: [있으면 기록]

#### 2️⃣ Permissions API (UI_COMPONENT)
- [ ] UI_COMPONENT 타입 포함 확인
- [ ] PermissionGate 버튼 숨김 동작
- [ ] 권한 없을 때 403 UX 표시
- **결과**: ✅ PASS / ❌ FAIL
- **이슈**: [있으면 기록]

#### 3️⃣ CodeUsage API 테넌트 격리
- [ ] Tenant ID 필터링 강제 확인
- [ ] ResourceKey 기반 매핑 확인
- [ ] 매핑 없을 때 UX 정상 (disabled + helper text)
- **결과**: ✅ PASS / ❌ FAIL
- **이슈**: [있으면 기록]

#### 4️⃣ Monitoring Events 표준 UI_ACTION
- [ ] action normalize 확인
- [ ] Events 탭 selectbox 코드 기반 로딩
- [ ] 조회 필터 조건 일치
- **결과**: ✅ PASS / ❌ FAIL
- **이슈**: [있으면 기록]

#### 🔍 수동 시나리오 (6개)
- [ ] 시나리오 1: Admin 계정 로그인
- [ ] 시나리오 2: Monitoring Events 필터
- [ ] 시나리오 3: User CRUD 전체 플로우
- [ ] 시나리오 4: CodeUsage Dropdown Disabled
- [ ] 시나리오 5: 권한 제한 계정 테스트
- [ ] 시나리오 6: E2E Smoke Test PASS

#### 🎯 종합 결과
- **전체 점검 결과**: ✅ PASS / ⚠️ WARNING / ❌ FAIL
- **주요 이슈**: [요약]
- **후속 조치**: [필요한 조치]
```

---

## 🚨 이슈 발견 시 대응 프로세스

### 1. 즉시 보고
- Slack/이슈 트래커에 즉시 보고
- 제목: `[FE/BE 계약 이슈] [항목명]`
- 내용: 위 점검 결과 템플릿 사용

### 2. 우선순위 판단
- **P0 (긴급)**: 보안 이슈, Tenant 격리 실패, 무한 루프
- **P1 (높음)**: 권한 체크 실패, CodeUsage 크래시
- **P2 (중간)**: UX 불편, 필터 미작동
- **P3 (낮음)**: 문서 불일치, 작은 버그

### 3. 수정 요청
- BE 팀에 API 수정 요청 (또는 FE 수정)
- ADR 작성 (계약 변경 시)
- 테스트 추가 (회귀 방지)

### 4. 재검증
- 수정 후 위 체크리스트 재실행
- E2E 테스트 PASS 확인
- 문서 업데이트

---

## 📖 관련 문서

- [Admin CRUD Standard](../essentials/ADMIN_CRUD_STANDARD.md)
- [E2E Smoke Tests](./E2E_SMOKE_TESTS.md)
- [Design System](../essentials/DESIGN_SYSTEM.md)

---

**FE/BE 계약은 운영 안정성의 핵심입니다. 정기적으로 점검하여 불일치를 조기에 발견합시다! 🔍**
