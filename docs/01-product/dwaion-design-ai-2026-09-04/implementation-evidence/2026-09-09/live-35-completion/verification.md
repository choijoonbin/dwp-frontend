# DWAI·ON Live Stitch 35개 프레임 기존 완료 판정 철회 · 2026-09-09

> **정정 상태: RETRACTED / 재검증 진행 중**
>
> 아래의 기존 `구현 완료` 판정은 철회한다. 당시 실행한 route·접근성·반응형 E2E가
> 통과했다는 사실만으로 각 화면이 Stitch 원본과 시각적으로 일치한다고 판단했으며,
> `AI 제안함`, `제안 검토`, `내 대화` 등에서 실제 원본과 다른 정보 계층·여백·상세
> 상호작용을 놓쳤다. 따라서 `280/280`, `36/36` 같은 자동화 통과 수치는 화면별 디자인
> 수용의 증거로 사용할 수 없다. U01–U10, X01–X03, A01–A08 각각에 대해 Stitch 원본과
> 동일 크기의 before/after 캡처, 실제 API·권한·상태 전이 검증, 1440/1280/390/320px 및
> 200% 확대 검증을 다시 완료하기 전에는 DWAI·ON 전체를 완료로 표시하지 않는다.

재검증의 화면별 상태와 엄격 판정 기준은
[Stitch 재검증 원장](../stitch-remediation-ledger.md)에서 관리한다.

## 철회된 기존 판단

아래 문단과 수치는 2026-09-09 재검증 이전의 기록이다. 화면별 디자인 일치 여부를 입증하지
못했으므로 더 이상 완료 근거로 사용하지 않는다.

~~Live Stitch에서 전달된 35개 프레임의 화면 구조, 제품의 18개 메뉴, 대화 답변·제안 상세·
전역 도우미를 포함한 3개 문맥 화면, 그리고 현재 서버 계약이 안전하게 지원하는 사용자 기능은
구현 완료로 판단한다. 모든 메뉴는 실제 route와 권한 경계에 연결되어 있고, fixture에만 존재하는
핵심 endpoint는 없다.~~

이 판단은 운영 공급자와 외부 실행기가 준비된 production 운영 완료를 뜻하지 않는다. Stitch
공통 계약도 시안에 기능이 있다는 이유만으로 개발·보안 완료를 선언하지 않도록 요구한다.
따라서 아래의 코드 범위와 운영 조건을 분리해 기록한다.

## 디자인 정본과 화면 대응

