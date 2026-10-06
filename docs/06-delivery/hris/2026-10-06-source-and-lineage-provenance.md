# 2026-10-06 HRIS Source 및 Lineage Provenance

> 상태: Baseline recorded; integration head not created
>
> 관찰 기준일: 2026-10-06
>
> 목적: 복구 입력, 현재 제품 기준선, 과거 검증 Pin과 SKKF 분석 입력을 혼동하지 않도록 고정

## 1. 상태 해석

- 현재 `dwp-dev`는 앞으로 통합할 Canonical Lineage다.
- Reconciled Branch는 복구된 기능을 가져올 immutable 입력이다. 현재 Lineage를 대체하지 않는다.
- 2026-10-06 W1 PASS는 명시된 과거 Frontend·Backend Pin에만 유효하다.
- 이 문서를 작성하는 시점에는 v35 통합 HEAD가 존재하지 않으며 따라서 **최종 통합 HEAD는
  미검증** 상태다.
- 과거 W1 HOLD는 당시 누락된 Runtime Bootstrap과 Trusted Feed에 대한 판정이었다. 아래에
  고정한 W1 실행에서는 그 항목이 PASS했으므로 해당 Pin에 한해 Superseded다. 고객 Release,
  Production 활성화 또는 미래 통합 HEAD의 PASS를 의미하지 않는다.

## 2. 제품 저장소 Pin

문서 편집을 시작하기 직전 세 `dwp-dev` Worktree는 각 원격 Branch와 동기화된 Clean 상태였다.

| 저장소 | Branch | Commit | 역할 |
| --- | --- | --- | --- |
| `dwp-frontend` | `dwp-dev` | `930b8469eabce8e1878b82c390fe5732b82ac620` | 현재 Frontend Canonical Base |
| `dwp-backend` | `dwp-dev` | `5612cc1a0b4a21a4d0b9107739579f23d165790f` | 현재 Backend Canonical Base, Authorization v34 |
| `dwp_agent` | `dwp-dev` | `1d46fc4ab49c604efb7464574c49d13ee453e059` | 현재 Agent Base; 별도 HRIS Recovery Branch 없음 |

## 3. Reconciled 복구 Pin

| 저장소 | Branch | Commit | 현재 Base와의 관계 |
| --- | --- | --- | --- |
| Frontend | `codex/hris-reconciled-frontend-20261001` | `7f39d12cd10b8827c67355a7f445973d05373cc9` | Merge Base `a1c73c7926fd42c6e58c002e3dce91dc54c37df2`, 현재 4 / Reconciled 37 Commit |
| Backend | `codex/hris-reconciled-backend-20261001` | `0731f6df2d55cdeb4784a09ae6e28d4ae4b0c294` | Merge Base `ff98818ff64c8c5aeacc21e0a95016cd841ffd42`, 현재 4 / Reconciled 46 Commit |

두 Reconciled Worktree는 관찰 시 원격 Branch와 동기화된 Clean 상태였다. 이 Branch에는 새
수정이나 History Rewrite를 하지 않는다.

## 4. W1 검증 Pin

| 항목 | 값 |
| --- | --- |
| Run ID | `w1-20261006t063231z-4ac97ea5` |
| Backend Source | `3c1a2940a1382e54503c86a4e5f5103ce1f33748` |
| Frontend Checkpoint Source | `970d1945d8fa43c19da697927ad17a01db0b8ac6` |
| Result | `BACKEND_RUNTIME_SUBGATE_PASS` |
| Checkpoint | 15/15 Assertion PASS |
| 최종 Bundle 상태 | v33 활성화 검증 후 v32 revision 3으로 Rollback 완료 |
| 고객 데이터 | 사용하지 않음 |
| Production 활성화 | 수행하지 않음 |

Sanitized 정본은 [W1 PASS Summary Manifest](w1-synthetic-pass-2026-10-06.sanitized.json)다.
Raw Evidence는
`workspace://.codex-worktrees/hris/reconciled-20261001/backend/output/hris-w1-synthetic-20261006t063231z-4ac97ea5/`
에 관찰되었으며 Git Ignore 대상이다. Raw Log를 Git에 복사하지 않고 승인된 Artifact Storage에
보존한 뒤 이 문서의 Hash와 연결한다.

W1 이후 Reconciled Tip에는 Backend `2f6eff9c`, `0731f6df`와 Frontend `4ec34baa`,
`c20f2c9b`, `7f39d12c`가 추가되었다. 현재 `dwp-dev` Tip도 위 W1 Pin과 다르다. 그러므로 해당
Commit을 포함하는 통합 결과는 기존 PASS로 판정하지 않는다.

## 5. SKKF 분석 입력 Pin

다음은 2026-10-06 현재 관찰한 Source 상태다. Dirty 상태는 분석 입력의 일부이며 사용자
소유 변경이므로 Reset, Clean 또는 임의 Commit하지 않는다.

