# R1 Multi-Surface Personal Home Composer ADR

> 상태: Accepted and Implemented v2.0
>
> 기준일: 2026-08-18
>
> 적용 저장소: `dwp-frontend`, `dwp-backend`

## 1. 결정

DWP는 제품마다 별도의 자유 배치형 포털 빌더를 만들지 않는다. 하나의 **Personal Home
Composer**를 공유하고, 각 제품은 승인된 Widget Registry와 실제 데이터 조회·권한 계약만
등록한다. HR 제품 Surface는 `hcm-home`이며 기존 개인 홈은 `workspace-home`으로 명시한다.

사용자는 자신에게 허용된 범위에서 다음 작업을 할 수 있다.

- 위젯 순서 변경
- 선택 위젯 숨김·복원
- 위젯별 승인된 반응형 너비·높이 선택
- `balanced`, `expressive`, `focused` 중 표현 밀도 선택
- 저장 취소와 기본 구성 복원

이 기능은 임의 HTML·JavaScript·CSS를 저장하는 Page Builder가 아니다. 코드로 검토된 React
Component만 Registry에 등록하고 DB에는 식별자, 노출 여부, 의미 너비·높이와 순서만 저장한다.

## 2. 외부 기준

- [Microsoft Viva Connections Dashboard](https://learn.microsoft.com/en-us/viva/connections/create-dashboard)는
  사용자가 Card를 재정렬·숨김·복원하고 개인 Card를 추가할 수 있게 하며, 변경은 개인에게만
  적용한다. DWP도 조직 기본값과 개인 Overlay를 분리한다.
- [Microsoft Viva Connections Audience Targeting](https://learn.microsoft.com/en-us/viva/connections/use-audience-targeting-in-viva-connections)은
  역할·지역별 Card 노출을 지원하지만 Targeting은 보안 통제가 아니라고 명시한다. DWP도
  Frontend Audience Filter와 Backend 권한 검사를 분리한다.
- [Oracle HCM Quick Actions](https://docs.oracle.com/en/cloud/saas/human-resources/faucf/quick-actions.html)은
  `Me`, `My Team`, `My Client Groups` 작업을 Security Privilege와 대상 인구에 따라 다르게
  제공한다. HCM Home의 개인·Manager·Operator Widget도 같은 누적 Audience 원칙을 따른다.
- [W3C WCAG Animation from Interactions](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html)은
  비필수 동작을 끄고 사용자 Reduce Motion 선호를 존중하도록 요구한다. 모든 Drag·표현
  Transition은 `prefers-reduced-motion`에서 제거한다.
- [W3C CSS Grid Layout Level 2](https://www.w3.org/TR/css-grid-2/)는 암시적 행의 크기를
  `grid-auto-rows`와 Track Sizing Function으로 통제하도록 정의한다. DWP는 브라우저의 무제한
  `auto` 행 계산에 위젯 높이를 맡기지 않고 승인된 고정 Block Size를 제공한다.
- [Grafana Dashboard Layout](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/create-dashboard/)은
  자유 좌표형 Custom Layout과 균일 제약형 Auto Grid를 구분한다. DWP 구성원 홈은 반복 업무의
  읽기 순서와 모바일 Reflow가 우선이므로 Auto Grid를 채택한다.
- [React Grid Layout](https://github.com/react-grid-layout/react-grid-layout)과
  [GridStack](https://gridstackjs.com/doc/html/classes/GridStack.html)은 `w`, `h`, `min/max` 제약과
  직렬화 가능한 Layout을 공통적으로 사용한다. DWP도 2차원 제약을 저장하지만 임의 좌표와 픽셀은
  저장하지 않는다.
- [Fluent 2 Layout](https://fluent2.microsoft.design/layout)은 Modular Grid, 일관된 간격,
  Breakpoint별 Reflow를 권장한다. 높이 토큰은 8px Baseline을 따르고 모바일에서는 Content
  Height로 전환한다.

## 3. 데이터 계약

`usr_home_preferences`는 `(tenant_id, user_id, surface_key)`당 한 행을 가진다.

| 컬럼             | 계약                                                                |
| ---------------- | ------------------------------------------------------------------- |
| `surface_key`    | `workspace-home`, `hcm-home` 같은 불변 제품 Surface 식별자          |
| `schema_version` | 현재 `5`; 저장 Payload의 호환성·승격 기준                           |
| `layout_payload` | 서버가 검증한 JSONB Layout; 실행 코드와 업무 데이터는 저장하지 않음 |
| `version`        | 동시 편집 충돌을 막는 낙관적 잠금                                   |
| 감사 컬럼        | 생성·수정 시각과 Actor                                              |

Payload 예시는 다음과 같다.

```json
{
  "appLayout": null,
  "presentation": "balanced",
  "widgets": [
    {
      "widgetKey": "quick-actions",
      "visible": true,
      "size": "full",
      "height": "short"
    },
    {
      "widgetKey": "profile",
      "visible": false,
      "size": "compact",
      "height": "standard"
    }
  ]
}
```

JSONB를 선택한 이유는 Surface마다 Widget 조합이 다르고 순서 자체가 사용자 Aggregate의
일부이기 때문이다. 검색·결재·업무 데이터는 이 JSONB에 넣지 않는다. 분석이 필요한 Widget
Catalog와 허용 값은 `sys_code_sets`, `sys_code_values`, `sys_code_bindings`에 별도로 등록한다.

## 4. 서버 불변조건

`HomePreferenceService`의 Surface Contract가 다음을 요청마다 강제한다.

1. 등록된 `surfaceKey`, `widgetKey`, `presentation`, `size`, `height`만 허용한다.
2. 중복 Widget, 허용되지 않은 너비·높이, HCM의 `appLayout`을 거부한다.
3. 조직이 잠근 Widget은 숨길 수 없고 최소 한 개의 Widget은 남아야 한다.
4. 누락된 신규 Widget은 Registry 기본값으로 보완해 배포 후 기존 사용자 Layout을 승격한다.
5. Payload는 최대 30개 Widget, 직렬화 크기 96KB로 제한한다.
6. `version`이 다르면 `409 RESOURCE_CONFLICT`로 거부한다.
7. 저장·초기화는 Surface를 포함한 대상 ID로 append-only 감사 이벤트를 남긴다.

API는 기존 Workspace 호환 Endpoint를 유지하면서 Surface API를 추가한다.

| 목적      | Endpoint                                                |
| --------- | ------------------------------------------------------- |
| 조회      | `GET /v1/home-preferences/surfaces/{surfaceKey}`        |
| 저장      | `PUT /v1/home-preferences/surfaces/{surfaceKey}`        |
| 기본 복원 | `POST /v1/home-preferences/surfaces/{surfaceKey}/reset` |
| 호환      | `/v1/home-preferences`, `/v1/home-preferences/reset`    |

## 5. Frontend 재사용 계약

공통 모듈 `components/workspace-composer`는 다음 책임만 가진다.

- Registry와 저장값 Reconcile
- Mouse·Touch·Keyboard Drag 정렬
- 의미 너비·높이 선택과 반응형 60-column Auto Grid 배치
- 숨김 Widget Gallery
- 표현 모드, 저장·취소·초기화 Toolbar
- Reduce Motion과 접근 가능한 Label

제품 모듈은 다음만 제공한다.

```text
surface key
widget registry: key, icon, canHide, defaultSize, allowedSizes,
                 defaultHeight, allowedHeights, audience
runtime audience: all, manager, operator
label/description i18n
renderWidget(key, size, height)
```

Audience Filter는 보안이 아니다. 숨겨진 Widget Route와 API는 기존 Entitlement, Target
Population, Field Masking을 다시 검사한다. 역할을 잃은 Widget 설정은 삭제하지 않고
비활성 상태로 보존해 권한이 복구될 때 사용자 순서를 되살린다.

## 6. 2D Layout 계약

개인 홈은 자유 좌표 Canvas가 아니라 **순서 보존형 Auto Grid**다. 저장 배열 순서, DOM 순서,
키보드 탐색 순서, 모바일 표시 순서를 동일하게 유지하며 CSS `dense` 재배치는 사용하지 않는다.

| 축   | 저장 Token                                               | Runtime 규칙                             |
| ---- | -------------------------------------------------------- | ---------------------------------------- |
| 너비 | `fifth`, `quarter`, `compact`, `medium`, `large`, `full` | Desktop 60단 Grid, Mobile·Tablet 단일 열 |
| 높이 | `short`, `standard`, `tall`, `expanded`                  | 288, 368, 448, 560px 고정 Block Size     |

높이는 모두 8px Baseline의 배수다. 각 위젯은 선택된 Block Size를 정확히 유지하고 다음 Grid
행은 현재 행에서 가장 높은 위젯 아래에서 시작한다. 내부 콘텐츠가 넘치면 위젯 내부에서
Scroll한다. 작은 화면에서는 고정 Block Size와 내부 Scroll을 해제해 전체 콘텐츠가 문서 흐름
안에서 보이게 한다. 위젯 데이터 개수도 높이 Token의 `contentRows` 예산을 사용해 과도한 빈
공간과 불필요한 Scroll을 줄인다.

픽셀 높이, `x/y` 좌표, 실행 가능한 Style은 저장하지 않는다. 제품별 Registry와 서버 Surface
Contract가 기본 높이와 허용 높이를 함께 소유하고, 누락된 이전 문서는 읽을 때 기본 높이로
승격한다. 관리형 Zone의 높이는 Tenant 관리자가 관리 콘솔에서 게시하고 개인 문서에는 저장하지
않는다.

## 7. UX 계약

- 편집 진입 전에는 Drag Handle과 제어 버튼을 노출하지 않는다.
- 편집 Toolbar는 콘텐츠 흐름 안에서 고정하고 본문을 가리지 않는다.
- 각 Widget의 편집 Strip은 실제 제목·명령과 분리한다.
- 너비 Token은 Desktop Grid 의미이며 Mobile과 Tablet에서는 모두 단일 열로 재배치한다.
- 높이 선택은 텍스트 메뉴가 아니라 비율 Glyph로 제공하고 Tooltip과 ARIA Label을 함께 둔다.
- 모바일에서는 높이 제약을 해제해 콘텐츠 누락과 이중 Scroll을 방지한다.
- 표현 모드는 업무 의미와 정보 순서를 바꾸지 않는다. 색·표면 밀도만 승인 Token 안에서
  달라진다.
- 장식용 자동 Animation, 무한 Carousel, 합성 HR 숫자는 사용하지 않는다.
- 조직 기본값과 사용자의 개인 Overlay를 시각·감사 관점에서 구분한다.

## 8. 신규 Surface 등록 Gate

다른 앱에서 Composer를 사용하려면 다음을 모두 완료한다.

1. Backend Surface Contract와 System Code 등록
2. Widget별 Owner, 데이터 원천, 권한, 기본·허용 너비와 높이, 빈 상태, 오류 상태 정의
3. Frontend Registry와 한국어·영어 Label 등록
4. Desktop·Mobile·Keyboard·Touch 정렬 검증
5. 역할 획득·상실 후 Layout 복원 검증
6. 저장 충돌, 알 수 없는 Widget, 너비·높이 위변조 API 테스트
7. Axe 중대 위반 0건, 수평 Overflow 0, Reduce Motion 검증
8. 앱별 최대 Widget 수와 성능 예산 승인

Tenant 관리자가 Registry 자체를 임의 확장하는 기능은 이번 Baseline에 포함하지 않는다.
향후 Tenant Home Policy를 추가하더라도 검토된 Global Registry의 부분집합만 선택하며 외부
실행 코드를 업로드할 수 없다.

## 9. 구현·검증 증거

- DB Migration: `V67__evolve_personal_home_surfaces.sql`,
  `V108__govern_home_widget_heights.sql`
- Backend: `HomePreferenceServiceTest`와 플랫폼 전체 Test
- Frontend: `workspace-composer-model.test.ts`
- E2E: `hcm-experience.spec.ts`의 저장·새로고침·복원, 구성원·Manager·Operator 시나리오
- Visual QA: Desktop Chrome과 iPhone 13에서 Home·Editor 프레이밍, 겹침, Overflow 점검
