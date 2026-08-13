# DWP-R1-ADM-006 API·권한 계약

| Method | Path                                                                 | 목적                   |
| ------ | -------------------------------------------------------------------- | ---------------------- |
| GET    | `/api/platform/v1/admin/catalog`                                     | 검색 Overview          |
| GET    | `/api/platform/v1/admin/catalog/graph`                               | Focus 관계 Graph       |
| GET    | `/api/platform/v1/admin/catalog/impact`                              | 변경 영향 계산         |
| GET    | `/api/platform/v1/admin/catalog/assurance`                           | Finding·활성 규칙 조회 |
| POST   | `/api/platform/v1/admin/catalog/assurance/evaluate`                  | 즉시 자동 평가         |
| POST   | `/api/platform/v1/admin/catalog/assurance/findings/{id}/disposition` | Finding 판정           |
| POST   | `/api/platform/v1/admin/catalog/relations`                           | 명시 관계 등록         |
| POST   | `/api/platform/v1/admin/catalog/relations/{relationId}/retire`       | 관계 종료              |

- Tenant Admin의 Catalog Permission을 서버에서 재검증한다.
- Gateway가 주입한 Tenant·User만 신뢰하고 Client Header로 범위를 전환하지 않는다.
- 관계 등록은 두 Entity 존재, 다른 Ref, 허용 Type과 Metadata Object를 검증한다.
- 종료 요청은 현재 Version이 다르면 `409`를 반환한다.
- 변경은 Correlation ID와 Actor를 포함한 감사 Event를 생성한다.
- 정기 평가는 활성 Tenant마다 매일 실행되고 `SERVICE` Actor 감사를 남긴다.
- 판정은 사유 10자 이상, 허용 Decision, Evidence Reference 길이와 현재 Version을 검증한다.
- 오탐·위험 수용 후 Evidence가 달라지면 이전 결정을 자동 재사용하지 않는다.