| Logical Source | Workspace 상대 경로 | HEAD | 상태 | `stateSha256` |
| --- | --- | --- | --- | --- |
| Backend BENSK | `SKKF/eHR/ cloudhr-bensk2` | `b07a6862f84d0a1b4baa64169dec377dbb00413b` | unstaged 삭제 1건 | `aed56ac73cad2e02050240fa945ca3d73e2cd318c15b6a6b5f2a850f8d23eda5` |
| TIM | `SKKF/eHR/cloudhr-tim` | `242aeb608c5d6bc2e00ef246d7e557c3def959a8` | clean | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| PER | `SKKF/eHR/cloudhr-per` | `6f81384d766731204ac8b6ef9d55ebd91b22e5cb` | clean | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| Backend ADD | `SKKF/eHR/cloudhr-addsk2` | `27a65c3e35a7903dee959ddd54d058fa48a36669` | clean | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| HRM | `SKKF/eHR/cloudhr-hrm` | `c8654c2132294cf79d2974cb727b31dae0eacc88` | staged 추가 1건 | `bee25520110b21732256f8c90bd1c12bb781e78d8dfaccbe2a1351a7eccdce56` |
| SYS | `SKKF/eHR/cloudhr-sys` | `c96a8920dd261ee3494109c575ecc7cafea6cd8c` | clean | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| PAY | `SKKF/eHR/cloudhr-pay` | `50459981288bb9d545b4432d970876de878909b4` | clean | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| Frontend BENSK | `SKKF/eHR_Front/cloudhr-front-bensk2` | `b37f349cf393c54154ad1f4c05e9bc7402bdea37` | clean | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| Frontend ADD | `SKKF/eHR_Front/cloudhr-front-addsk2` | `fc7e9d4a17938873a9ac2d5e7eefada4b55729c5` | clean | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| Frontend Base | `SKKF/eHR_Front/cloudhr-front` | `e733eae1bc485be0f603f5b593c86321aaf844d2` | unstaged 삭제 2건·수정 1건 | `d388cd5168c21956b160c1f1cd0a34f6a70cb91c7dcc2aeeb4b078a35724eb67` |

Dirty 파일은 다음과 같다.

- Backend BENSK: `src/main/resources/storage/excel/aaa/BAT_GOAL_DOWNLOAD_TEMP.xlsx` 삭제
- HRM: `src/main/java/com/kolonbenit/benitworx/app/config/P6SpySqlConfig.java` staged 추가
- Frontend Base: `packages/hrm/src/appcom/assets/img/bg/fall-01-mo.png`,
  `packages/hrm/src/appcom/assets/img/bg/fall-01.png` 삭제와 `yarn.lock` 수정

### `stateSha256` 계산 계약

SHA-256 Stream에 다음 Raw Byte를 순서대로 Append한다. 출력 Text를 재인코딩하거나 줄바꿈을
정규화하지 않는다.

1. `git status --porcelain=v2 -z --untracked-files=all`의 Raw Byte
2. `git diff --binary --no-ext-diff`의 Raw Byte
3. `git diff --cached --binary --no-ext-diff`의 Raw Byte
4. `git ls-files --others --exclude-standard -z`의 nonempty Path Byte를 bytewise 정렬한 뒤,
   각 항목의 `pathBytes + NUL + fileContentBytes`를 Append한다. Directory는 Content 없이
   `pathBytes + NUL`만 Append한다.

따라서 Clean Repository의 값은 빈 Byte Stream의 SHA-256인
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`다. 이 값은 Commit
Content Hash가 아니라 HEAD 밖의 작업 상태를 결합한 Capture Digest다.

## 6. 복구 산출물 기준선

[Versioned recovery baseline](recovery/README.md)은 세션 복구 증거에서 다음 두 역사 묶음을
보존한다.

- HRIS porting blueprint: 역사 artifact 757개. 이벤트 체인 무충돌 722개, 최종 SHA 검증
  추가복원 4개, 부분복원 31개다. fileChange 이력은 있지만 미복원인 파일 10개와 경로
  참조만 확인된 항목 337개는 별도 표시했다.
- Scoped authoring control: 원본 20개 중 19개를 정확 복원했다. Materializer 원문 1개는
  불완전한 증거를 추정하지 않고 미복원으로 유지했다.

Scoped packet의 외부 binding은 49/50이 일치한다. HRM API/Event 계약 한 건은 완전 원문이
없어 critical recovery blocker로 남겼다. 이 수치와 과거 receipt는 현재 통합 HEAD 또는 모듈
개발 권한을 의미하지 않는다.

## 7. 재현과 변경 관리

1. 분석 또는 구현 Agent는 Source HEAD와 `stateSha256`를 모두 작업 패킷에 기록한다.
2. 어느 하나라도 달라지면 기존 분석을 조용히 덮어쓰지 않고 `historical analysis input`과
   `observed current`를 분리한다.
3. 통합 Branch 생성 직전 현재·Reconciled Pin과 Migration Fence를 다시 확인한다.
4. 통합 후 새 Provenance Revision을 추가하며 이 원장을 History Rewrite하지 않는다.
