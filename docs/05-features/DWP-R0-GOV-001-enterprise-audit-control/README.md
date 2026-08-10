# DWP-R0-GOV-001 Enterprise Audit Control

관리자 변경, 인증, 권한, 데이터 접근·반출, Provisioning, AI 실행과 정책 거부를
Tenant 경계 안에서 수집하고 조사 가능한 증적으로 전환하는 공통 제어 평면이다.

- 상태: `implemented` - Enterprise Investigation UX와 Local acceptance 통과,
  Production infrastructure gate 대기
- Owner: Security, Platform Architecture, SRE, Product Design
- 구현 저장소: `dwp-backend`, `dwp-frontend`, `dwp_agent`
- 연계 기능: `DWP-R0-OPS-001-api-observability`
- Non-goal: APM 대체, 원문 Payload 저장, 외부 SIEM·WORM 저장소 자체 구현

## 산출물

1. [기획 정의](./01-기획%20정의.md)
2. [화면 설계서](./02-화면%20설계서.md)
3. [디자인 정의](./03-디자인%20정의.md)
4. [데이터 설계](./04-데이터%20설계.md)
5. [API 권한 계약](./05-API%20권한%20계약.md)
6. [AI Agent 계약](./06-AI%20Agent%20계약.md)
7. [수용 테스트](./07-수용%20테스트.md)
8. [글로벌 벤치마크 및 UX 고도화](./08-글로벌%20벤치마크%20및%20UX%20고도화.md)

## 기준 자료

- [NIST SP 800-53 Rev.5 AU controls](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [Google Cloud Audit Logs overview](https://cloud.google.com/logging/docs/audit)
- [Microsoft Purview Audit](https://learn.microsoft.com/en-us/purview/audit-solutions-overview)
- [AWS CloudTrail log file integrity](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-log-file-validation-intro.html)
