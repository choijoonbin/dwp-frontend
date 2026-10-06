#!/usr/bin/env python3
"""Fail-closed validation of independently executable SYS service migrations."""

from __future__ import annotations

import argparse
import csv
import json
import re
import subprocess
import time
import uuid
from pathlib import Path


MODULE = Path(__file__).resolve().parent
ROOT = MODULE.parents[1]
CATALOG = MODULE / "g2-physical-schema.sql"
AUTH = MODULE / "g2-auth-physical-schema.sql"
PLATFORM = MODULE / "g2-platform-physical-schema.sql"
PREFIX_REGISTER = ROOT / "coding-readiness/physical-owner-prefix-register.csv"

AUTH_TABLES = {
    "sys_product_access_package_catalog",
    "sys_product_access_package_roles",
    "sys_product_access_package_conflicts",
    "com_product_access_package_assignments",
    "com_product_access_package_policy_refs",
    "com_product_access_package_projection_status",
    "com_product_access_command_receipts",
}
PLATFORM_TABLES = {
    "sys_hris_config_sets",
    "sys_hris_config_versions",
    "sys_hris_config_evaluations",
    "sys_automation_definitions",
    "sys_automation_versions",
    "sys_automation_schedules",
    "sys_automation_runs",
    "sys_automation_run_attempts",
    "sys_automation_run_items",
    "sys_automation_item_attempts",
    "sys_automation_run_checkpoints",
    "sys_connector_definitions",
    "sys_connector_mapping_versions",
    "sys_connector_executions",
    "sys_connector_execution_items",
    "sys_connector_execution_attempts",
    "sys_hris_home_contributions",
    "sys_hris_explorer_preferences",
    "sys_hris_explorer_favorites",
    "sys_hris_explorer_recents",
    "sys_controlled_file_transfers",
    "sys_operational_exception_projections",
    "sys_extension_pack_versions",
    "sys_tenant_extension_installations",
    "sys_hris_command_receipts",
}
EXPECTED_PREFIX_BINDINGS = {
    "PFX-SYS-AUTH-CATALOG": (
        "dwp-auth-server", "sys_product_access_", "BASE_SYS_AUTH_CATALOG"
    ),
    "PFX-SYS-AUTH-TENANT": (
        "dwp-auth-server", "com_product_access_", "BASE_SYS_AUTH_TENANT"
    ),
    "PFX-SYS-PLATFORM": (
        "dwp-platform-server", "sys_", "BASE_SYS_PLATFORM"
    ),
}

# These fragments are independent security invariants.  Table-count parity by
# itself cannot prove that the parent identity, lifecycle, or fail-closed
# controls survived a refactor.
AUTH_REQUIRED_CONTROLS = {
    "package-role-parent-fk": """
        CONSTRAINT fk_sys_product_access_package_role_package FOREIGN KEY (package_id)
            REFERENCES sys_product_access_package_catalog(package_id)
    """,
    "assignment-versioned-package-fk": """
        CONSTRAINT fk_com_product_access_assignment_package FOREIGN KEY (package_id, package_public_id, package_catalog_version)
            REFERENCES sys_product_access_package_catalog(package_id, public_id, catalog_version)
    """,
    "package-draft-entry-gate": "PRODUCT_ACCESS_PACKAGE_MUST_START_DRAFT",
    "package-four-eyes": "activated_by IS NULL OR activated_by <> created_by",
    "package-role-draft-only": "PRODUCT_ACCESS_PACKAGE_ROLE_DRAFT_ONLY",
    "package-role-lifecycle-trigger": """
        BEFORE INSERT OR UPDATE OR DELETE ON sys_product_access_package_roles
    """,
    "conflict-draft-entry-gate": "PRODUCT_ACCESS_CONFLICT_MUST_START_DRAFT",
    "conflict-active-definition-seal": "PRODUCT_ACCESS_CONFLICT_ACTIVE_DEFINITION_IMMUTABLE",
    "conflict-lifecycle-trigger": """
        BEFORE INSERT OR UPDATE OR DELETE ON sys_product_access_package_conflicts
    """,
    "assignment-draft-entry-gate": "PRODUCT_ACCESS_ASSIGNMENT_MUST_START_DRAFT",
    "assignment-projection-closure": "PRODUCT_ACCESS_PROJECTION_CLOSURE_INCOMPLETE",
    "active-projection-fail-closed": "ACTIVE_PRODUCT_ACCESS_PROJECTION_MUST_REMAIN_APPLIED",
    "active-projection-set-seal": "ACTIVE_PRODUCT_ACCESS_PROJECTION_SET_IMMUTABLE",
    "projection-insert-lifecycle-trigger": """
        BEFORE INSERT OR UPDATE OR DELETE ON com_product_access_package_projection_status
    """,
    "package-insert-lifecycle-trigger": """
        BEFORE INSERT OR UPDATE OR DELETE ON sys_product_access_package_catalog
    """,
    "assignment-insert-lifecycle-trigger": """
        BEFORE INSERT OR UPDATE OR DELETE ON com_product_access_package_assignments
    """,
    "assignment-approval-time-evidence": "approved_by IS NOT NULL AND approved_at IS NOT NULL",
    "assignment-activation-time-evidence": "activated_by IS NOT NULL AND activated_at IS NOT NULL",
    "assignment-revocation-time-evidence": "revoked_by IS NOT NULL AND revoked_at IS NOT NULL",
}

