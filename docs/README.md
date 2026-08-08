# DWP Documentation

이 디렉터리는 DWP의 제품 판단, 설계, 구현 계약과 Delivery 증거를 관리한다.
참고 화면이나 외부 제품을 그대로 복제하지 않으며, 검증된 Pattern과 원리만 DWP
요구사항으로 재정의한다.

## 폴더 구조

| 경로                | 책임                                                     |
| ------------------- | -------------------------------------------------------- |
| `00-governance/`    | 문서 표준, 기능 개발 Gate, Template과 의사결정 절차      |
| `01-product/`       | 프로젝트 비전, Roadmap, 범위와 Product Experience        |
| `02-research/`      | 시장·사용자·참고 자료의 관찰, 비교와 채택 근거           |
| `03-architecture/`  | ADR, 보안·데이터·Integration·Agent Architecture          |
| `04-design-system/` | UI Foundation, Token, Component, 접근성과 Figma 계약     |
| `05-features/`      | Feature별 기획·화면·디자인·데이터·API·Agent·Test Package |
| `06-delivery/`      | Pilot, Release Gate, 운영 준비와 검증 증거               |

## 핵심 문서

- `00-governance/기능 개발 산출물 및 Gate.md`
- `01-product/프로젝트 개요.md`
- `01-product/프로젝트로드맵.md`
- `01-product/R0 핵심 사용자 Journey 및 KPI.md`
- `01-product/R1 AI Employee Work Hub MVP PRD.md`
- `01-product/개인화 홈 및 앱 경험 기획.md`
- `02-research/참고 자료 평가 원칙.md`
- `03-architecture/R0 기반 의사결정.md`
- `03-architecture/R0 플랫폼 통합 및 Agent Runtime ADR.md`
- `03-architecture/R0 Contract Spike 1 - Governed Plan Preview.md`
- `04-design-system/DWP UI Foundation 전략.md`
- `04-design-system/DWP Premium Experience Direction.md`
- `04-design-system/프론트엔드 UI UX 기술검토.md`
- `04-design-system/DESIGN_SYSTEM.md`
- `04-design-system/Figma 운영 가이드.md`
- `05-features/DWP-R0-SEC-001-session-lifecycle/`
- `05-features/DWP-R1-CORE-001-reference-work-hub/`
- `06-delivery/디자인 파트너 선정 및 Pilot Charter.md`

## Feature 문서 규칙

모든 신규 메뉴·화면·Agent 기능은 `05-features/<feature-id>/` 아래에서 관리한다.
`feature-id`는 Release 기반 Package의 경우 `DWP-<release>-<domain>-<number>`, 독립
Backlog의 경우 `FEAT-<domain>-<number>` 형식을 사용한다. 필수 산출물과 승인 순서는
`00-governance/기능 개발 산출물 및 Gate.md`를 따른다.

실행, 빌드와 검증 명령은 프로젝트 Root `README.md`를 기준으로 한다.
