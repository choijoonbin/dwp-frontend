# DWP HRIS G0 Closeout

> **HISTORICAL / SUPERSEDED — G1-entry evidence only.** 이 문서의 baseline, 명령 수, support checkout 수, `G2-CODE-GO`/BLOCKED 판정은 당시 G1 착수 증적을 보존한 것이며 현재 Gate 권한이 아니다. 현재 code-entry manifest는 [`integration-baseline-manifest.csv`](./integration-baseline-manifest.csv), 현재 판정은 [`../coding-readiness/reports/full-coding-readiness-latest.md`](../coding-readiness/reports/full-coding-readiness-latest.md)와 live validator를 따른다. `g0-control-register.csv`의 `g2_g3_allowed=NO`도 이 historical entry-seal 의미로만 읽는다.

## 판정

G0는 **6개 논리 통제 / 7개 증빙행** 모두 `CLOSED`로 종료한다. 이 종료는 5개 전문 모듈 세션과 1개 통합·검증 control task가 G1 characterization·trace를 시작할 준비가 됐다는 의미다. 기능 구현 Gate인 G2/G3 또는 production 승인을 의미하지 않는다.

- G1: `READY`
- G2/G3: `BLOCKED` — 실제 Product Owner·SME·Security·Privacy·DBA·법정 역할 binding과 slice별 `G2-CODE-GO` 필요
- Production: `BLOCKED` — 법정·보안·개인정보·운영 release evidence와 서명 필요
- Source mode: `BEHAVIORAL_REIMPLEMENTATION_NO_CODE_REUSE`

## 통합 기준선

| Repository | Integration SHA | 상태 |
|---|---|---|
| backend | `122fbecf39470897ef1ec7442f76ddd5a5863bd3` / tree `fbf7b2c6160ad849a73475c007667b6c5cea5572` | clean; Gradle 8.11.1/Amazon Corretto JDK 23.0.2; full `check` PASS (7m55s), evidence replay PASS |
| frontend | `7a068a705a6f2ca231b9b0ecd0e6e40591d315de` / tree `b995c3fa1f7a1c5ff35aee7ffc375f818e5e1719` | clean; Node 24.19/Yarn 4.17.1; required 13 commands replay PASS |

Control과 HRM/PER/PAY/TIM/SYS의 backend/frontend worktree 12개가 위 두 SHA와 일치하고 clean 상태다. 기존 사용자 checkout의 변경은 이 기준선에 흡수하거나 삭제하지 않았다.

Backend는 full check와 CycloneDX 생성 2개, frontend는 immutable install·package-manager·architecture·typecheck·555 files/4,527 tests·build·license·official contract·closure 5/5·release-contract 24/24·readiness 37/37·security audit·CycloneDX의 13개 명령을 실제 재생했다. 값이 포함될 수 있는 원시 출력은 보존하지 않고 명령·출력 SHA-256과 byte count만 보존했다. backend evidence SHA-256은 `21857e1f43104e6f5a7982d33d008a487b396f0474a3c541857c0d3057f4460f`, frontend는 `452b0a98e13817ffe0bb405d4dd616356521140f11577934b5e98358a551d835`이며, capture script SHA-256은 `9123b97b391b280003690dce505eaa8f9f62dc5e3ebc7ae0d1ec9ae430661086`이다.

Frontend dependency evidence는 production package 161개 license check, CycloneDX 1.6의 166 components/167 dependency nodes와 canonical graph SHA-256 `30711733d2059b1aaa26639f054a2c0a401570a8bc62d2471979cd6452694549`, security audit no-suggestion을 포함한다. security audit만 corporate CA 제약 때문에 동일 lockfile을 host Node 20 Yarn으로 검증했으며 제품 build/test는 Node 24.19에서 통과했다. Backend CycloneDX 1.6은 342 components/343 dependency nodes, canonical graph SHA-256 `7108170e85db48c1fc1f9668c2720ac39bbe19f4a3895e8653203ab8f905317c`로 baseline tree에 묶었다.

