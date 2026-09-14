# DWP 독립 전달 합본 — P12

공통 계약 → 이번 화면군 → 참고 계약 순서로 읽는다. 화면군 지시의 모든 지정 화면을 반환한다. 승인 내 앱 PNG는 별도 첨부한다. 아래 참고 계약 본문은 이미 포함했으며 외부 AI가 로컬 링크를 읽을 수 있다고 가정하지 않는다.

---

# P00 — DWP 홈·개인화·계정설정·관리콘솔 공통 디자인 계약

당신은 기업용 Digital Workplace의 수석 프로덕트 디자이너다. DWP의 얼굴인 홈과 연결된 개인화·계정설정·관리콘솔을 실제 업무가 잘 보이고 행동이 분명한 제품으로 설계하라. 결과물은 편집 가능한 디자인 원본, 화면별 내보내기, 상태·행동·데이터 주석이다. 지금 제품 코드를 작성하거나 운영 설정을 변경하지 않는다. 이 계약과 함께 전달되는 화면군 프롬프트를 모두 적용한다.

## 1. 제품과 사용자

DWP는 업무, DWAI·ON, 활동, 전자결재, 알림, 소식, 캘린더, 메일, Space, 근무공간, 메신저, 화상회의, 서비스, 인사, 지식, ERP, 레거시, 관리 앱을 연결하는 기업 업무 공간이다. 홈페이지 자체가 모든 앱의 업무를 복제하지 않는다. 사용자는 구성원, 요청자, 승인자, 팀 리더, 지원 담당자, 관리자이며 실제 권한과 업무가 겹칠 수 있다. 역할을 선택하면 가짜 업무가 생성되는 시뮬레이터를 제품 화면에 넣지 않는다.

홈의 핵심 질문은 “지금 무엇을 먼저 처리해야 하고, 오늘 어떤 약속이 있으며, 내가 요청한 일은 어디까지 진행됐는가?”다. 계정설정은 “내 업무 환경과 개인정보를 어떻게 이해하고 통제하는가?”, 관리콘솔은 “누구에게 무엇을 어떤 정책으로 제공하며 변경이 실제로 어떻게 적용되는가?”다. 각 화면은 사용자·질문·주 행동·화면 유형을 먼저 결정한 뒤 구성한다.

## 2. 반드시 보존할 내 앱

첨부한 `approved-my-app-2026-09-14.png`는 사용자가 명시적으로 선호한 디자인 기준이다. **Classic과 Flow 모두 이 밝은 독립 내 앱 영역을 유지한다.** 4개 그룹, 색상으로 구분한 익숙한 앱 아이콘과 이름, 배지, 허용된 관리 진입, 모든 앱 링크를 보존한다.

| 그룹            | 첫째 줄: 왼쪽부터                        | 둘째 줄: 왼쪽부터 |
| --------------- | ---------------------------------------- | ----------------- |
| 업무 시작       | 업무 / DWAI·ON / 활동 / 전자결재 / 알림  | 비워 둔 승인 공간 |
| 소통과 협업     | 소식 / 캘린더 / 메일 / Space / 근무 공간 | 메신저 / 화상회의 |
| 구성원과 서비스 | 서비스 / 인사                            | 비워 둔 승인 공간 |
| 시스템과 통제   | 지식 / ERP / 레거시 / 관리               | 비워 둔 승인 공간 |

데스크톱의 그룹별 5열×2행과 둘째 줄 왼쪽 정렬, 전체 높이·여유는 의도된 기준이다. 빈 공간을 결함으로 간주해 그룹마다 높이를 줄이거나 아이콘을 중앙으로 흩뜨리지 않는다. 데이터·권한·사용자 저장 순서가 달라질 때에는 실제 목록을 따른다. 모드 전환으로 앱을 재정렬하지 않는다. 관리 배지는 일반 앱 진입과 구분하고 권한 없는 사용자에게 표시하지 않는다. 좁은 화면과 확대에서는 읽을 수 있는 크기로 그룹을 순차 재배치하고 항목 순서·이름·배지 의미를 보존한다. 사진 위 투명 유리 패널로 바꾸지 않는다.

혁신적인 앱 실행 영역은 **제3 모드 Adaptive Home 제안에만** 설계한다. 이 이름은 가칭이며 현행 제품 모드가 아니다. 익숙한 앱 그룹 전체로 돌아가는 경로, 고정한 앱, 키보드·터치 대안을 갖춘 별도 선택안이다. 자동 추천으로 사용자 저장 순서를 덮어쓰지 않는다.

## 3. 세 모드와 개인화의 관계

| 대상                     | 설계 의도                                                                                | 보존과 차이                                                |
| ------------------------ | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Classic 전면 개편        | 조직 소식·필수 확인·지식·조직 안내를 편집형 조직 포털로 파악                             | 승인 내 앱만 보존; 현재 Classic 외형·배치는 전면 재설계    |
| Flow 리뉴얼              | 우선 처리 → 오늘의 시간 → 응답과 요청 추적의 업무 흐름                                   | 승인 내 앱 유지; 중복 업무 요약과 동일 높이 타일 반복 개선 |
| Adaptive / AI Stage 제안 | AI가 사용자 의도와 실제 근거를 연결해 앱·자료·준비·다음 행동을 구성하는 역동적 작업 공간 | 별도 확장 모드; 문맥/장면 변경은 명시적이고 예측 가능      |

경험 모드, 본문 폭·밀도, 위젯 보기·저장 순서, 테마, 기기별 환경은 서로 다른 설정 축이다. Classic/Flow를 단순히 같은 화면의 색상 차이로 만들지 않는다. 반대로 화면 폭이나 밀도 변경을 새 제품 모드로 취급하지 않는다. 현재 두 모드는 일부 저장 위젯 키를 다른 의미로 해석하므로 새 독립 설정·제3 모드에는 버전과 이관 계약이 필요하다. 시안은 사용자 레이아웃 보존, 이전 보기 복원, 이관 충돌 상태를 포함한다. 기술 키를 사용자 화면에 노출하지 않는다.

사용자는 현재 Classic의 문제가 많아 그대로 사용할 수 없다고 명시했다. Classic은 기존 구조를 조금 꾸미는 작업이 아니라 전면 개편이다. 공통 내 앱을 제외한 첫 화면에서 Classic은 조직 편집 콘텐츠의 위계·주 행동, Flow는 개인 업무 실행의 위계·주 행동이 명확히 다르게 보여야 한다. 두 모드를 같은 타일 목록에 제목만 바꿔 제출하지 않는다. 모드 선택은 이름·목적 한 줄·실제 화면 미리보기·내 보기 보존 여부·적용 조건을 제공한다. 비교 주석에는 첫 viewport의 질문과 대표 클릭 흐름을 나란히 설명한다.

## 3A. 아직 존재하지 않는 위젯도 수용하는 확장성

현재 위젯 목록을 완성된 고정 목록으로 간주하지 않는다. 홈을 알 수 없는 미래 위젯이 추가될 수 있는 구성 플랫폼으로 설계한다. 새 위젯은 안정된 식별자·버전·허용 모드·크기·정보량·owner·permission·설정 schema·상태·업데이트 정책·접근성·deeplink 계약을 갖고 카탈로그에 등록된다. 등록·검증·시범 적용·게시·철회는 기존 관리자 위젯/홈 구성 흐름에 묶는다. 개인 사용자는 검색·앱/목적/지원 크기/사용 가능 필터, 실제 내용 미리보기, 필요한 권한과 미연결 안내, 추가·구성·배치·되돌리기·저장을 완료할 수 있어야 한다.

