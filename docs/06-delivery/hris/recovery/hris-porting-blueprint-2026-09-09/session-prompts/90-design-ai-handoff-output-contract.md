# 기능 완료 후 모듈별 전체 화면 Design AI 전달 계약

이 문서는 `output/workplace-design-ai-2026-09-08`의 전달 방식을 HRIS에 적용한 **필수 작업지시서**다. 지금 시안을 만드는 문서가 아니다. 각 모듈이 기능·권한·상태·오류·대사까지 G4를 통과한 뒤, 그 모듈의 실제 전체 메뉴와 화면을 Design AI에 전달할 프롬프트 패키지를 만든다.

`HRIS-HRM`, `HRIS-PER`, `HRIS-PAY`, `HRIS-TIM`, `HRIS-SYS` 세션은 G4 코드 완료만으로 종료할 수 없다. 아래 패키지와 검증된 ZIP까지 만들어 `G5A DESIGN_REQUEST_READY` 판정을 받아야 기능개발 후속 작업이 완료된다. 패키지 전달 뒤 디자인이 아직 반환되지 않았으면 `WAITING_EXTERNAL_DESIGN`으로 보고한다. 이후 사용자가 디자인 파일을 반환하면 `G5B DESIGN_ACCEPTED`, 코드 교체와 회귀까지 끝나면 `G5C VISUAL_REPLACEMENT_COMPLETE`로 전체 모듈을 종료한다.

## 1. 모듈별 필수 디렉터리

각 세션은 날짜를 확정해 독립 패키지를 만든다.

```text
output/hris-hrm-design-ai-YYYY-MM-DD/
output/hris-per-design-ai-YYYY-MM-DD/
output/hris-pay-design-ai-YYYY-MM-DD/
output/hris-tim-design-ai-YYYY-MM-DD/
output/hris-sys-design-ai-YYYY-MM-DD/
```

각 디렉터리와 동일한 이름의 `.zip`을 함께 만든다. 한 개 거대 HRIS 프롬프트로 합치거나 다른 모듈의 화면을 중복 소유하지 않는다. SYS 세션만 공통 DWP HRIS 셸·단일 `/hr/home` widget composition·공통 디자인 계약을 소유하고, 각 도메인 세션은 자기 representative workbench landing/overview와 화면군 및 홈 기여 widget을 소유한다. 통합·검증 task가 용어·메뉴·component·권한의 모듈 간 일관성을 승인한다. 아래 파일명의 `module-home`은 기존 산출물 호환 라벨일 뿐, 비-SYS 모듈에서는 `/hr/home`이 아니라 해당 workbench landing/overview를 뜻한다.

정확한 writer, 폴더, ZIP, 외부 checksum sidecar, detached final verification과 98개 IA node의 모듈별 소유 수량은 `coding-readiness/g5a-design-ai-package-allocation-register.csv`가 정본이다. HRM 24, PER 19, PAY 17, TIM 17, SYS 21개이며 합계는 98이다. G3 시점에는 실제 패키지가 아직 없어야 할 수 있으므로 `validate_g5a_design_ai_packages.py --mode planned`의 `PLANNED_NOT_DUE_AFTER_G4`만 요구한다. 이는 G5A 완료 증거가 아니다.

G5A의 선행 G4는 모듈이 작성한 임의 `PASS` JSON이 아니다. `coding-readiness/validate_g4_functional_gate.py`가 해당 모듈의 active slice 전량, backend/frontend `MODULE_COMMIT`, closed verification catalog의 slice-specific command receipt, aggregate 최종 backend/frontend commit에서 전 slice를 재실행한 `finalHeadVerification`, runbook·telemetry·migration·recovery·acceptance 증거를 검증한 뒤 Integration Control이 `g0/append_g4_functional_gate.py`로 최신 checkpoint prefix와 aggregate SHA를 중앙 append-only register에 기록해야 한다. 패키지의 `evidence/g4-functional-gate.json`은 schema `dwp.hris.g4-functional-gate-evidence.v2`로 그 모듈의 최신 `VERIFIED_G4_FUNCTIONAL_GATE` 행과 exact aggregate를 참조해야 한다. unanchored·stale·다른 모듈·과거 HEAD aggregate는 G5A를 열지 못한다.

