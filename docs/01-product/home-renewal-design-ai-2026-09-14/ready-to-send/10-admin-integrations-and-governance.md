# DWP 독립 전달 합본 — P10

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

# P10 — 관리콘솔: 연계·거버넌스 전체 디자인 AI 프롬프트

[P00 공통 계약](../prompts/00-common-contract.md), [메뉴·권위 계약](../contracts/account-admin-menu-inventory.md), P08/P09와 함께 사용하세요. **현행 생산성 커넥터 1개, 거버넌스 5개, legacy 감사로그 1개**를 모두 디자인합니다. 신규 원천·품질·변경 통제 작업공간 3개는 제안입니다. 중앙 콘솔에서 모든 앱의 원천 데이터·업무승인·AI 정책을 새로 소유하지 않습니다.

## 공통 운영 shell · `P10-S00`

사용자: 연계 운영자·플랫폼 SRE·감사 조사자·통제 책임자. 조직/권한 scope, 기간/관측 범위, 현재 live/paused/stale, 마지막 성공 갱신이 보입니다. 고객 업무 영향과 예외/결정을 인프라 상세보다 먼저 보여줍니다. 모든 chart는 추이/비교/분포/임계/관계 목적을 가지며 accessible text/table equivalent를 제공합니다. 선택은 업무 상세/상관분석/실제 앱으로 연결됩니다. 민감한 증거·개인정보·secret 대신 가상 데이터와 안전한 오류 코드를 사용합니다.

**읽기·검토·실행 경계:** 원천 위젯이나 AI 계획의 capability가 REFERENCE/REVIEW이면 조회·근거 확인·원본 앱의 검토 화면으로만 연결합니다. 실제 mutation과 EXECUTE는 해당 앱과 서버의 권한·승인·command 계약이 허용할 때만 제공합니다. 현재 client/API가 존재하는 것만으로 현재 사용자에게 실행 가능하다고 표시하지 않습니다. 신규 집계·원천 연결·릴리스 조정은 구현 예정 계약이며 운영 중인 기능으로 그리지 마세요.

## 1. 생산성 커넥터 · `P10-N01` · `/admin/integrations/productivity` · 현행

**사용자 / 질문 / 액션 / 유형:** M365 연계 운영자 / “메일·일정이 동의·권한·동기화 조건을 충족하며 직원 홈에 정확히 제공되는가?” / connector 설정 검증·활성/정지·문제 원인 조사 / connection operations + 설정 작업 흐름.

**구조:** connections/subjects/runs 현행뷰. 상단은 사용자 영향(연결필요/재동의/신선도지연/실패 stream), 아래 커넥터 목록-detail, readiness/consent, 선택 실행 trace. 활성 connector 수·연결된 구성원 수·stale stream·failed24h 지표는 각각 scope/분모/마지막 갱신을 가지며 클릭하면 필터가 연동됩니다.

**실제 지원:** provider MICROSOFT_GRAPH, authmode DELEGATED, resource MAIL/CALENDAR. connector lifecycle DRAFT/ACTIVE/SUSPENDED/RETIRED, health CONFIGURATION_REQUIRED/HEALTHY/DEGRADED/AUTHENTICATION_REQUIRED/UNAVAILABLE, policy REVIEW_REQUIRED/APPROVED/BLOCKED, 개인 consent NOT_CONNECTED/CONNECTED/REAUTHORIZATION_REQUIRED/REVOKED. 이 네 상태를 단순 초록`연결됨`으로 묶지 마세요. 다른 provider/app은 명시적 추가 제안입니다.

**필드·controls·detail:** connectorKey/displayName/providerTenantId/clientId/credentialReference/redirectUri/requestedScopes/policyState/version. credentialReference는 vault참조이지 secret입력 평문이 아닙니다. requested/granted scopes와 필요한 메일·일정 capability·최소권한/owner를비교. 설정 검증는개별 check/실행 차단 코드/checkedAt. runs는 INITIAL/DELTA/RESET, RUNNING/SUCCEEDED/PARTIAL/FAILED/BLOCKED, upsert/delete/skip/errorCount, retryAfterAt, safeErrorCode, correlationId, 마지막 성공. subjects에는 consent/토큰 만료지원 값과 홈 영향을 보입니다.

**flow:** connector생성/편집→필요 scope/자격증명 참조 확인→check→blocking문제해결→policy 조건확인→activate→개인 consent→sync관측→홈원천 신선도 확인. suspend에는영향 widget/계정/자동 sync정지와 재개 조건 preview→confirmation→진행→서버 상태. 현행 커넥터 수동 재 sync API가 확인되지 않았으므로 `지금전체동기화`를기존 action으로 발명하지 않습니다. 원천을 소유하는 mail/calendar앱의 재연결 경로와 중앙 설정 권위를 분리합니다.

**프레임:** DRAFTcheck, 차단된 정책, ACTIVE+개인재동의, PARTIALrun, staleCALENDAR/healthyMAIL, connector편집/버전 충돌, activation/suspend 확인·진행·실패, subjects/runs부분 실패, 안전한 오류 추적, 모바일 상세.

## 2. API 모니터링 · `P10-G01` · `/admin/governance/api-monitoring` · 현행

**사용자 / 질문 / 액션 / 유형:** 플랫폼 운영자 / “어떤 API문제가 직원 업무를 막고 최근 변경과 연결되는가?” / 문제 route/trace/변경조사 / service impact command center + trace investigator.

**구조:** 기간·observation point·service·method·outcome·search·autoRefresh/livepause context bar. action가능한 오류 요약→errorrate/p95/처리량 추세→문제 route비교→eventlist/추적 상세→최근 감사 변경 증거상관. 정상 경로반복은 압축합니다.

