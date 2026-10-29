# DWP-R1-MAIL-001 Enterprise Mail

- 상태: Production-readiness implementation complete; external provider certification is environment-gated
- 사용자 진입점: `/mail/home`
- 관리자 진입점: `/mail/admin/overview`
- 리소스: `APP.MAIL`, `ADMIN.MAIL`

## 홈·주소록·실행 제안 고도화

[화면 수용안, 주소록·그룹 발송 계약, 실행 확장 경계 및 잔여 Gate](02-home-and-action-experience.md)에 통합 관리합니다. 참고 화면의 구성은 DWP 공통 셸과 디자인 시스템에 적용하며 외부 실행·발송이 준비되지 않은 기능을 완료 상태로 표시하지 않습니다.

## 제공 범위

- 메일 홈: 읽지 않음, 긴급, 회신 필요, 집중 큐, 실행 제안, 공유함 흐름
- Split Inbox: 우선, 회신 필요, 담당, 업데이트 분류와 서버 검색
- 메일 처리: 읽음, 중요 표시, Snooze, 보관, 회신, 신규 작성
- 발송 신뢰성: 영속 Delivery Outbox, lease worker, 지수 재시도, 실패 재처리, 멱등 응답
- 공급자 결과 증거: Sandbox 전달 완료, 외부 공급자 접수, 결과 불명·조정 필요 상태를 분리하고 결과 불명 자동 재전송 차단
- 동기화 신뢰성: 영속 Sync Job, lease 회수, cursor generation fencing, reset 복구, 구독 갱신·검증된 webhook
- 실시간 경험: 권한 lease로 제한된 SSE와 cursor catch-up, heartbeat, 오프라인·숨김 탭 중지, polling fallback
- 검색·규칙: 권한 범위의 본문 FTS, BCC 색인 제외, 메시지 materialization과 원자적으로 생성되는 수신 규칙 작업
- 첨부 보안: 신뢰 scanner 준비 상태, 크기 제한, redirect 차단, 검사 성공 전 다운로드·본문 노출 차단
- 임시 보관함: 서버 저장, 이어 쓰기, 재저장, 발송 전환
- 대화형 본문: 외부 발신자 경고, 첨부 메타데이터, 분류 등급, 받은·보낸 메일 다중 소속
- 팀 협업: 공유함 구성원 경계, 담당자, 내부 댓글, 응답 목표
- 키보드 경험: `Cmd/Ctrl+K`, `/`, `C`, `E`와 명령 팔레트
- 관리자: 연결 상태, Provider 설정, 공유함 SLA, 보안·AI 정책
- 공급사 계약: Microsoft Graph, Gmail, NAVER WORKS, JMAP, IMAP/SMTP와 배포 상태 분리
- AI 확장: 회신, 일정, 휴가, 업무, 긴급 알림의 근거 기반·사람 승인형 제안
- 다국어·반응형: 한국어·영어, Desktop 2열, Mobile 단계형 탐색
- 복구 UX: 계정 없음·재인증 필요·일시 중지·동기화 지연을 구분하고 가능한 다음 동작만 노출
- 대량 처리: 사용자 intent 1개와 항목별 멱등 키·최초 version을 고정해 부분 실패와 응답 유실을 정확 재생

## SKAX Seed

- SKAX 활성 구성원 21명의 개인 DWP Sandbox 메일 계정
- 구성원별 받은 메일 6건, 보낸 메일 1건, 수정 가능한 초안 1건
- 구성원별 회신·일정·휴가·업무·긴급 알림 실행 제안 5건, 총 105건
- 개인·공유 메일을 합쳐 대화·메시지 각 172건
- People Help와 Digital Workplace Help 공유 메일함 2개
- 실제 공유함 구성원에게만 배정된 팀 문의 4건과 내부 협업 댓글 4건
- Microsoft 365, Google Workspace, NAVER WORKS, JMAP, IMAP/SMTP 연결 준비 상태
- 프론트 Mock 배열 없이 Platform DB API로만 조회

## 권한 및 안전 경계

1. 일반 구성원은 본인 계정과 자신이 속한 공유함만 조회한다.
2. `MAIL_ADMIN`만 연결과 테넌트 정책을 변경한다.
3. Tenant Admin은 별도 위임 없이 메일 설정을 변경할 수 없다.
4. 관리 API는 개인 메일 제목과 본문을 반환하지 않는다.
5. 공급사 자격증명은 승인된 Secret Store URI만 저장한다.
6. 모든 변경은 낙관적 version, Audit, Transactional Outbox를 사용한다.
7. AI 제안 수락은 대상 앱 권한을 재검증하며 자동 실행은 DB와 Agent 계약에서 차단한다.
8. Agent와 Platform의 독립 액션 카탈로그가 대상 리소스·권한·경로·최소 위험도를 이중 검증한다.
9. AI 액션은 버전 1 계약과 액션별 필수 payload를 사용하며, 미지원 버전·불완전 payload·만료된 제안은 거부한다.
10. 계약만 등록된 외부 공급자는 Runtime Adapter가 배포되기 전 활성화할 수 없다.
11. 동일 idempotency key의 신규 작성·회신·초안 발송 재요청은 기존 결과를 반환한다.
12. 대량 변경은 같은 항목 키에 다른 payload나 version을 결합하면 충돌로 거부하고, 같은 fingerprint의 성공 receipt는 변경을 중복 실행하지 않고 재사용한다.
13. 공급자 삭제는 법적 보존을 다시 검증하고 로컬 삭제와 별도 영수증을 남긴다. 미지원·불명 결과는 완료가 아니다.
14. 실시간 스트림은 서버와 브라우저 모두 권한 재검증 시각을 넘겨 이벤트를 전달하지 않는다.

