# Recovery metadata — HRIS blueprint

이 문서는 복구된 역사 산출물 자체가 아니라 **recovery metadata**다. 원본과 혼동하지 않는다.

- 복구한 역사 파일: 757개
- 수집된 이벤트 체인 무충돌: 722개
- 부분 복구: 31개
- 번호행+최종 SHA로 추가 복구: 4개
- 경로 참조만 있고 바이트 미복원: 337개
- 이벤트상 삭제: 6개
- 스테이징 대비 경로·크기·SHA-256 일치: true

복구에는 `fileChange`와 캡처된 완전 파일 readback만 사용했다. 과거 생성 명령 실행, SKKF 재해석, 누락 내용의 임의 생성은 하지 않았다.

Scoped authoring validator 전체 결과는 `FAIL`다. contractBindings는 49/50 PASS이며 현재 실패는 다음과 같다:

- `output/hris-porting-blueprint-2026-09-09/session-evidence/hrm/g2-readiness/api-event-contracts.v1.json` — expected `5390eac887c06d33e744252ddf013183f2f1e55198f8a28d341197b6a6336e65`, actual `0c3ec58b29dcf534d1b887fed5678e878e4a514cf3f943165e47dd7a486355bb`

동일 디렉터리의 `RECOVERY_MANIFEST.json`은 복구된 757개 역사 파일의 상대경로·크기·SHA-256과 상태 요약을 담는다. 상세 inventory와 실패 이력은 `/Users/a10697/Work/DWP/session-recovery/codex-session-recovery-20261001-105256-KST/reports/hris-porting-blueprint-2026-09-09`에 있다.