**필드·controls:** total/throughput/errorRate/p95/p99/activeRoutes, 기간과분모, 지연 임계값/baseline은 source가 있을 때 표시. API 경로 비교 표은 service/method/path/traffic/error/latency/최근문제 비교용. trace detail은 correlation/observation/timestamps/outcome/안전한 오류/연관 request·변경 증거. 홈위젯 source 실패→해당 API로 연결된 운영 예제. 검색필터는 URL/저장 상태 개선으로 보존하고 민감한 payload/검색어는 안전하게 취급.

**flow:** 오류 trend 선택→동일기간/서비스 경로필터→route 선택→trace→설정/권한/배포변경 audit→원천 owner복구 작업→관측 상태 검증. 모니터링 read를 API재실행이나 서비스 재기동 버튼으로 확대하지 않습니다. 자동 갱신은 조사 선택을 리셋하지 않고 stale/paused 상태를 노출합니다.

**상태/프레임:** 관측된 요청 없음과 수집 실패, overview 성공/events 실패/변경 감사 조회 실패, trace없음, pause/live, longpath/모바일 표의 동등 정보, 권한 제한, observation관측 범위 확인 불가, 접근 가능한 추세 차트, 선택 추적복귀.

## 3. 감사 관제 · `P10-G02` · `/admin/governance/audit-overview` · 현행

**사용자 / 질문 / 액션 / 유형:** 감사/위험운영 책임자 / “지금 우선 조사할 위험과 증거 수집 공백은 무엇인가?” / finding/case/source/drill-down / audit command center.

**구조:** H24/D7/D30/D90 scope/time, 긴급 findings·open/고위험 사건·거절된 접근·원천 수집 범위, 위험 영역/추이·업무량, 관련 수행자는가상/권한 제한. 첫 viewport에 결정할 일을 노출하고 숫자 카드 나열로 끝내지 않습니다.

**필드·detail:** severity/riskScore 정의·threshold/baseline/평가 기간, findings/cases 분모·상태, 증적 events/원천 상태·마지막 성공. actor활동은 감사 근거 맥락에만 제공하고 직원 근무 성실도 평가로 쓰지 않습니다. count클릭→동일 filter를 보존하는 findings/cases/evidence/source 운영.

**flow:** 우선 finding→조사 dossier→case담당/진행→증거추적→판정→통제복구/evidence. source불완전/권한 제한시 위험 0나 100%healthy를 표시하지 않고 coverage/조회 제약을 설명.

**프레임:** 위험분류·원천 수집 공백, no incidents healthy, 부분원천 조회 실패, 기한 초과 사건, 기간 변경 연동, 접근 권한 없는 영역, drill-down·키보드로 읽는 차트/table·mobile.

## 4. 조사 워크벤치 · `P10-G03` · `/admin/governance/audit-investigations` · 현행

**사용자 / 질문 / 액션 / 유형:** 책임조사자 / “이 위험의 원인·영향·증거와판단·후속 작업이 연결되어 있는가?” / finding분류·case생성/담당/작업/판정/종결 / investigation workspace.

**구조:** findings/cases queue, 선택 조사 상세, 별도 조치 패널. URL `?view=cases|findings&finding=…&case=…` 선택을유지. queue에는 open/critical/unassigned/breached, status/search. dossier에는 위험 근거·관련 증적/entity·timeline·현재담당/기한·judgment/action, case에는 notes/tasks/evidence/closure.

**필드·controls:** case title/description/priority/선택 위험 신호 연결, 위험 신호 상태·owner·판정 근거, task담당/기한/진행·결과, note, evidence event link, closure report. case/finding API+조치 패널의 현재 필드만 기존 기능으로 반영. 증거를 편집하거나 원천 사건을 삭제하는 UI는금지.

**flow:** queue 선택→context읽기→담당/기한·severity판단→case생성/연결→증거/엔터티추가·tasks→판정 근거→필요한복구 작업 source 앱연결→closure 조건 검증→종결 report/evidence. 미완료 task·필수 근거 없음은 종결 차단 조건. case 조회 부분 실패시 queue유지. 책임권한 `ADMIN.AUDIT_INVESTIGATE UPDATE`와 수행자 정책을 반영.

**프레임:** 위험 분류/사건 상세, unassigned/overdue, note/task/증거 연결, 종결 차단/종결 report, 맥락 조회 실패/taskfail/409, 권한 제한, URL 선택 back/focus, 모바일 조치 패널.

## 5. 증적 탐색기 · `P10-G04-C` / `P10-G04-E` · `/admin/governance/audit-events` · 현행

**사용자 / 질문 / 액션 / 유형:** 감사조사자·증거반출자 / “어떤 불변 사실이 있고 같은 업무 흐름의 증거는 어떻게 연결되는가?” / 검색·상관분석·case 연결·근거 있는 export / evidence query workspace.

**두작업공간:** 기본 correlations뷰와 `?mode=events` 증적 검색뷰. correlations는업무/command/actor/entity·transaction의 관계를 시간축/연결 tree/detail로; events는 저장 검색/filter/query/검색 결과 표/drawer로. 이미 있는 두 뷰를 하나의 범용 table로 줄이지 마세요.

**필드·controls:** window/category/severity/outcome/query, 고급 원천 필터/actor/target 등지원 filter, 불변 증적의 occurredAt/source/action/actor/target/outcome/classification/correlation/증거 맥락. 저장 검색의이름/범위/공유 권한은 현재 지원 필드에 맞춤. 증적 상세은가상 값/민감 field마스킹·접근이유. case 연결은선택 event/context를 보존. export는기간/대상/format/reason/권한·limit/retention 및 progress/result를실제 API에 맞춰표시.

