# Frontend IA current-source successor

판정: **IA current-source binding PASS / 기존 76건 digest drift 해소 / START-P0·Gate CLOSED**

현재 frontend `4e1333c66dfd9563ecbf321cfcda3b3f6b7f9778`(tree `27390487173ba41640e01f69704740f38f0da8e0`)의 HRIS 카탈로그 의미가 기존 IA 정본과 동일함을 먼저 확인한 뒤 기존 generator로 중앙 IA 산출물을 재생성했다. frontend 소스, Approval, production reachability allowlist, activation/Gate 파일은 수정하지 않았다.

## Before 원인

재생성 전 `validate_information_architecture.py --compact`는 98개 IA node 중 BASE 76/76에서 실패했다. 정확한 차이는 모든 행에서 `source_digest_sha256` 하나뿐이었다.

- current register와 generator 기대값: node 98개, 순서·node set 동일
- changed rows: BASE 76, MODERN 0
- 변경 필드: `source_digest_sha256` 76개
- route, owner, persona, lifecycle, TFR/API/query/action/auth, deep link, implementation/production state, source ref의 차이: 0
- before register SHA-256: `ab506a2bb2f80c8ab81a4b9d575374d6bda83b312d11dce07495d4812bdf4686`

원인은 IA register의 `source_ref`는 이미 현재 8개 layered fragment를 가리키지만, digest가 최종 committed fragment 바이트보다 이전 값으로 남아 있던 것이다.

## 의미 보존 검증

레이어 분리 직전 revision `aaeba79eefae7cc2d1ba6151f47fa9e891a75bfd`의 단일 `hris-product-map-catalog.ts`와 현재 8개 fragment를 기존 generator의 AST-safe parser로 비교했다.

- 이전/현재 node: 76/76
- 전체 순서: 동일
- `id`, `inventoryGroup`, `surface`, `module`, `personas`, `lifecycle`, `href`: **76/76 동일**
- 다른 index: 0

fragment별 node 수는 `8 + 7 + 10 + 10 + 14 + 8 + 13 + 6 = 76`이다. 따라서 route나 업무 의미를 재정의한 것이 아니라, 손실 없는 파일 분리 뒤 현재 실제 바이트를 다시 pin하는 변경으로 판정했다. 각 fragment의 before/current digest는 동반 JSON에 전부 기록했다.

## 결정적 재생성

다음 기존 generator만 사용했다.

```bash
python3 coding-readiness/generate_information_architecture_register.py
python3 coding-readiness/generate_ia_entry_query_projection_schemas.py
```

첫 generator는 IA 98행, shell 9행, task group 46행을 생성했다. 두 번째 generator는 projection 66, API 66, runtime 66, action 202를 원자적으로 재생성했다.

재생성 전 dry render와 실제 결과가 일치했고, 첫 generator를 다시 실행한 뒤 7개 산출물의 SHA-256가 모두 동일했다. schema generator의 `--check`도 PASS했다.

콘텐츠가 바뀐 중앙 파일은 하나뿐이다.

- `coding-readiness/hris-information-architecture-register.csv`: `ab506a2b...` → `518ca39ab3eb7b5e1d621ec5c67d2c0134eaba322ac74f8711d9e7fe010302dc`

다음 6개는 generator가 재생성했지만 byte-for-byte 동일했다.

- `hris-shell-navigation-register.csv`: `f85ee40a...`
- `hris-workbench-task-group-register.csv`: `f0b1ebb3...`
- `ia-entry-query-projection-schemas.v1.json`: `b185accd...`
- `ia-entry-query-api-contract-register.csv`: `cb8d5b5f...`
- `ia-entry-query-runtime-invariant-register.csv`: `3b9bd24b...`
- `ia-entry-query-action-key-register.csv`: `19a12600...`

## 검증 결과

- IA 본검사: PASS — node 98(BASE 76 + modern 22), unique route 98, source family 80, API refs 372, authorization 119, shell 9, sidebar 7, task group 46, grouped node 97, blocker 0
- IA 고의 변조: **30/30 차단**
- generator 비의존 access/schema 검사: PASS — projection/API/runtime 66/66/66, typed field group 138, action 202, persona 5, package 31, duty 128
- access/schema 고의 변조: **54/54 차단**
- IA consumer인 API-SoR: PASS — transition 23, read variant 14, mutation 9, source operation 23
- API-SoR 고의 변조: **18/18 차단**
- frontend HEAD/tree/status: 검사 전후 clean·불변

이 successor는 앞선 `frontend-current-integration-final-readiness-2026-09-14`의 `FE-BLK-005`만 해소한다. Approval 기준선 2건, Approval/shared HTTP 호환 1건, Approval unreachable 13개, backend final provenance pending은 그대로 남아 있다. 과거 G2 snapshot manifest나 Gate를 다시 쓰지 않았으며, 전체 integration READY 또는 START-P0 개방을 주장하지 않는다.
