# DWP 독립 전달 합본 — P07

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

# P07 — 계정설정 전체 리뉴얼: 디자인 AI 전달 프롬프트

아래 내용을 [P00 공통 계약](../prompts/00-common-contract.md), [메뉴·권위 계약](../contracts/account-admin-menu-inventory.md)과 함께 사용하세요. 공통 계약은 모든 프레임에 적용합니다. 현행 계정 8메뉴를 빠짐없이 디자인하고 신규 제안 3메뉴는 `제안 · 구현 예정`으로 구분하세요. 실제 직원/연락처/보안 정보 대신 `이서윤 / Product Operations / user01@example.test` 등 가상 데이터를 사용하세요.

**제품과 목표.** DWP는 업무, AI, 활동, 전자결재, 알림, 소식, 캘린더, 메일, Space, 근무 공간, 서비스, 인사, 지식, ERP, 레거시, 관리 앱을 연결하는 기업 디지털 근무 플랫폼입니다. 계정설정은 자기 경험을 안전하게 바꾸고, 변경 권위·효과·저장 상태를 이해하는 공간입니다. 규칙적인 입력 행을 무수히 쌓는 관리 DB 뷰처럼 만들지 마세요. 하나의 목적에는 focus form, 비교에는 list-detail, 여러 상태의 복원에는 workflow를 사용하세요. 차분하면서 선명한 타이포그래피, 명확한 선택 상태, 의미 있는 색과 실제 적용 미리보기로 제품의 얼굴인 홈과 일관되게 만드세요.

## 공통 계정 shell · `P07-S00`

- 사용자: 테넌트 구성원. 질문: “무엇을 직접 바꿀 수 있고 무엇을 조직이 관리하는가?” 페이지 유형: 설정 허브와 focus form.
- 데스크톱: 계정/환경설정/조직 3그룹 탐색 + 안정된 content grid. 현재 사용자와 조직 scope, 돌아갈 작업공간을 보이세요. 메뉴명은 프로필, 보안 및 세션, 화면 모양, 접근성, 언어 및 지역, 홈 워크스페이스, 알림, 관리형 설정입니다.
- 모바일: drawer 탐색·현재 페이지 제목·뒤로가기. 탭이나 8개 항목을 좁은 가로 스크롤로 숨기지 마세요. 320px에서 핵심 control은 충분한 너비와 44px touch target을 확보하고, URL/이메일/긴 한·영 라벨은 줄바꿈합니다.
- 개인 저장 상태는 페이지 우측 상단의 일관된 `저장 중 / 저장됨 / 저장 실패 · 다시 시도`로 보입니다. 저장 전 서버 원천을 읽지 못한 경우 control을 막고 원천 오류와 재시도를 제공합니다. 불러오기 실패를 기본값으로 덮어쓰지 마세요.
- `내가 선택함 / 조직 기본값 / 조직에서 고정 / 승인된 예외`를 값 근처에서 구분합니다. 조직 관리값은 잠긴 control과 담당자·정책 근거·예외 요청 경로를 제공하세요.
- Provider 운영자 계정은 홈·알림·관리형 설정이 없고, 일부 환경설정은 브라우저에만 저장됩니다. 고객 테넌트 설정을 수정하는 것처럼 보이는 화면을 만들지 마세요. support context 경계는 별도 상태입니다.

## 1. 프로필 · `P07-A01` · `/account/profile` · 현행

**사용자 / 질문 / 액션 / 유형:** 구성원 / “시스템은 나를 어떤 조직·직무로 인식하는가?” / 원천 확인, 정정 담당 경로 / read-only identity focus form.

**화면 구조:** compact avatar + 이름·직무·조직 요약. 아래를 `기본 신원 / 소속 및 업무 / 관리 원천` 세 묶음으로 나눕니다. 각 필드에는 값과 관리 원천을 함께 배치합니다. 현행 `getMe`의 실제 필드만 사용하고 없는 필드는 상세한 개인정보처럼 꾸며내지 않습니다. 정보 정정 안내는 담당 경로가 존재할 때 실제 deep link, 없을 때 `조직 담당자에게 확인` 안내로 표시합니다.

**필드·controls·detail:** 이름, 이메일, 직원 식별/조직/직무 등 지원 필드; 텍스트 선택·복사 가능. 소속이 여러 개일 때 주 소속과 추가 소속은 데이터 계약이 확인된 경우에만 표시. 배지 클릭으로 관리 원천 설명을 열 수 있습니다. 직접 프로필 사진 업로드/이름 변경은 현행 미지원이며 원천 시스템 정정과 혼동하지 않습니다.

