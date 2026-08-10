# 05 API 권한 계약

## Namespace

- Provider: 향후 `/api/provider/v1/**`, Provider Identity만 허용
- Tenant Admin: `/api/*/v1/admin/**`, 검증된 단일 Tenant Context
- Runtime: `/api/*/v1/**`, Resource+Action과 Data Scope 재검사
- People: 향후 `/api/people/v1/**`, Field Masking과 Purpose Scope 적용

## Permission

```text
effective = direct user roles
          + active tenant-scoped group roles
          + approved scoped delegated roles
          - SoD/policy denials
```

- UI가 버튼을 숨겨도 API는 동일 Permission을 검사한다.
- Group/Role/Scope 변경은 Session과 Permission Cache를 폐기한다.
- PII Export, Role Assignment, Navigation Publish와 Agent Tool Grant는 별도 Action이다.
- 목록은 Cursor Pagination을 기본 목표로 하고 모든 Query에 Tenant Predicate를 포함한다.
- Update는 Version 또는 ETag가 없으면 거부한다.