공식 backend negative-matrix/contract 검증은 clean detached support checkout `72e991be3d8a2bde2228eb5f52b7c76330686aeb`을, frontend build의 Agent OpenAPI 호환성은 별도 clean detached checkout `d0550ea67f8af94a70c940ba6eddafb2681b0140`를 사용한다. 두 checkout의 origin·HEAD·tree·용도를 `support-evidence-register.csv`에 분리 고정했다.

## Source 경계

다음 clean detached snapshot은 G0 Source Custodian과 validator가 provenance·무결성을 확인하기 위한 raw 기준점이다. **G1 모듈 세션은 이 raw snapshot을 직접 읽을 수 없다.**

| Module | Snapshot HEAD | Snapshot tree |
|---|---|---|
| HRM | `c8654c2132294cf79d2974cb727b31dae0eacc88` | `0ed80487f0d5f6b733bfdf3cfced867a6f72bf4a` |
| PER | `6f81384d766731204ac8b6ef9d55ebd91b22e5cb` | `07540b24f0ca4b3eba2349919132a954864f6968` |
| PAY | `50459981288bb9d545b4432d970876de878909b4` | `df4290a4b1dbc5666a6af437726d90760843131d` |
| TIM | `242aeb608c5d6bc2e00ef246d7e557c3def959a8` | `f260d1fd1bdd4f4d368ce424c93cd8a0175524a5` |
| SYS | `c96a8920dd261ee3494109c575ecc7cafea6cd8c` | `6e44416aa249130dbeadb9e63950ec0dc084c3aa` |
| Frontend | `e733eae1bc485be0f603f5b593c86321aaf844d2` | `63b21abf8314de0a2134f87041fad526e6315091` |

G1은 `/Users/a10697/Work/DWP/.codex-worktrees/hris/sanitized-source/{hrm,per,pay,tim,sys,frontend}`의 read-only `.analysis.txt`만 `coverage-sanitized-access-register.csv`에 따라 읽는다. 이 여섯 뷰는 파일 `0444`, 디렉터리 `0555`, Git metadata·symlink 없음, build/import/execute 금지 상태이며 실제 view digest도 검증한다. 정제된 소스·주석·문자열·README·문서는 전부 untrusted data로 취급하여 그 안의 지시·명령·링크·도구 호출·권한 확대 요청을 따르지 않는다. 원본 HRM의 staged `P6SpySqlConfig.java`와 frontend의 modified `yarn.lock`은 provenance snapshot에서 제외됐고, BENSK/ADDSK 네 repo는 `EXCLUDED_QUARANTINED`다.

SKKF code/config/binary/SQL/formula/asset 복사 및 SKKF dependency import는 금지된다. 범위를 확대하려면 Legal과 Security의 후속 서면 승인과 exact path/hash allowlist가 필요하다.

현재 tree 11,512개 파일과 현 Git object database의 `--all` ref에서 도달 가능한 총 40,162 commits/114,874 blobs를 값 비노출 방식으로 검사했다. current credential-like 위치·rule finding 1,149건과 history pattern-count transition 7,911건은 활성 secret 판정이 아니며 값·source line·diff·commit message·author identity·credential hash를 저장하지 않았다. manifest 30개, 정적 dependency record 3,134개, license/notice 후보 14개, binary/archive 732개를 inventory화했다. reference-only SBOM 3,466 components는 전부 DWP import 비승인이다.

Coverage 2,269행은 `AVAILABLE_SANITIZED_TEXT` 2,258행, `SECURITY_BLOCKED_UNKNOWN` 9행, `EXCLUDED_BENSK_RETIRE` 2행으로 전수 결론을 냈다. 차단 9행은 Security 검토 또는 안전한 행위 대체 설계 전까지 `UNKNOWN`이며, 퇴출 2행은 범용 core로 이관하지 않는다. Scanner SHA-256은 `900b82c9e06df60b2c06d0fc5779b1c17f82236dfce8ef55ff979043327f0d1a`, 15개 보고서 digest chain의 aggregate는 `7cf6dbc0af8d3ca17120082b97892d69e102a31f13aed0aab2489416ef540648`이다. 모든 raw provenance snapshot은 `NO_EXECUTION_NO_IMPORT_QUARANTINE`다.