## 2. 패키지 필수 구조

```text
package-manifest.json
README.md
00-current-analysis-and-menu-plan.md
01-module-home-current-and-expansion-brief.md
02-design-review-and-implementation-gates.md
03-official-global-patterns.md
04-state-and-validation-matrix.md
05-screen-coverage-register.csv
current-screens/
  module-home-current-1440.png
  module-home-current-390.png
  ...필요한 원본 viewport 캡처
evidence/
  frontend-surface-audit.md
  backend-db-contract-audit.md
  runtime-and-capture-audit.md
  g4-functional-gate.json
  g4-frontend-surface-inventory.csv
  image-ocr-results.json
  package-review.md
  package-verification.json
prompts/
  00-common-design-contract.md
  01-module-home.md
  02-...화면군.md
  NN-...화면군.md
```

디렉터리 밖에는 같은 basename의 `.zip`, `.zip.sha256`, `.zip.verification.json`을 둔다. manifest는 자기 자신을 제외한 디렉터리의 모든 파일 path·size·SHA-256을 봉인하고, sidecar는 ZIP 전체 SHA-256을 봉인한다. ZIP 내부 file member는 디렉터리와 byte-for-byte 같아야 한다. ZIP 자신의 hash를 ZIP 내부에 넣는 순환 구조는 금지하며, archive hash·member parity·최종 검증 결과는 detached `.zip.verification.json`에 기록한다.

Workplace 패키지처럼 README에는 다음을 반드시 제공한다.

1. Design AI에 **처음 전달할 정확한 3개 파일**
2. 함께 첨부할 데스크톱·모바일 현재 화면
3. 그대로 복사해 사용할 **첫 요청문**
4. SYS는 HRIS 홈, 비-SYS는 대표 workbench landing/overview 확정 뒤 진행할 화면군 순서와 각 prompt 링크
5. 화면군당 `주력 시안 1회 + 구조 수정 최대 1회` 원칙
6. 코드·API·DB·테스트가 정본이고 디자인 이미지는 탐색·시각 교체 기준이라는 명시

## 3. 전체 화면 coverage 불변식

“전체 화면”은 SKKF의 raw route 수만큼 시안을 만드는 뜻이 아니다. 구현이 끝난 DWP의 통합 메뉴와 화면군을 기준으로 하되 다음 항목을 하나도 빠뜨리지 않는다.

- 사용자·관리자·업무운영·설정·감사 메뉴 node
- canonical route와 deep link, tab, drawer, dialog, wizard, detail 상태
- bulk/import/export, report, print와 급여명세서·증명서 같은 PDF/document surface
- 화면에서 실행되는 command/query, API/event와 owner
- persona, app entitlement, atomic duty, population/field scope와 SoD
- 정상·loading·empty·filtered-empty·validation·read-only·403·409·stale·partial failure·offline·result unknown
- 생성·수정·승인·게시·마감·재개방·취소·보정·역분개 등 해당 모듈의 상태전이
- 1440/1280/768/390/320px, 200% 확대, keyboard-only, light/dark/high-contrast, reduced motion와 긴 한·영 label

`05-screen-coverage-register.csv`는 최소 다음 열을 가진다.

```text
ia_node_id,menu_node_key,route_contract_key,workbench_tab,surface_key,screen_family,prompt_file,persona,capability_key,
resource_action,population_field_scope,api_or_event,state_variants,returned_frame_id,
target_code_path,acceptance_id,coverage_status,evidence
```

각 행의 `ia_node_id`, menu key, canonical route, workbench tab, persona, capability/API/auth reference는 98-node IA 정본과 정확히 같아야 한다. coverage 고유키는 `ia_node_id` 단독이 아니라 `(ia_node_id,surface_key)`다. 따라서 한 IA node가 page/tab/drawer/dialog/wizard/detail/report/print/PDF/document의 N개 surface를 가질 수 있으며, 각 owner node에는 최소 한 screen-family와 prompt가 있어야 한다. `evidence/g4-frontend-surface-inventory.csv`는 다음 exact header로 G4에서 실제 구현된 surface 집합을 봉인한다.

```text
surface_id,ia_node_id,surface_key,surface_type,canonical_route,target_code_path,source_blob_sha256,implementation_state
```