**상태·flow:** skeleton→정상 조회, 값 없음 `등록되지 않음`, 전체 조회 오류→재시도. Provider 신원은 직원번호 등 테넌트 인력 데이터와 다른 필드 설명. 정정 경로→원천 안내→복귀 시 동일 항목 초점. UI 변경만으로 HR 데이터의 편집권한을 새로 부여하지 않습니다.

**필수 추가 프레임:** 정상 한국어/영어, 소속 누락, 조회 실패, 원천 설명 inspector, 390/320px.

## 2. 보안 및 세션 · `P07-A02` · `/account/security` · 현행

**사용자 / 질문 / 액션 / 유형:** 구성원 / “어느 기기에서 접속 중이며 일시 권한은 언제 끝나는가?” / 불필요 세션 종료, 특권 접근 요청·활성화·종료 / security posture + session list-detail + limited workflow.

**화면 구조:** 상단 인증 정책(조직 관리 SSO/IdP 등 지원 상태)과 자신의 조치가 필요한 상태. 아래 기기·세션 목록(현재 세션 표시, 기기 종류, 위치/IP는 지원 데이터만, 마지막 활동, 시작 시각, 종료 action) 및 별도 `일시 특권 접근` 영역을 둡니다. 조직 보안 정책을 구성원이 편집하는 dashboard로 만들지 마세요.

**필드·controls·detail:** 기기 세션 선택→접속 상세 inspector. `이 세션 종료`와 `다른 모든 세션 종료`를 구분합니다. 현재 세션 종료는 재로그인 결과를 명확히 안내. 일시 권한은 요청 범위/업무 근거/기간/활성화 요구 assurance, 정책에 따른 직접 활성 요청 또는 승인 대기→활성→만료/철회 과정을 시간축과 실제 상태로 제시합니다. 지원하는 정책/요청 필드만 디자인하고 MFA 새 등록/패스키 추가 등 인증기능은 임의 발명하지 않습니다.

**상태·flow:** 정책 API만 실패해도 세션 목록은 유지; 세션 실패는 해당 영역 retry. 종료 확인에는 기기/현재 여부/로그아웃 결과→처리 중 중복조치 방지→성공 목록 갱신. 실패하면 실패한 세션을 남겨 재시도. 현재 세션이 만료되면 안전한 로그인 복귀. 특권 요청 생성은 승인 자동부여가 아니며 활성화 후에는 잔여시간과 종료 결과가 보입니다.

**필수 프레임:** 현재+다른 세션 3개, 세션 하나만 있는 상태, 종료 확인/진행/실패, 특권 대기/활성/만료, 부분 API 실패, 모바일 detail.

## 3. 화면 모양 · `P07-A03` · `/account/settings/appearance` · 현행

**사용자 / 질문 / 액션 / 유형:** 구성원 / “어떤 화면 모양이 내 업무에 가장 읽기 편한가?” / mode·density 변경, 환경설정 초기화 / preview-linked focus form.

**화면 구조:** 왼쪽/상단 색상과 밀도 선택, 오른쪽/아래 `실제 DWP 화면 샘플` 하나. 모드는 시스템/라이트/다크, 밀도는 compact/standard/comfortable입니다. 선택된 옵션과 시스템이 현재 해석한 실제 모드를 함께 표시합니다. 미리보기에는 홈의 내 앱 일부·업무 행·버튼·입력·포커스를 포함하고 실제 제품과 다르게 예쁘게 꾸민 작은 썸네일만 보여주지 마세요.

**controls:** 선택은 라디오 카드 또는 segmented control, keyboard focus와 selected 별도 표현. 밀도 변경 시 행 높이·정보량·터치 크기의 실제 차이를 미리보기에 반영. 관리형 제품 글꼴/강조색은 별도 read-only 설명과 관리형 설정 link. 개인 모드와 Classic/Flow/제 3 홈 모드는 다른 설정입니다.

**상태·flow:** 변경→즉시 적용 + 저장중→성공/실패·retry. 서버 실패 후 UI는 임시 적용 상태임을 설명하고 마지막 저장값으로 복원 가능. 초기화 확인에는 `색상·밀도 등 개인 환경설정`의 정확한 reset scope; 홈 앱 배치·홈 제품 모드·조직 정책까지 초기화한다고 말하지 않습니다. Provider에는 `이 브라우저에 저장` 문구.

