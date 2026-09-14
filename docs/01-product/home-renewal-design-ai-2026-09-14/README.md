# DWP 홈·설정·관리콘솔 Design AI 전달 패키지

2026-09-14. 현재 소스와 실제 화면 관찰, 홈/데이터/계정·관리 전문가의 병렬 감사를 바탕으로 작성했다. “확장형 근무공간 예약 구축”의 공통 계약→한 화면군→상태/모바일 검토→원본/네이티브 계약 반영 방식을 적용했다. 현재 단계는 디자인 의뢰 준비이며 제품 구현·설정 변경·배포는 하지 않았다.

## 확정한 방향

| 모드                   | 중심 경험                                                        | 내 앱                      |
| ---------------------- | ---------------------------------------------------------------- | -------------------------- |
| **Classic 전면 개편**  | 조직 소식·필수 확인·지식·조직 안내를 읽고 시작하는 조직 포털     | 첨부한 영역 보존           |
| **Flow 고도화**        | 지금 처리·오늘 시간·응답·내 요청 진척이 연결되는 개인 업무 실행  | 첨부한 영역 보존           |
| **AI Stage 신규 제안** | AI 의도 입력→근거→앱/자료·준비 공간→계획 검토·원본 행동→이어하기 | 별도 혁신적 실행 영역 설계 |

Classic은 기존 배치의 소규모 개선으로 끝내지 않는다. 공통 내 앱을 제외한 첫 화면에서 Flow와 목적·구조·주 행동이 구분돼야 한다. 세 모드 모두 단일 문서 스크롤, 미래 위젯 추가·편집·권한·버전·저장 보기 호환성을 갖춘다. 제3 모드는 대담한 문맥 장면과 직접 조작을 제안하되 AI가 실제 근거와 원본 업무에 연결되는 효용이 중심이다.

## 바로 전달할 첫 요청

첫 화면은 현재 주력인 Flow부터 요청한다. 아래 3개를 디자인 AI에 업로드하거나 본문을 복사한다.

1. [Flow 복사용 합본](ready-to-send/02-flow-home.md): 공통 계약+Flow 상세 프롬프트
2. [현재 분석·전면 개편 계획](00-current-analysis-and-renewal-plan.md)
3. [사용자 승인 내 앱 PNG](assets/approved-my-app-2026-09-14.png)

> 첨부한 DWP 공통 계약과 Flow 상세 프롬프트, 현재 분석, 승인 내 앱 이미지를 읽고 Flow의 주력 디자인을 만들어 주세요. Flow는 ‘지금 무엇을 먼저 처리하고 오늘 무엇을 준비하며 어떤 응답·요청을 추적할까’를 해결하는 개인 업무 실행 경험입니다. 내 앱의 밝은 독립 영역·4그룹·5열×2행·둘째 줄 왼쪽 배치·전체 높이를 유지하고, 본문은 단일 문서 스크롤과 미래 위젯 확장을 고려해 재설계해 주세요. 먼저 지정된 1440px/390px 정상과 부분 소스 실패 프레임, 1280/320px·200% 배치 규칙, 클릭 원본 도착점·키보드·저장/복원/권한 상태를 반환해 주세요. 현재 데이터와 새 계약 필요 기능은 프레임 밖 주석에서 구분하세요. 편집 원본·프레임별 PNG·컴포넌트/토큰·상태/행동 매핑을 함께 제공하세요. 이후 Classic은 조직 포털로 전면 개편하고 AI Stage는 대담한 AI 문맥 실행 모드로 별도 설계할 예정이므로 세 모드를 같은 카드 배치의 색상 차이로 만들지 마세요. 지금은 Flow 화면군부터 완성해 주세요.

## 다음 전달 순서

Flow → Classic → AI Stage를 한 화면군씩 검토한다. 앞 단계 채택 결과를 다음 요청에 붙여 공통 시스템과 차별성을 함께 유지한다. 새 AI Stage를 먼저 탐색하려면 [AI Stage 합본](ready-to-send/03-adaptive-home-concept.md)과 같은 분석·이미지를 전달할 수 있다. 전체 메뉴를 한 번에 생성시키지 않고 아래 화면군으로 확장한다.

