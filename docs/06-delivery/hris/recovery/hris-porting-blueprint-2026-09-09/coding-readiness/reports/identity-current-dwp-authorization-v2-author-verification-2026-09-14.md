# Current DWP HRIS 권한 owner bridge ABI.v2 작성자 검증

상태: **AUTHOR_ONLY_MOCK / G3_CLOSED / NATIVE_PEP_P0_OPEN**. 신규 neutral DTO/SPI/guard5개·unit1개를 실제 작성·검사한 결과다. 기존 DWP 권한그룹·앱 권한·책임/resource-set·native identity를 재사용하는 준비이며 새 RBAC/신원원장/revision counter를 만들지 않았다.

## 실제 실행

UTC 2026-09-14 07:33:31.712490–07:33:37.799811, 6.086671초, Gradle exit0. **60 고유 case / failure0 / error0 / skip0**, source93개 SHA·정확한 decimal-string ns 전후 동일. host semaphore 대기0.000031초, 해제 확인. PostgreSQL/native provider 실행0.

```text
./gradlew :dwp-platform-contracts:test --rerun --tests com.dwp.platform.contracts.hris.identity.v2.CurrentHrisAuthorizationV2Test --no-daemon --max-workers=1
```

실제 compile/test task와 UP-TO-DATE 종속 task는 JSON에 구분했다. 현재 integration worktree는 승인된 후보 변경을 포함하며 clean/full-HEAD/G0 증거가 아니다. 전체 native/Gateway/PEP/consumer compile 결과로 확대하지 않는다.

## 구현된 제한 경계

- Auth-*·policy-*·psc-*·psr-*와 People source revisions를 별도 nativeString record로 유지한다. 문자열 SHA→long이나 독립 fake counter는 없다.
- native Actor의 existing user.version/access_revision 두 stamp와 People target의 person/worker/relationship/assignment 네 version은 분리된다. ZERO version도 정상이다.
- public authorize는 business target selector만 받는다. actor/duty/field/purpose boolean이나 raw authority를 직접 제공하는 호출 API는 없다. server-registered requirements 및 configured current owner providers가 필수다.
- missing adapter/Clock/config은 provider 호출 전0/0/0 거부. raw carrier는 public untrusted, lookup/result 생성자는 private·guard만 민트한다.
- SELF의 native Auth person 연결을 검사하고 UUID 우연 동일 fallback을 거부한다. NONSELF의 target에게 Auth 계정을 강요하지 않으며 PERSON에는 employment/location/TIM을 강요하지 않는다.
- 양 owner의 current source를 두 번 읽어 native identity/target parent/version·policy revision·scope/grants/allowed fields를 비교한다. 모든 호출 이후 Clock을 다시 캡처하고 최초 proof의 만료까지 재검사한다. provider exception/cause는 generic typed 오류로 정규화한다.

## 실제 typed fixtures

양성6: SELF PERSON/EMPLOYMENT, NONSELF person without target Auth, NONSELF actor without person, native versions0, 진행 Clock. 검증 결과에서 actual native actor/person/worker/relationship/assignment UUID·versions·원래 revision/purpose를 직접 소비해 assert한다.

음성53: missing/invalid invocation, actor relabel/native person/row/access/revoke/plane, string namespace 부적합, APP/permission/duty/static SoD/population/field/purpose/dynamic SoD 부적합, foreign/mismatched target parent/scope, 잘못된 People source kind, current auth/policy pointer/context/decision/target4versions/owner policy 변경, 최초 proof 중간 만료·stale capture·Clock 역행/null/예외, provider secret/cause redaction. 각 expected typed code와 실제 provider-call-count를 assert한다. private construction/API boundary1도 통과했다.

모든 제공자는 **EXPLICIT MOCK ONLY**다. native binding 데이터 모양을 가진 mock은 실제 native Auth/People SQL 검증이 아니다. 기존 reader79/SelfPerson72/고용165/Control31 통과를 이 scaffold의 native PASS로 재사용하지 않았다.

## 고정된 소스/문서

package `dwp-platform-contracts/.../hris/identity/v2`의 CurrentHrisAuthorizationV2, PortsV2, ExceptionV2, GuardedPortV2, VerifiedResultV2와 CurrentHrisAuthorizationV2Test가 이 작업 소유다. 정확한 파일명은 JSON `sourcePins`에 보존한다.

proposal JSON SHA `31d3f2e71fb78a8d60db563a2d99ae3cdf134fc510b7674539f07af42136de64`, MD SHA `9fe61dd855e55395bf0135192954058661edf791a6f51b738481c522cb844657`. 기존 source refs 및 native ownership·planned consumer/등록 순서는 해당 설계서에 있다.

동명 JSON에 93개 full pre-source manifest와 실제 full post 비교·동일 표현, 60 case IDs, XML 원문 gzip/base64·SHA·정확 ns, argv/시각/exit/task outcomes를 보존했다. source/문서 ns는 JS number가 아닌 정확한 decimal string이다.

## 남은 준비 P0

실제 native Auth/current Gateway/People provider, verified invocation/signed HTTP parser·transport·freshness/lifecycle/relink/revoke ordering, HRIS atomic-duty/field/purpose/dynamic SoD 등록, per-operation transaction PEP·query masking/CAS·consumer compile/native tests·verification-root/source registry는 미완료다.

특히 현 `ScopedAdminDutyPolicy.requiresScopedDuty`는 approvals.admin만, static SoD는 approvals 3 capability switch만 처리한다. native duty 증거 재사용 가능성과 HRIS 정책 완성은 다르다. 이를 client boolean/default true/전 권한 오픈/G4 이후로 미뤄 닫지 않는다.

순차 refetch와 string namespace 검사는 cross-DB atomic revoke나 signed source provenance를 증명하지 않는다. Author60 PASS는 독립 검토·실제 native provider/consumer 구현·전체 current check·G3 승인 전의 제한 후보 증거다. 기존 v1/core/Control/SQL/Gates/등록/메뉴를 변경하지 않았고 commit/전파0이다.