## 검증 시나리오

1. 일반 구성원이 메일 홈과 본인 메일 8건을 조회한다.
2. 읽음·중요·Snooze·보관 변경이 version 증가와 감사 이벤트를 만든다.
3. 새 메일과 회신 재시도가 같은 idempotency key로 중복 메시지를 만들지 않는다.
4. 초안을 수정·재저장한 뒤 발송하면 Drafts에서 Sent로 이동한다.
5. 동일 대화의 회신은 원 스레드에 추가되고 Inbox와 Sent 양쪽에서 조회된다.
6. 공유함 비구성원은 상세·댓글·담당 변경이 거부된다.
7. 공유함 담당자로 비구성원을 지정하면 서버가 거부한다.
8. 외부 연결은 Secret Reference와 배포된 Runtime Adapter 없이 활성화되지 않는다.
9. `MAIL_ADMIN`이 아닌 사용자의 연결·정책 변경은 403이다.
10. 일정 권한이 없는 사용자는 일정 제안을 수락할 수 없다.
11. Desktop과 Mobile에서 목록·상세·Dialog의 중첩 및 가로 overflow가 없다.

## 데이터베이스 이력

- Platform `V120`: 메일 도메인, 협업, 실행 제안, Outbox, Audit
- Platform `V121`: SKAX 계정·폴더·대화·메시지·공유함·제안 Seed
- Platform `V122`: 기존 메일·일정 런처를 네이티브 메일 앱으로 전환
- Platform `V124`: SKAX 활성 구성원 21명 전체 계정·메일·5종 AI 제안 보강
- Platform `V125`: 공유함 대화·담당자·내부 협업 댓글 완성
- Platform `V128`: AI 액션 계약 버전 고정과 기존 제안 호환 보강
- Platform `V140`: 근거·확인·권한·경로·만료 DB 불변식과 롤링 계약 버전 보강
- Platform `V141`: lease 기반 발송 Outbox, 상태·재시도·Provider receipt 불변식
- Platform `V142`: 대화별 다중 폴더 멤버십과 Inbox·Sent 동시 조회
- Platform `V203`~`V313`: 개인 메일 조직, 발송 fingerprint, 사용자·관리자 워크스페이스, 제안 handoff, writing asset, 보존·법적 보존·purge 및 이벤트 식별자 계약
- Platform `V341`: 영속 수신 규칙 작업과 권한 범위 본문 Full-Text Search
- Platform `V370`: 영속 동기화·cursor fencing, 구독·webhook, SSE, 첨부 검사·운영 지표
- Platform `V371`: `PROVIDER_ACCEPTED`/`DELIVERED`/`RESULT_UNKNOWN` 분리와 공급자 purge 영수증
- Platform `V372`: AI 제안 provenance와 항목별 bulk mutation 멱등 receipt
- Notification `V38`: `MAIL.ACTION_ESCALATED` 소유자 계약과 내용 최소화 알림 템플릿
- Auth `V60`: `APP.MAIL`, `ADMIN.MAIL`, `MAIL_ADMIN`, SKAX 위임 그룹

## 외부 준비가 필요한 범위

실제 Microsoft Graph와 Gmail, 이후 NAVER WORKS 또는 회사 메일 송수신은 고객 OAuth App,
관리자 동의, callback·webhook URL, Secret Broker와 도메인 검증이 준비된 뒤 각
`MailConnectorPort` 어댑터를 활성화한다. 로컬은 동일한 도메인 계약을 사용하는 DWP
Sandbox로 기능을 검증한다.
SSE와 catch-up은 중앙 product-authorization bundle에
`route.mail.work.events.data`, `route.mail.work.events-catch-up.data`가 배포되기 전까지
fail-closed 상태를 유지한다.
관리 화면은 계약 지원 여부와 실제 Runtime Adapter 배포 여부를 별도로 표시하며, 준비되지 않은
연결을 정상 또는 활성 상태로 가장하지 않는다.

완료 기준과 상태 전이, 공급자 인증 항목, 운영 지표 및 검증 매트릭스는
[Production-readiness architecture](03-production-readiness-architecture.md)를 단일 근거로 사용한다.
