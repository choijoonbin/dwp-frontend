# DWP 독립 전달 합본 — P09

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

# P09 — 관리콘솔: ID·접근 권한 및 플랫폼 전체 디자인 AI 프롬프트

[P00 공통 계약](../prompts/00-common-contract.md)과 [메뉴·권위 계약](../contracts/account-admin-menu-inventory.md)을 함께 전달하세요. 중앙 관리콘솔의 **현행 ID/접근 8메뉴 + 플랫폼 4메뉴** 모두를 개별 작업으로 디자인합니다. 테이블에 항목 이름만 바꾼 같은 CRUD template를 적용하지 마세요. 각 화면의 사용자, 질문, 주 행동, 화면 유형, 작업 흐름과 실행 결과가 다릅니다. 개인정보·보안·인력 예시는 가상 데이터만 사용합니다.

## 공통 shell과 운영 계약 · `P09-S00`

조직 scope, 로그인 역할/지원 context의 권한 범위, 현재 페이지와 담당 책임이 명확합니다. 운영 테이블에는 filter/saved state/selection/inspector, 로딩·빈값·오류·부분 실패·권한 없음이 필요합니다. URL에 scope/filter/tab/selection/detail을 보존하는 새 설계를 요청하고 **현재 local state인 구현은 추가 개선**으로 annotation 합니다. 앱 배치/카탈로그 등록/운영 책임/접근 권한/최종 effective permission은 별도 권위입니다.

권한 변경에는 변경 대상·범위·기간·근거·승인/실행 권위·미리보기·진행·복구·감사증거를 디자인하세요. 실제 API에 없는 승인 단계/일괄처리/자동 rollback은 제안으로 표시합니다. 원천 조회 실패를 `권한 없음`이나 `0명`으로 축약하지 마세요. 모바일의 조사/판정은 가로로 끝없이 이어진 테이블보다 목록→detail→action의 명확한 흐름을 제공합니다.

## 1. 접근 제어 · `P09-I01` · `/admin/identity/access`

- **사용자 / 질문 / action / 유형:** ID 운영자 / “이 사용자에게 직접 부여한 역할과 최종 접근은 어떻게 다른가?” / 직접 역할의 근거 있는 변경 / user list-detail.
- **구조:** 사용자 검색·필터·선택 목록(가상 이름/소속/직접 역할/상속·일시 권한 요약), 선택 사용자 inspector(직접/그룹 상속/일시 특권 구분), `직접 역할 수정` form. 현행 listIdentityUsers/listIdentityRoles/replaceIdentityUserRoles를 반영합니다.
- **필드:** 사용자 고정, 직접 assigned role 다중선택, 추가 역할, 변경 근거. inherited count와 privileged 상태는 읽기 전용이고 `역할 및 권한 → 최종 권한`으로 연결합니다. 직접 역할 replace의 전체 전후 diff를 표시해 추가 한 개만 저장하는 동작으로 오인하지 않게 합니다.
- **flow:** 검색→사용자 선택→직접 역할 전후 비교→근거→impact/confirmation→replace→진행→서버 재조회→감사 link. `ADMIN.IDENTITY_DIRECTORY VIEW`는 열람 경계이며 변경 action에는 실제 mutation 권한을 적용합니다. 상속 역할은 여기서 삭제되지 않습니다.
- **상태/프레임:** no search results, 사용자 조회 부분 실패, role lookup 실패로 편집잠금, 권한 부족, 직접 역할없음·상속존재, 동시 변경/실행 실패/재조회 실패, mobile inspector.

## 2. 앱 책임 관리 · `P09-I02` · `/admin/identity/app-governance`

- **사용자 / 질문 / action / 유형:** 앱 소유자·카탈로그 운영자·위임 책임자 / “누가 어느 앱·자원에 어떤 운영 책임을 언제까지 가지는가?” / 명시된 책임·경계·preset duty 부여와 검토 / responsibility matrix + scope dossier.
- **구조:** responsibilities/assignments, boundaries(resource sets), 운영 preset 작업공간. 행은 사람×앱/자원범위×책임×기간×판정/실행 상태입니다. 선택하면 responsible app/resource set, justification, validTo/reviewDue, approval evidence, 실제 사용가능한 workbench deep link를 보여줍니다.
- **필드·controls:** principal, responsibility(APP_OWNER/APP_ACCESS_MANAGER/APP_ACCESS_APPROVER/APP_ACCESS_REVIEWER 등 서버 정의), scope, validTo, justification. resource boundary는 이름·member resource refs·근거·정확한 범위. preset에는 지원되는 duty 목록·신청 가능 여부·적용 scope·유효기간·reviewDueAt, 요청→승인/반려→활성화→검토→철회. bootstrap assignment는 별도 배지/설명이며 포괄 관리 권한으로 표현하지 않습니다.
- **flow:** 앱/범위 선택→담당자/책임 분리 확인→기간·근거→검토→authorized decision→실행/활성 상태 확인→정해진 앱 운영화면. preset review는 evidence와 RESOLVED/DISMISSED 판단을 보여줍니다. 승인 책임과 실행 책임을 한 명의 `관리자` badge로 묶지 마세요.
- **권한·상태/프레임:** 중앙 permission 또는 앱 responsibility가 허용하는 제한 범위를 유지. 다른 app scope 접근거부·기간 만료·self-review 제약·검토 기한 오류·지원되지 않는 preset·조회 실패/409/activation 실패·revocation impact. table-selection→scope dossier→workflow를 prototype으로 연결합니다.

