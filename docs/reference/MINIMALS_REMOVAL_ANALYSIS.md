# Minimals 제거 가능성 분석

> **목적**: 프로젝트에서 minimals(minimals.cc / minimal-shared) 의존을 정리하기 위한 **남은 작업** 정리.

---

## 1. 작업 대상 (미완료)

| 구분 | 위치 | 설명 | 제거 난이도 |
|------|------|------|-------------|
| **NPM 패키지** | `package.json` | `minimal-shared@^1.0.7` 의존성 | 🔴 높음: 아래 유틸 대체 필요 |
| **브랜딩/저작권** | `LICENSE.md` | Minimal UI / minimals.cc 저작권 문구 | 🟡 중간: 라이선스 정책에 따라 유지/수정 |

---

## 2. `minimal-shared` 제거 시 대체 필요

패키지는 **utils**와 **hooks**만 사용합니다. 아래를 자체 구현하거나 다른 라이브러리로 대체한 뒤 의존성 제거.

### 2.1 `minimal-shared/utils`

| 사용 함수 | 사용 파일 (예시) | 대안 |
|-----------|------------------|------|
| `mergeClasses` | iconify, logo, layout-section, main-section, content, scrollbar, svg-color, color-picker, chart, label 등 | 직접 구현 또는 `clsx`/`classnames` |
| `varAlpha` | palette, shadows, custom-shadows, typography, components, nav, searchbar, chart, label 등 | `theme.palette.*` + alpha 유틸 직접 구현 |
| `createPaletteChannel` | `libs/design-system/.../palette.ts` | MUI/Emotion 쪽 채널 유틸로 대체 |
| `pxToRem`, `setFont` | `libs/design-system/.../typography.ts` | MUI `theme.typography`/pxToRem 유틸 직접 구현 |

### 2.2 `minimal-shared/hooks`

| 사용 훅 | 사용 파일 | 대안 |
|---------|-----------|------|
| `usePopover` | language-popover, analytics-tasks 등 | MUI Popover + anchor state 직접 관리 |
| `useScrollOffsetTop` | header-section | `window.scrollY` + useEffect/useSyncExternalStore |

---

## 3. 진행 권장 순서

1. **브랜딩/저작권**  
   - `LICENSE.md`: 현재 프로젝트 라이선스로 유지하거나, minimal-shared 사용분만 표기하는 방향으로 법무 검토 후 수정.

2. **minimal-shared 제거 (중기)**  
   - `varAlpha`, `mergeClasses`, `createPaletteChannel`, `pxToRem`, `setFont`를 `libs/design-system` 또는 `libs/shared-utils`에 직접 구현.  
   - `usePopover`, `useScrollOffsetTop`를 프로젝트 훅으로 대체.  
   - 의존성에서 `minimal-shared` 제거 후 전체 테스트.