PLATFORM_REQUIRED_CONTROLS = {
    "config-approval-evidence": """
        lifecycle_state NOT IN ('APPROVED','SCHEDULED','PUBLISHED','RETIRED')
        OR (approved_by IS NOT NULL AND approval_public_id IS NOT NULL)
    """,
    "config-delete-seal": "SYS_CONFIG_PUBLISHED_VERSION_CANNOT_BE_DELETED",
    "config-payload-seal": "NEW.payload IS DISTINCT FROM OLD.payload",
    "config-state-monotonic": "SYS_CONFIG_PUBLISHED_STATE_REWIND",
    "automation-attempt-parent-key": """
        CONSTRAINT uq_sys_automation_run_attempt_parent UNIQUE (tenant_id, run_id, attempt_id)
    """,
    "automation-item-parent-key": """
        CONSTRAINT uq_sys_automation_run_item_parent UNIQUE (tenant_id, run_id, run_item_id)
    """,
    "automation-attempt-run-fk": """
        CONSTRAINT fk_sys_automation_item_attempt_attempt FOREIGN KEY (tenant_id, run_id, attempt_id)
            REFERENCES sys_automation_run_attempts(tenant_id, run_id, attempt_id)
    """,
    "automation-item-run-fk": """
        CONSTRAINT fk_sys_automation_item_attempt_item FOREIGN KEY (tenant_id, run_id, run_item_id)
            REFERENCES sys_automation_run_items(tenant_id, run_id, run_item_id)
    """,
    "automation-checkpoint-run-fk": """
        CONSTRAINT fk_sys_automation_checkpoint_attempt FOREIGN KEY (tenant_id, run_id, attempt_id)
            REFERENCES sys_automation_run_attempts(tenant_id, run_id, attempt_id)
    """,
    "connector-mapping-parent-key": """
        CONSTRAINT uq_sys_connector_mapping_parent UNIQUE (tenant_id, connector_id, mapping_version_id)
    """,
    "connector-execution-mapping-fk": """
        CONSTRAINT fk_sys_connector_execution_mapping FOREIGN KEY (tenant_id, connector_id, mapping_version_id)
            REFERENCES sys_connector_mapping_versions(tenant_id, connector_id, mapping_version_id)
    """,
    "connector-item-parent-key": """
        CONSTRAINT uq_sys_connector_execution_item_parent UNIQUE (tenant_id, execution_id, execution_item_id)
    """,
    "connector-attempt-item-fk": """
        CONSTRAINT fk_sys_connector_execution_attempt_item FOREIGN KEY (tenant_id, execution_id, execution_item_id)
            REFERENCES sys_connector_execution_items(tenant_id, execution_id, execution_item_id)
    """,
    "extension-draft-entry-gate": "SYS_EXTENSION_PACK_MUST_START_DISCOVERED",
    "installation-request-entry-gate": "SYS_TENANT_EXTENSION_MUST_START_REQUESTED",
    "extension-revocation-cascade": "sys_cascade_extension_pack_revocation",
    "extension-cascade-fixed-search-path": "LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public",
    "extension-revocation-monotonic": "SYS_EXTENSION_PACK_REVOCATION_MONOTONIC",
    "installation-revocation-monotonic": "SYS_TENANT_EXTENSION_REVOCATION_MONOTONIC",
}


def normalize(sql: str) -> str:
    return re.sub(r"\s+", " ", sql).strip()


def validate_required_controls(
    label: str,
    sql: str,
    controls: dict[str, str],
    errors: list[str],
) -> int:
    normalized_sql = normalize(sql)
    for control, fragment in controls.items():
        if normalize(fragment) not in normalized_sql:
            errors.append(f"{label}: required security control missing: {control}")
    return len(controls)


def table_blocks(sql: str) -> dict[str, str]:
    matches = re.finditer(
        r"CREATE\s+TABLE\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*?)\n\);",
        sql,
        re.IGNORECASE | re.DOTALL,
    )
    return {match.group(1): normalize(match.group(0)) for match in matches}


def index_blocks(sql: str) -> dict[str, tuple[str, str]]:
    matches = re.finditer(
        r"CREATE\s+(?:UNIQUE\s+)?INDEX\s+([a-zA-Z_][a-zA-Z0-9_]*)"
        r"\s+ON\s+([a-zA-Z_][a-zA-Z0-9_]*)(.*?);",
        sql,
        re.IGNORECASE | re.DOTALL,
    )
    return {
        match.group(1): (match.group(2), normalize(match.group(0)))
        for match in matches
    }


def function_blocks(sql: str) -> dict[str, str]:
    blocks: dict[str, str] = {}
    for match in re.finditer(
        r"CREATE\s+OR\s+REPLACE\s+FUNCTION\s+([a-zA-Z_][a-zA-Z0-9_]*)",
        sql,
        re.IGNORECASE,
    ):
        opening = sql.find("$$", match.end())
        closing = sql.find("$$", opening + 2) if opening >= 0 else -1
        terminator = sql.find(";", closing + 2) if closing >= 0 else -1
        if min(opening, closing, terminator) < 0:
            continue
        blocks[match.group(1)] = normalize(sql[match.start():terminator + 1])
    return blocks


def trigger_blocks(sql: str) -> dict[str, str]:
    return {
        match.group(1): normalize(match.group(0))
        for match in re.finditer(
            r"CREATE\s+TRIGGER\s+([a-zA-Z_][a-zA-Z0-9_]*).*?;",
            sql,
            re.IGNORECASE | re.DOTALL,
        )
    }


def references(sql: str) -> set[str]:
    return set(
        re.findall(
            r"\bREFERENCES\s+(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?"
            r"([a-zA-Z_][a-zA-Z0-9_]*)\s*\(",
            sql,
            re.IGNORECASE,
        )
    )


def tenant_tables(blocks: dict[str, str]) -> set[str]:
    return {
        name
        for name, block in blocks.items()
        if re.search(r"\btenant_id\b", block, re.IGNORECASE)
    }


def rls_tables(sql: str) -> set[str]:
    match = re.search(
        r"FOREACH\s+target_table\s+IN\s+ARRAY\s+ARRAY\[(.*?)\]\s+LOOP",
        sql,
        re.IGNORECASE | re.DOTALL,
    )
    if not match:
        return set()
    return set(re.findall(r"'([a-zA-Z_][a-zA-Z0-9_]*)'", match.group(1)))