## 3. 앱 접근 요청 · `P09-I03` · `/admin/identity/app-access-requests`

- **사용자 / 질문 / action / 유형:** 접근 승인자·IAM 실행자 / “이 신청은 타당하며 승인된 접근이 실제 제공됐는가?” / approve/reject, fulfillment, revoke / decision queue + fulfillment workflow.
- **구조:** 요청상태 필터, 업무 질문이 보이는 queue, 신청 detail와 책임·권한 context, 판정 action rail, IAM 실행 evidence. 승인과 provisioned 상태를 독립적으로 보여줍니다.
- **필드:** 요청자·소속·앱·요청권한/역할·업무 근거·신청시각·담당 scope, decision.note, fulfillment.note, 상태·버전·추적참조. 앱 배치가 없다고 접근 권한도 없다고 판단하지 않습니다.
- **flow:** 요청선택→근거/기존접근/담당범위 확인→decision→승인대기 실행큐→fulfill→진행→실제접근/evidence→필요시 revoke. 현행 decideAppAccessRequest/fulfillAppAccessRequest/revokeAppAccessRequest를 반영하고 미지원 자동 IAM 재실행 버튼은 만들지 않습니다.
- **상태/프레임:** pending/approved awaiting fulfillment/fulfilled/rejected/revoked, 조회 중인 요청자 fallback, 권한·책임 scope 불일치, 이미처리·409, execution failed/uncertain·재조회/recovery, 반려사유와 신청자 안내.

## 4. 접근 권한 검토 · `P09-I04` · `/admin/identity/access-reviews`

- **사용자 / 질문 / action / 유형:** 검토 캠페인 책임자·업무 인증자 / “이 접근을 유지할 근거가 있으며 판단 이후 조치가 완료됐는가?” / 캠페인 생성/활성화, item 인증, 완료 / certification campaign workspace.
- **구조:** campaign 목록(대상/기간/담당/상태/판정진행), 선택 campaign의 직접·그룹 상속 item 큐, 선택 evidence dossier, 판정/후속 조치. 상단 진행률에는 분모·대상·평가기준을 표시합니다.
- **필드:** campaign 생성 form은 name/description, scopeType(TENANT/ROLE/GROUP)/scopeRef, reviewerStrategy(TENANT_ADMIN/NAMED_REVIEWER)/reviewerUserId, dueAt입니다. item에는 사용자/권한 원천/role/resource·scope/privileged/근거/판정/사유. 유지/회수 등 실제 decision enum의 의미와 manualRemediation 상태를 설명합니다.
- **flow:** draft campaign→범위 preview→activate→review item→근거 확인→decision(reason)→회수 후속 조치·검증→완료 가능조건→complete→증거. 인증은 즉시 모든 권한회수와 같지 않으며 상속 원천 수정 책임도 드러냅니다.
- **상태/프레임:** 새 캠페인없음, active/완료/기한 초과, evidence partial failure, 권한 없음·self-decision제약, 미판정·manual remediation잔여, complete blocked/진행/실패. 지원되지 않는 bulk approve를 default action으로 만들지 않습니다.

## 5. 역할 및 권한 · `/admin/identity/roles` · 4개 현행 작업공간

### 역할 정의 · `P09-I05-R`

사용자: 접근 모델 책임자. 질문: “이 업무역할은 어느 자원에 어떤 권한을 포함하는가?” 유형: role definition studio. 역할 목록→선택 역할의 code/name/description/roleType/status/version, privileged/assignableToGroups, permission matrix→자원정의·권한편집 form. createGovernanceRole/updateGovernanceRole/replaceGovernanceRolePermissions/createGovernanceResource의 실제 필드를 반영합니다. permission matrix는 resource×action 비교가 목적이며 선택권한의 전체 전후 diff를 제공. resource 검색/등록, supported action code, 대상 scope를 구분합니다. 변경→affected assignments/effective 영향(추가 집계 필요시 제안)→근거/confirmation→진행→재조회. immutable/시스템 역할·자료 조회 부분 fail·permission 전체 교체 실패·409 프레임.

