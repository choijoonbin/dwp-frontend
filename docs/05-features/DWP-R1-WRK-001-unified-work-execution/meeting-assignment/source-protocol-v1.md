# Work → Meeting 후속 업무 원천 검증 프로토콜 v1

상태: 2026-09-04 구현용 계약. Work 송신부는 이 작업, Meeting 수신·ACL·nonce 저장소는 Meeting 작업이 소유한다. 양쪽 연결 검증 전에는 운영 연동 완료로 표시하지 않는다. 이 문서는 기존 개인업무 API나 공통 Gateway 권한 계약을 변경하지 않는다.

## 전송과 인증

- `POST /internal/v1/meeting-followups/resolve`, `Content-Type: application/json`.
- 전용 헤더 `X-DWP-Work-Assertion: dwp1.<payload base64url>.<signature base64url>`.
- signature는 `HMAC-SHA256(secret, ASCII("dwp1." + payloadBase64url))`이다. Base64url padding은 생략한다.
- issuer `dwp-platform-work`, audience `dwp-meeting-followup-source`, `v=1`. 일반 Meeting 서비스 토큰이나 사용자 입력 assertion을 전달하지 않는다.
- 최소 32바이트의 audience 전용 secret. Work 환경 변수는 `DWP_WORK_MEETING_SOURCE_BASE_URL`, `DWP_WORK_MEETING_ASSERTION_KEY_ID`, `DWP_WORK_MEETING_ASSERTION_SECRET_BASE64`. 키/URL 미설정 시 원천 생성·재배정은 실패한다. 비밀키 기본값은 없다.
- 기본 HTTPS, 개발용 HTTP는 명시적 `DWP_WORK_MEETING_SOURCE_ALLOW_HTTP=true`일 때만 허용한다. 리다이렉트는 따르지 않고 응답은 16 KiB로 제한한다.
- TTL 30초, 수신 허용 clock skew 최대 5초. 수신자는 서명·kid/iss/aud·시간·본문 SHA256·method/path·tenant/actor/source/action 결속을 모두 검사한 뒤 JTI를 원자적으로 한 번만 소비한다. nonce 보존 기간은 만료+clock skew 이상이다. 본문 실패나 ACL 실패라도 소비한 JTI를 재사용하지 않는다.
- Work의 HTTP 자동 재시도는 없다. 새 HTTP 확인마다 새 JTI를 사용하고, Work 변경 명령의 Idempotency-Key는 같은 명령 재시도에서 유지한다.
- 요청의 correlation/traceparent/tracestate는 공통 OutboundHttpHeaders 계약으로 전파한다. 브라우저 Authorization/Cookie, tenant/user/권한/session 헤더, 일반 서비스 토큰 및 브라우저가 보낸 assertion을 전달하지 않는다. 이 호출에 필요한 인증은 Work가 새로 서명한 전용 assertion이다.
- ACL은 Meeting의 현재 tenant/meeting/report/candidate 결속, 보고서 접근, 사람의 후보 확정, 배정자 권한, 대상자의 동일 테넌트·배정 자격으로 판정한다. assertion은 이 검사들을 대신하지 않는다.
- 위 객체 ACL에 더해 Meeting의 **현재 product entitlement, authorityRevision, scope, identity plane 및 후속 업무 승격/재배정의 정확한 capability**를 확인한다. Work 권한이나 Meeting host/membership만으로 이 검사를 대체하지 않는다. 수신자의 governed authority port가 미설정이거나 현재 판정을 조회할 수 없으면 `allowed=false`로 실패한다. 임의 `APP.MEETINGS=true` context를 만들거나 다른 workload identity로 가장하지 않는다. 기존 Gateway 전용 Auth evaluate 경로를 Meeting이 Gateway 신원으로 호출하지 않는다.
- report/candidate의 retention_until 만료도 즉시 접근 불가로 판정한다. 삭제 worker가 아직 처리하지 않았다는 이유로 CREATE/REASSIGN 또는 READ 원본 정보를 허용하지 않는다. 내부 endpoint는 정확한 method/path 전용 보안 분기로 assertion+현재 authority를 검증하고, public OpenAPI/Gateway로 노출하지 않는다.
- 현재 공통 Auth/Gateway의 전용 S2S authority 경계는 이 구현에서 변경하지 않는다. Meeting authority port와 정확한 route/capability 승인·등록은 통합 전 필수 인계 사항이며, 이 경계가 닫히기 전 실제 원천 전환은 NO-GO이다.
- 공통 감사 결과, 현 Auth/People evaluate는 Gateway 전용이고 People의 기존 HCM actor/scope 판정은 이 후속 업무의 현재 사용자 ACTIVE·대상 담당자 적격성을 충분히 증명하지 않는다. 현 v1~v4를 바꾸거나 해당 포트를 다른 신원으로 호출하지 않는다. 차기 additive 계약의 internal-only binding, 본문 action별 READ/CREATE/REASSIGN, Meeting 전용 현재 Auth 권한 평가 및 People target eligibility가 필요하다. 서명된 요청자 신원은 현재 제품 권한을 대체하지 않는다.

