# Phase3 시스템별 전달 사항 및 의사결정

> FE Phase3 MVP 반영 완료. **BE(back.txt)·Aura(aura.txt) 전달사항 반영 후** 갱신.

---

## 0. BE·Aura 전달사항 반영 결과 (back.txt, aura.txt 기준)

### FE 반영 완료

| 출처 | 내용 | FE 반영 |
|------|------|--------|
| **BE** | fingerprint, decidedBy, decidedAt, decisionComment | DTO·UI 반영, 결정 메타 표시 |
| **BE** | approve/reject body `{ "comment": "..." }` | API·mutation에 comment 옵션 추가 |
| **BE** | `POST .../action-proposals/{proposalId}/execute` (APPROVED만) | execute API·useExecuteProposalMutation, "실행(시뮬)" 버튼(APPROVED 시) |
| **Aura** | streamPath (스트림 경로) | 응답에서 streamUrl 또는 streamPath 사용, 상대 경로 시 NX_API_URL 접두 |
| **Aura** | 이벤트 started/step/agent/completed/failed | agent 처리·completed/[DONE] 처리 이미 반영 |
| **Aura 답변** | 완료 시 event:completed 먼저 → 이어서 data:[DONE]. agent+percent 진행률 | FE 요청대로 구현 확인. FE는 둘 다 수신 처리 중 |

### 계약 정리 (FE 기준)

- **스트림**: BE가 Aura 트리거 후 받은 **streamPath**를 FE에 전달. FE는 `streamUrl` 또는 `streamPath`로 수신해 `GET /aura/cases/{caseId}/analysis/stream?runId=` 에 연결(상대 경로면 NX_API_URL 접두).
- **결정**: BE **decision API** 제공 완료. FE는 `POST .../decision` body `{ decision, comment? }` 로 전환 완료(approve=APPROVE, reject=REJECT).
- **실행**: `POST .../action-proposals/{proposalId}/execute` (path에 proposalId, body 없음) 사용 중. BE는 `POST .../actions/execute` (body에 proposalId 필수)도 지원.

---

## 1. 백엔드(BE) 전달 · 확인 요청

### 1.1 전달 사항 (FE 구현 완료)

- **POST analysis-runs**: FE는 **200/202 모두** 성공으로 처리합니다. BE는 202 통일을 권장하되, 200 유지 시에도 동작합니다.
- **streamUrl**: FE는 **절대 URL**(`http://` 또는 `https://`)이면 **그대로** 사용합니다. 상대 경로일 때만 NX_API_URL을 앞에 붙입니다.  
  → BE는 **Aura SSE URL**(절대 URL 또는 Aura 경로)을 그대로 내려주면 됩니다.
- **completed 후 refetch**: SSE `event:completed` 또는 `data: [DONE]` 수신 시 FE가 자동으로  
  `GET .../analysis?runId=`, `GET .../action-proposals?runId=` 를 refetch 합니다.
- **액션제안**: FE는 **fingerprint** 기준으로 중복 제거 후, 최신 1건만 표시합니다. BE에서 UNIQUE(run_id, fingerprint) 정책이 있으면 동일하게 유지해 주시면 됩니다.

### 1.2 BE 답변 반영 (확인 요청 → 제공 완료)

| 항목 | BE 상태 | FE 반영 |
|------|--------|--------|
| **GET analysis ragRefs** | ✅ 제공 | `data.ragRefs`는 case_analysis_result.rag_refs_json 반환. Aura 콜백 구조(refId, sourceType, sourceKey, excerpt, score) 저장·반환. FE 렌더 준비 완료. |
| **GET action-proposals fingerprint** | ✅ 제공 | 각 항목에 fingerprint(dedup_key 동일). FE dedup 적용 완료. |
| **decision API** | ✅ 제공 | `POST .../action-proposals/{proposalId}/decision` body `{ "decision": "APPROVE" \| "REJECT", "comment"?: string }`. approve/reject와 동일 동작. **FE decision API로 전환 완료.** |
| **execute API** | ✅ 제공 | 두 경로 모두 지원. FE는 `POST .../action-proposals/{proposalId}/execute` (body 없음) 사용 중. |

