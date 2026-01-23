# FE ↔ BE API Spec 협업 업무 정의

> **목적**: 프론트와 백엔드 간 API **작업 요청·검토·완료 문서** 교환 절차를 정의한다.  
> **적용**: API 개발 요청, 스펙 검토, 보완 요청, 결과 공유  
> **최종 업데이트**: 2026-01-23

---

## 1. 폴더 정의

### 1.1. FE → BE (요청·검토 문서)

| 구분 | 경로 | 설명 |
|------|------|------|
| **프론트 작성 위치** | `docs/backend-src/docs/api-spec/` | 프론트 레포에서 **백엔드 링크(backend-src)** 하위. 백엔드 레포의 `docs/api-spec/`와 동일한 물리 경로. |
| **백엔드 확인 위치** | `docs/api-spec/` | 백엔드 레포 기준. **BE는 여기서 요청 문서를 확인 후 작업**한다. |

**규칙**

- 프론트는 **작업 요청, 검토 요청, 추가 질문** 문서를 `docs/backend-src/docs/api-spec/`에 작성·업로드한다.
- 백엔드는 `docs/api-spec/`에서 해당 문서를 확인하고 작업을 수행한다.

---

### 1.2. BE → FE (결과·완료 문서)

| 구분 | 경로 | 설명 |
|------|------|------|
| **백엔드 업로드 위치** | **프론트 저장소** `docs/api-spec/` | 백엔드가 작업 완료 후 **결과·답변·완료 문서**를 여기에 업로드(PR, 공유 등)한다. |
| **프론트 확인 위치** | `docs/api-spec/` | 프론트는 여기서 `*_result*.md` 등을 확인한 뒤 FE 작업을 진행한다. |

**규칙**

- 백엔드는 **작업 완료 후** 결과·완료 문서를 **프론트 저장소의 `docs/api-spec/`** 에 업로드해 달라고 요청한다.
- **파일명 예**: `{요청문서제목}_result.md` (반복 시 `_result_v1.md` 등)

---

## 2. 요청 문서 버전 관리 (프론트)

- 프론트가 **추가 질문·수정 요청**을 반영할 때는 **요청 문서**를 `_v1`, `_v2` 식으로 갱신한다.
- 예:
  - `FRONTEND_API_REQUEST_XXX.md` → `FRONTEND_API_REQUEST_XXX_v1.md` (1차 수정)
  - `FRONTEND_API_REQUEST_XXX_v2.md` (2차 수정)
- 백엔드는 `docs/api-spec/`에서 **최신 버전**(`_v1`, `_v2` 등)을 확인해 작업한다.
- **최종 완료**할 때까지 이 과정을 반복한다.

---

## 3. 업무 흐름 요약

```
[프론트]
  → 작업 요청·검토·추가 질문 문서 작성
  → docs/backend-src/docs/api-spec/ 에 업로드
  → (추가 질문 시) 문서명_v1, _v2 로 버전 관리

[백엔드]
  → docs/api-spec/ 에서 요청 문서 확인
  → 답변 및 작업 수행
  → 완료 후 프론트 저장소 docs/api-spec/ 에
    {요청문서제목}_result.md 로 결과 문서 업로드

[프론트]
  → docs/api-spec/ 에서 *_result*.md 확인
  → 결과물 기준으로 FE 작업 진행
  → 추가 질문 시 요청 문서 _v1, _v2 로 갱신 후 반복
  → 최종 완료 시까지 반복
```

---

## 4. 정리

| 방향 | 문서 종류 | 보관 위치 | 비고 |
|------|-----------|-----------|------|
| **FE → BE** | 요청·검토·추가 질문 | `docs/backend-src/docs/api-spec/` (백엔드의 `docs/api-spec/`) | 버전: `_v1`, `_v2` |
| **BE → FE** | 결과·완료·답변 | `docs/api-spec/` (프론트 저장소) | 파일명: `{요청제목}_result.md` 등 |

- **내가 요청하는 문서** → **백엔드의 api-spec** (`docs/backend-src/docs/api-spec/`)에 둔다.
- **내가 요청한 문서의 결과** → **우리 api-spec** (`docs/api-spec/`)에서 확인한 뒤 작업한다.

---

## 5. 백엔드 팀 요청 사항 (체크리스트)

- [ ] **작업 전**: `docs/api-spec/`에 프론트 요청 문서가 있는지 확인.
- [ ] **작업 후**: **프론트 저장소의 `docs/api-spec/`** 에 `{요청문서제목}_result.md` 형태로 결과 문서 업로드(PR, 공유 등).
- [ ] **반복 시**: `_v1`, `_v2` 등 수정된 요청 문서를 확인한 뒤, `_result` 문서를 갱신하거나 `_result_v1` 등으로 구분해 업로드.

---

## 6. 참고

- 요청 문서 템플릿: `docs/api-spec/FRONTEND_API_REQUEST_TEMPLATE.md` (프론트 저장소)
- API Gap 분석: `docs/specs/admin/ADMIN_API_GAP_ANALYSIS.md`
- 백엔드 쪽 업무 정의: 백엔드 `docs/essentials/FE_BE_API_SPEC_WORKFLOW.md` (BE 팀용)
