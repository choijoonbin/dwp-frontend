# DWP Figma 운영 가이드

> 문서 상태: Active v1.0
>
> 기준일: 2026-08-08
>
> Figma 파일: [DWP UI Foundation](https://www.figma.com/design/vuQcRchq52U5bZnDTRWIAI)

## 1. 역할

Figma는 DWP Design Token과 Component의 설계, 검토와 협업 공간이다. 값의 기술적
Source of Truth는 `libs/design-system/tokens/dwp.tokens.json`이며 Figma Variable은
이를 이름과 Mode까지 동일하게 반영한다.

- Code Token이 값과 Runtime 계약의 원본이다.
- Figma는 시각 검토, Design QA와 Product·Design·Engineering 승인을 담당한다.
- Figma에서 승인된 변경은 같은 Pull Request에서 Code Token과 Story를 갱신한다.
- 외부 UI Kit는 비교 자료로만 사용하고 Component를 DWP Library에 복제하지 않는다.

## 2. 계획한 Library v1

### Variable Collection

| Collection         | Mode                                                 |
| ------------------ | ---------------------------------------------------- |
| DWP Primitives     | Value                                                |
| DWP Semantic Color | Light, Dark, Light High Contrast, Dark High Contrast |
| DWP Dimensions     | Value                                                |
| DWP Density        | Compact, Standard, Comfortable                       |
| DWP Typography     | Value                                                |

### Component

- ProductMark
- Button
- IconButton
- NavigationItem

Component는 Variable Binding, Variant, Keyboard·Focus 상태, 긴 한국어·영문과 Code
Mapping이 검증된 뒤 Publish한다.

## 3. 현재 Gate

2026-08-08 기준 연결된 Figma Team은 Starter Plan이다. `DWP Semantic Color`의 두
번째 Mode를 추가하는 검증에서 `Limited to 1 modes only`가 반환됐다. 호출은
원자적으로 실패했으며 불완전한 Variable이나 Component는 생성되지 않았다.

다음 중 하나가 완료되기 전에는 Figma Library Build를 재개하지 않는다.

1. 현재 Team을 다중 Variable Mode 지원 Plan으로 변경
2. 다중 Mode가 가능한 Team·Project로 `DWP UI Foundation` 파일을 이동 또는 재생성

Light·Dark·고대비를 별도 Collection으로 흉내 내지 않는다. 이 방식은 한 번의 Mode
전환, Semantic Alias와 Code Mapping을 깨뜨린다. Code와 Storybook은 현재 모든
Appearance Mode의 Source와 검증 수단으로 계속 사용한다.

## 4. 재개 절차

1. Figma Team Plan과 편집 권한을 확인한다.
2. 파일의 Local Variable·Component가 비어 있는지 재검사한다.
3. `DWP Primitives`부터 Collection과 Scope·Code Syntax를 만든다.
4. Semantic Color 4 Mode와 Density 3 Mode를 만든다.
5. Typography·Effect Style을 만든 뒤 수량과 Binding을 검증한다.
6. Foundation 문서 Page를 만든 후 Component를 하나씩 구현한다.
7. Metadata, Screenshot, Contrast와 Naming Audit를 통과한다.

Workflow 상태는 `/tmp/design-system-state-dwp-ui-foundation-v1.json`에 기록한다.
