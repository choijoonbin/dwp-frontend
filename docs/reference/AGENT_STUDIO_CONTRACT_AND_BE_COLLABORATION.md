# 에이전트 스튜디오 계약 및 백엔드 협의 사항

이 문서는 에이전트 스튜디오(Agent Studio) 관련 FE–BE–Aura 계약과, 백엔드와 협의해야 할 사항을 정리합니다.

---

## 1. 도구 명칭 일치 (Naming)

### 계약

- **백엔드 DB의 `tool_name`**과 **Aura 코드의 `@tool` 함수명**은 **반드시 동일한 값**을 사용해야 합니다.
- 예: `web_search` vs "Google Search" 중 **하나로 통일** (권장: 식별자 형태인 `web_search`를 DB와 Aura에서 공통 사용).

### FE 동작

- 도구 카탈로그 API(`GET /api/synapse/agents/tools/catalog`) 응답의 **`key`** 필드를 그대로 사용합니다.
- 에이전트 설정 저장 시 **`toolKeys`**에는 이 `key` 값만 전송합니다.
- UI 라벨(`label`)은 표시용이며, 저장·라우팅에는 **`key`(= tool_name = @tool 함수명)만** 사용합니다.

### BE/Aura 요구사항 (6.8 Aura 답변 반영)

- 카탈로그의 `key`는 DB `tool_name` 및 Aura `@tool` 함수명과 **완전 동일**해야 함. 다르면 엔진에서 스킵됨.
- **Finance/Synapse 예시**: get_case, search_documents, get_document, get_entity, get_open_items, get_lineage, web_search, simulate_action, propose_action, execute_action. (Git/GitHub 도구 목록은 front.txt 참고.)
- 신규 도구 추가 시 세 곳(tool_name, @tool 이름, 카탈로그 key)을 동일하게 유지할 것.

---

## 2. 구조적 청킹 프리뷰 (Hierarchical Chunking)

### 계약

- 문서 타입 **HIERARCHICAL**(계층형) 업로드 시, Aura가 **조/항 번호**를 올바르게 인식하는지 검증이 필요합니다.

### 검증 요구사항

- FE 또는 연동 플로우에서 **HIERARCHICAL로 업로드된 문서에 대해, 조/항 구조가 Aura 쪽에서 제대로 반영되는지 로그로 1건 이상 교차 검증**해야 합니다.
- 권장:
  - BE 또는 Aura에서 HIERARCHICAL 문서 처리 시 **청크 메타데이터(조/항 등)**를 로그에 남기고,
  - FE에서 해당 문서 1건에 대해 업로드·RAG 검색 또는 에이전트 호출 후, 동일 문서의 로그와 대조하여 1회 이상 검증합니다.

### FE 측 참고

- RAG 문서 등록 시 **HIERARCHICAL** 선택 후 업로드하면 개발 모드 콘솔에 `[RAG] HIERARCHICAL upload submitted` 로그를 남깁니다. BE/Aura 로그와 1건 이상 교차 검증할 수 있습니다. 업로드 완료 후 “계층형 청킹 검증은 BE/Aura 로그로 1건 이상 확인 필요” 안내를 개발/QA 가이드에 반영했습니다.
- 필요 시 BE가 **HIERARCHICAL 문서 1건에 대한 청크 프리뷰 API**를 제공하면, FE에서 해당 응답을 로그로 남겨 교차 검증에 활용할 수 있습니다.

---

## 3. 테스트 채팅(샌드박스)의 신뢰성 — 임시 세션

### 요구사항

- **샌드박스(테스트 채팅)**에서 이루어진 대화는 **DB에 영구 저장되지 않아야** 합니다.
- “임시 세션”으로만 처리되어, 프로덕션 감사/저장 로직과 분리되어야 합니다.

### FE 동작

- 테스트 채팅은 **`POST /api/aura/test/stream`** (또는 BE가 지정한 preview/sandbox 전용 엔드포인트)만 사용합니다.
- 요청 body에 **`sandbox: true`** 와 **`temporary_session: true`** 를 포함하여 전달합니다. BE는 이 요청의 대화를 DB에 영구 저장하지 않도록 구현합니다. BE가 “저장하지 않는 세션”으로 식별할 수 있게 합니다.
- (선택) 헤더 `X-Sandbox: true` 등 BE와 협의한 방식으로 임시 세션임을 표시할 수 있습니다.

### BE 협의 사항

- **협의 필요**: 위 플래그(또는 동일 목적의 헤더/파라미터)를 받았을 때:
  - 해당 요청/세션의 대화 내용을 **DB에 영구 저장하지 않음**.
  - 감사 로그·통계 등에 “샌드박스/테스트”로 구분하여 기록할지 여부를 BE 정책에 맞게 결정.
- preview/sandbox 전용 엔드포인트를 둘 경우, 해당 경로는 “임시 세션만” 처리한다는 것을 API 스펙에 명시할 것을 권장합니다.

---

## 4. 프롬프트 변수 가이드 — DB 저장 형식 일치

### 의사결정

- 프롬프트 편집기 우측의 **변수 가이드**가 **Aura 런타임에서 실제 치환되는 변수**와 일치하도록 유지합니다.

### Aura 답변 반영 (6.7, front.txt)

- **런타임 치환 변수**: Aura 엔진은 **{context}**, **{code}** 두 가지만 치환합니다.
  - **{context}**: 시스템 프롬프트 공통. context dict를 규칙에 따라 이어 붙인 **문자열**로 치환.
  - **{code}**: **code_review** 도메인에서만 사용.
