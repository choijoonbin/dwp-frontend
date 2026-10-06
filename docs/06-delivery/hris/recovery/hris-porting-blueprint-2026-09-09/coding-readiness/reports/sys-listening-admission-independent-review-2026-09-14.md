# Listening admission 제한 독립 Privacy/Security 검토

판정: **G3 BLOCKED, 독립 승인 없음.** 전체 Survey/Form/Audience/Action 또는 BASE86 업무 무결성을 인증한 보고서가 아니다. 작성자 Analytics/AI 제안의 독립 승인과도 별도다. 검토자는 ROOT proposal/정본/backend를 수정하지 않았다.

[상세 typed findings](sys-listening-admission-independent-review-2026-09-14.json)에 정확한 JSON pointer, 근거, 수정 방향, negative acceptance 및 단계 경계를 보존했다.

검토 snapshot: sys-listening-admission-exact.proposal.v1.json SHA-256 ed13ab82bb6e625fbf915e7b8b87981b2e737994e04cbbb647da66501ab0d614, MD 2a32ff328954f5f6941bfb2e3fd6b20856cb4f8ea271f0fc8818d9487d0fc89d. ROOT가 이후 같은 경로를 수정하더라도 이 보고서는 해당 bytes만 평가한 역사적 snapshot이다.

## 인정한 실제 설계 개선

Auth issuer identity와 protected admission이 다른 schema/role 목적이고, protected collection에 principal/worker/correlation created-by가 없다. Response local FK는 configuration survey BIGINT가 아니라 자기 admission version이다. Submit/close fence와 response/answer/token/receipt 원자 owner transaction이 선언되어 있다.

삭제 후 payload HMAC을 없애면 동일 consumed token의 다른 payload까지 같은 ERASED receipt로 반환한다는 규칙이 명시되어 있다. 답변 비교 oracle이나 재제출을 허용하지 않는다. Erasure는 PENDING 접근 fence → 외부 키 작업 → 실제 matching REVOKED acknowledgement → final SQL의 별도 객체이며, RESULT_UNKNOWN에서 접근을 재개하거나 SQL delete만으로 백업까지 영구 삭제됐다고 하지 않는다.

같은 JVM 침해·privileged collusion·timing·식별 free text의 잔여 재식별 위험도 명시한다. 이는 암호화/ACL/HTTP PEP/키 authority가 실제 실행 검증됐다는 의미는 아니다.

## 실제 read-only 재현

Ajv 6.12.6의 coerceTypes=false/useDefaults=false/removeAdditional=false로 작성자 checker를 재실행했다.

node coding-readiness/semantic-remediation/validate_sys_listening_admission_proposal.cjs /Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend

결과: 15 schema compile, shape 74 case, selected boundary 96 check, exit0. Checker 자체도 crypto/owner source/ACL NOT_VERIFIED, domain execution NOT_EXECUTED_G4, independent approval NONE를 표시한다.

별도 in-memory schema probe 5개는 모두 **accepted=true**였다.

- formVersionRef=Privacy, privacyVersionRef=Retention, retentionVersionRef=Form으로 순환 교환.
- SUPPRESSED + ADEQUATE + nonempty meanValue4.
- 같은 questionKey q의 mean1/mean5 중복.
- SCALE 04.0000.
- SCALE -0.0000.

이는 공유 wire constraint 부재의 실행 증거이지 암호 서명을 우회하거나 실제 DB에서 답변을 탈취한 실험 결과는 아니다.

## G3 exact/shared 설계 P0 네 가지

1. LIS-P0-001 — owner 종류가 slot별로 고정되지 않는다. AdmissionControlRequest의 form/privacy/retention 모두 같은 3종 generic enum이며 CohortRequest privacy ref도 같다. 필드별 const/정확한 entity·revision·schema·digest·tenant owner binding과 실제 adapter 거부가 필요하다.

2. LIS-P0-002 — suppressed/adequacy/measures 조합이 shared schema에서 닫히지 않는다. Table/prose는 empty suppression을 말하지만 schema는 private mean을 실은 SUPPRESSED도 허용한다. Draft07 oneOf/conditional 및 complete requested typed question set, canonical order/unique-key owner projection guard가 필요하다. ARRAY의 uniqueItems만으로 동일 key·다른 value 중복을 잡는다고 주장하면 안 된다.

3. LIS-P0-003 — budget unique key에 canonical_query_digest가 포함되어 새 intersecting query마다 별도 spent_budget row/limit을 얻을 수 있다. Owner-stable admission/population batch/window/epoch parent budget과 child query dedup를 분리하고 parent lock에서 누적 debit해야 한다. 안전한 최소 기본값은 fixed complete package 한 번 + exact replay이며 임의 subset/alias/epoch reset은 거부한다. Erasure/source epoch 증가가 이전 공개 지식을 지우지는 않으므로 삭제 전후 changed mean의 새 publication도 cross-epoch privacy 계약 없이 허용하면 안 된다.

4. LIS-P0-004 — overall cohort threshold와 question별 실제 contributor threshold가 다르다. Answers는 0개도 허용한다. Cohort10명 중 한 명만 q를 응답했을 때 q mean을 공개하지 않도록 각 returned cell의 distinct ACTIVE/non-fenced contributing population에 threshold를 적용해야 한다. CHOICE bucket/complement suppression과 RESTRICTED_TEXT unsupported/moderated aggregate 경계도 actual form type/source에 연결해야 한다.

이들은 전체 domain CRUD를 G3 전에 구현하라는 요구가 아니다. 정확한 canonical 설계, 실제 공유 DTO/SPI fail-closed boundary/scaffold 및 negative test allocation을 G3에서 닫으라는 요구다. Domain SQL/계산/전체 수용 여정의 실제 실행은 G4다.

## P1 두 가지

LIS-P1-005: response ↔ receipt ↔ token consumption FK가 같은 tenant만 묶고 admission_id를 reciprocal reference tuple에 포함하지 않는다. Same-tenant 다른 admission의 잘못된 row 연결을 막도록 tenant/publicId/admissionId unique/FK closure를 계획해야 한다. Cross-tenant 실제 leak 실험으로 과장하지 않는다.

LIS-P1-006: canonical decimal 및 token decode/framing이 아직 shared protocol로 닫히지 않는다. Leading-zero/signed-zero shape acceptance, form precision/scale/허용 rounding, question/choice order, independent HMAC domain+length framing, canonical exact32byte base64url decode/reencode를 정의하고 negative 배정해야 한다. Random entropy/signature proof와 문자열 shape 검사는 다르다.

## 정직하게 남겨 둔 공통 차단

ROOT 자체 remainingOpenG3의 full Form/Survey/Action lifecycle/source/IA/PEP, crypto issuer/status/envelope/log redaction/consumer compile, 키 삭제 request/refetch/fence/proof/shared adapter, 13-stream composite authority/bootstrap/qualifier/ACL/native evidence는 여전히 OPEN이다. 기존 8/9 scalar 증거나 shape 74/96 PASS가 이를 대신하지 않는다.

G3: exact 설계와 real shared scaffold/compile/current common pilot 필요. G4: 실제 domain/SQL/crypto 여정 수용 실행. G5: mandatory full-screen DesignAI. G6: customer authority/key/privacy/country/process-isolation 승인. 현재 보고서는 G3 OPEN이나 P0/P1=0을 선언하지 않는다.
