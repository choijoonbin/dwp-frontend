# DWP 독립 전달 합본 — P11

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

# P11 · 앱 콘텐츠 기여·위젯 세부 디자인·원천 운영 연결

P00 [공통 계약](../prompts/00-common-contract.md), [원천 매트릭스](../contracts/widget-source-matrix.md), [확장 계약](../contracts/widget-extensibility-contract.md), P04와 함께 전달한다. CURRENT는 현재 소스의 경로·조회/명령 계약 확인, EXTEND는 기존 기능 연결/보강, NEW_API는 새 계약 필요, EXTERNAL은 외부 연계 의존을 뜻하며 P00와 동일하다. 홈 provider 연결 여부는 원천 매트릭스에 별도로 표시한다. 이 분류는 프레임 밖 annotation에만 둔다.

## 복사하여 전달할 프롬프트

DWP 홈을 뒷받침하는 위젯 컴포넌트와 각 원천 앱의 홈 기여 설정을 설계한다. 주 사용자는 개인 구성원이며, 관리자·운영자 variant는 해당 원천 권한이 있는 사람에게만 제공한다. 홈은 질문을 압축하고 원천 상세는 검토와 명령을 소유한다. Classic은 조직 편집 포털, Flow는 개인 실행, 제3모드는 근거를 바탕으로 상황과 의도를 연결하는 AI 경험이다. 아래 위젯을 전부 한 화면에 기본 노출하지 말고 모드·역할·질문별 구성을 만든다. 같은 데이터를 이름만 바꾼 카드로 중복하지 않는다.

### 필수 위젯 component 프레임

각 ID는 compact/medium/wide 및 1/2/3행 variant를 가진다. 390/320 mobile, 1440/1280 desktop, 200% 확대, ko/en, light/dark/high contrast, reduced motion, visible focus, touch 상태를 산출한다. 수치는 가상의 디자인 샘플이며 원천·단위·기간·범위·신선도를 annotation한다.

| Frame ID·구현 분류       | 사용자와 질문                                     | 필드·시각·기본 budget                                                          | 주 행동과 원천 명령 경계                                                                           |
| ------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| H11-W01 CURRENT          | 개인; 지금 내 차례인 일은?                        | title/status/priority/dueAt/source/obligation, 우선순위 3행·wide 4행           | 특정 Work/결재/근태 상세. 홈 즉시 승인 금지                                                        |
| H11-W02 CURRENT          | 개인; 다음 시간에 어디로 가나?                    | 사용자 날짜·시작/종료·제목·장소·예약 상태, 시간축 3행                          | Calendar event/Workplace 예약 상세. 대응 identity 없는 회의/예약 merge 금지                        |
| H11-W03 CURRENT+EXTEND   | 개인; 내 답변 때문에 막혔나?                      | 원천별 응답 의무·제목·상태·기한, 목록 3행+원천 필터                            | Work 응답/서비스/결재 상세. Mail/Messaging 연결은 확장. 발송/보완 제출은 원천 소유                 |
| H11-W04 CURRENT          | 신청자; 내 요청은 어느 단계인가?                  | requestId/title/source/status/lastChange/dueAt, 단계 cue 3행                   | 내 서비스/결재 요청 상세. SLA를 확정 ETA로 바꾸지 않음                                             |
| H11-W05 EXTEND           | 개인; 오늘 하기로 한 일은?                        | 계획에 선택한 task·배정 시간·완료 상태, 2–3행                                  | Work 오늘 계획. plan pulse는 현재 연결됐지만 상세 compact view는 추가 필요. W01 합계에 더하지 않음 |
| H11-W06 CURRENT 재조합   | 개인; 집중 시간과 회의 부담은?                    | 확보 시간·회의 시간·기준·하루 time band, 1축+2수치와 텍스트 등가               | Calendar 인사이트. 기존 두 위젯 독립 저장 보존, 같은 날 차트 중복 금지                             |
| H11-W07 CURRENT          | 전 직원; 필수 확인과 조직 소식은?                 | 발행자·제목·위험도·독자 상태·확인 기한·이미지, 필수 2행+편집 기사 teaser       | 소식 원문과 확인 절차. read와 ack 분리, 대표 게시물 중복 금지                                      |
| H11-W08 EXTEND           | 협업자; Space에서 어디부터 재개하나?              | Space명·민감 등급·최근 변경·내용 reference·안전한 actor명, 2행                 | Space 허용 변경 상세. 발견 가능한 Space의 본문 preview 금지, 공개/심사는 원천 명령                 |
| H11-W09 EXTEND           | 참가자; 다음 회의를 준비했나?                     | 다음 회의·시작·시간대·capability·자료 존재·참가 상태, 1–2행                    | 회의 상세/입장 전 권한 확인. join credential/token preview 금지. Calendar origin 중복 해결 필요    |
| H11-W10 EXTEND           | 메일 사용자; 어떤 답장을 보낼 차례인가?           | thread/account/안전한 제목/NEEDS_REPLY/workflow/importance/classification, 2행 | 메일 thread 상세. W03 원천 필터와 같은 thread 대표 1개, 홈 발송 금지                               |
| H11-W11 NEW_API          | 대화 사용자; 놓친 직접 언급은?                    | conversation/message/mentionId/unresolved/permissions/freshness, 2행           | 해당 메시지. 현재 mentions 집계/priority만 확인. 미응답 상태와 기한을 발명하지 않음                |
| H11-W12 CURRENT+EXTEND   | 구성원; 개인 인사 기한은?                         | 근태/학습/복지 domainState·dataOrigin·기한, 2행                                | 근태/학습/복지 상세. reference/unknown을 확정 수치로 표시 금지. 급여 금액 기본 비노출              |
| H11-W13 CURRENT          | 관리자/운영자; 영향 있는 예외는?                  | 팀 범위·운영 예외·현재 상태·영향·원천·마지막 성공, 1예외+2보조                 | 결재 운영/팀 인사 상세. 원천 ADMIN 권한 검증, 일반 역할 자동 허용 금지                             |
| H11-W14 EXTEND           | 개인; 정보가 믿을 만한가?                         | 원천·조회 범위·상태·생성/조회 시각·실패 원천, 작은 popover 표                  | 원천 재조회/내 연결 설정. 중앙 connector 상태와 개인 조회 실패 구분                                |
| H11-W15 CURRENT+EXTEND   | 개인; 왜 이 추천인가?                             | 추천 이유·원천·근거·confidence·ruleVersion, 근거 1문장+feedback                | 근거 확인/원천 작업 preview. 생성AI 확장은 evidence·intent draft·receipt 필요                      |
| H11-W16 EXTERNAL/NEW_API | 개인; 지식을 어디서 이어 읽나?                    | 원천 ACL·문서 reference·최근/저장 상태·민감 등급 필요, 2행                     | 원천 문서. 전체 corpus 미확인과 연결 필요를 annotation. 전체 지식 보유 주장 금지                   |
| H11-W17 EXTERNAL         | ERP/레거시 사용자; 원천 업무를 안전하게 시작할까? | 연결 후 source task/status/version/obligation/timestamp, W01 원천 variant      | 외부 인증 후 허용 객체. 가짜 구매/경비/업무 건수 금지                                              |