coverage와 G4 surface inventory의 `(ia_node_id,surface_key)` 집합은 양방향으로 정확히 같아야 한다. `target_code_path`는 해당 세션의 `g3-file-allocation-register.csv` FRONTEND_SOURCE 경로 안에 있어야 하고, manifest에 봉인된 G4 frontend commit의 실제 blob이어야 하며 `source_blob_sha256`도 `git show <commit>:<path>` 결과와 같아야 한다. 가상 경로, 존재하지 않는 경로, 다른 모듈 경로는 실패다. 모든 구현 메뉴와 canonical route는 한 개 이상 화면군 prompt에 배정하되 화면군 통합의 N:M 근거를 남긴다. G5A에서는 `coverage_status=MAPPED_G5A`, 아직 반환되지 않은 `returned_frame_id=PENDING_G5B`로 기록한다. 디자인 반환 후 실제 frame ID로 교체한다. `UNMAPPED`, wrong-module, orphan/duplicate surface, 근거 없는 `N/A`, 프롬프트 없이 캡처만 있는 행이 하나라도 있으면 G5A 실패다.

## 4. 정본과 CURRENT / NEW / EXTERNAL

정본 우선순위는 `실행 코드·API/DB 계약·테스트 → 승인된 IA/권한/상태 계약 → 레거시 업무 근거 → 디자인 결과`다.

| 구분 | 의미 | 디자인 처리 |
|---|---|---|
| `CURRENT` | 해당 모듈 G4에서 실제 구현·검증된 기능 | 기본 시안에 실제 권한·상태대로 표현 |
| `NEW` | 승인된 후속 capability지만 API/DB/운영 계약 또는 구현이 남음 | 별도 확장 frame과 frame 밖 주석; 활성 기능처럼 혼합 금지 |
| `EXTERNAL` | 외부 공급자·법정기관·은행·ERP·타각장비·고객 정책/SLO가 필요 | 외부 의존 frame으로 분리하고 연결 완료로 표현 금지 |

이 표시는 frame 밖 주석이다. 제품 화면에 `CURRENT`, `NEW`, `EXTERNAL`, API path, 환경명, 개발 설명이나 상태 시뮬레이터를 노출하지 않는다. 미구현 버튼, 가짜 AI 추천, 근거 없는 실시간 수치, 권한상 볼 수 없는 정보를 채우지 않는다.

## 5. 공통 디자인 계약에 들어갈 내용

`prompts/00-common-design-contract.md`는 최소 다음을 모듈 실제 구현에서 추출한다.

- DWP 전역 헤더·사이드바·앱 전환·본문 폭·토큰·공통 component 보존
- 부드럽고 편안하며 현대적인 HRIS 경험, 명확한 정보 위계와 다음 행동
- “MZ스럽다”를 과도한 장식·작은 글자·유행색·카드 난립·소비자 앱식 gamification으로 해석하지 않는 원칙
- PAY/TIM/HR 운영자의 고밀도 표·대량 선택·키보드 효율과 엔터프라이즈 신뢰성을 유지하면서 부담을 줄이는 시각 구조
- 데이터 owner, 확정/예상/미완료, 기준일·기간·통화·시간대·정책 version 표시
- 서버 성공 전 확정 표현 금지, idempotency·expected version·409·결과 불명·복구
- 민감정보 최소화·마스킹·step-up·목적·반출·감사와 권한 철회 시 보호정보 제거
- 통합 화면 안에서도 HRM/PER/TIM/PAY/SYS command owner를 바꾸지 않는 원칙
- WCAG 2.2 AA, semantic structure, label/error/focus, 표·차트 대안과 responsive 재배치
- 시안 반환 형식, 클릭 도착점·상태·행동 주석, 왕복 횟수와 금지사항

## 6. 화면군별 prompt 필수 항목

`prompts/01-module-home.md`와 모든 화면군 prompt는 다음 형식을 사용한다.

