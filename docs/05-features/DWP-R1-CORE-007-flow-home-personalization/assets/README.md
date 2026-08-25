# DWP-R1-CORE-007 Figma·계약 초안 및 시각 증거

## Figma

- File: [DWP Flow Home — Development Ready v1](https://www.figma.com/design/WKo4pIiHeCvFLcVgMHzgMn)
- Feature ID: `DWP-R1-CORE-007`
- 실제 작성 Frame: `01 Screens / Desktop / Default / 1440`
- Canonical 후속 Frame 명명 규칙: `DWP-R1-CORE-007/<numeric-viewport>/<state>`
- 기준일: 2026-08-21

Figma File 이름은 생성 당시의 작업명이며 Package의 Gate 상태를 뜻하지 않는다. Canonical 상태는
Feature README의 `design / build-ready candidate / approval pending`이다.

## Frame 상태

| Frame                                   | 목적                           | 상태                              | Node URL                                                                                                         |
| --------------------------------------- | ------------------------------ | --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `01 Screens / Desktop / Default / 1440` | Flow Home 기본 읽기 화면       | 작성·시각 검증 완료               | [node `6:2`](https://www.figma.com/design/WKo4pIiHeCvFLcVgMHzgMn/DWP-Flow-Home-Development-Ready-v1?node-id=6-2) |
| `DWP-R1-CORE-007/1440/edit`             | Widget·Dock 편집, Undo·Preview | Figma Starter MCP 할당량으로 대기 | 대기                                                                                                             |
| `DWP-R1-CORE-007/390/default`           | 390·320px 단일 문서 흐름       | Figma Starter MCP 할당량으로 대기 | 대기                                                                                                             |
| `DWP-R1-CORE-007/390/edit`              | Touch·Menu 기반 편집           | Figma Starter MCP 할당량으로 대기 | 대기                                                                                                             |

Desktop Default의 구성과 시각 방향 및 Node URL은 검증했다. 다만 이 한 Frame만으로 G2·G3를 완료
처리하지 않는다. MCP 할당량이 복구되면 나머지 Frame을 만들고 각 구현 Issue에 File이 아닌 Node가
포함된 Frame URL을 연결한다.

## 개발 계약 초안

아래 파일은 구현 전에 Canonical Backend·Analytics 계약으로 이관하고 Owner 승인을 받아야 하는
설계 초안이다. 현재 Runtime API나 수집 계약으로 간주하지 않는다.

- [OpenAPI 증분 계약](flow-home-api-delta.openapi.yaml): 앱별 알림 Summary와 Preference·Policy
  Typed Schema 후보
- [Home Analytics Event Schema](home-analytics-event.schema.json): Phase 1 저 Cardinality 제품 행동
  Event Allowlist
- [수용 테스트 Fixture](flow-home-test-fixtures.json): Desktop·Mobile·Partial·Empty·Offline 대표 상태

## Desktop Default 검증 내용

- `Compact Context → My App Dock → 관리형 공지(해당 시) → Now → Today Flowline → Work Signals →
Next` 읽기 순서
- 첫 Viewport에서 앱 실행과 현재 우선 행동의 공존
- Warm Pearl, DWP Cobalt·Cyan과 제한된 Coral을 쓰는 Soft Aurora 방향
- 대형 배경 Hero가 아닌 실제 업무 Flowline 중심 구성
- 동일 크기 Card 반복을 줄인 Section별 정보 위계
- 연속 장식 Animation 없이 상태·시간·Source를 설명하는 구조

검증 완료 표시는 Figma 시각 산출물의 방향 확인을 뜻한다. 코드 구현, 다중 Viewport, 접근성 또는
사람의 Design 승인을 의미하지 않는다.

## 남은 Figma 작업

1. Desktop Edit: Drag Handle, 메뉴 대체, Undo·Redo, Save·Cancel·Reset, Device Preview
2. Mobile Default: Dock 예산, `모든 앱`, 단일 열 Reflow, 행 예산·전체 보기
3. Mobile Edit: Long Press와 명시적 버튼, Touch Drag와 단일 Pointer 메뉴 대체
4. Default/Edit의 Loading·Empty·Partial·Error·Denied·Stale 상태
5. Light·Dark·High Contrast·Reduced Motion Annotation
6. `1440×900`, `1280×800`, `390×844`, `320×568`, `html font-size: 200%` 검토 Frame
7. Design System Component·Token Mapping과 실제 Node URL 기록
8. 실제 Desktop Frame을 Canonical `DWP-R1-CORE-007/1440/default`로 Rename하고 `1440×900` 첫
   Viewport 경계를 Annotation

## 출처·Asset 정책

- 사용자 제공 기존 Home Screenshot은 문제 분석을 위한 내부 참고이며 이 Package에 복사하지
  않았다.
- 세션에서 만든 방향성 이미지는 탐색 자료이며 Figma·Token·상태 계약을 대신하지 않는다.
- 외부 제품의 Screenshot, Logo, Component, Illustration과 문구를 사용하지 않았다.
- 구현의 Canonical 시각 근거는 승인된 Figma Node, DWP Design Token과 Storybook 상태다.

## 승인 기록

| 역할          | 상태      | 승인자 | 일자 | 증거 |
| ------------- | --------- | ------ | ---- | ---- |
| Product       | `pending` | -      | -    | -    |
| Design        | `pending` | -      | -    | -    |
| Accessibility | `pending` | -      | -    | -    |
| Frontend      | `pending` | -      | -    | -    |

승인자·일자·Frame Node가 채워지기 전에는 `approved`로 변경하지 않는다.