def read_prefix_rows() -> dict[str, dict[str, str]]:
    with PREFIX_REGISTER.open(newline="", encoding="utf-8") as handle:
        return {
            row["binding_id"]: row
            for row in csv.DictReader(handle)
            if row.get("session") == "HRIS-SYS"
        }


def validate_prefix_contract(errors: list[str]) -> int:
    rows = read_prefix_rows()
    checks = 1
    for binding_id, (owner, prefix, scope) in EXPECTED_PREFIX_BINDINGS.items():
        checks += 5
        row = rows.get(binding_id)
        if row is None:
            errors.append(f"missing physical prefix binding {binding_id}")
            continue
        if row.get("owner_service") != owner:
            errors.append(f"{binding_id}: owner must be {owner}")
        if prefix not in row.get("allowed_prefixes", "").split("|"):
            errors.append(f"{binding_id}: required prefix {prefix} missing")
        if scope not in row.get("table_source_scope", "").split("|"):
            errors.append(f"{binding_id}: source scope {scope} missing")
        if row.get("status") != "READY_FOR_G3_CODE":
            errors.append(f"{binding_id}: prefix contract is not ready")
        if "PORT" not in row.get("cross_boundary_rule", ""):
            errors.append(f"{binding_id}: cross-boundary port/event rule missing")
    return checks


def validate_sql(
    catalog_sql: str,
    auth_sql: str,
    platform_sql: str,
    *,
    check_prefix_register: bool = True,
) -> tuple[list[str], int, dict[str, int]]:
    errors: list[str] = []
    checks = 0
    catalog_tables = table_blocks(catalog_sql)
    auth_tables = table_blocks(auth_sql)
    platform_tables = table_blocks(platform_sql)
    catalog_indexes = index_blocks(catalog_sql)
    auth_indexes = index_blocks(auth_sql)
    platform_indexes = index_blocks(platform_sql)
    catalog_functions = function_blocks(catalog_sql)
    auth_functions = function_blocks(auth_sql)
    platform_functions = function_blocks(platform_sql)
    catalog_triggers = trigger_blocks(catalog_sql)
    auth_triggers = trigger_blocks(auth_sql)
    platform_triggers = trigger_blocks(platform_sql)

    checks += 6
    if set(catalog_tables) != AUTH_TABLES | PLATFORM_TABLES:
        errors.append("catalog table set drift")
    if set(auth_tables) != AUTH_TABLES:
        errors.append("Auth migration table set is not exact")
    if set(platform_tables) != PLATFORM_TABLES:
        errors.append("Platform migration table set is not exact")
    if set(auth_tables) & set(platform_tables):
        errors.append("a physical table is owned by both service migrations")
    if set(auth_tables) | set(platform_tables) != set(catalog_tables):
        errors.append("service migration table union does not close the catalog")
    if not AUTH_TABLES.isdisjoint(PLATFORM_TABLES):
        errors.append("validator owner sets overlap")

    for service, split_tables in (
        ("Auth", auth_tables),
        ("Platform", platform_tables),
    ):
        for name, block in split_tables.items():
            checks += 1
            if catalog_tables.get(name) != block:
                errors.append(f"{service}/{name}: table DDL differs from catalog")

    checks += 3
    if set(auth_indexes) & set(platform_indexes):
        errors.append("an index is owned by both service migrations")
    if set(auth_indexes) | set(platform_indexes) != set(catalog_indexes):
        errors.append("service migration index union does not close the catalog")
    for name, (_, statement) in {**auth_indexes, **platform_indexes}.items():
        checks += 2
        catalog_index = catalog_indexes.get(name)
        if catalog_index is None or catalog_index[1] != statement:
            errors.append(f"{name}: index DDL differs from catalog")
        target = ({**auth_tables, **platform_tables})
        owner_tables = auth_tables if name in auth_indexes else platform_tables
        if ({**auth_indexes, **platform_indexes})[name][0] not in owner_tables:
            errors.append(f"{name}: index targets a foreign-service table")

    for kind, catalog_blocks, auth_blocks, platform_blocks in (
        ("function", catalog_functions, auth_functions, platform_functions),
        ("trigger", catalog_triggers, auth_triggers, platform_triggers),
    ):
        checks += 3
        if set(auth_blocks) & set(platform_blocks):
            errors.append(f"a {kind} is owned by both service migrations")
        if set(auth_blocks) | set(platform_blocks) != set(catalog_blocks):
            errors.append(f"service migration {kind} union does not close the catalog")
        for name, statement in {**auth_blocks, **platform_blocks}.items():
            checks += 1
            if catalog_blocks.get(name) != statement:
                errors.append(f"{name}: {kind} DDL differs from catalog")

    for service, sql, blocks, expected_owner_marker in (
        ("Auth", auth_sql, auth_tables, "execute only in the dwp-auth-server database"),
        ("Platform", platform_sql, platform_tables, "execute only in the dwp-platform-server database"),
    ):
        own = set(blocks)
        refs = references(sql)
        rls = rls_tables(sql)
        tenant = tenant_tables(blocks)
        checks += 12
        if refs - own:
            errors.append(
                f"{service}: cross-service or unresolved database FK: {sorted(refs - own)}"
            )
        if rls != tenant:
            errors.append(
                f"{service}: RLS table set mismatch expected={sorted(tenant)} actual={sorted(rls)}"
            )
        if sql.count("BEGIN;") != 1 or sql.count("COMMIT;") != 1:
            errors.append(f"{service}: migration is not one explicit transaction")
        if expected_owner_marker not in sql:
            errors.append(f"{service}: executable service boundary marker missing")
        if "dwp.tenant_id" not in sql:
            errors.append(f"{service}: tenant context policy missing")
        if "ENABLE ROW LEVEL SECURITY" not in sql:
            errors.append(f"{service}: ENABLE RLS missing")
        if "FORCE ROW LEVEL SECURITY" not in sql:
            errors.append(f"{service}: FORCE RLS missing")
        if "NOBYPASSRLS" not in sql:
            errors.append(f"{service}: runtime role boundary missing")
        if re.search(r"\b(?:DROP\s+TABLE|TRUNCATE|DELETE\s+FROM)\b", sql, re.IGNORECASE):
            errors.append(f"{service}: destructive SQL found")
        if re.search(r"\\(?:i|include)\b", sql, re.IGNORECASE):
            errors.append(f"{service}: migration depends on a psql include")
        if re.search(r"\b(?:dblink|postgres_fdw|IMPORT\s+FOREIGN\s+SCHEMA)\b", sql, re.IGNORECASE):
            errors.append(f"{service}: cross-database access construct found")
        if sql.count("CREATE POLICY %I") != 1:
            errors.append(f"{service}: canonical tenant policy loop must occur exactly once")

    checks += len(AUTH_TABLES) + len(PLATFORM_TABLES) + 3
    if any(
        not (
            name.startswith("sys_product_access_")
            or name.startswith("com_product_access_")
        )
        for name in auth_tables
    ):
        errors.append("Auth table violates its exact physical prefixes")
    if any(
        not name.startswith("sys_")
        or name.startswith("sys_product_access_")
        or name.startswith("com_product_access_")
        for name in platform_tables
    ):
        errors.append("Platform table violates its exact physical prefix/exclusion")
    if (
        "dwp-platform-server database" in auth_sql
        or "dwp-auth-server database" in platform_sql
    ):
        errors.append("service migration contains the other service boundary")

    checks += validate_required_controls(
        "Auth", auth_sql, AUTH_REQUIRED_CONTROLS, errors
    )
    checks += validate_required_controls(
        "Platform", platform_sql, PLATFORM_REQUIRED_CONTROLS, errors
    )
    checks += validate_required_controls(
        "catalog/Auth", catalog_sql, AUTH_REQUIRED_CONTROLS, errors
    )
    checks += validate_required_controls(
        "catalog/Platform", catalog_sql, PLATFORM_REQUIRED_CONTROLS, errors
    )

    if check_prefix_register:
        checks += validate_prefix_contract(errors)

    details = {
        "catalogTables": len(catalog_tables),
        "authTables": len(auth_tables),
        "platformTables": len(platform_tables),
        "authTenantTables": len(tenant_tables(auth_tables)),
        "platformTenantTables": len(tenant_tables(platform_tables)),
        "indexes": len(catalog_indexes),
        "functions": len(catalog_functions),
        "triggers": len(catalog_triggers),
        "foreignKeys": len(references(auth_sql)) + len(references(platform_sql)),
    }
    return errors, checks, details