모드에 맞는 편집형 섹션·실행 목록·시간 흐름 등 여러 표현 유형을 허용하고 모든 미래 위젯을 동일 카드에 강제하지 않는다. 크기별 요약 개수와 긴 제목·empty·partial·stale 표현을 명세한다. 위젯 수가 늘어도 문서 스크롤과 배치 안정성을 유지한다. 중복 정보는 사용자에게 설명하고 동일 데이터 조회는 공유할 수 있도록 계약한다. 과도한 첫 화면 일괄 로딩·다수 폴링·느린 위젯 하나로 전체 홈 차단을 피하는 갱신/지연 로딩 규칙을 프레임 밖에 제시한다.

설치되지 않은 위젯, 더 이상 지원되지 않는 버전, 철회된 위젯, 권한 변경, 설정 schema 변경, 지원하지 않는 모드·기기에서도 저장한 보기 전체를 잃지 않는다. 대체·업데이트·안전한 제거·원본 복원 경로를 제공한다. 개인 배치와 조직 필수 콘텐츠의 우선순위를 설명하고 신규 위젯 추가가 기존 사용자의 홈을 조용히 재배열하지 않게 한다. 정확한 이관·성능 구현은 반환 디자인을 받는 단계에서 시스템 계약으로 보완한다.

## 4. 시각·공간·움직임

DWP 기존 전역 헤더·탐색·앱 전환·검색·알림·계정·DWAI·ON 진입의 책임을 유지한다. 본문에 또 다른 전역 검색·알림함을 중복 생성하지 않는다. **AI Stage에서는 기존 DWAI·ON의 대화·근거·제안을 재사용한 의도 입력/작업 공간을 홈의 중심으로 설계한다.** 별도 AI 엔진·대화 이력을 복제하는 의미가 아니다. Classic/Flow에는 같은 AI 대화 패널을 기계적으로 반복하지 않는다. 홈에 익숙한 앱 실행과 업무 우선순위가 드러나야 한다. 큰 환영 배너, 스톡 사진, 근거 없는 KPI 행, 모든 정보를 같은 타일로 만드는 구성은 피한다.

MUI 기반 DWP 디자인 시스템과 Lucide 아이콘을 전제로 한다. 색은 중립 표면·주 행동·상태·범주 역할로 지정하고 light/dark에서 같은 의미를 가진다. 기존 토큰의 neutral/product/status/data 색, compact/control/surface radius, spacing, compact/standard/comfortable density, UI/mono font 역할에 매핑 가능한 스타일 표를 반환한다. 새 브랜드·폰트·프레임워크를 전제로 만들지 않는다. 승인 앱 아이콘의 정체성은 보존한다. 글자·선·아이콘은 대비를 갖추며 본문 14~~16px, 보조 12~~14px를 기본 설계 목표로 삼고 작은 글자로 밀도를 해결하지 않는다.

동적인 경험은 처리 완료·선택 변경·확장·새 정보 도착의 의미를 전달한다. 무한 애니메이션, 모든 카드 순차 등장, 장식 빛·과한 그라디언트, 자동 캐러셀로 시선을 빼앗지 않는다. reduced-motion에서는 같은 정보를 정적으로 제공한다. 폴링·갱신·추천 변경으로 포커스, 입력, 스크롤, 저장 순서를 이동하지 않는다. 새 업무는 안정된 위치의 새 항목 안내로 인식하고 사용자가 반영한다.

제3 모드는 사용자가 생각하지 못한 대담한 시각·상호작용을 제안한다. AI intent→근거→관련 앱/자료→준비 초안/계획→검토 가능한 원본 행동→결과/이어하기가 주요 경험이다. 문맥별 장면 전환·선택한 자료의 연결·준비 공간 확장을 설계하고 목록/키보드/모바일/reduced-motion 대안을 가진다. MZ를 나이로 분류하거나 강제 점수·순위·게임화로 치환하지 않는다. 빠른 피드백·직접 조작·자기 표현·자율적 협업을 제품 효용으로 표현한다.

**홈의 읽기 화면은 세 모드 모두 문서 한 번의 세로 스크롤이다.** 위젯 안의 세로 스크롤, 고정 높이에 잘린 목록, 옆으로 넘어가는 페이지를 만들지 않는다. 요약은 제한된 의미 있는 항목과 “전체 보기”·사용자 확장으로 표현한다. 읽기 모드와 위젯 편집 모드의 동작은 구분한다. 대량 관리자 표·지도 등 도메인 도구의 필요한 스크롤은 별도이며 텍스트·목록 대안과 명확한 경계를 제공한다.

## 5. 콘텐츠와 데이터 계약

| 분류     | 의미                                          | 디자인 처리                                                              |
| -------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| CURRENT  | 소스에 실제 경로·조회 또는 명령 계약이 확인됨 | 실제 허용 범위·상태로 기본안에 사용; 운영 활성·테스트 합격을 뜻하지 않음 |
| EXTEND   | 기존 계약/기능을 연결·보강해야 함             | 의존 기능과 연결 지점 주석; 현재 홈에 이미 연결됐다고 표시하지 않음      |
| NEW_API  | 새 조회·명령·집계·설정/DB 계약이 필요         | 별도 확장 프레임과 정확한 필드·owner·상태 명세                           |
| EXTERNAL | 외부 시스템·고객 정책·장비·연계 운영에 의존   | 연결 전/연결 실패·미확인 상태; 토글만으로 실시간 연계 완료를 만들지 않음 |

분류, API 경로, 기술 키, 설계 검증 도구는 **프레임 밖 주석**에 둔다. 제품 화면에는 업무상 필요한 출처·최종 확인 시각·권한 안내만 나타낸다. 예시는 가상 회사·인물·업무로 만들고 프레임 메타데이터에 합성 데이터임을 적는다. 실제 사용자 스크린샷의 개인 업무·숫자를 새 정상안의 사실로 복사하지 않는다.

모든 위젯은 사용자 질문, 실제 데이터 owner, 조회 범위와 기간, 정렬·항목 수, 최종 확인 시각, 주 행동, 클릭 도착점, 권한, 비정상 상태를 가진다. 표시값 0, 실제 없음, 미연결, 접근 불가, 아직 확인되지 않음, 갱신 실패를 구분한다. 일부 소스 실패를 전체 정상 0으로 합산하지 않는다. 동일 업무의 알림 수·전자결재 수·업무 큐 수를 더해 전사 업무 총량으로 만들지 않는다. 업무·회의·알림·공간의 ID와 시간 의미를 구분하고 권위 source에서 중복을 판단한다.

업무 우선순위는 기한·담당·요청된 응답·상태처럼 확인되는 근거를 표시한다. AI 판단을 확정 사실이나 직원 생산성 점수로 표현하지 않는다. 집중 균형·회의 부하는 개인 계획 보조이며 관리자 감시·개인 순위로 확장하지 않는다. 메일·Space·화상회의 앱의 홈 API가 있다는 이유만으로 DWP Home에 이미 연결돼 있다고 가정하지 않는다. ERP·레거시 등은 검증된 connector 없이 실제 숫자를 만들지 않는다.