**필수 프레임:** 시스템이 다크로 해석, 밀도 3개 비교, 저장 실패/재시도, 초기화 확인, light/dark/high contrast.

## 4. 접근성 · `P07-A04` · `/account/settings/accessibility` · 현행

**사용자 / 질문 / 액션 / 유형:** 모든 구성원, 특히 시각/움직임 민감 사용자 / “제품을 편하게 읽고 조작할 수 있는가?” / 고대비·움직임·링크·투명도 선택 / accessible focus form.

**화면 구조:** `읽기 명료도`(고대비, 링크 항상 밑줄, 투명도 줄이기)와 `움직임`(움직임 줄이기) 두 묶음, 연동 샘플. 각 switch 옆에 한 문장 효과와 적용 범위를 설명합니다. 설정화면 자체가 고대비/키보드 사용자에게 어려워서는 안 됩니다.

**controls·detail:** switch label 전체 클릭, 접근성 상태를 color+text로 표현. 링크 샘플에 항상 밑줄 전후, 내 앱 아이콘/배경 샘플에 투명도 전후, focus 샘플에 고대비 효과, reduced motion에는 사용자가 직접 재생한 짧은 상태 전환 예시를 제공합니다. 자동 반복 animation은 쓰지 마세요. 시스템 prefers-reduced-motion과 개인 설정의 effective 우선순위는 현재 제품 정책이 확인된 뒤 설명합니다.

**상태·flow:** 저장 오류/retry/초기화 동일 계약. 설정을 끄더라도 최소 명암·가시적 focus·필수 접근성은 유지됩니다. 정보가 투명한 카드 안에서 사라지는 디자인을 기본안으로 제출하지 않습니다.

**필수 프레임:** 고대비 켜짐, 투명도 줄이기, 키보드 focus path, 실패 상태, 200% zoom·320px.

## 5. 언어 및 지역 · `P07-A05` · `/account/settings/language` · 현행

**사용자 / 질문 / 액션 / 유형:** 한·영 구성원 / “언어·날짜·시간·숫자가 업무 의미를 정확히 전달하는가?” / 언어·지역 선택 / regional focus form with example.

**화면 구조:** 제품 언어 ko/en, 시간대 검색, 날짜 형식, 12/24/언어기본 시간, 주 시작일, 숫자 형식. 오른쪽/하단에 하나의 `표시 예제`: 회의 시작 시각/원천 시간대, 결재 마감일, 주간 캘린더, 수치. 한 설정을 바꾸면 예제 전체가 함께 바뀝니다.

**controls·detail:** IANA 시간대는 검색 가능한 select이며 도시명·UTC offset·DST 적용은 실제 지원 범위 표시. 언어변경은 제품 레이블 변경이지 원문 자동번역이 아닙니다. 원천 일정의 time zone과 개인 표시 time zone을 함께 보여줍니다. 예제 숫자는 가상이며 실제 금액을 보여주지 않습니다.

**상태·flow:** 언어와 지역이 서로 다른 저장원천인 현행 제약을 UI의 저장결과로 정직하게 표시. 언어 성공·지역 실패 경우 둘 다 성공으로 통지하지 않습니다. 동시 저장중/부분 실패→해당 선택 유지→원천별 retry. 지원코드 조회 실패 시 사용할 수 있는 fallback이 있는 경우 설명. 다른 메뉴에서 돌아오면 section URL 유지.

**필수 프레임:** ko/KST와 en/다른 시간대, 긴 시간대 라벨, 부분 저장 실패, 날짜 경계/시간대 안내, 모바일.

## 6. 홈 워크스페이스 · `P07-A06` · `/account/settings/home` · 현행 + 명시적 확장

**사용자 / 질문 / 액션 / 유형:** 구성원 / “현재 어떤 홈이 적용되고 어디까지 개인화할 수 있는가?” / 홈 편집 시작, 뷰·표현·배치 확인 / personal experience hub.

**현행 경계:** 이 메뉴의 현재 기능은 `홈 편집` 버튼으로 `/?edit=home` 이동입니다. 새 설정 시작점은 기존 home preference/views/device layouts 기능을 통합 연결하는 확장안이며 새로운 모드 결정권을 개인에게 자동 부여하지 않습니다.

