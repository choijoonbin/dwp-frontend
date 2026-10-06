# HRIS 역사 산출물 복구 기준선

> 상태: `RECOVERED_WITH_KNOWN_GAPS`
>
> 복구·고정일: 2026-10-06
>
> 용도: SKKF 기반 업무 정의와 과거 통제 증거의 손실 방지 및 후속 통합 입력

이 디렉터리는 세션 복구 bundle의 `fileChange`와 캡처된 완전 readback에서 복원한 역사
산출물을 Git으로 보존한다. 누락 내용을 SKKF에서 다시 추론하거나 과거 생성기를 실행해
채우지 않았다. 따라서 복구된 packet의 과거 PASS/HOLD 상태는 현재 개발 시작 권한이 아니다.
G0 완료 판정과 다음 Gate는 [G0 recovery receipt](../g0-recovery-baseline-2026-10-06.json)에
기계 판독 가능한 형태로 고정한다.

## 보존 묶음

| 묶음 | 결과 | 사용 경계 |
| --- | --- | --- |
| [HRIS porting blueprint](hris-porting-blueprint-2026-09-09/RECOVERY_INVENTORY.md) | 역사 artifact 757개, metadata 2개. 무충돌 722개, 최종 SHA 검증 추가복원 4개, 부분복원 31개 | 업무·IA·계약·slice·migration·검증 정의의 역사 입력. `RECOVERY_MANIFEST.json`의 상태를 확인하고 사용 |
| [Scoped authoring control](hris-scoped-authoring-control-2026-09-16/RECOVERY_INVENTORY.md) | 원본 20개 중 19개 정확 복원, materializer 1개 미복원 | packet·receipt는 역사 증거. 현재 worktree에 대한 새 preflight 없이 개발 허가로 사용 금지 |

Blueprint manifest는 복원된 757개 역사 artifact의 상대 경로, byte length와 SHA-256을
고정한다. Scoped packet의 외부 contract binding은 50건 중 49건(고유 경로 22개 중
21개)이 일치한다. 경로별 분류, 미복원 목록, 형식 검사와 exact SHA 추가복원 근거는
[versioned recovery audit](audit/hris-porting-blueprint-2026-09-09/RECOVERY_REPORT.md)에 있다.

## 알려진 차단 항목

1. `hris-porting-blueprint-2026-09-09/session-evidence/hrm/g2-readiness/api-event-contracts.v1.json`
   은 packet이 고정한 최종본보다 짧다. 기대값은 35,196 bytes /
   `5390eac887c06d33e744252ddf013183f2f1e55198f8a28d341197b6a6336e65`, 복구본은
   25,944 bytes / `0c3ec58b29dcf534d1b887fed5678e878e4a514cf3f943165e47dd7a486355bb`다.
2. `hris-porting-blueprint-2026-09-09/coding-readiness/ia-entry-query-projection-schemas.v1.json`
   은 역사 `fileChange` 자체에 truncation marker가 포함되어 JSON으로 유효하지 않다.
3. Blueprint는 fileChange 이력이 있지만 원문을 복원하지 못한 파일 10개와 경로 참조만
   확인된 항목 337개를 manifest/report에 별도로 표시한다.
4. Scoped control의 `materialize_scoped_authoring_control.py`는 전체 원문이 없어 복원하지
   않았다.
5. 과거 authoring worktree 10개는 현재 존재하지 않는다. 새 통합 HEAD에서 작업 패킷과
   preflight를 다시 발행해야 한다.

위 항목을 임의로 완성하거나 복구본을 원본과 동일하다고 표시하지 않는다. 후속 통합은
[HRIS 통합 로드맵](../2026-10-06-integration-roadmap.md)과
[Lineage·v35 ADR](../../../03-architecture/hris/ADR-001-lineage-v35-successor-and-migration-lease.md)을
따른다.

## 검증 원칙

- 복구 무결성은 blueprint의 `RECOVERY_MANIFEST.json`과 각 묶음의
  `RECOVERY_INVENTORY.md`를 기준으로 확인한다.
- 역사 validator 전체를 통과시키려고 누락 artifact를 생성하지 않는다.
- 현재 개발 권한은 G1에서 현재/Reconciled pin, 허용 경로, v35 packet과 실제 migration
  lease를 고정하고 새 preflight를 발행한 뒤에만 부여한다.
- 변경 cluster를 먼저 검증하고, 전체 W1은 통합 FE/BE HEAD가 동결된 뒤 한 번만 실행한다.