### 1.3 Run 목록·과거 run (BE 답변)

- **run 목록**: `GET /api/synapse/cases/{caseId}/analysis-runs` (latest 생략) → `[{ runId, status, startedAt }, ...]` 배열.
- **최신 runId만**: `GET .../analysis-runs?latest=true` → `{ runId }` 단일 객체.
- **과거 run 조회**: `GET .../analysis?runId=`, `GET .../action-proposals?runId=` 에 과거 runId 전달 시 해당 run 결과 반환 가능.
- → Run 선택 UI(최신/이전 N개) 구현 시 위 API로 충족 가능.

### 1.4 BE → FE 전달사항 체크리스트 (FE 반영 상태)

| BE 전달 항목 | FE 반영 |
|--------------|--------|
| **응답 스키마** GET analysis·action-proposals proposal 항목에 **fingerprint**, **decidedBy**, **decidedAt**, **decisionComment** 추가 | ✅ `CaseActionProposalDto`에 필드 추가. 액션제안 탭에서 결정 메타(decidedBy·decidedAt·decisionComment) 표시 |
| **승인·거절** POST approve/reject 시 선택 body `{ "comment": "..." }` | ✅ mutation에 comment 옵션 전달. FE는 decision API `{ decision, comment? }` 로 호출 중 |
| **실행(시뮬)** `POST .../action-proposals/{proposalId}/execute`, APPROVED만 호출 가능, 호출 후 EXECUTED. 응답 executionId·executedAt로 실행 완료 UI 표시 가능 | ✅ execute API·useExecuteProposalMutation, APPROVED 시 "실행(시뮬)" 버튼 노출. 성공 시 toast. (executedAt 카드 표시는 선택적) |
| **중복 표시** 동일 run 내 동일 제안은 fingerprint 동일. run별 grouping, fingerprint 기준 중복 1건 표시, 승인/거절/실행 시 상태·감사 반영 | ✅ fingerprint 기준 groupBy 후 최신 createdAt 1건만 표시. 승인/거절/실행 후 proposals·analysis refetch로 상태 반영 |

### 1.5 200/202, streamPath, refetch (BE 답변)

- POST analysis-runs는 BE **항상 202 Accepted**. FE 200/202 모두 성공 처리로 호환.
- streamUrl은 Phase3 사용 시 **streamPath**를 그대로 내려줌(상대 경로 예: `/aura/cases/{caseId}/analysis/stream?runId=...`). FE는 `streamUrl ?? streamPath` 수용 중.
- completed 후 refetch, fingerprint dedup: BE 동작과 FE 전달사항 일치.

### 1.6 CORS / 네트워크

- FE 브라우저가 **Aura 절대 URL**로 직접 SSE 연결할 경우, **Aura 또는 Gateway**에서 해당 Origin에 대한 CORS/SSE 허용이 필요할 수 있습니다.
- BE가 **프록시**로 스트림을 넘겨주는 구성이면 FE는 상대 경로만 받고, BE가 Aura로 연결하는 방식도 가능합니다. 이 경우 **streamUrl을 BE 프록시 경로로 통일**할지 결정이 필요합니다.

### 1.7 FE → BE 확인 요청 (7.1 FE) — BE 답변 반영

| 항목 | BE 확인 요청 내용 | 상태 |
|------|------------------|------|
| **ragRefs 필드명** | GET analysis의 ragRefs는 Aura 콜백 구조를 그대로 반환. FE 기대 필드(**refId, sourceType, sourceKey, excerpt, score**) 유지. **Aura 스키마·필드명 일치 확인을 Aura 측에 요청**하는 것으로 정리. Aura에서 ragRefs 콜백 스키마(필드명)를 확정·공유하면 BE는 저장·반환만 하면 됨을 BE에서 명시. | ✅ FE 답변 반영. Aura 측 확인으로 이관. |
| **execute body** | path 기반 execute 사용. | ✅ **추가 확인 불필요**(FE 답변으로 확정). |