### 위젯별 상태·중복·freshness

각 컴포넌트에 H11-S01 초기 로딩, S02 정상 데이터, S03 진짜 빈값, S04 부분 조회/hasMore, S05 오래된 데이터와 마지막 성공 시각, S06 권한 없음/취소, S07 연결 필요, S08 원천 실패, S09 미지원 버전/퇴역, S10 명령 버전 충돌(409)을 만든다. 실패 원천을 0으로 표시하지 않으며 일부 확인 완료를 ‘모두 완료’로 표현하지 않는다. 권한 없는 제목·개수·인물·메일 preview를 보여주지 않는다.

홈 전체 조회 시각은 한 곳에 표시하고 원천별 예외는 위젯의 작은 cue와 inspector로 설명한다. 서버 generatedAt과 HTTP observedAt을 구분하며 TTL을 실시간 수집 주기로 설명하지 않는다. 상세 drilldown은 범위·시간·필터·객체 identity를 유지한다. 알림 집계를 Work/결재의 개별 의무와 합산하지 않는다. 목록의 더보기 개수는 원천 전체 건수인지 확인된 조회 건수인지 표시한다.

같은 객체가 다른 관점에서도 쓰일 때 linked focus를 줄 수 있으나 기본 목록 중복은 피한다. 사용자 편집에서 다른 관점으로 추가하는 기능은 명확한 목적 설명이 있을 때 허용한다. 시각은 시간축·단계·의무 목록·편집 기사·짧은 근거·원천 상태표처럼 정보 목적에 맞게 달라야 한다. 관련 없는 KPI 카드 행을 기본 구성으로 만들지 않는다.

### 기존 원천 앱 운영 메뉴에 붙일 기여 설정

중앙 홈 관리자는 위젯 등록·조직 배치·개인화 허용·모드 정책·템플릿을 소유한다. 콘텐츠 발행·서비스 양식·알림 규칙·Space 공개 심사는 기존 앱이 소유한다. 다음 영역은 **신규 홈 기여 UI와 필요 API 제안**이며 새 중앙 발행 메뉴를 만들지 않는다. 기존 route를 유지하고 그 안에 영향 preview를 추가한다.

