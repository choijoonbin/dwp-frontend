# Minimals 제거 가능성 분석

> **목적**: 프로젝트에서 minimals(minimals.cc / minimal-shared) 의존을 정리하기 위한 연결 고리 분석 및 제거 대상 검토.

---

## 1. 현재 연결 고리 요약

| 구분 | 위치 | 설명 | 제거 난이도 |
|------|------|------|-------------|
| **콘솔 메시지** | `libs/design-system/.../iconify.tsx` | 아이콘 온라인 로딩 시 `https://docs.minimals.cc/icons/` 안내 | ✅ **완료**: 외부 URL 제거, 프로젝트 내 icon-sets 경로로 변경 |
| **NPM 패키지** | `package.json` | `minimal-shared@^1.0.7` 의존성 | 🔴 높음: 아래 유틸 대체 필요 |
| **패키지 메타** | `package.json` | `"author": "minimals.cc"` | ✅ **완료**: `DWP`로 변경 (코드에서 참조 없음, npm 메타만) |
| **브랜딩/저작권** | `LICENSE.md` | Minimal UI / minimals.cc 저작권 문구 | 🟡 중간: 라이선스 정책에 따라 유지/수정 |
| **테마 설정** | `libs/design-system/.../theme-config.ts` | `classesPrefix: 'minimal'` | ✅ **완료**: `dwp`로 변경 (createClasses 영향 없음, 외부 참조 없음) |
| **목업 데이터** | `apps/dwp/src/_mock/_data.ts` | `email: 'demo@minimals.cc'` | ✅ **완료**: `demo@dwp.local`로 변경 (표시용만, 로직 의존 없음) |
| **이미지 에셋** | `public/assets/images/minimal-free-preview.jpg` | 템플릿 프리뷰 이미지 | ✅ **삭제 완료**: 사용처 없음 확인 후 제거 |

---

## 2. `minimal-shared` 사용처 (제거 시 대체 필요)

패키지는 **utils**와 **hooks**만 사용합니다. 아래를 자체 구현하거나 다른 라이브러리로 대체해야 합니다.

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

## 3. 제거 진행 권장 순서

1. **즉시 적용 (완료)**  
   - 아이콘 관련 콘솔 메시지에서 `docs.minimals.cc` 제거 및 프로젝트 내 경로 안내로 변경.  
   - `solar:magic-stick-3-bold`를 `icon-sets.ts`에 등록해 오프라인 사용으로 깜빡임/경고 제거.

2. **저작권/브랜딩 정리 (권장)**  
   - `package.json`의 `author`를 팀/회사로 변경.  
   - `LICENSE.md`는 현재 프로젝트 라이선스로 유지하거나, minimal-shared 사용분만 표기하는 방향으로 법무 검토 후 수정.  
   - `theme-config.ts`의 `classesPrefix: 'minimal'` → `dwp` 등으로 변경.  
   - `_mock/_data.ts`의 `demo@minimals.cc` → 일반 예시 이메일로 변경.

3. **minimal-shared 제거 (중기)**  
   - `varAlpha`, `mergeClasses`, `createPaletteChannel`, `pxToRem`, `setFont`를 `libs/design-system` 또는 `libs/shared-utils`에 직접 구현.  
   - `usePopover`, `useScrollOffsetTop`를 프로젝트 훅으로 대체.  
   - 의존성에서 `minimal-shared` 제거 후 전체 테스트.

4. **에셋 정리**  
   - `minimal-free-preview.jpg` 참조 여부 확인 후, 미사용 시 삭제.

---

## 4. 정리

- **minimals에서 리소스를 “가져오는” 부분**:  
  - **실제 리소스 로딩**: 없음 (이미지/폰트 등 minimals 서버에서 직접 로드하는 코드 없음).  
  - **문자열/문서**: `docs.minimals.cc` 링크 1곳 → 위 1항에서 제거 완료.  
  - **코드**: `minimal-shared` NPM 패키지를 통해 유틸/훅만 사용.  

- **제거 대상 여부**:  
  - **외부 링크/콘솔 문구**: 제거 완료.  
  - **저작권·브랜딩·목업 데이터·classesPrefix**: 제거 권장.  
  - **`minimal-shared` 패키지**: 대체 구현 후 제거 권장(작업량 있음).

이 문서를 기준으로 “지금 제거할 것”과 “중기 작업”을 나눠 진행하면 됩니다.