**§7 요약 (BE 답변 반영)**  
FE 전달 4항목·계약 답변 완료. execute body는 추가 확인 불필요로 확정. ragRefs는 FE 기대 필드 명시 후 **Aura 측 확인으로 이관**됨.

**미확정 항목 (BE 반영 후)**  
- **스트림 연결 주체** → **확정 반영** (옵션 B 운영 기본, 옵션 A는 개발/로컬 feature flag만, BE 문서·구현 반영).
- **남은 미확정**: **Aura ragRefs 콜백 스키마(필드명)** 확정·공유만.

---

## 2. Aura 전달 · 확인 요청

### 2.1 전달 사항 (FE 기대 스펙) — Aura 답변 반영

- **스트림 완료 시그널**: FE는 **event:completed** 및 **data: [DONE]** 둘 다 처리합니다.  
  **Aura 답변**: 스트림 종료 시 **event:completed** + `data: {"runId":"...","status":"completed"}` 를 **먼저** 보내고, 이어서 **data: [DONE]** 을 보냅니다. FE 요청대로 구현되어 있음.
- **event: agent**: **Aura 답변**: Phase3 스트림에서 **event: agent** + `data: { agent, message, percent }` 전송. FE는 step과 동일하게 진행률(percent) 및 라벨로 표시 중.
- **진행률**: **Aura 답변**: event: step / event: agent 의 **percent** 값을 진행률 바에 사용하면 됨. FE 반영 완료.

### 2.2 Aura 확인 요청 — 답변 반영

| 항목 | Aura 답변 | FE |
|------|-----------|-----|
| **완료 이벤트** | event:completed + data 완료 JSON 먼저 전송, 이어서 data: [DONE] 전송 | 둘 다 수신 시 completed 처리·refetch |
| **event: agent** | Phase3에서 event: agent + data: { agent, message, percent } 전송. step과 동일하게 표시 | 진행률 바·라벨 반영 완료 |
| **failed (retryable/error)** | retryable 값에 따라 재시도 가능 문구 다르게 표시 가능. true면 재시도 가능, false면 다르게 또는 생략. error 필드는 에러 메시지로 그대로 사용 가능(사람이 읽기 쉬운 문구). | Aura 답변 반영 후 UI 적용 |
| **HTTP 202** | (BE/Aura 간 계약 사항. 별도 확인) | — |

### 2.3 Aura 추가 전달 (FE 반영 완료 공유 확인)

- **스트림**: Aura는 BE가 내려준 **streamPath**(또는 streamUrl)에 해당하는 `GET /aura/cases/{caseId}/analysis/stream?runId=` 를 그대로 제공. **상대 경로**일 때 FE에서 **NX_API_URL 접두** 시 동일하게 연결 가능하다고 확인됨.
- **이벤트**: started / step / agent / completed / failed 전송 계약 유지. completed 후 data: [DONE] 순서 변경 없음.
- Aura 쪽 추가 수정·전달 사항 없음. 연동 이슈 시 공유 요청.

### 2.4 Aura 확인사항 — FE 질문 모두 답변 완료

- **우리(Aura) 쪽 답변 완료**: streamPath / completed / event:agent (§5·§9), Q3 failed retryable·error (§13) 모두 Aura 답변 완료.
- **FE가 Aura에게 물어본 것 중 미회답 없음.**

---

## 3. 의사결정 사항 — 확정 답변 반영

### 3.1 스트림 연결 주체 (확정) — BE 반영