def run_command(command: list[str], *, timeout: int = 60) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        capture_output=True,
        check=False,
        text=True,
        timeout=timeout,
    )


def run_sql(container: str, database: str, sql: str) -> subprocess.CompletedProcess[str]:
    return run_command(
        [
            "docker", "exec", container, "psql", "-X", "-v", "ON_ERROR_STOP=1",
            "-At", "-U", "postgres", "-d", database, "-c", sql,
        ],
        timeout=30,
    )


def validate_auth_behaviors(
    container: str,
    database: str,
) -> tuple[list[str], list[dict[str, str]]]:
    errors: list[str] = []
    cases: list[dict[str, str]] = []

    def probe(name: str, sql: str, *, succeeds: bool, marker: str = "") -> None:
        result = run_sql(container, database, sql)
        output = (result.stderr or result.stdout).strip()
        passed = result.returncode == 0 if succeeds else (
            result.returncode != 0 and (not marker or marker in output)
        )
        cases.append({"name": name, "status": "PASS" if passed else "FAIL"})
        if not passed:
            errors.append(f"auth behavior {name} failed: {output[-1200:]}")

    package_id = "10000000-0000-0000-0000-000000000001"
    actor_a = "10000000-0000-0000-0000-000000000011"
    actor_b = "10000000-0000-0000-0000-000000000012"
    assignment_id = "10000000-0000-0000-0000-000000000031"
    principal_id = "10000000-0000-0000-0000-000000000021"
    probe(
        "direct-active-package-rejected",
        "INSERT INTO sys_product_access_package_catalog "
        "(public_id,product_key,package_code,catalog_version,lifecycle_state,risk_level,"
        "app_resource_key,display_name_key,description_key,definition_digest,created_by,"
        "activated_by,activated_at) VALUES "
        f"('10000000-0000-0000-0000-000000000002','HRIS','INVALID-ACTIVE',1,'ACTIVE','LOW',"
        f"'app.hris','name','description',repeat('a',64),'{actor_a}','{actor_a}',CURRENT_TIMESTAMP);",
        succeeds=False,
        marker="PRODUCT_ACCESS_PACKAGE_MUST_START_DRAFT",
    )
    probe(
        "draft-package-created",
        "INSERT INTO sys_product_access_package_catalog "
        "(public_id,product_key,package_code,catalog_version,lifecycle_state,risk_level,"
        "app_resource_key,display_name_key,description_key,definition_digest,created_by) VALUES "
        f"('{package_id}','HRIS','EMPLOYEE',1,'DRAFT','LOW','app.hris','name','description',"
        f"repeat('b',64),'{actor_a}');",
        succeeds=True,
    )
    probe(
        "same-actor-package-activation-rejected",
        "INSERT INTO sys_product_access_package_catalog "
        "(public_id,product_key,package_code,catalog_version,lifecycle_state,risk_level,"
        "app_resource_key,display_name_key,description_key,definition_digest,created_by) VALUES "
        f"('10000000-0000-0000-0000-000000000003','HRIS','INVALID-FOUR-EYES',1,'DRAFT','LOW',"
        f"'app.hris','name','description',repeat('f',64),'{actor_a}');"
        "UPDATE sys_product_access_package_catalog SET lifecycle_state='ACTIVE',"
        f"activated_by='{actor_a}',activated_at=CURRENT_TIMESTAMP WHERE public_id="
        "'10000000-0000-0000-0000-000000000003';",
        succeeds=False,
        marker="ck_sys_product_access_package_four_eyes",
    )
    probe(
        "orphan-package-role-rejected",
        "INSERT INTO sys_product_access_package_roles(package_id,role_code,ordinal) "
        "VALUES (999999,'hris.role.invalid',0);",
        succeeds=False,
        marker="fk_sys_product_access_package_role_package",
    )
    probe(
        "direct-active-assignment-rejected",
        "INSERT INTO com_product_access_package_assignments "
        "(public_id,tenant_id,package_id,package_public_id,package_catalog_version,"
        "principal_type,principal_public_id,scope_fingerprint,valid_from,lifecycle_state,"
        "justification,source_kind,authored_by,approved_by,approved_at,activated_by,activated_at) "
        f"SELECT '10000000-0000-0000-0000-000000000032',1,package_id,'{package_id}',1,"
        f"'USER','{principal_id}',repeat('c',64),CURRENT_TIMESTAMP,'ACTIVE','test','DIRECT',"
        f"'{actor_a}','{actor_b}',CURRENT_TIMESTAMP,'{actor_a}',CURRENT_TIMESTAMP "
        "FROM sys_product_access_package_catalog WHERE public_id="
        f"'{package_id}';",
        succeeds=False,
        marker="PRODUCT_ACCESS_ASSIGNMENT_MUST_START_DRAFT",
    )
    probe(
        "assignment-prepared-for-projection",
        "INSERT INTO sys_product_access_package_roles(package_id,role_code,ordinal) "
        f"SELECT package_id,'hris.role.employee',0 FROM sys_product_access_package_catalog WHERE public_id='{package_id}';"
        "UPDATE sys_product_access_package_catalog SET lifecycle_state='ACTIVE',"
        f"activated_by='{actor_b}',activated_at=CURRENT_TIMESTAMP,version=version+1 "
        f"WHERE public_id='{package_id}';"
        "INSERT INTO com_product_access_package_assignments "
        "(public_id,tenant_id,package_id,package_public_id,package_catalog_version,"
        "principal_type,principal_public_id,scope_fingerprint,valid_from,lifecycle_state,"
        "justification,source_kind,authored_by) "
        f"SELECT '{assignment_id}',1,package_id,'{package_id}',1,'USER','{principal_id}',"
        f"repeat('d',64),CURRENT_TIMESTAMP,'DRAFT','test','DIRECT','{actor_a}' "
        f"FROM sys_product_access_package_catalog WHERE public_id='{package_id}';"
        f"UPDATE com_product_access_package_assignments SET lifecycle_state='PENDING_APPROVAL',version=version+1 WHERE public_id='{assignment_id}';"
        f"UPDATE com_product_access_package_assignments SET lifecycle_state='APPROVED',approved_by='{actor_b}',approved_at=CURRENT_TIMESTAMP,version=version+1 WHERE public_id='{assignment_id}';"
        f"UPDATE com_product_access_package_assignments SET lifecycle_state='PENDING_PROJECTION',version=version+1 WHERE public_id='{assignment_id}';",
        succeeds=True,
    )
    probe(
        "active-package-role-insert-rejected",
        "INSERT INTO sys_product_access_package_roles(package_id,role_code,ordinal) "
        f"SELECT package_id,'hris.role.escalated',1 FROM sys_product_access_package_catalog WHERE public_id='{package_id}';",
        succeeds=False,
        marker="PRODUCT_ACCESS_PACKAGE_ROLE_DRAFT_ONLY",
    )
    probe(
        "direct-active-conflict-rejected",
        "INSERT INTO sys_product_access_package_conflicts "
        "(product_key,rule_code,rule_version,left_subject_type,left_subject_code,right_subject_type,"
        "right_subject_code,scope_dimensions,enforcement_mode,lifecycle_state,definition_digest,"
        "created_by,activated_by,activated_at) VALUES "
        f"('HRIS','INVALID-DIRECT-ACTIVE',1,'ROLE','left','DUTY','right','tenant','BLOCK','ACTIVE',"
        f"repeat('1',64),'{actor_a}','{actor_b}',CURRENT_TIMESTAMP);",
        succeeds=False,
        marker="PRODUCT_ACCESS_CONFLICT_MUST_START_DRAFT",
    )
    probe(
        "active-conflict-created",
        "INSERT INTO sys_product_access_package_conflicts "
        "(product_key,rule_code,rule_version,left_subject_type,left_subject_code,right_subject_type,"
        "right_subject_code,scope_dimensions,enforcement_mode,lifecycle_state,definition_digest,created_by) VALUES "
        f"('HRIS','PAYROLL-MAKER-CHECKER',1,'ROLE','maker','ROLE','checker','tenant','BLOCK','DRAFT',repeat('2',64),'{actor_a}');"
        "UPDATE sys_product_access_package_conflicts SET lifecycle_state='ACTIVE',"
        f"activated_by='{actor_b}',activated_at=CURRENT_TIMESTAMP,version=version+1 "
        "WHERE product_key='HRIS' AND rule_code='PAYROLL-MAKER-CHECKER';",
        succeeds=True,
    )
    probe(
        "active-conflict-rewrite-rejected",
        "UPDATE sys_product_access_package_conflicts SET enforcement_mode='WARN',version=version+1 "
        "WHERE product_key='HRIS' AND rule_code='PAYROLL-MAKER-CHECKER';",
        succeeds=False,
        marker="PRODUCT_ACCESS_CONFLICT_ACTIVE_DEFINITION_IMMUTABLE",
    )
    probe(
        "activation-without-projection-rejected",
        "UPDATE com_product_access_package_assignments SET lifecycle_state='ACTIVE',"
        f"activated_by='{actor_a}',activated_at=CURRENT_TIMESTAMP,version=version+1 WHERE public_id='{assignment_id}';",
        succeeds=False,
        marker="PRODUCT_ACCESS_PROJECTION_CLOSURE_INCOMPLETE",
    )
    probe(
        "five-projection-closure-activates",
        "INSERT INTO com_product_access_package_projection_status "
        "(tenant_id,assignment_id,projection_owner,projection_kind,expected_revision,"
        "applied_revision,state,receipt_public_id,applied_at) "
        "SELECT 1,assignment_id,'dwp-auth-server',kind,1,1,'APPLIED',gen_random_uuid(),CURRENT_TIMESTAMP "
        "FROM com_product_access_package_assignments CROSS JOIN (VALUES "
        "('APP_GRANT'),('ATOMIC_ROLES'),('SCOPE_POLICY'),('FIELD_POLICY'),('CACHE_REVISION')) AS kinds(kind) "
        f"WHERE public_id='{assignment_id}';"
        "UPDATE com_product_access_package_assignments SET lifecycle_state='ACTIVE',"
        f"activated_by='{actor_a}',activated_at=CURRENT_TIMESTAMP,version=version+1 WHERE public_id='{assignment_id}';",
        succeeds=True,
    )
    probe(
        "active-projection-drift-rejected",
        "UPDATE com_product_access_package_projection_status SET state='DRIFTED',version=version+1 "
        "WHERE projection_kind='APP_GRANT';",
        succeeds=False,
        marker="ACTIVE_PRODUCT_ACCESS_PROJECTION_MUST_REMAIN_APPLIED",
    )
    probe(
        "active-projection-evidence-rewrite-rejected",
        "UPDATE com_product_access_package_projection_status "
        "SET expected_revision=2,applied_revision=2,receipt_public_id=gen_random_uuid(),"
        "applied_at=CURRENT_TIMESTAMP,version=version+1 WHERE projection_kind='APP_GRANT';",
        succeeds=False,
        marker="ACTIVE_PRODUCT_ACCESS_PROJECTION_MUST_REMAIN_APPLIED",
    )
    probe(
        "active-projection-set-insert-rejected",
        "INSERT INTO com_product_access_package_projection_status "
        "(tenant_id,assignment_id,projection_owner,projection_kind,expected_revision,"
        "applied_revision,state,receipt_public_id,applied_at) "
        "SELECT 1,assignment_id,'rogue-owner','APP_GRANT',1,1,'APPLIED',gen_random_uuid(),CURRENT_TIMESTAMP "
        f"FROM com_product_access_package_assignments WHERE public_id='{assignment_id}';",
        succeeds=False,
        marker="ACTIVE_PRODUCT_ACCESS_PROJECTION_SET_IMMUTABLE",
    )
    return errors, cases


