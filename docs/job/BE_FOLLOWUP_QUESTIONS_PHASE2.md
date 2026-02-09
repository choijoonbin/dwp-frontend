# BE Phase2 FE 연동 — Q&A 종합

> **대상**: FE 팀 참고 / 백엔드 가이드  
> **작성일**: 2026-02-09  
> **상태**: 9.1~9.5 답변 완료. 10.1~10.2 추가 답변 완료. ✅ **모든 질문 답변 완료**

---

## 1. BE 스트림 이벤트 형식 — data 필드 스키마 (10.1) ✅

**질문**: `started`, `completed`, `failed` 각각의 `data` 필드 JSON 스키마?

**답변** (back.txt 10.1):

| event | data 스키마 | 비고 |
|-------|-------------|------|
| **started** | `{}` | 빈 객체. runId는 path에 있음 |
| **completed** | `{}` | 빈 객체 |
| **failed** | `"<errorMessage>"` 또는 `{}` | error_message가 있으면 **raw string** (JSON 아님), 없으면 `{}` |

**FE 권장 처리**
- `started`/`completed`: `data`를 JSON으로 파싱 → `{}` 또는 확장 필드 대응
- `failed`: `data`가 JSON 객체인지 **문자열인지 분기**. 문자열이면 `message`로 사용
- **진행률/단계**: 현재 BE 스트림은 `percent`, `step` 미제공. 단순 3단계(started → completed/failed)만 지원. 상세 진행률은 Aura 스트림 사용 시 가능

**향후 확장 예시** (BE 스펙 확장 시)
```json
// started
{ "status": "started", "runId": "<uuid>" }

// completed
{ "status": "completed", "runId": "<uuid>" }

// failed
{ "status": "failed", "runId": "<uuid>", "message": "<errorMessage>" }
```

---

## 2. DEMO_OFF 시 BE 처리 방식 (10.2) ✅

**질문**: Aura가 `{"status":"disabled"}` 반환 시 BE 처리 방식?

**답변** (back.txt 10.2):

| 항목 | 현재 동작 |
|------|-----------|
| run 상태 | `STARTED` 유지 (FAILED로 변경 안 함) |
| 스트림 | `started`만 수신, `completed`/`failed` 미수신, **약 60초 후 연결 종료** |
| FE 사용자 메시지 | 별도 권장 문구 없음 |

**FE 현재 대응**
- 스트림이 `completed`/`failed` 없이 종료되면: `"분석이 완료되지 않았습니다. 잠시 후 다시 시도해 주세요."` 또는 `"분석 서비스를 사용할 수 없습니다. (데모 모드)"` 등으로 표시
- `GET /api/synapse/analysis-runs/{runId}`로 `status`가 `STARTED`로 남아 있으면: 타임아웃/비활성 상태로 간주

**BE 개선 권장** (향후)
- Aura `status=="disabled"` 응답 시: run을 `FAILED`로 변경, `failed` 이벤트 발송

---

## 3. 기존 답변 요약 (9.1~9.5)

| # | 항목 | 답변 요약 |
|---|------|-----------|
| 9.1 | action-proposals vs relatedActions | 별도 개념. Phase2 탭 → action-proposals, relatedActionsCount → 기존 유지 |
| 9.2 | proposalId vs actionId | 직접 매핑 없음. Phase2는 proposalId, 기존 Agent는 actionId |
| 9.3 | action-proposals 응답 스키마 | proposalId, runId, type, status, riskLevel, rationale, payload, createdAt |
| 9.4 | DEMO 모드 스트림 | 운영과 동일 형식. started → completed 순서 |
| 9.5 | analysis 결과와 runId | 최신 COMPLETED run 기준. runId 파라미터 미지원 |

---

*작성: FE 팀 | 참조: back.txt*