### 그룹 역할 할당 · `P09-I05-A`

사용자: 그룹 접근 운영자. 질문: “어떤 그룹에게 어디까지 언제까지 역할을 할당하는가?” 유형: scoped assignment workflow. listDirectoryGroups 검색→group selection→role selection→scope/scopeRef→validTo→justification→전후 영향 preview→createGroupRoleAssignment→active 확인. 그룹 가입 권한이나 개인 직접 역할을 여기서 같이 편집하지 않습니다. 목록은 source group/role/scope/기간/상태, selection dossier와 revoke 사유. unknown group·조직 scope 필요·만료/중복·조회 부분 fail·revoke 영향·409/진행 실패 프레임.

### 특권 접근 · `P09-I05-P` 및 `-PR/-PE/-PP/-PB`

사용자: 보안/특권 책임자. 질문: “누가 어떤 특권을 언제 왜 활성화하며 비상 접근은 어떤 통제를 받는가?” 유형: just-in-time access operations. 현행 Requests/Eligibilities/Policies/Boundaries 4뷰를 별도로 설계합니다. 요청은 신청 범위/기간/근거/assurance·decision·activation 상태; eligibility는 대상/역할/자원/유효기간·승인 근거; policy는 activationMode/assurance/maximumDuration/emergencyMode 등 지원 필드; boundary는 자원 action·검토 기한·비상 조건/정당화. 요청 승인과 실제 특권 활성화는 다릅니다. 정책이나 경계를 바꿀 때 영향/근거·승인 권위·progress·recovery·audit를 연결합니다. 비상 접근의 사후 검토/만료 상태를 명확히. 대기/활성/만료/철회·assurance 미충족·권한 없음·기한 오류·정책 부분 실패·중복 실행/불확실 결과 프레임.

### 최종 접근 검증 · `P09-I05-E`

사용자: 접근 조사자. 질문: “이 사용자가 이 자원에 접근 가능한 실제 이유는 무엇인가?” 유형: effective permission investigator. 사용자 search→resource/action 선택·검색→getEffectiveAccess→direct/group/role/privileged provenance tree + effective permissions table. 사용자의 과거 권한이나 실시간 source가 없는 경우 현재 판정 시각/자료 scope를 명시합니다. 테이블 행 선택→모든 allow/deny contribution과 source 책임 deep link, denied reason, 유효기간/범위. 권한을 검사하면서 자동 부여하는 버튼은 금지. 데이터 없음·사용자 조회 실패·effective API 실패·부분 source/제한 권한 상태. 검증은 “권한 부여 완료” 영수증이 아닙니다.

### 탭·URL·대표 여정

현행 tab은 local state입니다. 리뉴얼에서는 `?tab=roles|assignments|privileged|effective&user=…&resource=…`의 선택/복귀 보존을 **추가 개선 계약**으로 요구합니다. `역할 정의→그룹 할당→특권 조건→최종 접근 검증` 연결 여정을 하나의 prototype으로 제출하세요. 각 단계의 주 사용자/action이 명확하며 네 개 탭을 같은 table layout으로 복제하지 않습니다.

## 6. 인력 데이터 접근 · `P09-I06` · `/admin/identity/workforce-access`

- **사용자 / 질문 / action / 유형:** HR 접근 정책 책임자 / “누가 어느 인력 집합의 어느 데이터 군을 열람/반출할 수 있는가?” / 제한된 policy 생성·철회 / policy matrix + impact workflow.
- **구조:** 정책 목록과 state/action 필터, selected policy detail, 명료한 `대상자→인력범위→데이터군→행위→기간/근거` 단계 form. 실제 직원의 민감한 인사 내용을 보여주는 화면이 아닙니다.
- **필드:** subject ROLE(HR_ADMIN/PEOPLE_ADMIN) 또는 USER; population TENANT/ORG_UNIT/ORG_TREE와 organization; fieldGroups DIRECTORY/WORKER_IDENTIFIERS/EMPLOYMENT/JOB_GRADE; actions READ/EXPORT; validFrom/validTo; justification. 전사/조직 트리/단일 조직 차이, READ와 EXPORT 독립, identifier/grade의 민감도를 plain language로 설명.
- **flow:** scope 선택→데이터 군/행위 선택→기간/근거→가상 persona 영향 preview→생성→effective lifecycle/버전→감사. 현행 create/revoke만 지원하며 정책 편집이나 승인 단계를 현행이라고 그리지 않습니다. revoke는 scope+사유 확인→실행→server state. future-effective/expired/revoked 상태를 단순 ACTIVE badge로 묶지 않습니다.
- **상태/프레임:** `ADMIN.WORKFORCE_ACCESS MANAGE` 부족, organization/user lookup 각각 부분 실패, 빈 검색/로드 실패 구분, 유효 기간 오류, 전사+EXPORT 영향 confirmation, 실행 실패/409. 사용자 삭제·존재 불명 시 사람 이름을 추정하지 않습니다.

