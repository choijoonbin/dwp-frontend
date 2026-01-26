# DWP Frontend 문서

**최종 업데이트**: 2026-01-26

이 디렉토리는 DWP Frontend 프로젝트의 모든 문서를 체계적으로 관리합니다.

---

## 🚀 신규 개발자 시작 가이드

### 1주차 필독 문서 (순서대로)

1. **[프로젝트 시작 가이드](essentials/GETTING_STARTED.md)** (15분)
   - 프로젝트 구조, 실행 방법, 첫 페이지 만들기

2. **[핵심 규칙](essentials/PROJECT_RULES.md)** (20분)
   - .cursorrules의 핵심 요약본, 반드시 지켜야 할 규칙

3. **[Admin CRUD 개발 표준](essentials/ADMIN_CRUD_STANDARD.md)** (30분)
   - CRUD 페이지 개발 시 반드시 따라야 할 표준 구조

4. **[레이아웃 가이드](essentials/LAYOUT_GUIDE.md)** (15분)
   - Fixed/Scrollable 모드 이해 및 적용 방법

5. **[디자인 시스템](essentials/DESIGN_SYSTEM.md)** (30분)
   - 공통 컴포넌트 카탈로그 및 사용법

**📌 팁**: 위 5개 문서만 읽으면 프로젝트의 80%를 이해할 수 있습니다!

---

## 📂 디렉토리 구조

```
docs/
├── README.md                    # 본 문서 (문서 인덱스)
│
├── essentials/                  # ⭐ 필수 문서 (신규 개발자 1주차 필독)
│   ├── GETTING_STARTED.md      # 프로젝트 시작 가이드
│   ├── PROJECT_RULES.md        # 핵심 규칙 요약
│   ├── ADMIN_CRUD_STANDARD.md  # Admin CRUD 개발 표준
│   ├── LAYOUT_GUIDE.md         # 레이아웃 모드 가이드
│   ├── DESIGN_SYSTEM.md        # 디자인 시스템 & 컴포넌트 카탈로그
│   └── THEME_TOKENS.md         # 테마 토큰 운영 표준
│
├── specs/                       # 📋 기능 명세서
│   ├── aura.md                 # Aura AI 기능 명세
│   └── login-policy.md         # 로그인 정책 UI 명세
│
├── api-spec/                    # 📤 FE↔BE 협업: BE가 업로드한 결과·완료 문서
│   └── README.md                # 폴더 용도 및 규칙 (상세: reference/FE_BE_API_SPEC_WORKFLOW.md)
│
├── backend-src/                 # (링크) 백엔드 프로젝트
│   └── docs/api-spec/           # FE→BE 요청·검토 문서 (FE가 작성, BE가 확인)
│
├── reference/                   # 📚 참고 문서 (필요 시 참고)
│   ├── api/
│   │   └── backend-api-spec.md # 백엔드 API 명세
│   ├── FE_BE_API_SPEC_WORKFLOW.md # FE↔BE API Spec 협업 업무 정의
│   ├── architecture/
│   │   └── (향후 추가 예정)
│   ├── DESIGN_SYSTEM_MIGRATION.md # Design System 마이그레이션 가이드
│   ├── PR_CHECKLIST_UI.md     # UI 개발자용 상세 PR 체크리스트
│   ├── STATE_MANAGEMENT_AUDIT.md # 상태 관리(Store) 구조 점검
│   └── MINIMALS_REMOVAL_ANALYSIS.md # Minimals 제거·라이센스 이탈 분석
│
├── archive/                     # 🗂️ 완료된 작업 아카이브
│   ├── tasks/                  # 완료된 작업 기록
│   │   └── 2026-01/
│   │       ├── README.md       # 작업 히스토리 인덱스
│   │       ├── P1-1_monitoring-api.md
│   │       ├── P1-2_monitoring-enhancement.md
│   │       ├── P1-3_auth-implementation.md
│   │       ├── P1-4_code-usage.md
│   │       └── P1-5_admin-crud.md
│   ├── verification/           # 검증 리포트
│   │   └── admin-ui-porting-report.md
│   └── debug/                  # 디버깅 기록
│       ├── roles-selection-debug.md
│       └── backend-api-roles-fix.md
│
└── _deprecated/                 # 🚫 더 이상 사용 안 하는 것
    └── audit-logs-prototype/   # 과거 프로토타입
```

---

## 📖 문서 분류 기준

### ⭐ essentials/ (필수)
**대상**: 신규 개발자, 협업 개발자  
**목적**: 1주일 안에 프로젝트의 80%를 이해  
**기준**: "이것 없이는 개발 못함"

### 📋 specs/ (명세서)
**대상**: 전체 팀 (개발자 + PM + 디자이너)  
**목적**: 기능 요구사항 정의  
**기준**: "무엇을 만들 것인가?"

### 📚 reference/ (참고)
**대상**: 중급 이상 개발자  
**목적**: 깊이 있는 이해가 필요할 때  
**기준**: "어떻게 동작하는가?"

### 📤 api-spec/ (FE↔BE 협업)
**대상**: 프론트·백엔드 협업  
**목적**: API 작업 요청·검토·결과 문서 교환  
**기준**:
- **FE 요청 문서** → `backend-src/docs/api-spec/` (백엔드의 docs/api-spec)
- **BE 결과 문서** → `api-spec/` (우리 쪽). BE가 완료 후 여기에 업로드(PR 등)
- 추가 질문 시 요청 문서 `_v1`, `_v2`로 버전 관리  
**상세**: `reference/FE_BE_API_SPEC_WORKFLOW.md`