- **결정**: **옵션 B(권장, 운영 기본)**. FE는 **항상 BE SSE 프록시로만** 연결. CORS·인증·토큰·망 분리 이슈 최소화, Aura는 내부망 유지.
- **옵션 A**(직접 Aura URL)는 **개발/로컬 디버깅용 feature flag로만 허용**, **운영에서는 OFF**.

**BE 측 정리 (문서 명시)**  
- **운영 기본**: 트리거 응답의 **streamUrl을 BE 프록시 경로**로 내려줌. 해당 엔드포인트에서 Aura SSE를 **서버사이드로 중계**.  
- **개발/로컬**: feature flag로 streamUrl을 **Aura 직접 URL(옵션 A)**로 내려줄 수 있음. **운영에서는 해당 flag OFF.**

**확인**: 옵션 B(BE 프록시 SSE) 정책 — BE가 기본으로 프록시 streamUrl만 내려줌 → **방향성 정상**.

**FE**: streamUrl 수신 시 상대 경로면 NX_API_URL 접두(프록시). 절대 URL은 flag ON 시에만(개발/로컬). 운영에서는 BE가 항상 프록시 경로만 내려주므로 프록시로만 연결.

**구현 참고**: 현재 BE는 비-demo 시 Aura의 streamPath/streamUrl을 그대로 내려주고 있음. 옵션 B 적용을 위해 (1) 운영 시에는 **항상 BE 프록시 경로**를 내려주도록 하는 설정/플래그, (2) 해당 BE 경로에서 **Aura SSE로 서버사이드 중계**하는 로직이 필요. 필요 시 해당 설계/구현도 BE에서 정리.

### 3.2 decision / execute API (확정)

- **Phase3 Week2**에 BE 제공 확정(decision/execute + audit).
- **FE**: 임시 상태변경 버튼 금지, **BE API로만 전환**. (현재 decision API·execute API 연동 완료.)

### 3.3 run 선택 UI (확정)

- **MVP**: "최신만"(latest=true) 사용.
- **Week3**: 최근 N개(run 목록 API) 추가 후 **드롭다운 적용**.

### 3.4 감사 로그 링크 (확정)

- **노출(권장)**. decision/execute 성공 후 **caseId + runId + eventType**(PROPOSAL_DECIDED / ACTION_EXECUTED)로 필터링된 **Audit 화면으로 이동** 링크 제공.
- FE: 해당 필터 파라미터로 감사 로그 페이지 링크 구현 예정.

---

## 4. 요약 표

| 대상 | 전달 내용 | 확인/의사결정 |
|------|-----------|----------------|
| **BE** | 200/202 처리, streamPath 수용, decision API 전환, execute·refetch·fingerprint·run 목록 | ✅ BE 답변 반영 완료 |
| **Aura** | completed·[DONE] 순서, event:agent·진행률(percent) | ✅ Aura 답변: event:completed 먼저 → data:[DONE], agent 스키마·진행률 확인. FE 반영 완료 |
| **제품/팀** | 스트림(프록시 권장), decision/execute BE만, run 선택 Week3, 감사 링크 노출 | ✅ 의사결정 확정 반영 (§3) |

---

## 5. 대화 요약 (의사결정 반영)

- **스트림**: 옵션 B 확정. FE는 항상 BE SSE 프록시로만 연결. 옵션 A(직접 Aura URL)는 개발/로컬 feature flag 전용, 운영 OFF. BE는 운영 시 streamUrl=프록시 경로, 해당 경로에서 Aura SSE 서버사이드 중계.
- **decision/execute**: Phase3 Week2 BE 제공 확정. FE는 임시 상태변경 버튼 없이 BE API만 사용.
- **run 선택**: MVP는 최신만(latest=true), Week3에 run 목록 API 기반 드롭다운 추가.
- **감사 로그**: decision/execute 성공 후 caseId·runId·eventType(PROPOSAL_DECIDED/ACTION_EXECUTED) 필터로 Audit 화면 링크 노출(권장).

