# DWP identity owner-neutral ABI.v1 준비안

native 상태 변경과 stamp의 경계: `AuthTenantProvisioningService` 200–202행의 계정 activation SQL은 status를 ACTIVE로 바꾸지만 version/access_revision을 증가시키지 않는다. 따라서 기존 rowVersion을 전체 lifecycle revision이라고 해석하지 않는다. person 연결의 JPA stamp와 현재 접근 stamp를 비교하면서 현재 Auth owner status를 별도로 검사한다. 실제 native producer의 버전 일관성·signed freshness·lifecycle ordering은 OPEN이다. 생산 소스를 이번 단계에서 고치거나 stamp만으로 그 문제를 닫지 않는다.

상태: UNWIRED_SCAFFOLD / G3_CLOSED / COMMON_P0_OPEN. 구현 및 mock 검증 범위만 정의하며 전체 개발 준비 완료 승인이 아니다.

기존 Auth가 principal→person을, People이 person→worker→workRelationship→assignment를 소유한다. 새 principal-worker 원장, 별도 binding counter, DDL은 만들지 않는다. `com_users.version`은 이미 존재하는 JPA optimistic rowVersion으로, person 연결의 보수적인 stamp로 재사용한다. 프로필 수정도 stamp를 바꿀 수 있으므로 정확한 expected/current 비교를 요구한다. 접근 권한 변경용 `access_revision`은 별도 비교한다. 두 숫자는 서명·최신 owner proof·revoke 전파를 구현했다는 증거가 아니다.

정확한 DTO와 검사 순서는 [JSON 계약](identity-owner-abi.proposal.v1.json)에 있다. neutral Java ABI.v1은 기존 HTTP.v1을 수정하지 않으며 향후 HTTP.v2의 wire 형식·서명·endpoint가 아니다. 모든 owner-return DTO는 공개 immutable **미검증 데이터 carrier**다. owner 구현은 DTO를 정상 생성할 수 있어야 한다. provider lookup 및 선택된 verified 결과만 guard 내부에서 생성한다. public owner-composition factory는 명시적 미배선 API이며 Spring/HTTP 등록이 없다. consumer는 port와 guard-minted 결과만 사용한다. 임의 factory 배선이 production trust를 만들어 준다고 주장하지 않는다.

raw 요청에는 목적, asOf, 선택적인 native UUID 3종 tuple만 있다. tenant/actor/person/email/name/header는 입력받지 않는다. configured audience와 purpose를 정확히 매핑하고, 하나의 trusted Clock을 캡처한다. current-scope adapter가 제공한 현재 APP entitlement, SoD, purpose, audience, permission revision, 유효시간과 Auth의 실제 tenant/user/principal/person/status/plane/version/accessRevision를 검사한 뒤 People에 전달한다. native 결과는 tenant/person/asOf 및 완전성, 모든 public UUID 부모 관계, 각 버전, owner 정책의 상태 집합, assignment zone의 native DATE 효력을 검사한다. `LEAVE` 같은 상태를 Auth suspended로 복사하는 고정 정책은 만들지 않는다. 실제 목적별 정책 공급자는 OPEN이다.

native context 0개는 거절, 1개는 기본 선택, 여러 개는 명시 선택을 요구한다. 후보 목록은 선택된 authority가 아니며 `LIMIT 1`, UUID 값 우연 일치, email/name, body person, synthetic employee, correlation ID로 보정하지 않는다. worker/relationship/assignment를 새 고용 UUID로 합치지도 않는다. adapter 하나라도 없으면 verifier/Auth/People 모두 호출 0으로 거절한다.

추가 독립 검토 보완: 같은 worker/relationship/assignment UUID는 각각 버전·상태·부모·날짜·zone까지 동일한 immutable record여야 한다. proof lease는 최대 30초, native context는 최대 100개다. query/asOf의 최초 Clock은 고정하지만 결과 발급 직전 Clock을 다시 읽어 역행과 두 owner-carrier lease의 만료를 거절한다. 이는 실제 서명·revoke 전파 구현과는 다르다. person 상태도 owner policy의 명시 allowlist이며 INACTIVE 과거 급여 조회를 표현할 수 있다. Auth ACTIVE account와 현재 APP entitlement는 여전히 필수다. 퇴사자 접근 정책과 현재 owner publication의 실제 운영 배선은 OPEN이다.

검증은 fixed/advancing Clock과 실제 typed Auth/current-scope/People mock DTO, reject code, provider 호출 횟수를 사용한다. neutral Auth-owner fixture 및 기존 dependency가 있는 People/Payroll consumer compile을 포함한다. 두 consumer는 공개 raw DTO들을 guard에 연결하고 실제 SELECTED person/worker/relationship/assignment UUID·각 버전·Auth stamps·목적을 작은 projection으로 소비해 assert한다. adapter 누락 시 typed 거부·모든 호출 0도 실제 실행한다. 초기 null-return compile witness 2건은 이 강화된 검증과 구분해 이전 81건 실행으로만 기록한다. Auth build 변경은 제외한다. 동시 heavy 검증 없이 host `hris-verification` semaphore 30초 대기, `--no-daemon --max-workers=1`로 집중 unit/compile을 수행한다. Testcontainers/native PG/Auth/Gateway 배선·lifecycle ordering·signed owner transport 실행과 구분한다.

남은 공통 P0: Auth current binding endpoint와 실제 stamp publication, 서명·freshness·revoke·deployment fence, native People complete multi-context producer와 purpose 정책, 현행 primary LIMIT1 adapter 교체, lifecycle ordering/relink maker-checker/event digest, 실제 route PEP/현재 권한 scope 배선과 native 통합 테스트. 이 단계가 이를 닫지 않는다. integration BE `db0d2b5067e6fbee27ee58121c5a4406cab132b9` / FE `aaeba79eefae7cc2d1ba6151f47fa9e891a75bfd` pre-clean이며 main/SKKF/정본/Gate/SQL/server를 보존한다. root 독립 검토 전 commit/전파하지 않는다.
