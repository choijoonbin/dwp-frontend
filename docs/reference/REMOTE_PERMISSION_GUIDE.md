# Remote 앱 권한 제어 가이드

- **목적**: 메뉴/탭/버튼별 권한을 **공통 설정 한 곳**에서 관리하고, 리모트 앱별로 권한 로직을 중복하지 않도록 함.
- **참고**: `docs/api-spec/synapse-spec/LOGIN_AND_PERMISSION_API_FE_HANDOVER.md`

---

## 1. Single Source of Truth

| 구분 | 위치 | 용도 |
|------|------|------|
| **path → resourceKey** | `libs/shared-utils/src/auth/route-permission-config.ts` | 라우트 키(예: `cases`, `audit`) → `resourceKey`(예: `menu.autonomous-operations.cases`) |
| **권한 조회** | `GET /api/auth/permissions` | 사용자별 `resourceKey` + `permissionCode`(VIEW, USE, EDIT, APPROVE, EXECUTE 등) |
| **메뉴 트리** | `GET /api/auth/menus/tree` | VIEW 권한으로 필터된 메뉴만 반환 (사이드바 렌더링) |

- **새 메뉴/라우트 추가 시**: `ROUTE_RESOURCE_MAP`에 `pathKey → resourceKey`만 추가하면, Host/Remote 모두 동일한 권한으로 가드됨.

---

## 2. 페이지(라우트) 권한

- **역할**: 해당 path에 **VIEW** 권한이 없으면 403(또는 redirectTo)으로 이동.
- **적용 위치**: Host에서 pathname으로 페이지를 결정할 때, 또는 Remote의 `getPageForPathname`에서 **한 번만** 적용.

### 2.1 SynapseX (pathname-to-page)

- `getPageForPathname(pathname)` 내부에서 `getResourceKeyForPath(pathKey)`로 resourceKey 조회 후, `PermissionRouteGuard`로 감싼 뒤 반환.
- **로직은 pathname-to-page 한 곳에만** 있고, resourceKey 매핑은 `libs/shared-utils`의 `route-permission-config` 사용.

### 2.2 새 Remote 앱에서

- Host가 pathname으로 Remote를 로드할 때, Host 쪽에서 동일하게 `getResourceKeyForPath(pathKey)` + `PermissionRouteGuard` 적용하거나,
- Remote 진입점(예: `getPageForPathname`)에서 **공통 config**를 import해 동일 패턴으로 감싸면 됨.

```tsx
import { getResourceKeyForPath, PermissionRouteGuard } from '@dwp-frontend/shared-utils';

function wrapWithRouteGuard(page: ReactNode, pathKey: string): ReactNode {
  const resourceKey = getResourceKeyForPath(pathKey);
  if (!resourceKey) return page;
  return (
    <PermissionRouteGuard resource={resourceKey} permission="VIEW" redirectTo="/403">
      {page}
    </PermissionRouteGuard>
  );
}
```

---

## 3. 탭/버튼 권한

- **역할**: 해당 리소스에 USE/EDIT/APPROVE/EXECUTE가 없으면 버튼 숨김 또는 비활성화.
- **사용처**: 페이지 내부의 CTA(저장, 승인, 실행, 초대 등).

### 3.1 PermissionGate (design-system)

```tsx
import { PermissionGate } from '@dwp-frontend/design-system';
import { getResourceKeyForPath } from '@dwp-frontend/shared-utils';

const resourceKey = getResourceKeyForPath('admin') ?? 'menu.governance-config.admin';

<PermissionGate resource={resourceKey} permission="USE">
  <Button>Invite User</Button>
</PermissionGate>

<PermissionGate resource={resourceKey} permission="EDIT" mode="disable" fallback={<Button disabled>Edit</Button>}>
  <Button>Edit</Button>
</PermissionGate>
```

- **permission**: VIEW, USE, EDIT, APPROVE, EXECUTE, CREATE, UPDATE, DELETE, MANAGE (백엔드 permissionCode와 일치).
- **mode**: `hide`(기본, 권한 없으면 children 미표시), `disable`(권한 없으면 children을 disabled로 렌더).

### 3.2 resourceKey 가져오기

- **같은 페이지 내**: `getResourceKeyForPath(pathKey)` 사용. pathKey는 `route-permission-config`의 키(예: `cases`, `audit`, `admin`).
- **pathKey**: Host/메뉴 트리의 path에서 추출한 세그먼트(예: `/synapse/cases` → `cases`). `ROUTE_RESOURCE_MAP`에 정의된 키와 동일해야 함.

---

## 4. 권한 코드 (permissionCode)

| 코드 | 용도 (화면 제어) |
|------|------------------|
| VIEW | 메뉴/페이지 노출, 조회·검색·필터·상세 열람 |
| USE | 코멘트·태깅·할당·상태 변경·요청 생성·저장 |
| EDIT | 정책·프로파일·가드레일·PII 설정 등 편집 |
| APPROVE | 승인/반려/요청 정보 회신 |
| EXECUTE | 실행/재시도/롤백 등 조치 |

- CREATE, UPDATE, DELETE, MANAGE는 Admin 등 기존 메뉴에서도 사용 가능.

---

## 5. 새 메뉴/라우트 추가 시 체크리스트

1. **백엔드**: `GET /api/auth/permissions`에 새 `resourceKey`가 역할별로 내려오는지 확인.
2. **공통 설정**: `libs/shared-utils/src/auth/route-permission-config.ts`의 `ROUTE_RESOURCE_MAP`에 `pathKey → resourceKey` 추가.
3. **페이지**: 해당 path로 진입할 때 `getPageForPathname`(또는 Host 쪽 동일 로직)을 쓰면 자동으로 VIEW 가드 적용.
4. **탭/버튼**: 필요 시 `PermissionGate(resourceKey, USE|EDIT|APPROVE|EXECUTE)`로 제어.

---

## 6. 요약

- **라우트 권한**: `route-permission-config` + `PermissionRouteGuard` → **한 곳에서만** 적용(pathname-to-page 또는 Host 진입점).
- **탭/버튼 권한**: `PermissionGate` + `getResourceKeyForPath(pathKey)` → 각 페이지에서 resourceKey만 공통 config 기준으로 사용.
- **앱별 권한 로직 분산 금지**: resourceKey/경로 매핑은 `libs/shared-utils`에만 두고, Remote는 공통 훅/컴포넌트만 사용.
