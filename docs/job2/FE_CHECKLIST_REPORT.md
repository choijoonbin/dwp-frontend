# FE 체크리스트 회신

> 공통 회신 형식 기준

---

## 1. 신호 배지 의미/색상 정규화

| 항목 | 내용 |
|------|------|
| **반영 여부** | 완료 |
| **반영 커밋** | (최신) |
| **검증 로그** | POLICY_CONFLICT, POLICY_CONFLICT_DETECTED → "판단 근거 상충" 치환 완료 |
| **미해결 리스크** | - |

**매핑표 (현재)**

| 신호 | 라벨 | 색상 | 기준 |
|------|------|------|------|
| RAG_ZERO | RAG 0건 | error(빨강) | 위험 |
| EVIDENCE_MISSING | 근거 데이터 없음 | warning(주황) | 주의 |
| EVIDENCE_COVERAGE_LOW | 근거 부족 | warning(주황) | 주의 |
| SENTENCE_CITATION_MISSING | 문장 근거 미연결 | warning(주황) | 주의 |
| POLICY_CONFLICT | 판단 근거 상충 | info(파랑) | 정보 |
| POLICY_REEVAL_APPLIED | 정책 재검토 적용 | info(파랑) | 정보 |
| NEEDS_REVIEW | 추가 검토 | default(회색) | 재검토 |

**회신요청**: 매핑표 ✓ / 화면 캡처 1장 (추가 필요)

---

## 2. KPI 카드 계산 기준 명시

| 항목 | 내용 |
|------|------|
| **반영 여부** | 완료 |
| **반영 커밋** | (최신) |
| **검증 로그** | RAG KPI 10개 카드 + 워크벤치 trustKpis 4개 + 리스크 점수 분해 3개 Chip에 ! 아이콘 + 툴팁 적용 |
| **미해결 리스크** | - |

**필요 툴팁 문구 (요청용)**

| 카드 | 분자 | 분모 | 계산식 |
|------|------|------|--------|
| 문서 | - | - | GET /api/synapse/rag/documents → total |
| 인덱싱 완료 | status=COMPLETED 개수 | items.length | - |
| 주의 필요 | status in (PROCESSING, VECTORIZING, FAILED) 개수 | items.length | - |
| 청킹 합격률 | qualityGatePassed\|quality_report.pass=true 개수 | 품질 데이터 있는 문서 수 | passCount/total |
| RAG_ZERO 비율 | ragZeroCount | totalCount | ragZeroRatio (API) |
| EVIDENCE_COVERAGE_LOW 비율 | evidenceCoverageLowCount | totalCount | API |

---

## 3. 탭 정보구조 정리 반영

| 항목 | 내용 |
|------|------|
| **반영 여부** | 완료 |
| **반영 커밋** | edc20f5 |
| **검증 로그** | 탭명 변경 완료, regulationCheckpoints 우선 적용 |
| **미해결 리스크** | - |

**탭별 컴포넌트 맵**

| 탭 | 컴포넌트/내용 |
|----|---------------|
| 분석 단계 | AI 분석 신뢰도 지표(신뢰 신호+trustKpis), 리스크 점수 분해, 스트림 타임라인(reasoningProcess/aiThoughts) |
| 근거 맵 | evidenceLinks(행 buzei), WorkbenchItemDetailGrid(전표), sentenceCitationMap(문장별 근거), citations(C1,C2…) |
| 판단 규정 | logicCheckpoints/regulationCheckpoints 카드(version>chapter>article>clause, statusReason, evidenceRefs, qualitySignals) |
| 최종 판단 | finalReport (summary/verdict), requestClarification, closeCase |

---

## 4. 데이터 없음 상태문구 통일

| 항목 | 내용 |
|------|------|
| **반영 여부** | 완료 |
| **반영 커밋** | (최신) |
| **검증 로그** | RAG KPI·AI 분석 신뢰도·평가 품질·워크벤치 trustKpis·리스크 점수 분해에서 null → "데이터 없음" |
| **미해결 리스크** | - |

**빈 상태 UX 문구 리스트 (현재)**

| 위치 | 문구 |
|------|------|
| RAG 평가 게이트 (데이터 없음) | 평가 데이터 없음 |
| RAG 평가 게이트 (보조) | 아직 평가 실행 결과가 없습니다. |
| RAG 평가 품질 (데이터 없음) | 평가 데이터 없음 |
| RAG 평가 품질 (보조) | latest eval-run 기준 데이터가 없습니다. |
| 판단 규정 (빈 목록) | 판단 규정 정보가 없습니다. |
| 판단 규정 (보조) | 분석 결과를 생성한 뒤 확인할 수 있습니다. |
| 근거 맵 (빈 목록) | 발견된 위반 정황·RAG 문서가 없습니다. |
| RAG 청킹 합격률 등 (숫자 미수신) | "-" (toPercentText) |

---

## 요약

| # | 항목 | 반영 | 비고 |
|---|------|------|------|
| 1 | 신호 배지 정규화 | 완료 | "판단 근거 상충" 치환 |
| 2 | KPI 툴팁 | 완료 | ! 아이콘 + 분자/분모/계산식 툴팁 |
| 3 | 탭 정보구조 | 완료 | - |
| 4 | 데이터 없음 문구 | 완료 | null → "데이터 없음" 통일 |
