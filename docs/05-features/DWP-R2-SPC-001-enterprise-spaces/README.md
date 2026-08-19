# DWP-R2-SPC-001 Enterprise Spaces

- 상태: `local implementation baseline`
- Owner: Product Platform / Collaboration & Knowledge
- Roadmap Release: R2 Collaboration Foundation
- Architecture: `../../03-architecture/R2 Enterprise Space Platform ADR.md`
- Research: `../../02-research/DWP Space 글로벌 벤치마크 및 제품 방향 2026-08-18.md`

## 목표

Tenant 안에서 구성원이 목적별 협업·업무 Space를 안전하게 만들고, 사람·콘텐츠·App·외부
자원·AI를 하나의 Context로 운영한다. Template 기반 셀프서비스와 위험 기반 승인,
Space Owner 위임, 중앙 정책·감사·수명주기를 함께 제공한다.

## 제품 Surface

| Surface               | 대상                  | 책임                                        |
| --------------------- | --------------------- | ------------------------------------------- |
| Space App             | 모든 Entitled 구성원  | My Spaces, Discover, 요청, Space 업무       |
| Space Owner Studio    | Space Owner·Moderator | Owner는 설정·멤버십, Moderator는 콘텐츠 조정 |
| Tenant Control Center | 위임된 Tenant 관리자  | 정책, Template, 승인, 예외, 감사, 전체 상태 |

Provider Control Plane은 상품 Plan, 기본 Template Pack, Feature Flag, Service Health만
관리하며 Tenant Content를 기본적으로 열람하지 않는다.

## 산출물

- [01-기획 정의.md](01-기획%20정의.md)
- [02-화면 설계서.md](02-화면%20설계서.md)
- [03-디자인 정의.md](03-디자인%20정의.md)
- [04-데이터 설계.md](04-데이터%20설계.md)
- [05-API 권한 계약.md](05-API%20권한%20계약.md)
- [06-AI Agent 계약.md](06-AI%20Agent%20계약.md)
- [07-수용 테스트.md](07-수용%20테스트.md)
- [08-운영 및 복구 런북.md](08-운영%20및%20복구%20런북.md)

## Build·Connect 결정

| 범위                                                      | 결정                                     |
| --------------------------------------------------------- | ---------------------------------------- |
| Space·Template·Membership 의미·Lifecycle·Content Metadata | Build: `dwp-space-server`                |
| Identity·Scoped Responsibility·Access Review              | Connect: DWP Auth / IAG                  |
| 생성·공식 게시·고위험 변경 승인                           | Connect: Approval Decision Hub           |
| App·Connector·Navigation Catalog                          | Connect: Platform Registry               |
| 외부 Document·Chat·Issue 원문                             | Connect: 원본 SoR, Reference만 저장      |
| Search·Vector·Agent Action                                | Connect: Governed Search / Agent Runtime |

## 현재 구현 기준선

- 구성원 Surface: Space 홈, 내 Space, 탐색, 생성·가입 요청, Space 상세·콘텐츠 작성
- 위임 운영 Surface: Space Owner 멤버·가입 요청·콘텐츠·App·AI 정책 관리
- Tenant Control Center: 운영 개요, Directory, 생성 요청, Template Studio,
  게시 검토, 수명주기 검토, 운영 정합성·소유자 복구
- Runtime: 독립 `dwp-space-server`(8006), `dwp_space` Database, Gateway
  `/api/spaces/**`, Auth/IAG 역할·권한·Space Scope 연동
- 기준정보: Platform `V126·V127·V129·V130`이 Space DB `CHECK` Column Binding과
  운영·복구 코드를 중앙 `sys_code_*` Registry에 등록하고 한·영 Label을 제공
- 검증: Backend Unit, OpenAPI Drift, 서비스 경계, Frontend Type·i18n·Architecture,
  역할별 직접 URL 403, Playwright Desktop·Tablet·320/390px, Dark·High Contrast 검토

이 상태는 Production Release가 아니다. 외부 Storage·KMS·DLP·Connector, 검색·Agent
권한 투영, 부하·침투·Pilot Gate를 통과한 뒤에만 `released`로 변경한다.

## G2 종료 전 필수 결정

- Pilot Space Type과 Tenant Policy Profile
- Content Editor 범위와 Object Storage·Malware·DLP Provider
- 외부 Guest Identity·Legal Terms·Data Residency
- Lifecycle 기본 기간과 Legal Hold·복구 기간
- Connector 1차 대상과 Source ACL Reconciliation 방식
- Figma License 준비 후 Desktop·Tablet·Mobile Prototype 승인