**화면 구조:** `현재 홈` compact preview + `제품 모드 / 표현 폭 / 내 홈 뷰 / 적용 기기 / 조직 관리 영역` 5개의 명확한 행. 제품 모드는 서버 effective CLASSIC/FLOW_V1. 제 3 모드는 제안입니다. 개인 focused/balanced/expressive는 별도, Flow의 와이드 표현이 expressive여도 모드 전환과 다릅니다. 개인 view와 tenant blueprint는 다른 개념입니다.

**controls·detail:** primary `홈 편집`→기존 편집 studio. 보조 `내 홈 뷰 및 복원`은 제안 route P07-N03. 편집 권한 없음·조직 개인화 비활성·고급 뷰 capability 미지원·legacy store는 각각 다른 안내. 앱 아이콘 5×2와 좌측 연속 배치, governed 사내소식 영역은 편집 가능한 척하지 않습니다. 개인 reset에는 적용 view/device/scope를 정확히 표기.

**flow:** 현재 effective 모드 확인→내가 바꿀 수 있는 scope 설명→studio 이동→미리보기→개인 layout 저장→계정에서 저장버전 확인. 조직 모드 변경 때문에 Classic→Flow가 달라진 경우 사용자 변경으로 추정하지 말고 정책 적용 결과를 안내. 레이아웃 저장 실패/동시 수정 버전 충돌→내 변경 값 보존→새 서버값 확인/다시적용. 조직 policy rollback으로 개인 뷰를 지워버리지 않습니다.

**필수 프레임:** Classic 적용/Flow 적용, 개인화 불가, VIEWS 미지원, 와이드 vs 표준 실제차이, 새 정책 적용 알림, 충돌 복구, 모바일 편집 연결.

## 7. 알림 · `P07-A07` · `/account/settings/notifications` → `/notifications/settings` · 현행

**사용자 / 질문 / 액션 / 유형:** 구성원 / “중요한 일을 놓치지 않으면서 불필요한 알림을 줄일 수 있는가?” / 채널/quiet hours/앱·유형 조정, 전달 진단 / preference studio + diagnostics.

**경계:** 독립 알림 앱의 현재 설정을 리뉴얼하고 계정 탐색에서 안전하게 연결하세요. 둘의 규칙을 별도 저장하는 두 번째 알림 설정 메뉴를 만들지 마세요.

**화면 구조:** 상단 `수신 설정 / 전달 진단` 두 뷰. 수신 설정 안에 전역 채널 상태·조용한 시간·앱·유형규칙. 조직 의무 정책과 실제 적용값(effective), 사용자 선택값을 구분합니다. 앱 선택→유형별 규칙으로 단계적으로 좁힙니다. 좁은 화면에서 거대한 app×channel 표를 강제하지 않습니다.

**controls·detail:** 사용 가능 채널은 capabilities에서 결정. quiet hours 시작/종료/시간대/예외, 유형별 수신·채널 overrides와 조직강제 규칙의 이유. delivery endpoints와 revoke는 개인정보 없는 기기/상태로. diagnostics에는 실제 effective 설정·endpoint 도달가능성·오류·마지막 성공 등 지원 값. 테스트 발송 기능은 서버 capability가 없으면 `추가 제안`이고 작동하는 버튼으로 그리지 않습니다.

**flow·states:** 사용자 선택→버전 저장→충돌 시 rebase/retry→보존되는 선택 확인. offline·권한 없음·채널미지원·endpoint없음·부분 API 실패를 구분합니다. 조직이 중요 알림을 강제하는 경우 switch disabled + 이유. quiet hours는 결재기한 연장을 뜻하지 않고, 홈 배지/답변 필요/위젯 count는 channel delivery와 다른 정보입니다. `계정설정으로 돌아가기`에 원래 context 유지.

**필수 프레임:** global/앱/유형, 의무 알림 잠금, 자정을 넘는 quiet hours 예시, 저장 충돌 복구, endpoint철회, diagnostics부분 실패, 320px.

## 8. 관리형 설정 · `P07-A08` · `/account/settings/managed` · 현행

**사용자 / 질문 / 액션 / 유형:** 구성원 / “조직이 무엇을 정했고 다른 값이 필요한 경우 어떻게 요청하는가?” / 정책 확인, 예외 요청/취소 / policy focus form + request tracking.

**화면 구조:** `조직 정책`(원천·담당자·버전/갱신은 지원 필드), `관리형 값`(제품 글꼴·강조색·탐색 패턴), `내 예외 요청` 목록. 잠긴 값은 회색으로 숨기지 말고 현재 value와 관리 이유를 분명히. approved exception은 조직 기본값과 별도 표시.