**flow:** 필터 적용→queryURL보존→event/correlation 선택→관련 사실 보기→case 연결 또는 권한 있는 반출→사유/범위 preview→진행→반출 파일 받기/유효성·audit. event반출과 화면 목록 열람은 다른 permission. 결과가 복잡해도 무한히 높은 빈 차트를 쓰지 않습니다.

**상태/프레임:** noevents/원천 수집 지연/forbidden구분, 증적 상세 없음, 원천 부분 실패/상관분석 실패, 저장 검색deleteconfirmation, 반출 한도 초과 차단/denied/진행/실패, case이미연결/409, pagination/selection유지, 모바일 event목록·상세과 접근 가능한 상관관계 표.

## 6. 증적 거버넌스 · `P10-G05` · `/admin/governance/audit-governance` · 현행

**사용자 / 질문 / 액션 / 유형:** 증거보존/통제 정책 책임자·검토자 / “증적 수명주기·반출·무결성이 어떤 정책으로 통제되고 변경은 승인되었는가?” / 정책 버전작성/검토/게시/rollback·checkpoint / governance policy studio.

**구조:** 현재 활성 정책/수명주기 미리보기, 초안 버전 편집·diff/impact, 버전 작업 흐름/history, 무결성 검증 기록. store/retention/export/integrity를 정보의 수명주기 순서로 연결하고 서로 무관한 설정 카드로 분해하지 마세요.

**필드:** standardDays/extendedDays/riskThreshold/exportLimit/requireReason/integrityEnabled, 버전 변경 사유/관련 사건 등현행필드. capture→immutable→standard→extended→disposition단계의 보존 대상/기간/정책효과. 법정근거/보존 의무는 실제 도메인 필드/정책이 있을 때 연결하며 국가별 법률값을 디자인 가정으로 고정하지 않음. checkpoint는실행시각/범위/검증 결과/불일치 source·추적.

**flow:** 활성 버전 확인→create revision→필드입력/validation→diff·삭제/반출영향→submit→authorized approve/reject→publish→활성 정책 확인→audit. 이 메뉴는 현행 submit/decide/publish가 존재하므로 승인 단계와 게시 단계를 분리해 그립니다. rollback은 source revision/이유/incident와복원영향 preview후신규정책 revision으로 지원 계약대로 처리합니다. checkpoint실행은 정책 게시와 다른 action.

**프레임:** active/draft/review/approved/published/rejected, 기간오류/retention감축영향, 승인 분리·권한 제한, publish/복원 확인/진행/409, 무결성 검증 성공/invalid/unknown, 부분 policy/history/무결성 조회 실패, 모바일 작업 흐름.

## 7. 감사 로그 legacy · `P10-G06-L` · `/admin/governance/audit` · 현행 직접 route

현재 정식 탐색에는 없지만 직접 route는 AuditLog를 렌더합니다. 질문: “옛 관리 변경 증거 링크를 잃지 않고 최근 증적 탐색으로 이어갈 수 있는가?” 유형: 이전 링크 호환 증적 목록. identity/platform audit의 actor/action/target/outcome/correlation/occurredAt를 안전하게 유지하고 원천별 부분 failure를 표시. `새 증적 탐색기에서 보기`는가능한 source/필터 맥락를전달하는 deep link. 기존 route를 404로 없애거나 본래 증거가 새 계약으로 모두 이관됐다고 주장하지 마세요. 신규작업 flow는 P10-G04로 안내합니다. source한쪽오류/권한 없음/oldlink 선택/모바일 표시 프레임을 요청합니다.

## 8. 신규 제안: 홈 데이터 원천 운영 · `P10-N02` · 후보 `/admin/integrations/home-data-sources`

**사용자 / 질문 / 액션 / 유형:** 홈/원천 앱 운영자 / “위젯이 비거나 틀린 이유가 원천·권한·동기화·계약 중 어디인가?” / 원천 문제 조사·담당 앱 복구 작업 연결 / 원천 검증 작업공간.

기존 생산성 커넥터/위젯 catalog/P08 policy 안의 source 상태로 충분한지 먼저 검토. 여러 앱 source를 독립 운영할 책임이 있으면 신규 메뉴를 만들 수 있습니다. row는 원천 앱/provider/원천 계약 버전/사용 중인 위젯/owner·지원 범위/마지막 성공·asOf/freshnessSLA/coverage/권한 정합성/오류 상태/안전한 오류/trace. fresh/empty/stale/partial/blocked/unsupported는 모두 다름. 겹치는 Work/결재/알림은 기준 원천 권위/dedupekey와실제 count 차이를 조사할 수 있게 합니다.

flow: 실패 widget→원천 범위→trace/contract/권한 근거→원천 앱 owner 작업→원천 결과→홈 재조회 검증. 이 페이지에서 원천 결재 승인·HR수정·연계 자격증명 조회·서비스 재기동을 같은 버튼으로 제공하지 않습니다. AI source는 근거 조회 시각/원천 버전·사용 범위/citation·허용 도구·개인정보 필터, 읽기/실행 capability를 포함. 중앙 집계 endpoint/trace 상관분석/필드 마스킹은 신규 계약입니다. 부분 실패·권한 없음·범위 확인 불가·인증 필요·지원되지 않는 app·두 source 중복/충돌·복구 영수증 프레임.

## 9. 신규 제안: 홈 품질 및 접근성 · `P10-N03` · 후보 `/admin/governance/home-quality`

질문: “세 홈 모드의 실제 품질은 어디서 막히고 복구되는가?” 유형: 품질 검증 센터. 범위 mode/빌드 스냅샷/테넌트 정책 버전/locale/viewport/theme/기간, 검증 run·실패 영향·A11y/keyboard·overflow/빈 높이·원천 신선도·부분 실패/recovery·배치 복원/width 차이·icon 정렬/업데이트 중복. 지표는 책임 있는 검증 근거를 갖고 실제 executed 결과가 없으면`미검증`을 표시합니다.

