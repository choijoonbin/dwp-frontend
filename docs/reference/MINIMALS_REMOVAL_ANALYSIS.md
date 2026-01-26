# Minimals 제거 및 라이센스 범위 이탈 분석

> **목적**: Minimal 템플릿(minimals.cc / minimal-shared)에서 시작한 프로젝트에서 관련 요소를 **모두 제거**하여 Minimal 라이센스 범위를 벗어나는 것을 최종 목표로 하는 분석 문서.

---

## 1. 현재 상태 요약

| 구분 | 위치 | 설명 | 상태 |
|------|------|------|------|
| **NPM 패키지** | `package.json` | `minimal-shared` 의존성 | ✅ 완료: 제거됨, 자체 유틸/훅으로 대체 |
| **코드 import** | apps/libs | `minimal-shared` / `@minimal` import | ✅ 없음 (완전 제거됨) |
| **브랜딩/저작권** | `LICENSE.md` | Minimal UI / minimals.cc 저작권 문구 | 🔴 미완료: **라이센스 이탈 시 반드시 정리** |
| **문서·UI 문구** | README, dashboard, mock 등 | "Minimal UI Kit", "minimals" 노출 | 🟡 정리 권장 (브랜딩 제거) |

---

## 2. 프로젝트 전반 영향도 (오류 가능성)

### 2.1 빌드·타입·실행

| 항목 | 결과 | 비고 |
|------|------|------|
| **TypeScript** (`yarn tsc --noEmit`) | ✅ 통과 | 타입 오류 없음 |
| **minimal-shared 미사용** | ✅ 확인 | 코드베이스에 import 없음 |
| **Vite resolve alias** | ✅ 정상 | `src/theme`, `src/components` → `libs/design-system` 매핑만 사용 (Minimal 패키지 미참조) |

→ **현재 기준으로 Minimal 제거 작업 자체가 빌드/런타임 오류를 유발하지 않음.**

### 2.2 린트

| 항목 | 결과 | 비고 |
|------|------|------|
| **ESLint errors** | 5건 (perfectionist/sort-imports) | `yarn lint:fix`로 자동 수정 가능. 미수정 시 CI 실패 가능 |
| **ESLint warnings** | 다수 (no-restricted-imports) | lucide-react, shadcn/ui, Radix, tailwind-merge 등. 프로젝트 규칙 위반이지만 **실행 오류 원인 아님** |
| **@/ alias 사용** | `docs/_deprecated/` 내부만 | 메인 apps/libs 빌드 대상 아님. 영향 없음 |

→ **오류 가능성**: sort-imports 5건만 실제 “에러”에 해당. 나머지는 정책 경고·기술 부채.

### 2.3 Minimal과 무관한 기술 부채 (참고)

- **design-system/shadcn**, **roles-screen-redesign**: Radix/lucide/shadowcn 사용으로 인한 no-restricted-imports 경고.  
  Minimal 제거와 직접 연관 없음. 장기적으로 MUI/Iconify 기반으로 교체 시 라이센스·일관성에 유리.

---

## 3. 라이센스 범위 이탈을 위한 잔여 참조

Minimal 브랜딩·저작권이 **노출되는** 위치만 정리. 이 부분 정리가 “라이센스 범위 이탈” 인지에 직접 연결됨.

| 우선순위 | 위치 | 현재 내용 | 권장 조치 |
|----------|------|-----------|-----------|
| **P0** | `LICENSE.md` | `Copyright (c) 2021 Minimal UI (minimals.cc)` | 법무 검토 후 DWP/프로젝트 라이선스로 교체 또는 “원저작자 표기” 방식으로 수정 |
| **P1** | `README.md` | "MUI v5 (Minimal UI Kit 기반)" | "MUI v5 기반" 등으로 수정 (Minimal 브랜딩 제거) |
| **P1** | `apps/dwp/src/pages/dashboard.tsx` | meta description "Minimal UI Kit" | 프로젝트/제품 설명으로 변경 |
| **P2** | `apps/dwp/src/_mock/_data.ts` | notification "answered to your comment on the Minimal" | 중립 문구로 변경 |
| **P2** | `vite.config.ts` | 주석 "Keep existing Minimal UI imports working" | "src/theme, src/components → design-system resolve" 등으로 문구만 정리 |
| **P3** | `libs/.../use-popover.ts`, `merge-classes.ts` | 주석 "compatible with minimal-shared" | "Legacy minimal-shared 대체" 등 역사 설명만 남기거나 제거 |

**minimals.cc / minimal.cc URL** 은 현재 `LICENSE.md` 한 곳에서만 사용됨.

---

## 4. `minimal-shared` 대체 구현 (완료)

- **Utils** (`libs/design-system/src/utils/`): `mergeClasses`, `varAlpha`, `createPaletteChannel`, `pxToRem`, `setFont` 구현.
- **Hooks**: `usePopover`, `useScrollOffsetTop` → `libs/shared-utils/src/hooks/`, `useIsClient` → `libs/design-system/src/hooks/`.
- 모든 `minimal-shared` import 제거 및 `package.json`에서 의존성 제거 완료.

---

## 5. 권장 작업 순서 (라이센스 이탈 목표)

1. **즉시**: `yarn lint:fix` 실행 → sort-imports 5건 해결, CI 안정화.
2. **P0**: `LICENSE.md` — 법무와 함께 DWP/프로젝트 라이선스로 전환 또는 원저작자 표기 방식 결정 후 수정.
3. **P1**: README, dashboard 메타, mock 문구에서 “Minimal” 브랜딩 제거.
4. **P2**: vite/config·주석 등 나머지 문구 정리.
5. **(선택)** 점진적으로 shadcn/Radix/lucide 사용 영역을 MUI/Iconify로 교체하여 프로젝트 규칙·유지보수성 정리.

---

## 6. 결론

- **오류 관점**: minimal-shared 제거로 인한 빌드/타입/런타임 오류 가능성 없음. 린트는 sort-imports 5건만 수정하면 에러 해소.
- **라이센스 관점**: `LICENSE.md` 및 문서·UI 문구에서 “Minimal UI / minimals.cc” 노출을 제거·수정하면 라이센스 범위 이탈 목표에 도달할 수 있음. 최종 판단은 법무 검토 권장.
