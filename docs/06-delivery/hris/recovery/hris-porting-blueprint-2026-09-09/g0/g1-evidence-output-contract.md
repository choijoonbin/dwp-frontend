# G1 모듈 증거 산출물 계약

이 계약은 `new-file-allocation-register.csv`에 예약된 15개 G1 파일의 형식과 무결성 규칙을 고정한다. 각 모듈은 자기 `session-evidence/<module>/` 디렉터리의 세 파일만 생성한다. 원문 코드·SQL·수식·설정값·비밀값·운영 개인정보는 기록하지 않고, 비표현적 업무 사실과 source path/hash 포인터만 남긴다.

## `g1-characterization.md`

다음 제목을 모두 포함한다.

1. `Provenance and scope`
2. `Coverage summary`
3. `Actors and authorization`
4. `Journeys and commands`
5. `Validation, state, and exceptions`
6. `Data ownership and retention`
7. `Batch, interface, and document behavior`
8. `Redundancy and process improvements`
9. `Generic core, country pack, and tenant extension`
10. `Target contract proposals`
11. `Unknowns and decisions`
12. `Synthetic characterization tests`

`Coverage summary`는 자기 master slice의 total/decided/unknown/retire/consolidate/reimplement 수를 적고 shard와 일치해야 한다. source snippet이나 credential-like 값을 붙이지 않는다.

## `g1-child-trace.csv`

정확한 헤더 순서:

```text
child_id,parent_artifact_id,session_id,source_module,child_type,source_file,source_line,source_fingerprint,actor,trigger,input_contract,output_contract,validation_rules,state_transitions,exceptions,legacy_dependency,target_capability_candidate,target_api_event_candidate,target_data_owner_candidate,disposition,decision_status,decision_id,owner_role,evidence_refs,notes
```

- `child_id`는 모든 모듈을 통틀어 유일하고 안정적이어야 한다.
- `parent_artifact_id`는 반드시 자기 `session-registers/*-source-coverage.csv`의 기존 `artifact_id`를 가리킨다. 부모 없는 child는 금지한다.
- `session_id`는 자기 모듈 ID와 같아야 한다.
- `child_type`은 최소 `MENU_ELEMENT`, `SERVICE_OPERATION`, `JOB`, `INTERFACE`, `FORMULA_BEHAVIOR`, `FILE_DOCUMENT`, `SQL_BEHAVIOR`, `STATE_TRANSITION` 중 하나다.
- `source_file`은 pinned·sanitized 분석 경계 안의 상대 경로이고 `source_fingerprint`는 값이 아닌 SHA-256이다. `source_line`이 있으면 양의 정수다.
- `disposition`과 `decision_status`는 빈 값일 수 없다. `UNKNOWN`이면 `owner_role`, `decision_id`, `evidence_refs`에 필요한 증거·기한·차단 범위를 연결한다.
- 코드·SQL·수식의 원문 표현은 CSV에 넣지 않는다.

## `g1-decision-log.csv`

정확한 헤더 순서:

```text
decision_id,session_id,scope,decision_type,question,options,proposed_decision,status,owner_role,consulted_role_ids,due_at,blocking_gate,blocking_scope,evidence_refs,resolution,decided_at,notes
```

- `decision_id`는 모든 모듈을 통틀어 유일하고 child trace 및 coverage의 결정 포인터와 일치한다.
- `session_id`, `scope`, `decision_type`, `question`, `status`, `owner_role`, `blocking_gate`, `blocking_scope`는 필수다.
- 미결 상태는 `OPEN`, `EVIDENCE_REQUIRED`, `ESCALATED` 중 하나이며 안정 role ID, ISO-8601 `due_at`, 필요한 `evidence_refs`를 가져야 한다.
- 종결 상태는 `DECIDED`, `REJECTED`, `SUPERSEDED` 중 하나이며 `resolution`, `decided_at`, 증거와 결정권자를 가진다.
- 침묵·SLA 초과·AI 추론을 승인으로 기록하지 않는다.

## Checkpoint 불변식

세 파일 중 하나를 checkpoint에 제출하면 세 파일을 모두 제출한다. Integration Control은 CSV 헤더, ID uniqueness, child→parent FK, session ownership, 결정 포인터, shard 집계와 원문·비밀값 금지 여부를 검증한다. duplicate, orphan, 잘못된 session ID, 필수값 누락, 근거 없는 `UNKNOWN` 또는 승인 흉내가 한 건이라도 있으면 해당 checkpoint를 병합하지 않는다.