개인 행동·민감 업무·MZ세대/직원 효율 점수를 수집하지 않습니다. usage가 필요하면 동의된 익명 집계·최소 수집·보존·접근 제어를 추가 계약으로 분리합니다. 발견 issue→원천/소유자→source snapshot·실행 증거→복구 검증으로 연결. 기존 게시 검증의 운영 뷰로 충분하면 별도 메뉴 대신 그 안에 둡니다. 접근 가능한 차트/table, 실패한 검증 run/수집 실패/제한 scope/비교 불가 version·다크/모바일 validation 프레임.

## 10. 신규 제안: 경험 변경 통제 · `P10-N04` · 후보 `/admin/governance/experience-change-control`

질문: “홈·브랜딩·앱 배치·탐색·번역·위젯 계약 변경을 묶어서 검토하더라도 실제 게시·복원 단위는 명확한가?” 유형: 여러 영역의 릴리스 명세 workflow. manifest는 각 domain/게시 버전/제안 변경 비교/dependencies/영향받는 사용자·source/checks/owner·reviewer/조치 권위. 각 domain의 현재 publish 권위와승인 chain 존재 여부를 정직하게 표시합니다.

flow: domain 변경 selection→snapshot/diff→기기·권한·모드 검증→영향 검토→실제 승인 가능한 domain의 approval→게시 order/범위 confirmation→progress(각 영역)→부분 성공/실패·receipt→안전한 recovery/복원 범위→effective홈검증→audit. **현재 독립 API들을 하나의 원자적 transaction으로 가정하지 마세요.** 신규 서버 릴리스 조정/idempotency/reconciliation/approval 계약이 필요합니다. rollback이 전환 mode를 복원해도 개인 뷰·원천 데이터를 삭제해서는 안 됩니다. 조합 관리 질문이 기존 홈 정책/history로 충분하면 새 메뉴를 늘리지 않습니다.

AI·Adaptive 릴리스에서는 중앙 홈 표시/배치 정책, DWAI model/tool·safety 및 앱 도메인의 실행/승인을 분리합니다. release에는 허용 source/tools/capabilities/version, 실행 영수증/trace 확인, 민감한 필드 마스킹·동의, 사용자 확인, 안전한 재시도 command/중단 가능성·결과 불확실 복구를 포함하세요. 실행 확정 전 UI의 마법 같은 즉시 완료를 약속하지 않습니다.

## 제출물

각 ID의 주 사용자/question/action/archetype과 실제 대표 여정이 prototype으로 연결되어야 합니다. 기존 7route와 제안 3workspace는 구분됩니다. P00의 1440/1280/390/320·200% zoom·ko/en·light/dark/고대비·움직임 줄이기·keyboard/focus/touch·loading/empty/error/부분 실패가 필수입니다. chart/table 동등 정보·scope/time/freshness·selection URL·permissions·승인/preview/progress/recovery/감사 annotation을 포함하세요. 실데이터가 없는 영역은 가상/제안/미검증 상태를 명확히 보여줍니다.

---

# 계정설정·관리콘솔 메뉴 계약 및 디자인 범위

작성일: 2026-09-14. 코드 기준 HEAD `8b9975e4e69a80e653618beae71305e91dd0d969`; 공유 워킹트리의 현재 소스를 읽었다. 런타임 API 응답·현재 운영 정책은 이 문서로 인증하지 않는다. **현행**은 navigation + renderer + API client가 확인된 범위이며, **제안**은 신규 route/기능으로 아직 구현·게시된 상태가 아니다.

메뉴 집계: 계정 탐색 8개, 중앙 관리콘솔 탐색 24개, 중앙 관리콘솔 legacy 직접 route 1개. 총 현행 33개를 개별 프롬프트로 다룬다. 위젯 및 홈 3개 탭, 역할 및 권한 4개 탭과 특권 접근 4개 하위뷰 등 내부 작업공간도 별도 프레임을 요구한다. 신규 route 제안은 10개다. 앱별 운영콘솔은 아래 기존 연결 목록으로 구분하며, 중앙 콘솔에 중복 데이터를 새로 관리하는 메뉴를 만들지 않는다.

## 1. 계정설정: 8개 전체

