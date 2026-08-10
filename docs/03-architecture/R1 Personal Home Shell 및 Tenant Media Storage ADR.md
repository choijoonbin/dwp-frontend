# R1 Personal Home Shell 및 Tenant Media Storage ADR

> 상태: Accepted
>
> 기준일: 2026-08-10
>
> 적용 저장소: `dwp-frontend`, `dwp-backend`

## 1. 배경

로그인 첫 화면은 개인에게 부여된 앱과 오늘의 업무를 조망하는 공간이며, 특정 업무 앱의
Navigation에 종속되면 안 된다. 동시에 Tenant별 Home 이미지를 지원하되 개발 단계의 로컬
파일 관리가 향후 Object Storage 전환을 막아서는 안 된다.

## 2. 결정

1. `/`는 Header만 가진 `PersonalHomeShell`로 렌더링하고 Sidebar를 만들지 않는다.
2. 앱 Route는 `BusinessAppShell`로 이동해 Sidebar와 업무 Navigation을 제공한다.
3. Business Shell의 Product Mark와 Account Menu `Home`은 `/`로 이동한다.
4. Home Presentation은 Tenant 단위 Aggregate로 문구, 이미지 위치, Overlay와 Asset
   Metadata를 관리한다.
5. 이미지 Binary는 DB가 아닌 `HomeAssetStorage` Port에 저장한다. 현재 구현은
   `${user.home}/.dwp/home-assets/{tenantId}`이며 운영에서는 S3 호환 Adapter로 교체한다.
6. 업로드는 PNG·JPEG Magic Byte, Image Decode, 크기, Pixel 수와 SHA-256을 검증한다.
7. Media GET은 로그인 Session을 필수로 하고 Gateway가 Session에서 Tenant를 결정한다.
   브라우저 이미지 요청에 임의 Tenant Header를 요구하지 않는다.
8. DB 변경과 파일 교체는 Transaction 완료 상태에 맞춰 이전 파일 또는 실패 파일을
   정리한다.

## 3. 선택 이유

- 개인 Home과 업무 Navigation의 목적을 분리해 첫 진입의 인지 부하를 줄인다.
- DB BLOB 비대화와 Backup 결합을 피하고 CDN·Object Storage 전환 경로를 확보한다.
- Tenant ID를 URL에 노출하지 않아 다른 Tenant의 Media Key 추측을 막는다.
- Version Query와 ETag를 함께 사용해 변경 즉시 Cache를 무효화할 수 있다.

## 4. 배제한 대안

- **Home에도 Sidebar 유지**: 개인 Portal과 특정 업무 앱의 Navigation 계층이 섞인다.
- **이미지를 DB BLOB로 저장**: 초기 구현은 단순하지만 운영 Backup, CDN, 대용량 전송이
  DB에 결합된다.
- **공개 정적 URL**: Tenant Branding Asset의 접근 통제와 교체 감사가 사라진다.
- **Tenant ID Query Parameter**: URL 변조와 Cache Key 오류 위험이 커진다.

## 5. 운영 전 후속 조건

- S3 Adapter, Bucket Policy, Server-side Encryption, Lifecycle과 Malware Scan
- Tenant별 용량·업로드 Rate Limit과 Content Security Policy
- 이미지 삭제 보존기간, 감사 Export와 CDN Cache Purge Runbook
- 다중 Instance 환경에서 Local Adapter 사용 금지
