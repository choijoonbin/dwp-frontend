# Native People USERoverride·ROLE READ 후속 작성자 검증

상태: AUTHOR_ONLY_SUBSET_VERIFIED / G3_CLOSED. 실제 People native SELECT 및49→50 호환 회귀만 확인했습니다. Auth ROLE/Gateway/date/DWP authority는 명시적인 MOCK이며, 실제 정책 생성·철회 API/서버 PEP·운영 배선 승인과 다릅니다.

최종 고유112개(실행140개), 실패·오류·건너뜀0입니다. 신규v3 고유93개와 기존V2 target49 fixture successor19개로 구분합니다.

| 실행 | 실제 결과 | UTC | 소요 |
|---|---|---|---|
| v3 단위 | 65 PASS | 09:17:08.686649–09:17:20.958658 | 12.271초 |
| v3 native PostgreSQL16 | 28 PASS | 09:17:38.406478–09:17:52.833166 | 14.426초 |
| v3 native PostgreSQL18.4 | 28 PASS | 09:18:44.376244–09:18:58.350850 | 13.974초 |
| V2 explicit target49 native PostgreSQL18.4 | 19 PASS | 09:19:30.764647–09:19:42.742002 | 11.977초 |

각 실행은 `:dwp-people-server:test --rerun --tests <exact class> --no-daemon --max-workers=1`, 기존 host semaphore30초, 자체180초 제한으로 수행했습니다. JSON의4개 raw gzip XML과 case ID/argv/UTC/exit 및384개 관련 source SHA·decimal-string ns는 실제 pre/post 재캡처 결과입니다. 4개 manifest가 모두 동일(`910a8401ef97e9b287b3554e525c8ce628d6462655923345ee20429b83b1cc34`)이고 선택 범위의 source drift0입니다. 이는 전체 backend의 clean/freeze/Gate 승인 주장이 아닙니다. 신규 core test2는 People task compile dependency 밖에서 다른 작성자가 준비하고 있었습니다.

## 실제 보완

- USER override를 READ/target 필터보다 먼저 적용했습니다. USER가 제한한 field/population 또는 EXPORT-only에 broad ROLE READ를 섞어 허용하던 신규 additive 후보를 폐기했습니다. FIELD_LIMIT/POPULATION_LIMIT/OTHER_ACTION의 최초 실제3FAIL 원문은 보존했고, 동일 POLICY_DENIED 기대값은 수정 후3PASS입니다. 기존 `WorkforceAccessPolicyService.find/Decision`은 변경하지 않았습니다.
- 각 effective policy의 target organization∧field를 확인한 뒤 해당 target의 field만 합칩니다. USER가 존재하면 ROLE contribution은 남지 않습니다. ROLE-only carrier는 direct/group/privileged native0version을 검증하지만 MOCK source이며 native Auth bridge composition 증거가 아닙니다.
- 실제 V50 forward SQL은 ROLE old80 OR native50만 허용합니다. 역사 V34·기존 legacy80/USER 정책행 전체 JSON·versions/windows·인덱스·다른 제약/FK/ACL을 보존했습니다. 신규 단일문자/점/하이픈/50자 문법은 실제DB에 저장되고 lowercase/공백/dotted51/81자/USER0은 거부됩니다. 기존 제한으로 되돌리는 owned rollback transaction은23514로 실패하고 전체 변경을 rollback했습니다. fake-column/fixture ALTER 건강성 우회는 없습니다.
- 원본 V2 PG fixture의 전체 원문·SHA `f302c76457b29d9b6c151510cd29308e35d09a1eb09b0d88e1f4e4b655172485`·ns를 별도 보고서에 보존했습니다. `.target("49")`만 추가한 successor를 실제19개 재실행했습니다. 과거241/70 결과를 수정본의 현재 증거로 승계하지 않았습니다.
- 신규 PG policy 관계 fixture는 DIRECTORY+JOB_GRADE 형태를 사용하며 기존 생성 API의 DIRECTORY 요건 삭제0입니다. 서비스 create/revoke가 실제 source producer로 연결됐다고 주장하지 않습니다.

## 정확한 소유 파일

| 파일 | SHA256 | decimal ns |
|---|---|---|
| v3 `NativeHrisUserRolePolicyAdmissionPilotV3.java` | `63eb1bc46a3d41489707b5994cbed099c34f8c78eb4bcfd0234735567d5fd72c` | `1789377330456843797` |
| 신규 `V50__align_workforce_policy_role_code_compatibility.sql` | `6ac12cc8dc366c022e29f57d940923dda11da4909338b6afc200e093f9e00e89` | `1789376869501244057` |
| V2 PG target49 fixture successor | `d98c158b664c62dd99541f23e5726622851d74572cdde26dc91ac195efda7958` | `1789376917158854448` |
| v3 PG test | `d56a547b4e518b51241242ad4f14c049ecd9a1ec0afc21bbffed49b12d3871cd` | `1789377392265392077` |
| v3 unit test | `1f09caf5fea9fbe30bc8b6d5b691ad9b9108b77540af2e08209b723b74cc45a2` | `1789377330457739674` |

전체 경로 및 source384 명세는 동명의 JSON에 있습니다. 기존 frozen Auth4/neutralV2/build/SQL·권한/신원 원장·legacy service/Decision·registry/Gate 변경0, commit/정본 전파0입니다. V50은 root가 별도 승인한 실제 forward migration이며 역사 SQL을 수정하지 않았습니다.

## 처음 실패도 보존

- 신규 static import 컴파일 오류: test0/13.450초.
- native PostgreSQL16 최초26 중1FAIL: V34 역할 제약이 `R`을 거부.
- 다른 작성자의 신규 core 시간타입 컴파일 오류: test0/15.279초, 저자에게 pointer 전달 후 저자가 수리.
- USER override 최초3개 실제보안FAIL: 기대 거부인데 아무 예외도 발생하지 않음/12.396초.
- 이전 additive 단위62PASS는 역사 파일로 보존하되 owner-compatible 정책 승인으로 정정·승계하지 않음.

## 미완료 경계와 다음 최소 작업

Auth/Gateway native current proof transport, target-role catalog owner publication, 실제 policy governance/생산자, HRIS atomic duty/app entitlement/dynamic SoD, signed current People proof 및 필드 투영,13stream Control/startup 배선은 OPEN입니다. ROLE storage 허용을 신규 grant로 사용하면 안 됩니다. 현재 create API의 old ROLE validation도 아직 그대로여서 신규 역할의 실제 API 생산자 연결이 완료되지 않았습니다.

[최소 producer 연결 계획](workforce-policy-native-producer-minimal-plan-2026-09-14.md)을 root에 전달했습니다. 기존 권한 그룹과 ADMIN.WORKFORCE_ACCESS를 재사용하고, DIRECTORY·USERoverride·tenant/subject/organization 검사·CAS·AuditOutbox를 보존합니다. target-role catalog는 actor가 보유한 역할 집합과 별도의 Auth owner read가 필요하며 People에 Auth DB 읽기 권한을 주지 않습니다. 다음 코드는 독립 검토와 별도 exact source 범위 승인 후 진행합니다.

Suite XML에서 추출한 owned PostgreSQL/Ryuk6개는09:21:42 UTC read-only inspect에서 모두 no-such-object였습니다. live 이름만 같은 다른 Testcontainers/Approval capture 또는 사용자 main PG/Redis/Kafka는 소유 대상이 아니며 중단·삭제하지 않았습니다. 원시 credential 저장0입니다.