def validate_platform_behaviors(
    container: str,
    database: str,
) -> tuple[list[str], list[dict[str, str]]]:
    errors: list[str] = []
    cases: list[dict[str, str]] = []

    def probe(name: str, sql: str, *, succeeds: bool, marker: str = "") -> None:
        result = run_sql(container, database, sql)
        output = (result.stderr or result.stdout).strip()
        passed = result.returncode == 0 if succeeds else (
            result.returncode != 0 and (not marker or marker in output)
        )
        cases.append({"name": name, "status": "PASS" if passed else "FAIL"})
        if not passed:
            errors.append(f"platform behavior {name} failed: {output[-1200:]}")

    actor_a = "20000000-0000-0000-0000-000000000011"
    actor_b = "20000000-0000-0000-0000-000000000012"
    pack_public_id = "20000000-0000-0000-0000-000000000021"
    probe(
        "direct-approved-extension-pack-rejected",
        "INSERT INTO sys_extension_pack_versions "
        "(public_id,extension_key,version,pack_kind,manifest,manifest_digest,signature_key_id,"
        "signature,signature_digest,compatibility_range,compatibility_digest,hook_allowlist_digest,"
        "schema_digest,license_digest,permission_manifest_digest,lifecycle_state,discovered_by,"
        "verified_by,verified_at,verification_evidence_digest,approved_by,approved_at,approval_receipt_public_id) VALUES "
        f"('20000000-0000-0000-0000-000000000022','invalid','1','COUNTRY','{{}}',repeat('a',64),"
        f"'key','sig',repeat('b',64),'*',repeat('c',64),repeat('d',64),repeat('e',64),repeat('f',64),repeat('0',64),"
        f"'APPROVED','{actor_a}','{actor_a}',CURRENT_TIMESTAMP,repeat('1',64),'{actor_b}',CURRENT_TIMESTAMP,gen_random_uuid());",
        succeeds=False,
        marker="SYS_EXTENSION_PACK_MUST_START_DISCOVERED",
    )
    probe(
        "published-config-created",
        "INSERT INTO sys_hris_config_sets "
        "(tenant_id,config_domain,config_key,lifecycle_state,created_by) "
        f"VALUES (1,'TIME','work-rule','ACTIVE','{actor_a}');"
        "INSERT INTO sys_hris_config_versions "
        "(tenant_id,config_set_id,version_number,lifecycle_state,schema_key,schema_version,payload,"
        "payload_digest,effective_from,authored_by,approved_by,approval_public_id) "
        f"SELECT 1,config_set_id,1,'PUBLISHED','TimeRule.v1',1,'{{\"mode\":\"standard\"}}',"
        f"repeat('2',64),CURRENT_TIMESTAMP,'{actor_a}','{actor_b}',gen_random_uuid() "
        "FROM sys_hris_config_sets WHERE tenant_id=1 AND config_key='work-rule';",
        succeeds=True,
    )
    probe(
        "published-config-payload-rewrite-rejected",
        "UPDATE sys_hris_config_versions SET payload='{\"mode\":\"tampered\"}' WHERE tenant_id=1;",
        succeeds=False,
        marker="SYS_CONFIG_PUBLISHED_LINEAGE_IMMUTABLE",
    )
    probe(
        "published-config-delete-rejected",
        "DELETE FROM sys_hris_config_versions WHERE tenant_id=1;",
        succeeds=False,
        marker="SYS_CONFIG_PUBLISHED_VERSION_CANNOT_BE_DELETED",
    )
    probe(
        "revoked-pack-cascades-to-requested-installation",
        "INSERT INTO sys_extension_pack_versions "
        "(public_id,extension_key,version,pack_kind,manifest,manifest_digest,signature_key_id,"
        "signature,signature_digest,compatibility_range,compatibility_digest,hook_allowlist_digest,"
        "schema_digest,license_digest,permission_manifest_digest,lifecycle_state,discovered_by) VALUES "
        f"('{pack_public_id}','kr-payroll','1','COUNTRY','{{}}',repeat('3',64),'key','sig',"
        f"repeat('4',64),'*',repeat('5',64),repeat('6',64),repeat('7',64),repeat('8',64),repeat('9',64),'DISCOVERED','{actor_a}');"
        "INSERT INTO sys_tenant_extension_installations "
        "(tenant_id,extension_version_id,state,config_ref,config_digest,manifest_digest,signature_digest,"
        "compatibility_digest,approval_workflow_key,request_digest,requested_by) "
        "SELECT 1,extension_version_id,'REQUESTED','config://test',repeat('a',64),manifest_digest,"
        f"signature_digest,compatibility_digest,'approval.hris',repeat('b',64),'{actor_a}' "
        f"FROM sys_extension_pack_versions WHERE public_id='{pack_public_id}';"
        "UPDATE sys_extension_pack_versions SET lifecycle_state='REVOKED',"
        f"revoked_by='{actor_b}',revoked_at=CURRENT_TIMESTAMP,revocation_reason_code='SECURITY' "
        f"WHERE public_id='{pack_public_id}';",
        succeeds=True,
    )
    probe(
        "installation-is-revoked",
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM sys_tenant_extension_installations "
        "WHERE tenant_id=1 AND state='REVOKED' AND revoked_by IS NOT NULL AND revoked_at IS NOT NULL) "
        "THEN RAISE EXCEPTION 'INSTALLATION_NOT_REVOKED'; END IF; END $$;",
        succeeds=True,
    )
    return errors, cases


