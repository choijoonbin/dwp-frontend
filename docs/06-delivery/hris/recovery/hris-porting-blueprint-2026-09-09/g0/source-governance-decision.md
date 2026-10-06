# SKKF Source Governance Decision

Decision ID: `SRC-GOV-001`  
Active mode: `BEHAVIORAL_REIMPLEMENTATION_NO_CODE_REUSE`  
Effective scope: HRIS analysis, G3 generic-core engineering, and trace recovery  
Legal code-reuse evidence: `NOT_PROVIDED`  
G3 generic-core engineering authority: `ROLE_BOUND_VALIDATOR_CONTROLLED`  
Source reuse / G6 production authority: `BLOCKED`

## 결정

SKKF는 업무 행위와 결과를 이해하기 위한 참고 입력으로만 사용한다. DWP 구현은 DWP 계약·용어·아키텍처에서 새로 작성한다. 다음 항목은 path, 크기, 수정 정도와 관계없이 복사·번역·기계 변환·부분 전재할 수 없다.

- source code와 주석
- configuration, deployment manifest, environment file
- binary, JAR/WAR/TGZ와 사설 dependency
- SQL, query, stored procedure, seed data
- 급여·근태·평가 formula, expression, rule script
- 화면 source, stylesheet, image, icon, template, document asset
- 고객·직원·급여·계좌·세무·평가 데이터와 운영 log

SKKF package, namespace, artifact, private registry를 DWP build/runtime dependency로 import하는 것도 금지한다. BENSK/ADDSK repo와 공통 소스에 남은 고객사 분기는 `EXCLUDED_QUARANTINED`다.

`copy_allowed=NO`는 DWP 제품·build·runtime·일반 산출물로의 복사·재사용을 금지한다는 뜻이다. G0 Source Custodian이 만든 `/Users/a10697/Work/DWP/.codex-worktrees/hris/sanitized-source/*`는 사용자가 승인한 분석 목적 안에서만 허용되는 좁은 `SECURITY_CONTROLLED_ANALYSIS_COPY_NO_PRODUCT_REUSE` 예외다. 이 뷰는 deny 대상 파일을 통째로 제외하고 모든 텍스트를 `.analysis.txt`로 바꾸며 파일 `0444`, 디렉터리 `0555`, Git metadata 없음, build/import/execute 금지 상태로 고정한다. G1은 `coverage-sanitized-access-register.csv`에서 허용된 자기 artifact만 열 수 있고 raw snapshot에는 직접 접근할 수 없다.

## 허용 산출물

G1 세션은 원문 표현을 포함하지 않는 다음 산출물만 만들 수 있다.

- 사용자의 업무 질문과 actor
- 입력·출력·validation·상태전이·exception의 사실 명세
- source-to-target N:M trace와 disposition
- 합성 입력으로 만든 characterization/golden test 요구사항
- 새로 설계한 DWP API/event/schema/permission proposal
- 법정·정책 근거가 필요한 항목의 `UNKNOWN` 기록

레거시의 고유 class/method/SQL/formula를 target code나 prompt에 붙여 넣지 않는다. 추적에는 값 비노출 source path와 blob/content hash를 증거 포인터로 남길 수 있지만 원문 snippet은 남기지 않는다. 현재 coverage 2,269행 중 2,258행만 정제 텍스트로 접근 가능하고, 민감 경계 9행은 `SECURITY_BLOCKED_UNKNOWN`으로 Security 검토 또는 안전한 행위 대체 설계가 필요하며, BENSK 혼입 2행은 `RETIRE_EXCLUDED_BENSK`다.

## 권리 확대 절차

`CODE_REUSE_ALLOWED` 또는 SKKF dependency import로 확대하려면 후속 결정서에 다음이 모두 있어야 한다.

1. Legal/Source Rights의 서면 근거 ID와 정확한 허용 path/hash
2. inspect, run, copy, modify, derivative work, 내부·상용 배포 범위
3. OSS/SBOM, notice, source-offer와 incompatibility 판정
4. Security secret/history scan과 실제 credential rotate/revoke 증거
5. Privacy의 데이터·log·screenshot 반출 판정
6. Architecture의 target dependency 및 contamination 검토
7. 영향 세션의 재ACK와 `source-scope-register.csv` 개정

승인되지 않은 경로는 계속 default deny다. OSS notice 파일이 존재한다는 사실만으로 제품 source 재사용 권리를 추론하지 않는다.

## Clean-room 명칭

현재 모든 세션이 같은 workspace의 SKKF 경로를 기술적으로 읽을 수 있으므로 이 운영을 법적 의미의 strict clean room이라고 부르지 않는다. strict clean room이 필요하다는 법무 결정이 내려지면 source 관찰 환경과 구현 환경을 OS/container ACL로 분리하고, 구현팀에는 검토된 비표현적 명세만 전달한다.

## Secret·SBOM 처리

G0에서 여섯 clean detached snapshot의 현재 tracked tree와 현재 object database의 `--all` ref에서 도달 가능한 전체 Git history를 검사했다. `.env`, deployment, REST sample, log, vendored binary·archive를 포함하되 비밀값·source line·diff·commit message·author identity·environment value·credential hash는 증거에 저장하지 않았다. finding은 위치와 rule ID일 뿐 live credential 판정이 아니며, 원 시스템에서 live로 확인되면 revoke/rotate 후 재검증한다.

`source-security-evidence/reference-only-sbom.cdx.json`은 manifest/lockfile 정적 파싱과 vendored binary hash를 합친 **참고용·비승인** inventory다. Gradle task나 dependency resolution을 실행하지 않았으므로 Gradle transitive completeness, vulnerability 상태, license compatibility, provenance 또는 DWP import 승인을 주장하지 않는다. 별도로 DWP target baseline은 backend CycloneDX 1.6의 342 components/343 dependency nodes와 frontend 166 components/167 dependency nodes를 canonical graph digest로 고정했다. backend dependency를 바꾸기 전에는 `G2-06`에서 SBOM diff, vulnerability, license/notice/source-offer, Security·OSS·Architecture 승인을 모두 받아야 한다.

G0의 `source-risk-surface-register.csv` 수치는 clean detached snapshot에 대한 보수적 파일 표면 count이지 활성 secret 확정 수가 아니다. 값 자체·assignment 내용·credential fingerprint를 이 레지스트리에 기록하지 않으며, 여섯 snapshot은 모두 `NO_EXECUTION_NO_IMPORT_QUARANTINE`로 처리한다. 상세 증거와 digest chain의 정본은 `source-security-evidence/README.md`, `scan-metadata.json`, `evidence-file-digests.csv`, `EVIDENCE_DIGEST.sha256`이다.

## Gate

- G1: 이 결정에 따라 가능
- G2 설계 종료 및 G3 범용 core 코딩: `role-register.csv`와 `role-operational-binding-register.csv`의 안정 role binding, authoritative live checkpoint, 102개 추적 slice 중 100개 code-enabled named slice의 `G3-CODE-GO-*` 토큰, touch manifest가 모두 통과할 때만 가능하다. HRM-006/SYS-013 두 retired evidence-only slice에는 코드 토큰이 없다. 이는 사용자가 승인한 제품 방향 아래의 engineering authority이며 실명 운영 승인을 대신하지 않는다.
- Source code reuse: Legal+Security 서면 승인 전까지 계속 불가다. G3가 열려도 SKKF 표현물은 복사하지 않고 sealed 비표현적 계약을 DWP 코드로 독립 구현한다.
- G6/Production: 실제 책임자·대리자 ACK, statutory/privacy/security/operations 서명, 실제 연계·고객·국가팩 evidence 전까지 불가다.
