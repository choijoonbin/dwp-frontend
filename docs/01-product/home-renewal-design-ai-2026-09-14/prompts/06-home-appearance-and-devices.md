# P06 · 홈 모양·기기별 홈·정보 가시성

P00 [공통 계약](00-common-contract.md), P04/P05, [개인화 감사](../audits/03-home-personalization-audit.md), [원천 매트릭스](../contracts/widget-source-matrix.md)와 함께 전달한다.

## 복사하여 전달할 프롬프트

DWP 개인 홈의 모양과 기기별 구성을 설계한다. 주 사용자는 사무실 desktop과 이동 중 mobile을 번갈아 쓰는 구성원이다. 질문은 ‘바뀌는 것이 경험 모드인가, 모양인가, 특정 기기의 배치인가? 적용 결과를 저장 전에 볼 수 있는가?’이다. primary action은 **내 화면에 적용**, page archetype은 단순 focus form과 연결된 preview다. 설정 항목을 과도한 카드 중첩으로 나누지 않는다.

| Frame ID | 화면                                            | control·현재/제안 구분                                                                                                  |
| -------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| H06-01   | 선택 홈 화면과 적용 범위 header+큰 실제 preview | view 활성/선택 구분, Classic/Flow/AI 모드 정책·가용성. 모드 독립 선택은 신규 계약                                       |
| H06-02   | 홈 모양 3종                                     | focused/balanced/expressive는 현재 appearance. 높이·표준/와이드·내용 깊이·강조 변화 preview. 모드처럼 label하지 않음    |
| H06-03   | 기기별 overlay                                  | DESKTOP/MOBILE, comfortable/compact, desktop 위젯 허용 폭. 현재 UI 제약과 base/override 차이                            |
| H06-04   | 1440/1280/390/320 preview+200%                  | 실제 위젯 수·행 수·마감 내용, 앱 category 좌측 정렬, 문서 scroll. 축소 thumbnail만 보여주지 않음                        |
| H06-05   | mobile 순서+허용 위젯 호환                      | overlay.widgetOrder 계약이 있지만 현재 편집 UI 미노출→추가 UI 제안. desktop 순서·폭을 덮어쓰지 않음                     |
| H06-06   | 홈 정보 preview/privacy 정책                    | sensitive count/title/hidden 선택은 서버 정책보다 강화만 가능. 신규 개인 설정 계약. 권한 없이 실제 preview 금지         |
| H06-07   | 내 원천 연결 상태 inspector                     | 마지막 조회/원천 갱신·허용 범위·연결 필요/지연/권한 취소·재시도→해당 앱 내 연결 설정. 사용자 조회와 중앙 운영 상태 구분 |
| H06-08   | 저장 중/성공/실패/409/초기화 확인               | 변경 범위·다른 기기 영향·초안 유지. 성공 전 saved badge 금지                                                            |

승인된 내 앱은 Classic/Flow에서 동일하게 보존한다. 네 카테고리 안에서 앱을 균등 분산하지 않는다. 업무 시작은 5개 연속, 협업은 5+2개(둘째 행 첫 두 열), 구성원은 2개를 붙이고 시스템은 4개 연속으로 배치한다. 모바일은 의미 있는 순서와 label을 유지하며 터치 가능한 반응형 줄바꿈을 만든다. 제3모드의 독립 내 앱 실험은 별도 프롬프트의 variant만 따른다.

표준/와이드 선택은 실제 layout span이 바뀌어야 한다. 읽기 모드의 adaptive layout과 저장된 사용자 span을 혼동하지 않는다. 폭과 콘텐츠 깊이를 분리한다. 깊이는 1/2/3행 정보 budget이며 고정 높이의 빈 카드나 내부 스크롤을 추가하지 않는다. 200%/320px는 단일 열을 우선하고 가로 overflow를 금지한다.

현재 device overlay는 widgetOrder/widgetSizes/density와 version/viewVersion/updatedAt을 가진다. mobile 저장에서 desktop 폭 override를 보존하는 코드가 있다. 현재 appearance 변경은 즉시 mutation 저장이다. 연결된 preview→적용 흐름으로 바꾸는 안은 UX 개발 변경임을 annotation한다. 계정 전체 theme(light/dark/system)와 홈 appearance·experience는 별도 범위로 설명한다. 새로운 theme·움직이는 배경·AI personality를 이미 있는 설정처럼 묘사하지 않는다.

초기 로딩·정상 데이터·진짜 빈값·부분 실패·오래된 데이터·연결 필요·권한 취소·기기 미호환·unknown widget·409를 표현한다. 마지막 성공 시각은 홈 한 곳에, 원천 예외는 inspector에 표시한다. 권한 정책 갱신 시각은 조회 시각과 의미가 달라 다른 label을 붙인다. query 성공 시각을 실시간 원천 생성 시각으로 표시하지 않는다.

ko/en 긴 label, light/dark/high contrast, reduced motion, 키보드 radio 방향키/Home/End, visible focus, 44px 터치, dialog/sheet의 focus trap·Escape·return, 텍스트 등가 preview를 산출한다. motion은 선택한 control에 따라 layout이 바뀌는 원인을 설명하며 계속 움직이는 장식은 사용하지 않는다. 실제 preview·설정 범위·저장 후 복원·reset·409·권한 변경을 디자인 파일에서 모두 설명해야 한다.