- **{case_json}**, **{user_id}** 등 Aura 코드에 없는 이름은 **치환되지 않음**. 편집기 가이드에는 {context}, {code}만 런타임 치환 변수로 안내.
- **context dict 키** (Aura가 사용): activeApp, selectedItemIds, url, path, title, itemId, caseId, documentIds, entityIds, openItemIds, metadata. 케이스 정보는 **{context}**를 두고 context에 caseId(및 documentIds 등)를 넣어 전달.

---

## 5. 에이전트 등록·삭제 및 목록 규격

### 계약

- **등록**: `POST /api/synapse/agents` — Request: `agentKey`(필수, snake_case), `name`(필수), `domain`(app_codes AGENT_DOMAIN), `modelName`(app_codes LLM_MODEL), `temperature` 등. `domain`/`modelName`은 catalog의 key 값과 일치해야 함.
- **삭제**: `DELETE /api/synapse/agents/{id}` — Soft delete (is_active = false). 성공 시 FE는 React Query로 목록만 무효화·재조회하며, 삭제된 에이전트가 선택 중이었으면 첫 번째 에이전트로 자동 선택 이동.

### 목록 ID 정규화

- BE 목록/상세가 **agentId(Long)**만 반환할 수 있음. FE는 `id`를 `id ?? String(agentId)`로 정규화하여 사용.

### 삭제 가드레일 (선택)

- 기본 시스템 에이전트(예: 최초 Finance Aura)는 삭제 버튼 비활성화가 필요할 수 있음. BE가 목록/상세에 **isDeletable** 플래그를 내려주면 FE는 `isDeletable === false`일 때 휴지통 버튼을 비활성화하거나 숨김. 미제공 시 FE는 모든 에이전트에 삭제 버튼 노출.

---

## 6. 타 시스템 확인 사항 (FE → BE / Aura 질의·확인)

연동 전에 아래 항목을 BE·Aura 담당과 한 번씩 확인하는 것을 권장합니다.

### 백엔드(BE) 확인 사항

| 번호 | 확인 항목 | 비고 |
|------|-----------|------|
| 6.1 | **목록/상세 응답 식별자** — 목록·상세·생성 응답에서 에이전트 식별 필드명이 `id`인가요, `agentId`인가요? FE는 둘 다 처리하지만, 통일 시 파라미터/타입 정리 가능. | Path `{id}`는 숫자(agentId)로 보내도 되는지 |
| 6.2 | **PUT 수정 요청 필드명** — FE는 `engineKey`, `domainKey`, `systemPrompt`, `toolKeys`, `knowledgeIds`로 전송. BE 스펙이 `modelName`, `domain`, `systemInstruction`, `toolIds` 등 다른 이름이면 매핑 규격 확인 필요. | back.txt 기준 UpdateAgentRequest와 FE payload 매핑 |
| 6.3 | **도구·지식 ID 형식** — 도구 탭: FE는 카탈로그의 `key`(문자열) 목록을 `toolKeys`로 보냄. BE가 `toolIds`(Long 목록)만 받는다면 카탈로그에 `toolId` 포함 여부 및 매핑 방법 확인. 지식 탭: `knowledgeIds`가 RAG docId와 동일한지. | GET /agents/tools vs PUT toolIds |
| 6.4 | **삭제 후 목록** — DELETE 후 GET /agents 목록에서 해당 에이전트가 즉시 제외되는지(활성만 반환 시 제외 여부 확인). | Soft delete 반영 시점 |
| 6.5 | **isDeletable 제공 여부** — 목록 또는 상세에 `isDeletable`(또는 동일 목적 필드)를 내려줄 계획인지. 미제공 시 FE는 모든 에이전트에 삭제 버튼 노출. | 선택 사항 |
| 6.6 | **테스트 채팅 임시 세션** — `POST /api/aura/test/stream`에 `sandbox: true`, `temporary_session: true` 전달 시 대화를 DB에 영구 저장하지 않는지 최종 확인. | §3 계약 준수 |

### Aura 확인 사항 (✅ 6.7·6.8 답변 반영)

| 번호 | 확인 항목 | 비고 |
|------|-----------|------|
| 6.7 | **프롬프트 변수 가이드** — ✅ Aura 답변: 치환 변수는 **{context}**, **{code}** 뿐. FE 편집기 가이드는 해당 내용으로 반영함. (참고: front.txt) | §4 |
| 6.8 | **도구 key ↔ @tool 이름** — ✅ Aura 답변: 카탈로그 key = BE tool_name = Aura @tool 함수명 동일 필수. Finance/Synapse: get_case, search_documents, get_document, get_entity, get_open_items, get_lineage, web_search, simulate_action, propose_action, execute_action 등. (참고: front.txt, TOOL_NAMING_FOR_BACKEND.md) | §1 |

### 공통·크로스 체크

| 번호 | 확인 항목 | 비고 |
|------|-----------|------|
| 6.9 | **카탈로그 코드 키** — GET /api/synapse/agents/catalog의 `domains`, `models` 항목의 `key`가 app_codes(AGENT_DOMAIN, LLM_MODEL)의 code_key와 동일한지. 에이전트 생성·수정 시 해당 key를 그대로 전송. | domainKey, modelName |
| 6.10 | **HIERARCHICAL 청킹** — RAG 문서 타입 HIERARCHICAL 1건에 대해 BE/Aura 로그에서 조·항 구조가 기대대로 반영되는지 1회 이상 검증. | §2 |

---

## 문서 이력

- 최초 작성: 에이전트 스튜디오 실데이터 연동 및 배포 워크플로우 마감 시점 반영.
- Aura 답변 반영: 6.7 프롬프트 변수 가이드({context}, {code}), 6.8 도구 key ↔ @tool 목록. FE 편집기 가이드 및 기본 프롬프트 문구 동기화. (참고: front.txt)
