# ESLint Guard 전환 가이드

> **최종 업데이트**: 2026-01-22  
> **목적**: Design System 규칙을 점진적으로 강화하여 팀 전체에 안착시키기

---

## 🎯 목표

ESLint 규칙을 **warning → error로 점진적으로 전환**하여:
1. 기존 코드 개발 속도 유지
2. 위반 케이스 수집 및 분석
3. 예외 케이스 문서화
4. 최종적으로 강제 적용

---

## 📅 전환 로드맵

### Phase 1: Warning 수집 기간 (1~2주)

**기간**: 2026-01-22 ~ 2026-02-05 (2주)  
**목표**: 위반 케이스 수집 및 예외 케이스 식별

**현재 상태** (이미 적용됨):
```javascript
// eslint.config.mjs
{
  rules: {
    'no-restricted-imports': [
      'warn', // ⚠️ warning (error 아님)
      {
        patterns: [
          {
            group: ['**/ui', '**/ui/**'],
            message: 'components/ui 폴더 생성 금지. libs/design-system 사용',
          },
          {
            group: ['shadcn*', '@radix-ui/*', 'lucide-react', 'class-variance-authority'],
            message: '비표준 UI 라이브러리 사용 금지. @dwp-frontend/design-system 사용',
          },
        ],
      },
    ],
  },
}
```

**팀 행동**:
- 개발자는 계속 개발 가능 (warning은 blocking 아님)
- warning 발생 시 콘솔에 출력됨
- 주 1회 warning 현황 수집 (PM/Tech Lead)

---

### Phase 2: 위반 케이스 분석 및 문서화 (1주)

**기간**: 2026-02-06 ~ 2026-02-12 (1주)  
**목표**: 반복 발생 패턴 식별 및 예외 케이스 문서화

**분석 항목**:
1. **Top 5 위반 패턴 식별**
   - 어떤 규칙이 가장 많이 위반되는가?
   - 어떤 팀/개발자에서 자주 발생하는가?
   - 어떤 페이지/컴포넌트에서 발생하는가?

2. **예외 케이스 판단**
   - 정당한 예외인가? (기술적 한계, 기존 코드 호환성)
   - 잘못된 습관인가? (교육 필요)

3. **예외 케이스 문서화** (이 문서에 추가)

---

### Phase 3: Error 전환 (1주)

**기간**: 2026-02-13 ~ 2026-02-19 (1주)  
**목표**: ESLint 규칙을 error로 변경하여 강제 적용

**변경 사항**:
```javascript
// eslint.config.mjs
{
  rules: {
    'no-restricted-imports': [
      'error', // ✅ error로 변경!
      {
        patterns: [
          {
            group: ['**/ui', '**/ui/**'],
            message: 'components/ui 폴더 생성 금지. libs/design-system 사용',
          },
          {
            group: ['shadcn*', '@radix-ui/*', 'lucide-react', 'class-variance-authority'],
            message: '비표준 UI 라이브러리 사용 금지. @dwp-frontend/design-system 사용',
          },
        ],
      },
    ],
  },
}
```

**영향**:
- ❌ ESLint 오류 발생 시 **빌드 실패** (CI/CD에서 Merge 불가)
- ⚠️ 로컬 개발 시 **실시간 오류 표시**

**팀 준비**:
- 기존 위반 코드 수정 완료 (Phase 2에서 정리)
- 예외 케이스는 `eslint-disable` 주석으로 처리 (근거 포함)

---

## 📊 위반 케이스 수집 현황

### Week 1 (2026-01-22 ~ 2026-01-28)

**수집 방법**:
```bash
yarn lint | grep "no-restricted-imports" > violations-week1.txt
```

**결과** (예시 - 실제 데이터로 업데이트 필요):
- 총 위반 건수: 0건 (기준선)
- 주요 패턴: -
- 발생 위치: -

---

### Week 2 (2026-01-29 ~ 2026-02-05)

**결과** (예시 - 실제 데이터로 업데이트 필요):
- 총 위반 건수: TBD
- 주요 패턴: TBD
- 발생 위치: TBD

---

## 🚫 예외 케이스 목록

### 허용되는 예외 (최소화 원칙)

현재까지 승인된 예외는 **없습니다**. 예외가 필요한 경우 아래 절차를 따릅니다.

#### 예외 요청 절차

1. **예외 요청서 작성** (팀 채널 또는 PR 코멘트)
   ```markdown
   ### ESLint 예외 요청
   - 파일: apps/remotes/admin/src/pages/example/page.tsx
   - 규칙: no-restricted-imports
   - 사유: [기술적 사유 상세 설명]
   - 대안 검토: [Design System 패턴 검토 결과]
   - 임시/영구: [임시 (마이그레이션 예정) / 영구]
   ```

2. **Tech Lead 승인** (기술 리더 또는 아키텍트)

3. **문서화** (이 문서에 예외 케이스 추가)

4. **코드에 주석 추가**
   ```typescript
   // eslint-disable-next-line no-restricted-imports
   // 예외 사유: 기존 라이브러리와 호환성 유지 (2026-03-01까지)
   import { OldComponent } from 'legacy-ui-lib';
   ```

---

### 예외 케이스 1 (예시)

**상태**: ❌ 없음 (현재 승인된 예외 없음)

---

## 📋 위반 패턴 Top 5 (Phase 2에서 수집)

### 1. [패턴명] (발생 빈도: TBD)

**위반 예시**:
```typescript
// TBD
```

**해결 방법**:
```typescript
// TBD
```

---

### 2. [패턴명] (발생 빈도: TBD)

TBD

---

## 📖 개발자 가이드

### ESLint Warning 발생 시 대응 방법

#### 1. Warning 확인

```bash
yarn lint
```

출력 예시:
```
apps/remotes/admin/src/pages/example/page.tsx
  12:8  warning  비표준 UI 라이브러리 사용 금지. @dwp-frontend/design-system 사용  no-restricted-imports
```

---

#### 2. 해결 방법 선택

**Option A: Design System 패턴으로 교체 (권장)**
```typescript
// ❌ Before
import { Button } from 'shadcn/ui';

// ✅ After
import { Button } from '@mui/material/Button';
// 또는
import { ConfirmDialog } from '@dwp-frontend/design-system';
```

**Option B: 예외 요청** (정당한 사유가 있는 경우만)
- [예외 요청 절차](#예외-요청-절차) 참고

---

#### 3. 수정 및 확인

```bash
# 수정 후 lint 재실행
yarn lint --fix

# TypeScript 타입 체크
yarn tsc --noEmit
```

---

## 🔄 정기 리뷰

### 주간 리뷰 (매주 월요일)

**담당**: Tech Lead  
**내용**:
- 지난주 warning 건수 확인
- 반복 패턴 식별
- 팀 공유 (필요 시)

---

### 월간 리뷰 (매월 첫 주)

**담당**: PM + Tech Lead  
**내용**:
- ESLint 규칙 효과 분석
- 예외 케이스 재검토 (임시 예외 → 영구 또는 제거)
- 새로운 규칙 추가 검토

---

## 📞 문의

- **ESLint 규칙 관련**: Tech Lead
- **Design System 패턴 사용법**: [DESIGN_SYSTEM.md](../essentials/DESIGN_SYSTEM.md)
- **마이그레이션 가이드**: [DESIGN_SYSTEM_MIGRATION.md](./DESIGN_SYSTEM_MIGRATION.md)

---

**점진적으로 강화하여 안정적으로 안착시킵시다! 🎯**
