# P08 — 관리콘솔: 사용자 경험·홈 전체 리뉴얼 디자인 AI 프롬프트

[P00 공통 계약](00-common-contract.md), [현행 메뉴·권위 계약](../contracts/account-admin-menu-inventory.md), P07 개인 설정 및 다른 홈 모드 프롬프트와 함께 사용하세요. 이 프롬프트는 중앙 관리콘솔의 **현행 경험 메뉴 6개 전체**, 내부 위젯 카탈로그/청사진/정책을 다룹니다. 신규 작업공간 3개는 제안이며 별도 메뉴보다 기존 메뉴의 탭·inspector·작업 route를 먼저 검토합니다. 새로운 운영 질문이 별도로 존재하면 신규 메뉴도 가능합니다.

## 경험 shell · `P08-S00`

사용자: 테넌트 경험 운영자·브랜드 담당자·홈 관리 책임자·검토자. 질문: “누구에게 어떤 경험이 실제 적용되고 있으며 무엇을 바꾸면 어떤 영향이 생기는가?” 유형: operational studio shell. 상단 조직 scope, 지원모드 여부, 현재 데이터 시각·정책 버전, 작업 상태. 좌측 기존 5개 관리그룹 탐색(사용자 경험/ID 및 접근 권한/플랫폼 설정/연계 및 자동화/거버넌스)과 현재 페이지. 현재 경험 그룹의 브랜딩/홈 화면 설정/위젯 및 홈/홈 앱 구성/설정 예외 검토/다국어 스튜디오는 서로 다른 업무를 수행합니다.

`현재 게시됨 / 내 변경 있음 / 검토 대기 / 게시 중 / 충돌·게시 실패`를 단계별로 표현하세요. 현행 홈·브랜딩의 게시에는 별도 approval-chain이 확인되지 않았으므로 검토/승인을 임의로 기존 기능이라고 표시하지 않습니다. 별도 승인·예약·시범대상 배포가 필요한 경우 추가 제안입니다. 높은 영향의 실행에는 대상/변경 scope/버전/preview/권한/진행/복구/감사증거를 요구합니다. 모든 작업을 `저장` 버튼 하나로 끝내지 마세요.

## 1. 브랜딩 · `P08-E01` · `/admin/experience/branding` · 현행

**사용자 / 질문 / 핵심 액션 / 유형:** 브랜드 운영자 / “조직 아이덴티티가 로그인·작업공간·홈에서 읽기 좋고 일관되는가?” / 검증한 브랜딩 게시·복원 / brand studio.

**구조:** compact 게시버전/담당/갱신 헤더, 편집 control, 연결된 실제 surface preview, 검증·변경영향, 이력 inspector. 편집은 조직명·강조색·로고 upload/reset입니다. 로그인/shell/home preview는 사용처별 비교. 별도 홈 배경은 홈 화면 설정으로 연결합니다.

**필드·controls·detail:** 조직명과 긴 명칭 overflow, 강조색 입력+색상 선택, 로고 파일조건/가로세로/투명배경/기본로고 되돌리기. 색은 주요텍스트/버튼/선택/포커스 대비를 실제 light/dark/high contrast에서 검증합니다. 입력으로 사용자 경험 전체를 채색하지 마세요. 로고가 없거나 로드실패할 때 fallback mark. 현행 upload/reset과 메타데이터 게시의 독립단위는 반영 전후 버전으로 정직하게 표시합니다.

**flow:** 수정→3 surface preview→대비/asset validation→영향 확인→게시→진행→새 버전·실제 적용 확인→감사 link. 동시 수정은 현재 버전과 내변경 비교→새 기준으로 다시적용. 이력 선택→복원 scope·버전·영향→confirmation→복원→검증. 실패한 upload가 metadata까지 성공한 것으로 보이지 않게 부분결과를 표현합니다. Support read-only에서는 editor를 잠그고 TENANT_CONFIGURATION_WRITE 부족 이유를 보여줍니다.

**프레임:** light/dark 정상, 대비불합격, 로고누락/잘못된파일, publish confirmation/진행/부분 실패, history/rollback/충돌, read-only 및 모바일.

## 2. 홈 화면 설정 · `P08-E02` · `/admin/experience/home-experience` · 현행

