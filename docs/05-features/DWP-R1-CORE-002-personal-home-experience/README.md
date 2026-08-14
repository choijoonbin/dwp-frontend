# DWP-R1-CORE-002 Personal Home Experience

> 상태: P0-P3 implemented, runtime-and-automated-verification-complete
>
> Release: R0.5 Reference, R1 Candidate
>
> Owner: DWP Product Experience, Platform Control Plane
>
> 적용 저장소: `dwp-frontend`, `dwp-backend`

Sidebar 없는 로그인 첫 Home, 권한 기반 App Launcher, 업무 Shell 전환, Tenant
Co-branding, 사용자 Home 편집과 관리형 공지를 정의한다. Tenant 관리자는 Branding·Home
Studio에서 채널·Viewport·Theme·Locale별 Preview와 품질 검사를 거쳐 게시하고 불변 Revision으로
Rollback할 수 있다. 개발 환경에서는 검증된 배경과 Logo를 Tenant별 Local Storage에 저장하고
DB에는 Metadata, 개인 Layout, Revision과 공지 참여 증적을 남긴다.

## 상위 계약

- `01-product/개인화 홈 및 앱 경험 기획.md`
- `03-architecture/R1 Personal Home Shell 및 Tenant Media Storage ADR.md`
- `04-design-system/DWP Premium Experience Direction.md`

## 산출물

- `01-기획 정의.md`
- `02-화면 설계서.md`
- `03-디자인 정의.md`
- `04-데이터 설계.md`
- `05-API 권한 계약.md`
- `06-AI Agent 계약.md`
- `07-수용 테스트.md`
- `08-홈 앱 거버넌스 및 공통 내비게이션 정책.md`
- `09-적응형 홈 런타임 및 기술 기준.md`
