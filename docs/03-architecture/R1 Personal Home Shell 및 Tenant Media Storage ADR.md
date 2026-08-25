# R1 Personal Home Shell 및 Tenant Media Storage ADR

> **부분 대체 안내 (2026-08-21):**
> `R1 Flow Home 및 Bounded Personalization ADR.md`가 `workspace-home`에서 대형 Tenant 이미지
> Hero와 Glass 중심 표현을 보조 Accent와 업무 의미 중심 표현으로 변경한다. Sidebar 없는
> Shell, Tenant Media Storage, 보안·Revision·Rollback 계약은 그대로 유지한다.

> 상태: Accepted
>
> 기준일: 2026-08-12
>
> 적용 저장소: `dwp-frontend`, `dwp-backend`

## 1. 배경

로그인 첫 화면은 개인에게 부여된 앱과 오늘의 업무를 조망하는 공간이며, 특정 업무 앱의
Navigation에 종속되면 안 된다. 동시에 Tenant별 Home 이미지를 지원하되 개발 단계의 로컬
파일 관리가 향후 Object Storage 전환을 막아서는 안 된다. 고객 브랜드, 사용자별 Home
구성과 전사 공지는 서로 다른 소유권과 변경 권한을 갖기 때문에 하나의 자유 형식 설정
Payload로 합치지 않아야 한다.

## 2. 결정

1. `/`는 Header만 가진 `PersonalHomeShell`로 렌더링하고 Sidebar를 만들지 않는다.
2. 앱 Route는 `BusinessAppShell`로 이동해 Sidebar와 업무 Navigation을 제공한다.
3. Business Shell의 Product Mark와 Account Menu `Home`은 `/`로 이동한다.
4. Home Presentation은 Tenant 단위 Aggregate로 Locale별 문구, 기본 Locale, 이미지 위치,
   Overlay와 Asset Metadata를 관리한다. Branding Aggregate는 조직명, Accent와 Logo를
   별도로 소유한다.
5. 배경과 회사 Logo Binary는 DB가 아닌 공통 `TenantMediaStorage` Port에 저장한다. 현재
   구현은 `${user.home}/.dwp/platform-assets/{tenantId}`이며 운영에서는 S3 호환 Adapter로
   교체한다.
6. 배경은 PNG·JPEG, Logo는 PNG·JPEG·안전한 SVG를 허용한다. Magic Byte, Decode,
   크기, Pixel 수, SVG Active Content와 SHA-256을 검증한다.
7. Media GET은 로그인 Session을 필수로 하고 Gateway가 Session에서 Tenant를 결정한다.
   브라우저 이미지 요청에 임의 Tenant Header를 요구하지 않는다.
8. 업로드 Transaction이 실패하면 새 임시·신규 파일을 정리한다. 게시된 Asset은 불변
   `adm_experience_revisions` Snapshot이 참조할 수 있으므로 교체 즉시 삭제하지 않고 보존한다.
   보존기간이 끝난 미참조 Asset만 `D-14` Lifecycle 정책과 감사 가능한 작업으로 정리한다.
9. Header Branding은 `Tenant logo | DWP Product` 공동 Lockup이다. 고객 Logo가 DWP Mark를
   대체하거나 Product Navigation을 점유하지 않는다.
10. 개인 Home 설정은 `(tenant_id, user_id)` 단위 Versioned JSONB로 저장한다. 서버는 구조와
    등록 Widget·필수 정책을 검증하고 Frontend는 현재 App Registry·Entitlement로 재조정한다.
    API는 저장 행 존재 여부를 `customized`로 명시하며 낙관적 잠금 Version과 혼용하지 않는다.
11. Branding과 Home의 모든 게시·Asset 교체·Reset·Rollback은 현재 Snapshot을 불변 Revision으로
    남긴다. Rollback은 새 변경으로 기록하며 과거 Revision을 수정하지 않는다.
12. 공지는 별도 Lifecycle Aggregate로 관리하고 Tenant, 역할, 게시 상태·기간을 서버에서
    필터링한다. 게시·보관은 Tenant Admin만 수행하며 사용자별 View·Action 집계는
    `sys_announcement_engagements`에 최소 증적으로 저장한다.
13. Liquid Glass 재질은 이미지 위의 Navigation·App Surface에만 선택적으로 적용한다.
    Reduced Transparency와 Forced Colors에서는 불투명 대체 Surface를 사용한다.

## 3. 선택 이유

- 개인 Home과 업무 Navigation의 목적을 분리해 첫 진입의 인지 부하를 줄인다.
- DB BLOB 비대화와 Backup 결합을 피하고 CDN·Object Storage 전환 경로를 확보한다.
- Tenant ID를 URL에 노출하지 않아 다른 Tenant의 Media Key 추측을 막는다.
- Version Query와 ETag를 함께 사용해 변경 즉시 Cache를 무효화할 수 있다.
- 관리자 기본 구성과 사용자 선호를 분리해 필수 공지는 유지하면서 개인화를 허용한다.
- Branding, Home Preference와 Announcement를 분리해 각 Aggregate의 권한·감사·수명주기를
  독립적으로 운영한다.
- Immutable Revision과 Rollback-as-new-change 원칙으로 현재 상태 복원과 감사 재현을 함께
  만족한다.

## 4. 배제한 대안

- **Home에도 Sidebar 유지**: 개인 Portal과 특정 업무 앱의 Navigation 계층이 섞인다.
- **이미지를 DB BLOB로 저장**: 초기 구현은 단순하지만 운영 Backup, CDN, 대용량 전송이
  DB에 결합된다.
- **공개 정적 URL**: Tenant Branding Asset의 접근 통제와 교체 감사가 사라진다.
- **Tenant ID Query Parameter**: URL 변조와 Cache Key 오류 위험이 커진다.
- **고객 Logo로 Product Mark 교체**: 제품 Identity와 Home Navigation이 고객마다 달라진다.
- **임의 Widget HTML 저장**: XSS, 성능, 접근성, 업그레이드 계약을 통제할 수 없다.
- **Liquid Glass 전면 적용**: 긴 Form·Table의 대비와 성능을 떨어뜨리고 계층 의미를 잃는다.

## 5. 운영 전 후속 조건

- S3 Adapter, Bucket Policy, Server-side Encryption, Lifecycle과 Malware Scan
- Tenant별 용량·업로드 Rate Limit과 Content Security Policy
- 이미지 Revision 보존기간, 미참조 Asset 수집, 감사 Export와 CDN Cache Purge Runbook (`D-14`)
- 다중 Instance 환경에서 Local Adapter 사용 금지
- 공지 승인 Workflow, 긴급공지 다중 채널, 읽음·확인 증적과 지역별 보존정책 (`D-15`)
- Home Layout Schema Migration, Widget Registry와 관리자 기본 Layout·Audience Targeting
