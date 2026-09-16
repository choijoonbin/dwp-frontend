# 개발 전문가 에이전트 전달문

이 문서는 분석 결과를 실제 개발 작업으로 넘길 때 사용하는 실행 단위다. 각 단위는 독립 worktree와 branch에서 수행하고, 사용자 승인 없이 서로의 dirty worktree를 섞지 않는다. 기준 커밋은 README의 세 저장소 SHA다.

## 공통 지시

```text
DWAI·ON 기능을 구현한다. 화면 모양만 완성하거나 mock으로 성공시키지 말고
Frontend, Backend/Gateway product authorization, Agent API·store·worker,
권한, audit, recovery와 테스트를 하나의 계약으로 닫는다.

시작 전:
1. 각 저장소 AGENTS.md와 관련 product/design 문서를 읽는다.
2. 기준 branch와 remote head를 확인한다.
3. 기존 dirty worktree를 수정하지 않고 isolated worktree를 만든다.
4. 현재 구현, dirty-only 변경, 기준 커밋의 차이를 기록한다.

공통 구현 규칙:
- tenant/user/plane/resource/source 권한을 서버에서 다시 검증한다.
- 민감 payload를 URL, browser history, log, audit summary에 넣지 않는다.
- mutation은 reason, expectedVersion, idempotency command UUID를 사용한다.
- requested, accepted, running, handoff, domain-completed, partial, failed,
  cancelled, compensated를 구분한다.
- partial/unavailable을 success나 zero로 바꾸지 않는다.
- generated contract는 canonical source에서 재생성한다.
- 기존 fixture test에 더해 실제 service integration 경계를 검증한다.

완료 보고:
- 저장소별 commit SHA와 push branch
- 바뀐 API·권한·DB migration·worker·화면
- 정상·거부·부분 실패·재시도·복구 test
- 실제 endpoint를 통과한 증거와 fixture 증거를 분리
- 남은 운영 dependency와 비활성 capability
```

## E-00A. 공식 PAGE 권한 승격

```text
목표: 다음 DWAI·ON PAGE를 Frontend DRAFT route에서 Backend 공식
product surface 계약으로 승격한다.

- route.dwaion.work.new.page
- route.dwaion.work.conversations.page
- route.dwaion.work.conversation-detail.page
- route.dwaion.work.activity.page
- route.dwaion.work.agents.page

해야 할 일:
1. Backend canonical product authorization source에 다섯 PAGE를 SELF scope로 등록한다.
2. bundle 110/111 계열 artifact와 checksum/index를 정식 생성 절차로 갱신한다.
3. Frontend authorization projection과 official route source를 재생성한다.
4. 다섯 route가 DRAFT source에서 사라지는 test를 추가한다.
5. 권한 있음, entitlement 없음, cross-tenant, direct URL, conversation deep link,
   rollout flag/context/decision 누락을 검증한다.
6. navigation 가시성과 route 접근 결과가 같은 권한 결정을 사용하게 한다.

완료 조건:
- 공식 registry에 다섯 PAGE가 존재한다.
- frontend DRAFT count에서 해당 다섯 개만 제거된다.
- rollout fail-closed 환경에서 허용/거부가 의도대로 동작한다.
- 다른 제품 surface checksum과 route를 임의로 바꾸지 않는다.
```

## E-00B. AI 제안→행동 검토→원본 완료

```text
목표: 수락한 AI 제안의 정확한 action 문맥을 governed review로 전달하고
원본 앱 결과까지 하나의 trace로 연결한다.

현행 문제:
- DwaionProposal에는 proposalId, actionKey, content.actionInputs, evidence가 있다.
- 수락 응답은 actionReviewRequired를 제공한다.
- UI는 /dwaion/actions로만 이동해 문맥을 잃는다.

구현:
1. proposal-to-action-draft 서버 endpoint 또는 one-time opaque launch contract를 만든다.
2. token/lookup은 tenant, user, proposal, expiry, one-time consumption에 결속한다.
3. action review가 actionKey, typed inputs, evidence, target version을 복원한다.
4. preview 직전에 proposal validity, source ACL, action permission, target revision을 재검증한다.
5. 제안 수락 receipt, preview receipt, target handoff, domain result를 correlation ID로 연결한다.
6. 원본 앱 callback/receipt가 없으면 완료가 아니라 ‘대상 앱에서 확인 필요’로 유지한다.
7. 복원 실패 시 generic catalog로 조용히 보내지 않고 retry/return/correlation을 제공한다.
8. 현재 ACL 공유가 없는 대화 버튼은 ‘링크 복사’로 정정한다.

테스트:
- 정상 수락→preview→handoff
- expired proposal, mismatched action, tampered/used token
- 권한·source·target revision 변경
- duplicate click와 response loss
- domain success/partial/failure/compensation
- URL/history/log에 action input과 evidence 원문이 없음
```

