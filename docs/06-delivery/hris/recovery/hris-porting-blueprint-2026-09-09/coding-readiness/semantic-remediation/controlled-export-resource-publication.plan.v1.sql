-- ARTIFACT_ONLY_NOT_APPLIED; not an allocated/approved backend Flyway migration.
-- Proposed Auth V213 slot is conditional on independently published successor.
-- Native Control fence, external approved source/receipt/reference and complete
-- immutable pre/post state evidence are REQUIRED before materialization.
-- This file must never be imported into an app resource stage automatically.
-- Placeholders are deployment protocol identifiers, not tenant/company policy.
BEGIN;

-- Application writers must already be fenced by reviewed external Control.
-- Locks serialize registry changes; they do NOT replace the missing Control
-- runtime credential/CONNECT fence or governed administrator authorization.
LOCK TABLE public.sys_tenant_resource_templates IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.com_resources IN SHARE ROW EXCLUSIVE MODE;

DO $publication_preflight$
BEGIN
    IF pg_catalog.current_database() <> '${authCatalog}'
       OR CURRENT_USER <> '${authMigrationPrincipal}'
       OR SESSION_USER <> CURRENT_USER THEN
        RAISE EXCEPTION 'Controlled export publication authority/catalog mismatch';
    END IF;
    IF '${publicationReference}' !~ '^dwp-migration-control-v2:[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'External approved publication reference missing';
    END IF;
    -- Syntax alone is NOT signature/permit verification. The future external
    -- Control must compare this reference to its independent deployment anchor.
    IF EXISTS (
        SELECT 1 FROM pg_catalog.pg_roles
         WHERE rolname = CURRENT_USER
           AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN
        RAISE EXCEPTION 'Publication principal is not bounded migration authority';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.com_resources
         WHERE key = 'ACTION.WORKFORCE_CONTROLLED_EXPORT' AND type <> 'ACTION') THEN
        RAISE EXCEPTION 'Controlled export resource type collision';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.sys_tenant_resource_templates
         WHERE resource_key = 'ACTION.WORKFORCE_CONTROLLED_EXPORT'
           AND (lifecycle_state <> 'RETIRED' OR resource_type <> 'ACTION'
                OR required_entitlement IS DISTINCT FROM 'core.people')) THEN
        RAISE EXCEPTION 'Unsafe/conflicting automatic resource factory template';
    END IF;
END
$publication_preflight$;

-- NO factory template is inserted or changed. ACTIVE syncResources re-enables
-- existing conflicts, and syncBuiltInRolePermissions DELETE checks template
-- existence without ACTIVE filtering. Even a new RETIRED template could cause
-- existing built-in explicit grants to disappear during a later reconciliation.
-- New-tenant handling requires a separately reviewed insert-only owner hook.

-- Missing resource: catalogue-visible but DISABLED. Existing TRUE and FALSE
-- remain byte-for-byte untouched. No grant or descriptor activation occurs.
-- APP.HCM / RS_HCM_CONFIG evidence scopes registration, never EXPORT authority.
INSERT INTO public.com_resources (tenant_id, type, key, name, enabled)
SELECT tenant.tenant_id, 'ACTION', 'ACTION.WORKFORCE_CONTROLLED_EXPORT',
       'Workforce controlled export', FALSE
  FROM public.com_tenants tenant
  JOIN public.com_resources hcm
    ON hcm.tenant_id = tenant.tenant_id AND hcm.type = 'APP'
   AND hcm.key = 'APP.HCM' AND hcm.enabled = TRUE
 WHERE tenant.status = 'ACTIVE'
   AND EXISTS (
       SELECT 1 FROM public.com_admin_resource_sets resource_set
       JOIN public.com_admin_resource_set_members root_member
         ON root_member.tenant_id = resource_set.tenant_id
        AND root_member.resource_set_id = resource_set.resource_set_id
        AND root_member.resource_type = 'APP' AND root_member.resource_key = 'APP.HCM'
        AND root_member.lifecycle_state = 'ACTIVE'
        WHERE resource_set.tenant_id = tenant.tenant_id
          AND resource_set.resource_set_key = 'RS_HCM_CONFIG'
          AND resource_set.resource_type = 'APP' AND resource_set.lifecycle_state = 'ACTIVE')
ON CONFLICT (tenant_id, type, key) DO NOTHING;

-- No INSERT/UPDATE/DELETE of any permissions, users/groups/roles/packages/duties,
-- product bundles/active pointers, eligibility, signing keys or artifact policy.
-- Full no-grant/no-activation snapshots must be compared outside this artifact.
COMMIT;