**controls·detail:** exceptionAllowed인 rule에만 `예외 요청`. 요청 form은 대상 경로/조직값/요청값/업무 근거/업무 영향. pending 중 duplicate request 금지와 `기존 요청 보기`. 취소는 pending에만 지원 조건에 맞게. 요청 detail에는 사유·판정·담당/evidence·현재 effect를 지원되는 범위만 보여줍니다. HR/보안 권한 예외와 개인 환경설정 예외는 다른 workflow입니다.

**flow·states:** rule 선택→요청값 검증→업무 영향 입력→미리보기→제출→대기→승인/반려. 예외 승인 결과가 언제까지 유효한지는 실제 계약이 있으면 표기; 계약에 없는 만료/예약 기능을 발명하지 않습니다. 정책/예외 목록 부분조회 실패→성공부분 유지 + 영역 retry. 값 저장·심사·시스템 적용은 서로 다른 상태. 반려 시 설명을 보고 새 요청 작성 가능.

**필수 프레임:** 조직고정/예외 가능/승인예외, 요청 form 및 validation, pending duplicate, 반려근거, 취소/실패, policy 조회 실패.

## 9. 신규 제안: 내 경험 센터 · `P07-N01` · `/account/overview`

유형: personal command center. 질문: “내 경험 설정에서 지금 확인할 것은 무엇인가?” 이름/조직 scope, 현재 home effective 모드·개인 view, 표시환경, 연결상태·보안세션, pending 예외를 작은 요약으로 연결하세요. 성격이 다른 KPIs를 꾸며내지 말고 `동기화되지 않은 개인 설정 1건` 같은 실제 action을 우선합니다. 지원 summary endpoint가 없으면 기존 데이터를 read-only 조합하는 구현 예정 영역으로 표기하세요. 클릭→정확한 설정 section, 뒤로가기는 원래 scope 유지. 건강한 값은 한 줄로 압축. 사용자 행동 점수나 근무감시 지표는 추가하지 않습니다.

## 10. 신규 제안: 연결된 앱 및 데이터 · `P07-N02` · `/account/connections`

유형: permission-aware connection list-detail. 질문: “어떤 앱의 어떤 데이터를 DWP가 사용하며 연결을 끊으면 어디에 영향이 있는가?” 카드 하나는 connector/provider + 지원 capability + 사용 중인 mail/calendar/home widget + 마지막 성공 + 개인 consent/effective scope. 재동의/disconnect에 impact preview(메일/일정위젯 영향)와 permission-aware action. secret/token 표시 금지. 현재 Provider 지원이 MICROSOFT_GRAPH/DELEGATED로 제한된 부분은 그대로 표시하며 Google/Slack 등은 `제안 · 별도 연계 필요`. 조직 활성화와 개인동의가 모두 필요한 상태, 조직정지, 토큰만료, 재동의 실패, 연결철회 후 stale data 취급을 상세 프레임으로 요청합니다. 개인 연결 관리 API 지원 여부를 구현 전에 검증해야 합니다.

## 11. 신규 제안: 홈 뷰 및 복원 · `P07-N03` · `/account/settings/home-history`

유형: personal history workflow. 현재 home views/revisions/device layouts API를 연결하는 새 route입니다. 뷰 이름·활성여부·표현·적용기기·최근 저장 버전 목록→선택한 revision 비교→내 app/widgets 변경 preview→복원 confirmation→실행→활성뷰 및 실제홈 확인. 테넌트 모드/브랜딩/governed zone 복원은 불가. 선택한 과거 위젯이 현재 빌드 미지원/권한없으면 그 부분의 정합성 문제와 가능한 복구를 설명하고 성공으로 숨기지 않습니다. 모바일의 layout override·desktop baseline 관계, no revisions·버전 충돌·원천부분 실패·복원실패·권한변화 프레임을 포함하세요.

## 제출물 및 공통 검증

Frame ID별 desktop 1440/1280, mobile 390/320 및 200% zoom의 주요 여정을 제출하세요. 한·영, light/dark/high contrast, reduced motion, 키보드 focus·touch 상태는 P00 공통 계약으로 필수입니다. 읽기 전용 값/조직 정책/개인저장 scope를 annotation으로 표시하고 신규 기능은 반드시 제안으로 구분하세요. 레이아웃만 그리지 말고 실제 선택→저장→실패→복구·이동→복귀를 prototype으로 연결하세요.

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
