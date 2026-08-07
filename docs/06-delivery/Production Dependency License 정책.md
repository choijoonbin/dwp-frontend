# Production Dependency License 정책

> 문서 상태: Active v1.0
>
> 기준일: 2026-08-08

## 1. 목적

제품 Source와 Runtime Dependency의 License 책임을 분리하고, 외부 Delivery 전에
Production Dependency의 License 누락·변경을 자동 탐지한다.

## 2. 운영 계약

- DWP 원본 Source는 제품 License 확정 전 `UNLICENSED`다.
- 직접·전이 Production Dependency는 `yarn.lock`과 설치된 Package Manifest를
  기준으로 검사한다.
- `corepack yarn license:report`가 승인 대상 보고서를 생성한다.
- `corepack yarn license:check`는 보고서가 현재 Dependency Graph와 다르거나
  허용 목록 밖 License가 있으면 실패한다.
- Dependency 추가·Upgrade Pull Request는 보고서 변경과 License 검토를 포함한다.
- Development Tool License는 Production Delivery 방식이 확정될 때 별도 SBOM으로
  관리한다.

현재 자동 허용 목록은 MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD,
BlueOak-1.0.0, CC0-1.0, Unicode-3.0이다. 복합 SPDX 식은 포함된 모든 License가
허용 목록에 있어야 통과한다.

## 3. Release Gate

1. `license:check` 통과
2. Production Container 또는 배포 Artifact 기준 SBOM 생성
3. 제품 License와 고객 Delivery 계약 확인
4. 필요한 Copyright·Attribution Notice 검토
5. Source 제공 의무, Network Copyleft, 사용 제한 License가 없는지 법무 승인
6. Git History를 포함해 전달할지 Clean Repository를 전달할지 Release Owner 승인

자동 보고서는 법률 의견을 대신하지 않는다. Package Manifest의 License 표기가
부정확하거나 Asset·Model·Dataset License가 별도일 수 있으므로 최종 Delivery에는
법무와 Security Supply Chain 검토가 필요하다.

## 4. 산출물

- 정책: 이 문서
- 검사 Script: `scripts/check-production-licenses.mjs`
- 생성 보고서: `generated/production-dependency-licenses.json`
- 향후 SBOM: 배포 Pipeline에서 CycloneDX 또는 SPDX 형식으로 생성
