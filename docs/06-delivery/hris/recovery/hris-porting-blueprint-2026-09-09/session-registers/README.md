# 5개 세션별 source coverage 대장

`five-session-source-coverage-register.csv`를 세션별로 분할한 작업 사본이다. 각 세션은 자신의 파일만 수정하고, 통합·검증 task가 checkpoint마다 master를 재생성·검증한다.

| 세션 | 파일 | raw 행 |
|---|---|---:|
| HRIS-HRM | `hris-hrm-source-coverage.csv` | 583 |
| HRIS-PER | `hris-per-source-coverage.csv` | 349 |
| HRIS-PAY | `hris-pay-source-coverage.csv` | 580 |
| HRIS-TIM | `hris-tim-source-coverage.csv` | 568 |
| HRIS-SYS | `hris-sys-source-coverage.csv` | 189 |

HRM raw 행에는 범위에서 제외된 BENSK benefit route 2개가 추적 보존 목적으로 포함되고 `RETIRE/EXCLUDED_BENSK/PREDECIDED`로 표시돼 있다.

## 편집 규칙

- `artifact_id`, `session_id`, source 위치는 변경하지 않는다.
- `disposition`, target capability/context/API-owner, process change, genericity, acceptance evidence, decision status/owner/notes를 채운다.
- 하나의 source가 여러 target capability로 갈 때 행을 삭제하지 말고 notes/child trace에 N:M 관계를 기록한다.
- service/job/interface/formula/file/SQL/state-transition 발견은 연결된 parent artifact와 함께 child artifact register로 추가한다.
- 고객사 표식이 있는 행은 core/tenant config/country pack/extension/retire를 명시적으로 판정한다.
- `UNKNOWN`을 빈칸이나 임의 `REBUILD`로 바꾸지 않는다. 필요한 운영자료와 owner를 함께 기록한다.
