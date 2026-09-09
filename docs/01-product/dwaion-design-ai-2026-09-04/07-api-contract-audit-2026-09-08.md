# DWAI·ON 21개 화면 API 계약 감사 · 2026-09-08

결론: 06 문서의 21개 ID에 연결된 핵심 frontend API 호출은 모두 실제 backend route 정의와 일치한다.
존재하지 않는 endpoint를 fixture가 대신 구현한 핵심 화면은 발견하지 않았다. 추가 대조에서 대화
응답을 X03 결과물로 넘기는 사용자 경로와 서버 출처 결속이 없음을 발견했고, 기존 `POST artifacts`
요청에 현재 사용자 범위의 대화·assistant message·grounded status·본문·인용을 검증하는 계약을
추가했다. worker와 외부 공급자의 운영 가용성은 이 감사의 완료 범위가 아니다.

## 읽은 정본과 경로 해석

경로는 frontend 저장소 `dwp-frontend/`를 기준으로 한다. `../`는 같은 상위 작업 폴더의
별도 backend 저장소를 가리킨다.

- Frontend: `libs/shared-utils/src/api/` 및 `apps/dwp/src/features/dwaion/`의 해당 화면.
- Agent: `../dwp_agent/src/dwp_agent/`.
  `main.py:126–142`에서 표에 사용한 router가 모두 실제 app에 포함됨을 확인했다.
- Platform: `../dwp-backend/dwp-platform-server/src/main/java/com/dwp/services/platform/`.
  `registry/RuntimeRegistryController.java`, `registry/DwaionAgentRegistryController.java`,
  `workspace/WorkspaceController.java`를 확인했다. U01/U02/U07/A02의 이 호출을 Agent 소유로 오인하지 않는다.
- 아래 Agent endpoint는 frontend `/api/agent/v1/`, backend `/v1/` 뒤의 경로다.
  Platform endpoint는 frontend `/api/platform/v1/`, backend `/v1/` 뒤의 경로다.
  gateway 정본은 `../dwp-backend/dwp-gateway/src/main/resources/application.yml`이며,
  118/120행과 133/135행의 prefix 제거도 일치한다.
- 표의 `api.ts`는 frontend adapter, `api.py`는 Agent route, `Controller`는 위 Platform 정본이다.
  모든 행에서 HTTP method와 path 정의 존재를 확인했다. 같은 셀의 상대 suffix는 바로 앞의 family 아래다.

## 21개 화면 대조