| Frame ID | 기존 원천 관리 route                                                                           | 붙일 신규 영역과 질문                                                                                 | 권한·preview·결과                                                                                |
| -------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| H11-A01  | /communications/admin/content                                                                  | 이 게시물이 Classic 소식/Flow brief/필수 확인에 어떻게 보이나? featured·독자 범위·기한·이미지 preview | 원천 발행 권한 유지. 대상 preview는 가상 데이터. 관리자가 독자 확인을 임의 완료 처리하지 않음    |
| H11-A02  | /services/admin/catalog, /services/admin/operations                                            | 서비스 의무와 상태가 답변/추적에 어떻게 기여하나? 등급·SLA·상태 mapping                               | catalog/operations 권한 별도. template에 신청자 payload 복사 금지. 명령은 원천 상세              |
| H11-A03  | /notifications/admin/contracts, /notifications/admin/policies, /notifications/admin/operations | actionable/urgent 정의와 홈 집계의 중복 범위는? 원천 계약·조회 범위·예외 preview                      | 기존 정책 운영 권한. 개별 의무 identity가 없으면 집계 유지. 홈 관리 권한은 발송 권한을 주지 않음 |
| H11-A04  | /spaces/admin/content-reviews, /spaces/admin/lifecycle, /spaces/admin/operations               | 공유/발행/멤버 취소가 협업 재개 preview에 어떤 영향을 주나?                                           | Space 권한·민감 등급·guest·publication review 유지. discoverability와 본문 열람 구분             |
| H11-A05  | /mail/admin/connections, /mail/admin/shared-inboxes, /mail/admin/policies                      | 개인/공유 메일 범위·needsReply 정의·동기화·preview privacy는?                                         | 계정 membership과 필드 redaction. 공유 inbox SLA 과장 금지. 연결 credential 비노출               |
| H11-A06  | /workplace/admin (기존 management prefix)                                                      | 사이트/예약 정책·체크인 window·오늘 예약 기여는?                                                      | 정확한 하위 route는 후속 inventory에서 확정. owner/UPDATE 재검증. availability 검색은 원천 소유  |
| H11-A07  | /messages/admin (기존 management prefix)                                                       | 미확인 언급과 공유자료의 read/privacy/membership 계약은?                                              | 정확한 하위 route는 후속 확정. 미처리 mention 상태는 NEW_API. Space 미러 권한 취소 시 숨김       |
| H11-A08  | 결재/HCM/회의/DWAI의 기존 management surface                                                   | contribution manifest·허용 신호·민감 필드·AI context 허용의 영향 inspector                            | 실제 앱별 route/authority registry 후속 확정. 신규 메뉴/앱 계획은 P12/P13으로 분리               |

기여 영역은 등록 위젯·허용 목적·필드·권한·preview·신선도·상태 mapping을 읽기 쉽게 비교하며 정책 변경 preview·영향·버전·감사·rollback을 갖는다. 원천 관리 권한이 없는 홈 관리자는 요약 사유만 본다. ‘관리콘솔 가기’ 버튼은 실제 대상 route 권한을 확인한 뒤 제공한다.

### AI 입력·출력·원천 경계

제3모드 AI는 원천별 context reference·버전·신선도·확인 범위·민감 등급·권한을 입력으로 받는다. 결과는 왜 지금인지, 근거, 불확실성, 필요한 capability, 실행 의도 초안이다. 업무 완료는 실제 원천 action response와 receipt로만 표시한다. 원천 정보가 없거나 오래됐다면 AI는 ‘확인 필요’를 표현하며 연결되지 않은 ERP·지식·원천을 상상해 추천하지 않는다.

AI 위젯에는 H11-AI01 근거 inspector, AI02 실행 의도 초안과 영향 preview, AI03 원천 명령 확인과 진행, AI04 실제 receipt·부분 성공·복구, AI05 권한 취소·오래된 근거·버전 충돌을 만든다. 현재 DWAI/Work/Space/Calendar API 재사용과 신규 API 필요를 annotation한다. 고영향 승인·발송·공개·일괄 변경은 원천 governed workflow로 이어진다.

H11-AI06은 전송 후 연결 단절로 결과를 모르는 상태다. 원천 결과/감사 경로에서 확인하도록 안내하며 성공/실패를 단정하지 않는다. 원천마다 실제 지원하는 복구만 제공한다. 현재 홈 편집 proposal Undo와 메일·결재·예약 명령 취소는 서로 다른 기능이며 범용 undo/receipt 조회 API를 발명하지 않는다.

### 산출물

위젯별 질문·필드·원천·권한·단위/범위/날짜·신선도·상태·최대 행수·link·dedupe·component variant·키보드/터치·메뉴 소유권을 annotation한다. 템플릿은 stable ID·config version·기기 호환을 기반으로 preview한다. 미지원 위젯을 몰래 삭제하거나 새 설정을 최상위 메뉴로 남발하지 않는다. 미래 100개 위젯도 라이브러리 검색·분류·원천 요청 공유·컴포넌트 지연 로딩으로 확장되는 설계를 산출한다.

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
