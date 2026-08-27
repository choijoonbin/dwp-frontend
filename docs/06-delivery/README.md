# Delivery Evidence

Release별 Pilot Charter, 수용 Test 결과, 접근성·Security·License·SBOM 증거,
운영 Runbook과 KPI Review를 보관한다. 실행 Log나 민감정보 원문은 저장하지 않고
승인된 보관 System의 Link와 요약만 기록한다.

- `Production Dependency License 정책.md`: Dependency License Gate와 보고서 운영
- `DWP 최종 실행 백로그 및 출시 조건 2026-08-12.md`: Wave 1-3 이후 남은 내부 작업,
  외부 결정 D-01부터 D-18까지와 출시 증거의 최종 실행 순서
- `R0 C1 Productivity Connector 준비 체크리스트.md`: 첫 Tenant·권한·동기화 입력과 Exit Evidence
- `People Provisioning Provider 구현 및 Gate.md`: Workforce·SCIM·Access·Provider·Agent
  Local Baseline과 외부 Gate 판정
- `로컬 권한별 로그인 검증 계정.md`: 구성원·회사 관리자·프로바이더 관리자
  역할 격리 계정과 메뉴·접근 경계 검증 기준선
- `Provider-Tenant 접근 고도화 개발·전환 및 출시 Gate.md`: Provider/Tenant Principal 분리,
  승인 증거 기반 JIT 지원, 다중 Tenant Context, 안전 미리보기, Migration·Threat Test와 출시 증거
- `generated/production-dependency-licenses.json`: 현재 Production Graph의 생성 증거
- `R2 R3 출시 증거 실행 가이드.md`: 성능·접근성·복구·보안·운영 증거의 실행 계약
- `release-evidence/release-readiness.json`: R2·R3·D·A Gate의 기계 검증 가능한 현행 원장
- `release-evidence/provider-tenant-acceptance.json`: PT-A01~PT-A30의 상태, 자동 검사,
  fail-closed 근거와 immutable 외부 저장소 증거를 관리하는 실행·증적 SSOT
- `.github/workflows/release-readiness.yml`: 승인된 증거만 Production Release를 허용하는
  수동 실행 Gate

Frontend Delivery 문서와 위 JSON 원장이 Release 실행·증적 판정의 SSOT다. Backend의
`docs/delivery/customer-policy-and-release-gate-register.md`는 고객·운영 환경의 외부 정책 Gate를
관리하며 PT 구현 완료나 Release 승인 상태를 독립적으로 선언하지 않는다.