1. 화면군 이름, 주 persona, 해결할 업무 질문, 주 행동, 화면 유형
2. 실제 메뉴 node·route·tab/dialog와 이전/다음 도착점
3. 실제 조회/명령/API/event, 데이터 owner와 필드 의미
4. 유지할 `CURRENT`, 선택 가능한 `NEW`, `EXTERNAL` 의존
5. 기능 통합 이유와 제거한 레거시 화면/복잡 절차
6. 정상 합성 fixture와 합성임을 표시하는 frame 밖 주석
7. 필수 상태·권한·SoD·민감정보·동시성·오류·복구
8. 1440·390 주 frame과 1280·768·320·200% 배치 규칙
9. keyboard 순서, focus 복귀, live region, chart/table/drag 대안
10. Design AI가 반환할 frame·annotation·component/state 목록
11. 발명하면 안 되는 데이터·버튼·경로·자동화·AI 판단
12. editable 디자인 원본/프로젝트 링크, frame ID/name, component·variant·token, interaction annotation, 사용 asset과 license 목록의 반환 요구

프롬프트는 “예쁘고 MZ스럽게”만 요청하면 실패다. 실제 필드, 상태전이, 권한, 실패와 복구를 시각 구조로 바꿀 수 있을 만큼 구체적이어야 한다.

## 7. 현재 화면 캡처 규칙

- 승인된 로그인·테스트 환경에서 실제 구현 화면을 사용한다.
- 최소 대표 landing(SYS는 HRIS 홈, 비-SYS는 workbench overview)의 1440px와 390px 전체 DWP 셸을 첨부한다.
- 핵심 사용자 화면과 고위험 운영/설정 화면을 대표 캡처한다.
- 긴 화면은 반폭 축소한 합성 이미지가 아니라 동일 viewport의 상단·중간·하단 원본을 분리한다.
- 실제 인사·급여·계좌·주민식별·세무·평가 데이터는 외부 Design AI에 전달하지 않는다. 합성 fixture를 우선하고 승인된 반출정책 아래 비가역 마스킹한 자료만 예외적으로 사용한다.
- 캡처의 상태, 계정 persona/scope, source commit, viewport, 관찰 한계를 `runtime-and-capture-audit.md`에 기록한다.
- empty/no-access 화면을 정상 데이터 화면의 근거로 확대하지 않는다. 합성 정상 예시는 명시적으로 구분한다.
- PNG 안전성은 사람이 적은 `OCR_SCAN=PASS` 문구만 신뢰하지 않는다. `g5a_image_ocr.swift`의 Apple Vision `VNRecognizeTextRequest`를 `ACCURATE`, `en-US|ko-KR`로 매번 다시 실행하고 tool/version/runtime-script SHA-256, 각 입력 PNG SHA-256·width·height, 추출 텍스트 SHA-256, PII/secret finding 수와 결과를 `image-ocr-results.json`에 봉인한다. validator의 fresh OCR 결과와 정확히 같지 않거나 렌더된 PII/secret이 하나라도 발견되면 실패다. 원문 OCR text는 증거에 저장하지 않는다.

## 8. Design AI 진행 순서

1. 처음에는 `공통 디자인 계약 + 대표 landing 설명 + module-home 호환 파일명의 prompt`와 1440/390 캡처만 전달한다.
2. SYS는 HRIS 홈, 비-SYS는 대표 workbench landing/overview의 정보 위계·전역 셸·persona 전환·모바일 방향을 먼저 확정한다.
3. 이후 직원/관리자 업무 → 업무운영 → 설정/감사 순으로 관련 prompt를 화면군 단위로 전달한다.
4. 각 화면군은 주력 시안 1회와 필요한 구조 수정 최대 1회만 사용한다.
5. 메뉴/정보구조·핵심 흐름·파괴적 조치·모바일 구조는 디자인 왕복에서, 토큰·간격·disabled/loading/error 세부·ARIA·실제 바인딩은 코드 적용에서 마감한다.
6. 외형 합의가 데이터 owner·권한·법정·상태 계약의 모순을 덮지 못한다. 모순이 발견되면 계약 Gate로 되돌린다.

README의 첫 요청문은 모듈 실제 명칭으로 다음 틀을 완성해 그대로 복사할 수 있게 제공한다.

