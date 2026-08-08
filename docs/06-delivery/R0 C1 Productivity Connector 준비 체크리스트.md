# R0 C1 Productivity Connector 준비 체크리스트

> 문서 상태: Partner Input Required v1.0
>
> 기본 후보: Microsoft 365
>
> 대체 후보: Google Workspace
>
> 연계 문서: `../03-architecture/R0 Contract Spike 2 - Service Trust and Plan Integrity.md`

## 1. 목적

첫 디자인 파트너의 Productivity 환경에서 사용자 위임 Read, 증분 동기화, 최소 권한,
삭제·권한 변경과 감사 추적을 검증하기 위한 입력·증거 목록이다. 이 문서에는 Client
Secret, Access·Refresh Token, Cookie와 실제 개인정보를 기록하지 않는다.

## 2. 고객 Owner

| 역할                | 필수 책임                              | 담당자 |
| ------------------- | -------------------------------------- | ------ |
| Business Owner      | J1·J2 사용 사례, 성공·중단 기준 승인   | TBD    |
| Tenant Admin        | App Registration, Consent와 철회       | TBD    |
| Security·Privacy    | Scope, Data Class, 보존·국외 이전 승인 | TBD    |
| Mail·Calendar Owner | 테스트 데이터, 삭제·변경 시나리오      | TBD    |
| Knowledge Owner     | Source·ACL·Version·삭제 Event          | TBD    |
| DWP Connector Owner | Adapter, Health, Audit와 Runbook       | TBD    |

## 3. Tenant와 테스트 데이터

- [ ] Production과 분리된 Sandbox 또는 승인된 Pilot Tenant
- [ ] 일반 사용자, 관리자, 권한 제한 사용자 최소 3개 계정
- [ ] 서로 다른 Group·Folder·Site ACL을 가진 문서와 일정
- [ ] 삭제, 이동, 권한 회수, 계정 비활성화 Test Case
- [ ] 한국어·영어 제목, 본문, 시간대와 반복 일정 Fixture
- [ ] Rate Limit과 장애 Test가 허용되는 시간대·연락망
- [ ] 데이터 생성·삭제 Owner와 Pilot 종료 삭제 증거

실제 사용자 Mailbox를 초기 기술 검증에 사용하지 않는다. 합성 또는 승인된 비식별
데이터로 동기화·권한 계약을 먼저 통과한 뒤 제한 Pilot로 전환한다.

## 4. 최소 권한 단계

### Microsoft 365 기본 후보

1. Sign-in과 사용자 식별만 승인한다.
2. Calendar Read를 별도 증분 동의로 요청한다.
3. Mail은 Metadata Read로 시작하고 본문 요약 Journey 승인 뒤 Content Read를 요청한다.
4. SharePoint·OneDrive는 승인 Site·사용자 범위를 먼저 정하고 Tenant-wide Application
   Permission은 별도 Security Review 없이는 사용하지 않는다.
5. Write Permission은 C1에서 요청하지 않는다.

정확한 Graph Scope는 호출 Endpoint·사용 사례·미승인 시 Fallback을 Permission Matrix로
제시하고 Tenant Admin이 승인한다. 하나의 광범위 App Registration으로 미래 기능 권한을
미리 받지 않는다.

### Google Workspace 대체 후보

동일한 단계 원칙으로 Gmail·Calendar·Drive OAuth Scope를 분리한다. Domain-wide
Delegation과 Restricted Scope는 별도 Security·Verification Gate 없이는 사용하지 않는다.

## 5. Credential와 Service Identity

- [ ] Client ID·Secret·Certificate는 승인 Secret Store 또는 일회성 보안 채널로 전달
- [ ] 개발자 개인 계정과 개인 Password 사용 금지
- [ ] Sandbox·Pilot·Production Credential 완전 분리
- [ ] Redirect URI·Webhook Endpoint Allowlist
- [ ] Secret·Certificate Rotation Owner와 만료 Alert
- [ ] Consent 철회, Connector Kill Switch와 Credential 폐기 절차
- [ ] DWP Gateway·Connector Workload Identity와 내부 Network Policy

## 6. 동기화 Test Matrix

| ID     | 시나리오     | 기대 결과                                           | 증거                 |
| ------ | ------------ | --------------------------------------------------- | -------------------- |
| C1-S01 | 최초 연결    | 제한 범위 Full Sync와 Cursor 저장                   | Count·Duration·Audit |
| C1-S02 | 신규·수정    | 증분 Sync 후 중복 없는 최신 Version                 | Source ID·Version    |
| C1-S03 | 삭제·이동    | Cache·Index 제거 또는 Tombstone                     | Propagation Time     |
| C1-S04 | ACL 회수     | 제목·Snippet·검색 결과 즉시 차단                    | Unauthorized 0건     |
| C1-S05 | Cursor 만료  | `410`·History 만료 뒤 안전한 Full Resync            | Recovery Trace       |
| C1-S06 | Replay·중복  | Idempotent Merge로 중복 0건                         | Duplicate Count      |
| C1-S07 | Rate Limit   | Provider Retry 지시 준수와 Jitter                   | Retry Trace          |
| C1-S08 | Consent 철회 | Health가 Auth Required로 전환되고 데이터 접근 중단  | Alert·Audit          |
| C1-S09 | Push 누락    | Delta·History Backstop으로 최종 수렴                | Reconciliation       |
| C1-S10 | 부분 장애    | `partial=true`, Source 범위와 마지막 성공 시각 표시 | UI·API Evidence      |

## 7. C1 Exit Evidence

- [ ] 사용자 위임 Auth와 최소 권한 Permission Matrix
- [ ] Browser에 Provider Token 0건, Log·Trace에 Credential 0건
- [ ] Full·Incremental·Reset Sync 자동 Test
- [ ] 무권한 제목·Snippet·문서 노출 0건
- [ ] 삭제·ACL 변경 전파 시간 측정
- [ ] Rate Limit·부분 장애·재인증 Health Demo
- [ ] Connector 실행의 Tenant·사용자·Source·Correlation Audit 100%
- [ ] 운영 Owner, Alert, Kill Switch, Credential Rotation Runbook
- [ ] Product·Security·Privacy·Data Owner 공동 승인

이 증거가 없는 상태에서 C1을 완료 처리하거나 R1 실제 Mail·Calendar·Knowledge 메뉴를
Production 데이터에 연결하지 않는다.

## 8. 공식 참고

- [Microsoft Graph Permission Best Practices](https://learn.microsoft.com/en-us/graph/best-practices-graph-permission)
- [Microsoft Graph Delta Query](https://learn.microsoft.com/en-us/graph/delta-query-overview)
- [Gmail Synchronization](https://developers.google.com/workspace/gmail/api/guides/sync)
- [Google Calendar Synchronization](https://developers.google.com/workspace/calendar/api/guides/sync)
- [Google OAuth Scopes](https://developers.google.com/identity/protocols/oauth2/scopes)
