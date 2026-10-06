# Semantic operation mode 후속 검증

상태: MODE_GAP_FIXED / G3_CLOSED. 검증기 수정 증거이며 전체 HRIS 구현·모듈 작업 개시 승인이 아닙니다.

## 실제 결함과 수정

이전 검증기에서 건강한 `case.create` command 하나만 남긴 문서에 외부의 독립 expected ID `case.create`와 count 1을 공급해도 mode `BOGUS`, `null`, ` COMMAND`는 각각 errors 0, operations 1, readiness PASS였습니다. 이를 수정하여 모든 canonical binding의 mode는 문자열 `COMMAND` 또는 `QUERY`와 정확히 일치해야 합니다. 누락·공백·대소문자 변형·객체·배열·boolean·숫자는 `OPERATION_MODE_INVALID`로 field 실행 전에 FAIL합니다. 값 정규화·coercion은 하지 않습니다.

수정 파일은 `validate_modern_semantic_field_lineage.py`와 `test_modern_semantic_field_lineage.py`뿐입니다. aggregate caller, 제안서, 정본 계약, BE/FE, Gate·봉인, 사용자 DB·서버는 변경하지 않았습니다.

## 실행 증거

- Python 3.12.14, SyntaxWarning-as-error: 63개 단위검증, 실패 0·오류 0·skip 0. 기존 field-lineage 35개와 dialect/scope 28개입니다.
- 새 3개 검증은 command 단독 독립 scope의 잘못된 mode 11종, 정상 기존 command/query source witness, READINESS/DIAGNOSTIC_ONLY의 invalid query mode를 확인합니다. diagnostic은 잘못된 canonical mode를 우회하지 못합니다.
- 정상 `workers.query`는 writesTables 빈 배열을 유지하며 PASS합니다. 정상 `case.create`도 기존 실제 source·identity·FK 검증을 수행한 뒤 PASS합니다.
- aggregate 기존 negative self-tests 16개, 실패 0. Python 3.9 호환 단위검증도 63개 PASS입니다.
- standalone `--self-test --compact`: self-tests PASS, 실제 정본 FAIL, exit 1. aggregate도 self-tests PASS, 실제 정본 FAIL, exit 1입니다. self-test 성공으로 정본 실패를 무력화하지 않습니다.

현재 정본은 독립 registry 100개 operation, field sources 2335개, typed sources 0개, 실제 오류 2007개입니다. 이 수량은 이번 source snapshot의 관측값이며 고정 승인 상수가 아닙니다. 오류 지문 `bcff18a5bf25ad27f4d5e8152a4f8f95cd5e53584dc8b9c5e9bc8da6603e4e99`은 이전 보고서와 동일합니다. 기존 `OperationValidator` 구현 SHA `cd32a67174847ea3747d6ce1787314fafb1a02f9da8234a89f19dda8b44a0e07`도 동일하여 source/type/business identity 검증을 약화하지 않았습니다.

## 보존과 핀

이전 60개 검증 보고서 `semantic-dialect-failclosed-hardening-2026-09-14.json/.md`는 원문과 역사 SHA를 그대로 보존했습니다. verification 전후 source와 이전 보고서 모두 변하지 않았습니다.

- 새 validator SHA: `30e3fe74498ba265945970b4b68ab008bbce6108fc74169edd356e8d70f3bf81`
- 새 test SHA: `3483f0f8c0d1cab62d015c26741a5df157fb7835e693c315397010bc82af61f1`
- 무수정 aggregate SHA: `43b9e7456dd4f6cf5fd9edfeae1f9c60c3c299d7ad6f51eeb6be392f16e33737`
- 이전 JSON SHA: `3c878b13d09e684ec6392e7be2573250d90ea4d9018f10239d679122a3cfdeda`
- 이전 MD SHA: `9ac685272b771d0736421b656e0eb69fb12a9e7a9ed565cf7d282aa04036af92`

[전체 증거 JSON](./semantic-dialect-mode-followup-2026-09-14.json)에 정확한 63개 test ID, 각 mode의 실제 결과, 실행 명령·exit·duration·output SHA, 정본 오류 분포·계약 핀과 source 전후 SHA를 기록했습니다. 업무 도메인 구현 실행이나 composite authority bootstrap/wiring 검증은 이번 범위가 아닙니다.