조회·갱신·명령은 각 owner와 실제 permission을 따른다. 원본 앱 상세에 도착할 때 선택 ID·필터·기간·뒤로가기 문맥을 보존한다. 서버 계약 없는 홈 승인·취소·예약·게시 버튼을 만들지 않는다. 새 직접 명령을 제안하려면 대상·확인·진행·성공·409·권한 철회·결과 불명·원본 확인 경로를 확장 명세에 포함한다. 전송 후 연결 단절은 성공/실패를 단정하지 않는다. 범용 결과조회·undo API를 상상하지 않는다.

tenant·계정·권한 변경 때 이전 보호 정보를 새 환경에 표시하지 않는다. 개인 설정과 조직 정책의 우선순위·적용 대상·차단 이유·저장과 적용 상태가 구분돼야 한다. 관리콘솔의 설정한 모드와 실제 적용된 모드, 전역 활성 조건, 정책 버전·게시·적용·최종 확인을 분리한다. 프론트 토글을 바꾸면 서버 기동 설정까지 즉시 변경된다고 표현하지 않는다.

## 6. 설정·관리 화면의 행동 원칙

현재 메뉴를 모두 디자인하며 같은 목적의 탭·상세·흐름을 신규 최상위 메뉴로 남발하지 않는다. 앱별 운영 정책은 소식·알림·서비스·Space 등 기존 앱 관리자에게 연결한다. 중앙 관리콘솔에 동일 설정을 복제하지 않는다. 기존 redirect는 연결 관계로 명시한다. 계정 알림설정은 기존 알림설정 화면과 한 흐름으로 다룬다.

홈 편집은 추가·삭제·순서·크기·설정·미리보기·저장·취소·복원·되돌리기를 각각 명확히 한다. 드래그만으로 편집하지 않고 키보드 순서 변경·터치 대안을 제공한다. 현재 서버가 보장하는 undo와 이력 복원만 활성화한다. 템플릿 적용 범위·개인 변경 보존·게시/철회·충돌을 설명한다. 계정설정은 개인정보 편집·환경설정·보안·앱 접근·내 보기의 책임을 나누고, 관리콘솔은 상태 판단과 영향 확인 뒤 변경하도록 설계한다.

위험 변경은 대상과 범위·영향·권한·이유·최종 확인·실행 결과·복구 경로를 포함한다. 실제 영향 미리보기 API가 없으면 NEW_API로 명세한다. 모든 관리자 화면을 KPI 4개와 표 하나로 통일하지 않는다. 리스트-상세, 정책 폼, 구성 스튜디오, 접근 검토, 이벤트 탐색 등 실제 목적에 맞는 유형을 선택한다.

## 7. 필수 프레임·상태·접근성

각 화면군의 모든 화면 ID에 1440px 데스크톱 정상과 390px 모바일 정상 프레임을 만든다. 1280/768/320px 재배치 규칙과 200% 브라우저·텍스트 확대를 표시한다. 1440px 한 장만 잘 만든 뒤 모바일을 축소한 이미지를 반환하지 않는다. 현행 Flow의 balanced/focused/expressive 폭은 개인화 설정 축이며 다른 모드에서도 통일할지는 제안·이관 검토로 명시한다.

공통 상태 ID: S01 최초 로딩, S02 정상 empty, S03 필터 empty, S04 미설정/미연결, S05 부분 소스 실패, S06 마지막 데이터 stale, S07 403/권한 철회, S08 저장 중/성공/실패, S09 409 버전 충돌, S10 offline, S11 전송 뒤 결과 불명, S12 계정·tenant 전환, S13 긴 제목·긴 한영 레이블, S14 정책 잠금/read-only, S15 좁은 화면·확대·키보드. 관련 없는 상태는 사유를 적고 실제 가능한 상태는 빠뜨리지 않는다. 명령 실패와 조회 동기화 실패를 구분한다.

WCAG 2.2 AA를 목표로 대비, 의미 구조, 레이블·오류 연결, skip link, 가리지 않는 visible focus, 모달 초기 초점과 닫기 후 복귀, 드래그 대안, 키보드 탐색을 주석으로 설계한다. 주 행동 터치 영역은 약 44px를 DWP 설계 목표로 삼으며 WCAG의 모든 최소값이 44px라고 설명하지 않는다. 색·hover·아이콘만으로 상태와 행동을 전달하지 않는다. live region은 중요한 결과만 알리고 반복 갱신을 계속 읽지 않는다. light/dark, reduced-motion, 긴 ko/en 문자열도 확인한다.