## 요청

```json
{
  "tenantId": 7,
  "actorUserId": 11,
  "source": { "meetingId": "UUID", "reportId": "UUID", "candidateId": "UUID" },
  "action": "CREATE",
  "targetAssigneeUserId": null,
  "expectedSourceVersion": 3
}
```

| 행동       | 요청 의미                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CREATE`   | `expectedSourceVersion` 필수. 현재 actor가 확정 후보를 승격할 수 있는지 검증하고, 저장된 확정 담당자·업무 조건을 반환한다. `targetAssigneeUserId=null`  |
| `READ`     | 현재 원본 접근만 검증. 두 선택 필드 null. `canAssign`은 현재 actor가 이 후보의 배정을 관리할 수 있는지 나타내며 특정 새 담당자의 자격을 보장하지 않는다 |
| `REASSIGN` | `targetAssigneeUserId` 필수. 현재 원본 접근·배정 관리 권한·해당 새 담당자의 자격을 함께 검증. `expectedSourceVersion=null`                              |

candidateId는 Meeting 서버에서 발급·영속화한 UUID이며, 배열 index·프런트 임의 ID·내용 hash를 대신 사용하지 않는다. 공개 Work source에는 `sourceSystem=MEETING_FOLLOWUP`을 포함하며, 내부 endpoint는 이 namespace 전용이다.

assertion payload 필드:

`v, kid, iss, aud, method, path, tenantId, actorUserId, meetingId, reportId, candidateId, action, iat, exp, jti, bodySha256`.

UUID는 정규 소문자 문자열, 시간은 Unix seconds, bodySha256은 전송한 UTF-8 원본 요청 bytes의 SHA256 소문자 hex이다. 재직렬화한 본문의 hash로 대체하지 않는다. 서명된 actor/tenant는 Work에서 검증된 현재 요청 주체다.

## 응답

내부 endpoint는 공통 `ApiResponse` envelope 없이 아래 JSON을 반환한다. 성공/업무상 거절은 200의 명시적 판정이고, 잘못된 인증은 401/403, 일시 장애는 5xx이다.

```json
{
  "tenantId": 7,
  "actorUserId": 11,
  "source": { "meetingId": "UUID", "reportId": "UUID", "candidateId": "UUID" },
  "action": "CREATE",
  "allowed": true,
  "denialCode": null,
  "sourceVersion": 3,
  "originalAccess": "AVAILABLE",
  "canAssign": true,
  "approvedTask": {
    "assigneeUserId": 21,
    "title": "사람이 확정한 독립 업무 제목",
    "description": null,
    "priority": "NORMAL",
    "dueAt": null
  }
}
```

- tenant/actor/source/action echo는 필수이며 요청과 완전히 일치해야 한다.
- `originalAccess`: `AVAILABLE | FORBIDDEN | DELETED | UNAVAILABLE`. Work의 사용자 응답에서는 비가용 원인을 통합해 `UNAVAILABLE`로 제공한다.
- `allowed=true`는 현재 action 전체 전제 충족을 뜻한다. CREATE/REASSIGN 성공은 `canAssign=true`, `originalAccess=AVAILABLE`을 함께 요구한다.
- `sourceVersion`은 현재 영속 후보 버전이다. CREATE에서는 expectedSourceVersion과 같아야 한다.
- `approvedTask`는 허용된 CREATE에서만 존재한다. title 필수·trim 후 1~500자, description 선택·최대 4,000자, priority `LOW|NORMAL|HIGH|URGENT`, dueAt offset date-time 또는 null, assigneeUserId 양수다. 사람이 확인한 독립 업무 조건만 포함한다.
- READ/REASSIGN/거절 응답의 approvedTask는 null이다. 회의 제목·인용·전사·녹화 URL·감정/인사 평가는 어떤 응답에도 포함하지 않는다.
- denialCode는 민감 정보 없는 짧은 코드다. Work는 원천의 원문 오류나 본문을 사용자 오류·로그로 전달하지 않는다.
- 원본 복귀 링크는 AVAILABLE일 때만 `/meetings/follow-ups?meetingId={id}&reportId={id}&candidateId={id}`로 Work에서 생성한다. 링크 클릭 후에도 Meeting이 현재 ACL을 검증한다. 임의 source URL을 받아 이동하지 않는다.

## 상태와 원본 삭제

Work가 저장한 사람 확정 title/description/담당/기한/상태는 Work ACL로 관리한다. 원본 권한 철회·삭제 시 Work source.reference/sourceVersion/sourceRoute를 모두 null로 반환한다. Work 자체를 삭제하거나 자동 보류하지 않는다. 새 생성·재배정은 현재 원천 확인에 실패하면 실행하지 않는다. 수락/거절/진행/완료는 현재 Work 담당자·권한·버전·배정 차수로 판정한다.

Work sourceVersion은 생성 시 확정했던 후보 버전을 가리킨다. 이후 Meeting 후보 변경이 확정 Work 조건을 자동 덮어쓰지 않는다. source 접근을 확인한 당시와 이후 권한 변경을 하나의 분산 DB 트랜잭션처럼 보증하지 않으며, 원문 노출 때마다 현재 원본 권한을 다시 확인한다.

`sourceVersion`은 후보 내용 버전, `authorityRevision`은 현재 권한 판정 버전이며 서로 교환하지 않는다. Work의 `version`/`assignmentRevision` 또는 명령 영수증의 적용 버전을 Meeting의 expected revision으로 재사용하지 않는다. 목록의 `NOT_REQUESTED`는 원천을 조회하지 않은 상태이며 reference/sourceVersion/sourceRoute가 모두 null이다. 원천 확인 실패인 `UNAVAILABLE`과 구분한다.

원천 HTTP 확인은 Work DB transaction/row lock 밖에서 실행한다. Work mutation은 권한 확인 시작부터 최대 10초 이내의 스냅샷만 사용하고, DB lock 획득 뒤 이 기한과 Work version/assignmentRevision을 다시 확인한다. 만료 시 쓰지 않고 다시 검토하게 한다. 응답의 source inspection도 commit 이후 수행한다. 이는 짧은 기간의 검증 결과를 사용하는 계약이며, 서로 다른 서비스의 동시 권한 철회와 Work commit을 하나의 원자적 transaction으로 보증하는 분산 fence는 아니다. 그 수준의 직렬화가 요구되는 운영 환경에는 별도 source 승인 lease/취소 연동 계약이 필요하다.

양쪽 구현은 [공개 테스트 키 golden fixture](evidence/source-golden-v1.json)로 요청 bytes, assertion claims, signature를 대조한다. 해당 fixture 키는 테스트 데이터이며 운영 설정값이 아니다.