| 그룹     | 현재 표시명 / route                                                | 실제 렌더러 / 원천                                                                                   | 기존 기능                                                                         | 갭·설계 방향                                                                | 프롬프트 / frame ID |
| -------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------- |
| 계정     | 프로필 `/account/profile`                                          | `pages/account/profile.tsx`; `getMe`                                                                 | 이름·이메일·직원/조직/직무 등 원천 표기, 읽기 전용                                | 편집 가능한 개인정보로 오인하지 않게 관리 원천과 정정 경로를 분명히         | 07 / `P07-A01`      |
| 계정     | 보안 및 세션 `/account/security`                                   | `pages/account/security.tsx`, `my-privileged-access.tsx`; auth sessions/policy/IdP/privileged access | 로그인 보안 정책, 기기·세션 종료, 다른 세션 종료, 개인 특권 접근 요청/활성화/종료 | 세션과 조직 인증 정책·일시 권한을 작업별로 분리; 현재 세션 종료 결과 설명   | 07 / `P07-A02`      |
| 환경설정 | 화면 모양 `/account/settings/appearance`                           | `SettingsPage`; appearance provider + personal preference API                                        | 시스템/라이트/다크, compact/standard/comfortable, 즉시 저장, 초기화               | 설정 하나의 변화가 실제 제품에 어떻게 보이는지 적용 전후를 시각화           | 07 / `P07-A03`      |
| 환경설정 | 접근성 `/account/settings/accessibility`                           | `SettingsPage`; personal preference API                                                              | 고대비·움직임 줄이기·링크 밑줄·투명도 줄이기                                      | 켜짐 상태만 보이는 스위치 목록에서 효과를 검증 가능한 샘플로                | 07 / `P07-A04`      |
| 환경설정 | 언어 및 지역 `/account/settings/language`                          | `SettingsPage`; preferred language + regional preference/system codes                                | 제품 언어, IANA 시간대, 날짜/시간/숫자 형식, 주 시작일                            | 표시 언어와 데이터 시간대 의미 분리; 실제 예제 및 저장 상태 통일            | 07 / `P07-A05`      |
| 환경설정 | 홈 워크스페이스 `/account/settings/home`                           | `SettingsPage`; 현행은 `/?edit=home` 이동; home views/preference API는 홈 편집기에 존재              | 홈 편집 시작                                                                      | 모드 정책·개인 배치·기기 배치·홈 뷰·권한의 관계를 보여주는 관리 시작점 필요 | 07 / `P07-A06`      |
| 환경설정 | 알림 `/account/settings/notifications` → `/notifications/settings` | `NotificationPreferences`; notification API                                                          | 채널/quiet hours, 앱·유형 규칙, 의무 정책, endpoint 관리, 전달 진단, 충돌 복구    | 중복 설정 UI 생성 금지; 계정에서 돌아올 맥락 유지, 통지와 홈 배지 의미 분리 | 07 / `P07-A07`      |
| 조직     | 관리형 설정 `/account/settings/managed`                            | `SettingsPage`; managed policy + preference exceptions API                                           | 제품 글꼴·강조색·탐색 패턴, 정책 원천/담당자, 예외 요청/취소/판정 확인            | 모든 값의 정책/개인/승인된 예외 출처를 드러내고 정당한 변경 경로 제공       | 07 / `P07-A08`      |

Provider 계정은 홈·알림·관리형 설정을 제공하지 않는다(`settings-navigation.ts:54,80`). Provider 화면 모양은 현재 브라우저 저장 범위를 설명한다. 고객 테넌트 설정과 혼합하지 않는다. 활성 support context 또는 support 오류 시 계정 접근을 support로 보내는 현행 경계도 유지한다.

## 2. 중앙 관리콘솔: 사용자 경험 6개 전체

| 현재 표시명 / route                                      | 실제 렌더러 / API                                                                                                            | 현재 기능·하위공간                                                                                                                                                                     | 핵심 갭                                                                                                | 프롬프트 / frame ID                      |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| 브랜딩 `/admin/experience/branding`                      | `TenantBrandingManager`; tenant-branding API                                                                                 | 조직명·강조색·로고 upload/reset, shell/sign-in/home 미리보기, 이력/rollback                                                                                                            | 테넌트 전체 영향·대비 검증·원자적 게시 결과 강화                                                       | 08 / `P08-E01`                           |
| 홈 화면 설정 `/admin/experience/home-experience`         | `HomeExperienceManager`; home-experience API                                                                                 | 한/영 환영문구, 기본 언어, 배경/desktop·mobile 초점, overlay/content alignment, quality check, publish/history/rollback, unsaved blocker                                               | 브랜딩과 구성 정책 경계를 설명; 이미지 편집이 홈 전체 게시로 오인되지 않도록 복원 scope 강조           | 08 / `P08-E02`                           |
| 위젯 및 홈 `/admin/experience/home-composition`          | `HomeCompositionManager`, `TenantWidgetCatalogPanel`, `TenantHomeBlueprintPanel`; home-experience + home-personalization API | `?tab=policy`: CLASSIC/FLOW_V1·개인화·announcements 위치/크기/높이; `?tab=catalog`: 현행 빌드 위젯 계약 **읽기 전용**; `?tab=blueprints`: 템플릿 목록·게시·철회, 작성은 홈 studio 연결 | 모드 선택 위치 발견성, 요청 모드 vs effective모드, 빌드 capability vs 운영 정책 vs 개인 설정 혼란 해결 | 08 / `P08-E03`, `P08-E03-C`, `P08-E03-B` |
| 홈 앱 구성 `/admin/experience/home-apps`                 | `HomeAppLayoutManager`; home-experience launchpad API + workspace apps                                                       | 카테고리 ko/en 이름·설명·순서·enabled, resourceKey 배치/이동, 기본 구성 게시                                                                                                           | 5×2 구조·좌측 연속 배치와 접근 권한을 같은 편집에서 오인하지 않게, 실제 예시 비교                      | 08 / `P08-E04`                           |
| 설정 예외 검토 `/admin/experience/preference-exceptions` | `PreferenceExceptionManager`; personal-preference exceptions API + identity users                                            | PENDING/APPROVED/REJECTED 큐, 요청/영향/근거, 승인·반려·사유/증적 참조                                                                                                                 | 개인 기본값과 보안 권한 부여를 혼동하지 않는 판단 화면, 승인 효과 범위·수명 제시                       | 08 / `P08-E05`                           |
| 다국어 스튜디오 `/admin/experience/localization`         | `LocalizationStudio`; localization API                                                                                       | bundle/revision editor, diff/preview/history, save→submit→decide→publish→restore                                                                                                       | 승인과 게시 분리, fallback·누락·긴 라벨을 홈/설정/콘솔에서 실제 검증                                   | 08 / `P08-E06`                           |

## 3. 중앙 관리콘솔: ID·접근 권한 8개 전체