접근성 설명의 근거: [W3C 타깃 크기 최소 기준](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [포커스 가림 최소 기준](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html). 주 행동의 44px는 이 제품의 편의성 목표이며 공식 AA 최소 기준과 구분한다.

## 8. 반환 형식과 진행

이번에 전달된 화면군 하나의 주력 시안을 만들고 모든 지정 화면을 반환한다. 공통 컴포넌트·토큰·variant와 hover/focus/pressed/disabled/loading 상태를 함께 제공한다. 화면별 ID·viewport·theme·locale·권한·상태·데이터 분류, 클릭 도착점·필드 owner·포커스 순서·저장/충돌/복구를 표로 반환한다. 프레임 누락은 임의로 다른 화면 캡처로 대체하지 않는다.

편집 가능한 디자인 링크/파일, 원본 해상도 PNG, 제공 가능한 HTML/CSS와 사용 assets, 전체 프레임 목록, 변경 내역을 제출한다. 데스크톱·모바일 프레임은 이름과 크기가 실제 파일과 일치해야 한다. 외부 접근이 안 되는 파일은 별도 제공하고 프레임 이름만 있는 빈 export를 반환하지 않는다. 디자인 파일을 사용자가 반환한 후 시스템의 네이티브 데이터·권한·컴포넌트로 반영한다. 이미지 한 장의 유사성만으로 모든 상태와 기능의 100% 반영을 주장하지 않는다.

먼저 Flow → Classic → Adaptive 선택안의 홈 방향을 순서대로 검토하고 개인화 → 계정설정 → 관리콘솔 → 교차 앱 신규 위젯으로 확장한다. 홈 시안에 필요한 위젯 데이터 의미는 처음부터 검토한다. 구조·주 흐름·모바일·위험 변경의 모순은 디자인을 수정하고, 토큰·실제 바인딩·세부 상태 구현은 원본 의도와 맞춰 마감한다. 과거 다른 프로젝트의 수정 1회 상한이나 기능 보류 규칙을 이번 요청에 자동 적용하지 않는다.

앱별 신규 메뉴와 신규 앱도 검토 범위다. P12는 승인 내 앱 18개 각각의 확장 화면·원본 workflow·새 계약을, P13은 작업 캔버스와 러닝의 신규 앱 선택안을 설계한다. 기존 앱이 같은 목적을 해결하면 기존 탭/상세를 확장하고, 독립적인 entity·권한·수명주기·운영이 필요하면 신규 메뉴/앱으로 설계한다. 미래 위젯·AI tool·Home contribution을 위한 등록 규격을 함께 반환한다. 아직 연결되지 않은 source나 reference-only 계획을 활성 실행 기능으로 표시하지 않는다.

---

# P12 — AI 홈을 뒷받침하는 18개 앱별 확장 메뉴·워크플로

함께 전달: [P00 공통 계약](../prompts/00-common-contract.md), [앱 확장·신규 앱 계약](../contracts/app-expansion-and-new-app-plan.md).

P00을 전부 적용한다. 이번 화면군은 홈 이미지가 아니라 **AI Stage·Classic·Flow의 콘텐츠와 행동을 실제로 지원할 앱별 확장 화면**이다. 승인 내 앱 18개의 각 앱을 검토하고 빠뜨리지 않는다. 기존 화면을 확장할 항목과 신규 메뉴/route가 필요한 항목을 프레임 밖에 구분한다. 현재 등록된 메뉴와 신규 제안을 혼동하지 않는다. 앱별로 실제 질문·다음 행동·owner·데이터·권한·실패·복구를 설계한다.

## 화면 유형과 공통 연결

홈은 요약·의도·진입, 앱은 원본 검토·편집·명령·결과의 owner다. 홈에서 선택한 문맥/업무/자료를 앱 상세에 유지하고 다시 홈의 같은 문맥으로 돌아온다. 전체 AI 대화 패널을 모든 앱마다 복제하지 않고 선택한 자료/업무의 문맥 행동으로 기존 DWAI를 연결한다. 새 쓰기 기능은 실제 계약이 필요하며 현재 preview를 자동 실행으로 표현하지 않는다.

각 아래 ID에 1440/390 정상, S05 partial·S07 권한·관련 S08/09 저장·S11 결과 불명, 320/200%와 키보드 규칙을 반환한다. 없는 기능은 확장 프레임에 주석을 붙인다. 화면 수는 신규 최상위 메뉴 수가 아니다. 먼저 X01~~X06, 다음 X07~~X12, 마지막 X13~X18로 나눠 제출할 수 있다.

| ID·앱         | 화면·구조                                       | 반드시 보이는 내용                                                                                                     | 주 행동·복구                                                                                                 |
| ------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| X01 업무      | 문맥별 업무 묶음, list-detail                   | 기존 queue/action-required/day-plan과 연결; 담당·상태·기한·의무 source·문맥 관계·마지막 확인; 처리 의무와 내 요청 구분 | 원본 업무 열기·계획 편집; 참조 손실/권한 회수/버전 변경에도 묶음 전체 삭제 금지                              |
| X02 DWAI·ON   | 홈 브리핑·문맥, AI workspace                    | 선택 scope·근거 source·허용 자료·질문·짧은 답·관련 앱/초안·제안 steps·확인 필요·원본 대화                              | 근거 열기·초안 수정·계획 검토·owner로 이동; 자료 없음·거절·취소·partial; 기존 대화/아티팩트/개인통제 재사용  |
| X03 활동      | 문맥 타임라인, event explorer                   | 관련 앱 이벤트·시간·원본·현재 상태와 과거 사건 구분·필터·관찰 범위                                                     | 원본 상태 확인·문맥으로 이어하기; 삭제/권한 없는 자료는 안전한 설명, 과거 이벤트를 완료 상태로 단정 금지     |
| X04 전자결재  | 결재 준비 묶음, task detail                     | 검토 task·필수 입력·관련 문서·revision·AI 요약의 근거·결재선·허용 행동                                                 | 원본 검토/승인 흐름; AI는 초안·요약, 승인 대체 금지; 409 재검토·전송 후 원본 확인                            |
| X05 알림      | 문맥 구독, preference form                      | 구독 목적·source·변화 유형·채널·빈도/조용한 시간·조직 강제 규칙·적용 상태                                              | 구독 저장·해제·미리보기; badge와 실제 의무 구분; 기존 notifications/settings 책임 유지                       |
| X06 소식      | 토픽·조직 읽기 공간, editorial/list-detail      | 필수/일반 구분·토픽·게시 source·날짜·확인 여부·원본 본문·관심 선택                                                     | 필수 확인·토픽 저장·원본 보기; 필수 항목 숨김 제한 설명·deleted/stale 상태                                   |
| X07 캘린더    | 회의 준비/집중 계획, event detail+planning      | 시간·timezone·참석 범위·장소·안건·자료·준비 업무·공개 수준·중복/준비 상태                                              | 일정 상세 열기·자료 연결·허용 계획 수정; Calendar/Rooms/Workplace 권위 구분·충돌·비공개 제목 보호            |
| X08 메일      | 응답 준비, thread+draft                         | NEEDS_REPLY 근거·thread 원본·수신자·최근 응답·첨부·AI 초안과 근거·전송 여부                                            | 초안 편집→Mail owner의 확인/전송; 오래된 thread 재확인·권한·결과 불명; 홈 provider는 EXTEND                  |
| X09 Space     | 문맥 자료함/팀 준비판, collaborative workspace  | 실제 공간 ACL·문서 refs/revision·목표·담당 준비·업데이트·공유 범위                                                     | 허용 자료 연결·원본 편집·준비 업무 열기; 공유 scene이 원본 자료 권한을 자동 부여하지 않음                    |
| X10 근무 공간 | 장소·이용 준비 묶음, reservation detail         | 실제 예약 시간/장소·자원 owner·check-in 가능 상태·관련 일정·필요 안내                                                  | 원본 예약/이용 행동; Calendar 회의와 비회의 자원 구분·stale/409/시간 경계·계획≠실제 출근                     |
| X11 메신저    | 멘션 대응/문맥 대화, conversation detail        | 실제 멘션 목록이 있을 때 ID·미처리 상태·채널·관련 업무·시간·허용 preview                                               | 대화 열기·owner 응답; metric만 있는 현재 계약을 actionable 개별 목록으로 꾸미지 않음; 신규 조회 필요 주석    |
| X12 화상회의  | 회의 전 준비/후속, meeting workspace            | next/active/today·시간·참석 capability·안건·자료·허용 녹취/요약·후속 refs                                              | join은 실제 capability, 자료 준비·후속 업무 owner로 이동; 녹취 없는 상태·권한·생성 중·partial                |
| X13 서비스    | 요청 진행·준비, request detail                  | 상태·기한·담당 역할·필요 응답·입력·첨부·이력·원본 의무                                                                 | 필요한 입력 준비·허용 응답·업무 연결; 해결/종료·변경된 요구·409·owner receipt                                |
| X14 인사      | 나의 신청·성장 연결, personal service workspace | domain availability/origin·확인된 신청/안내·참고 정보·개인공개 범위·러닝 연결                                          | 원본 신청/안내 열기; 참고≠확정·미확인≠0·민감 급여 기본 비노출·LMS 연계 전 상태                               |
| X15 지식      | 탐색·보관함·근거 보기, search/list-detail       | 보안 필터된 자료·revision·작성/검토·유효성·source·검색 scope·보관·AI 답변의 근거                                       | 원본 열기·저장·자료 선택해 DWAI 질문; index 지연·권한 철회·검색 없음·연결 전; 현재 API 확인되지 않은 NEW_API |
| X16 ERP       | 외부 업무 연결, task landing                    | connector·실제 owner 업무 ID/상태·최종 sync·SSO 조건·개수 단위                                                         | 원본 ERP 업무 열기·재인증; 미연결/지연/권한 없음·외부 명령 결과 불명; 기본안 가짜 잔액/결재 금지             |
| X17 레거시    | 연결 상태·외부 업무 진입, connected-app landing | 허용 앱/connector capability·연결 상태·담당·최종 확인·지원 링크                                                        | 안전한 원본 진입·연결 문의; 사용자에게 secret/전사 health를 노출하지 않음·SSO 실패 경로                      |
| X18 관리      | 홈 확장 운영, catalog/policy studio             | 위젯/앱 버전·지원 모드·source·permission·상태·검증·시범/게시/철회·적용 대상·AI 연결                                    | 실제 적용 확인·허용 관리·앱별 admin 이동; 중앙 composition과 DWAI tools/sources·앱 owner 책임 분리           |

## 상세 동작 주석

모든 참조에는 원본 app/object/revision·권한·freshness·홈 복귀 문맥을 매핑한다. AI가 추천한 관련 자료와 사용자가 고정한 자료를 구분한다. 새 자료 연결은 원본 내용을 무제한 복사하는 행동이 아니다. 원본 접근권한이 없으면 title/snippet도 정책대로 보호한다. 새로운 메뉴는 route/resource/permission 후보, 필요한 조회/명령·schema·owner·운영 메뉴와 함께 반환한다.

복수 앱 준비 시 진행은 계획 생성·사용자 검토·각 owner handoff·step별 결과다. 모든 앱 작업이 한 번에 원자적으로 성공하거나 undo된다고 가정하지 않는다. 자동 발송·승인·예약을 장식적 “AI 해결 완료”로 나타내지 않는다. 재실행은 중복 생성 여부와 owner가 보장하는 결과 확인 규칙을 따른다.

## 반환

18개 ID의 프레임 목록, 기존 메뉴→확장 탭/상세→필요 신규 메뉴 대응표, 홈 위젯·AI input/output 연결표, source와 권한, 상태·클릭·복귀·초점 규칙을 제공한다. P13의 작업 캔버스·러닝은 별도 신규 앱 선택안이며 기존 앱의 역할을 불필요하게 복제하지 않는다.

---

# 앱별 확장 메뉴·신규 앱·AI 실행의 제품 경계

사용자의 추가 요구: 제3 모드에 놀라운 역동성과 AI의 큰 역할, 이를 뒷받침할 앱별 신규 메뉴·기존에 없는 신규 앱까지 포함한다. 아래는 설계 후보이며 실제 등록 route·permission·API가 아니다. CURRENT는 정적 소스 근거이며 운영 활성 확인을 뜻하지 않는다. 신규 경로는 구현 단계에서 제품 manifest와 owner에 따라 확정한다.

## 제3 모드: Adaptive / AI Stage(가칭)

Classic의 조직 포털이나 Flow의 업무 큐와 다른 **AI가 구성한 문맥별 작업 공간**을 제안한다. 사용자는 “내일 고객 워크숍 준비해줘”처럼 의도를 입력하고, AI는 허용된 일정·업무·자료·협업 상태를 근거로 준비할 일을 조합한다. 홈에서 문맥을 선택하면 실행 앱과 관련 자료가 함께 나타나고, 다음에 돌아와 같은 작업을 이어간다. 앱 아이콘을 누르는 경험을 넘어 관련 업무를 묶어 시작하는 경험이다.

‘MZ’를 나이로 분류하거나 강제 게임화하지 않는다. 빠른 피드백·직접 조작·자기 표현·가벼운 협업·자율성을 원하는 사용자에게 매력적인 경험을 설계한다. 색·움직임 강도와 밀도를 사용자가 조정하고, 접근성·집중 모드에서도 핵심 효용은 같다. 성과 순위·감정 추정·동료 위치 추정·보상 점수는 이 요구의 대체물이 아니다.

### AI의 다섯 책임

1. **근거 있는 브리핑:** 확인된 의무·다가오는 약속·누락된 준비를 짧게 연결하고 출처·기간·확인 시각·불확실성을 보여준다.
2. **의도 이해와 자료 구성:** 사용자가 고른 scope에서 관련 자료·앱·업무를 검색/연결한다. 자료가 없거나 접근 불가면 그 사실을 말한다.
3. **초안:** 회의 준비·메시지·업무 계획·요청 등의 초안을 편집 가능한 결과로 제공한다. 초안≠전송≠원본 업무 완료다.
4. **검토 가능한 실행 연결:** 실제 가능한 owner 행동과 입력·대상·영향을 보여주고 필요한 확인 뒤 원본 시스템으로 handoff한다. 제공된 preview를 자동 실행으로 확대하지 않는다.
5. **이어하기·피드백:** 작업 문맥·초안·근거·실행 결과를 다시 찾고 “관련 없음/근거 수정/연결 해제”로 사용자가 통제한다.

## 현재 AI와 추가 계약

| 확인된 기반                                                                                    | 이번 확장                                                                  | 경계                                                                                                         |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| DWAI·ON `/dwaion/home`, 새 대화/대화 이력/활동/제안/에이전트/행동/루틴/개인 통제/아티팩트 메뉴 | 홈 문맥에서 기존 대화·제안·아티팩트로 연결, 문맥/근거·복귀 유지            | 새 독립 AI 채팅 앱을 중복 개발하지 않음                                                                      |
| DWAI 아티팩트의 autosave·version·preflight·publish·export 소스                                 | 문맥별 자료/업무 참조를 아티팩트와 연결하거나 별도 공유 작업 공간으로 확장 | 아티팩트 게시·원본 자료 권한·공동 편집은 각각 계약 확인                                                      |
| `/api/agent/v1/plans/preview`                                                                  | 홈에서 계획 검토를 열고 필요한 owner 행동으로 이동                         | 현재 클라이언트는 REVIEW, `mutationAllowed=false`, `referenceMode=true`를 검증. 실행 완료 버튼으로 표현 금지 |
| Agent handoff origin: APP.ASK의 `/dwaion/new` 또는 대화 UUID, action-shelf                     | 홈 출발의 문맥·원본 대화·request/run/correlation 연결                      | 홈 origin은 현행 허용 규칙에 없으므로 EXTEND/NEW_API                                                         |
| 홈 추천 source/evidenceCount/confidence/ruleVersion+feedback                                   | 근거 열기·추천 수정·참조 데이터 범위 표시                                  | 추천 confidence를 사실 정확도·직원 평가로 사용하지 않음                                                      |
| 홈 Studio AI의 규칙 기반 preview/apply/undo                                                    | 설명 가능한 배치 제안·이관 미리보기                                        | 현재 FOCUS_DEADLINES/BALANCE_DAY/REDUCE_NOISE 규칙은 생성 AI 업무 실행이 아님                                |

직접 근거: `apps/dwp/src/features/dwaion/dwaion-navigation.ts`, `dwaion-artifacts.tsx`, `libs/shared-utils/src/api/agent-plan-api.ts`, 홈 overview/studio 모델. 새 홈 AI context projection·검색·개인 기억·루틴·실행은 각각 필요한 실제 계약을 확인한다. 무제한 전사 데이터 수집을 전제하지 않는다.

## 승인 내 앱 18개 각각의 확장 검토

각 행의 확장 화면은 [P12](../prompts/12-cross-app-expansion-menus.md)의 상세 설계 대상이다. 실제 기존 메뉴가 같은 목적을 이미 해결하면 기존 화면의 탭/상세를 확장하며 해당 사실을 디자인 주석에 표시한다. 필요한 새 메뉴·신규 앱은 배제하지 않는다.

| 앱        | 현재 기반/확인 한계                                                             | 신규 또는 확장 화면 후보·주 질문                                                             | 홈 제공 콘텐츠·필요 계약                                                                    |
| --------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 업무      | queue/action-required/day-plan/in-progress/awaiting-response/completed 실제 nav | **문맥별 업무 묶음**: 이 목표를 위해 무엇을 이어 처리하나? 기존 업무 상세/계획 확장          | 개인 업무·계획 CURRENT, cross-app context ref/version EXTEND/NEW_API                        |
| DWAI·ON   | 대화/제안/행동/루틴/개인통제/아티팩트·앱 관리자 실제 nav                        | **홈 브리핑·문맥**, 기존 개인통제·아티팩트 확장                                              | evidence-based brief·intent·plan preview·원본 handoff EXTEND/NEW_API                        |
| 활동      | 현재 실행 summary와 과거 활동 분리                                              | **문맥 타임라인**: 최근 어디까지 진행했나? 기존 활동 필터/상세 확장                          | 이벤트와 현재 업무 구분 CURRENT/EXTEND, source relation NEW_API 가능                        |
| 전자결재  | task 조회와 승인/변경 권한 분리                                                 | **결재 준비 묶음**: 검토에 필요한 자료는 무엇인가? 기존 task 상세 확장                       | 실제 의무 CURRENT, 관련 자료·AI 초안 EXTEND; 원본 승인 경계 유지                            |
| 알림      | 앱별 metrics·unavailableSources·채널 설정                                       | **업무 문맥 구독**: 어떤 변화만 받을까? 기존 설정·구독 확장                                  | badge≠의무, context subscription/quiet hours cross-app EXTEND/NEW_API                       |
| 소식      | 조직 필수/일반 콘텐츠 및 앱별 운영 경로                                         | **토픽·조직 읽기 공간**: 무엇을 알아야 하나? 기존 feed/detail 확장                           | 필수 확인 CURRENT, 명시적 관심 토픽/근거 NEW_API 가능                                       |
| 캘린더    | 오늘 일정·권한·원본 예약 흐름                                                   | **회의 준비**, **집중 계획**: 무엇을 준비하고 언제 할까? 기존 일정 상세/계획 확장            | event refs/참석 권한 CURRENT, 준비bundle·충돌preview EXTEND/NEW_API                         |
| 메일      | 앱 Home focusQueue/NEEDS_REPLY 등 있음, 공통 Home provider 연결 미확인          | **응답 준비**: 어떤 스레드에 무엇을 답할까? 기존 thread/reply 확장                           | reply-needed EXTEND, draft evidence NEW_API 가능, 전송은 Mail owner                         |
| Space     | 협업 공간 focusSpaces/recentActivity/insights                                   | **문맥 자료함**, **팀 준비판**: 이 작업의 관련 자료/사람은? 기존 공간 상세 확장              | 허용된 공간 업데이트 EXTEND, source-linked shared scene NEW_API 가능                        |
| 근무 공간 | Workplace 현재 이용/예약·Calendar와 권위 구분                                   | **회의·출근 준비 묶음**: 장소·시간·이용 행동이 준비됐나? 기존 홈/예약 상세 확장              | 이용 준비 CURRENT/EXTEND; 계획≠도착≠실제 위치                                               |
| 메신저    | Home mentions metric·priority, 개별 미처리 mention 목록 계약 미확인             | **멘션 대응**, **문맥 대화**: 어떤 대화에 응답할까? 기존 대화 상세 확장                      | metric EXTEND, actionable mention identity/status NEW_API 확인 필요                         |
| 화상회의  | next/active/today+capabilities 앱 Home                                          | **회의 전 준비·후속 실행**: 자료·안건·후속 일은? 기존 meeting 상세/후속 확장                 | next meeting EXTEND, 녹취/요약은 실제 권한/생산자 계약; 회의참석≠공간확보                   |
| 서비스    | 요청·응답 의무·운영 catalog 있음                                                | **요청 진행·준비**: 어디서 막혔고 어떤 응답이 필요한가? 기존 요청 상세 확장                  | request tracking CURRENT, evidence bundle/owner-required-input EXTEND                       |
| 인사      | SOURCE/MANUAL/REFERENCE 등 origin/availability 제공                             | **나의 신청·성장 연결**: 확인된 신청과 안내는? 기존 개인 인사/서비스 연결                    | 확인된 domain만 CURRENT, 성장/LMS 연계 NEW_API/EXTERNAL, 급여 홈 기본 비노출                |
| 지식      | launcher/category 확인, security-trimmed corpus/search/recent API 미확인        | **지식 탐색·보관함·근거 보기**: 믿을 자료는 어디에? 실기능 구축 후보                         | corpus/ACL/revision/index freshness/search/saved NEW_API, 외부DMS EXTERNAL                  |
| ERP       | launcher와 실 업무 task API 별개                                                | **ERP 업무 연결**: 외부 확정 의무는 무엇인가? 연결 후 앱 상세 landing                        | task identity/status/owner receipt/SSO EXTERNAL; 미연결≠0                                   |
| 레거시    | launcher와 connector content 별개                                               | **연결 상태·외부 업무 진입**: 어떤 시스템을 이어 쓸까? 기존 registry/앱 진입 확장            | connector capability/health/deeplink/SSO EXTERNAL; 비밀키 사용자 노출 금지                  |
| 관리      | 중앙 24개 메뉴+legacy, DWAI/개별 앱 admin별도                                   | **홈 확장 운영**: 위젯·AI·source가 누구에게 어떻게 적용되나? 기존 catalog/policy/studio 확장 | widget version/permission/health/proposal/rollout/receipt 계약. 앱별 admin과 중앙 권위 구분 |

## 신규 앱 후보: 독립 제품이 필요한 경우

신규 앱은 홈을 화려하게 채울 장식이 아니라, 자기 owner·영속 데이터·권한·수명주기·운영 메뉴를 갖는 업무 목적이 있어야 한다. 아래 두 후보는 디자인 확장안이며 지금 운영 앱에 등록하지 않는다.

| 후보                                | 독립 앱의 이유                                                                       | 기존 앱과 책임 구분                                                                               | 홈 연결·구현 조건                                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Work Canvas / 작업 캔버스(가칭)** | 여러 앱의 업무·자료·AI 초안·준비를 하나의 지속 가능한 문맥 단위로 저장·공유·이어하기 | Work는 의무, Space는 협업 원본, DWAI는 대화·AI 아티팩트, Canvas는 source 참조와 공유 문맥의 owner | 명시적 scene membership/source refs/access policy/version/history/archive API. DWAI/Space 확장으로 같은 목적을 해결하면 별도 앱 없이 같은 디자인을 하위 공간으로 채택 |
| **Learning & Growth / 러닝(가칭)**  | 과정·학습 계획·신청/이수·인증·개인 학습 진척의 독립 수명주기                         | 지식은 자료, 인사는 공식 인사 기록, 러닝은 학습 활동과 과정 owner                                 | native course/enrollment/progress APIs 또는 검증된 LMS EXTERNAL, 사용자 선택 목표. 인사평가·동료순위로 연결하지 않음                                                  |

Work Canvas는 AI Stage의 깊은 이어하기를 지원하는 우선 검토 후보다. 러닝은 선택적 생태계 확장안이며 홈 기본에 임의 추천·가짜 이수율을 넣지 않는다. 신규 Automation 앱은 현재 DWAI 루틴/행동·관리자와 겹치므로 우선 기존 DWAI를 확장한다. 신규 Community 앱도 기존 소식/Space/메신저와 겹치므로 별도 owner가 필요한 고유 workflow가 확인될 때 분리한다.

## 확장 인터페이스의 최소 명세

문맥은 title/purpose/owner/members/visibility/sourceRefs/tasks/artifacts/sceneVersion/createdAt/updatedAt/archiveState를 후보로 가진다. 이는 새 schema 제안이다. sourceRefs는 원본 app/object/revision/permission/freshness를 가리키며 원본 내용을 무제한 복제하지 않는다. 공유된 문맥은 참조 원본의 접근권한을 자동 부여하지 않고 source마다 허용 preview를 다시 확인한다.

AI intent는 사용자 입력·선택 scope·근거·생성시각·제안 steps·검토된 입력·plan hash·origin·확인 필요·원본 도착점·receipt를 가진다. 원본 owner에서만 쓰기 권한/버전/멱등성을 검증한다. 복수 앱 실행은 부분 성공·대기·실패·결과 불명을 step별로 구분하며 존재하지 않는 범용 atomic transaction/rollback을 가정하지 않는다.

위젯은 `contracts/widget-extensibility-contract.md`에 따른다. 신규 앱에는 manifest·nav·route·resource/permission·API/DB·event producer·Home contribution·AI tool capability·관리/모니터링·i18n·a11y·테스트가 필요하다. 사용자 화면에는 기술 명칭보다 실제 질문·현재 상태·주 행동을 보여준다.

## 디자인 패키지와 실제 개발의 순서

AI Stage 주력 시안 → 핵심 문맥 사용 흐름 → P12의 앱별 확장 화면 → P13 신규 앱 선택안 → 반환 결과의 owner/권한/데이터 검토 → 필요한 새 메뉴·API·앱 구현이다. 원본이 없는 상태에서 가짜 활동·임의 실시간 숫자·전송 성공을 제품에 반영하지 않는다. 이 문서는 신규 기능을 검토 범위에 넣는 것이며 사용자에게 불필요한 사전 승인 흐름을 추가하는 문서가 아니다.

---

# 위젯 원천·권한·중복 계약

읽기 기준 2026-09-14 `dwp-dev / 8b9975e4e69a80e653618beae71305e91dd0d969` + 현재 작업 트리. 실시간 서버/API 실행 검증은 하지 않았다. 분류는 P00와 동일하다. **CURRENT**는 소스에 실제 경로·조회/명령 계약이 확인됨, **EXTEND**는 기존 계약/기능 연결·보강 필요, **NEW_API**는 새 조회·명령·집계·설정 계약 필요, **EXTERNAL**은 외부 시스템/운영에 의존함을 뜻한다. 홈 provider 연결 여부는 각 행에서 별도로 표시한다. 실제 API 계약이 있다는 사실은 운영 활성이나 테스트 합격을 뜻하지 않는다.

## 앱 원천 전체

| 앱             | 위젯 구현 분류와 홈 연결                                                    | 사용할 필드와 신호                                                                                       | 권한과 민감 경계                                                                                                                            | 표시·drilldown·중복/실패                                                                                                                       |
| -------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Work           | CURRENT. 통합 큐·개인 task·dayPlan provider 연결                            | sourceSystem/sourceReference/obligationKey/status/priority/dueAt, taskId/version, 계획 선택 업무         | APP.WORK VIEW와 원천 의무 권한. tenant/user/access fingerprint 분리                                                                         | 처리할 업무는 특정 의무, 계획은 오늘 계획 상세. 최대 100×10페이지와 hasMore는 PARTIAL. 원천+객체+의무 identity, 계획 task는 총량에 더하지 않음 |
| 결재           | CURRENT. ApprovalHome provider 연결                                         | 내 task·제출 request·보완 요구·운영 실패/지연                                                            | APP.APPROVALS VIEW, task VIEW/MANAGE와 UPDATE/APPROVE/MANAGE 구분. request VIEW/MANAGE와 UPDATE/MANAGE 구분. ADMIN.APPROVAL_OPERATIONS 별도 | 업무·답변·추적은 원천 obligation에 맞게 분류. Work와 같은 의무 dedupe. 같은 문서의 다른 의무는 유지. 홈 즉시 승인 금지                         |
| Calendar       | CURRENT. HomeOverview provider 연결                                         | 사용자 날짜·시간대·eventId·시작/종료·제목·장소, 응답 집계/인사이트                                       | APP.CALENDAR VIEW, 응답 의무에 UPDATE 추가, event visibility                                                                                | 오늘 흐름은 해당 event, 인사이트는 Calendar 상세. 날짜 mismatch는 PARTIAL. 응답 집계와 event 수 합산 금지                                      |
| Activity       | CURRENT. 과거 feed와 현재 execution summary 연결                            | 현재 attention/unfinished 실행, 과거 eventType/occurredAt/title/actor                                    | APP.ACTIVITY VIEW와 원천 object privacy                                                                                                     | 역할 예외/복구 상세. 현재 summary 실패는 PARTIAL. 과거 event가 현재 미처리 상태를 대체하지 않음                                                |
| Communications | CURRENT. HomeOverview feed 연결                                             | featured/items/actionableItems, 확인 의무·기한·독자 상태·위험도·발행자·이미지                            | 앱/reader 범위와 원천 governed acknowledgement authority                                                                                    | 필수 확인과 일반 소식 원문 상세. read와 ack 구분. 같은 게시물 대표 1개. Classic의 주요 소식/Flow compact brief                                 |
| Notifications  | CURRENT. 앱별 summary provider 연결                                         | actionableUnread/urgentUnread/lastActivityAt/generatedAt/partial/unavailableSources                      | APP.NOTIFICATIONS VIEW와 원천 boundary, 임의 내용 preview 금지                                                                              | 앱별 보조 신호→알림 센터. actionable/urgent 중첩, 개별 Work/결재와 dedupe할 수 없는 집계는 의무 총량에 더하지 않음                             |
| HCM/HRIS       | CURRENT 핵심 pulse, EXTEND 개인 마감/휴가 표현                              | 근태 상태·예외·기한, 학습/복지/팀 count, leave/pay/domainStates/dataOrigin                               | APP.HCM VIEW/MANAGE, 팀/조직셋 경계. 급여 금액·휴가 사유 기본 비노출. HRIS는 HCM 호환 alias                                                 | 근태/학습/복지/팀 상세. SOURCE/REFERENCE/UNKNOWN 구분. domain 실패는 0이 아님. 미확인 수치를 확정값으로 표현 금지                              |
| Services       | CURRENT. MyServiceRequests provider 연결                                    | requestId/status/summary/classification/slaDueAt/serviceName                                             | APP.EMPLOYEE_SERVICES VIEW. Work 응답에는 APP.WORK VIEW 추가. 제출 명령 권한 별도                                                           | 원천 내 요청/초안 또는 허용 Work 의무. SERVICE:{id}의 응답/추적 대표 1개. timestamp 없는 array는 조회 시각. SLA는 완료 예정일 아님             |
| Workplace      | CURRENT 예약/체크인 신호, EXTEND compact 예약 view                          | bookingId/status/시작/종료/resource/site/floor/check-in 조건                                             | APP.WORKPLACE VIEW, 체크인 UPDATE+owner+window 원천 재검증                                                                                  | 내 예약 상세. UTC 넓은 조회 후 사용자 날짜 필터. Calendar 대응 identity가 없으면 같은 시간/제목으로 merge 금지                                 |
| Mail           | EXTEND 공통 홈 연결. getMailHome API는 CURRENT이나 provider 미연결          | 계정 연결/동기화, focusQueue의 thread/account/subject/classification/triage/workflow, 공유 inbox SLA     | APP.MAIL VIEW+계정/공유 membership+object policy. 발송 권한 별도                                                                            | 답변 허브 원천 필터/선택 위젯→허용 thread 상세. unread는 needsReply가 아님. 계정 취소 시 캐시 제거. 생성/동기화 시각 구분                      |
| Messaging      | EXTEND 공통 홈 연결, NEW_API 미처리 mention. 앱 home/shared-assets API 존재 | mentions 집계·priority/spaces, 대화 unread/lastMessage/classification, membership/asset                  | APP.MESSAGING VIEW+direct/Space membership+읽음 privacy/파일 권한                                                                           | 허용 message 상세. mentions 집계는 미응답 의무가 아님. unresolved mention ID/status/due 목록 미확인. 원천별 안전 preview 필요                  |
| Space          | EXTEND 공통 홈 연결. getSpaceHome API 존재, provider 미연결                 | focusSpaces/recentActivity/insights/unreadSignals/reviewQueue/classification/visibility                  | APP.SPACES VIEW+Space role/guest/content/lifecycle. canAdminister 별도                                                                      | 허용 Space/변경 상세. 발견 가능은 본문 권한 아님. reviewQueue는 관리자만. 협업 history를 의무 총량에 더하지 않음                               |
| VideoMeeting   | EXTEND 공통 홈 연결. Home/capabilities API 존재                             | serverNow/timeZone/다음·진행 회의/today/recent, 준비·기록 별도 API                                       | 앱 manifest 허용 surface+회의 membership+capability+lobby/record policy. 세부 권한은 후속 route 계약 검증                                   | 회의 상세/입장 전 확인. Calendar origin identity 후 merge. credential/token preview 금지. serverNow는 generatedAt이 아님                       |
| DWAI-ON        | CURRENT 홈 assistant 일부, EXTEND 근거 브리프/통합 intent                   | APP.ASK의 홈 assistant, agent proposal/evidence/routine/artifact, rule 추천의 source/evidence/confidence | APP.ASK와 action별 원천 권한·memory/privacy. AI의 권한 우회 금지                                                                            | 근거 확인/원천 proposal preview. rule 추천과 생성AI 구분, 피드백 보존. 자동 실행은 별도 계약                                                   |
| 지식           | NEW_API/EXTERNAL. knowledge category만 확인, 전용 corpus API 미확인         | Space content/메신저 shared asset 일부 존재                                                              | 전용 corpus ACL/security trimming/SSO 계약 필요                                                                                             | 최근/저장 문서 API 필요. Space 자료를 전체 지식으로 명명하지 않음. 제안 preview에 연결 필요 표시                                               |
| ERP            | EXTERNAL. business category/launcher 가능, 전용 task API 미확인             | 이 감사에서 업무 데이터 계약 미확인                                                                      | entitlement+외부 SSO+task permission                                                                                                        | connector 이후 처리할 업무 원천으로 통합. task/status/version/obligation/timestamp/link 필요. 가짜 구매/경비 KPI 금지                          |
| 레거시         | EXTERNAL. legacy category/launcher 가능, content API 미확인                 | native/external launch metadata                                                                          | 외부 session/SSO/allowlist/object boundary                                                                                                  | 허용 앱 실행. scraping을 권위 있는 task로 선언 금지. 실패가 업무 0을 뜻하지 않음                                                               |

위 field/route는 소스 계약을 설명한다. 최종 상세경로는 실제 product surface registry와 원천 contract를 검증하며 디자인에서 임의 URL을 발명하지 않는다.

## 최소 envelope와 합산원칙

기존 HomeContributionInput의 kind/scope/priority/status/title/count/dueAt/deepLink/dedupeKey/sourceReference/generatedAt/freshness/privacy/authority를 유지한다. 필요한 신규 extension은 observedAt, coverage(state,totalKnown,hasMore,unavailableSources), sourceVersion, obligation identity다. 문자열 제목만으로 의무 카드를 생성하지 않는다.

- 사업 객체·의무·집계를 분리한다. 문서 1개에 task와 request가 다를 수 있다. count 단위는 objects/obligations/events/alerts로 명시한다.
- 권한 적용 후 dedupe한다. 권한 없는 대표가 권한 있는 fallback을 없애면 안 된다. Services의 기존 fallback을 보존한다.
- aggregate를 item 합계에 더하지 않는다. source/scope/date/coverage가 다르면 총량을 합산하지 않는다.
- INITIAL_LOADING / AVAILABLE / TRUE_EMPTY / PARTIAL / STALE / FORBIDDEN / UNAVAILABLE / CONFIGURATION_REQUIRED를 구분한다. 인증 실패는 캐시의 private 내용을 제거하며 timeout 재조회 실패는 마지막 성공 데이터를 표시할 수 있다.
- 홈 조회 시각 한 곳과 원천 예외만 기본 노출한다. 원천 갱신·조회·권한 정책 변경 시각은 의미가 다르다. TTL은 원천 갱신 주기가 아니다.
- 읽기 기본은 1–3행, 주요 업무 wide는 4행까지 가능하다. API content limit 1–20과 현재 UI 행 1–3의 차이를 annotation한다. 더보기는 실제 필터와 원천 객체로 이동한다.

## mode별 독립개인화: 신규 계약

현재 HomeView에는 surfaceKey/viewId/layout/configurations/deviceLayouts/revisions가 있지만 경험별 독립 저장 key는 없다. CLASSIC/FLOW_V1은 조직 정책이며 focused/balanced/expressive는 appearance이다. 제3모드의 신규 schema는 `surfaceKey+experienceMode+viewId+version`으로 분리하고 config/device/revision도 같은 scope에 두기를 권장한다.

기존 alias `command-rail→action-queue, schedule→today, daily-brief→response-hub, focus→request-tracker, activity→role-pulse`는 같은 의미의 key가 아니다. migration map으로만 사용하며 새 위젯의 key를 기존 key에 덮어쓰지 않는다. unknown widget 객체·기존 expanded geometry·appLayout을 보존한다. 모드 전환은 초안 저장/버리기 후 대상 view를 조회한다. 정책 fallback은 이유와 범위를 표시한다. 이 계약은 제안이며 현재 API가 지원한다고 주장하지 않는다.

## 콘텐츠운영소유권

중앙 Home policy/catalog/template는 배치·권한·수명·기여 허용을 관리한다. 소식 발행·서비스 양식·알림 규칙·Space 공개 심사·회의/예약 정책은 각 앱의 기존 운영콘솔이 소유한다. P11은 기존 앱 메뉴에 추가할 ‘홈 기여’ 영역과 신규 API 필요 범위를 구분한다. 중앙 홈 메뉴에 발송·심사·승인 명령을 복제하지 않는다.

근거: `home-contribution-providers.ts`, `use-home-contribution-model.ts`, `home-contribution-runtime-policy.ts`, `flow-home-preference.ts`, `home-personal-work-loader.ts`, `workspace-widget-catalog.ts`, shared-utils `home-overview/mail/messaging/space/video-meeting/hr/service-center/workplace/workspace-api.ts`, 각앱routes·productmanifest.