> 첨부한 공통 디자인 계약, 현재 구현·메뉴 설명, 대표 landing 프롬프트와 현재 DWP 전체 셸 캡처를 읽고 [SYS이면 단일 HRIS 홈 / 비-SYS이면 모듈 대표 workbench landing·overview]의 주력 시안 하나를 만들어 주세요. [이 모듈의 핵심 업무 질문]을 첫 화면에서 해결하고, 실제 구현된 메뉴·권한·상태·API 의미를 보존해 주세요. 먼저 1440px 데스크톱, 390px 모바일, 대표 partial/error 상태를 제출하고 1280/768/320px·200% 확대의 재배치 규칙을 표시해 주세요. 합성 fixture와 실제 관찰 상태를 구분하고, CURRENT/NEW/EXTERNAL은 frame 밖 주석으로만 표시하세요. 실제 개인정보·미구현 버튼·근거 없는 AI 추천·개발 설명을 화면에 넣지 마세요. 대표 landing 방향을 사용자와 제품 owner가 확인하기 전에는 다른 화면군이나 코드를 만들지 마세요. editable 원본 링크, frame ID/name, component/variant/token, interaction 주석과 asset/license 목록을 함께 반환해 주세요.

## 9. 모듈별 검토·기계 검증

`evidence/package-review.md`에는 최소 frontend UX/접근성, backend/DB/권한·개인정보, HR 도메인/업무, 공식사례의 독립 검토와 지적·반영·재확인을 남긴다. 검토자를 특정 유명 인물이나 외부 회사로 허위 표기하지 않는다.

내부 `evidence/package-verification.json`은 schema `dwp.hris.g5a-design-ai-package-content-verification.v1`, 해당 session, `PASS`, `DETACHED_FINAL_VERIFICATION_REQUIRED`, `WAITING_EXTERNAL_DESIGN`만 기록한다. 순환 hash 없이 ZIP 자체를 검증한 최종 증거는 외부 `.zip.verification.json` schema `dwp.hris.g5a-design-ai-package-final-verification.v1`에 다음을 정확히 기록한다.

- verification UTC 시각, package contract/session/date, `G5A_DESIGN_REQUEST_ONLY_NOT_G5B_G5C_OR_G6` scope, validator path/digest, source backend/frontend commit, G4 evidence refs, IA와 G4 frontend surface inventory path/digest
- Markdown/prompt/menu/route/screen-family 수
- 전체 메뉴/route/surface coverage와 `UNMAPPED`, wrong-module, orphan 수
- 내부 링크·로컬 근거·공식 외부 출처 검사 결과
- 이미지 파일명·width·height·SHA-256와 시각 검토 수, OCR tool/version/input digest/result/evidence artifact hash
- Markdown parser/format tool/version/input digest 결과
- package review 결과와 남은 `PENDING`
- ZIP 파일명·SHA-256·size·checksum sidecar hash·member 수·canonical member digest·member parity·무결성 검사
- 제품 테스트 상태. G5A에서 재실행하지 않았다면 `NOT_RUN_IN_G5A_REUSED_G4_EVIDENCE`와 재사용한 G4 evidence refs를 함께 기록

ZIP을 다시 풀어 파일목록·hash·링크를 확인한다. 프롬프트 수와 메뉴 수가 같을 필요는 없지만 coverage register에서 모든 메뉴·route·상태가 설명돼야 한다.

`package-manifest.json`은 schema `dwp.hris.g5a-design-ai-package-manifest.v1`을 사용한다. module/session/date, G4 backend·frontend commit과 package 내부 G4 evidence, G4 frontend surface inventory path/digest, IA register digest와 owner/mapped/surface/unmapped 수, synthetic-only/PII/secret/OCR 검사, 자기 자신을 제외한 전체 content file hash를 기록한다. 실제 PII·급여·계좌·식별자·평가 정보와 secret/token/key는 선언 여부와 무관하게 금지하며 text/binary scan과 fresh 이미지 OCR이 모두 PASS여야 한다. package review에 `PENDING`이 남거나 공식출처 HTTPS 링크·내부 Markdown 링크가 깨지면 실패다.

검증 명령은 다음처럼 단계별 의미가 다르다.

```bash
# 현재 G3 계획 계약. 미래 package 파일을 요구하거나 G5A 완료를 주장하지 않는다.
python3 coding-readiness/validate_g5a_design_ai_packages.py --mode planned --compact

# validator fail-closed 회귀
python3 coding-readiness/validate_g5a_design_ai_packages.py --self-test --compact

# 해당 모듈이 G4를 실제 통과한 뒤에만 실행한다.
python3 coding-readiness/validate_g5a_design_ai_packages.py --mode post-g4 --module HRIS-HRM --package-date YYYY-MM-DD --compact
```