| 프롬프트                                                                          | 대상                                                   |
| --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [P00 공통 계약](prompts/00-common-contract.md)                                    | 제품·내 앱·3모드·확장성·AI·source·상태·반환 규격       |
| [P01 Classic](ready-to-send/01-classic-home.md)                                   | 조직 포털 전면 개편                                    |
| [P02 Flow](ready-to-send/02-flow-home.md)                                         | 개인 업무 실행 고도화                                  |
| [P03 AI Stage](ready-to-send/03-adaptive-home-concept.md)                         | 놀라운 AI 중심 신규 모드·문맥 장면·혁신적 앱 영역      |
| [P04 홈 편집·위젯 라이브러리](ready-to-send/04-home-editor-and-widget-library.md) | 검색·미리보기·추가·구성·배치·저장·복원                 |
| [P05 보기·템플릿·이력](ready-to-send/05-home-views-templates-history.md)          | 개인/조직 보기·기기 배치·템플릿 게시/철회·충돌         |
| [P06 표현·기기](ready-to-send/06-home-appearance-and-devices.md)                  | 모드와 폭/밀도 분리·테마·콘텐츠·기기 설정              |
| [P07 계정설정](ready-to-send/07-account-settings.md)                              | 기존 8개 메뉴 전체+신규 관리 시작점 후보               |
| [P08 관리: 경험·홈](ready-to-send/08-admin-home-and-experience.md)                | 기존 6개 메뉴와 위젯/청사진/정책 탭·AI/확장 운영       |
| [P09 관리: ID·플랫폼](ready-to-send/09-admin-identity-and-platform.md)            | 기존 12개 메뉴·역할/특권 하위 작업 공간·위젯 등록 계약 |
| [P10 관리: 연계·거버넌스](ready-to-send/10-admin-integrations-and-governance.md)  | 기존 6개 메뉴+legacy audit·원천/품질/변경 통제 후보    |
| [P11 교차 앱 위젯](ready-to-send/11-cross-app-widget-designs.md)                  | 현재·연결 확장·새 API·외부 콘텐츠 위젯 세부 디자인     |
| [P12 앱별 확장 메뉴](ready-to-send/12-cross-app-expansion-menus.md)               | 18개 앱 각각의 AI 홈 지원 화면·워크플로                |
| [P13 신규 앱 선택안](ready-to-send/13-new-apps-and-ai-workspace.md)               | 작업 캔버스·러닝의 메뉴·데이터·권한·운영               |

`ready-to-send`는 P00과 해당 화면군, 관련 계약을 포함한 독립 복사용 합본이다. 각 화면군 안의 화면 ID별 정상·위험 상태·모바일을 반환하도록 요청한다. 추가 관련 파일 링크는 외부 AI가 로컬 경로로 읽지 못하므로 필요한 파일을 실제 첨부한다. 프롬프트 수나 프레임 수를 신규 최상위 메뉴 수로 해석하지 않는다.

## 감사·계약·원본 반영

- [전문가 종합 분석](00-current-analysis-and-renewal-plan.md), [홈 경험 감사](audits/01-home-experience-audit.md), [위젯·데이터 감사](audits/02-widget-data-audit.md), [홈 개인화 감사](audits/03-home-personalization-audit.md), [계정·관리 감사](audits/04-account-admin-audit.md)
- [계정·관리 메뉴 전체 인벤토리](contracts/account-admin-menu-inventory.md), [위젯 source 매트릭스](contracts/widget-source-matrix.md), [미래 위젯 확장 계약](contracts/widget-extensibility-contract.md), [앱별 확장·신규 앱·AI 경계](contracts/app-expansion-and-new-app-plan.md)
- [화면 전달 레지스트리](contracts/screen-delivery-registry.md), [소스 스냅샷](contracts/source-snapshot.json), [패키지 검증](contracts/package-verification.json)
- [전달·반환·100% 원본 반영 추적 기준](02-design-delivery-and-acceptance.md)

사용자가 디자인 파일을 반환하면 채택 원본의 프레임·상태·행동과 실제 source/permission/API를 연결해 반영한다. 현재 AI 계획 preview의 REVIEW/reference-only 상태는 자동 실행이 아니다. 새 홈 origin·문맥·앱·위젯 계약은 디자인과 함께 실제 구현해야 한다. 현재 문서에 과거 다른 프로젝트의 완료/테스트 수치를 새 검증으로 사용하지 않았다.
