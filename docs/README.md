# DWP Frontend 문서

이 디렉토리는 DWP Frontend 프로젝트의 모든 문서를 포함합니다.

---

## 디렉토리 구조

```
docs/
├── workdone/          # 완료된 작업 문서
│   ├── P1-1_MONITORING_API_INTEGRATION.md
│   ├── P1-2_MONITORING_ENHANCEMENT.md
│   ├── P1-3_AUTH_IMPLEMENTATION.md
│   ├── P1-4_CODE_USAGE_MANAGEMENT.md
│   ├── P1-5_ADMIN_CRUD_FE_IMPLEMENTATION.md
│   ├── ADMIN_REMOTE_IMPLEMENTATION.md
│   ├── ADMIN_ROLES_REFACTOR_GUIDE.md
│   ├── AUTH_IMPLEMENTATION_SUMMARY.md
│   └── ADMIN_CRUD_UI.md
├── testdoc/           # 테스트/검증 문서
│   ├── FRONTEND_VERIFICATION_REQUIREMENTS.md
│   ├── FRONTEND_VERIFICATION_RESPONSE.md
│   └── INTEGRATION_CHECKLIST.md
├── analysis/          # 분석/상태 문서
│   ├── AUTH_STATUS_ANALYSIS.md
│   └── BACKEND_API_SPEC.md
├── specs/             # 기능 명세서
│   ├── LOGIN_POLICY_UI.md
│   └── aura.md
└── README.md          # 본 문서
```

---

## 문서 분류

### workdone/ - 완료된 작업 문서

완료된 작업에 대한 상세 문서입니다.

- **P1-1 ~ P1-5**: 단계별 작업 문서
  - P1-1: Monitoring API 연동 및 기본 대시보드 구현
  - P1-2: Monitoring 대시보드 강화 (Visitors/Events/Timeseries)
  - P1-3: Auth 운영급 구현 (401/403 처리, AuthGuard, returnUrl)
  - P1-4: CodeUsage 관리 UI 구현
  - P1-5: Admin CRUD UI 완성 (Users/Roles/Resources/CodeUsage) + RBAC UX 강화

- **ADMIN_REMOTE_IMPLEMENTATION.md**: Admin Remote 전체 구현 요약
- **ADMIN_ROLES_REFACTOR_GUIDE.md**: Roles 페이지 리팩토링 가이드
- **AUTH_IMPLEMENTATION_SUMMARY.md**: Auth 구현 완료 요약
- **ADMIN_CRUD_UI.md**: Admin CRUD UI 구현 문서

### testdoc/ - 테스트/검증 문서

테스트 및 검증 관련 문서입니다.

- **FRONTEND_VERIFICATION_REQUIREMENTS.md**: 프론트엔드 검증 요구사항
- **FRONTEND_VERIFICATION_RESPONSE.md**: 프론트엔드 검증 응답
- **INTEGRATION_CHECKLIST.md**: 통합 체크리스트

### analysis/ - 분석/상태 문서

현황 분석 및 상태 문서입니다.

- **AUTH_STATUS_ANALYSIS.md**: Auth 현황 분석
- **BACKEND_API_SPEC.md**: 백엔드 API 명세서

### specs/ - 기능 명세서

기능별 상세 명세서입니다.

- **LOGIN_POLICY_UI.md**: 로그인 정책 UI 명세
- **aura.md**: Aura AI 기능 명세

---

## 작업 문서 (P1-X) 읽는 순서

1. **P1-1**: Monitoring API 연동 및 기본 대시보드 구현
2. **P1-2**: Monitoring 대시보드 강화
3. **P1-3**: Auth 운영급 구현
4. **P1-4**: CodeUsage 관리 UI 구현
5. **P1-5**: Admin CRUD UI 완성

각 문서는 이전 작업을 기반으로 작성되었으므로 순서대로 읽는 것을 권장합니다.

---

## 문서 작성 규칙

### 작업 문서 (P1-X) 형식

```markdown
# FE P1-X: [작업명]

**작성일**: YYYY-MM-DD
**상태**: ✅ 완료 / 🚧 진행중 / 📋 계획
**목적**: [작업 목적]

---

## 개요
[작업 개요]

## 구현 내용
[구현 내용 상세]

## 주요 해결 사항
[해결한 주요 이슈]

## 변경된 파일 목록
[변경된 파일 목록]

## 테스트 시나리오
[테스트 시나리오]

## 다음 단계
[다음 작업]
```

---

## 업데이트 이력

- **2026-01-20**: 문서 구조 재정리 및 P1-1 ~ P1-5 문서 작성

---

## 문의

문서에 대한 문의사항이 있으면 개발팀에 문의해주세요.
