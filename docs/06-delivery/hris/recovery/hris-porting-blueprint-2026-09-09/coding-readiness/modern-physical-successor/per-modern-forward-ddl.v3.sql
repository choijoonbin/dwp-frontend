-- DWP HRIS modern physical successor / PER / authored forward-DDL blueprint v3
-- SOURCE_MANIFEST_FILE_SHA256: be4e5fc198af218db740d46b6a264644f2fd9cae686ca35c3b0cd430541f04b6
-- SOURCE_MANIFEST_SEALED_PAYLOAD_SHA256: 00bb8fba8b91addbc9dea24d0441bc70f6e6833db9997bd89e85da26984f9a0a
-- DESIGN_STATE: PRE_G3_NOT_IMPLEMENTED; PRODUCTION_STATE: NOT_AUTHORIZED_G6
-- COPY RULE: allocate a new owner migration; retain this file as design evidence; never edit G2 SQL.
BEGIN;
DO $preflight$ DECLARE role_name TEXT; role_row RECORD; expected_login BOOLEAN; BEGIN
 IF current_setting('server_version_num')::INTEGER < 160000 THEN RAISE EXCEPTION 'PostgreSQL 16+ required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='btree_gist') THEN RAISE EXCEPTION 'btree_gist must be provisioned by DBA'; END IF;
 FOREACH role_name IN ARRAY ARRAY['dwp_hris_performance_owner','dwp_hris_performance_runtime','dwp_hris_performance_reader','dwp_hris_performance_migrator','dwp_hris_performance_handler'] LOOP
  SELECT * INTO role_row FROM pg_roles WHERE rolname=role_name;
  IF NOT FOUND THEN RAISE EXCEPTION 'required role missing: %',role_name; END IF;
  expected_login:=role_name<>'dwp_hris_performance_owner';
 IF role_row.rolsuper OR role_row.rolinherit OR role_row.rolcreaterole OR role_row.rolcreatedb OR role_row.rolreplication OR role_row.rolbypassrls OR role_row.rolcanlogin IS DISTINCT FROM expected_login THEN RAISE EXCEPTION 'unsafe role attributes for % (expected LOGIN %, NOINHERIT/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS)',role_name,expected_login; END IF;
 END LOOP;
 IF current_user IS DISTINCT FROM 'dwp_hris_performance_migrator' THEN RAISE EXCEPTION 'migration login must be dwp_hris_performance_migrator, got %',current_user;END IF;
 IF NOT pg_has_role(current_user,'dwp_hris_performance_owner','MEMBER') THEN RAISE EXCEPTION 'migrator must be a direct/indirect member of owner for explicit SET ROLE';END IF;
END $preflight$;
SET LOCAL ROLE dwp_hris_performance_owner;
CREATE SCHEMA IF NOT EXISTS hris_performance_modern AUTHORIZATION dwp_hris_performance_owner;
DO $schema_owner$ DECLARE actual_owner TEXT; BEGIN
 SELECT r.rolname INTO actual_owner FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner WHERE n.nspname='hris_performance_modern';
 IF actual_owner IS DISTINCT FROM 'dwp_hris_performance_owner' THEN RAISE EXCEPTION 'schema owner mismatch: %',actual_owner; END IF;
END $schema_owner$;
REVOKE ALL ON SCHEMA hris_performance_modern FROM PUBLIC; GRANT USAGE ON SCHEMA hris_performance_modern TO dwp_hris_performance_runtime,dwp_hris_performance_reader,dwp_hris_performance_handler;
CREATE FUNCTION hris_performance_modern.reject_immutable_mutation() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$ BEGIN RAISE EXCEPTION 'immutable ledger % rejects %',TG_TABLE_NAME,TG_OP USING ERRCODE='55000'; END $fn$;
CREATE FUNCTION hris_performance_modern.enforce_cas_version() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$ BEGIN IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.public_id IS DISTINCT FROM OLD.public_id THEN RAISE EXCEPTION 'immutable identity changed'; END IF; IF NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'CAS version must increment exactly once'; END IF; NEW.updated_at:=transaction_timestamp(); RETURN NEW; END $fn$;
CREATE FUNCTION hris_performance_modern.guard_publication_proof() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$ BEGIN IF OLD.publication_proof_id IS NOT NULL AND ROW(NEW.publication_proof_id,NEW.approval_receipt_public_id,NEW.published_payload_sha256,NEW.published_at) IS DISTINCT FROM ROW(OLD.publication_proof_id,OLD.approval_receipt_public_id,OLD.published_payload_sha256,OLD.published_at) THEN RAISE EXCEPTION 'publication proof is write-once'; END IF; RETURN NEW; END $fn$;
REVOKE ALL ON FUNCTION hris_performance_modern.reject_immutable_mutation() FROM PUBLIC,dwp_hris_performance_runtime,dwp_hris_performance_reader,dwp_hris_performance_handler;
REVOKE ALL ON FUNCTION hris_performance_modern.enforce_cas_version() FROM PUBLIC,dwp_hris_performance_runtime,dwp_hris_performance_reader,dwp_hris_performance_handler;
REVOKE ALL ON FUNCTION hris_performance_modern.guard_publication_proof() FROM PUBLIC,dwp_hris_performance_runtime,dwp_hris_performance_reader,dwp_hris_performance_handler;
GRANT EXECUTE ON FUNCTION hris_performance_modern.reject_immutable_mutation() TO dwp_hris_performance_owner,dwp_hris_performance_migrator;
GRANT EXECUTE ON FUNCTION hris_performance_modern.enforce_cas_version() TO dwp_hris_performance_owner,dwp_hris_performance_migrator;
GRANT EXECUTE ON FUNCTION hris_performance_modern.guard_publication_proof() TO dwp_hris_performance_owner,dwp_hris_performance_migrator;

CREATE TABLE hris_performance_modern.prf_cmp_cycles (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    cycle_code VARCHAR(120) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    currency_code CHAR(3) NOT NULL,
    budget_amount NUMERIC(19,4) NOT NULL,
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    current_plan_revision BIGINT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_cmp_cycles_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_cmp_cycles_version CHECK (version >= 0),
    CONSTRAINT uk_cmp_cycles_1 UNIQUE (tenant_id, cycle_code),
    CONSTRAINT ck_cmp_cycles_1 CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT ck_cmp_cycles_2 CHECK (budget_amount >= 0),
    CONSTRAINT ck_cmp_cycles_3 CHECK (lifecycle_state IN ('DRAFT','OPEN','SUBMITTED','APPROVED','PUBLISHED','CANCELLED'))
);
COMMENT ON TABLE hris_performance_modern.prf_cmp_cycles IS 'compensation planning cycle aggregate | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_performance_modern.prf_cmp_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_performance_modern.prf_cmp_cycles FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_performance_modern.prf_cmp_cycles USING (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_cmp_cycles_1 ON hris_performance_modern.prf_cmp_cycles (tenant_id, lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_performance_modern.prf_cmp_cycles FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.enforce_cas_version();


