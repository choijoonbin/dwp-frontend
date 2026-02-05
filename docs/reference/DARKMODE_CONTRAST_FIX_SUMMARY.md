# 다크모드 대비(Contrast) 일괄 개선 — 변경 요약

## 개요

다크모드에서 "파스텔 배경 + 옅은 글씨"로 인한 가독성 저하를 **토큰/테마/공통 컴포넌트** 기준으로 일괄 수정했습니다.

---

## 변경된 파일 목록

### 1. `libs/design-system/src/theme/core/palette.ts`

#### 다크모드 accent/상태 색상 오버라이드 (primary, secondary, error, warning, info, success)

- **문제**: `primary.lighter`, `error.lighter`, `warning.lighter` 등이 라이트 모드용 밝은 파스텔(#D0ECFE, #FFE9D5, #FFF5CC 등)로 고정되어, 다크모드에서 배경이 너무 밝고 텍스트 대비가 떨어짐.
- **해결**: 다크모드에서 `lighter`/`light`를 `darker` 채널 기반 `varAlpha(..., 0.28/0.45)`로 교체하여 어두운 틴트 배경으로 변경.
- **Autonomy 패널**: 좌측 "연한 블루" accent surface(primary.lighter)가 다크모드에서 어두운 틴트로 표시됨.

```ts
// Dark mode: accent/status color overrides
primary.lighter  → varAlpha(primary.darkerChannel, 0.28)
primary.light    → varAlpha(primary.darkerChannel, 0.45)
secondary, error, warning, info, success 동일 적용
```

#### 텍스트 토큰 3단계 조정 (다크모드)

- **문제**: `text.secondary`(grey[300])가 다크모드에서 너무 흐려 가독성 저하.
- **해결**: `text.secondary`를 grey[200]으로 변경하여 muted 텍스트 가독성 향상.

| 토큰       | 기존 (dark) | 변경 (dark) |
|-----------|-------------|-------------|
| primary   | grey[100]   | 유지        |
| secondary | grey[300]   | grey[200]   |
| disabled  | grey[600]   | 유지        |

---

### 2. `libs/design-system/src/theme/core/components.tsx`

#### MuiCardHeader

- `titleTypographyProps`: `color: 'text.primary'` 명시
- `subheaderTypographyProps`: `color: 'text.secondary'` 명시
- 카드 제목/부제목이 토큰 기반 색상을 사용하도록 보장

#### MuiAlert (신규)

- `standardError`, `standardWarning`, `standardInfo`, `standardSuccess`에 대해
- `.MuiAlert-message`에 `color: theme.vars.palette.text.primary` 적용
- 다크모드에서 상태 배경 위 메시지 텍스트 가독성 확보

#### MuiSlider (신규)

- `root`: `color: primary.main` 명시
- `rail`: `opacity: 0.38`로 track 대비 개선
- `track`/`thumb`: 토큰 기반 색상 적용

#### MuiChip (신규)

- `colorDefault` (다크모드): `backgroundColor`, `color`, `border` 토큰 기반으로 대비 확보

---

### 3. `libs/design-system/src/components/label/styles.tsx`

#### Label (SeverityBadge 등) 다크모드 대비

- **soft variant**: 다크모드에서 `color: main`, `backgroundColor: lighter`, `border: light` — fg 밝게, bg 어두운 틴트
- **inverted variant**: 동일 규칙 적용
- **disabled**: `opacity: 0.48` → `0.72`로 상향 (가독성 유지)

### 4. `apps/remotes/synapsex/src/pages/governance.tsx`

#### Autonomy 패널 Typography/Icon fg 강제

- **Autonomy Level Configuration** 헤더: 아이콘/타이틀 `color="text.primary"`
- **Global Default Autonomy Level** 카드: 타이틀/아이콘 `color="text.primary"`, 슬라이더 레이블(Human Only/Fully Auto) `color="text.primary"`
- **AI Proposes** 선택 카드: 타이틀/아이콘 `color="text.primary"`
- **Autonomy Level Reference**: 섹션 타이틀/레벨 카드 제목 `color="text.primary"`
- **Per-Anomaly Settings**: 섹션 타이틀/아이콘 `color="text.primary"`
- **Guardrail Configuration**: 헤더 아이콘/타이틀 `color="text.primary"`
- **Guardrail 카드 헤더**: 제목 `textOverflow: ellipsis`, SeverityBadge `flexShrink: 0` — 배지 클리핑 방지

---

## 영향 범위

다음과 같이 `primary.lighter`, `error.lighter`, `warning.lighter`, `info.lighter`, `success.lighter`를 사용하는 모든 화면에 자동 적용됩니다.

- `apps/remotes/synapsex`: governance(좌측 Autonomy 패널), dashboard, actions, cases, archive, entity-detail, lineage, guardrails, agent-config 등
- `apps/remotes/admin`: monitoring, roles, menus, users 등
- `apps/dwp`: forgot-password-view, aiworkspace 등

---

## 검증 방법

1. 다크모드 ON → **Governance & Autonomy Controls** 진입
2. 좌측 Autonomy 패널: 섹션 타이틀, "Human Only/Fully Auto" 슬라이더 레이블, "AI Proposes" 카드 텍스트 가독성 확인
3. **우측 Guardrail 카드**: Critical/High Severity 배지 가독성, 배지 잘림 여부 확인
4. 토글 OFF(Disabled) 상태에서 배지 존재/가독성 확인
5. 설정/대시보드/아카이브 등 해당 화면 진입 → 섹션 타이틀, 본문, 배지 가독성 확인
6. 1280/1440 해상도에서 최소 3개 화면 시각 검증

---

## 하드코딩 색상 현황

- `theme-config.ts`의 status 색상(hex)은 라이트 모드용으로 유지
- 다크모드 전용 오버라이드는 `palette.ts`에서 `varAlpha`로 처리
- `#xxx`, `rgba(...)` 직접 지정은 개별 화면에서 일부 존재하며, 추후 semantic token으로 교체 권장

---

## 산출물 체크리스트

- [x] 변경된 토큰/테마 파일 목록
- [x] 공통 컴포넌트 변경 내역 요약
- [ ] Before/After 스크린샷 (최소 3장) — 수동 검증 시 추가
- [ ] 하드코딩 색상 제거 grep 결과 — 추후 점검