## 7. 저장 뷰 소유권 · `P09-I07` · `/admin/identity/saved-view-custody`

- **사용자 / 질문 / action / 유형:** 인수인계/데이터 관리 책임자 / “퇴직·이동자의 저장 화면을 누가 이어받고 무엇은 보관해야 하는가?” / 미리보기 후 이전/보류/보관 / custody plan workflow.
- **구조:** plan/history 탭, 단계 owner→disposition→evidence→preview→execute, 별도 orphan 큐·action history. 목록 CRUD가 아니라 보존/접근 리스크가 다른 객체를 다루는 작업입니다.
- **필드:** sourceOwner, targetOwner, disposition, retentionUntil, reasonCode, sourceReference, reason. preview는 evaluatedAt/scopeCount/각 view·owner·출처 앱·이전 가능성·이름 충돌·권한 제약·차단 사유를 보여줍니다. 이전은 저장된 query/filter/layout 소유권이며 앱 접근 권한이나 직원 data의 전송이 아닙니다.
- **flow:** owner 선택→대상/보관 계획→근거→preview→충돌 해소·선택 scope 확인→confirmation→transfer→각 항목 결과·history/audit. preview 후 계획을 바꾸면 다시 평가. source/target user 검색과 임의 식별자 입력은 지원 정책대로. orphan별 reassign/extend retention/archive는 현재 API에 맞춰 결과·복구 가능성을 설명.
- **상태/프레임:** no views, inaccessible source, target과 동일 owner, 이름 충돌, stale preview, 409/부분 이전/실패, 권한 조회 실패, 보관 조건 불충족, orphan reassignment/extension/archive·진행 결과. URL/필터/선택 뷰 보존은 추가 개선.

## 8. ID 프로비저닝 · `P09-I08` · `/admin/identity/provisioning`

- **사용자 / 질문 / action / 유형:** IAM 연계 운영자 / “SCIM 계정 수명주기가 정상이며 자격증명/실행 실패를 어떻게 복구하는가?” / connector 생성·secret회전·lifecycle 조정 / connector list-detail + secure setup workflow.
- **구조:** connector 상태·사용자 영향 요약, 선택 connector endpoint/설정 detail, 최근 event·안전한 오류/추적, create/rotate flow. 실패 event를 먼저 노출하고 정상 설정은 압축.
- **필드:** connector key/name, lifecycle, endpoint copy, 생성/회전 후 **일회성 secret**. token은 목록/감사 문서/preview에 평문 표시하지 않습니다. 일회성 dialog에는 복사 완료·재표시 불가·닫기 confirmation. 새 token 노출이 old token취소 시점과 같은지는 실제 계약대로 설명.
- **flow:** create→endpoint+one-time token→안전한 외부 등록 안내→관측 event 확인. rotate→사용 중인 연계 영향·새 credential 작업 계획→confirmation→진행→secret 보관→event/health 검증. suspend/activate는 계정 삭제로 표시하지 않습니다. 자동 outbound 재전송이 없는 경우 retry 버튼 발명 금지.
- **상태/프레임:** no connectors, 열람 권한 부족/rotate, 자격증명 복사 실패·닫힘 후 복원 불가, 토큰 회전 실패·결과 불확실, 수명주기 오류, event 조회 부분 실패, 안전한 오류와 상관관계 추적, 모바일 일회성 입력 화면.

## 9. 카탈로그 탐색 · `P09-P01` · `/admin/platform/catalog`

- **사용자 / 질문 / action / 유형:** 플랫폼·앱 책임자 / “이 자산을 바꾸면 어떤 앱·홈·권한·사용자 경험에 영향이 생기는가?” / 영향조사, 관계선언/철회, assurance 판단 / dependency graph + inventory + assurance workspace.
- **구조:** graph/inventory/assurance 3뷰, scope/search/assetkind/depth, 선택 자산 inspector, operation impact. graph를장식용 nodecloud로 만들지 않고 selected자산과상류/하류·관계유형/중요도를 보여줍니다. 같은관계의 keyboard-accessible tree/table equivalent필수.
- **필드:** relation source/target/type/criticality/evidence, 자산 담당자/lifecycle/permission/dependency, impact operation, assurance finding/evaluation/evidence/disposition. 홈위젯→provider API→registry asset→permission/responsibility→앱 owner의 연결된 조사 예제.
- **flow:** asset 선택→관계 깊이/operation 변경→영향 상세→관계 원천 검증→declare/retire 또는 정합성 평가→위험 신호 상세→근거 있는처분→상태/증거. 선언 관계와 관측 관계를 구분;부족한 관계는 영향 0이아닌 관측 범위 확인 불가. relation수정/운영 API지원 범위유지.
- **상태/프레임:** graph/impact/assurance각 부분 실패, no relations, 접근할 수 없는 자산, 관계 순환/찾을 수 없는 참조, 오래된 영향 평가, 409/처분실패, URL의 view/선택/operation 보존, 모바일관계 tree.