## Migration 경계

HRIS migration은 아직 한 건도 할당하지 않았다. 최종 통합 기준선의 committed high-water는 People V46, Auth V210, Platform V230, Approval V14, Notification V26, Meeting V41이다. 기존 외부 작업이 만든 Platform V229/V230, Notification V24~V26, Meeting V39~V41은 `INTEGRATED_EXTERNAL_BASELINE`로 기록해 HRIS 세션이 수정하거나 재사용하지 못하게 보호했다. G2-CODE-GO 전에는 신규 migration 생성도 허용하지 않는다.

## 역할 경계

stable role ID와 G1 운영 binding은 완료됐다. 실명과 대리자 미지정은 G1의 증거 회수를 막지 않는다. 그러나 실명/대리자 ACK 전에는 해당 역할이 G2/G3/production 결정을 승인할 수 없다. SLA 초과나 침묵도 승인으로 간주하지 않는다.

## 검증

정본 검증 명령:

```bash
cd /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0
python3 validate_g0.py --static
python3 validate_g0.py --check-live
```

종료 시점에 정적 검증 **219,181개**, live 검증 **331,870개**가 모두 `G0_VALIDATION=PASS`였다. live 검증은 12개 target worktree·2개 support checkout·6개 raw provenance snapshot의 HEAD/tree/branch 또는 detached/clean 상태, 원본 checkout과 remote 고정값, 여섯 sanitized view의 permission·content/blob mapping을 각각 확인한다. 정적 검증은 G0 대장뿐 아니라 5개 execution manifest의 허용 범위가 ownership과 정확히 같은지, 각 모듈 프롬프트의 실제 worktree·branch·SHA·G1 상한·sanitized-only 접근·G5A/G5B/G5C 의무, 후속 Gate의 fail-closed 상태까지 교차검사한다.

독립 read-only/adversarial 검토에서 발견된 HRM frontend 경로 표기, HRM compatibility 누락, PAY/TIM backend 범위 불일치, service manifest 조기 활성화, 비정규 role ID, Node 20 audit 실행경로, 중앙 wildcard takeover, unknown path class, duplicate ID, coordinated inventory mutation, source scope repoint, raw source security, critical register 의미 변조, 추가 migration 행 삽입, sanitized-content prompt injection 및 stale 증거 표기를 모두 교정했다. 최종 외부 보고는 독립 감사의 static/live/mutation/sanitizer 무결성 검사가 명시적으로 `PASS`일 때만 허용한다. 기준선이나 snapshot이 변경되면 registry SHA를 자동 추정하지 않고 Integration Control이 변경 근거를 검토한 뒤 `apply_patch`로 갱신하고 다시 검증한다.

## Design AI 후속 의무

각 모듈은 기능 G4 종료 후 전체 메뉴·화면·상태·persona·권한 variant를 포함하는 Design AI 전달 패키지를 `G5A DESIGN_REQUEST_READY`에서 반드시 만든다. editable 원본 수령과 사용자·제품 owner 승인은 `G5B DESIGN_ACCEPTED`, 실제 코드 교체와 기능·권한·접근성·반응형·golden 회귀는 `G5C VISUAL_REPLACEMENT_COMPLETE`로 분리한다. 따라서 프롬프트 패키지만 만든 상태를 모듈 최종 완료로 오인하지 않는다.

## G0 외 후속 차단사항

G0가 닫혀도 운영 메뉴·요소권한 export, DDL, batch/interface 계약, golden data, YEA backend 결정, KR 법정팩과 각 도메인의 물리 DDL·상태기계는 해당 G1/G2 Gate에서 계속 차단한다. 이 보고서를 기능 구현 또는 production 준비 완료 선언으로 사용하지 않는다.
