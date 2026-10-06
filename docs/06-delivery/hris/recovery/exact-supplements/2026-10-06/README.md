# HRIS exact recovery supplements — 2026-10-06

이 디렉터리는 raw recovery mirror를 수정하지 않고, 역사 pin 또는 동일 pin-era 결정론적 생성기로
정확성을 입증할 수 있는 critical artifact만 보완한다. Raw mirror는 당시 복구 증거이며 계속
immutable이다. 동일 상대 경로의 **SYS exact business-start pin 시점**을 검증할 때 이
supplement가 raw partial/missing 파일보다 우선한다. 이 pin 뒤에 승인된 successor 정본을
대체하지 않는다.

## 복구 분류

| 상대 경로 | 분류 | 검증 근거 |
| --- | --- | --- |
| `hris-atomic-duty-matrix.csv` | `PIN_EXACT_CHECKPOINT` | SYS exact pin의 59,593 bytes/SHA와 일치, 128개 duty 및 permission package 참조 집합 일치 |
| `coding-readiness/target-family-resolution-register.csv` | `PIN_EXACT_CHECKPOINT` | SYS exact pin의 38,399 bytes/SHA와 일치, 86개 resolution ID |
| `coding-readiness/ia-entry-query-api-contract-register.csv` | `PIN_EXACT_CHECKPOINT` | SYS exact 시작 pin의 99,982 bytes/SHA와 일치, 66개 query |
| `coding-readiness/ia-entry-query-projection-schemas.v1.json` | `PIN_EXACT_CHECKPOINT` | SYS exact 시작 pin의 1,523,618 bytes/SHA와 일치, 66개 projection의 유효 JSON |
| `coding-readiness/ia-entry-query-runtime-invariant-register.csv` | `PIN_ERA_DETERMINISTIC_COMPANION` | 위 projection/API와 같은 pin-era generator 실행에서 함께 생성, 66개 query 집합 일치 |
| `coding-readiness/ia-entry-query-action-key-register.csv` | `PIN_ERA_DETERMINISTIC_COMPANION` | 같은 원자 생성 실행의 202개 고유 action key; API 참조가 모두 포함됨 |

`PIN_ERA_DETERMINISTIC_COMPANION`은 원본 SHA pin이 존재한다는 뜻이 아니다. Pin 이후 listening
allocation 2건을 역적용한 완전 입력과 당시 generator로 원자 재생성했고, pin이 있는 API/schema
출력이 정확히 일치했기 때문에 같은 실행에서 나온 동반 산출물로 사용한다.

## Pin 이후 accepted successor

`accepted-successors/`는 역사 시작 pin 뒤에 승인된 현재 successor를 별도로 보존한다.

- IA API register는 66-row를 유지하고 `IAQ-033`, `IAQ-065`의 Listening test allocation만
  전용 stream으로 변경된 100,020-byte exact successor다.
- IA runtime invariant register는 같은 generator의 결정론적 companion이다. Projection schema와
  action key register는 시작 pin과 byte-identical이다.
- SYS Listening stream authority v1은 46,420-byte exact successor다.

현재 통합에서는 accepted successor가 시작 checkpoint보다 우선한다. 단, 이것도 현재 제품 코드의
구현 완료나 Production 권한을 뜻하지 않는다.

검증은 다음 두 표적 명령으로 수행한다.

```bash
python3 docs/06-delivery/hris/tools/validate_recovery_resolution.py
python3 docs/06-delivery/hris/tools/replay_ia_pin_checkpoint.py
python3 docs/06-delivery/hris/tools/replay_ia_accepted_successor.py
```

이 보완은 현재 코드가 구현됐거나 모듈 개발이 승인됐다는 의미가 아니다. 현재 구현 상태는
`current-slice-integration-status.v1.csv`, 개발 권한은 G1~G7 receipt가 결정한다.
복원하지 못한 ownership/modern final bytes는 G2~G3에서 현재/Reconciled canonical source로
새 successor를 발행해야 한다. 여기서 복원한 IA accepted successor를 그 미복원 범위와 섞지 않는다.