## 10. 기준정보 · `P09-P02` · `/admin/platform/reference-data`

- **사용자 / 질문 / action / 유형:** 기준정보 담당자 / “제품에 쓰이는 코드·다국어표시·계층·유효기간이 정합적인가?” / code set/item 정의·활성·철회 / master-data list-detail + hierarchy focus editor.
- **구조:** 코드 세트 검색/selection, 선택 세트 요약, values/activity 뷰, 계층/유효 기간 검증, 편집 drawer/form. 코드 세트 요약는대상세트 scope와최근 updated 표시. values목록과 audit는 같은 선택에 연동.
- **필드:** setKey/name/description/lifecycle/revision; item code/order/parentCode/validFrom/validTo/labels(locale, label, description). code/set key는 지원 조건에 따라 불변. ko/en누락·중복 code·상위 코드 순환·유효 기간 역전·철회된 상위 코드를검증. 의존 앱의 기존 기록에 어떤 영향이 있는지 API가 지원하지 않으면`영향검토필요`로표시.
- **flow:** set/itemdraft→label/parent/validity입력→preview/validation→save→activate→실제 사용 표시·activity. retirement는 삭제가 아니며 이력 보존/재활성화 조건을 설명. 미래유효 item과 ACTIVElifecycle을 분리.
- **상태/프레임:** no sets/no items/no matches 구분, set목록성공·detail 실패·activity 실패, 긴 한/영 labels, 계층 보기, 잘못된 날짜·중복 코드, activate/철회 확인·409/실패, 모바일 항목 상세.

## 11. 앱 레지스트리 · `P09-P03` · `/admin/platform/registry`

- **사용자 / 질문 / action / 유형:** 플랫폼등록·릴리스 책임자 / “어떤 실행자산 version이 테넌트에 활성인가?” / 정의 draft·새 revision·activate/retire / versioned registry studio.
- **구조:** type/state/search목록, 선택 자산 정의·history/활성 버전, 버전 편집 폼, 릴리스 영향. 카드 catalog나 앱 마켓과 구분하며 registry등록이 홈 배치나 사용자 권한 허용과 다름을 보입니다.
- **필드:** APP/CONNECTOR/AGENT/TOOL/POLICY (현행 dialog), entryKey/name/description/ownerRef/riskTier/artifactVersion/version/lifecycle. API 타입 API/DATA_PRODUCT는 존재하지만 dialog등록 미지원이므로 추가 UI는`제안`으로표시. AGENT 상세 profile은실제 지원 필드만반영.
- **flow:** create draft→validation→save→활성화 확인(자산/범위/이전 version/영향)→진행→active 확인. 활성 자산 편집는새 revision 생성, DRAFTedit와다름. retire는사용 중 provider/홈 widget에 미치는 영향·대체안을 preview하며 영향 집계 API가 없으면 추가 기능이라고 표시.
- **상태/프레임:** draft/active/철회 이력, 미지원 유형, 중복 키/담당자 누락/잘못된 구현 artifact, 참조 조회 부분 실패, activation/철회 실패·409/권한 부족, 활성 버전과 초안 비교, 모바일 이력.

## 12. 내비게이션 · `P09-P04` · `/admin/platform/navigation`

- **사용자 / 질문 / action / 유형:** 탐색 경험 운영자 / “어떤역할이 어떤메뉴를 실제 볼 수 있으며 새 트리가 업무 경로를 깨뜨리는가?” / 검증한 menu tree draft/publish/restore / navigation studio.
- **구조:** 현재 게시본/draft, 좌측 tree(authoring), 우측 nodeform·validation, 런타임 미리보기, diff/history. multilingual labels·re원천 권한·레지스트리 대상를 연결하고 menuorder와앱 배치는 별도입니다.
- **필드:** NavigationDialog의 navigationKey/itemType(GROUP/APP)/parentNavigationItemId/registryEntryKey/route/iconKey/requiredResourceKey/requiredPermissionCode/sortOrder, labels(locale/label/description), lifecycle/version. drag-and-drop + keyboard sensor + 앞뒤/상위/하위명령. source tree와 preview tree를구분하며 가상 사용자 권한 preview는추가 계약 지원 필요.
- **flow:** create draft→nodeedit/reorder→save changeSummary→validation(중복 path/없는 target/상위 코드 순환/역할에 숨겨진 경로)→diff+런타임 미리보기→publish→확인/audit. cancel은내 draft취소, restore는 revision의변경 scope·대상/현재 버전 diff를 보여준 뒤 지원 API실행. publish가 권한 부여 자체라고 표현하지 않습니다.
- **상태/프레임:** draftnone/emptytree/권한으로 접근 불가한 대상, registry/resources부분 실패, 초안 검증으로 게시 차단, 게시본과 초안 비교, 저장되지 않은 탐색 변경, 409/게시 실패/복원 확인, 모바일 트리와 nodeform·초점 복귀. URL 선택 보존을 추가 개선으로 annotation.

