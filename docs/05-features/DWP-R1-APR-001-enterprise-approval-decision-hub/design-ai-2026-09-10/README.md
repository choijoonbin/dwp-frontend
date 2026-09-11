# 전자결재 Design AI 인계 패키지

- 기준일: 2026-09-10
- 상태: `DESIGN BRIEF READY / APPROVAL IMPLEMENTATION FROZEN`
- 범위: 전자결재 사용자·관리자 전체 화면의 디자인 고도화와 후속 구현 인계
- 비범위: 이번 단계의 React·API·DB·OpenAPI 구현, 운영 출시 승인

이 패키지는 최신 DWP 코드, 실제 로컬 브라우저 화면, 기존 전자결재 문서와 공식 글로벌
제품 자료를 교차 감사한 뒤 만든 디자인 의뢰서다. 기존 전자결재 구현을 폐기하거나 별도
Next.js 앱을 만드는 요청이 아니다. Design AI가 반환한 화면을 다시 검토·승인한 뒤에만
코드 구현을 재개한다.

참고 원본은 사용자가 제공한
[Google Stitch 프로젝트](https://stitch.withgoogle.com/projects/13391261371843159731)의
`Chronos Enterprise Approval Home`과 `Chronos Enterprise Approval Command Center`다.
정보 위계와 작업 속도는 참고하되 Chronos 브랜드나 별도 shell은 복제하지 않는다.

## 가장 중요한 화면 경계

1. `/approvals/home`은 개인 전자결재 홈이다. 홈 본문에 `전체 대기 / 긴급 결재 / 오늘 마감 /
고위험` 메뉴 패널을 만들지 않는다.
2. 위 4개 항목은 전자결재 제품 사이드바의 `결재함` 아래에서 접고 펼치는 하위 메뉴다.
   선택하면 `/approvals/inbox?queue=...`의 본문 목록과 상세가 바뀐다.
3. `/approvals/inbox`는 목록·상세·결정이 한 화면에서 이어지는 action center다.
4. 사용자 업무 Surface와 관리자 Surface는 현재처럼 분리한다. 관리 메뉴를 사용자 홈에
   섞지 않는다.
5. DWP 글로벌 헤더, 제품 사이드바, 테넌트·사용자·접근 범위, DWAI·ON 진입을 재제작하지
   않는다.

## Design AI에 전달하는 순서

### 첫 대화

다음 자료를 순서대로 전달한다.

1. 현재 DWP 전자결재 홈과 결재함 캡처
2. 사용자가 제공한 `Chronos Enterprise Approval Home` 참고 화면
3. 사용자가 제공한 `Chronos Enterprise Approval Command Center` 참고 화면
4. [00 현행 감사·벤치마크·목표 IA](00-current-audit-benchmark-ia.md)
5. [01 개인 전자결재 홈](01-personal-home.md)

첫 전달 문장:

> 첨부한 DWP 현행 감사와 화면 프롬프트를 읽고, 기존 DWP 글로벌 셸과 실제 권한·API 계약을
> 보존한 전자결재 화면을 설계해 주세요. 참고 이미지의 정보 위계와 작업 속도는 수용하되
> 별도 브랜드, 별도 사이드바, 허구의 기능은 복제하지 마세요. 우선 01 화면의 1440px 정상,
> 390px 모바일, 로딩·부분 실패·권한 회수 상태를 제출하고 다음 화면은 아직 만들지 마세요.

### 같은 디자인 대화의 후속

01을 검수해 셸·밀도·타이포·색 역할을 확정한 뒤 아래 파일을 **한 번에 하나씩** 전달한다.

| 순서 | 프롬프트                                                        | 디자인 대상                      | 제품 위치                                                         |
| ---- | --------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------- |
| 01   | [개인 전자결재 홈](01-personal-home.md)                         | 시작점·우선순위·내 기안 흐름     | 기존 메뉴 `/approvals/home`                                       |
| 02   | [결재함 Action Center](02-inbox-command-center.md)              | 하위 큐·검색·목록·배치·선택      | 기존 메뉴 `/approvals/inbox`                                      |
| 03   | [결재 상세·결정](03-approval-detail-decision.md)                | 근거·경로·감사·안전한 결정       | 결재함 우측 상세, 새 메뉴 아님                                    |
| 04   | [모바일 결재 처리](04-mobile-triage-and-batch.md)               | 목록↔상세↔결정↔복귀              | 02·03의 모바일 변형                                               |
| 05   | [양식 선택·기안 작성](05-request-catalog-and-compose.md)        | 게시 양식·동적 필드·부분 초안    | `/approvals/requests/new`                                         |
| 06   | [상신 전 검증·증빙](06-request-preflight-evidence.md)           | 결재선·참조·첨부·최종 확인       | 05의 단계/패널, 새 메뉴 아님                                      |
| 07   | [임시 저장·충돌 복구](07-drafts-and-conflict-recovery.md)       | 초안 재개·버전 충돌·안전 복구    | `/approvals/requests/drafts`                                      |
| 08   | [내 기안·보완 요청](08-my-requests-needs-info.md)               | 진행 추적·회수·보완 답변         | `/approvals/requests/submitted`, `/approvals/requests/needs-info` |
| 09   | [처리 완료·보관·검색](09-completed-archive-search.md)           | 내 결정 증적·완료 요청·감사 검색 | `/approvals/completed`, `/approvals/requests/archive`             |
| 10   | [결재 위임·대결](10-delegation-proxy.md)                        | 기간·범위·후보·철회·대표 행위    | `/approvals/delegations`                                          |
| 11   | [관리 홈](11-admin-overview.md)                                 | 예외 중심 운영·통제 상태         | `/approvals/admin/overview`                                       |
| 12   | [양식 카탈로그·버전](12-form-catalog-versioning.md)             | 카테고리·목록·Inspector·게시     | `/approvals/admin/forms`                                          |
| 13   | [양식 빌더·미리보기](13-form-builder-preview.md)                | 필드 편집·검증·다국어·Preview    | 12의 dialog/workspace                                             |
| 14   | [Workflow·Routing Studio](14-workflow-routing-studio.md)        | 순차 단계·후보·SLA·게시          | `/approvals/admin/workflows`                                      |
| 15   | [정책·SoD·SLA·위임 거버넌스](15-policy-sod-sla-delegation.md)   | 현재/제안 diff·영향·독립 게시    | `/approvals/admin/policies` 중심                                  |
| 16   | [운영·복구·보존·서명 준비](16-operations-recovery-readiness.md) | 지연·전달 실패·재처리·외부 Gate  | `/approvals/admin/operations`, `/approvals/admin/signatures`      |

후속 전달 문장:

> 앞서 확정한 전자결재 디자인 체계를 유지하면서 첨부한 번호의 화면만 설계해 주세요. 정상
> 대표 화면뿐 아니라 프롬프트에 명시된 실패·권한·충돌·모바일·접근성 상태와 클릭 흐름을
> 함께 제공해 주세요. `기존 구현`, `디자인 재구성`, `신규 API 필요`, `운영 조건부`를 프레임
> 주석에서 구분하고, 지원하지 않는 기능을 이미 동작하는 것처럼 표시하지 마세요.

## 내부 검수자가 사용하는 문서

Design AI에는 화면 프롬프트만 순서대로 전달하고, 제품·개발 검수자는 다음 문서를 함께
사용한다.

- [00 현행 감사·벤치마크·목표 IA](00-current-audit-benchmark-ia.md)
- [17 디자인→코드 매핑과 검증 계획](17-design-to-code-mapping-and-verification.md)

## Design AI가 반환해야 하는 공통 산출물

- 프레임 이름: `APR-번호-크기-테마-상태`, 예: `APR-02-1440-light-populated`
- 기준 크기: 1440×900, 1280×800, 390×844, 320×568, 1280px에서 200% 확대
- 테마: 핵심 정상 화면의 light/dark, 중요 예외의 forced colors, reduced motion 주석
- 정상 외 상태: loading, empty, search-empty, partial, offline/503, 403·권한 회수, stale/409,
  long-content 중 화면에 해당하는 모든 상태
- 흐름: 클릭·키보드·모바일의 진입→검토→확정→실패 복구→원래 맥락 복귀
- 컴포넌트: anatomy, variant, 상태, 최소/최대 폭, 줄바꿈, focus, token 대응
- 필드·행동: 데이터 의미, 수정 주체, null, 권한 전제, 결과, 취소, 재시도, 감사 연결
- 구현 분류: `EXISTING`, `REDESIGN_ONLY`, `CONTRACT_FIRST`, `EXTERNAL_GATE`

정상 화면 한 장, 잘린 모바일 축소본, 성공 토스트만으로 화면을 완료 처리하지 않는다.

## 디자인 수용 순서

1. 01~04로 사용자 결재 판단 축을 먼저 확정한다.
2. 05~10으로 기안자·요청자 전체 수명주기를 확정한다.
3. 11~16으로 관리자 통제·운영 표면을 확정한다.
4. 각 묶음마다 메뉴 위치, 권한, 상태 진실성, 모바일, 접근성을 검수한다.
5. 모든 승인된 프레임을 [17 매핑 문서](17-design-to-code-mapping-and-verification.md)에 대조한다.
6. 그 뒤에만 코드 구현 범위와 API 증분을 승인한다.

## 받은 디자인을 다시 이 작업에 전달할 때

편집 가능한 링크 또는 이미지/PDF와 함께 다음 정보를 제공한다.

- 프레임 ID와 버전
- 포함한 정상·예외·모바일 상태 목록
- prototype 시작 프레임
- 사용한 컴포넌트와 token 목록
- `CONTRACT_FIRST` 또는 `EXTERNAL_GATE`로 표시한 항목
- Design AI가 임의로 바꾼 메뉴·권한·API 가정

반환된 디자인은 그대로 구현하지 않는다. 최신 코드·OpenAPI·Product Surface 권한과 다시
대조하고, 시각적 품질뿐 아니라 보안·상태 전이·접근성까지 비판적으로 수용 판정한다.
