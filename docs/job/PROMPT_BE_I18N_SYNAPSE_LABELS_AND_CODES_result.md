# [BE 완료] Synapse 화면 라벨/코드 다국어(ko/en) 동기화

> **원본**: docs/job/PROMPT_BE_I18N_SYNAPSE_LABELS_AND_CODES.md  
> **마이그레이션**: V30__i18n_synapse_labels_and_codes.sql

---

## 1. 완료 항목

| 구분 | 항목 | 완료 시 |
|------|------|---------|
| **menus/tree** | §2.2 전체 menuKey에 menuName_ko, menuName_en 저장 | `Accept-Language: ko` → 한글, `en` → 영문 menuName 반환 |
| **sys_codes** | ACTION_TYPE, CASE_STATUS, SEVERITY (필수) | `GET /api/admin/codes?groupKey=XXX` 응답 시 Accept-Language 기반 name 반환 |
| **sys_codes** | ENTITY_TYPE, COUNTRY (선택) | Entities 화면 필터 라벨 BE 제공 완료. FE useCodes로 전환 가능 |
| **동작 확인** | 언어 전환 후 사이드바·코드 라벨 변경 | FE에서 언어 토글 시 Accept-Language 헤더 변경 → BE 즉시 반영 |

---

## 2. API 호출 형식 (확인)

- **코드 조회**: `GET /api/admin/codes?groupKey=CASE_TYPE` (쿼리 파라미터, path 아님)
- **메뉴 트리**: `GET /api/auth/menus/tree`
- **헤더**: `Accept-Language: ko` 또는 `Accept-Language: en`

---

## 3. 추가된 코드 그룹

| groupKey | 용도 | codes |
|----------|------|-------|
| **ACTION_TYPE** | Actions, Archive 화면 | POST_REVERSAL, BLOCK_PAYMENT, FLAG_REVIEW, CLEAR_ITEM, UPDATE_MASTER |
| **ENTITY_TYPE** | Entities 화면 필터 | VENDOR, CUSTOMER |
| **COUNTRY** | Entities 화면 필터 | KOR, USA, JPN, CHN |

---

## 4. FE 전환 가이드

- **Actions, Archive**: `useCodes('ACTION_TYPE')` 호출 시 BE에서 라벨 반환 (FE는 i18n fallback 유지)
- **Entities**: `useCodes('ENTITY_TYPE')`, `useCodes('COUNTRY')` 호출 시 BE에서 라벨 반환 — **FE 전환 완료** (entities-filter-bar.tsx)
- **메뉴명**: `GET /api/auth/menus/tree`의 `menuName` 필드를 그대로 표시 (nav-config-dashboard, 이미 하드코딩 fallback 없음)

---

## 5. FE 적용 완료 (2025-02-06)

| 항목 | 파일 | 변경 내용 |
|------|------|-----------|
| Entities 필터 | `entities-filter-bar.tsx` | TYPE_OPTIONS, COUNTRY_OPTIONS 하드코딩 제거 → `useCodes('ENTITY_TYPE')`, `useCodes('COUNTRY')` 사용 |
| Entities i18n | `common.json` (ko/en) | `entities.filter.*` 추가 (type, country, searchPlaceholder, reset) |