**사용자 / 질문 / 액션 / 유형:** 홈 콘텐츠·경험 운영자 / “환영문구와 배경이 기기·언어·모드에서 실제 업무를 방해하지 않는가?” / 문구·asset 미리보기·검증·게시·복원 / preview-linked experience studio.

**구조:** 가장 큰 영역은 실제 홈 preview. 편집패널은 한/영 문구, 기본 locale, desktop/mobile 배경 초점, content alignment, overlay, 파일교체/reset으로 구분. preview toolbar는 모드·1440/1280/390/320·언어·theme를 독립 control로 선택하고 `미리보기 · 실제 적용값 아님`을 표시. 현재 화면의 게시모드와 preview mode를 혼동하지 않습니다. Classic·Flow·Adaptive에 동일 큰 이미지 배너를 강제하지 않으며 모드가 지원하는 surface의 영향만 보여줍니다.

**필드·controls·detail:** headline/subheadline은 실제 제품 제한을 반영; 한/영 missing fallback과 long-copy safe area. 이미지 파일조건·용량/비율/해상도는 제품 검증값을 annotation으로 전달하고 임의수치를 코드인 것처럼 주장하지 않음. desktop/mobile focal X/Y slider는 숫자입력·keyboard로도 조작 가능. 콘텐츠 정렬과 이미지 초점은 독립. overlay는 실제 명암·reduce transparency/high contrast 효과와 연결. quality panel은 blocking(default copy/asset)과 warning(locales/readability)를 구분합니다.

**flow:** read published→locale edit→viewport/theme/mode별 preview→quality blockers 해결→변경 scope 확인→publish→version/updatedBy/updatedAt→감사 link. unsaved navigation blocker는 이동 대상과 내변경을 보존/폐기할 선택, busy 중 이동을 설명. history의 affectedScopes를 표시하고 선택 revision이 앱 배치·구성 policy까지 복원할 경우 반드시 알려야 합니다. older server가 scope를 생략하면 불확실성을 표시하고 소급 추정하지 않습니다.

**추가 제안:** 역할별 실데이터 preview나 예정게시가 현행 기능이라고 그리지 마세요. 추가 기능이면 sample persona/권한검증 capability·승인·예약계약을 함께 요구합니다.

**프레임:** ko/en 완성·fallback, desktop/mobile crop, high contrast/reduced transparency, invalid asset, unsaved blocker, publish progress/error/version conflict, history full/scope omitted·restore confirmation.

## 3. 위젯 및 홈: 정책 · `P08-E03` · `/admin/experience/home-composition?tab=policy` · 현행

**사용자 / 질문 / 액션 / 유형:** 테넌트 홈 책임자 / “이 조직은 어떤 목적의 홈을 쓰며 무엇을 개인에게 맡기는가?” / 제품 모드·개인화·governed zone 정책 게시 / policy studio with impact preview.

**가장 중요한 선택 UI:** 단순 `CLASSIC / FLOW_V1` 버전문자열 selector를 금지합니다. 목적이 분명한 큰 라디오 비교판 3개를 제공하세요.

| 선택                        | 사용자에게 설명할 목적                                             | 고도화 방향                                                                                          | 현재 지원 상태                                           |
| --------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Classic · 조직 포털         | 조직 소식·필수 확인·공통서비스·구성원 안내를 먼저 접함             | Classic 전체 재설계. 첨부 내 앱 영역만 보존하며 기존 큰이미지/반투명 layout은 보존요구가 아님        | 현행 CLASSIC                                             |
| Flow · 개인 업무 실행       | 오늘 해야 할 업무·결재/답변·일정·개인 계획을 연결해 실행           | 개인 업무 요약과 승인 내 앱, compact 필수 확인, 개인 실행·시간·응답 흐름, 아래의 선택적 일반 소식    | 현행 FLOW_V1                                             |
| Adaptive · 문맥 실행 (가칭) | AI와 대화/문맥을 통해 필요한 작업·증거·앱도구를 즉시 구성하고 실행 | 시각적으로 놀랍고 새로운 AI 중심 제 3 모드. Classic/Flow와 한눈에 다른 구성; 새 내 앱 표현 실험 허용 | 신규 제안 · 서버 enum/capability/원천·실행계약 추가 필요 |