- Live 프로젝트: [DWAI·ON Stitch](https://stitch.withgoogle.com/projects/13391261371843159731)
- 핵심 export: U01–U10, X01–X03, A01–A08의 반응형·실패 변형 32개 프레임.
- export 무결성: HTML 32개와 PNG 32개, 총 64개 파일의 SHA-256 불일치 **0건**.
- 교차 제품 3개:
  - WRK-A01 `941feb59256e4dc79f0586cd40f80618`
  - DWAI·ON Activity desktop `aeaa8d7c29584294870c5e6d77983f10`
  - DWAI·ON Activity mobile `038415e19b844e319754f2f8e46619ec`
- 화면별 route·구현·API·상태 대응은 [수용 기록](../../../06-screen-acceptance-2026-09-08.md)과
  [구현 원장](../../../03-stitch-implementation-matrix.md)에 고정했다.
- [검증 영수증](verification-receipt.json)과 [Stitch export manifest](stitch-export-manifest.json)가
  프레임 수, 원본 해시, 실행 결과를 보존한다.

## 최신 구현에서 닫은 실제 누락

### 새 대화·내 대화 너비

두 화면에만 있던 `maxWidth: 1480`과 자동 좌우 마진을 제거했다. 이제 공통 `PageCanvas`의
반응형 패딩만 사용한다. 1920px 실제 브라우저에서 두 화면 모두 canvas **1672px**, 제품 root
**1608px**, 좌우 거터 각각 **32px**로 측정됐고 경계 오차 허용값 1.5px를 만족했다.

- [새 대화 1920px](new-conversation-1920.png)
- [내 대화 1920px](my-conversations-1920.png)
- [폭 계약 보고서](spacing-2-report.json) — **2/2 PASS**

### 대화 답변에서 결과물 만들기

U03의 근거 있는 답변에서 X03 결과물을 만드는 동작을 추가했다. 사용자는
`ARTIFACTS:VIEW`와 `ARTIFACTS:CREATE` 권한이 있을 때만 결과물 저장을 실행할 수 있다.
frontend는 대화 ID와 assistant message ID, 저장 답변과 같은 본문을 전송하고 결과물의 opaque
UUID로 이동한다.

Agent 서버는 현재 tenant·user 범위의 대화와 정확한 assistant message를 다시 조회한다.
grounded 상태, 비어 있지 않은 인용, 제출 본문과 저장 답변의 완전 일치를 확인한 뒤에만 출처
참조를 서버에서 만든다. client가 임의 `sources`와 `sourceConversation`을 함께 보내는 요청은
거부한다. 결과물 출처 상태는 계속 `UNVERIFIED`, 최신성은 `UNKNOWN`이므로 이 결속을 connector
진위 검증으로 과장하지 않는다.

- [데스크톱 결과](answer-artifact-desktop.png)
- [모바일 결과](answer-artifact-mobile.png)
- 전체 280건 보고서에 `dwaion-answer-artifact.spec.ts` 5개 case와 접근 재검증이 포함된다.

## 최신 검증 결과

아래 실행은 서로 범위가 겹친다. 수치를 하나의 총합으로 더하지 않는다.

| 범위                                             | 결과                                                 | 보존 보고서                                                      |
| ------------------------------------------------ | ---------------------------------------------------- | ---------------------------------------------------------------- |
| 현재 DWAI·ON 19개 E2E spec                       | **280/280 PASS**, 실패·skip·flaky·retry 0            | [dwaion-current-280-report.json](dwaion-current-280-report.json) |
| 18개 메뉴 × desktop/mobile                       | **36/36 PASS**, 실패·skip·flaky 0                    | [menu-36-report.json](menu-36-report.json)                       |
| 새 대화·내 대화 1920px 공통 폭                   | **2/2 PASS**                                         | [spacing-2-report.json](spacing-2-report.json)                   |
| WRK-A01 1440·1280·390·320·200% reflow            | **5/5 PASS**                                         | [work-cross-5-report.json](work-cross-5-report.json)             |
| Activity light·dark·forced colors·200% root text | **4/4 PASS**; 각 profile에서 1440·1280·390·320 검사  | [activity-quality-4-report.json](activity-quality-4-report.json) |
| DWAI frontend 집중 단위                          | **20 files / 114 tests PASS**                        | 실행 영수증에 기록                                               |
| 현재 production bundle·budget                    | **PASS**; 5,200 modules, initial 1,063.4/1,074.2 KiB | [bundle 결과](frontend-bundle-check.result.json)                 |
| Agent 대화 출처 결속 집중                        | **10/10 PASS**                                       | [Agent 검증](agent-verification.json)                            |
| Agent 관련 API                                   | **27/27 PASS**                                       | [Agent 검증](agent-verification.json)                            |
| Agent clean PostgreSQL 전체                      | **472/472 PASS**                                     | [Agent 검증](agent-verification.json)                            |
| Platform DWAI 개인 기능 권한 migration           | **2/2 PASS**                                         | Gradle XML 결과 확인                                             |

현재 frontend 전체 [non-incremental TypeScript](frontend-typecheck.result.json), 대상
ESLint·Prettier, Agent OpenAPI 동기화,
production source-size 1,940개 파일, frontend·Agent diff check, Agent `compileall`이 모두
통과했다. 최신 DWAI UI·assistant·Agent API non-test 인벤토리는 **117개 파일**, 최대 **491줄**이며
모두 500줄 미만이다. [현재 소스 인벤토리](dwaion-current-source-inventory.json)가 경로와 SHA-256을
보존한다.

Activity의 최신 4개 품질 profile은 root font 200% 확대를 포함한다. 환경 변수로만 활성화되는
native browser zoom extension case는 이 최신 4개 보고서에 포함하지 않았으며, 실행하지 않은
case를 PASS로 기록하지 않는다.

## 완료 판단에 포함하지 않는 운영 조건

다음 기능은 코드가 존재하는 것과 운영 환경에서 실제로 수행 가능한 것이 다르다. 필요한 계약과
공급자 증거가 없는 환경에서는 화면도 성공·활성 상태를 표시하지 않는다.

- 운영 모델과 STT/TTS 공급자 설정·자격 증명·가용성.
- managed KMS와 production owner 승인 증거.
- durable scheduler, delegated token 교환, 예산 집행, 알림·제안 전달 worker 및 외부 쓰기.
- connector source 진위·최신성·ACL 검증기와 조직 DLP.
- 팀·수신자 공유, 공동 편집·복원, 실제 파일 생성·download worker.
- 승인된 물리 삭제·backup/crypto-shred 실행과 완료 증거.
- 독립 승인자, 자동 Gate 진단, 서명된 운영 증거 G01–G13.
- 소유 서비스 mutation 계약이 없는 WRK-A01의 Work 폼 직접 적용.
- 실측 계약이 없는 Activity의 고정 health·추론 수치·가상 운영 명령.

이 조건들은 현재 안전 제품 범위의 누락으로 숨긴 항목이 아니다. UI와 API는 요청 영수증,
검토 인계, 미연결·미검증 상태를 사실 그대로 표현한다. 커밋·푸시·운영 배포는 이 검증에서
수행하지 않았다.
