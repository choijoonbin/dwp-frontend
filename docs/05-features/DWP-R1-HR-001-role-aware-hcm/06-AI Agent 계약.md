# 06. AI Agent 계약

## 기본 원칙

AI는 HR 정보를 설명하고 사용자가 업무를 준비하도록 돕지만 권한을 확대하거나 인사 결정을
대신하지 않는다. Model Context에는 Backend가 이미 Field Masking과 Target Population을
적용한 최소 데이터만 전달한다.

## 허용

- 본인 근태·휴가·복리후생·급여 문서 상태·학습 일정 요약
- 정책 문서 Citation과 함께 휴가·복리후생 절차 안내
- 사용자가 확인할 근태 예외와 제출 전 체크리스트 제안
- Manager에게 허용된 팀 Queue의 우선순위 설명
- HR 운영자에게 허용된 Domain Metric의 이상 징후와 조사 경로 제안

## 사용자 확인 후 허용

- 근태 Entry Draft 작성
- 휴가 신청 Draft 작성
- 목표 진척 Draft 작성
- 반려 사유 문안 초안

실제 제출은 대상·기간·영향을 보여준 뒤 사용자의 명시적 확인과 일반 API 권한 검사를 다시
거친다.

## 금지

- 급여·성과·건강·징계 정보를 권한 밖에서 추론 또는 결합
- Manager·HR 담당자 대신 승인·반려 결정
- 고객 Payroll·Benefits·HRIS에 직접 Write-back
- Reference Data를 고객 실제 데이터라고 표현
- 성별·연령·장애·노조 등 민감 특성을 근거로 고용 의사결정 추천
- 감사·Correlation ID 없이 상태 변경

## 증거

Agent 응답은 근거 API, 기준 시각, Tenant Scope, Field Masking 수준을 보존한다. 고위험
명령은 Prompt·Tool Input·결과·사용자 확인·최종 API Correlation ID를 감사한다.