같은 배치에 색만 바꿔 두 모드를 만들지 마세요. 각 비교판에는 목적·핵심 정보 우선순위·대표 preview·권한조건·지원기능·개인 설정 영향을 표시합니다. Adaptive 미지원 서버에서는 `제안 미리보기`를 제공하고 실제 게시 action으로 노출하지 않습니다.

**권위 표시:** `설정한 모드 CLASSIC/FLOW_V1`와 `서버가 실제 적용한 모드 effectiveExperienceVariant` 및 runtime/kill-switch 영향은 별도 행. 값이 다른 경우 원인코드가 지원될 때 설명하고 그렇지 않으면 `실제 적용 상태 확인 필요`로 표시. 개인 focused/balanced/expressive는 모드가 아니며 이곳에서 개인 폭을 조직 모드처럼 바꾸지 않습니다. advancedPersonalizationEnabled/composerEnabled/homePreferenceStore는 runtime capability이며 정책과 구분합니다.

**편집 구조:** 모드 비교→personalCustomizationEnabled→governed announcements(visible, HERO/CANVAS, size, height, order)→모드별 섹션 위계와 정보량 미리보기→변경 영향→게시. 조직 관리 영역과 개인 workspace-tools의 경계를 선과 라벨로 드러냅니다. Classic과 Flow 모두 첨부 5×2 내 앱과 카테고리 좌측 연속 정렬을 유지합니다. Classic은 조직 편집 콘텐츠와 필수 확인, Flow는 개인 업무 실행과 시간·응답, Adaptive/AI Stage는 의도와 근거를 첫 화면의 중심으로 보여줍니다. 필수 확인은 각 모드에서 발견 가능하게 유지하고, 일반 소식을 같은 위치와 같은 비중으로 강제하지 않습니다. 현재 코드의 섹션 순서를 새 디자인의 고정 승인 조건으로 취급하지 마세요.

**flow·states:** 정책조회→지원모드 선택→기존개인 배치/뷰의 정합성 preview→게시 confirmation(테넌트·버전·mode/zone/customization 변경)→진행→실제 effective 검증→기록. 현재 API는 updateHomeCompositionPolicy/version을 쓰므로 독립 승인/대상배포는 제안. 409충돌→내 draft 보존→서버 diff→다시적용. unsupported widget/개인화 off/store migration/권한 부족/부분 fail은 각각 다른 상태. rollback은 미리보기 범위를 명확히 하고 개인 뷰를 자동 삭제하지 않습니다.

**프레임:** 세 목적비교, Classic 전체새 디자인 preview, Flow preview, Adaptive 제안 preview/미지원, requested≠effective, 개인화 off, width와 mode독립표시, publish/migration impact/충돌/restore.

## 3a. 위젯 카탈로그·확장 계약 · `P08-E03-C` · `?tab=catalog` · 현행 + 단계별 확장

**사용자 / 질문 / 액션 / 유형:** 홈 운영자·앱/위젯 계약 담당 / “이 위젯은 어떤 데이터를 어떤 권한으로 어떤 상태에서 보여주는가?” / 검증한 위젯 확인·정책 연결 / contract library list-detail.

**현행:** WORKSPACE_WIDGET_CATALOG는 현재 빌드 정의로 **읽기 전용**입니다. keyword/category/lifecycle 검색→위젯 detail: label/key/owner/provider/surfaces/default·allowed width/height/설정 스키마/freshness/permission/data contract/action/원천 연결. 이력과 상태를 지원 범위로 표시. 임의 외부 HTML/코드 upload로 위젯을 곧바로 활성화하는 editor를 만들지 마세요.

**향후 확장:** 미래에 아직 정의되지 않은 위젯을 받을 수 있게 기존 catalog 내부의 `계약 검토 / 버전 / 검증 결과 / 적용 영향`을 확장합니다. 신규 위젯 등록 요청은 name/key/owner·유일성, source API/version, role/field restrictions, data authority/dedupe, loading/empty/partial failure, action capability·confirm·receipt, 설정 스키마·safe defaults, freshness, responsive footprint, i18n/A11y, lifecycle draft→validated→pilot→active→deprecated→retired를 설계하세요. 이 lifecycle은 추가 제안이며 현재 build lifecycle과 혼동하지 않습니다. 구현 artifact 없으면 `계약 작성됨 · 런타임 미지원`. source 권한 변경/retired버전은 홈뷰에서 영향과 대체경로를 표시합니다.