def validate_with_docker() -> tuple[list[str], dict[str, object]]:
    errors: list[str] = []
    container = "dwp-hris-sys-ddl-" + uuid.uuid4().hex[:10]
    mount = f"{MODULE}:/ddl:ro"
    started = run_command(
        [
            "docker", "run", "--rm", "-d", "--name", container,
            "-e", "POSTGRES_PASSWORD=dwp_test_only", "-v", mount,
            "postgres:16-alpine",
        ],
        timeout=60,
    )
    if started.returncode != 0:
        return [f"docker PostgreSQL start failed: {started.stderr.strip()}"], {
            "executed": False
        }
    try:
        ready = False
        for _ in range(40):
            probe = run_command(
                ["docker", "exec", container, "pg_isready", "-U", "postgres"],
                timeout=5,
            )
            if probe.returncode == 0:
                ready = True
                break
            time.sleep(0.25)
        if not ready:
            errors.append("docker PostgreSQL did not become ready")
            return errors, {"executed": False}

        results: dict[str, object] = {"executed": True, "image": "postgres:16-alpine"}
        for key, database, filename, expected_tables, expected_rls in (
            ("auth", "authdb", AUTH.name, len(AUTH_TABLES), 4),
            ("platform", "platformdb", PLATFORM.name, len(PLATFORM_TABLES), 24),
        ):
            create = run_command(
                ["docker", "exec", container, "createdb", "-U", "postgres", database]
            )
            if create.returncode != 0:
                errors.append(f"{key}: database create failed: {create.stderr.strip()}")
                continue
            execute = run_command(
                [
                    "docker", "exec", container, "psql", "-v", "ON_ERROR_STOP=1",
                    "-U", "postgres", "-d", database, "-f", f"/ddl/{filename}",
                ]
            )
            if execute.returncode != 0:
                errors.append(f"{key}: DDL execution failed: {execute.stderr.strip()}")
                continue
            query = (
                "SELECT "
                "(SELECT count(*) FROM pg_tables WHERE schemaname='public'),"
                "(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace "
                " WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity),"
                "(SELECT count(*) FROM pg_policies WHERE schemaname='public');"
            )
            inspect = run_command(
                [
                    "docker", "exec", container, "psql", "-At", "-U", "postgres",
                    "-d", database, "-c", query,
                ]
            )
            if inspect.returncode != 0:
                errors.append(f"{key}: catalog inspection failed: {inspect.stderr.strip()}")
                continue
            values = [int(value) for value in inspect.stdout.strip().split("|")]
            results[key] = {
                "tables": values[0],
                "forcedRlsTables": values[1],
                "tenantPolicies": values[2],
            }
            if values != [expected_tables, expected_rls, expected_rls]:
                errors.append(
                    f"{key}: PostgreSQL catalog counts drift expected="
                    f"{[expected_tables, expected_rls, expected_rls]} actual={values}"
                )
        behavior_cases: list[dict[str, str]] = []
        if not errors:
            auth_errors, auth_cases = validate_auth_behaviors(container, "authdb")
            platform_errors, platform_cases = validate_platform_behaviors(
                container, "platformdb"
            )
            errors.extend(auth_errors)
            errors.extend(platform_errors)
            behavior_cases.extend(
                {**case, "database": "authdb"} for case in auth_cases
            )
            behavior_cases.extend(
                {**case, "database": "platformdb"} for case in platform_cases
            )
        results["behaviorChecks"] = len(behavior_cases)
        results["behavioralTests"] = behavior_cases
        return errors, results
    finally:
        run_command(["docker", "rm", "-f", container], timeout=15)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--docker-postgres", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()

    required = [CATALOG, AUTH, PLATFORM, PREFIX_REGISTER]
    missing = [str(path) for path in required if not path.is_file()]
    if missing:
        print(json.dumps({"status": "FAIL", "errors": [f"missing: {path}" for path in missing]}))
        return 1

    catalog_sql = CATALOG.read_text(encoding="utf-8")
    auth_sql = AUTH.read_text(encoding="utf-8")
    platform_sql = PLATFORM.read_text(encoding="utf-8")
    errors, checks, details = validate_sql(catalog_sql, auth_sql, platform_sql)

    self_tests = 0
    if args.self_test and not errors:
        mutations = [
            (
                "auth-owner-table-injection",
                catalog_sql,
                auth_sql.replace(
                    "COMMIT;",
                    "CREATE TABLE sys_hris_config_sets (\n"
                    "    tenant_id BIGINT NOT NULL\n"
                    ");\nCOMMIT;",
                ),
                platform_sql,
            ),
            (
                "auth-cross-service-fk",
                catalog_sql,
                auth_sql.replace(
                    "REFERENCES sys_product_access_package_catalog(package_id)",
                    "REFERENCES sys_hris_config_sets(config_set_id)",
                    1,
                ),
                platform_sql,
            ),
            (
                "platform-rls-coverage-gap",
                catalog_sql,
                auth_sql,
                platform_sql.replace("    'sys_hris_config_sets',\n", "", 1),
            ),
            (
                "auth-table-catalog-drift",
                catalog_sql,
                auth_sql.replace(
                    "package_code VARCHAR(120)",
                    "package_code VARCHAR(121)",
                    1,
                ),
                platform_sql,
            ),
            (
                "auth-service-boundary-marker-drift",
                catalog_sql,
                auth_sql.replace(
                    "execute only in the dwp-auth-server database",
                    "execute only in a shared database",
                    1,
                ),
                platform_sql,
            ),
            (
                "assignment-direct-active-insert-guard-removed",
                catalog_sql,
                auth_sql.replace(
                    "PRODUCT_ACCESS_ASSIGNMENT_MUST_START_DRAFT",
                    "PRODUCT_ACCESS_ASSIGNMENT_ENTRY_GATE_REMOVED",
                    1,
                ),
                platform_sql,
            ),
            (
                "active-projection-fail-closed-guard-removed",
                catalog_sql.replace(
                    "ACTIVE_PRODUCT_ACCESS_PROJECTION_MUST_REMAIN_APPLIED",
                    "ACTIVE_PRODUCT_ACCESS_PROJECTION_GUARD_REMOVED",
                    1,
                ),
                auth_sql,
                platform_sql,
            ),
            (
                "active-package-role-seal-removed",
                catalog_sql.replace(
                    "PRODUCT_ACCESS_PACKAGE_ROLE_DRAFT_ONLY",
                    "PRODUCT_ACCESS_PACKAGE_ROLE_GUARD_REMOVED",
                ),
                auth_sql.replace(
                    "PRODUCT_ACCESS_PACKAGE_ROLE_DRAFT_ONLY",
                    "PRODUCT_ACCESS_PACKAGE_ROLE_GUARD_REMOVED",
                ),
                platform_sql,
            ),
            (
                "active-conflict-seal-removed",
                catalog_sql.replace(
                    "PRODUCT_ACCESS_CONFLICT_ACTIVE_DEFINITION_IMMUTABLE",
                    "PRODUCT_ACCESS_CONFLICT_ACTIVE_GUARD_REMOVED",
                ),
                auth_sql.replace(
                    "PRODUCT_ACCESS_CONFLICT_ACTIVE_DEFINITION_IMMUTABLE",
                    "PRODUCT_ACCESS_CONFLICT_ACTIVE_GUARD_REMOVED",
                ),
                platform_sql,
            ),
            (
                "active-projection-insert-seal-removed",
                catalog_sql.replace(
                    "ACTIVE_PRODUCT_ACCESS_PROJECTION_SET_IMMUTABLE",
                    "ACTIVE_PRODUCT_ACCESS_PROJECTION_INSERT_GUARD_REMOVED",
                ),
                auth_sql.replace(
                    "ACTIVE_PRODUCT_ACCESS_PROJECTION_SET_IMMUTABLE",
                    "ACTIVE_PRODUCT_ACCESS_PROJECTION_INSERT_GUARD_REMOVED",
                ),
                platform_sql,
            ),
            (
                "config-payload-seal-removed",
                catalog_sql,
                auth_sql,
                platform_sql.replace(
                    "OR NEW.payload IS DISTINCT FROM OLD.payload\n",
                    "",
                    1,
                ),
            ),
            (
                "extension-cascade-removed",
                catalog_sql,
                auth_sql,
                platform_sql.replace(
                    "sys_cascade_extension_pack_revocation",
                    "sys_extension_revocation_cascade_removed",
                ),
            ),
        ]
        for name, mutated_catalog, mutated_auth, mutated_platform in mutations:
            self_tests += 1
            mutation_errors, _, _ = validate_sql(
                mutated_catalog,
                mutated_auth,
                mutated_platform,
                check_prefix_register=False,
            )
            if not mutation_errors:
                errors.append(f"self-test mutation was not rejected: {name}")

    docker_result: dict[str, object] = {"executed": False}
    if args.docker_postgres and not errors:
        docker_errors, docker_result = validate_with_docker()
        errors.extend(docker_errors)
        checks += 6 + int(docker_result.get("behaviorChecks", 0))

    payload = {
        "schema": "dwp.hris.sys.service-local-migration-readiness.v1",
        "status": "PASS" if not errors else "FAIL",
        "checks": checks,
        **details,
        "selfTests": self_tests,
        "postgresExecution": docker_result,
        "errors": errors,
    }
    print(
        json.dumps(payload, ensure_ascii=False, sort_keys=True)
        if args.compact
        else json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True)
    )
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