| 현재 표시명 / route                                 | 실제 렌더러 / API                                                                        | 현재 기능·하위공간                                                                                                     | 핵심 갭·권한                                                                                             | 프롬프트 / frame ID                |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 접근 제어 `/admin/identity/access`                  | `AccessManager`; identity-admin API                                                      | 사용자 검색/선택, 직접 역할 교체, 상속·일시 특권 inspector, 근거                                                       | `ADMIN.IDENTITY_DIRECTORY VIEW`; 직접 역할만 변경함을 보여주고 상속 유효 권한은 역할 화면으로            | 09 / `P09-I01`                     |
| 앱 책임 관리 `/admin/identity/app-governance`       | `AppGovernanceManager`, `AppAdminPresetManager`; app-governance API                      | 책임 assignment/명시 범위, 경계(resource set), 검토/승인/반려/철회, 운영 preset/duty 부여·활성화·검토                  | `ADMIN.APP_GOVERNANCE VIEW` 또는 정해진 앱 책임/APP_CATALOG_ADMIN; 관리자 라벨을 일괄 허용으로 대체 금지 | 09 / `P09-I02`                     |
| 앱 접근 요청 `/admin/identity/app-access-requests`  | `AppAccessRequestManager`; app access request API                                        | 요청 검토→결정→IAM 실행→철회, evidence                                                                                 | `ADMIN.APP_ACCESS_REQUESTS VIEW`/앱 책임 경계; 승인 완료와 실제 접근 제공 상태 구분                      | 09 / `P09-I03`                     |
| 접근 권한 검토 `/admin/identity/access-reviews`     | `AccessReviewManager`; access-review API                                                 | 캠페인 생성/활성/완료, 직접·그룹 권한 item 인증, evidence/사유, manual remediation                                     | 판정과 권한 회수 실행·검증 분리; 대량 판정 자동 완료 발명 금지                                           | 09 / `P09-I04`                     |
| 역할 및 권한 `/admin/identity/roles`                | `RoleGovernanceManager` + privileged manager; access-governance/directory/privileged API | roles, assignments, privileged, effective 4탭; 특권 requests/eligibilities/policies/boundaries                         | 역할 정의·그룹 부여·특권·최종 권한 네 작업을 동종 테이블로 만들지 않음                                   | 09 / `P09-I05-R`, `-A`, `-P`, `-E` |
| 인력 데이터 접근 `/admin/identity/workforce-access` | `WorkforceAccessManager`; workforce-access API                                           | ROLE/USER × TENANT/ORG_UNIT/ORG_TREE × DIRECTORY/IDENTIFIERS/EMPLOYMENT/JOB_GRADE × READ/EXPORT, 유효기간·사유, revoke | `ADMIN.WORKFORCE_ACCESS MANAGE`; 목록은 데이터 접근 정책이지 직원 민감정보 조회 UI가 아님                | 09 / `P09-I06`                     |
| 저장 뷰 소유권 `/admin/identity/saved-view-custody` | `SavedViewCustodyManager`; saved-view ownership API                                      | source→target/disposition/retention→evidence→preview→transfer; conflict·orphan reassignment/extension/archive·history  | `ADMIN.SAVED_VIEW_CUSTODY VIEW`; 실행 권한 별도 확인, 보안 권한 자동 이전 금지, 미리보기 재검증          | 09 / `P09-I07`                     |
| ID 프로비저닝 `/admin/identity/provisioning`        | `IdentityProvisioningManager`; provisioning-admin API                                    | SCIM connector 생성·endpoint·일회성 secret·회전, lifecycle, 처리 events                                                | `ADMIN.IDENTITY_PROVISIONING VIEW`; secret 평문 목록 금지, 연계상태·사용자 영향·복구 흐름 강화           | 09 / `P09-I08`                     |

## 4. 중앙 관리콘솔: 플랫폼 4개 전체

| 현재 표시명 / route                       | 실제 렌더러 / API                                                        | 현재 기능·하위공간                                                                                                                                    | 핵심 갭                                                                                                          | 프롬프트 / frame ID |
| ----------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------- |
| 카탈로그 탐색 `/admin/platform/catalog`   | `CatalogExplorer`; catalog graph/assurance API                           | graph/inventory/assurance, 선택·depth·operation 영향, 관계 declare/retire, assurance 평가/finding 처분                                                | 앱 레지스트리와 구분; 그래프 동등 텍스트 제공, 홈 위젯→원천→권한→책임 drill-down                                 | 09 / `P09-P01`      |
| 기준정보 `/admin/platform/reference-data` | `ReferenceDataManager`; platform-admin reference sets API                | 코드세트/값/ko-en labels/parent/validity/order, draft/active/retired, metrics/선택/활동 이력                                                          | 목록·값 편집·계층·연관 변경 영향이 연결되게; 변경 값 활성화가 소급 재해석될 수 있음 설명                         | 09 / `P09-P02`      |
| 앱 레지스트리 `/admin/platform/registry`  | `RegistryManager`; platform-registry API                                 | 타입·key·name·owner/risk/artifactVersion, draft/revision edit/activate/retire; 현재 dialog APP/CONNECTOR/AGENT/TOOL/POLICY                            | API 타입 API/DATA_PRODUCT는 존재하나 dialog 미지원; 미지원 타입 등록 버튼 발명 금지, 홈 앱 배치와 제공 권한 분리 | 09 / `P09-P03`      |
| 내비게이션 `/admin/platform/navigation`   | `NavigationManager` from navigation-studio-manager; navigation-admin API | menu tree DnD/keyboard reorder, multilingual/resource/registry refs, studio draft/save/publish/cancel/history/restore·validation/diff/runtime preview | 모든 역할에 보이는 메뉴로 잘못 preview하지 않음; 정책 변경과 메뉴 링크 변경을 구분                               | 09 / `P09-P04`      |

## 5. 중앙 관리콘솔: 연계 1개·거버넌스 5개 + legacy 1개 전체