| ID  | 핵심 method / endpoint                                                                                                                                                                                      | Frontend 호출 근거                                                                                        | 실제 backend 근거                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| U01 | GET conversations; GET proposals?view=ACTIVE&limit=2; GET actions; Platform GET catalog/registry-entries?registryType=AGENT 및 workspace/work-items                                                         | agent-conversation-api.ts:59, agent-proposal-api.ts:25, platform-registry-api.ts:68, workspace-api.ts:376 | main.py:276, proposal_api.py:117, action_api.py:66; Platform RuntimeRegistryController:25, WorkspaceController:33 |
| U02 | POST ask/stream; POST question-launches 및 question-launches/consume; Platform GET workspace/work-items                                                                                                     | agent-runtime-api.ts:277, agent-question-launch-api.ts:15/30, workspace-api.ts:376                        | main.py:247, question_launch_api.py:44/89; WorkspaceController:33                                                 |
| U03 | GET conversations/{id}; POST ask/stream; POST plans/preview; PUT runs/{id}/feedback; POST artifacts with sourceConversation                                                                                 | agent-conversation-api.ts, agent-runtime-api.ts, agent-plan-api.ts, agent-artifact-api.ts                 | main.py, artifact_api.py — 현재 tenant·user 대화와 assistant message를 다시 검증                                  |
| U04 | GET conversations 및 conversations/{id}; PATCH/DELETE conversations/{id}                                                                                                                                    | agent-conversation-api.ts:59/67/119/133                                                                   | main.py:276/295/318/343                                                                                           |
| U05 | GET proposals; POST proposals/analyze; GET/PUT proposals/preferences; POST proposals/clear                                                                                                                  | agent-proposal-api.ts:25/75/89/99/121                                                                     | proposal_api.py:117/158/215/238/270                                                                               |
| U06 | GET proposals의 선택 UUID 데이터; POST proposals/{id}/decisions                                                                                                                                             | agent-proposal-api.ts:25/45                                                                               | proposal_api.py:117/297 — 별도 GET proposals/{id}를 사용하지 않음                                                 |
| U07 | Platform GET catalog/registry-entries?registryType=AGENT; POST question-launches                                                                                                                            | platform-registry-api.ts:68, agent-question-launch-api.ts:15                                              | RuntimeRegistryController:25; question_launch_api.py:44                                                           |
| U08 | GET actions; POST actions/{key}/preview; POST plans/preview; 명시 CTA로 원본 앱 route 인계                                                                                                                  | agent-conversation-api.ts:150/158, agent-plan-api.ts:112                                                  | action_api.py:66/99, main.py:387 — Agent의 업무 실행 완료 endpoint를 만들지 않음                                  |
| U09 | GET runs; GET runs/{id}                                                                                                                                                                                     | agent-run-api.ts:94/111                                                                                   | user_run_api.py:36/62                                                                                             |
| U10 | POST voice/transcriptions; POST voice/speech; POST ask/stream; 지원 목적지는 frontend route                                                                                                                 | agent-voice-api.ts:24/54, agent-runtime-api.ts:277                                                        | voice_api.py:63/113, main.py:247                                                                                  |
| X01 | GET/POST routines; GET/PUT routines/{id}; POST {id}/consent, lifecycle, dry-runs, archive                                                                                                                   | agent-routine-api.ts:23–119                                                                               | personal_routine_api.py:41/51/64/77/93/109/127/143                                                                |
| X02 | GET/PUT ai-controls; PUT ai-controls/runtime 및 sources/{key}; GET/POST memories; PUT memories/{id}; POST {id}/state, delete; GET personal-data/retention, capabilities; POST deletions; GET deletions/{id} | agent-personal-ai-api.ts:29–189                                                                           | personal_memory_api.py:44–167; domain_retention_api.py:44/57/93/115                                               |
| X03 | GET/POST artifacts; POST 생성의 선택적 sourceConversation; GET {id}; PUT {id}/draft; GET/POST {id}/versions; GET {id}/versions/{n}; GET preflights/current; POST preflights, publish, exports               | agent-artifact-api.ts                                                                                     | artifact_api.py, artifact_contracts.py                                                                            |
| A01 | GET admin/overview?period_days=1..90                                                                                                                                                                        | agent-admin-api.ts:220                                                                                    | operations_api.py:85                                                                                              |
| A02 | Platform GET/POST admin/dwaion/agents; GET {key}; POST {key}/revisions; PATCH {key}/revisions/{revision}; POST activate, retire                                                                             | platform-registry-api.ts:159–224                                                                          | DwaionAgentRegistryController:34/45/52/72/83/95/108                                                               |
| A03 | GET admin/sources; PATCH admin/sources/{key}                                                                                                                                                                | agent-admin-api.ts:246/253                                                                                | governance_api.py:80/121                                                                                          |
| A04 | GET admin/actions; PATCH admin/actions/{key}                                                                                                                                                                | agent-admin-api.ts:264/271                                                                                | governance_api.py:151/189                                                                                         |
| A05 | GET/PATCH admin/safety                                                                                                                                                                                      | agent-admin-api.ts:282/289                                                                                | governance_safety_api.py:29/70                                                                                    |
| A06 | GET/POST admin/evaluations; GET {set}; POST {set}/cases; PATCH {set}/lifecycle; GET/POST {set}/runs; GET {set}/runs/{run} 및 /export                                                                        | agent-admin-api.ts:299–391                                                                                | governance_api.py:219/233/252/275/305/334/370/391/416                                                             |
| A07 | GET admin/gates; GET/PATCH admin/gates/{key}; POST {key}/evidence, validation, decision; 모든 호출에 environment 범위                                                                                       | agent-admin-gate-api.ts:61–156                                                                            | operational_gate_api.py:110/158/173/204/236/267                                                                   |
| A08 | GET admin/audit 및 admin/audit/export; GET/PATCH admin/retention                                                                                                                                            | agent-admin-api.ts:229/236/397/415                                                                        | governance_api.py:446/461; operations_api.py:109/160                                                              |

## fixture·운영 실행 경계 재확인

- U01의 제안은 실제 `getDwaionProposals('ACTIVE', 2)` 조회다. fixture에만 있는 신규 endpoint가 아니다.
  06 문서에는 **“ACTIVE 제안 최대 2건 조회”**로 반영했다(`dwaion-home.tsx:70`).
  0/1건도 유효하며 두 건의 운영 데이터가 항상 존재한다고 보장하지 않는다.
