# S1 첫 단위·보안 실패 — 원문 보존

상태: 실제 exit1, 58개 testcase 기록/55개 distinct ID, 2 FAIL·0 error/skip. HRIS/G3 준비 승인은 아닙니다.

- 실행: 2026-09-14 11:24:24.929997Z–11:24:38.171766Z, 13.242302125초, timeout=false. 호스트 잠금 해제는 11:24:39.010Z입니다.
- 기존 컴파일 실패를 수리한 신규 테스트 두 호출만 바뀌었습니다. 그 호출을 역치환하면 이전 소스 SHA가 정확히 복원됩니다. 생산 4개·기존 build/JWT/session/SQL/catalog·기대값은 변경하지 않았습니다.
- 전후 3,066개 SHA/바이트/ns 문자열 소스 튜플이 모두 같습니다. 두 XML은 실제 실행 시작 이후 생성됐습니다.
- 닫힌 decoder/digest/missing-owner 34개는 모두 통과했습니다.
- 전용 security 24개 중 정상 READ adapter 진입이 expected403 vs401, 인증 후 본문 크기 한도가 expected400 vs401로 실패했습니다. 정상 권한 진입을 확인하지 못했으므로 denial 통과만으로 전체 보안을 승인하지 않습니다.
- distinct ID가 55인 것은 두 parameterized 메서드가 같은 absentHeaders의 기본 display name을 사용해 토큰/identity/Authorization 이름 3개씩 서로 충돌했기 때문입니다. raw XML 모두 보존했습니다.

## 완전 증거

[JSON 압축 원문](workforce-policy-s1-first-unit-security-failure-2026-09-14.json)의 SHA는 `b3e2be35b948e810c32e8fd0d6691307e52a48f5cdc248e83f28b0d29b301e67`, ns 문자열은 `1789385133483537832`입니다. 44개 전체 청크 및 completion을 확보하고 저장 파일을 직접 읽어 gzip SHA `5337964b09554bd458a98eee8f9927464626b634932f2e67c2fedd368fb4f686`와 receipt SHA `ac954949bf473ab7ae50f429a7867782a62f4ec5a022747f39faaa1354a18cc1`을 대조했습니다. 두 raw XML과 전체 stdout/stderr가 압축 원문에 포함됩니다.

## 승인된 테스트 전용 후속 수리

기존 native Encoder 72행 및 JwtConfig 61행은 명시 HS256입니다. 신규 보안 fixture는 64바이트 키에 JJWT 기본 signWith(key)를 사용했으므로 기본 알고리즘 선택과 decoder HS256이 불일치할 수 있습니다. Root의 소스 확인 후 fixture도 명시 HS256으로 정합화하며, 두 parameterized annotation에 메서드 displayName을 포함해 distinct 증거 ID를 만듭니다. production 및 assertions/기대코드는 변경하지 않고 같은 실제 58개를 다시 실행합니다. 이 실패 원문은 덮어쓰지 않습니다.

Native PG는 이 실행에서 0개입니다. S1 READ evidence는 command permit가 아니며 S2/S3 consume/store/writer fence·서명된 current transport·전체 native PEP·G3는 미승인입니다.
