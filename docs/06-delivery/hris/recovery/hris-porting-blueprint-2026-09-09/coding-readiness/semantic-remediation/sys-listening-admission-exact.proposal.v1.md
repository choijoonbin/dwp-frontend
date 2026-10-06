# Listening 수집·삭제·privacy 경계 exact 보완안

상태: DESIGN_PROPOSED_NOT_CANONICAL / G3 authorization NONE. 전체 Survey/Action 메뉴 계약을 완성한 문서가 아니라, 익명 수집의 취약한 공통 경계를 구체화한 설계 입력이다. 기존 정본·Gate·역사 SQL은 바꾸지 않았다.

[JSON 설계 입력](sys-listening-admission-exact.proposal.v1.json)은 표준 Draft-07 닫힌 schema15개, planned private table10개, public protected 경로 및 owner SPI9개를 정의한다. 모듈 개발자가 임의로 principal·worker·trace를 응답에 연결하는 것을 허용하지 않는다.

## 실제 처리 경계

Auth issuer는 인증된 principal/검증된 HRM self-context/eligible audience/consent를 검증하고 cryptographically random32byte token을 한 번 발급한다. 참여 신원·sealed token 전달은 Auth private issuer 경계에만 남긴다. 수집 경로는 로그인 principal을 대신 사용하지 않고 allowlisted issuer signature/audience/key/purpose/expiry 및 token commitment를 검증한다. issuer revocation/status를 확인할 수 없으면 닫힌다. unsigned 테스트 문자열의 schema 검사는 서명 검증이 아니다.

Protected admission은 configuration survey local ID가 아닌 자기 immutable admission/form/privacy/retention version을 소유한다. 질문의 실제 typed 정의를 owner refetch로 설치해야 하며 digest만으로 내용을 대체하지 않는다. submit과 close는 같은 admission lock/fence를 사용한다. 응답·encrypted answer rows·unique token consumption·protected receipt를 같은 owner transaction에 기록한다. 일반 principal-bound command receipt/createdBy/response 접근로그 연계는 금지한다.

일반 replay에는 receiptPublicId/status만 반환한다. 응답 UUID·token/HMAC·정밀 제출시간·참여 인원·답변은 노출하지 않는다. erasure 전 같은 token/같은 payload는 원본 receipt, 다른 payload는409다. erasure 후 payload HMAC이 없으므로 같은 valid consumed token의 모든 payload는 같은 ERASED receipt만 돌려준다. token을 다시 사용하거나 답변 비교 oracle을 만들지 않는다.

## 외부 키 폐기와 DB의 비원자성

삭제는 별도 protected erasure 객체다. retention/legal hold 검증 후 같은 response/admission transaction에서 PENDING ticket을 저장하고 접근을 ERASURE_FENCED로 차단하며 privacy epoch를 올린다. 외부 key erasure의 정확한 request ID를 dispatch 전에 보존한다. 결과 불명은 RESULT_UNKNOWN으로 같은 요청을 재조회하며 접근을 다시 열지 않는다.

실제 key authority의 matching REVOKED ack를 받은 뒤에만 SQL transaction으로 encrypted answers/key reference/payload HMAC을 제거하고 response/receipt를 ERASED, erasure ticket을 COMPLETED로 확정한다. DB commit과 외부 키 폐기가 한 transaction이라고 주장하지 않는다. 보존 백업을 포함한 key authority 정책·revocation/refetch/fence는 별도 exact shared contract·pilot 검증이 필요하다. 법적 hold로 BLOCKED이면 irreversible 폐기를 시작하지 않는다.

Cohort 계산은 protected owner 내부의 fixed query/epoch/budget/snapshot에서 수행하고 Insights에는 privacy-safe minimized aggregate만 전달한다. 전체뿐 아니라 질문별 실제 distinct contributing population에 threshold를 적용한다. 미충족 질문은 SUPPRESSED/null이고 전체 suppression은 빈 measures이지 평균0이 아니다. Admission lifetime shared parent cap과 query-dedup child를 분리한다. query digest·cohort alias·source/erasure epoch별 새 budget을 만들지 않는다. 최소 경로는 CLOSED fixed cutoff의 single complete package release와 exact replay다. 삭제 fence 이후 stale cohort/projection refetch/export를 차단하며 이미 공개한 지식이 지워졌다고 보고 changed mean을 다시 공개하지 않는다. Cross-survey/population/window batch alias를 막을 전역 owner-stable privacy 계약은 아직 OPEN이다.

## 검사 결과와 남은 조건

`validate_sys_listening_admission_proposal.cjs <explicit frontend>`를 실제 설치된 Ajv 엔진으로 실행했다. 후속 schema15compile, positive/negative shape97cases, 선택한 local tenant FK/no-identity-column/operation schema 및 table107checks exit0. JSON SHA는 `418628cc19a789b22f0b03efea93df165eee5967cdd14dd906d9d24a5d346137`다. 이 작성자 검사는 schema/선택한 boundary 구조만 증명한다. [독립 검토](../reports/sys-listening-admission-independent-review-2026-09-14.md)는 이전 ed13 snapshot의 P0 4/P1 2를 기록했고 현재 수정안을 승인한 보고서가 아니다.

그 지적 이후 slot별 ownerContract const, suppression/adequacy/value conditional, leading-zero/signed-zero 거부 및 exact32byte canonical base64url token을 보강했다. Response/receipt/token reciprocal FK는 tenant+admission+실제 response/receipt/token identity로 묶었다. ARRAY uniqueItems는 같은 questionKey·다른 mean의 중복을 막지 못하므로 해당 witness의 schema acceptance와 owner unique-key projection guard 미구현을 검사 출력에 OPEN으로 보존했다. Byte framing/HMAC/form-owner refetch와 전역 batch privacy 및 실제 공유 어댑터는 아직 검증되지 않았다.

미완료 G3: full survey/form/privacy/retention/audience/action/async exact schema 및 lifecycle/source graph, issuer/key/admission/cohort owner DTO/SPI 게시·fail-closed adapter/consumer compile, HTTP PEP/log redaction/current revocation·privacy fence, key erasure 프로토콜 및 cohort 차분 공격 독립 검토, private stream allocation/Control producer/bootstrap/actual startup ACL/native evidence. G4 actual domain/API/DB/crypto 실행은 NOT_EXECUTED다. 같은 JVM 침해·privileged collusion·네트워크 timing·식별 free text의 잔여 위험 때문에 절대적 익명성을 주장하지 않는다.