G4 파일은 모듈 shard writer의 `--phase g4`로 새 파일만 추가한다. aggregate의 exact 경로는 `session-evidence/<module>/g4/gates/<gate-id>/functional-gate-aggregate.json`이며 typed evidence의 하위 assertion artifact는 해당 evidence 파일 디렉터리 기준의 안전한 상대경로를 사용한다. G4 aggregate 자체는 다음 순서로 검증·봉인한다. 첫 명령의 candidate PASS만으로 기능완료를 선언하지 않는다. 두 번째 Control append가 authoritative live G3 Gate와 동일 host semaphore 아래 성공한 뒤, 마지막 명령이 최신 중앙 anchor까지 재검증해야 한다.

```bash
python3 g0/capture_g4_final_head_evidence.py --session HRIS-HRM --repository DWP_BACKEND --gate-id <G4-GATE-ID> --expected-head <FINAL-BACKEND-COMMIT> --compact
python3 g0/capture_g4_final_head_evidence.py --session HRIS-HRM --repository DWP_FRONTEND --gate-id <G4-GATE-ID> --expected-head <FINAL-FRONTEND-COMMIT> --compact
python3 coding-readiness/validate_g4_functional_gate.py --aggregate <module-g4-aggregate.json> --candidate --compact
python3 g0/append_g4_functional_gate.py --aggregate <module-g4-aggregate.json> --compact
python3 coding-readiness/validate_g4_functional_gate.py --aggregate <module-g4-aggregate.json> --compact
```

`post-g4` mode는 required file, exact manifest/final-verification schema, source commit·G4 evidence·surface inventory digest, G3 FE allocation과 실제 commit blob, 전 파일 hash, 민감정보·secret 금지, fresh Apple Vision OCR, 해당 모듈 owner IA node 전량과 N-surface 양방향 closure, `UNMAPPED=0`, wrong-module/orphan/duplicate=0, prompt/evidence 존재, 1440/390 PNG, Markdown·공식출처·review PENDING, ZIP member/content parity와 외부 checksum을 모두 독립 재계산한다. 성공해야만 `DESIGN_REQUEST_READY`이며, 외부 반환 전 상태는 계속 `WAITING_EXTERNAL_DESIGN`이다.

## 10. G5A/G5B/G5C 완료 기준

### G5A — `DESIGN_REQUEST_READY`

- 전체 구현 메뉴·route·하위 surface coverage 100%, `UNMAPPED=0`, orphan=0
- 공통 계약·home brief·home prompt와 전 화면군 prompt 완성
- 사용자·관리자·운영·설정·감사 및 고위험 상태 포함
- 실제 1440/390 셸 캡처와 안전한 합성 fixture
- 독립 리뷰 지적 해소와 verification JSON `PASS`
- ZIP 무결성 `PASS`
- Design AI에 전달한 뒤 반환 전에는 `WAITING_EXTERNAL_DESIGN`; 최종 완료로 표시하지 않음

### G5B — `DESIGN_ACCEPTED`

- Design AI가 editable 원본/프로젝트 링크, frame ID/name, component·variant·token·interaction 주석과 asset/license 목록을 반환
- 사용자와 제품 owner가 SYS의 HRIS 홈 또는 비-SYS 모듈의 대표 workbench landing/overview를 먼저 승인하고 화면군별 채택/수정/보류를 결정
- 화면군당 주력 1회·구조수정 최대 1회의 사용 내역과 미해결 계약을 decision log에 기록
- 반환된 frame이 coverage register에 연결되고 `CURRENT/NEW/EXTERNAL` 오표현과 PII 유출이 없음

### G5C — `VISUAL_REPLACEMENT_COMPLETE`

G5B 뒤에만 코드를 교체한다. 동일 API·route·권한·상태 계약을 유지하고 1440/1280/768/390/320, 200% 확대, keyboard-only, 접근성, 시각·기능·authorization·golden 회귀를 통과해야 최종 시각 적용 완료다. 디자인 파일을 기다리는 동안 G5A를 전체 모듈 완료로 표시하지 않는다.