## 신규 제안: 위젯 계약 스튜디오 · `P09-N01` · 후보 `/admin/platform/widget-contracts`

미래의 미지위젯 확장을 관리할 필요가 있습니다. **우선 기존 `/admin/experience/home-composition?tab=catalog` 안의 contract/version/validation/detail workspace를 확장**하세요. 별도 플랫폼 담당자가 여러 앱의 provider 계약을 독립적으로 관리해야 할 때만 새로운 route를 검토합니다.

질문: “새 위젯이 구현된 artifact·원천 API·권한·실행·접근성 계약을 충족하는가?” 유형: contract studio. 계약버전/owner/provider·레지스트리 참조/지원 surface/데이터모델/freshness/permission·필드 필터/설정 스키마/width·height/action·실행 영수증/AI evidence·허용 도구 s/로딩·빈값·부분 실패/locale/A11y/실행 검증 결과. 등록 요청→자원/권한 일관성 검증→artifact지원확인→가상 데이터 미리보기→시범 적용 영향→release→deprecated/retired·영향받는 뷰. schema를 편집했다고 동적 코드가 곧 실행되는 것처럼 그리지 마세요. 앱 owner가 source·업무로직·approval을 소유하고 홈 관리는배치·표시 계약을 소유합니다. 중앙 registry와 DWAI agent/도구 레지스트리의 소유 경계도 표시하세요.

## 제출 기준

각 ID별대표정상/로딩/빈값/오류/부분 실패/권한/confirmation/진행/recovery 프레임, 실제 작업 흐름 prototype을 제출하세요. 1440/1280/390/320·200% zoom, ko/en, light/dark/high contrast, reduced motion, keyboard/touch는 P00대로필수. 영향·승인·복원은 현재 지원 vs추가 제안을 반드시 구분합니다. 디자인에서 선택·필터·URL·role·audit 연결이 보여야 합니다.

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

# 위젯 확장성·편의성·AI 기여 계약

현재 catalog의 manifestVersion/ownerProduct/dataSource/sourceAppResourceKey/contributorAppResourceKeys/freshnessSeconds/privacyClass/retention/lifecycle/policyClass/allowedSizes/allowedHeights/configuration/recipientContextBinding 구조를 출발점으로 삼는다. 아래 추가 항목은 신규 설계 계약이며 현재 구현됐다고 주장하지 않는다. 목표는 미래 위젯을 추가할 때 홈 전체와 설정 메뉴를 다시 설계하지 않는 것이다.

## 등록·버전·소유

| 계약            | 요구사항                                                                                                                        | 사용자·관리 UI                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| stable ID       | `owner.widget-purpose` 같은 안정 ID. 표시 이름 번역·모드·외형과 분리. 기존 key의 의미를 바꾸거나 재사용하지 않음                | 라이브러리 상세에 소유 앱·등록 버전. unknown ID는 삭제 대신 안전 placeholder                                         |
| schema/version  | manifestVersion/configVersion/viewSnapshotVersion/sourceContractVersion 및 명시 migration. backward/forward compatibility 범위  | 새 버전 적용 전 영향 preview·template compatibility·migration 실패 복원 경로                                         |
| owner/source    | 제품 owner, source provider 목록, source contract, primary source, support route. contributor metadata는 실제 query 연결과 다름 | ‘앱 API 존재/홈 연결 필요/신규 API 필요/외부 연결’ 구분. 책임자가 없는 widget은 등록 불가                            |
| lifecycle       | ACTIVE/DEPRECATED/BLOCKED 기존 정책 보존. 신규 RETIRED/UNKNOWN 처리는 compatibility layer로 정의                                | deprecated는 기존 render 가능·신규 추가/복원 불가; blocked는 private data 없이 이유·대체안. 기존 설정 무단 삭제 금지 |
| tenant/feature  | tenant allowed·provider allowed·app entitlement·source authorized·mode/device capability·feature gate                           | unavailable 이유를 구체적으로 표시. 재시도 버튼으로 정책 불허를 해결하는 척하지 않음                                 |
| migration scope | Classic/Flow 기존 alias와 제3모드 독립 view/config/device/revision 명시                                                         | mode switching preview와 초안 처리. unknown 설정·기존 expanded geometry·appLayout 보존                               |

