# P05 · 내 홈 화면·공유 템플릿·변경 이력

P00 [공통 계약](00-common-contract.md), P04, [개인화 감사](../audits/03-home-personalization-audit.md), [확장 계약](../contracts/widget-extensibility-contract.md)과 함께 전달한다.

## 복사하여 전달할 프롬프트

DWP의 저장 홈 화면과 공유 템플릿·복원 경험을 설계한다. 주 사용자는 개인 구성원, 보조 사용자는 ADMIN.HOME_TEMPLATE MANAGE 권한을 가진 템플릿 관리자다. 질문은 ‘현재 활성화된 화면과 미리 보는 화면을 구분하고, 적용·복원 영향 범위를 확인할 수 있는가?’이다. primary action은 **선택 화면 사용** 또는 **변경 검토 후 적용**. 개인 화면은 list-detail, 템플릿 authoring은 studio, 이력은 비교 inspector다. 개인화 작업 hub 안에 묶고 최상위 메뉴를 늘리지 않는다.

| Frame ID | 반드시 설계할 내용                                                       | 행동과 데이터                                                                                              |
| -------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| H05-01   | 내 홈 화면 목록과 선택 preview. 활성 badge·이름·모드·최근 변경·기기 범위 | 선택은 preview, 활성화는 별도 명령. 현재 최대 10개/이름 80자. 기본/단일 화면 삭제 불가                     |
| H05-02   | 새 화면 만들기. 현재 layout 복제·이름·정책 허용 모드·preview             | 현재 layout에서 생성은 기존 기능. 빈 canvas/다른 모드 생성은 확장 제안. 원천 ACL 이관 안 함                |
| H05-03   | 활성화·삭제·이름 변경·초안 충돌 확인                                     | 현재 inactive 편집은 활성화 필요. 이름 수정 UI는 추가 개발. 현재 default 삭제 비활성 이유 설명             |
| H05-04   | 공유 템플릿 library. 대상·목적·수명·버전·원천 범위·preview               | 게시된 내 대상 template만 적용. 역할만으로 원천 권한이 추가되지 않음. 철회 상태 포함                       |
| H05-05   | 적용 전후 비교. 앱 고정·순서·폭·내용·기기·필수 영역 차이                 | 대상 view 버전과 recipient context 재결합. 미연결 원천/unknown widget 경고, 원천 데이터 snapshot 복사 금지 |
| H05-06   | 관리자 draft→검토→publish/revoke. 대상·영향·이유·기록                    | ADMIN.HOME_TEMPLATE MANAGE만 가능. 개인 적용과 게시 버튼 분리. 원천 게시 권한은 별도                       |
| H05-07   | 이력 목록. revisionNumber·source·날짜·changeSummary와 선택 snapshot      | USER/TEMPLATE/AI/RESTORE/UNDO를 읽기 좋은 label로. 업무 상태 변경 이력으로 명명하지 않음                   |
| H05-08   | 복원 비교. 현재/선택 snapshot·포함 범위·권한 변경·legacy 설명            | layout/config/device 복원. 원천 업무/ACL 복원 아님. legacyLayoutOnly는 config/device 미포함 범위 설명      |
| H05-09   | 409·권한 취소·삭제된 view·미지원 schema/template 버전                    | 초안 보존, 최신 조회와 다시 검토. 미지원 위젯 안전 보존, 중복 명령 방지                                    |
| H05-10   | 390/320 목록→상세 전체 화면, 적용 bar·확인 sheet                         | 뒤로 가면 선택·scroll·focus 복원. 읽기 preview는 문서 scroll                                               |

Classic은 조직 편집 포털, Flow는 개인 실행, 제3모드는 AI 중심이므로 thumbnail 색만 바꾸는 방식으로 구분하지 않는다. 승인된 내 앱은 Classic/Flow에서 그대로 보존한다. 신규 모드의 layout 독립 저장은 서버 schema 확장이 필요하므로 ‘설계 제안’ annotation을 포함한다. appearance focused/balanced/expressive와 experience mode는 별도 표기한다.

현재 서버 계약: HomeView의 viewId/viewKey/surfaceKey/name/isDefault/schemaVersion/layout/version/widgetConfigurations/updatedAt; template의 templateKey/audience/lifecycle/schemaVersion/layout/version/publishedAt; revision의 source/changeSummary/snapshot/layout/config/device. 현재 템플릿은 layout 계약이며 widgetConfigurations/deviceLayouts가 template 객체에 포함됐다고 주장하지 않는다. 확장 snapshot/preset지원은 별도 variant·annotation.

초기 로딩·빈 목록·권한 없음·템플릿 부분 조회 실패·마지막 성공 화면·변경 없음·version 불일치·AI proposal 만료·퇴역 위젯·기기 미호환·활성 view 삭제 방지·명령 수행 중 busy를 모두 만든다. 권한 없는 실제 템플릿 preview에 제목·개수·인물 정보를 넣지 않는다. 원천은 template 적용 후 사용자/tenant 권한으로 다시 fetch한다.

1440/1280/390/320 및 200% 확대, ko/en 80자 이름, light/dark/high contrast/reduced motion, 키보드 Tab·행 선택·inspector 복귀, 44px touch, focus return, 접근 가능한 전후 변경 텍스트를 산출한다. 표를 쓰면 비교를 위한 scope·filter·selection·detail이 함께 있어야 한다. ‘도입률’ 등 실제 데이터가 없는 analytics KPI를 발명하지 않는다.
