# Backend Spec Alignment (back.txt)

**기준 문서**: back.txt (Level 4 최종 API 규격서)  
**반영일**: 2026-02-11

---

## 1. GET /api/synapse/cases/{id} — Single Source of Truth (케이스 상세 통합 API)

**한 번의 호출로 전표 라인·조치 이력·AI 추론을 모두 반환.**

| BE 필드 | 출처 | FE 반영 |
|---------|------|--------|
| **fiDocItems** / **fi_doc_items** | 전표 상세 (fi_doc_item) | `dto.fiDocItems ?? dto.fi_doc_items` → fiDocItems. buzei, hkont, **wrbtr**(숫자/BigDecimal), sgtxt 매핑 |
| **actionHistory** | agent_case_action_history | `CaseActionHistoryItemRefDto`: id, actionType, actorId, commentText, **actionAt**, createdAt (JSON camelCase, ISO8601) |
| **aiThoughts** | agent_activity_log (Aura 연동) | `AiThoughtItemDto`: **stage**, **eventType**, **message**, **occurredAt** (JSON camelCase, ISO8601). FE는 message→content, occurredAt→timestamp, eventType/stage→type |
| **keys** (bukrs, belnr, gjahr, buzei) | 케이스 키 | targetBuzei = dto.keys?.buzei |
| **links** (openItems, lineage) | 링크 | CaseDetailDto.links |

- wrbtr: BE BigDecimal → JSON 숫자. mapRawLineItemToFiDoc에서 그대로 number 사용.
- 워크벤치: **개별 history API 호출 없이** useCaseDetail 한 번만 사용.

---

## 2. GET /api/synapse/workbench/cases/{caseId}/history} (레거시/별도 호출 시) (back.txt B.3, 4.3)

| BE | FE 반영 |
|----|--------|
| **Endpoint** | `getWorkbenchCaseHistory(caseId)` — `GET /api/synapse/workbench/cases/{caseId}/history` |
| **Response** | `ApiResponse<List<CaseActionHistoryItemDto>>` (data[]), action_at DESC |
| **CaseActionHistoryItemDto** | id, caseId, actionType, **actorId**, **commentText**, **actionAt** (ISO8601), metadataJson, createdAt |
| **워크벤치 타임라인** | `useWorkbenchCaseHistoryQuery` 사용. audit-events 대신 **history** API만 사용. actorName = actorId, comment = commentText, actionAt = actionAt |

---

## 3. WebSocket /ws/notifications (back.txt 4.3)

| BE NotificationDto | FE 반영 |
|-------------------|--------|
| **content** (메시지 본문) | `message = payload.content ?? payload.message ?? payload.body` |
| **type** | 기존대로 `normalizeCategory(payload.category ?? payload.type)` → 아이콘·색상 매칭 |
| id, tenantId, title, channel, occurredAt, createdAt, readAt, payload | IncomingNotificationPayload 타입에 필드 명시, 필요 시 payload에서 link 등 확장 가능 |

---

## 4. FE → Backend (back.txt 4.4)

| Endpoint | 비고 |
|----------|------|
| POST `/api/synapse/actions/{actionId}/approve` | body `{ comment?: string }` — 기존 구현 유지 |
| POST `/api/synapse/actions/{actionId}/reject` | body `{ comment?: string }` — 기존 구현 유지 |
| POST `/api/synapse/cases/{caseId}/analysis-runs` | mode, requestedBy, (optional) evidenceSnapshot — 기존 구현 유지 |

---

## 5. 참고: GET /api/synapse/documents/detail

백엔드 4.3: `GET /api/synapse/documents/detail` (bukrs, belnr, gjahr) → header(1), **items**(배열), derived, reversalChain 등.  
문서 상세 전용 API이며, 케이스 상세의 fi_doc_items는 **GET /api/synapse/cases/{id}** 루트 **fi_doc_items**로 정렬 완료.

---

## 6. RAG 문서 등록 (back.txt — Multipart / Register)

| 구분 | BE 스펙 | FE 반영 |
|------|---------|--------|
| **로컬 파일 업로드** | `POST /api/synapse/rag/documents` · `multipart/form-data` | `registerRagDocumentMultipart(formData)` |
| form 필드 | **file** (필수), **title** (선택), **docType** (선택, 기본 GENERAL) | FormData에 `file`, `title`, `docType`만 append. **metadata part 미사용** |
| **URL/S3 메타만 등록** | `POST /api/synapse/rag/documents/register` · `application/json` | `registerRagDocument(body)` |
| JSON body | `RegisterRagDocumentRequest` (title, sourceType, s3Key?, url?, docType? 등) | 동일 타입 사용 |
| docType 값 | REGULATION \| MANUAL \| POLICY \| GENERAL | 모달 docType 셀렉트 + form/body에 반영 |

- Content-Type: multipart 시 FE에서 헤더 생략 → 브라우저가 boundary 자동 설정.
- X-Tenant-ID 헤더 필수 (axios-instance 공통).
