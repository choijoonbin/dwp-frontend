# Stitch 19·20 수정본 최종 디자인 Gate

- 검토일: 2026-09-16
- 수정본: `/Users/a10697/Downloads/19,20.zip`
- SHA-256: `8d78880807dcf61f13b09302fa48d523c961d633e16b38851a1094b5516d95e6`
- 선행 기준: [14–23 수정 최종본 재수용 판정](./11-Stitch-14-23-최종본-재수용-판정.md),
  [디자인 AI 프롬프트·구현 아키텍처](./09-글로벌-고도화-디자인-AI-프롬프트-아키텍처.md)

## 1. 최종 판정

19번과 20번 수정본은 이전 검토에서 남았던 구조적 누락을 채웠다. 따라서 **Stitch 14–23 전체를
추가 디자인 AI 재작업 없이 개발 입력물로 수용한다.** 이번 판정으로 디자인 Gate는 통과한다.

이 판정은 정적 HTML과 샘플 데이터를 운영 코드로 복사한다는 뜻이 아니다. 화면의 모든 사용자
기능은 구현 범위에 포함하되, Canonical API, 권한, 실패·복구, 감사, 개인정보, Provider Runtime
Truth를 충족해야 기능 완료로 인정한다. 디자인 수용과 제품 개발 완료는 별도의 Gate다.

| 번호  | 범위                                        | 최종 판정   | 개발 조건                                           |
| ----- | ------------------------------------------- | ----------- | --------------------------------------------------- |
| 14–18 | 탐색·예약·통합 예약·방문·서비스             | 수용        | 11번 판정서의 정규화 조건 적용                      |
| 19a   | 실내 길찾기                                 | 수용        | Published Graph·접근성·Fallback 계약 적용           |
| 19b   | Device Operations·Room Display·Status Board | 조건부 수용 | 등록·명령·Safety·Provider 상태를 아래 계약으로 보완 |
| 20    | 발령 Preview·활성 관제·종료·사후보고        | 조건부 수용 | Audience·종료 승인·전송 실패를 아래 계약으로 보완   |
| 21–23 | 데이터 연계·시나리오·예약 도우미            | 수용        | 11번 판정서의 신규 API·정규화 조건 적용             |

## 2. 19b 수용 범위

다음 산출물을 확인했다.

- 데스크톱 Device Operations: Registry, 상태 KPI, 운영 Table, Inspector, 원격 작업, Audit Timeline
- 모바일 운영: Healthy, Stale, Offline 목록과 조치 진입점
- Room Display: 현재·다음 일정, 가용성, Walk-up, Check-in, 연장, 조기 종료, Privacy masking
- Status Board: 층·공간별 가용 현황
- 장치 Identity, Site·Floor·Resource Binding, Hardware·OS, App·Policy Version, Heartbeat,
  Schedule Freshness, 최근 오류

19b는 시각·정보 구조가 충분해 추가 디자인 AI 요청 없이 개발한다. 다음 항목은 출시 차단 조건이다.

1. 장치 등록 → 승인 → Site·Floor·Resource Binding Wizard를 구현한다.
2. Permission denied와 RBAC를 제공하고, 위험 명령은 영향 Preview → 사유 → 명시적 확인 → 진행 →
   성공·실패·결과 불명 → 재조회·복구 → Receipt 수명주기를 따른다.
3. 명령에는 Idempotency Key, Command·Correlation ID, Actor, 감사 증거를 기록한다.
4. Safety Takeover는 발령 내용, 방향, 기준 시각, 발령 주체, Offline Fallback, 해제와 정상 복귀를
   실제 장치 Frame으로 구현한다.
5. Room Panel과 Floor Status Board는 장치별 Surface로 분리하고, Status Board에는 방향과
   `As of/Freshness`를 표시한다.
6. MDM, Graph, BLE, NFC, Speed Gate, Sensor, mTLS, TPM은 검증된 Adapter 증거가 있을 때만
   정상 상태로 표시한다. 그 전에는 `NOT_CONFIGURED` 또는 `CONFIGURED_UNVERIFIED`를 사용한다.
7. QR은 서버가 발급한 짧은 만료 값만 사용한다. Secret, PIN, 재사용 Token은 노출하지 않는다.

