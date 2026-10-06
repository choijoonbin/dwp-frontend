# HRIS scoped authoring control 복구 인벤토리

> 이 문서는 2026-10-06 복구 감사 기록이다. 원래 패키지의 Gate 또는 개발 권한을
> 변경하지 않으며, `state/current-readiness.v1.json`의 2026-09-16 역사적 상태를
> 현재 권한으로 재발행하지 않는다.

## 복구 결과

- 당시 최종 파일 집합으로 확인된 원본 산출물: 20개
- 원문 또는 봉인 digest까지 일치하게 복원한 원본 산출물: 19개
- 원문 전체가 없어 의도적으로 생성하지 않은 원본 산출물: 1개
- 이 인벤토리: 복구 감사용 신규 파일이며 원래 패키지 구성원이 아니다.

## 정확 복원

다음 파일은 복구 events의 실제 명령 출력에서 복원했다.

- `README.md`
- `contracts/scoped-g3-authoring-packet.schema.json`
- `contracts/scoped-g3-preflight-receipt.schema.json`
- `manifests/control-manifest.v1.json`
- `packets/hrm.v1.json`
- `packets/per.v1.json`
- `packets/pay.v1.json`
- `packets/tim.v1.json`
- `packets/sys.v1.json`
- `receipts/environment-preflight.v1.json`
- `receipts/hrm-preflight.v1.json`
- `receipts/per-preflight.v1.json`
- `receipts/pay-preflight.v1.json`
- `receipts/tim-preflight.v1.json`
- `receipts/sys-preflight.v1.json`
- `registers/scoped-authoring-worktree-register.csv`
- `registers/scoped-authoring-state-transition-register.csv`
- `state/current-readiness.v1.json`
- `validators/validate_scoped_authoring_control.py`

주요 복구 근거:

- 5개 packet 원문: thread `01a0ad56-dec1-7691-a760-9e65c7f58867`,
  rollout ordinal 102~106
- receipt와 readiness 원문: thread
  `01a0ec58-97ef-7093-8c4c-7069ff2ab66d`, rollout ordinal 74
- validator 원문: thread `01a0a966-9092-7382-920b-1aa5a6b349f7`,
  rollout ordinal 253
- manifest/register/schema 원문과 digest: 같은 packet-schema audit thread의
  ordinal 226, 228, 230, 237, 299
- 최종 README 원문: thread `01a0a93f-d9b5-76b3-8a24-c70730fadcc8`,
  rollout ordinal 271

## 전체 원문이 없어 미복원

- `materialize_scoped_authoring_control.py`
  - events에는 76~270행, 400~490행 및 선택된 함수/쓰기 지점만 남아 있다.
  - 근거: thread `01a0acdc-5155-7a90-ba96-abb00c360add` ordinal 111,
    thread `01a0a966-9092-7382-920b-1aa5a6b349f7` ordinal 345.
  - 누락 구간을 추정하여 작성하면 원본 복원이 아니므로 파일을 만들지 않았다.
  - packet 검증·소비에는 필요하지 않지만 패키지 재생성 재현성에는 남은 복구
    과제다.

## 외부 참조 상태

packet 5개에는 `contractBindings` 50건, 중복 제거 기준 22개 파일이 고정되어
있다. 모두 `output/hris-porting-blueprint-2026-09-09/**` 아래의 canonical,
fixture, allocation, command catalog 및 모듈 계약이다.

2026-10-06 blueprint 복원 후 22개 고유 경로(5개 packet의 binding 50건)를
`sha256`과 `byteLength`로 재검증했다. 고유 경로 21/22, binding 49/50이
일치한다. 유일한 불일치는 다음 역사 artifact다.

- `session-evidence/hrm/g2-readiness/api-event-contracts.v1.json`
  - 기대: 35,196 bytes,
    `5390eac887c06d33e744252ddf013183f2f1e55198f8a28d341197b6a6336e65`
  - 복구본: 25,944 bytes,
    `0c3ec58b29dcf534d1b887fed5678e878e4a514cf3f943165e47dd7a486355bb`
  - 완전 원문 증거가 없어 임의 보완하지 않았다.

역사적 `registers/scoped-authoring-worktree-register.csv`에는 10개 authoring
worktree가 기록되어 있으나 현재 해당 경로는 모두 존재하지 않는다. 따라서
과거 preflight receipt는 정확히 복원됐지만 현재 환경에 대한 preflight PASS를
뜻하지 않는다.

## 좁은 검증 결과

- JSON 15개 구문 검사: PASS
- packet 5개 파일 SHA-256과 manifest index: PASS
- packet 5개 canonical payload seal: PASS
- module preflight receipt 5개 packet 참조 SHA-256: PASS
- module preflight receipt 5개 canonical payload seal: PASS
- environment preflight receipt seal: PASS
- manifest payload seal과 schema/register digest: PASS
- readiness state payload seal, manifest 참조, receipt 5개 참조: PASS
- validator Python 구문 및 CLI 로딩: PASS
- 외부 canonical/fixture binding: 부분 통과 — 고유 경로 21/22, binding 49/50
  일치; HRM API/Event 계약 1개는 critical recovery blocker
- live worktree preflight: 보류 — 역사적 worktree 10개 경로 복원 또는 후속
  current-state packet 재발행 필요

## 사용 경계

이 복구 패키지는 역사적 증거다. `ALL_MODULES_READY_TO_START_HOLD`,
`PREFLIGHT_PASS_READY_TO_START_HOLD` 또는 receipt의 PASS를 현재 개발 시작
권한으로 해석하면 안 된다. 외부 blueprint와 현재 Git/worktree 상태를 다시
대조한 후, 후속 통제 패킷이 현재 상태를 명시적으로 판정해야 한다.