| 현재 표시명 / route                                    | 실제 렌더러 / API                                                           | 현재 기능·하위공간                                                                                                                | 핵심 갭·권한                                                                                             | 프롬프트 / frame ID           |
| ------------------------------------------------------ | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 생산성 커넥터 `/admin/integrations/productivity`       | `ProductivityConnectorManager`; productivity-connector API                  | 현재 MICROSOFT_GRAPH/DELEGATED만, connector config/check/activate/suspend, consent subjects, INITIAL/DELTA/RESET runs·safe errors | `ADMIN.PRODUCTIVITY_CONNECTOR MANAGE`; 활성·동의·sync·홈 원천 신선도 서로 구분, 다중 provider는 제안     | 10 / `P10-N01`                |
| API 모니터링 `/admin/governance/api-monitoring`        | `ApiMonitoring`; api-history + audit API                                    | window/observation/service/method/outcome/search/pause, error/latency/traffic/routes/events/trace/change correlation              | `ADMIN.API_MONITORING`; 고객 영향→문제 route→trace/설정 변경, 숫자 카드나 범용 운영 대시보드로 축소 금지 | 10 / `P10-G01`                |
| 감사 관제 `/admin/governance/audit-overview`           | `AuditOverview`; audit-control API                                          | 기간, risks/findings/cases/actors/domains/source health·증적 drill-down                                                           | `ADMIN.AUDIT_VIEW`; 예외/통제 공백을 먼저, 제한된 데이터를 위험 0로표시 금지                             | 10 / `P10-G02`                |
| 조사 워크벤치 `/admin/governance/audit-investigations` | `AuditInvestigations` + case/finding action rails; audit-control API        | `?view=findings/cases&finding=…&case=…`, context/workspace, 판단/담당/증거/notes/tasks/closure                                    | `ADMIN.AUDIT_INVESTIGATE UPDATE`; 선정 증거와 판정 근거·구제/복구를 연결                                 | 10 / `P10-G03`                |
| 증적 탐색기 `/admin/governance/audit-events`           | `AuditEvidenceWorkspace`, correlations + `AuditExplorer`; audit-control API | `?mode=events`/correlations, 필터/저장검색/증거 detail/추적/케이스 link/export                                                    | `ADMIN.AUDIT_VIEW`; 불변 증거를 편집 데이터로 디자인 금지, 반출 권한·사유·보존을 분리                    | 10 / `P10-G04-C`, `P10-G04-E` |
| 증적 거버넌스 `/admin/governance/audit-governance`     | `AuditGovernance`; audit-control API                                        | retention/risk/exportLimit/reason/integrity, policy revision create/submit/decide/publish/rollback; checkpoints                   | `ADMIN.AUDIT_CONFIGURE MANAGE`; 보존 정책의 삭제 영향/승인·게시·복원·무결성 결과를 구분                  | 10 / `P10-G05`                |
| 감사 로그 legacy `/admin/governance/audit`             | `AuditLog`; identity/platform audit aggregation                             | 직접 route 유지, 정식 탐색에는 없음                                                                                               | `ADMIN.AUDIT_VIEW`; 신규 작업은 증적 탐색기로 안내하되 구 링크 호환성 유지                               | 10 / `P10-G06-L`              |

## 6. 신규 route 제안 10개: 미구현 상태 명시

기존 기능을 새 route에 연결하는 정보구조 변경과 신규 서버 기능을 구분한다. 아래 10개 route는 후보이며 전부를 새 탐색 메뉴로 추가하라는 요구가 아니다. 기존 메뉴의 탭·inspector·작업공간이 같은 운영 질문을 해결하면 그 안에서 확장한다. 독립적인 질문·책임·권한·수명주기가 필요하면 신규 메뉴도 가능하다. 디자인 검토용 신규 메뉴에는 `제안 · 구현 예정` 상태를 명시한다. 구현된 뒤에만 해당 라벨을 제거한다.

| 제안 route / 이름                                            | 이유·기존 연결                                                                    | 추가 구현 계약                                                                                            | 프롬프트 frame ID |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------- |
| `/account/overview` 내 경험 센터                             | 8개 설정으로 갈 때 맥락 없는 탐색을 줄임                                          | read-only 집계와 deep link; 위험 점수·활동 감시 새로 만들지 않음                                          | `P07-N01`         |
| `/account/connections` 연결된 앱 및 데이터                   | 개인 동의·알림 endpoint·홈 source범위가 분산                                      | 현행 개인 동의 API 연결 검증 필요, provider별 disconnect·재동의 capability 계약 추가                      | `P07-N02`         |
| `/account/settings/home-history` 홈 뷰 및 복원               | home view/revision/device layout API는 현재 존재                                  | 현재 홈 편집기 기능을 읽기 전용 목록/복원 작업으로 연결;개인정보·조직 정책 복원 권한 금지                 | `P07-N03`         |
| `/admin/experience/overview` 경험 운영 센터                  | 6개 경험 메뉴가 동등 목록이라 현재 모드/게시 상태 파악 어려움                     | 정책·버전·capability·검증 집계, 변경할 메뉴 딥링크; 건강한 상태 압축                                      | `P08-N01`         |
| `/admin/experience/home-targeting` 홈 대상 정책              | 현재 모드는 테넌트 정책, 청사진은 audience를가짐;역할/조직별 mode도입은 별도 문제 | 대상 조건·우선순위·fallback·effective reason·충돌 평가 신규 서버 계약                                     | `P08-N02`         |
| `/admin/experience/home-release-validation` 홈 게시 검증     | 모드복원/반응형/권한/개인 배치 회귀를 게시 전에 드러냄                            | 검증 run·scope·snapshot·변경 비교·승인/게시별 capability 신규 계약, 스냅샷만으로 실데이터 인증 금지       | `P08-N03`         |
| `/admin/platform/widget-contracts` 위젯 계약 스튜디오        | 기존 빌드 카탈로그를 우선 read-only 연결;위젯 등록은 코드/원천 계약 필요          | 새로운 위젯 정의 버전·source/permission/config/action 계약 검증은 추가 기능, 임의 코드 업로드 금지        | `P09-N01`         |
| `/admin/integrations/home-data-sources` 홈 데이터 원천 운영  | 홈 partial failure의 원인을 담당 운영자가 찾아야 함                               | 원천별 freshness/coverage/owner/trace 집계·권한 경계 신규 계약                                            | `P10-N02`         |
| `/admin/governance/home-quality` 홈 품질 및 접근성           | 과한 빈 영역/사용 불가 widget/출처 충돌/회귀를 운영 지표로 관리                   | 개인 행동 감시 없는 집계, 동의된 익명 usage와 A11y/실패/회복 검증 신규 계약                               | `P10-N03`         |
| `/admin/governance/experience-change-control` 경험 변경 통제 | 브랜딩/홈/앱 배치/탐색/번역 각각의 게시 단위를 존중하며 조합 검토                 | multi-domain release manifest·승인 분리·복원 scope 신규 서버 계약;기존 API 원자성으로 조합 게시 발명 금지 | `P10-N04`         |

