# HRM People360 계층화 사전 독립 검토

판정은 **준비 설계 검토**이며 G3 승인이나 네이티브 권한 검증이 아닙니다. FE 원본 7파일을 수정하지 않았고 테스트도 실행하지 않았습니다. 소스에 선언된 12건(모델 6·런타임 6)은 PASS 수량이 아닙니다.

원본 7개 전체 및 AGENTS·제품 규칙 두 문서를 끝까지 읽었습니다. 즉시 캡처 2026-09-14T11:17:51.259620+00:00–2026-09-14T11:17:51.270414+00:00의 15개 SHA/decimal ns는 전후 일치합니다. JSON에 7원본 전체 UTF-8 gzip을 보존했습니다. 앞선 읽기 구간 전체의 불변성을 소급 주장하지 않습니다.

## 핵심 발견

- 상세 `people-360-detail.tsx:107`은 `workerNumberMasked`와 무관하게 원문 번호를 렌더합니다. 기존 런타임 fixture는 masked=true와 SECRET-WORKER-92를 함께 두고 `:466`에서 비밀 번호 노출을 기대합니다. 이는 기존 코드·테스트의 확정 모순입니다. 계층화 원기능 baseline과 개인정보 강화의 기대 변경을 구분해야 합니다.
- API는 `response.data.data`를 그대로 반환하고 목록·상세 query는 원시 DTO를 캐시에 저장합니다. UI가 쓰지 않는 workers/관계/고용주/국가 등의 필드도 남습니다. 기본 native client와 주입 fake 모두 캐시 전에 동일 strict display-only projection을 거쳐야 합니다.
- boolean/classification/목록 형태와 응답 대상 ID를 검증하지 않습니다. masked 번호는 VM 자체에 원문이 없어야 하며 malformed/다른 대상 응답은 fail-closed 처리해야 합니다.
- URL civil DATE는 실제 Temporal 검증을 합니다. 다만 invalid zone fallback은 주입 now를 버리고 실제 현재 날짜를 읽으며 페이지의 Asia/Seoul fallback은 정본 업무 asOf 정책이 아닙니다.
- 페이지·상세의 query/DTO 직접 의존, pure model의 React scope hook 타입 의존과 public index 부재를 해소해야 합니다.

## 정확한 이동 및 추가

| 원본 | 목표 |
|---|---|
| people-360-data-source.ts | api/people-360-api.ts |
| people-360-model.ts | model/people-360-model.ts |
| people-360-mobile-list.tsx | components/people-360-mobile-list.tsx |
| people-360-detail.tsx | components/people-360-detail.tsx |
| people-360-workspace.tsx | pages/people-360-workspace.tsx |
| people-360-model.test.ts | testing/people-360-model.test.ts |
| people-360-workspace.runtime.test.tsx | testing/people-360-workspace.runtime.test.tsx |

실제 책임을 가진 신규 파일은 hooks/use-people-360.ts(query·취소·상태), model/people-360-view-model.ts(선택 필드 strict codec), index.ts(명시적 공개 계약)입니다. 읽기 전용 화면이므로 빈 forms나 증인용 폴더는 필요 없습니다.

외부 영향은 hcm.tsx:90의 lazy deep import와 hris-home-mount-contract.test.ts:30의 경로 기대입니다. public barrel로 바꾸되 기존 HRM mount를 유지해야 합니다. apps/libs 검색에서 다른 외부 People360 import는 발견하지 않았습니다.

## 보존 및 미검증 경계

목록·모바일·drawer 레이아웃, query-owner asOf/q/status, 일부 로드 페이지의 org/grade/location 필터와 partial 안내를 보존합니다. 여섯 권한 scope key·민감 metadata·AbortSignal·ready=false 요청 0도 유지합니다. 일반 네트워크 오류의 부분 결과와 권한 403/context-change의 즉시 개인정보 숨김을 구분합니다.

공통 provider에 민감 query cancel→remove 경로가 있으므로 전사 과거 권한 캐시 유출을 확정하지 않습니다. 원시 DTO의 현 scope 캐시 보존은 확인했습니다. 실제 PEP·전송·필드 정책/회수·교차 탭 수명은 이 소스 검토로 승인하지 않습니다.

구현 소유자는 Root입니다. 본 보고서는 새 JSON/MD만 작성했습니다. G3에는 정확한 계층·codec·owner 계약과 실제 선택 회귀/compile이 필요하며, 전체 HRM CRUD(G4)나 고객 운영 identity 채택(G6)을 선행 조건으로 당기지 않습니다.

