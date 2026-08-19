# DWP-R1-MAIL-001 Enterprise Mail

- 상태: Implemented with governed sandbox delivery
- 사용자 진입점: `/mail/home`
- 관리자 진입점: `/mail/admin/overview`
- 리소스: `APP.MAIL`, `ADMIN.MAIL`

## 제공 범위

- 메일 홈: 읽지 않음, 긴급, 회신 필요, 집중 큐, 실행 제안, 공유함 흐름
- Split Inbox: 우선, 회신 필요, 담당, 업데이트 분류와 서버 검색
- 메일 처리: 읽음, 중요 표시, Snooze, 보관, 회신, 신규 작성
- 임시 보관함: 서버 저장, 이어 쓰기, 재저장, 발송 전환
- 대화형 본문: 외부 발신자 경고, 첨부 메타데이터, 분류 등급
- 팀 협업: 공유함 구성원 경계, 담당자, 내부 댓글, 응답 목표
- 키보드 경험: `Cmd/Ctrl+K`, `/`, `C`, `E`와 명령 팔레트
- 관리자: 연결 상태, Provider 설정, 공유함 SLA, 보안·AI 정책
- 공급사 계약: Microsoft Graph, Gmail, NAVER WORKS, JMAP, IMAP/SMTP
- AI 확장: 회신, 일정, 휴가, 업무, 긴급 알림의 근거 기반·사람 승인형 제안
- 다국어·반응형: 한국어·영어, Desktop 2열, Mobile 단계형 탐색

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

## 검증 시나리오

1. 일반 구성원이 메일 홈과 본인 메일 8건을 조회한다.
2. 읽음·중요·Snooze·보관 변경이 version 증가와 감사 이벤트를 만든다.
3. 새 메일과 회신 재시도가 같은 idempotency key로 중복 메시지를 만들지 않는다.
4. 초안을 수정·재저장한 뒤 발송하면 Drafts에서 Sent로 이동한다.
5. 공유함 비구성원은 상세·댓글·담당 변경이 거부된다.
6. 공유함 담당자로 비구성원을 지정하면 서버가 거부한다.
7. 외부 연결은 Secret Reference 없이 활성화되지 않는다.
8. `MAIL_ADMIN`이 아닌 사용자의 연결·정책 변경은 403이다.
9. 일정 권한이 없는 사용자는 일정 제안을 수락할 수 없다.
10. Desktop과 Mobile에서 목록·상세·Dialog의 중첩 및 가로 overflow가 없다.

## 데이터베이스 이력

- Platform `V120`: 메일 도메인, 협업, 실행 제안, Outbox, Audit
- Platform `V121`: SKAX 계정·폴더·대화·메시지·공유함·제안 Seed
- Platform `V122`: 기존 메일·일정 런처를 네이티브 메일 앱으로 전환
- Platform `V124`: SKAX 활성 구성원 21명 전체 계정·메일·5종 AI 제안 보강
- Platform `V125`: 공유함 대화·담당자·내부 협업 댓글 완성
- Platform `V128`: AI 액션 계약 버전 고정과 기존 제안 호환 보강
- Platform `V140`: 근거·확인·권한·경로·만료 DB 불변식과 롤링 계약 버전 보강
- Auth `V60`: `APP.MAIL`, `ADMIN.MAIL`, `MAIL_ADMIN`, SKAX 위임 그룹

## 외부 준비가 필요한 범위

실제 Microsoft, Google, NAVER WORKS 또는 회사 메일 송수신은 고객 OAuth App, 관리자
동의, callback URL, Secret Store와 도메인 검증이 준비된 뒤 각 `MailConnectorPort`
어댑터를 활성화한다. 로컬은 동일한 도메인 계약을 사용하는 DWP Sandbox로 기능을 검증한다.