### 🗂️ archive/ (아카이브)
**대상**: 이력 추적 필요 시  
**목적**: 과거 작업 검색  
**기준**: "완료됐지만 기록은 남긴다"  
**보관 기간**: 6개월 (이후 `_deprecated`로 이동)

### 🚫 _deprecated/ (삭제 대기)
**대상**: 없음  
**목적**: 1년 후 삭제 예정  
**기준**: "더 이상 참고할 가치 없음"

---

## 🎯 상황별 문서 찾기

### "첫 페이지를 만들어야 해요"
→ `essentials/GETTING_STARTED.md` → `essentials/ADMIN_CRUD_STANDARD.md`

### "컴포넌트를 어떻게 써야 하죠?"
→ `essentials/DESIGN_SYSTEM.md`

### "Modal/Dialog UX 규칙이 궁금해요"
→ `essentials/DESIGN_SYSTEM.md` (Modal/Dialog UX 규칙 섹션)

### "레이아웃 스크롤이 안 되는데요?"
→ `essentials/LAYOUT_GUIDE.md`

### "과거 작업 내용을 보고 싶어요"
→ `archive/tasks/2026-01/README.md`

### "백엔드 API 스펙을 보고 싶어요"
→ `reference/api/backend-api-spec.md`

### "기존 Admin 페이지를 Design System 패턴으로 마이그레이션하려고 해요"
→ `reference/DESIGN_SYSTEM_MIGRATION.md`

### "PR 리뷰 시 UI 체크리스트가 궁금해요"
→ `reference/PR_CHECKLIST_UI.md`

### "E2E 테스트를 실행하고 싶어요"
→ `reference/E2E_SMOKE_TESTS.md` + `reference/E2E_TESTID_STANDARD.md`

### "지금 단계에서 하지 말아야 할 작업이 궁금해요"
→ `reference/WHAT_NOT_TO_DO.md`

### "FE/BE 계약 정합성을 점검하고 싶어요"
→ `reference/FE_BE_CONTRACT_CHECK.md`

### "백엔드에 API 작업 요청을 보내거나, BE 완료 결과를 확인하려면"
→ `reference/FE_BE_API_SPEC_WORKFLOW.md`  
→ 요청 문서: `backend-src/docs/api-spec/` | 결과 문서: `api-spec/`

### "Admin API Gap 분석 및 보완 요청이 필요해요"
→ `specs/admin/ADMIN_API_GAP_ANALYSIS.md` + `backend-src/docs/api-spec/` (요청) + `api-spec/` (BE 결과)

### "Admin API 보완 결과 확인"
→ `api-spec/FRONTEND_API_REQUEST_ADMIN_API_COMPLETION_result.md`

### "Admin API 연동 — BE에 확인 요청할 내용이 있어요"
→ `backend-src/docs/api-spec/FE_BE_확인요청_ADMIN_API_연동_고려사항.md` (요청 문서: 백엔드 api-spec에 업로드)

### "Admin 개발 후 남은 작업이 궁금해요"
→ `specs/admin/ADMIN_REMAINING_WORK.md`

### "상태 관리·스토어(Zustand) 구조가 체계적인지 점검하고 싶어요"
→ `reference/STATE_MANAGEMENT_AUDIT.md`

---

## 📝 문서 작성 규칙

### 모든 문서는 다음을 포함해야 합니다:

1. **최종 업데이트 날짜**: 문서 상단에 `**최종 업데이트**: YYYY-MM-DD` 표시
2. **목차**: 긴 문서는 목차 필수
3. **코드 예시**: 설명에는 반드시 실제 코드 예시 포함
4. **Do/Don't**: 올바른 사용법과 잘못된 사용법 명시

### 문서 업데이트 시

- 변경 사항이 크면 `CHANGELOG.md`에 기록
- `essentials/` 문서 변경 시 팀에 공지

---

## 🔄 정기 유지보수

### 월 1회
- `essentials/` 문서 업데이트 여부 확인
- 신규 공통 컴포넌트 추가 시 `DESIGN_SYSTEM.md` 업데이트

### 분기 1회
- `archive/` 폴더 정리 (6개월 지난 문서 `_deprecated`로 이동)
- 중복/오래된 문서 삭제 검토

### 연 1회
- `_deprecated/` 폴더 완전 삭제
- 전체 문서 구조 재검토

---

## 🤝 기여 가이드

새로운 문서를 추가하거나 기존 문서를 수정할 때:

1. **올바른 폴더 선택**: 위 분류 기준 참고
2. **파일명 규칙**: `kebab-case.md` (소문자, 하이픈 구분)
3. **PR에 문서 링크 포함**: "자세한 내용은 `docs/xxx.md` 참고"
4. **팀 리뷰 요청**: `essentials/` 문서 변경 시 필수

---

## 📞 문의

- 문서 구조 관련: 개발 리드에게 문의
- 문서 내용 관련: 해당 문서 작성자에게 문의
- 신규 문서 추가: PR로 제안

---

**Happy Coding! 🚀**
