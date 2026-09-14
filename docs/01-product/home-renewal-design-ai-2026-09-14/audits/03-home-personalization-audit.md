# 홈 개인화·설정 전문가 감사

읽기 기준 2026-09-14 `8b9975e4e69a80e653618beae71305e91dd0d969` + 현재 작업 트리. 새 메뉴/API는 제안이며 제품에 추가하지 않았다.

## 실제 기능 inventory

| 현재 기능             | 이미 있는 동작과 제약                                                                                                            | 리뉴얼/추가 필요 부분                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 홈 편집 `/?edit=home` | appLayout/widgets/presentation, 순서·숨김·폭·콘텐츠 깊이·gallery, 저장·취소·초기화, 초안 이탈 보호                               | 캔버스+inspector·변경 요약·키보드/터치 이동 대안. 모드별 독립 저장은 신규 계약                                      |
| gallery               | 숨긴 기존 등록 위젯을 추가하는 dialog, lifecycle/허용 크기                                                                       | 전체 라이브러리 검색·분류·추천 근거·preview·권한/연결 사유는 확장 UX/API. 외부 앱 설치처럼 표현하지 않음            |
| Studio profiles       | 현재 layout에서 이름 80자/최대 10개 화면 생성, 선택·활성화·활성 화면 편집·삭제. 기본/단일 화면 삭제 제한                         | 목록+preview inspector, 선택과 활성화 분리. 모드별 호환은 후속 계약                                                 |
| Studio appearance     | focused/balanced/expressive 선택과 즉시 저장. 방향키/Home/End radio 키보드                                                       | 외형 3종과 Classic/Flow/제3모드 구분. 폭·밀도·강조의 실제 preview                                                   |
| Studio content        | 위젯 선택+보이는 행 1/2/3 저장. 계약은 sourceKey/fieldKeys/filterPresets/itemLimit 1–20이며 현재 필드/필터 picker는 미노출       | 원천·범위·행 budget과 연결된 preview. 등록 필드/필터 UI는 추가 개발, 임의 source binding 금지                       |
| Studio device         | DESKTOP/MOBILE overlay, comfortable/compact 밀도, desktop Flow section 허용 폭. widgetOrder 계약은 있으나 현재 순서 편집 UI 없음 | 실제 viewport preview, mobile 순서 편집 UX 추가. desktop을 덮어쓰지 않는 저장 범위                                  |
| Studio templates      | 목록·적용. ADMIN.HOME_TEMPLATE MANAGE만 draft/publish/revoke. audience/lifecycle/version                                         | 사용자 공유 템플릿과 관리자 운영 분리. 적용 전 차이·필수 영역·수신자 원천 권한 preview                              |
| Studio history        | revision 목록·source·changeSummary·날짜·확인 후 복원. snapshot은 layout/config/device, legacyLayoutOnly 호환                     | 비교·복원 범위·권한 재평가 preview 추가. 업무 상태를 복원하지 않음                                                  |
| Studio AI             | FOCUS_DEADLINES/BALANCE_DAY/REDUCE_NOISE 규칙 변경안, server proposal preview/apply/undo, fixed zone 제한/noop/feature gate      | 근거·경고·만료·전후 차이. 자연어 ‘AI 홈 설계’는 신규 API/UI 필요                                                    |
| 충돌·저장             | 홈 저장 409는 최신 재조회·충돌 대상·reload/rebase, Studio 409는 toast+view invalidate. version/idempotency command               | 통일된 최신/초안 preview와 다시 검토. 묵시적 overwrite 금지                                                         |
| 초안·focus            | editEntryFocusRef/scrollRef, 취소 후 scroll 복원, overlay/navigation/beforeunload 보호, busy                                     | dialog Escape·focus return·scroll restore·연속 overlay 보존. dialog 작업 scroll 허용, 읽기 홈 위젯 내부 scroll 금지 |

## 날카로운 문제

조직 experience·개인 appearance·저장 화면·기기 overlay·content budget은 적용 범위가 다른데 스타일 선택처럼 섞여 보일 수 있다. 특히 Classic/Flow 저장 alias는 의미가 달라 ‘브리프’ 설정이 ‘답변 허브’ 설정으로 보이는 문제가 있다. 새 mode 토글만 추가해서는 독립 개인화가 성립하지 않는다.

content의 현재 UI 행 선택과 API의 필드/필터 능력, gallery의 ‘숨긴 7개 복원’과 미래 library의 ‘등록 전체 탐색’을 구분해야 한다. 관리자 template 게시/철회는 개인 화면 적용보다 영향이 커서 다른 권한과 작업 경로로 설계한다. 원천 게시 권한은 template 관리 권한으로 생기지 않는다.

## 메뉴 구성 제안

새 최상위 메뉴를 남발하지 않는다. 홈 편집의 ‘위젯 라이브러리’와 기존 Studio의 작업별 hub 안에 통합한다. 계정설정 전체는 별도 프롬프트에 포함한다.

| 소유        | 기존 진입/리뉴얼 이름               | 현재/신규 구분                                               | 프롬프트           |
| ----------- | ----------------------------------- | ------------------------------------------------------------ | ------------------ |
| 개인        | 홈 편집·위젯 라이브러리·정보 표시   | editor/gallery/content 현재, 검색·추천·등록 필드 picker 확장 | P04                |
| 개인        | 내 홈 화면·공유 템플릿·변경 이력    | Studio 현재, 차이 preview 확장                               | P05                |
| 개인        | 홈 모양·기기별 홈·내 연결 상태      | appearance/device 현재, 원천 상태/preview 정책 확장          | P06/P11            |
| 개인        | 추천·AI 편집 제안                   | 규칙 proposal 현재, 자연어 신규                              | P04                |
| 중앙 관리자 | 홈 경험·조직 정책·template·catalog  | 기존 홈 관리 리뉴얼, 새 모드/rollout/등록 계약 확장          | 중앙 관리 프롬프트 |
| 원천 관리자 | 기존 각 앱 운영 메뉴의 홈 기여 영역 | 원천 운영 현재, 홈 기여 preview 확장                         | P11                |

이번 Classic은 내 앱만 보존하고 조직 편집 포털로 전면 개편한다. Flow는 개인 실행 중심을 명확히 한다. 이전 배치 순서를 이번 두 모드의 공통 사용자 승인이라고 주장하지 않는다.

## acceptance

- 승인된 내 앱의 아이콘·카테고리·좌측 연속 정렬을 보존한다. 권한 없는 icon을 채워 넣지 않는다.
- 표준/와이드의 실제 preview·읽기 layout 차이와 저장·복원·반응형 경계를 검증한다. 폭과 콘텐츠 깊이를 구분한다.
- mutation version·idempotency·busy·저장 실패·409·reset·revision 범위를 유지한다. 성공 전에 saved badge를 표시하지 않는다.
- 모드별 독립 저장은 신규 서버 계약이다. 다른 view/device/mode 값을 무심코 덮어쓰지 않는다.
- 복원은 layout/config/device 범위이며 원천 task/status/ACL을 복원하지 않는다. legacy 부분 snapshot은 포함 범위를 설명한다.
- 1440/1280/390/320/200%, ko/en 긴 label, light/dark/high contrast/reduced motion/keyboard/touch/focus return과 권한 취소·원천 실패·연결 필요·offline·noop·expired proposal를 포함한다.

근거: `apps/dwp/src/features/home-personalization/*`, `apps/dwp/src/pages/home.tsx`, `apps/dwp/src/components/workspace-composer/*`, shared-utils `home-personalization-api.ts/home-preference-api.ts`.