## E-01. 보안형 첨부와 Deep Research

```text
목표: /dwaion/new에 기업용 첨부 처리와 장기 연구를 추가하고,
Activity와 Artifacts까지 내구성 있게 연결한다.

기능 범위:
- PDF, DOCX, XLSX/CSV, PNG/JPG upload session
- checksum, type/size, malware, DLP/classification, retention preflight
- parser version과 page/sheet/cell/image-region provenance
- research plan, source scope, time/cost budget, pause/resume/cancel
- durable run/step/event, retry, partial completion
- sentence/table-row citation과 source ACL/freshness revalidation
- immutable report artifact, preflight, export request

아키텍처:
- Frontend는 raw file을 URL에 넣지 않는다.
- Gateway는 delegated identity와 upload authorization을 결속한다.
- Agent는 object reference와 verified extraction만 사용한다.
- object store, parser, scan/DLP, index는 상태와 receipt를 제공한다.
- source 접근 철회와 retention deletion이 cached citation/export에 전파된다.

출시 단계:
1. scan/parse/citation이 가능한 단일 파일 질문
2. 여러 파일과 사내 source 결합
3. durable Deep Research
4. 산출물 저장·검토·export

테스트에는 악성 파일, encrypted file, parser partial, DLP block, ACL revoke,
budget/time limit, worker restart, cancel, duplicate upload, deletion을 포함한다.
```

## E-02. 모델 및 라우팅 Control Plane

```text
목표: /dwaion/admin/models를 실제 운영 가능한 provider/model control plane으로 구현한다.

Backend/Agent 계약:
- provider와 immutable model snapshot registry
- vault/managed identity secret reference만 저장
- tenant/Agent/task/data-class/modality route policy
- region, retention, training-use, residency constraint
- primary/fallback, fallback 금지, latency/cost/quality limit
- daily/monthly/per-run budget과 warn/throttle/block
- validation probe, health, circuit breaker
- version diff, maker-checker approval, canary, rollback, emergency stop
- audit·incident·evaluation evidence binding

Frontend:
- registry, routing matrix, read-only simulator, cost limits, rollout timeline
- 등록/인증/검증/현재 health/배포 상태를 분리
- 개인 질문·답변 원문을 노출하지 않음
- VIEW, UPDATE, APPROVE, ROLLBACK, EMERGENCY_STOP 분리

테스트:
- region/data-class allow/deny
- fallback allowed/blocked
- credential expired, provider timeout, circuit open
- budget threshold
- stale policy version, self-approval deny
- canary regression stop와 rollback
- emergency stop scope·TTL·second approval·audit
```

## E-03. Durable Routines·평가·사고 대응

```text
목표: 현재 DRY_RUN_ONLY 루틴을 읽기 중심의 안전한 실제 실행으로 열고,
production evaluation과 incident recovery를 연결한다.

1단계 루틴:
- schedule와 승인된 event trigger
- timezone, active window, quiet hours, expiry
- durable lease, dedupe, retry/backoff, cancel
- per-run/day/month budget
- 결과는 AI 제안함 또는 알림, 외부 write 없음
- 실행마다 source coverage와 receipt

2단계 제한 행동:
- 명시적 사용자 동의와 관리 policy가 모두 허용한 저위험 action만
- 실행 직전 domain PEP, approval, idempotency
- 실패 시 compensation 또는 수동 복구

평가와 운영:
- dataset/model/prompt/policy/tool version pinning
- citation, abstention, ACL leak, injection, harmful action, latency, cost
- privacy-minimized production sample과 feedback linkage
- threshold breach가 Gate와 rollout stop에 연결
- Overview에 incident queue와 영향 범위
- model/Agent/tool/connector scoped stop, quarantine, replay, recovery approval

테스트:
- worker restart와 lease takeover
- duplicate trigger와 quiet-hours delay
- 권한 만료와 budget 초과
- partial source와 proposal delivery failure
- regression alert→containment→validation→resume
- immutable timeline과 audit receipt
```