샘플의 `활성 100% 정상 수신`과 Stale·Offline 수치의 모순, 잘못된 요일, 모바일 활성 메뉴명은
Canonical 데이터와 제품 Route 기준으로 교정한다. 고정 날짜와 브라우저 로컬 시각을 섞지 않는다.

## 3. 20 수용 범위

다음 Incident 수명주기 화면을 확인했다.

- 발령 전 데스크톱·모바일 Preview
- Incident 유형, Site·Floor·Zone, 메시지, 대상 Source, 제외 대상, 채널, 집결지, 권한
- 범위 변경 영향과 신규·기존 Zone 메시지
- 채널 재전송, PII 마스킹 양방향 메시지
- 모바일 Offline Queue, 재시도, 대체 연락
- 종결 결과, 사후보고서, Audit Timeline
- 목적·사유·서명이 있는 PDF Export

20번도 추가 디자인 AI 요청 없이 개발한다. 다음 항목은 출시 차단 조건이다.

1. 종료 전 Dialog에 종료 사유, 승인자, 잔여 SOS·미응답 영향, 후속 조치, 최종 승인을 포함한다.
2. 재실자, 예약자, 방문자, 예정 방문자를 단순 합산하지 않는다. `AudienceSnapshot`이 중복 제거,
   제외, 불명 상태와 최종 대상 수를 계산한다.
3. Source별 Coverage, Freshness, `As of`와 가용 상태를 표시한다.
4. 전달 상태에 Offline Queue뿐 아니라 `DELIVERY_FAILED`, `RESULT_UNKNOWN`, 재조회와 복구를
   포함한다.
5. PDF와 CSV Export 모두 역할, 목적, 사유, Step-up, 감사 기록을 요구한다.
6. 119, EBS, BLE Mesh, WORM, 정부 로그는 검증된 Provider가 있을 때만 연결·정상으로 표시한다.
7. 화면마다 달라진 Incident ID, 날짜, 온도, 대상 수는 하나의 Canonical API 값으로 통일한다.

구현 모델은 최소한 `Incident`, `AudienceSnapshot`, `ActivationPreview`, `ScopeRevision`,
`DispatchBatch`, `DispatchAttempt`, `DispatchReceipt`, `SafetyResponse`, `IncidentMessage`,
`ClosurePreview`, `ClosureRequest`, `ClosureApproval`, `PostIncidentReport`, `GuardedExport`,
`AuditEvent`, `ConnectorRuntimeTruth`를 포함한다. 모든 쓰기 명령은 Version, Idempotency Key,
Step-up 권한, 진행·결과 불명·재조회 계약을 가진다.

## 4. 개발 수용 원칙

- Stitch PNG는 Layout과 시각 의도의 기준이며 HTML은 상태·문구 참고 자료다.
- Stitch의 Fixture, Alert, Timeout, 임의 상태 변경 JavaScript는 운영 코드로 재사용하지 않는다.
- 화면에 표현된 조작 기능은 클릭 가능한 장식으로 남기지 않고 실제 API·권한·감사 흐름과 연결한다.
- 외부 Provider가 없거나 검증되지 않은 기능은 숨기거나 Unconfigured·Unverified 상태로 제공한다.
- 1440px, 1280px, 390px, 320px, 200% Zoom과 키보드, 고대비, 긴 한·영문, 부분 API 실패를
  대표 여정 기준으로 검증한다.
- 메뉴가 표시되거나 API를 한 번 호출하는 것만으로 완료 처리하지 않는다. 주요 성공·실패·복구
  여정과 감사 증거가 함께 동작해야 한다.

## 5. 결론과 다음 Gate

19·20 수정본을 포함해 14–23 디자인 입력은 모두 확보됐다. 디자인 AI에 다시 전달할 필수 수정
프롬프트는 없다. 개발은 09번 아키텍처와 본 판정의 조건을 기준으로 계속 진행한다.

제품 완료 판정은 다음 증거가 모두 확보된 뒤 수행한다.

1. 대표 사용자·관리자·장치 여정의 실제 API 연동
2. 권한, Step-up, Idempotency, 감사와 결과 불명 복구
3. Provider별 연결·검증 증거와 거짓 정상 상태 방지
4. 반응형·접근성·부분 실패 Playwright 증거
5. 디자인 화면에 제시된 모든 기능의 메뉴·Route·상태 도달 가능성
