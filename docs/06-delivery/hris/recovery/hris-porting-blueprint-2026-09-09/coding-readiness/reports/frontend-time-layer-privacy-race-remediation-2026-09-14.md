# TIM frontend 계층화·개인정보·경합 보강 결과

## 결론

- `apps/dwp/src/features/hris/time/**`를 `api / model / hooks / components / pages / testing / index.ts` 공개 경계로 재구성했다.
- 화면 계층에서 React Query와 HR transport DTO 직접 의존을 제거했다. 원시 `HrTimeWorkspace`는 캐시에 들어가지 않으며 API 응답은 `selectTimeWorkspaceDisplay`의 엄격한 표시 projection을 통과한 뒤에만 `workspace-v2` 캐시에 들어간다.
- 범위 방문 generation과 request/mutation settlement generation, 정확 query-key 취소, mounted guard를 함께 적용했다. 동일 키로 돌아오는 A→B→A와 mutation 뒤 늦은 GET 역행을 모두 차단한다.
- 기존 27개 기대는 변경 없이 모두 유지됐다. 신규 개인정보·상태·경합 반례 6개는 실제 구현 전 정확히 6 FAIL이었고 구현 후 전부 PASS로 전환됐다. 추가 strict projection 10개를 포함한 최종 actual은 43/43 PASS다.
- TIM scoped ESLint PASS, TIM source 11/11 layer classified, TIM layer error 0이다. 같은 시점 whole HRIS layer scan은 error 0 / structural PASS이나, readiness와 G3 시작 승인은 명시적으로 false다.
- 이 결과는 현재 integration snapshot에 대한 TIM frontend 증거다. 최신 `dwp-dev` 495b6192 통합 후 Root가 충돌 검토와 HRM/PER/TIM/PAY scoped 재실행, whole TypeScript/quality 재실행을 끝내기 전에는 전체 코딩 Gate READY 또는 G3 OPEN으로 해석하면 안 된다.

## 보존한 계약

- GET의 `AbortSignal`과 `contextScopeKey`
- generated ACTION route를 통한 command authority
- save `cardVersion`과 submit `version`의 CAS 의미
- 401/403 명시적 차단, 409 draft 보존·refresh·명시적 rebase
- network/timeout의 unknown-outcome 처리
- reference-origin 및 schedule evidence 기반 read-only 정책
- mutation 응답을 포함한 모든 캐시 입력의 strict projection
- scope 전환·언마운트 후 late settlement 무효화

## 실제 반례 경계

구현 전 actual: 33 total / 27 PASS / 6 FAIL / 0 pending.

1. 인접 비공개 필드가 원시 workspace와 함께 캐시에 남는 문제
2. 비정상 origin 상태를 fail-closed 하지 못하는 문제
3. A→B→A 복귀 뒤 첫 A의 늦은 save가 새 A 캐시를 덮는 문제
4. save 뒤 오래된 GET이 v4를 v3로 역행시키는 문제
5. transport 성공이지만 상태 projection이 잘못된 응답이 draft/cache를 훼손하는 문제
6. feature unmount 뒤 늦은 save가 cache/feedback을 다시 생성하는 문제

구현 후 actual: 43 total / 43 PASS / 0 FAIL / 0 pending, source pre/post stable, ACK 10/10, delivery exit 0.

## 현재 TIM source 고정값

| 파일 | SHA-256 | mtime ns |
|---|---|---:|
| `api/hris-time-api.test.ts` | `9bc725bb555524dc7e8c883011bb4542706e932512a365cb582e2ce3cf6315c2` | `1789388249439680733` |
| `api/hris-time-api.ts` | `64c00520bf7db7d2c143e5d5d0f2c633ed8c7a82389c112334206e46abefb284` | `1789388249439282291` |
| `components/hris-time-calendar.tsx` | `2bb150c9e754d48ae2ec79b05cfba8186e0b666a75e83b25c2882115cf2f03c5` | `1789388403951864020` |
| `components/hris-time-command-notice.tsx` | `35d1f15e6dcf4abb1b41f86d3dc65a3ff975fe06a1dade63ba173b847fb82fc4` | `1789388403952228255` |
| `components/hris-time-sections.tsx` | `89a5ff9818af9499fd22b3ebbc4967c7ae3c576a511f202e34fc8c9b156131cb` | `1789388450444585118` |
| `hooks/use-hris-time-workspace.ts` | `d701558abcc84a01d20c2e17bf3253c4f37ec7dabf383978d2af0d34f08f7b0e` | `1789388800000741227` |
| `index.ts` | `534c0bd8b1c83195c8ab81867747abed1759d8fd5def84aa48be1cf8392da9a0` | `1789389401674303346` |
| `model/hris-time-model.ts` | `59cf39c2a9477461bed21a727eee87d55e031c3e6cff7510ffdd980fb6ecc892` | `1789388799999152833` |
| `pages/hris-time-workspace.tsx` | `a17cc03f09774e9531162b574943bf459373567375ec4aa708688ffb61f655b4` | `1789388808883082390` |
| `testing/hris-time-model.test.ts` | `e4b7368ff3a47c501f137cf56fe3f10aebe9737e5d4abc87fe018adc7bbb5000` | `1789388672159913656` |
| `testing/hris-time-workspace.runtime.test.tsx` | `4868e4b92f7b40091e1496cdac7d518cbaa6eb6a1ed5115d6a7a542b68e8b700` | `1789389409631351628` |

독립 readback은 이 11개 파일의 전체 UTF-8 본문, SHA-256, mtime ns가 최종 actual의 source snapshot 및 quality pre/post manifest와 일치함을 확인했다.

## 증거

| 증거 | 파일 SHA-256 | 핵심 receipt/archive |
|---|---|---|
| 기존 flat baseline | `e9f697df8536e6b02933d4d319b8218be0e91018ca1b6447c203673bfbec040a` | 27/27 PASS, receipt `42fd0158…`, archive `8c95feb8…` |
| actual fail-before | `c0134df5d6016eb3c13457a30c900bca5b7affac00c88d43ae5e785047534c11` | 27 PASS / 정확 6 FAIL, receipt `4fa69fc5…`, archive `a9b2b7b8…` |
| final actual ACK envelope | `f23a6a91e2b2b1e3f4f005bae7e848c84ff56b528bc8f6b518088fa2870e7294` | 43/43 PASS, receipt `cb99a4c0…`, archive `2bb5a9a4…`, ACK 10/10 |
| final scoped quality ACK envelope | `14fc6c8c7e49a41a8ee6fe255db58cbdb1813d37a9f521083344836d42808875` | lint PASS, layer 11/11, receipt `a391ae0e…`, archive `92d02144…`, ACK 3/3 |
| independent readback | `d6d9d78161f32cd89cf18914cd2429d1bffd3ccf0f3e8b083509e41937eda381` | PASS |

## 변경·비변경 경계

- 변경: `apps/dwp/src/features/hris/time/**`만 TIM writer 범위에서 수정했다.
- 소비: Control-owned shared는 `../../shared` 공개 배럴만 사용한다.
- 비변경: TIM 작업자는 `shared/**`, `shell/**`, backend, migration-control, native source를 수정하지 않았다.
- 실행하지 않음: Docker, backend/native test, browser run, commit, G3/Gate 개방.
- 전체 TypeScript 검증은 최신 upstream 통합 뒤 Root가 수행할 교차 검증 조건으로 남겼다. TIM 하위 작업이 독자적으로 이를 PASS라고 주장하지 않는다.
