# Unit Test 및 CI 실행 가이드

## 현재 테스트 구조

- **Vitest**: libs 단위 테스트
- **Nx target**: `libs/shared-utils`만 `test` target 보유 (`project.json` → `nx:run-commands`로 vitest 실행)
- **Root vite.config.ts**: `root: apps/dwp` 이므로 **apps/dwp 아래만** 테스트 대상. libs 테스트는 **libs 전용 config**로 실행.

## 실행 명령 3종

| 목적 | 명령 | 비고 |
|------|------|------|
| **1) 로컬 libs 단독** | `yarn test:shared-utils` 또는 `nx test shared-utils` | shared-utils만 실행 |
| **2) 로컬 전체(유닛)** | `yarn test` | `nx run-many -t test --all` — test target 있는 프로젝트만 (현재 shared-utils만 해당) |
| **3) CI 권장** | `yarn lint && yarn tsc:check && yarn test && yarn build` | lint → typecheck → unit test → build. tsc:check는 아래 참고. |

### tsc:check

root `tsconfig.json` 기준 타입체크 시:

```bash
npx tsc --noEmit
```

`package.json`에 `tsc:check` 스크립트가 있으면 해당 스크립트 사용.

## CI 워크플로 예시 (PR#1 연동)

```yaml
# .github/workflows/ci.yml 예시
- run: yarn install --frozen-lockfile
- run: yarn lint
- run: yarn tsc:check   # 또는 npx tsc --noEmit
- run: yarn test        # nx run-many -t test --all → libs 포함
- run: yarn build
# test:e2e는 별도 job 또는 cron 권장
```

## libs/shared-utils 테스트 현황

- **실행 경로**: `nx test shared-utils` → `libs/shared-utils` 디렉터리에서 `npx vitest run --config vitest.config.ts` 실행.
- **설정**: `libs/shared-utils/vitest.config.ts` (root: libs/shared-utils, include: src/**/*.{test,spec}.{ts,tsx}, environment: node).
- **참고**: `axios-instance.test.ts`, `token-storage.test.ts`는 `window`/`localStorage` 사용으로 **node** 환경에서 실패. 필요 시 `jsdom` 설치 후 `environment: 'jsdom'`으로 변경하거나, 해당 테스트에서만 환경 오버라이드.
