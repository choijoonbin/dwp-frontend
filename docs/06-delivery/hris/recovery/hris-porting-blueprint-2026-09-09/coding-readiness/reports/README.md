# 전체 코딩 준비 검증 리포트

`validate_full_coding_readiness.py --check-live --write-report`만 다음 두 authoritative LIVE 파일을 원자적으로 갱신한다.

- `full-coding-readiness-latest.json`: 기계 판독용 판정, 집계, validator digest, baseline, 오류
- `full-coding-readiness-latest.md`: 사람이 검토하는 동일 판정 요약

`OPEN_G3_CODE`는 live 모드에서 모든 필수 조건이 통과할 때만 생성된다. static 통과만으로는 코딩 Gate를 열지 않는다. 이 리포트는 G3 구현 완료, G4 기능 수용, G5 디자인 수용 또는 G6 production 활성화를 의미하지 않는다.

`--static --write-report`는 별도의 `full-coding-readiness-static-latest.{json,md}` 진단 파일만 갱신하며 위 LIVE 정본을 덮어쓸 수 없다. 공개 상태를 인용하기 전 `python3 coding-readiness/validate_published_gate_truth.py --compact`를 실행해 LIVE/PASS/Gate, checkpoint·공개 선언·전 산출물 digest가 현재 파일과 일치하는지 확인한다.

실패 리포트도 의도적으로 보존할 수 있다. 원인을 보정한 뒤 같은 명령으로 최신 리포트를 덮어쓰며, 최종 보고에는 `status=PASS`, `effectiveGate=OPEN_G3_CODE`, `productionState=NOT_AUTHORIZED_G6`가 함께 있어야 한다.