위젯은 임의 외부 JavaScript를 실행하는 플러그인 스토어가 아니다. 현재 runtime은 NATIVE다. 외부 runtime이 필요하면 별도 sandbox·origin·서명·API·권한 계약을 검토하며 디자인에서 현재 지원처럼 표시하지 않는다.

## 내용·크기·스크롤

크기는 CSS 절대좌표가 아닌 허용 tier(fifth/quarter/compact/medium/large/full)와 responsive span으로 표현한다. 높이 short/standard/tall/expanded는 콘텐츠 깊이 budget이며 긴 빈 공간을 강제하는 높이가 아니다. 읽기 기본 1–3행, 주요 업무 wide 4행 등 renderer policy를 등록하고 template preset과 실제 원천 총량을 구분한다.

모든 위젯은 작은 폭·200%·긴 ko/en label·light/dark/high contrast·reduced motion·keyboard/touch 상태의 component variant를 갖는다. 데이터 목록·상태·강조 수치를 같은 시각 형식으로 획일화하지 않는다. 그래프는 실제 기준·기간·비교 목적과 text/table 등가 정보가 있을 때만 사용한다.

읽기 홈은 문서 한 번의 scroll이며 위젯 내부 세로 scroll을 금지한다. 많으면 행 budget과 더보기/원천 상세를 사용한다. editor inspector/library/dialog의 작업 scroll은 허용하며 page scroll과 modal scroll의 focus/overscroll을 구분한다. 새 위젯이 자체 scroll을 요구하면 catalog 호환 검토에서 읽기 홈의 compact 표현을 먼저 정의한다.

## 데이터 상태·권한·원천

- 권한은 앱 entitlement→source read→object visibility→action capability 순서로 판정하고 explicit DENY가 우선한다. private preview를 권한 확인 전에 fetch/render하지 않는다.
- source envelope에는 generatedAt/observedAt/TTL/coverage/hasMore/classification/objectVersion/identity를 포함한다. query observation을 source 실시간 갱신으로 표시하지 않는다.
- loading/true-empty/partial/stale/forbidden/unavailable/configuration-required/unsupported-version 상태는 별도 copy/action을 갖는다. 실패가 0이거나 ‘전체 완료’로 보이면 안 된다.
- 집계(alert/event/counter)와 개별 business obligation을 합산하지 않는다. canonical source/reference/obligation identity로 권한 후 dedupe한다. 제목·날짜가 비슷하다는 이유만으로 업무를 합치지 않는다.
- deep link는 허용 product surface/real object/filter/time/scope를 유지하고 재진입 때 source 권한·version·상태를 재검증한다. 임의 /home link로 모든 세부 업무를 대체하지 않는다.
- 수명·보존 정책은 최소 원칙. 기존 catalog retention NONE을 존중한다. layout/template/revision은 데이터 snapshot·개인 payload를 저장하지 않는다.

## 추가·탐색·설정·복원 사용자 흐름

`편집 → 라이브러리 검색/목적 필터 → 권한·source·기기 호환 확인 → 안전 preview → 위치/중복 확인 → draft 추가 → Undo → 변경 요약 → 저장`을 표준으로 삼는다. 각 앱의 widget마다 새 설정 메뉴를 추가하지 않는다. 공통 inspector의 등록 필드·filter preset·행 budget·size tier에 넣는다.

추천은 업무 질문·역할/scope·허용 source·추가 시 효과·근거를 표시하고 popularity와 구분한다. 같은 의무가 기존 위젯에도 보이면 ‘대체’와 ‘다른 관점으로 추가’의 차이를 설명한다. 위젯 설정의 삭제·숨김·퇴역은 원천 데이터 삭제가 아니다.

확장 템플릿은 widget ID+config version+허용 mode/device+recipient context binding을 저장한다. publisher의 데이터·ACL을 복사하지 않는다. template 버전 update 시 적용 차이·필수 영역·가용하지 않은 원천·퇴역 위젯·개인화 보존 범위를 보여준다. 자동 update는 기존 사용자 layout을 바꿀 수 있으므로 별도 정책/preview/rollback 계약 없이는 수행하지 않는다. 현재 template 객체의 config/device 포함 여부는 P05의 현재 계약과 구분한다.

mutation은 version/idempotency/busy/409·실패 시 초안 보존·focus return을 갖는다. Undo는 현재 초안 동작과 서버에 적용된 proposal 되돌리기를 구분한다. revision restore는 layout/config/device 범위이며 원천 업무 상태를 복원하지 않는다.

## 성능·지연 로딩·요청공유

현재 provider는 shell에서 fetch한 데이터를 normalize하는 pure adapter이며 query/client 의존성이 없다. 이를 보존한다. 신규 widget마다 같은 API를 fetch하는 방법을 피하고 `tenant+user+accessFingerprint+source+scope+date/filter` 기준 query ownership을 공유한다. 단 source scope가 다른 요청을 같은 cache에 합치지 않는다.