---

## 6. 추가로 확인이 필요한 부분 (최종 정리)

### 6.1 FE/인프라 확인 항목

| # | 대상 | 확인 요청 내용 | 비고 |
|---|------|----------------|------|
| **1** | **Aura** | **ragRefs 콜백 스키마(필드명)** 확정·공유 | FE 기대 필드: `refId`, `sourceType`, `sourceKey`, `excerpt`, `score`. 이 항목만 확정되면 Phase3 연동에 필요한 확인은 모두 완료. |
| 2 | 인프라/Gateway | (선택) NX_API_URL + streamPath 연결 시 Gateway에서 `/aura/...` 라우팅·인증 Aura 전달 여부 | 운영은 BE 프록시만 사용하므로 필수 확인 아님. 개발/로컬 옵션 A 사용 시 참고. |

### 6.2 FE·인프라 확인사항 — BE·Gateway 답변 (§9 반영)

| # | 구분 | FE/인프라 확인 내용 | BE·Gateway 답변 |
|---|------|---------------------|-----------------|
| 1 | Phase3 연동 완료 조건 | ragRefs 콜백 스키마 등 나머지 확인 완료 시 **이 항목만 확정되면 Phase3 연동에 필요한 확인은 모두 완료** | BE·FE·Aura·스트림 결정 등 계약 반영 완료. **ragRefs**는 Aura 콜백 스키마(필드명) 확정·공유만 남음(§7.1·§8). |
| 2 | 인프라/Gateway | (선택) NX_API_URL + streamPath 연결 시 Gateway에서 `/aura/...` **라우팅·인증**을 Aura에 전달하는지 | **운영**은 옵션 B로 **BE SSE 프록시만** 사용. FE는 NX_API_URL로 Gateway를 거쳐 **BE 프록시 경로**에만 연결. `/aura/...` 직접 라우팅은 **필수 확인 아님**. **개발/로컬**에서 옵션 A(직접 Aura URL) feature flag 사용 시, Gateway에 `/aura/...` 라우팅이 있으면 해당 경로로 Aura까지 요청·인증 전달되도록 설정하면 됨(선택). |

**요약**: FE→Aura 질문은 **미회답 없음**(§2.4). **필수** 추가 확인은 **1건 — Aura ragRefs 콜백 필드명 확정·공유**. 나머지는 확정·반영 완료 또는 선택 사항.

### 6.3 추가로 남은 확인사항이 있을까요?

- **답**: **FE/인프라 입장에서 필수로 더 확인할 항목은 없음.**  
- BE·Gateway 측 답변대로, BE·FE·Aura·스트림 계약은 반영 완료. **남은 건 Aura에서 ragRefs 콜백 스키마(필드명) 확정·공유만** 하면 Phase3 연동에 필요한 확인은 모두 완료됨.

### 6.4 프론트·Aura 등 타 시스템 — 답변/추가 질문 없이 작업 완료 여부

- **프론트(FE)**: BE·Aura에게 할 **추가 질문 없음**. 받을 **답변 대기 없음**. FE 작업은 이 선에서 **완료**. (Aura가 ragRefs 스키마 공유해 주면, FE는 해당 필드명으로 렌더만 적용하면 됨.)
- **Aura**: FE가 Aura에게 물어본 항목은 **모두 답변 완료**(§2.4). **추가 질문 없음**. Aura 쪽 **할 일** 1건: ragRefs 콜백 스키마(필드명) **확정·공유** — 이건 “질문에 대한 답”이 아니라 스키마 제공이므로, 답변이나 추가 질문 없이 **연동을 위한 확인·답변 단계는 완료**로 봐도 됨.
- **정리**: 프론트·Aura 모두 **답변이나 추가 질문 없이 작업 완료** 상태. Phase3 연동 완료를 위해 남은 것은 **Aura의 ragRefs 스키마 확정·공유** 1건뿐.