**AI 확장:** Adaptive 위젯은 허용 tools/capability·read vs execute·비용/시간/상태·근거 citation·개인정보 처리·confirmation·command receipt/trace·중복 실행/idempotency·중단/재시도/recovery contract를 포함해야 합니다. 중앙콘솔은 배치가능성/노출경계/계약·운영상태를 관리하고 DWAI/해당 앱 owner는 model/tool/업무규칙/승인 권위를 소유합니다. 중앙홈 설정에서 AI 보안 정책이나 HR/결재 승인 법칙을 새로 덮어쓰지 않습니다.

**flow:** 위젯선택→계약 detail→원천/권한/배치지원 확인→정책탭/청사진으로 연결. 신규제안은 계약요청→owner검토→build지원검증→sample persona validation→시범 적용 preview→조직 운영 승인(새계약)→활성→사용 중뷰영향. retirement에는 영향받는 뷰/대체위젯/보존된 configuration/recovery·audit. 모든 실패는 위젯이 없어진 빈 카드가 아닌 이유+정확한 담당 경로.

**프레임:** 현재 build read-only, source/permission/detail, 미지원계약, 신규 version validation, active/deprecated/retired, AI tool/receipt contract, 시범 적용 영향·부분 실패.

## 3b. 홈 청사진 · `P08-E03-B` · `?tab=blueprints` · 현행 + 명시적 확장

**사용자 / 질문 / 액션 / 유형:** 홈 운영자 / “어떤 대상에게 어떤 시작배치를 제공하며 개인화는 얼마나 보존되는가?” / 청사진 검토·게시·철회, 작성 studio 이동 / blueprint library + publication workflow.

**현행:** 이름/lifecycle/audience.type ALL 또는 values/위젯수/updatedAt/version 목록; draft publish, published revoke, home studio 연결. 청사진 작성/수정·적용은 기존 home personalization API와 editor가 맡습니다. 별도 테넌트 청사진가 개인 활성 뷰를 덮어쓰는걸 기본 동작으로 가정하지 않습니다.

**구조·controls:** 선택청사진 actual layout preview, 포함위젯/provider·권한요구·지원여부, 대상·fallback/개인 변경 보존, published version/변경비교, `홈 studio에서 작성`. 현행 publish/revoke confirmation에는 이름/대상/위젯수/version이 들어갑니다. audience의임의조건 builder·priority·예약·pilot는 추가 제안.

**flow·states:** 목록→선택→모드/기기/권한지원 preview→게시/철회 confirmation→진행→새 lifecycle/원천재조회. 부분 실패은 목록 상태를 서버 기준으로 유지. version conflict·duplicate retry는 명령 키로재조회/복구. revoked template의 이미 개인이 적용한 layout취급은 서버 계약에 따라 설명. 템플릿에 현재 미지원/retired위젯이 있으면 적용을 검증하고 이유·대체안을 보여줍니다.

**프레임:** ALL/부서 대상 가상청사진, 미지원/권한 제약 preview, publish/revoke/실패, no templates, read-only, 모바일.

## 4. 홈 앱 구성 · `P08-E04` · `/admin/experience/home-apps` · 현행

**사용자 / 질문 / 액션 / 유형:** 홈 앱 운영자 / “구성원이 자주 쓰는 앱을 같은 시작점에서 찾을 수 있는가?” / 카테고리·배치 변경·게시 / launchpad studio.

**보존 계약:** Classic과 Flow의 첨부 내 앱 영역은 유지합니다. 외곽 전체 5×2 높이, 4카테고리, 선명하고 고급스러운 아이콘. 업무시작 5개 첫행 연속, 소통협업 첫행 5/둘째행 2는 첫 두 열 바로 아래, 구성원 서비스 2/시스템통제 4는 첫위치부터 붙여배치. `justify-between`식 균등 분산이나 둘째 행 센터 정렬은 금지. Adaptive에서만 별도의 혁신적 앱발견/명령 UI를 제안할 수 있으며 기존 앱 접근 동등경로를 제공하세요.