모드별 첫 viewport의 주요 콘텐츠를 우선 fetch/render하고 아래 optional 위젯과 무거운 시각 컴포넌트는 지연 load한다. 원천 조회와 위젯 컴포넌트 load는 별도 오류·재시도 상태다. viewport 밖의 위젯이 권한 취소를 감지하지 못하는 구조는 금지한다. polling은 foreground와 가용 원천을 기준으로 하며 같은 원천 poll이 여러 위젯에서 중복되지 않게 한다.

조회 timeout·반복 실패·부분 원천·page cursor 상한·cancel/abort를 정의한다. 개인 Work의 기존 최대 1000개/10페이지 부분 조회 정책을 유지한다. 위젯을 숨겨도 다른 위젯이 같은 원천을 쓰면 요청을 중단하면 안 된다. telemetry는 위젯 ID·상태·지연 등 최소 정보이며 제목·메일 본문·인사 정보·credential을 수집하지 않는다. 수치 성능 budget은 실측 후 확정하고 임의 PASS를 주장하지 않는다.

## AI 중심 제3모드를 위한 context·intent·receipt

AI는 네 번째 원천권위가 아니다. 기존 Work/Calendar/Services/Approval/HCM/Space/Mail/Meeting의 권한 있는 신호를 이유와 함께 조합하고 사용자의 의도를 실행 draft로 번역한다. 생성AI가 모르는 source·object·status·capability를 상상하는 디자인은 금지한다.

| 단계                  | 필수 계약                                                                                                                                                                | UI 상태                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Context input         | tenant/user/scope/timeZone/locale, 허용 원천 목록, object/reference/obligation/version, evidence generatedAt/observedAt/coverage/classification, consent/memory boundary | ‘사용한 정보’ inspector. 가용하지 않은 원천 표시, 권한 취소 시 재생성·redaction              |
| Recommendation output | intent ID, 왜 지금인가, evidence reference/coverage/freshness, uncertainty, 필요한 capability, 예상 효과와 되돌릴 수 있는 범위                                           | 근거·마지막 확인·미확인 범위·추천 피드백. AI confidence가 원천 확정값을 대체하지 않음        |
| Intent draft          | source action contract·target/version·입력값·권한·고영향 여부·preview·영향 범위·review-required                                                                          | 초안 확인/원천에서 계속. 홈 즉시 승인·발송·결재·공개·일괄 변경 금지                          |
| Execution             | 원천 governed command, 재검증·idempotency·busy·progress·재시도/rollback 계약                                                                                             | 실행 중·부분 성공·실패·권한 변경·버전 충돌. optimistic ‘완료’ 금지                           |
| Action receipt        | 실제 원천 response ID/time/result/newVersion·audit reference·복구 route                                                                                                  | 완료 영수증·원천 상세. AI 문장만으로 수행 완료 주장 금지. 추가 API가 필요한 원천은 제안 상태 |

명령 전송 후 연결이 끊기면 결과는 ‘확인되지 않음’이며 성공이나 실패를 단정하지 않는다. 현재 원천이 제공하는 결과 조회/감사 경로로 확인한다. 범용 실행 결과 조회·undo·rollback API가 있다고 가정하지 않는다. 현재 Studio proposal undo는 홈 layout 변경 되돌리기이며 메일 발송·예약·결재의 취소를 뜻하지 않는다. 새 직접 명령이 필요하면 NEW_API로 대상·버전·권한·확인·진행·부분 성공·409·결과 불명·복구 계약을 별도로 작성한다.

HomeOverview의 현재 rule recommendation과 Studio의 FOCUS_DEADLINES/BALANCE_DAY/REDUCE_NOISE 규칙 proposal은 생성AI의 통합 intent contract를 제공한다고 볼 수 없다. DWAI APP.ASK·agent proposal/evidence·Work 의무 허브·Space collaboration·Calendar 계획을 재사용/확장한다. 신규 ‘AI 상황 허브/intent’ 메뉴와 앱 제안은 P12/P13 및 개발 계획에서 구분한다. 지식 corpus·ERP·레거시가 연결되지 않으면 AI가 그 정보를 알고 있다고 표시하지 않는다.

## 후속 구현 acceptance

미래 원천 1개/위젯 1개를 추가해 기존 홈·editor·library·template·device·revision·AI context가 새 최상위 메뉴·임의 좌표 CSS·중복 원천 query 없이 동작하는지 검증한다. 1440/1280/390/320/200%, 한영·테마·대조·reduced motion·keyboard·touch·focus와 unavailable/unknown/retired/409/권한 취소/partial/hasMore·모드 저장 독립성을 실제 소스 snapshot과 실행 결과로 검증한 뒤 완료를 주장한다.
