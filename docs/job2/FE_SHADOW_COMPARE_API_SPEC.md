# Shadow Compare API 권장 스펙 (P1)

> legacy vs agentic_shadow 비교 — BE 구현 시 참고

## Endpoint

```
GET /api/synapse/cases/{caseId}/shadow-compare?runId=...
```

- **Query**: `runId` (optional, 특정 run 비교. 없으면 latest)
- **목적**: analysis 응답에 섞지 않고 별도 제공해 FE 안정성 확보

## 비교 항목 (운영자 전용)

| 항목 | 설명 |
|------|------|
| verdict 일치 여부 | legacy vs agentic_shadow 최종 판정 비교 |
| score 차이 | 리스크/신뢰도 점수 차이 |
| citation 연결률 차이 | 근거 연결 비율 비교 |
| 보류 코드 차이 | POLICY_CONFLICT, RAG_ZERO 등 |

## agent_mode 배지

- **Legacy**: 기존 파이프라인
- **Shadow**: agentic 실험(비교용, 비영향)
- **Primary**: agentic 운영(실제 반영)