**구조:** 좌측 catalog 검색/지원·enabled status, 중앙 4category 실배치 preview, 우측 선택 group/resource detail. 한/영편집 locale, category labels/descriptions/sortOrder/enabled, placement resourceKey/groupKey/sortOrder. drag에 keyboard/touch·앞/뒤/그룹이동 버튼 동등 경로. 시작점/열위치/미배치 아이템을 보여줍니다. 비활성 group에배치된앱·중복 resource·미지원앱·권한 없음은 즉시 검증합니다.

**권위:** 앱 catalog 등록·테넌트제공·사용자접근 권한·홈배치·앱 운영 책임은 서로 다름. `홈에추가`가`접근허용`이아님을 표시. badge count/shield같은 정책 표식은 실제 meaning/source/tooltip을 갖고 장식으로 남발하지 않습니다.

**flow:** catalog 선택→group배치→ko/en·1440/1280/390/320 preview→앱 배치 변경 비교/기존 개인화 영향→publish→actual적용검증/감사. narrow화면의 재배치는 우선순위를 보존하고 5×2를 320px에 수평 스크롤을 강제하지 않습니다. 동시 변경·비활성 그룹·찾을 수 없는 자원·loadfail·역할 미리보기제약·지원 모드 읽기 전용 포함.

**프레임:** 정확한 5/7/2/4배치, icon+badge 세상태, group locale edit, 이동/검증오류, 권한에따른 preview, publication/충돌, mobile.

## 5. 설정 예외 검토 · `P08-E05` · `/admin/experience/preference-exceptions` · 현행

**사용자 / 질문 / 액션 / 유형:** 조직 경험정책 검토자 / “이 개인 설정 예외가 타당하며 영향을 설명할 수 있는가?” / approve/reject with evidence / queue + decision dossier.

**구조:** PENDING/APPROVED/REJECTED queue, selected request inspector, action rail. 목록은 요청자(가상)/조직/설정경로/현재조직값/요청값/제출일/state. dossier는 업무 근거·영향·정책 담당자·예외 가능 여부·기존요청/판정·증적 참조·버전. 승인 후 전역 조직값이 변하는 것처럼 표시하지 않음.

**flow:** queue필터→요청선택→원천 policy·지원 값검증→승인 효과 미리보기→reason/evidenceRef→approve/reject→progress→서버 상태/실제 적용값→audit. 승인권한 부족·정책 변경·이미결정·요청 취소·동시 수정은 그 원인과 가능 action. 현행 별도 이중 승인/예약/만료 기능 없는 경우 추가 제안. 모바일 선택 상세은 별도 페이지/stack에서 초점 이동을 보존합니다.

**프레임:** 대기/승인/반려, evidence입력/validation, approval preview/진행/충돌, 빈 대기열/부분사용자 조회실패, 320px.

## 6. 다국어 스튜디오 · `P08-E06` · `/admin/experience/localization` · 현행

**사용자 / 질문 / 액션 / 유형:** 번역작성자·검토자·게시자 / “문구가 의미·레이아웃·fallback 모두 맞으며 어떤 revision이 실제 게시 중인가?” / draft→review→publish/restore / translation studio.

**구조:** bundle/revision 탐색, editor/diff/preview/history workspace. entry key/source/locale/translation/품질 문제/context rows; 선택 entry inspector로 홈·설정·콘솔실사용 context. metrics는전체 card나열이 아닌 미번역/검토대기/품질 issue action으로압축. 기본 언어·fallback·빈 번역과 지원 locale를 명확히 표시.

**flow:** bundle 선택/생성→draft→entryedit→save/changeSummary→diff+실제 사용 맥락 미리보기→submit→authorized reviewer decision→publish→활성 버전/audit. 승인과 게시를 분리;자기 승인 허용 여부는 실제 역할 정책. restore는선택 revision내용을새 draft로 복원/게시하는 실제 계약을 설명. 미지원 항목/key충돌/긴 한·영 label/누락/기본 언어 대체 표시/diff 조회 부분 fail/409/반려 revision분기 프레임 필수.