CREATE TABLE hris_performance_modern.prf_cmp_budget_ledger (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    cycle_public_id UUID NOT NULL,
    ledger_ordinal INTEGER NOT NULL,
    organization_public_id UUID NOT NULL,
    organization_owner VARCHAR(32) NOT NULL DEFAULT 'HRIS-HRM',
    entry_kind VARCHAR(24) NOT NULL,
    currency_code CHAR(3) NOT NULL,
    amount NUMERIC(19,4) NOT NULL,
    authority_receipt_public_id UUID NOT NULL,
    effective_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_cmp_budget_ledger_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_cmp_budget_ledger_version CHECK (version >= 0),
    CONSTRAINT uk_cmp_budget_ledger_1 UNIQUE (tenant_id, cycle_public_id, ledger_ordinal),
    CONSTRAINT fk_cmp_budget_ledger_1 FOREIGN KEY (tenant_id, cycle_public_id) REFERENCES hris_performance_modern.prf_cmp_cycles (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_cmp_budget_ledger_1 CHECK (ledger_ordinal > 0),
    CONSTRAINT ck_cmp_budget_ledger_2 CHECK (entry_kind IN ('ALLOCATE','TRANSFER_IN','TRANSFER_OUT','ADJUST')),
    CONSTRAINT ck_cmp_budget_ledger_3 CHECK (amount >= 0)
);
COMMENT ON TABLE hris_performance_modern.prf_cmp_budget_ledger IS 'append-only compensation budget ledger | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_performance_modern.prf_cmp_budget_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_performance_modern.prf_cmp_budget_ledger FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_performance_modern.prf_cmp_budget_ledger USING (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_performance_modern.prf_cmp_budget_ledger FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.reject_immutable_mutation();


CREATE TABLE hris_performance_modern.prf_cmp_plans (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    cycle_public_id UUID NOT NULL,
    plan_revision BIGINT NOT NULL,
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    approval_receipt_public_id UUID,
    approved_at TIMESTAMPTZ,
    effective_from DATE NOT NULL,
    effective_to DATE,
    content_sha256 CHAR(64) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_cmp_plans_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_cmp_plans_version CHECK (version >= 0),
    CONSTRAINT uk_cmp_plans_1 UNIQUE (tenant_id, cycle_public_id, plan_revision),
    CONSTRAINT fk_cmp_plans_1 FOREIGN KEY (tenant_id, cycle_public_id) REFERENCES hris_performance_modern.prf_cmp_cycles (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_cmp_plans_1 CHECK (plan_revision > 0),
    CONSTRAINT ck_cmp_plans_2 CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT ck_cmp_plans_3 CHECK (lifecycle_state IN ('DRAFT','SUBMITTED','APPROVED','SUPERSEDED','CANCELLED')),
    CONSTRAINT ck_cmp_plans_4 CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_cmp_plans_5 CHECK ((lifecycle_state <> 'APPROVED') OR (approval_receipt_public_id IS NOT NULL AND approved_at IS NOT NULL))
);
COMMENT ON TABLE hris_performance_modern.prf_cmp_plans IS 'revisioned compensation plan | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_performance_modern.prf_cmp_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_performance_modern.prf_cmp_plans FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_performance_modern.prf_cmp_plans USING (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_cmp_plans_1 ON hris_performance_modern.prf_cmp_plans (tenant_id, content_sha256);
CREATE INDEX ix_cmp_plans_2 ON hris_performance_modern.prf_cmp_plans (tenant_id, lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_performance_modern.prf_cmp_plans FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.enforce_cas_version();


CREATE TABLE hris_performance_modern.prf_cmp_proposals (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    cycle_public_id UUID NOT NULL,
    worker_public_id UUID NOT NULL,
    worker_owner VARCHAR(32) NOT NULL DEFAULT 'HRIS-HRM',
    assignment_public_id UUID NOT NULL,
    assignment_owner VARCHAR(32) NOT NULL DEFAULT 'HRIS-HRM',
    component_code VARCHAR(80) NOT NULL,
    occurrence_key VARCHAR(120) NOT NULL DEFAULT 'SINGLE',
    currency_code CHAR(3) NOT NULL,
    proposed_amount NUMERIC(19,4) NOT NULL,
    effective_date DATE,
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    manager_public_id UUID NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_cmp_proposals_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_cmp_proposals_version CHECK (version >= 0),
    CONSTRAINT uk_cmp_proposals_1 UNIQUE (tenant_id, cycle_public_id, worker_public_id, assignment_public_id, component_code, occurrence_key),
    CONSTRAINT fk_cmp_proposals_1 FOREIGN KEY (tenant_id, cycle_public_id) REFERENCES hris_performance_modern.prf_cmp_cycles (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_cmp_proposals_1 CHECK (proposed_amount >= 0),
    CONSTRAINT ck_cmp_proposals_2 CHECK (lifecycle_state IN ('DRAFT','SUBMITTED','APPROVED','REJECTED','CANCELLED'))
);
COMMENT ON TABLE hris_performance_modern.prf_cmp_proposals IS 'recurrence-safe compensation proposal | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_performance_modern.prf_cmp_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_performance_modern.prf_cmp_proposals FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_performance_modern.prf_cmp_proposals USING (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_cmp_proposals_1 ON hris_performance_modern.prf_cmp_proposals (tenant_id, lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_performance_modern.prf_cmp_proposals FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.enforce_cas_version();


CREATE TABLE hris_performance_modern.prf_cmp_approved_snapshots (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    cycle_public_id UUID NOT NULL,
    plan_public_id UUID NOT NULL,
    plan_revision BIGINT NOT NULL,
    snapshot_revision BIGINT NOT NULL,
    source_cycle_version BIGINT NOT NULL,
    approval_receipt_public_id UUID NOT NULL,
    publication_proof_id UUID NOT NULL,
    as_of TIMESTAMPTZ NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    line_count INTEGER NOT NULL,
    currency_code CHAR(3) NOT NULL,
    approved_total NUMERIC(19,4) NOT NULL,
    content_sha256 CHAR(64) NOT NULL,
    published_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_cmp_approved_snapshots_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_cmp_approved_snapshots_version CHECK (version >= 0),
    CONSTRAINT uk_cmp_approved_snapshots_1 UNIQUE (tenant_id, public_id, snapshot_revision),
    CONSTRAINT uk_cmp_approved_snapshots_2 UNIQUE (tenant_id, cycle_public_id, plan_public_id, plan_revision, snapshot_revision),
    CONSTRAINT fk_cmp_approved_snapshots_1 FOREIGN KEY (tenant_id, cycle_public_id) REFERENCES hris_performance_modern.prf_cmp_cycles (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT fk_cmp_approved_snapshots_2 FOREIGN KEY (tenant_id, plan_public_id) REFERENCES hris_performance_modern.prf_cmp_plans (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_cmp_approved_snapshots_1 CHECK (snapshot_revision > 0),
    CONSTRAINT ck_cmp_approved_snapshots_2 CHECK (source_cycle_version >= 0),
    CONSTRAINT ck_cmp_approved_snapshots_3 CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT ck_cmp_approved_snapshots_4 CHECK (line_count > 0),
    CONSTRAINT ck_cmp_approved_snapshots_5 CHECK (approved_total >= 0),
    CONSTRAINT ck_cmp_approved_snapshots_6 CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_cmp_approved_snapshots_7 CHECK (as_of <= published_at)
);
COMMENT ON TABLE hris_performance_modern.prf_cmp_approved_snapshots IS 'immutable temporal compensation publication header | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_performance_modern.prf_cmp_approved_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_performance_modern.prf_cmp_approved_snapshots FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_performance_modern.prf_cmp_approved_snapshots USING (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_cmp_approved_snapshots_1 ON hris_performance_modern.prf_cmp_approved_snapshots (tenant_id, content_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_performance_modern.prf_cmp_approved_snapshots FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.reject_immutable_mutation();


CREATE TABLE hris_performance_modern.prf_cmp_approved_snapshot_lines (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    snapshot_public_id UUID NOT NULL,
    snapshot_revision BIGINT NOT NULL,
    line_ordinal INTEGER NOT NULL,
    worker_public_id UUID NOT NULL,
    worker_owner VARCHAR(32) NOT NULL DEFAULT 'HRIS-HRM',
    assignment_public_id UUID NOT NULL,
    assignment_owner VARCHAR(32) NOT NULL DEFAULT 'HRIS-HRM',
    component_code VARCHAR(80) NOT NULL,
    currency_code CHAR(3) NOT NULL,
    approved_amount NUMERIC(19,4) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    source_proposal_public_id UUID NOT NULL,
    source_proposal_version BIGINT NOT NULL,
    line_sha256 CHAR(64) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_cmp_approved_snapshot_lines_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_cmp_approved_snapshot_lines_version CHECK (version >= 0),
    CONSTRAINT uk_cmp_approved_snapshot_lines_1 UNIQUE (tenant_id, snapshot_public_id, snapshot_revision, line_ordinal),
    CONSTRAINT fk_cmp_approved_snapshot_lines_1 FOREIGN KEY (tenant_id, snapshot_public_id, snapshot_revision) REFERENCES hris_performance_modern.prf_cmp_approved_snapshots (tenant_id, public_id, snapshot_revision) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT fk_cmp_approved_snapshot_lines_2 FOREIGN KEY (tenant_id, source_proposal_public_id) REFERENCES hris_performance_modern.prf_cmp_proposals (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_cmp_approved_snapshot_lines_1 CHECK (snapshot_revision > 0),
    CONSTRAINT ck_cmp_approved_snapshot_lines_2 CHECK (line_ordinal > 0),
    CONSTRAINT ck_cmp_approved_snapshot_lines_3 CHECK (approved_amount >= 0),
    CONSTRAINT ck_cmp_approved_snapshot_lines_4 CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT ck_cmp_approved_snapshot_lines_5 CHECK (source_proposal_version >= 0),
    CONSTRAINT ck_cmp_approved_snapshot_lines_6 CHECK (line_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_performance_modern.prf_cmp_approved_snapshot_lines IS 'typed ordinal compensation snapshot line | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_performance_modern.prf_cmp_approved_snapshot_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_performance_modern.prf_cmp_approved_snapshot_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_performance_modern.prf_cmp_approved_snapshot_lines USING (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_cmp_approved_snapshot_lines_1 ON hris_performance_modern.prf_cmp_approved_snapshot_lines (tenant_id, line_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_performance_modern.prf_cmp_approved_snapshot_lines FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.reject_immutable_mutation();


CREATE TABLE hris_performance_modern.prf_grw_profiles (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    worker_public_id UUID NOT NULL,
    worker_owner VARCHAR(32) NOT NULL DEFAULT 'HRIS-HRM',
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    current_revision BIGINT NOT NULL DEFAULT 0,
    visibility VARCHAR(24) NOT NULL DEFAULT 'WORKER_MANAGER',
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_grw_profiles_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_grw_profiles_version CHECK (version >= 0),
    CONSTRAINT uk_grw_profiles_1 UNIQUE (tenant_id, worker_public_id),
    CONSTRAINT ck_grw_profiles_1 CHECK (lifecycle_state IN ('ACTIVE','ARCHIVED')),
    CONSTRAINT ck_grw_profiles_2 CHECK (visibility IN ('WORKER_ONLY','WORKER_MANAGER','TALENT_TEAM'))
);
COMMENT ON TABLE hris_performance_modern.prf_grw_profiles IS 'worker growth profile aggregate | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_performance_modern.prf_grw_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_performance_modern.prf_grw_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_performance_modern.prf_grw_profiles USING (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_grw_profiles_1 ON hris_performance_modern.prf_grw_profiles (tenant_id, lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_performance_modern.prf_grw_profiles FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.enforce_cas_version();


CREATE TABLE hris_performance_modern.prf_grw_profile_revisions (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    profile_public_id UUID NOT NULL,
    profile_revision BIGINT NOT NULL,
    lifecycle_state VARCHAR(24) NOT NULL,
    summary_sha256 CHAR(64) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    actor_public_id UUID NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_grw_profile_revisions_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_grw_profile_revisions_version CHECK (version >= 0),
    CONSTRAINT uk_grw_profile_revisions_1 UNIQUE (tenant_id, profile_public_id, profile_revision),
    CONSTRAINT fk_grw_profile_revisions_1 FOREIGN KEY (tenant_id, profile_public_id) REFERENCES hris_performance_modern.prf_grw_profiles (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_grw_profile_revisions_1 CHECK (profile_revision > 0),
    CONSTRAINT ck_grw_profile_revisions_2 CHECK (lifecycle_state IN ('ACTIVE','ARCHIVED')),
    CONSTRAINT ck_grw_profile_revisions_3 CHECK (summary_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_performance_modern.prf_grw_profile_revisions IS 'immutable growth profile revision | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_performance_modern.prf_grw_profile_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_performance_modern.prf_grw_profile_revisions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_performance_modern.prf_grw_profile_revisions USING (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_grw_profile_revisions_1 ON hris_performance_modern.prf_grw_profile_revisions (tenant_id, summary_sha256);
CREATE INDEX ix_grw_profile_revisions_2 ON hris_performance_modern.prf_grw_profile_revisions (tenant_id, lifecycle_state);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_performance_modern.prf_grw_profile_revisions FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.reject_immutable_mutation();


CREATE TABLE hris_performance_modern.prf_grw_aspirations (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    profile_public_id UUID NOT NULL,
    aspiration_ordinal INTEGER NOT NULL,
    aspiration_type VARCHAR(60) NOT NULL,
    target_date DATE,
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    description_sha256 CHAR(64) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_grw_aspirations_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_grw_aspirations_version CHECK (version >= 0),
    CONSTRAINT uk_grw_aspirations_1 UNIQUE (tenant_id, profile_public_id, aspiration_ordinal),
    CONSTRAINT fk_grw_aspirations_1 FOREIGN KEY (tenant_id, profile_public_id) REFERENCES hris_performance_modern.prf_grw_profiles (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_grw_aspirations_1 CHECK (aspiration_ordinal > 0),
    CONSTRAINT ck_grw_aspirations_2 CHECK (lifecycle_state IN ('ACTIVE','ACHIEVED','RETIRED')),
    CONSTRAINT ck_grw_aspirations_3 CHECK (description_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_performance_modern.prf_grw_aspirations IS 'typed growth aspiration child | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_performance_modern.prf_grw_aspirations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_performance_modern.prf_grw_aspirations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_performance_modern.prf_grw_aspirations USING (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_grw_aspirations_1 ON hris_performance_modern.prf_grw_aspirations (tenant_id, description_sha256);
CREATE INDEX ix_grw_aspirations_2 ON hris_performance_modern.prf_grw_aspirations (tenant_id, lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_performance_modern.prf_grw_aspirations FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.enforce_cas_version();


CREATE TABLE hris_performance_modern.prf_grw_coaching_notes (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    profile_public_id UUID NOT NULL,
    note_ordinal INTEGER NOT NULL,
    coach_public_id UUID NOT NULL,
    coach_owner VARCHAR(32) NOT NULL DEFAULT 'HRIS-HRM',
    visibility VARCHAR(24) NOT NULL,
    note_sha256 CHAR(64) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_grw_coaching_notes_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_grw_coaching_notes_version CHECK (version >= 0),
    CONSTRAINT uk_grw_coaching_notes_1 UNIQUE (tenant_id, profile_public_id, note_ordinal),
    CONSTRAINT fk_grw_coaching_notes_1 FOREIGN KEY (tenant_id, profile_public_id) REFERENCES hris_performance_modern.prf_grw_profiles (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_grw_coaching_notes_1 CHECK (note_ordinal > 0),
    CONSTRAINT ck_grw_coaching_notes_2 CHECK (visibility IN ('WORKER','MANAGER','TALENT_RESTRICTED')),
    CONSTRAINT ck_grw_coaching_notes_3 CHECK (note_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_performance_modern.prf_grw_coaching_notes IS 'immutable purpose-scoped coaching note | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_performance_modern.prf_grw_coaching_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_performance_modern.prf_grw_coaching_notes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_performance_modern.prf_grw_coaching_notes USING (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_grw_coaching_notes_1 ON hris_performance_modern.prf_grw_coaching_notes (tenant_id, note_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_performance_modern.prf_grw_coaching_notes FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.reject_immutable_mutation();


CREATE TABLE hris_performance_modern.prf_grw_evidence_links (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    profile_public_id UUID NOT NULL,
    link_ordinal INTEGER NOT NULL,
    evidence_public_id UUID NOT NULL,
    evidence_owner VARCHAR(40) NOT NULL,
    evidence_type VARCHAR(60) NOT NULL,
    skill_node_public_id UUID,
    linked_at TIMESTAMPTZ NOT NULL,
    unlinked_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_grw_evidence_links_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_grw_evidence_links_version CHECK (version >= 0),
    CONSTRAINT uk_grw_evidence_links_1 UNIQUE (tenant_id, profile_public_id, link_ordinal),
    CONSTRAINT fk_grw_evidence_links_1 FOREIGN KEY (tenant_id, profile_public_id) REFERENCES hris_performance_modern.prf_grw_profiles (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_grw_evidence_links_1 CHECK (link_ordinal > 0),
    CONSTRAINT ck_grw_evidence_links_2 CHECK (unlinked_at IS NULL OR unlinked_at >= linked_at)
);
COMMENT ON TABLE hris_performance_modern.prf_grw_evidence_links IS 'typed growth evidence link | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_performance_modern.prf_grw_evidence_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_performance_modern.prf_grw_evidence_links FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_performance_modern.prf_grw_evidence_links USING (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_performance_modern.prf_grw_evidence_links FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.enforce_cas_version();


CREATE TABLE hris_performance_modern.prf_grw_portability_export_receipts (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    profile_public_id UUID NOT NULL,
    request_public_id UUID NOT NULL,
    request_sha256 CHAR(64) NOT NULL,
    processing_state VARCHAR(24) NOT NULL DEFAULT 'REQUESTED',
    object_token_public_id UUID,
    object_owner VARCHAR(40),
    expires_at TIMESTAMPTZ NOT NULL,
    result_sha256 CHAR(64),
    correlation_id UUID NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_grw_portability_export_receipts_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_grw_portability_export_receipts_version CHECK (version >= 0),
    CONSTRAINT uk_grw_portability_export_receipts_1 UNIQUE (tenant_id, request_public_id),
    CONSTRAINT fk_grw_portability_export_receipts_1 FOREIGN KEY (tenant_id, profile_public_id) REFERENCES hris_performance_modern.prf_grw_profiles (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_grw_portability_export_receipts_1 CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_grw_portability_export_receipts_2 CHECK (result_sha256 IS NULL OR result_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_grw_portability_export_receipts_3 CHECK (processing_state IN ('REQUESTED','PROCESSING','READY','FAILED_RETRYABLE','FAILED_FINAL','EXPIRED','CANCELLED')),
    CONSTRAINT ck_grw_portability_export_receipts_4 CHECK ((object_token_public_id IS NULL) = (object_owner IS NULL))
);
COMMENT ON TABLE hris_performance_modern.prf_grw_portability_export_receipts IS 'growth portability export lifecycle receipt | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_performance_modern.prf_grw_portability_export_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_performance_modern.prf_grw_portability_export_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_performance_modern.prf_grw_portability_export_receipts USING (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_grw_portability_export_receipts_1 ON hris_performance_modern.prf_grw_portability_export_receipts (tenant_id, request_sha256);
CREATE INDEX ix_grw_portability_export_receipts_2 ON hris_performance_modern.prf_grw_portability_export_receipts (tenant_id, result_sha256);
CREATE INDEX ix_grw_portability_export_receipts_3 ON hris_performance_modern.prf_grw_portability_export_receipts (tenant_id, correlation_id);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_performance_modern.prf_grw_portability_export_receipts FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.enforce_cas_version();


CREATE TABLE hris_performance_modern.prf_lrn_offerings (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    offering_code VARCHAR(120) NOT NULL,
    title VARCHAR(240) NOT NULL,
    provider_public_id UUID,
    provider_owner VARCHAR(40),
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    publication_proof_id UUID,
    approval_receipt_public_id UUID,
    published_payload_sha256 CHAR(64),
    published_at TIMESTAMPTZ,
    effective_from DATE NOT NULL,
    effective_to DATE,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_lrn_offerings_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_lrn_offerings_version CHECK (version >= 0),
    CONSTRAINT uk_lrn_offerings_1 UNIQUE (tenant_id, offering_code),
    CONSTRAINT ck_lrn_offerings_1 CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT ck_lrn_offerings_2 CHECK (lifecycle_state IN ('DRAFT','PUBLISHED','RETIRED')),
    CONSTRAINT ck_lrn_offerings_3 CHECK (published_payload_sha256 IS NULL OR published_payload_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_lrn_offerings_4 CHECK ((provider_public_id IS NULL) = (provider_owner IS NULL)),
    CONSTRAINT ck_lrn_offerings_5 CHECK ((lifecycle_state <> 'PUBLISHED') OR (publication_proof_id IS NOT NULL AND approval_receipt_public_id IS NOT NULL AND published_payload_sha256 IS NOT NULL AND published_at IS NOT NULL))
);
COMMENT ON TABLE hris_performance_modern.prf_lrn_offerings IS 'learning offering lifecycle and write-once publication proof | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_performance_modern.prf_lrn_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_performance_modern.prf_lrn_offerings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_performance_modern.prf_lrn_offerings USING (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_lrn_offerings_1 ON hris_performance_modern.prf_lrn_offerings (tenant_id, lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_performance_modern.prf_lrn_offerings FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.enforce_cas_version();
CREATE TRIGGER guard_publication_proof BEFORE UPDATE ON hris_performance_modern.prf_lrn_offerings FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.guard_publication_proof();


CREATE TABLE hris_performance_modern.prf_lrn_assignments (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    offering_public_id UUID NOT NULL,
    worker_public_id UUID NOT NULL,
    worker_owner VARCHAR(32) NOT NULL DEFAULT 'HRIS-HRM',
    occurrence_key VARCHAR(120) NOT NULL DEFAULT 'SINGLE',
    assigned_by_kind VARCHAR(24) NOT NULL,
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'ASSIGNED',
    assigned_at TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_lrn_assignments_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_lrn_assignments_version CHECK (version >= 0),
    CONSTRAINT uk_lrn_assignments_1 UNIQUE (tenant_id, offering_public_id, worker_public_id, occurrence_key),
    CONSTRAINT fk_lrn_assignments_1 FOREIGN KEY (tenant_id, offering_public_id) REFERENCES hris_performance_modern.prf_lrn_offerings (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_lrn_assignments_1 CHECK (assigned_by_kind IN ('SELF','MANAGER','ADMIN','RULE')),
    CONSTRAINT ck_lrn_assignments_2 CHECK (lifecycle_state IN ('ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED')),
    CONSTRAINT ck_lrn_assignments_3 CHECK (started_at IS NULL OR started_at >= assigned_at),
    CONSTRAINT ck_lrn_assignments_4 CHECK (completed_at IS NULL OR started_at IS NOT NULL AND completed_at >= started_at)
);
COMMENT ON TABLE hris_performance_modern.prf_lrn_assignments IS 'recurrence-safe learning assignment | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_performance_modern.prf_lrn_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_performance_modern.prf_lrn_assignments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_performance_modern.prf_lrn_assignments USING (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_lrn_assignments_1 ON hris_performance_modern.prf_lrn_assignments (tenant_id, lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_performance_modern.prf_lrn_assignments FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.enforce_cas_version();


CREATE TABLE hris_performance_modern.prf_lrn_completion_evidence (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    assignment_public_id UUID NOT NULL,
    evidence_ordinal INTEGER NOT NULL,
    evidence_public_id UUID NOT NULL,
    evidence_owner VARCHAR(40) NOT NULL,
    source_revision VARCHAR(120) NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL,
    evidence_sha256 CHAR(64) NOT NULL,
    verified_by_public_id UUID NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_lrn_completion_evidence_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_lrn_completion_evidence_version CHECK (version >= 0),
    CONSTRAINT uk_lrn_completion_evidence_1 UNIQUE (tenant_id, assignment_public_id, evidence_ordinal),
    CONSTRAINT fk_lrn_completion_evidence_1 FOREIGN KEY (tenant_id, assignment_public_id) REFERENCES hris_performance_modern.prf_lrn_assignments (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_lrn_completion_evidence_1 CHECK (evidence_ordinal > 0),
    CONSTRAINT ck_lrn_completion_evidence_2 CHECK (evidence_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_performance_modern.prf_lrn_completion_evidence IS 'typed immutable learning completion evidence | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_performance_modern.prf_lrn_completion_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_performance_modern.prf_lrn_completion_evidence FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_performance_modern.prf_lrn_completion_evidence USING (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_lrn_completion_evidence_1 ON hris_performance_modern.prf_lrn_completion_evidence (tenant_id, evidence_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_performance_modern.prf_lrn_completion_evidence FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.reject_immutable_mutation();


CREATE TABLE hris_performance_modern.prf_mkt_opportunities (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    opportunity_code VARCHAR(120) NOT NULL,
    title VARCHAR(240) NOT NULL,
    sponsor_public_id UUID NOT NULL,
    sponsor_owner VARCHAR(32) NOT NULL DEFAULT 'HRIS-HRM',
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    publication_proof_id UUID,
    approval_receipt_public_id UUID,
    published_payload_sha256 CHAR(64),
    published_at TIMESTAMPTZ,
    opens_at TIMESTAMPTZ,
    closes_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_mkt_opportunities_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_mkt_opportunities_version CHECK (version >= 0),
    CONSTRAINT uk_mkt_opportunities_1 UNIQUE (tenant_id, opportunity_code),
    CONSTRAINT ck_mkt_opportunities_1 CHECK (closes_at IS NULL OR opens_at IS NULL OR closes_at > opens_at),
    CONSTRAINT ck_mkt_opportunities_2 CHECK (lifecycle_state IN ('DRAFT','PUBLISHED','CLOSED','CANCELLED')),
    CONSTRAINT ck_mkt_opportunities_3 CHECK (published_payload_sha256 IS NULL OR published_payload_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_mkt_opportunities_4 CHECK ((lifecycle_state <> 'PUBLISHED') OR (publication_proof_id IS NOT NULL AND approval_receipt_public_id IS NOT NULL AND published_payload_sha256 IS NOT NULL AND published_at IS NOT NULL))
);
COMMENT ON TABLE hris_performance_modern.prf_mkt_opportunities IS 'talent opportunity lifecycle with publication proof | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_performance_modern.prf_mkt_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_performance_modern.prf_mkt_opportunities FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_performance_modern.prf_mkt_opportunities USING (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_mkt_opportunities_1 ON hris_performance_modern.prf_mkt_opportunities (tenant_id, lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_performance_modern.prf_mkt_opportunities FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.enforce_cas_version();
CREATE TRIGGER guard_publication_proof BEFORE UPDATE ON hris_performance_modern.prf_mkt_opportunities FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.guard_publication_proof();


CREATE TABLE hris_performance_modern.prf_mkt_applications (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    opportunity_public_id UUID NOT NULL,
    worker_public_id UUID NOT NULL,
    worker_owner VARCHAR(32) NOT NULL DEFAULT 'HRIS-HRM',
    occurrence_key VARCHAR(120) NOT NULL DEFAULT 'SINGLE',
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'APPLIED',
    applied_at TIMESTAMPTZ NOT NULL,
    withdrawn_at TIMESTAMPTZ,
    selected_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_mkt_applications_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_mkt_applications_version CHECK (version >= 0),
    CONSTRAINT uk_mkt_applications_1 UNIQUE (tenant_id, opportunity_public_id, worker_public_id, occurrence_key),
    CONSTRAINT fk_mkt_applications_1 FOREIGN KEY (tenant_id, opportunity_public_id) REFERENCES hris_performance_modern.prf_mkt_opportunities (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_mkt_applications_1 CHECK (lifecycle_state IN ('APPLIED','SHORTLISTED','SELECTED','REJECTED','WITHDRAWN','CANCELLED')),
    CONSTRAINT ck_mkt_applications_2 CHECK (withdrawn_at IS NULL OR withdrawn_at >= applied_at),
    CONSTRAINT ck_mkt_applications_3 CHECK (selected_at IS NULL OR selected_at >= applied_at)
);
COMMENT ON TABLE hris_performance_modern.prf_mkt_applications IS 'recurrence-safe opportunity application | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_performance_modern.prf_mkt_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_performance_modern.prf_mkt_applications FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_performance_modern.prf_mkt_applications USING (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_mkt_applications_1 ON hris_performance_modern.prf_mkt_applications (tenant_id, lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_performance_modern.prf_mkt_applications FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.enforce_cas_version();


CREATE TABLE hris_performance_modern.prf_mkt_match_explanations (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    application_public_id UUID NOT NULL,
    explanation_ordinal INTEGER NOT NULL,
    model_revision_ref VARCHAR(160),
    human_decision_receipt_public_id UUID NOT NULL,
    explanation_sha256 CHAR(64) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_mkt_match_explanations_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_mkt_match_explanations_version CHECK (version >= 0),
    CONSTRAINT uk_mkt_match_explanations_1 UNIQUE (tenant_id, application_public_id, explanation_ordinal),
    CONSTRAINT fk_mkt_match_explanations_1 FOREIGN KEY (tenant_id, application_public_id) REFERENCES hris_performance_modern.prf_mkt_applications (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_mkt_match_explanations_1 CHECK (explanation_ordinal > 0),
    CONSTRAINT ck_mkt_match_explanations_2 CHECK (explanation_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_performance_modern.prf_mkt_match_explanations IS 'immutable opportunity match explanation | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_performance_modern.prf_mkt_match_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_performance_modern.prf_mkt_match_explanations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_performance_modern.prf_mkt_match_explanations USING (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_mkt_match_explanations_1 ON hris_performance_modern.prf_mkt_match_explanations (tenant_id, explanation_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_performance_modern.prf_mkt_match_explanations FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.reject_immutable_mutation();


CREATE TABLE hris_performance_modern.prf_mkt_application_decisions (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    application_public_id UUID NOT NULL,
    decision_ordinal INTEGER NOT NULL,
    decision_code VARCHAR(32) NOT NULL,
    human_decision_receipt_public_id UUID NOT NULL,
    reason_code VARCHAR(100),
    decided_at TIMESTAMPTZ NOT NULL,
    decision_sha256 CHAR(64) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_mkt_application_decisions_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_mkt_application_decisions_version CHECK (version >= 0),
    CONSTRAINT uk_mkt_application_decisions_1 UNIQUE (tenant_id, application_public_id, decision_ordinal),
    CONSTRAINT fk_mkt_application_decisions_1 FOREIGN KEY (tenant_id, application_public_id) REFERENCES hris_performance_modern.prf_mkt_applications (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_mkt_application_decisions_1 CHECK (decision_ordinal > 0),
    CONSTRAINT ck_mkt_application_decisions_2 CHECK (decision_code IN ('SHORTLISTED','SELECTED','REJECTED','WITHDRAWN','CANCELLED')),
    CONSTRAINT ck_mkt_application_decisions_3 CHECK (decision_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_performance_modern.prf_mkt_application_decisions IS 'append-only opportunity human decision proof | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_performance_modern.prf_mkt_application_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_performance_modern.prf_mkt_application_decisions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_performance_modern.prf_mkt_application_decisions USING (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_mkt_application_decisions_1 ON hris_performance_modern.prf_mkt_application_decisions (tenant_id, decision_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_performance_modern.prf_mkt_application_decisions FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.reject_immutable_mutation();


CREATE TABLE hris_performance_modern.prf_skl_taxonomies (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    taxonomy_code VARCHAR(120) NOT NULL,
    display_name VARCHAR(240) NOT NULL,
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    current_revision BIGINT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_skl_taxonomies_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_skl_taxonomies_version CHECK (version >= 0),
    CONSTRAINT uk_skl_taxonomies_1 UNIQUE (tenant_id, taxonomy_code),
    CONSTRAINT ck_skl_taxonomies_1 CHECK (lifecycle_state IN ('DRAFT','ACTIVE','RETIRED'))
);
COMMENT ON TABLE hris_performance_modern.prf_skl_taxonomies IS 'skills taxonomy aggregate | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_performance_modern.prf_skl_taxonomies ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_performance_modern.prf_skl_taxonomies FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_performance_modern.prf_skl_taxonomies USING (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_skl_taxonomies_1 ON hris_performance_modern.prf_skl_taxonomies (tenant_id, lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_performance_modern.prf_skl_taxonomies FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.enforce_cas_version();


CREATE TABLE hris_performance_modern.prf_skl_taxonomy_versions (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    taxonomy_public_id UUID NOT NULL,
    taxonomy_revision BIGINT NOT NULL,
    lifecycle_state VARCHAR(24) NOT NULL,
    content_sha256 CHAR(64) NOT NULL,
    approval_receipt_public_id UUID,
    publication_proof_id UUID,
    published_payload_sha256 CHAR(64),
    published_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_skl_taxonomy_versions_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_skl_taxonomy_versions_version CHECK (version >= 0),
    CONSTRAINT uk_skl_taxonomy_versions_1 UNIQUE (tenant_id, taxonomy_public_id, taxonomy_revision),
    CONSTRAINT fk_skl_taxonomy_versions_1 FOREIGN KEY (tenant_id, taxonomy_public_id) REFERENCES hris_performance_modern.prf_skl_taxonomies (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_skl_taxonomy_versions_1 CHECK (taxonomy_revision > 0),
    CONSTRAINT ck_skl_taxonomy_versions_2 CHECK (lifecycle_state IN ('DRAFT','VALIDATED','PUBLISHED','RETIRED')),
    CONSTRAINT ck_skl_taxonomy_versions_3 CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_skl_taxonomy_versions_4 CHECK (published_payload_sha256 IS NULL OR published_payload_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_skl_taxonomy_versions_5 CHECK ((lifecycle_state <> 'PUBLISHED') OR (approval_receipt_public_id IS NOT NULL AND publication_proof_id IS NOT NULL AND published_payload_sha256 IS NOT NULL AND published_at IS NOT NULL))
);
COMMENT ON TABLE hris_performance_modern.prf_skl_taxonomy_versions IS 'immutable skills taxonomy version and publication proof | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_performance_modern.prf_skl_taxonomy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_performance_modern.prf_skl_taxonomy_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_performance_modern.prf_skl_taxonomy_versions USING (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_skl_taxonomy_versions_1 ON hris_performance_modern.prf_skl_taxonomy_versions (tenant_id, lifecycle_state);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_performance_modern.prf_skl_taxonomy_versions FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.reject_immutable_mutation();


CREATE TABLE hris_performance_modern.prf_skl_skill_nodes (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    taxonomy_public_id UUID NOT NULL,
    taxonomy_revision BIGINT NOT NULL,
    node_ordinal INTEGER NOT NULL,
    skill_code VARCHAR(120) NOT NULL,
    display_name VARCHAR(240) NOT NULL,
    description_sha256 CHAR(64) NOT NULL,
    node_state VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_skl_skill_nodes_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_skl_skill_nodes_version CHECK (version >= 0),
    CONSTRAINT uk_skl_skill_nodes_1 UNIQUE (tenant_id, taxonomy_public_id, taxonomy_revision, public_id),
    CONSTRAINT uk_skl_skill_nodes_2 UNIQUE (tenant_id, taxonomy_public_id, taxonomy_revision, node_ordinal),
    CONSTRAINT uk_skl_skill_nodes_3 UNIQUE (tenant_id, taxonomy_public_id, taxonomy_revision, skill_code),
    CONSTRAINT fk_skl_skill_nodes_1 FOREIGN KEY (tenant_id, taxonomy_public_id, taxonomy_revision) REFERENCES hris_performance_modern.prf_skl_taxonomy_versions (tenant_id, taxonomy_public_id, taxonomy_revision) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_skl_skill_nodes_1 CHECK (taxonomy_revision > 0),
    CONSTRAINT ck_skl_skill_nodes_2 CHECK (node_ordinal > 0),
    CONSTRAINT ck_skl_skill_nodes_3 CHECK (description_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_skl_skill_nodes_4 CHECK (node_state IN ('ACTIVE','DEPRECATED'))
);
COMMENT ON TABLE hris_performance_modern.prf_skl_skill_nodes IS 'typed skills taxonomy node | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_performance_modern.prf_skl_skill_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_performance_modern.prf_skl_skill_nodes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_performance_modern.prf_skl_skill_nodes USING (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_skl_skill_nodes_1 ON hris_performance_modern.prf_skl_skill_nodes (tenant_id, description_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_performance_modern.prf_skl_skill_nodes FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.reject_immutable_mutation();


CREATE TABLE hris_performance_modern.prf_skl_skill_edges (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    taxonomy_public_id UUID NOT NULL,
    taxonomy_revision BIGINT NOT NULL,
    edge_ordinal INTEGER NOT NULL,
    parent_node_public_id UUID NOT NULL,
    child_node_public_id UUID NOT NULL,
    edge_type VARCHAR(24) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_skl_skill_edges_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_skl_skill_edges_version CHECK (version >= 0),
    CONSTRAINT uk_skl_skill_edges_1 UNIQUE (tenant_id, taxonomy_public_id, taxonomy_revision, edge_ordinal),
    CONSTRAINT uk_skl_skill_edges_2 UNIQUE (tenant_id, taxonomy_public_id, taxonomy_revision, parent_node_public_id, child_node_public_id, edge_type),
    CONSTRAINT fk_skl_skill_edges_1 FOREIGN KEY (tenant_id, taxonomy_public_id, taxonomy_revision) REFERENCES hris_performance_modern.prf_skl_taxonomy_versions (tenant_id, taxonomy_public_id, taxonomy_revision) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT fk_skl_skill_edges_2 FOREIGN KEY (tenant_id, taxonomy_public_id, taxonomy_revision, parent_node_public_id) REFERENCES hris_performance_modern.prf_skl_skill_nodes (tenant_id, taxonomy_public_id, taxonomy_revision, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT fk_skl_skill_edges_3 FOREIGN KEY (tenant_id, taxonomy_public_id, taxonomy_revision, child_node_public_id) REFERENCES hris_performance_modern.prf_skl_skill_nodes (tenant_id, taxonomy_public_id, taxonomy_revision, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_skl_skill_edges_1 CHECK (taxonomy_revision > 0),
    CONSTRAINT ck_skl_skill_edges_2 CHECK (edge_ordinal > 0),
    CONSTRAINT ck_skl_skill_edges_3 CHECK (parent_node_public_id <> child_node_public_id),
    CONSTRAINT ck_skl_skill_edges_4 CHECK (edge_type IN ('IS_A','PART_OF','RELATED_TO','REQUIRES'))
);
COMMENT ON TABLE hris_performance_modern.prf_skl_skill_edges IS 'typed acyclic skills taxonomy edge | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_performance_modern.prf_skl_skill_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_performance_modern.prf_skl_skill_edges FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_performance_modern.prf_skl_skill_edges USING (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_performance_modern.prf_skl_skill_edges FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.reject_immutable_mutation();


CREATE TABLE hris_performance_modern.prf_skl_proficiency_levels (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    taxonomy_public_id UUID NOT NULL,
    taxonomy_revision BIGINT NOT NULL,
    level_ordinal INTEGER NOT NULL,
    level_code VARCHAR(80) NOT NULL,
    display_name VARCHAR(160) NOT NULL,
    minimum_score NUMERIC(9,4),
    maximum_score NUMERIC(9,4),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_skl_proficiency_levels_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_skl_proficiency_levels_version CHECK (version >= 0),
    CONSTRAINT uk_skl_proficiency_levels_1 UNIQUE (tenant_id, taxonomy_public_id, taxonomy_revision, level_ordinal),
    CONSTRAINT uk_skl_proficiency_levels_2 UNIQUE (tenant_id, taxonomy_public_id, taxonomy_revision, level_code),
    CONSTRAINT fk_skl_proficiency_levels_1 FOREIGN KEY (tenant_id, taxonomy_public_id, taxonomy_revision) REFERENCES hris_performance_modern.prf_skl_taxonomy_versions (tenant_id, taxonomy_public_id, taxonomy_revision) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_skl_proficiency_levels_1 CHECK (taxonomy_revision > 0),
    CONSTRAINT ck_skl_proficiency_levels_2 CHECK (level_ordinal > 0),
    CONSTRAINT ck_skl_proficiency_levels_3 CHECK (minimum_score IS NULL OR maximum_score IS NULL OR maximum_score >= minimum_score)
);
COMMENT ON TABLE hris_performance_modern.prf_skl_proficiency_levels IS 'typed ordinal proficiency scale | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_performance_modern.prf_skl_proficiency_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_performance_modern.prf_skl_proficiency_levels FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_performance_modern.prf_skl_proficiency_levels USING (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_performance_modern.prf_skl_proficiency_levels FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.reject_immutable_mutation();


CREATE TABLE hris_performance_modern.prf_skl_worker_evidence (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    worker_public_id UUID NOT NULL,
    worker_owner VARCHAR(32) NOT NULL DEFAULT 'HRIS-HRM',
    taxonomy_public_id UUID NOT NULL,
    taxonomy_revision BIGINT NOT NULL,
    skill_node_public_id UUID NOT NULL,
    proficiency_level_public_id UUID,
    evidence_public_id UUID NOT NULL,
    evidence_owner VARCHAR(40) NOT NULL,
    evidence_sha256 CHAR(64) NOT NULL,
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'RECORDED',
    verified_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_skl_worker_evidence_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_skl_worker_evidence_version CHECK (version >= 0),
    CONSTRAINT uk_skl_worker_evidence_1 UNIQUE (tenant_id, worker_public_id, taxonomy_public_id, taxonomy_revision, skill_node_public_id, evidence_public_id),
    CONSTRAINT fk_skl_worker_evidence_1 FOREIGN KEY (tenant_id, taxonomy_public_id, taxonomy_revision, skill_node_public_id) REFERENCES hris_performance_modern.prf_skl_skill_nodes (tenant_id, taxonomy_public_id, taxonomy_revision, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_skl_worker_evidence_1 CHECK (taxonomy_revision > 0),
    CONSTRAINT ck_skl_worker_evidence_2 CHECK (evidence_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_skl_worker_evidence_3 CHECK (lifecycle_state IN ('RECORDED','VERIFIED','REVOKED')),
    CONSTRAINT ck_skl_worker_evidence_4 CHECK (verified_at IS NULL OR lifecycle_state IN ('VERIFIED','REVOKED')),
    CONSTRAINT ck_skl_worker_evidence_5 CHECK (revoked_at IS NULL OR lifecycle_state='REVOKED')
);
COMMENT ON TABLE hris_performance_modern.prf_skl_worker_evidence IS 'typed worker skill evidence lifecycle | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_performance_modern.prf_skl_worker_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_performance_modern.prf_skl_worker_evidence FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_performance_modern.prf_skl_worker_evidence USING (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_skl_worker_evidence_1 ON hris_performance_modern.prf_skl_worker_evidence (tenant_id, evidence_sha256);
CREATE INDEX ix_skl_worker_evidence_2 ON hris_performance_modern.prf_skl_worker_evidence (tenant_id, lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_performance_modern.prf_skl_worker_evidence FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.enforce_cas_version();


CREATE TABLE hris_performance_modern.prf_suc_plans (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    plan_code VARCHAR(120) NOT NULL,
    position_public_id UUID NOT NULL,
    position_owner VARCHAR(32) NOT NULL DEFAULT 'HRIS-HRM',
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    plan_revision BIGINT NOT NULL DEFAULT 1,
    approval_receipt_public_id UUID,
    publication_proof_id UUID,
    published_payload_sha256 CHAR(64),
    published_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_suc_plans_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_suc_plans_version CHECK (version >= 0),
    CONSTRAINT uk_suc_plans_1 UNIQUE (tenant_id, plan_code),
    CONSTRAINT ck_suc_plans_1 CHECK (plan_revision > 0),
    CONSTRAINT ck_suc_plans_2 CHECK (lifecycle_state IN ('DRAFT','SUBMITTED','APPROVED','PUBLISHED','REJECTED','RETIRED','CANCELLED')),
    CONSTRAINT ck_suc_plans_3 CHECK (published_payload_sha256 IS NULL OR published_payload_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_suc_plans_4 CHECK ((lifecycle_state <> 'PUBLISHED') OR (approval_receipt_public_id IS NOT NULL AND publication_proof_id IS NOT NULL AND published_payload_sha256 IS NOT NULL AND published_at IS NOT NULL))
);
COMMENT ON TABLE hris_performance_modern.prf_suc_plans IS 'succession plan lifecycle | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_performance_modern.prf_suc_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_performance_modern.prf_suc_plans FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_performance_modern.prf_suc_plans USING (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_suc_plans_1 ON hris_performance_modern.prf_suc_plans (tenant_id, lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_performance_modern.prf_suc_plans FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.enforce_cas_version();
CREATE TRIGGER guard_publication_proof BEFORE UPDATE ON hris_performance_modern.prf_suc_plans FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.guard_publication_proof();


CREATE TABLE hris_performance_modern.prf_suc_nominations (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    plan_public_id UUID NOT NULL,
    nomination_ordinal INTEGER NOT NULL,
    nominee_worker_public_id UUID NOT NULL,
    worker_owner VARCHAR(32) NOT NULL DEFAULT 'HRIS-HRM',
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'NOMINATED',
    nominated_at TIMESTAMPTZ NOT NULL,
    withdrawn_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_suc_nominations_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_suc_nominations_version CHECK (version >= 0),
    CONSTRAINT uk_suc_nominations_1 UNIQUE (tenant_id, plan_public_id, nomination_ordinal),
    CONSTRAINT uk_suc_nominations_2 UNIQUE (tenant_id, plan_public_id, nominee_worker_public_id),
    CONSTRAINT fk_suc_nominations_1 FOREIGN KEY (tenant_id, plan_public_id) REFERENCES hris_performance_modern.prf_suc_plans (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_suc_nominations_1 CHECK (nomination_ordinal > 0),
    CONSTRAINT ck_suc_nominations_2 CHECK (lifecycle_state IN ('NOMINATED','READY','SELECTED','WITHDRAWN')),
    CONSTRAINT ck_suc_nominations_3 CHECK (withdrawn_at IS NULL OR lifecycle_state='WITHDRAWN')
);
COMMENT ON TABLE hris_performance_modern.prf_suc_nominations IS 'typed succession nomination | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_performance_modern.prf_suc_nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_performance_modern.prf_suc_nominations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_performance_modern.prf_suc_nominations USING (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_suc_nominations_1 ON hris_performance_modern.prf_suc_nominations (tenant_id, lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_performance_modern.prf_suc_nominations FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.enforce_cas_version();


CREATE TABLE hris_performance_modern.prf_suc_readiness_evidence (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    nomination_public_id UUID NOT NULL,
    evidence_ordinal INTEGER NOT NULL,
    readiness_level_code VARCHAR(60) NOT NULL,
    evidence_public_id UUID NOT NULL,
    evidence_owner VARCHAR(40) NOT NULL,
    evidence_sha256 CHAR(64) NOT NULL,
    assessed_by_public_id UUID NOT NULL,
    assessed_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_suc_readiness_evidence_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_suc_readiness_evidence_version CHECK (version >= 0),
    CONSTRAINT uk_suc_readiness_evidence_1 UNIQUE (tenant_id, nomination_public_id, evidence_ordinal),
    CONSTRAINT fk_suc_readiness_evidence_1 FOREIGN KEY (tenant_id, nomination_public_id) REFERENCES hris_performance_modern.prf_suc_nominations (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_suc_readiness_evidence_1 CHECK (evidence_ordinal > 0),
    CONSTRAINT ck_suc_readiness_evidence_2 CHECK (evidence_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_performance_modern.prf_suc_readiness_evidence IS 'immutable succession readiness evidence | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_performance_modern.prf_suc_readiness_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_performance_modern.prf_suc_readiness_evidence FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_performance_modern.prf_suc_readiness_evidence USING (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK (tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_suc_readiness_evidence_1 ON hris_performance_modern.prf_suc_readiness_evidence (tenant_id, evidence_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_performance_modern.prf_suc_readiness_evidence FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.reject_immutable_mutation();

-- Cross-row compensation publication invariant: header count/currency/total must equal immutable lines at commit.
CREATE FUNCTION hris_performance_modern.assert_comp_snapshot_complete() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,hris_performance_modern AS $fn$
DECLARE sid UUID; srev BIGINT; expected_count INTEGER; expected_total NUMERIC(19,4); expected_currency CHAR(3); actual_count BIGINT; actual_total NUMERIC(19,4); bad_currency BOOLEAN;
BEGIN
 sid:=CASE WHEN TG_TABLE_NAME='prf_cmp_approved_snapshots' THEN NEW.public_id ELSE NEW.snapshot_public_id END;
 srev:=CASE WHEN TG_TABLE_NAME='prf_cmp_approved_snapshots' THEN NEW.snapshot_revision ELSE NEW.snapshot_revision END;
 SELECT line_count,approved_total,currency_code INTO expected_count,expected_total,expected_currency FROM hris_performance_modern.prf_cmp_approved_snapshots WHERE tenant_id=NEW.tenant_id AND public_id=sid AND snapshot_revision=srev;
 SELECT count(*),COALESCE(sum(approved_amount),0),bool_or(currency_code<>expected_currency) INTO actual_count,actual_total,bad_currency FROM hris_performance_modern.prf_cmp_approved_snapshot_lines WHERE tenant_id=NEW.tenant_id AND snapshot_public_id=sid AND snapshot_revision=srev;
 IF expected_count IS NULL OR actual_count<>expected_count OR actual_total<>expected_total OR COALESCE(bad_currency,false) THEN RAISE EXCEPTION 'incomplete or inconsistent compensation snapshot %/%',sid,srev; END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION hris_performance_modern.assert_comp_snapshot_complete() FROM PUBLIC,dwp_hris_performance_runtime,dwp_hris_performance_reader,dwp_hris_performance_handler;
GRANT EXECUTE ON FUNCTION hris_performance_modern.assert_comp_snapshot_complete() TO dwp_hris_performance_owner,dwp_hris_performance_migrator;
CREATE CONSTRAINT TRIGGER assert_snapshot_header_complete AFTER INSERT ON hris_performance_modern.prf_cmp_approved_snapshots DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.assert_comp_snapshot_complete();
CREATE CONSTRAINT TRIGGER assert_snapshot_line_complete AFTER INSERT ON hris_performance_modern.prf_cmp_approved_snapshot_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hris_performance_modern.assert_comp_snapshot_complete();

-- Temporal overlap fences use half-open periods; recurrence keys preserve legitimate repeats.
ALTER TABLE hris_performance_modern.prf_cmp_cycles ADD CONSTRAINT ex_cmp_cycle_period EXCLUDE USING gist (tenant_id WITH =,cycle_code WITH =,daterange(effective_from,effective_to,'[)') WITH &&);
ALTER TABLE hris_performance_modern.prf_lrn_offerings ADD CONSTRAINT ex_lrn_offering_period EXCLUDE USING gist (tenant_id WITH =,offering_code WITH =,daterange(effective_from,effective_to,'[)') WITH &&);

-- Exact owner-local ACL. Reader receives approved G3 views only, never raw compensation,
-- coaching-note, skill-evidence, proof or event tables. Neither API nor handler can DELETE.
REVOKE ALL ON ALL TABLES IN SCHEMA hris_performance_modern FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON TABLE
 hris_performance_modern.prf_cmp_cycles,
 hris_performance_modern.prf_cmp_plans,
 hris_performance_modern.prf_cmp_proposals,
 hris_performance_modern.prf_grw_profiles,
 hris_performance_modern.prf_grw_aspirations,
 hris_performance_modern.prf_grw_evidence_links,
 hris_performance_modern.prf_grw_portability_export_receipts,
 hris_performance_modern.prf_lrn_offerings,
 hris_performance_modern.prf_lrn_assignments,
 hris_performance_modern.prf_mkt_opportunities,
 hris_performance_modern.prf_mkt_applications,
 hris_performance_modern.prf_skl_taxonomies,
 hris_performance_modern.prf_skl_worker_evidence,
 hris_performance_modern.prf_suc_plans,
 hris_performance_modern.prf_suc_nominations
TO dwp_hris_performance_runtime;
GRANT SELECT,INSERT ON TABLE
 hris_performance_modern.prf_cmp_budget_ledger,
 hris_performance_modern.prf_cmp_approved_snapshots,
 hris_performance_modern.prf_cmp_approved_snapshot_lines,
 hris_performance_modern.prf_grw_profile_revisions,
 hris_performance_modern.prf_grw_coaching_notes,
 hris_performance_modern.prf_lrn_completion_evidence,
 hris_performance_modern.prf_mkt_match_explanations,
 hris_performance_modern.prf_mkt_application_decisions,
 hris_performance_modern.prf_skl_taxonomy_versions,
 hris_performance_modern.prf_skl_skill_nodes,
 hris_performance_modern.prf_skl_skill_edges,
 hris_performance_modern.prf_skl_proficiency_levels,
 hris_performance_modern.prf_suc_readiness_evidence
TO dwp_hris_performance_runtime;
GRANT SELECT,UPDATE ON TABLE hris_performance_modern.prf_grw_portability_export_receipts TO dwp_hris_performance_handler;
ALTER DEFAULT PRIVILEGES FOR ROLE dwp_hris_performance_owner IN SCHEMA hris_performance_modern REVOKE ALL ON TABLES FROM PUBLIC;

-- Fail closed on exact table set, common shape and correlation/hash uniqueness.
DO $verify$ DECLARE expected TEXT[]:=ARRAY['prf_cmp_cycles','prf_cmp_budget_ledger','prf_cmp_plans','prf_cmp_proposals','prf_cmp_approved_snapshots','prf_cmp_approved_snapshot_lines','prf_grw_profiles','prf_grw_profile_revisions','prf_grw_aspirations','prf_grw_coaching_notes','prf_grw_evidence_links','prf_grw_portability_export_receipts','prf_lrn_offerings','prf_lrn_assignments','prf_lrn_completion_evidence','prf_mkt_opportunities','prf_mkt_applications','prf_mkt_match_explanations','prf_mkt_application_decisions','prf_skl_taxonomies','prf_skl_taxonomy_versions','prf_skl_skill_nodes','prf_skl_skill_edges','prf_skl_proficiency_levels','prf_skl_worker_evidence','prf_suc_plans','prf_suc_nominations','prf_suc_readiness_evidence'];actual TEXT[];t TEXT; BEGIN
 SELECT array_agg(tablename ORDER BY tablename) INTO actual FROM pg_tables WHERE schemaname='hris_performance_modern'; SELECT array_agg(x ORDER BY x) INTO expected FROM unnest(expected)x;
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'PER exact table set mismatch expected %, actual %',expected,actual; END IF;
 FOREACH t IN ARRAY expected LOOP IF(SELECT count(*) FROM information_schema.columns WHERE table_schema='hris_performance_modern' AND table_name=t AND column_name IN('tenant_id','public_id','version','created_at','updated_at'))<>5 THEN RAISE EXCEPTION 'required physical columns missing on %',t; END IF; END LOOP;
 IF EXISTS(SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='hris_performance_modern' AND i.indisunique AND EXISTS(SELECT 1 FROM unnest(i.indkey)k JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k WHERE a.attname~'(correlation|sha256|digest|hash)')) THEN RAISE EXCEPTION 'unique correlation/hash/digest index is forbidden'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner WHERE n.nspname='hris_performance_modern' AND c.relkind IN('r','p') AND r.rolname<>'dwp_hris_performance_owner') THEN RAISE EXCEPTION 'PER table owner mismatch';END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner WHERE n.nspname='hris_performance_modern' AND r.rolname<>'dwp_hris_performance_owner') THEN RAISE EXCEPTION 'PER function owner mismatch';END IF;
END $verify$;
COMMIT;

-- MIGRATION NOTES
-- 1. Provision roles/extension, profile duplicate identities and intervals, and quarantine invalid legacy rows.
-- 2. Apply as a strict, single-run newly allocated PER migration under the common verification semaphore; never edit G2 migrations.
--    Flyway history supplies replay idempotence; direct replay or any pre-created table/index/policy/trigger/function collision fails closed.
-- 3. Snapshot publish refetches APPROVED cycle/plan/approval facts, recomputes ordered lines/count/total/SHA-256, then commits header+1..N lines atomically.
-- 4. Taxonomy graphs require application cycle detection in addition to exact composite FKs; worker/evidence owner refs are typed, purpose/version refetched, never cross-database FKs.
-- 5. Rollback is forward correction; immutable proofs, ledgers, decisions and evidence are never deleted.