- U03/U08: `planner.py:145–156`의 결과는 `REVIEW`, `mutation_allowed=False`, `reference_mode=True`다.
  frontend `agent-plan-api.ts:83–109`도 이를 검증한다. 원본 앱 handoff는 별도 업무 확정이며
  문서가 API에 없는 Agent의 발송/제출 완료를 주장하지 않는다.
- U05/U06: `proposal_api.py:297`의 결정은 `ProposalDecisionReceipt`를 반환하고 필요 시
  `action_review_required`를 표시한다. 제안 수락과 업무 실행 성공이 분리되어 있다.
- U10: STT/TTS handler는 실제 provider를 호출하며 공급자 미연결/실패는 503이다
  (`voice_api.py:101–104/126–129`). route 존재를 모든 환경의 음성 공급자 준비 완료로 표현하지 않는다.
- X01: `personal_routine_contracts.py:142–175`에서 `DRY_RUN_ONLY`, scheduling/background/notification/
  proposal delivery/external write unavailable이 명시된다. 06 문서의 scheduler 후속 조건과 일치한다.
- X02: `domain_retention_api.py:93`은 HTTP 202 삭제 요청 영수증이며,
  `governed_domain_contracts.py:52–57`은 deletion execution unavailable이다. store가 REQUESTED 또는
  legal-hold 차단 상태를 기록한다. `personal_memory_runtime.py:30–55`의 답변 개인화는 실제 구현되어 있고
  저장 동의·runtime 동의·권한·지원 Agent를 확인한다. 삭제 요청을 실제 물리 삭제 완료로 쓰지 않았다.
- X03: `artifact_contracts.py:54–66`은 deterministic preflight 및 personal publish state를 지원하지만
  source verification/freshness/DLP connector/export execution은 false다.
  `ArtifactExportReceipt:203–214`는 `PENDING`, `execution_available=False`, `file_available=False`이고
  export API는 HTTP 202다. 06의 “request-only export”와 외부 worker 경계가 정확하다.
  대화에서 생성할 때는 client가 `sourceConversation`과 임의 `sources`를 함께 보낼 수 없다. 서버가
  현재 tenant·user의 정확한 대화와 assistant message를 조회하고 `ANSWER_GROUNDED` 또는
  `ANSWER_GROUNDED_FALLBACK`, 비어 있지 않은 인용, 제출 본문과 저장 답변의 일치를 확인한 뒤
  `conversation:<id>:message:<id>:citation:<sourceId>` 형태의 opaque reference를 만든다. 이는
  provenance 결속이며 connector 기반 진위·최신성 검증 완료를 뜻하지 않는다.
- A02/A03: 실제 registry lifecycle과 source 정책 저장이 존재한다. 이를 runtime model health 또는
  connector 연결 검사의 성공으로 치환한 문구는 발견하지 않았다.
- A06: `evaluation_runner.py:98–116`은 expected-term 일치·grounding 규칙을 기록한다. 표본 규칙 검사를
  모델 정확도 향상이나 동등 버전 회귀 비교로 확대하지 않는 06 문구와 일치한다.
- A07: evidence/validation/decision은 실제 명령이지만 자동 환경 진단 실행기는 아니다.
  06 문서는 자기 승인·자격·증거 만료와 명령을 설명하며 자동 진단 완료를 주장하지 않는다.
- A08: 감사 CSV는 실제 응답이다. `governance_api.py:475–480`에 limit 10000 및 실제 truncated 헤더가 있고
  frontend는 두 헤더를 읽는다. 이를 X03의 미연결 파일 export worker와 혼동하지 않는다.

감사에서 발견한 대화→결과물 결속 누락은 기존 endpoint의 하위 호환 요청 필드와 UI 동작으로
보완했다. U01 “최대 2건” 표현도 반영했다. 최종 실행 수치는 06 문서의 최신 검증 부록과
[Live 35 최신 완료 검증](implementation-evidence/2026-09-09/live-35-completion/verification.md)을
따른다.

표현 정리 및 이 감사 링크 추가 전, 최초 검토한 06 문서 SHA-256: `028c1fb24dd5cb24153f0b552e009f40649c447d3da82b19679403caf390f715`.
