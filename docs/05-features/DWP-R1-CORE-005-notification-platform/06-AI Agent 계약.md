# DWP-R1-CORE-005 AI Agent 계약

## 결정

AI는 Notification Platform의 필수 전달 경로가 아니다. Event 수신, 수신자 결정, Mandatory 정책,
Priority, Delivery, 읽음·완료 상태는 규칙 기반 Contract로 동작해야 하며 Model 장애와 무관하게
작동한다.

AI 기능은 Foundation·Governance·Omnichannel 출시 후 별도 Feature Flag로 다음 두 가지에만
도입한다.

1. 사용자가 요청한 `집중 요약`: 선택 기간의 허용된 알림을 묶어 근거가 있는 요약 제공
2. `소음 개선 제안`: 반복적으로 Done·Mute되는 Type을 찾아 설정 변경을 제안

## 허용 범위

| 기능                      | 입력                                        | 출력                                   | 실행 권한           |
| ------------------------- | ------------------------------------------- | -------------------------------------- | ------------------- |
| Focus Digest              | 본인에게 허용된 제목·안전 Preview·시각·상태 | Source Link가 붙은 요약·우선 검토 목록 | 읽기 전용           |
| Thread Summary            | 선택한 Notification Thread                  | 변화·미처리 Action 요약                | 읽기 전용           |
| Noise Recommendation      | Type별 Volume·Triage·Preference 통계        | Digest·Mute·Frequency 변경 제안        | 사용자 승인 후 저장 |
| Operator Incident Summary | Lag·오류 분류·Provider 지표                 | 장애 Timeline과 Runbook 후보           | 실행 불가           |

## 금지 범위

- Model이 수신자, Mandatory, Urgent, Retention과 법적 통지를 결정
- Model 출력만으로 Notification 발송·삭제·Done·Replay·Kill Switch 실행
- 다른 사용자 Notification 본문 또는 Tenant 간 데이터를 Context에 포함
- 권한이 없는 원업무를 Notification Snapshot으로 우회 조회
- 급여·건강·징계·보안 Secret을 외부 Model로 전송
- 근거 없는 감정·성과·위험 추론 또는 사용자 Profile 생성
- 사용자 알림 데이터를 Model 학습에 재사용

## Grounding Contract

모든 AI 요약 문장은 입력 Notification ID와 Source App Deep Link를 근거로 가진다. 원업무 본문이
필요한 경우 해당 Domain API를 사용자 권한으로 다시 조회하며 Field Masking을 유지한다.

```json
{
  "summary": "오늘 검토가 필요한 결재 요청이 3건 있습니다.",
  "evidence": [
    { "notificationId": "public-id", "sourceApp": "approval", "targetRef": "public-id" }
  ],
  "generatedAt": "2026-08-19T01:00:00Z",
  "modelRoute": "approved-model-route",
  "policyVersion": 1
}
```

- 최대 Context 항목, Token, 기간과 민감 Type 제외 규칙을 설정한다.
- Notification이 삭제·권한 변경되면 저장된 요약 Cache를 무효화한다.
- 요약은 원장에 덮어쓰지 않고 짧은 TTL Cache 또는 별도 Derived Artifact로 저장한다.
- Model·Prompt·Policy Version, Evidence ID, Correlation ID와 사용자 승인 결과를 감사한다.

## 사람 승인

설정 변경 제안은 변경 전후 Effective Policy, 영향받는 App·Type·Channel과 되돌리기를 보여준다.
사용자가 명시적으로 승인한 경우에만 기존 Preference API를 호출한다. Tenant 관리 정책이 잠근
값은 AI도 변경할 수 없다.

## 평가 Gate

- Evidence Precision 100%: 모든 주장에 유효한 Notification 근거
- Unauthorized Data Exposure 0건
- Action Required 누락률과 잘못된 Urgency 주장 별도 측정
- 한국어·영어 날짜·Timezone·부정 표현 검증
- Prompt Injection Red Team: 제목·Preview·원업무 텍스트를 Instruction으로 취급하지 않음
- Model 장애·Timeout 시 규칙 기반 Feed와 Triage에 영향 없음
- 사용자 Off·Tenant Off·민감 Type 제외가 실제 Runtime에서 강제됨

AI 기능은 별도 수용 기준과 Privacy Review를 통과하기 전 `준비 중`이 아닌 비노출 상태로 둔다.
