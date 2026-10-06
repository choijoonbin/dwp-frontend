# 공통 devctl 및 canonical 5개 실행환경 진단

판정: 공통 회귀 PASS / 실행환경 BLOCKED_CAPACITY / G3 CLOSED. 진단 기록이며 authoritative Gate 또는 current catalog 영수증을 대체하지 않는다.

Backend `db0d2b5067e6fbee27ee58121c5a4406cab132b9`, tree `20f345a640b1d8238b9a2e709a060cc51df9b729`는 devctl 1라인과 테스트만 변경했다. Provider metadata column ACL 정리 SQL의 Python invalid escape를 수정했다. 수정 전의 실제 Python 함수 AST를 분리 실행하고 Docker 호출을 mock한 비교에서 5개 호출 중 4개 source SQL의 predicate가 `ESCAPE ''`였음을 확인했다. 수정 후는 PostgreSQL escape 문자 backslash를 보존한다. 다른 호출 인자·SQL 행은 동일하고 live DB 변경은 없었다. 원인은 경고뿐 아니라 잘못된 SQL predicate였다.

현재 소스로 실제 계산한 Control reference는 `dwp-migration-control-v2:03a51f9d6f13174d8a8392fda9c6ede5e1afa8e1c38efc52056fa6fa1cfbe517`이다. 761 scaffold의 a18c30... 및 70 전체 진단의 7f31c2... reference는 역사 증거이며 현재 native/runtime 봉인으로 재사용할 수 없다.

실제 Python3.12의 `-W error::SyntaxWarning -m unittest scripts.tests.test_devctl scripts.tests.test_runtime_topology_doctor_evidence`에서 67개 테스트 exit0였다. Generated SQL 두 predicate assertion 및 source compile warning-as-error 회귀를 추가했다. 기존 테스트의 직접 classpath 문자열은 현재 sealed trustedControlClasspath 재사용에 뒤처져 있었으므로, 동일 sealed 변수 정의·실행 classpath·fixture asPath 확인으로 갱신했다. Control build/classpath/security guard는 수정하지 않았다. 첫 실행의 stale textual assertion FAIL은 보존된 진단 사실이며 재실행 PASS와 구분한다.

다섯 canonical backend 모두 예상 parent clean 확인 후 db0d2b5에 fast-forward 전달했다. Frontend `aaeba79eefae7cc2d1ba6151f47fa9e891a75bfd`, tree `9e15dc43185be0df80c50504739ef4f47bd7f788`는 공식 생성기로 backend provenance 1필드만 갱신했다. 명시적 공식 backend 입력의 실행 계약 검사 exit0(12 products/60 PEP cells, 46 fixture records/5 vectors, 79 PAGE closure) 후 다섯 canonical frontend도 clean fast-forward했다. Agent OpenAPI 승인본/negative evidence는 변경하지 않았다. 이 변경 이후 최신 BE/FE 전체 suite·catalog 재봉인은 아직 아니다.

Python3.12 invalid-escape 경고 때문에 최초 761 doctor capture는 HRM에서 unexpected failure로 중단되어 5개 영수증을 만들지 못했다. 경고를 숨기거나 capacity regex/budget를 완화하지 않았다. 수정·배포 후 host verification semaphore 아래 actual db0d2b5 canonical doctor를 순차 실행했다: 2026-09-14 02:25:00.967836–02:25:08.599750 UTC. Capture 명령 exit0는 차단 결과를 정상 저장했다는 뜻이지 5개 profile PASS가 아니다.

| Profile | 관측 가용 GiB | 요구 GiB | 판정 |
| --- | ---: | ---: | --- |
| HRM | 3.64 | 5.25 | BLOCKED_CAPACITY_FAIL_CLOSED |
| PER | 3.69 | 4.62 | BLOCKED_CAPACITY_FAIL_CLOSED |
| PAY | 3.50 | 6.50 | BLOCKED_CAPACITY_FAIL_CLOSED |
| TIM | 3.66 | 5.88 | BLOCKED_CAPACITY_FAIL_CLOSED |
| SYS | 4.01 | 6.50 | BLOCKED_CAPACITY_FAIL_CLOSED |

Private source-bound 영수증은 [/private/tmp/hris-runtime-profile-doctor-db0d2b5-20260914.json](/private/tmp/hris-runtime-profile-doctor-db0d2b5-20260914.json), SHA-256 `e89480d8ef1cfe963260a6e6f372fa9d7e4334a8406bf987803cc28b0378be70`이다. Source propagation5/5, profile PASS0/5, capacity fail5/5, unexpected failure0. tempfile는 영구 게시 증거가 아니며 final catalog/native capture가 필요하다. 이 예산은 현재 기존 runtime topology 진단이고 제안된 새 private streams/pools의 최종 예산 검증까지 완료한 결과가 아니다.

Doctor는 의존성·toolchain·Docker 가용성·포트·예산만 점검했고 실제 모듈 서버/DB bootstrap/start/stop을 수행하지 않았다. 사용자 기존 서버·dirty main checkout·SKKF 원본은 건드리지 않았다. 설계 P0/P1·shared owner 계약·runtime-only startup/new stream bootstrap·migration successor·최종 증거도 별도로 OPEN이며, 자원만 확보한다고 G3가 열리지 않는다.