**프레임:** editor/목록·상세, 번역 문제, diff, Classic/Flow/Adaptive 미리보기(Adaptive 제안), review/approve/reject/publish, history/restore, 원천 조회 실패, mobile행선택/편집.

## 신규 제안 작업공간

### `P08-N01` 경험 운영 센터 · 후보 `/admin/experience/overview`

질문: “현재 조직 홈 경험이 정책 의도대로 적용되는가?” command center. 설정 mode/effective mode/최근 게시 version/개인화 capability/원천 신선도 범위/검증 issue/예외 queue를 연결하고 부정합을 우선합니다. 클릭→정확한 홈 정책/원천/변경 이력/예외. 정상 상태는 한 줄;용도없는큰 상태 점수나 개인 활동 감시 금지. 기존 경험 그룹 landing으로 충분하면 새 메뉴를 만들지 않고 연결합니다.

### `P08-N02` 홈 대상 정책 · 후보 `/admin/experience/home-targeting`

역할/조직별 홈 mode·blueprint 할당은 현재 테넌트 모드와 청사진 대상을 확장하는 새 기능입니다. policy 조건/priority/validity/fallback, 가상 persona의 effective reason, overlap/미할당 검증, 개인 배치 보존/migration preview, 승인·pilot·rollback을 요청합니다. unsupported 조건을 실제 가능한 toggle처럼 보이지 않게. 기존 policy 탭의 advanced 작업으로 충분하면 그 안에 둡니다.

### `P08-N03` 홈 게시 검증 · 후보 `/admin/experience/home-release-validation`

릴리스 검증 workflow. 대상 모드/정책 버전/빌드 스냅샷/원천 범위/persona·viewport·locale·theme→검증 실행→진행/실패 항목→시각 비교와 데이터 권위·접근성·키보드 결과→검토→게시 가능 여부와 차단 이유→실제 적용값 확인. 실제 실행 증거가 없는 녹색 PASS를 그리지 마세요. 표준/와이드의 실제 차이, 승인 내 앱의 아이콘 정렬, Classic 조직 포털·Flow 개인 실행·AI Stage 의도 입력이 첫 viewport에서 구별되는지, 필수 확인의 발견 가능성, 위젯 내부 스크롤 제거, 업데이트 정보 중복, 빈값과 부분 실패를 검증합니다. 새 모드별 정보 위계는 P00 및 각 홈 프롬프트를 따릅니다. 필요하면 기존 홈 화면 설정의 검증 작업공간으로 흡수하며, 검증 run API는 추가 기능입니다.

## AI·Adaptive 운영 경계와 제출 기준

Adaptive / AI Stage는 MZ 사용자가 기대하는 빠른 피드백과 직접 조작, 호기심과 즉시 효용을 주는 AI 중심의 새 경험입니다. 홈 운영 UI는 문맥별 작업 canvas가 어떤 원천·허용 도구·권한·근거로 동작하는지 예측 가능하게 설계해야 합니다. 읽기 전용 요약→근거 확인→검토 가능한 실행안→허용된 행동의 사용자 확인→진행과 취소 조건→실행 영수증과 실제 앱 상태→안전한 오류·복구·trace를 prototype으로 연결하세요. 현재 capability가 REFERENCE 또는 REVIEW인 항목은 조회·검토·원본 앱 이동만 제공하며, 홈에서 실행되는 것처럼 그리지 마세요. EXECUTE는 해당 앱과 서버 계약이 실제 허용할 때만 실행 action을 제공합니다. AI 추론의 시점과 원천 갱신 시점, 모델·도구 정책과 테넌트 경험 설정을 혼합하지 않습니다.

모든 frame ID의 1440/1280/390/320·200% zoom, 한·영, light/dark/high contrast, reduced motion, keyboard focus/touch, partial API failure 및 권한 상태를 P00대로 제출하세요. 각 control annotation에는 저장 단위·운영 권위·실제 기능/추가 제안·원천·상태 전이를 표시하세요. Classic과 Flow는 첨부 내 앱만 공통으로 보존하고 전체 구성은 한눈에 구분되게 만드세요. Adaptive / AI Stage는 더 혁신적인 제3 경험으로 별도 제출합니다.