## 7. 기존 앱 운영 메뉴를 중앙 신규 기능으로 오인하지 않는 연결

`routes/administration-routes.tsx:180–193`의 legacy 중앙 메뉴는 이미 앱 route로 이동한다. 이 목록은 신규 route 10개 집계에 넣지 않는다.

| legacy 중앙 route                                                                                            | 현재 제품 운영 대상                                                                                            | 디자인 범위 원칙                                                           |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `/admin/experience/announcements`                                                                            | Communications 소식/공지 운영 (`/communications/admin/...`)                                                    | 사내소식 위젯→대상/승인/게시 원천으로 연결;홈에서 뉴스 편집 중복 생성 금지 |
| `/admin/services/service-catalog`, `service-operations`                                                      | `/services/admin/catalog`, `/services/admin/operations`                                                        | 필수 확인·서비스 기한 위젯의 SLA/담당 원천 연결                            |
| `/admin/notifications/overview`, `contracts`, `policies`, `operations`                                       | `/notifications/admin/overview`, `contracts`, `policies`, `operations` (추가 templates/suppressions도앱에존재) | 홈 배지·답변 필요가 알림 정책과 같지 않음을 보임;채널 전달 원천 연결       |
| `/admin/spaces/overview`, `directory`, `requests`, `templates`, `content-reviews`, `lifecycle`, `operations` | Space 앱의 각 운영 route                                                                                       | 협업 widget→Space 상태·권한·수명주기 원천 연결                             |

계정/중앙 관리콘솔 전체 33개는 본 패킷에 개별 프롬프트가 있고, 앱별 위젯·운영 범위는 해당 앱 담당 설계와 합쳐야 한다. Provider control plane은 고객 테넌트 중앙 관리콘솔과 별도 영역이며 본 고객 홈 리뉴얼에서 고객 데이터를 무차별 노출하지 않는다.

## 8. 권위와 저장 계약

1. **홈 제품 모드:** 현행 `compositionPolicy.experienceVariant = CLASSIC | FLOW_V1`; 서버 `effectiveExperienceVariant`가 policy + kill-switch 평가 결과이며 표시 권위다. 신규 제 3 모드는 아직 enum에 없다. 서버 capability·fallback·migration 계약 후 표시한다.
2. **화면 폭/표현:** 개인 `presentation = focused | balanced | expressive`는 제품 모드가 아니다. Flow UI의 wide 표현이 expressive와 매핑돼도 mode 선택과별개 control이어야한다. widget width/height(`fifth`~~`full`, `short`~~`expanded`)와도 구분한다.
3. **홈 배치:** 테넌트 앱 group/placements 및 governed announcements, 개인 appLayout/widgets, named home views·device layouts·template는 서로 다른 저장 단위다. 개인 reset은 테넌트 mode를 바꾸지 않는다. 현재 코드의 섹션 순서는 새 리뉴얼의 고정 승인 조건이 아니며, Classic 조직 콘텐츠·Flow 개인 실행·Adaptive/AI Stage 의도의 모드별 위계를 P00대로 검토한다.
4. **배치와 권한:** 홈 앱에 배치하는 일은 앱 VIEW 권한 부여가 아니다. 카탈로그 등록/테넌트제공/책임 assignment/사용자 접근 요청/최종 권한은 서로 다르다.
5. **기능 지원:** WidgetLibrary의 현재 빌드 정의는 서버에서 편집하는 위젯 마켓플레이스가 아니다. unsupported위젯은 숨기거나 이유/담당 경로를 표시하고 재시도 버튼으로 미지원 기능을 실행하지 않는다.
6. **갱신 시각:** 홈 데이터 갱신, 정책게시, 개인 배치저장, 원천마지막 성공 sync를 합친 하나의 시각으로 표시하지 않는다. 동일 원천 동일 scope시각만 한 곳으로 통합한다.
7. **게시·복원:** 모든 사용자 영향 게시에는 대상/버전/변경 scope/영향/권한/진행/충돌/검증 결과·감사 link를 설계한다. 현행 홈·앱 배치·브랜딩 게시의 독립 승인 체인은 확인되지 않았다. 별도 승인/예약 게시/분할 배포는 명시적 추가 제안이다.
8. **조회·검토·실행:** 현재 capability가 REFERENCE/REVIEW이면 조회·근거·원본 앱의 검토 화면으로 연결한다. EXECUTE는 실제 서버 권한·승인·command 계약이 허용하는 행동에서만 제공한다. 디자인의 실행안 미리보기나 client 함수 존재를 실사용자의 실행 권한·완료 결과로 과장하지 않는다.

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
