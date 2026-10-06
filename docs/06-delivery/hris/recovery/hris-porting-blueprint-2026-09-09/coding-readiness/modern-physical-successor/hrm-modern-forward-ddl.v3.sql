-- DWP HRIS modern physical successor / HRM / authored forward-DDL blueprint v3
-- SOURCE_MANIFEST_FILE_SHA256: be4e5fc198af218db740d46b6a264644f2fd9cae686ca35c3b0cd430541f04b6
-- SOURCE_MANIFEST_SEALED_PAYLOAD_SHA256: 00bb8fba8b91addbc9dea24d0441bc70f6e6833db9997bd89e85da26984f9a0a
-- DESIGN_STATE: PRE_G3_NOT_IMPLEMENTED; PRODUCTION_STATE: NOT_AUTHORIZED_G6
-- COPY RULE: allocate a new owner migration; retain this file as design evidence; never edit G2 SQL.
-- REQUIRED SESSION SETTINGS: SET LOCAL dwp.tenant_id='<tenant bigint>' for all data work.
BEGIN;
DO $preflight$
DECLARE role_name TEXT; role_row RECORD; expected_login BOOLEAN;
BEGIN
  IF current_setting('server_version_num')::INTEGER < 160000 THEN RAISE EXCEPTION 'PostgreSQL 16+ required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='btree_gist') THEN RAISE EXCEPTION 'btree_gist must be provisioned by DBA'; END IF;
  FOREACH role_name IN ARRAY ARRAY['dwp_hris_people_owner','dwp_hris_people_runtime','dwp_hris_people_reader','dwp_hris_people_migrator','dwp_hris_people_handler'] LOOP
    SELECT * INTO role_row FROM pg_roles WHERE rolname=role_name;
    IF NOT FOUND THEN RAISE EXCEPTION 'required role missing: %', role_name; END IF;
    expected_login := role_name <> 'dwp_hris_people_owner';
    IF role_row.rolsuper OR role_row.rolinherit OR role_row.rolcreaterole OR role_row.rolcreatedb OR role_row.rolreplication OR role_row.rolbypassrls OR role_row.rolcanlogin IS DISTINCT FROM expected_login THEN
      RAISE EXCEPTION 'unsafe role attributes for % (expected LOGIN %, NOINHERIT/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS)',role_name,expected_login;
    END IF;
  END LOOP;
  IF current_user IS DISTINCT FROM 'dwp_hris_people_migrator' THEN RAISE EXCEPTION 'migration login must be dwp_hris_people_migrator, got %',current_user;END IF;
  IF NOT pg_has_role(current_user,'dwp_hris_people_owner','MEMBER') THEN RAISE EXCEPTION 'migrator must be a direct/indirect member of owner for explicit SET ROLE';END IF;
END $preflight$;
SET LOCAL ROLE dwp_hris_people_owner;
CREATE SCHEMA IF NOT EXISTS hris_people_modern AUTHORIZATION dwp_hris_people_owner;
DO $schema_owner$
DECLARE actual_owner TEXT;
BEGIN
  SELECT r.rolname INTO actual_owner
  FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner
  WHERE n.nspname='hris_people_modern';
  IF actual_owner IS DISTINCT FROM 'dwp_hris_people_owner' THEN
    RAISE EXCEPTION 'schema owner mismatch: %', actual_owner;
  END IF;
END $schema_owner$;
REVOKE ALL ON SCHEMA hris_people_modern FROM PUBLIC;
GRANT USAGE ON SCHEMA hris_people_modern TO dwp_hris_people_runtime, dwp_hris_people_reader, dwp_hris_people_handler;
CREATE FUNCTION hris_people_modern.reject_immutable_mutation() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
BEGIN RAISE EXCEPTION 'immutable ledger % rejects %', TG_TABLE_NAME, TG_OP USING ERRCODE='55000'; END $fn$;
CREATE FUNCTION hris_people_modern.enforce_cas_version() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.public_id IS DISTINCT FROM OLD.public_id THEN RAISE EXCEPTION 'immutable identity changed'; END IF;
  IF NEW.version <> OLD.version + 1 THEN RAISE EXCEPTION 'CAS version must increment exactly once'; END IF;
  NEW.updated_at := transaction_timestamp(); RETURN NEW;
END $fn$;

CREATE FUNCTION hris_people_modern.guard_publication_proof() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
BEGIN
  IF OLD.publication_proof_id IS NOT NULL AND ROW(NEW.publication_proof_id,NEW.approval_receipt_public_id,NEW.published_payload_sha256,NEW.published_at)
     IS DISTINCT FROM ROW(OLD.publication_proof_id,OLD.approval_receipt_public_id,OLD.published_payload_sha256,OLD.published_at)
  THEN RAISE EXCEPTION 'publication proof is write-once'; END IF; RETURN NEW;
END $fn$;

REVOKE ALL ON FUNCTION hris_people_modern.reject_immutable_mutation() FROM PUBLIC, dwp_hris_people_runtime, dwp_hris_people_reader, dwp_hris_people_handler;
REVOKE ALL ON FUNCTION hris_people_modern.enforce_cas_version() FROM PUBLIC, dwp_hris_people_runtime, dwp_hris_people_reader, dwp_hris_people_handler;
REVOKE ALL ON FUNCTION hris_people_modern.guard_publication_proof() FROM PUBLIC, dwp_hris_people_runtime, dwp_hris_people_reader, dwp_hris_people_handler;
GRANT EXECUTE ON FUNCTION hris_people_modern.reject_immutable_mutation() TO dwp_hris_people_owner, dwp_hris_people_migrator;
GRANT EXECUTE ON FUNCTION hris_people_modern.enforce_cas_version() TO dwp_hris_people_owner, dwp_hris_people_migrator;
GRANT EXECUTE ON FUNCTION hris_people_modern.guard_publication_proof() TO dwp_hris_people_owner, dwp_hris_people_migrator;

CREATE TABLE hris_people_modern.ppl_bnf_plans (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    plan_code VARCHAR(120) NOT NULL,
    display_name VARCHAR(240) NOT NULL,
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    current_revision BIGINT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_bnf_plans_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_bnf_plans_version CHECK (version >= 0),
    CONSTRAINT uk_bnf_plans_1 UNIQUE (tenant_id, plan_code),
    CONSTRAINT ck_bnf_plans_1 CHECK (lifecycle_state IN ('DRAFT','ACTIVE','RETIRED'))
);
COMMENT ON TABLE hris_people_modern.ppl_bnf_plans IS 'benefit plan aggregate | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_bnf_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_bnf_plans FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_bnf_plans USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE INDEX ix_bnf_plans_1 ON hris_people_modern.ppl_bnf_plans (tenant_id, lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_people_modern.ppl_bnf_plans FOR EACH ROW EXECUTE FUNCTION hris_people_modern.enforce_cas_version();


CREATE TABLE hris_people_modern.ppl_bnf_plan_versions (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    plan_public_id UUID NOT NULL,
    plan_revision BIGINT NOT NULL,
    lifecycle_state VARCHAR(24) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    content JSONB NOT NULL,
    content_sha256 CHAR(64) NOT NULL,
    approval_receipt_public_id UUID,
    publication_proof_id UUID,
    published_payload_sha256 CHAR(64),
    published_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_bnf_plan_versions_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_bnf_plan_versions_version CHECK (version >= 0),
    CONSTRAINT uk_bnf_plan_versions_1 UNIQUE (tenant_id, plan_public_id, plan_revision),
    CONSTRAINT fk_bnf_plan_versions_1 FOREIGN KEY (tenant_id, plan_public_id) REFERENCES hris_people_modern.ppl_bnf_plans (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_bnf_plan_versions_1 CHECK (plan_revision > 0),
    CONSTRAINT ck_bnf_plan_versions_2 CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT ck_bnf_plan_versions_3 CHECK (lifecycle_state IN ('DRAFT','VALIDATED','PUBLISHED','RETIRED')),
    CONSTRAINT ck_bnf_plan_versions_4 CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_bnf_plan_versions_5 CHECK (published_payload_sha256 IS NULL OR published_payload_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_bnf_plan_versions_6 CHECK ((lifecycle_state <> 'PUBLISHED') OR (approval_receipt_public_id IS NOT NULL AND publication_proof_id IS NOT NULL AND published_payload_sha256 IS NOT NULL AND published_at IS NOT NULL))
);
COMMENT ON TABLE hris_people_modern.ppl_bnf_plan_versions IS 'immutable benefit plan revision and publication proof | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_bnf_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_bnf_plan_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_bnf_plan_versions USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE INDEX ix_bnf_plan_versions_1 ON hris_people_modern.ppl_bnf_plan_versions (tenant_id, lifecycle_state);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_people_modern.ppl_bnf_plan_versions FOR EACH ROW EXECUTE FUNCTION hris_people_modern.reject_immutable_mutation();


CREATE TABLE hris_people_modern.ppl_bnf_enrollments (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    worker_public_id UUID NOT NULL,
    worker_owner VARCHAR(32) NOT NULL DEFAULT 'HRIS-HRM',
    plan_public_id UUID NOT NULL,
    plan_revision BIGINT NOT NULL,
    coverage_option_code VARCHAR(100) NOT NULL,
    occurrence_key VARCHAR(120) NOT NULL DEFAULT 'SINGLE',
    effective_from DATE NOT NULL,
    effective_to DATE,
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    submission_sha256 CHAR(64),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_bnf_enrollments_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_bnf_enrollments_version CHECK (version >= 0),
    CONSTRAINT uk_bnf_enrollments_1 UNIQUE (tenant_id, worker_public_id, plan_public_id, plan_revision, occurrence_key),
    CONSTRAINT fk_bnf_enrollments_1 FOREIGN KEY (tenant_id, plan_public_id, plan_revision) REFERENCES hris_people_modern.ppl_bnf_plan_versions (tenant_id, plan_public_id, plan_revision) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_bnf_enrollments_1 CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT ck_bnf_enrollments_2 CHECK (lifecycle_state IN ('DRAFT','SUBMITTED','APPROVED','DECLINED','CANCELLED','EXPIRED')),
    CONSTRAINT ck_bnf_enrollments_3 CHECK (submission_sha256 IS NULL OR submission_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_people_modern.ppl_bnf_enrollments IS 'recurrence-safe worker benefit enrollment | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_bnf_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_bnf_enrollments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_bnf_enrollments USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE INDEX ix_bnf_enrollments_1 ON hris_people_modern.ppl_bnf_enrollments (tenant_id, lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_people_modern.ppl_bnf_enrollments FOR EACH ROW EXECUTE FUNCTION hris_people_modern.enforce_cas_version();


CREATE TABLE hris_people_modern.ppl_bnf_enrollment_decisions (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    enrollment_public_id UUID NOT NULL,
    decision_ordinal INTEGER NOT NULL,
    decision_code VARCHAR(40) NOT NULL,
    reason_code VARCHAR(100),
    decision_receipt_public_id UUID NOT NULL,
    decided_by_public_id UUID NOT NULL,
    decided_at TIMESTAMPTZ NOT NULL,
    decision_payload_sha256 CHAR(64) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_bnf_enrollment_decisions_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_bnf_enrollment_decisions_version CHECK (version >= 0),
    CONSTRAINT uk_bnf_enrollment_decisions_1 UNIQUE (tenant_id, enrollment_public_id, decision_ordinal),
    CONSTRAINT fk_bnf_enrollment_decisions_1 FOREIGN KEY (tenant_id, enrollment_public_id) REFERENCES hris_people_modern.ppl_bnf_enrollments (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_bnf_enrollment_decisions_1 CHECK (decision_ordinal > 0),
    CONSTRAINT ck_bnf_enrollment_decisions_2 CHECK (decision_code IN ('APPROVED','DECLINED','CANCELLED')),
    CONSTRAINT ck_bnf_enrollment_decisions_3 CHECK (decision_payload_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_people_modern.ppl_bnf_enrollment_decisions IS 'append-only enrollment decision proof | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_bnf_enrollment_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_bnf_enrollment_decisions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_bnf_enrollment_decisions USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_people_modern.ppl_bnf_enrollment_decisions FOR EACH ROW EXECUTE FUNCTION hris_people_modern.reject_immutable_mutation();


CREATE TABLE hris_people_modern.ppl_bnf_life_events (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    worker_public_id UUID NOT NULL,
    worker_owner VARCHAR(32) NOT NULL DEFAULT 'HRIS-HRM',
    event_type VARCHAR(80) NOT NULL,
    occurred_on DATE NOT NULL,
    eligible_until DATE,
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'SUBMITTED',
    decision_code VARCHAR(40),
    decision_receipt_public_id UUID,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_bnf_life_events_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_bnf_life_events_version CHECK (version >= 0),
    CONSTRAINT ck_bnf_life_events_1 CHECK (eligible_until IS NULL OR eligible_until >= occurred_on),
    CONSTRAINT ck_bnf_life_events_2 CHECK (lifecycle_state IN ('SUBMITTED','APPROVED','DECLINED','EXPIRED','CANCELLED'))
);
COMMENT ON TABLE hris_people_modern.ppl_bnf_life_events IS 'benefit life-event lifecycle | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_bnf_life_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_bnf_life_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_bnf_life_events USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE INDEX ix_bnf_life_events_1 ON hris_people_modern.ppl_bnf_life_events (tenant_id, lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_people_modern.ppl_bnf_life_events FOR EACH ROW EXECUTE FUNCTION hris_people_modern.enforce_cas_version();


CREATE TABLE hris_people_modern.ppl_bnf_provider_requests (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    enrollment_public_id UUID NOT NULL,
    request_kind VARCHAR(40) NOT NULL,
    provider_system_public_id UUID NOT NULL,
    provider_owner VARCHAR(40) NOT NULL DEFAULT 'INTEGRATION',
    request_state VARCHAR(24) NOT NULL DEFAULT 'REQUESTED',
    attempt_no INTEGER NOT NULL DEFAULT 1,
    request_payload_sha256 CHAR(64) NOT NULL,
    correlation_id UUID NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_bnf_provider_requests_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_bnf_provider_requests_version CHECK (version >= 0),
    CONSTRAINT uk_bnf_provider_requests_1 UNIQUE (tenant_id, enrollment_public_id, request_kind, attempt_no),
    CONSTRAINT fk_bnf_provider_requests_1 FOREIGN KEY (tenant_id, enrollment_public_id) REFERENCES hris_people_modern.ppl_bnf_enrollments (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_bnf_provider_requests_1 CHECK (attempt_no > 0),
    CONSTRAINT ck_bnf_provider_requests_2 CHECK (request_state IN ('REQUESTED','DISPATCHED','ACKNOWLEDGED','FAILED_RETRYABLE','FAILED_FINAL')),
    CONSTRAINT ck_bnf_provider_requests_3 CHECK (request_payload_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_people_modern.ppl_bnf_provider_requests IS 'typed benefit provider request | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_bnf_provider_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_bnf_provider_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_bnf_provider_requests USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE INDEX ix_bnf_provider_requests_1 ON hris_people_modern.ppl_bnf_provider_requests (tenant_id, correlation_id);
CREATE INDEX ix_bnf_provider_requests_2 ON hris_people_modern.ppl_bnf_provider_requests (tenant_id, request_payload_sha256);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_people_modern.ppl_bnf_provider_requests FOR EACH ROW EXECUTE FUNCTION hris_people_modern.enforce_cas_version();


CREATE TABLE hris_people_modern.ppl_bnf_provider_receipts (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    provider_request_public_id UUID NOT NULL,
    message_public_id UUID NOT NULL,
    message_sha256 CHAR(64) NOT NULL,
    outcome_code VARCHAR(40) NOT NULL,
    provider_reference VARCHAR(240),
    received_at TIMESTAMPTZ NOT NULL,
    ack_payload JSONB NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_bnf_provider_receipts_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_bnf_provider_receipts_version CHECK (version >= 0),
    CONSTRAINT uk_bnf_provider_receipts_1 UNIQUE (tenant_id, message_public_id),
    CONSTRAINT fk_bnf_provider_receipts_1 FOREIGN KEY (tenant_id, provider_request_public_id) REFERENCES hris_people_modern.ppl_bnf_provider_requests (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_bnf_provider_receipts_1 CHECK (message_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_people_modern.ppl_bnf_provider_receipts IS 'sealed provider result receipt | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_bnf_provider_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_bnf_provider_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_bnf_provider_receipts USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE INDEX ix_bnf_provider_receipts_1 ON hris_people_modern.ppl_bnf_provider_receipts (tenant_id, message_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_people_modern.ppl_bnf_provider_receipts FOR EACH ROW EXECUTE FUNCTION hris_people_modern.reject_immutable_mutation();


CREATE TABLE hris_people_modern.ppl_cwk_engagements (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    person_public_id UUID NOT NULL,
    person_owner VARCHAR(32) NOT NULL DEFAULT 'HRIS-HRM',
    vendor_public_id UUID,
    sponsor_worker_public_id UUID NOT NULL,
    sponsor_owner VARCHAR(32) NOT NULL DEFAULT 'HRIS-HRM',
    classification_code VARCHAR(80) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    lifecycle_state VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    saga_revision BIGINT NOT NULL DEFAULT 0,
    last_access_request_public_id UUID,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_cwk_engagements_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_cwk_engagements_version CHECK (version >= 0),
    CONSTRAINT ck_cwk_engagements_1 CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT ck_cwk_engagements_2 CHECK (lifecycle_state IN ('DRAFT','SUBMITTED','CLASSIFICATION_PENDING','ACCESS_PENDING','ACTIVE','OFFBOARDING','CLOSED','REJECTED','CANCELLED')),
    CONSTRAINT ck_cwk_engagements_3 CHECK (saga_revision >= 0)
);
COMMENT ON TABLE hris_people_modern.ppl_cwk_engagements IS 'contingent engagement saga aggregate | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_cwk_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_cwk_engagements FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_cwk_engagements USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE INDEX ix_cwk_engagements_1 ON hris_people_modern.ppl_cwk_engagements (tenant_id, lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_people_modern.ppl_cwk_engagements FOR EACH ROW EXECUTE FUNCTION hris_people_modern.enforce_cas_version();


CREATE TABLE hris_people_modern.ppl_cwk_sponsor_assignments (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    engagement_public_id UUID NOT NULL,
    assignment_revision BIGINT NOT NULL,
    sponsor_worker_public_id UUID NOT NULL,
    sponsor_owner VARCHAR(32) NOT NULL DEFAULT 'HRIS-HRM',
    effective_from DATE NOT NULL,
    effective_to DATE,
    reason_code VARCHAR(80) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_cwk_sponsor_assignments_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_cwk_sponsor_assignments_version CHECK (version >= 0),
    CONSTRAINT uk_cwk_sponsor_assignments_1 UNIQUE (tenant_id, engagement_public_id, assignment_revision),
    CONSTRAINT fk_cwk_sponsor_assignments_1 FOREIGN KEY (tenant_id, engagement_public_id) REFERENCES hris_people_modern.ppl_cwk_engagements (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_cwk_sponsor_assignments_1 CHECK (assignment_revision > 0),
    CONSTRAINT ck_cwk_sponsor_assignments_2 CHECK (effective_to IS NULL OR effective_to > effective_from)
);
COMMENT ON TABLE hris_people_modern.ppl_cwk_sponsor_assignments IS 'temporal contingent sponsor assignment | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_cwk_sponsor_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_cwk_sponsor_assignments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_cwk_sponsor_assignments USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_people_modern.ppl_cwk_sponsor_assignments FOR EACH ROW EXECUTE FUNCTION hris_people_modern.reject_immutable_mutation();


CREATE TABLE hris_people_modern.ppl_cwk_classification_receipts (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    engagement_public_id UUID NOT NULL,
    message_public_id UUID NOT NULL,
    message_sha256 CHAR(64) NOT NULL,
    classification_code VARCHAR(80) NOT NULL,
    classification_owner VARCHAR(40) NOT NULL,
    classified_at TIMESTAMPTZ NOT NULL,
    outcome_code VARCHAR(40) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_cwk_classification_receipts_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_cwk_classification_receipts_version CHECK (version >= 0),
    CONSTRAINT uk_cwk_classification_receipts_1 UNIQUE (tenant_id, message_public_id),
    CONSTRAINT fk_cwk_classification_receipts_1 FOREIGN KEY (tenant_id, engagement_public_id) REFERENCES hris_people_modern.ppl_cwk_engagements (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_cwk_classification_receipts_1 CHECK (message_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_people_modern.ppl_cwk_classification_receipts IS 'contingent classification saga receipt | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_cwk_classification_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_cwk_classification_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_cwk_classification_receipts USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE INDEX ix_cwk_classification_receipts_1 ON hris_people_modern.ppl_cwk_classification_receipts (tenant_id, message_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_people_modern.ppl_cwk_classification_receipts FOR EACH ROW EXECUTE FUNCTION hris_people_modern.reject_immutable_mutation();


CREATE TABLE hris_people_modern.ppl_cwk_access_requests (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    engagement_public_id UUID NOT NULL,
    request_kind VARCHAR(24) NOT NULL,
    request_revision BIGINT NOT NULL,
    request_state VARCHAR(32) NOT NULL DEFAULT 'REQUESTED',
    target_system_public_id UUID NOT NULL,
    target_owner VARCHAR(40) NOT NULL DEFAULT 'INTEGRATION',
    requested_effective_at TIMESTAMPTZ NOT NULL,
    request_payload_sha256 CHAR(64) NOT NULL,
    correlation_id UUID NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_cwk_access_requests_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_cwk_access_requests_version CHECK (version >= 0),
    CONSTRAINT uk_cwk_access_requests_1 UNIQUE (tenant_id, engagement_public_id, request_kind, request_revision),
    CONSTRAINT fk_cwk_access_requests_1 FOREIGN KEY (tenant_id, engagement_public_id) REFERENCES hris_people_modern.ppl_cwk_engagements (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_cwk_access_requests_1 CHECK (request_kind IN ('GRANT','REVOKE','EXPIRY')),
    CONSTRAINT ck_cwk_access_requests_2 CHECK (request_revision > 0),
    CONSTRAINT ck_cwk_access_requests_3 CHECK (request_state IN ('REQUESTED','DISPATCHED','ACKNOWLEDGED','FAILED_RETRYABLE','FAILED_FINAL')),
    CONSTRAINT ck_cwk_access_requests_4 CHECK (request_payload_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_people_modern.ppl_cwk_access_requests IS 'contingent access saga request | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_cwk_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_cwk_access_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_cwk_access_requests USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE INDEX ix_cwk_access_requests_1 ON hris_people_modern.ppl_cwk_access_requests (tenant_id, correlation_id);
CREATE INDEX ix_cwk_access_requests_2 ON hris_people_modern.ppl_cwk_access_requests (tenant_id, request_payload_sha256);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_people_modern.ppl_cwk_access_requests FOR EACH ROW EXECUTE FUNCTION hris_people_modern.enforce_cas_version();


CREATE TABLE hris_people_modern.ppl_cwk_access_expiry_receipts (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    engagement_public_id UUID NOT NULL,
    access_request_public_id UUID NOT NULL,
    message_public_id UUID NOT NULL,
    message_sha256 CHAR(64) NOT NULL,
    expired_at TIMESTAMPTZ NOT NULL,
    outcome_code VARCHAR(40) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_cwk_access_expiry_receipts_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_cwk_access_expiry_receipts_version CHECK (version >= 0),
    CONSTRAINT uk_cwk_access_expiry_receipts_1 UNIQUE (tenant_id, message_public_id),
    CONSTRAINT fk_cwk_access_expiry_receipts_1 FOREIGN KEY (tenant_id, engagement_public_id) REFERENCES hris_people_modern.ppl_cwk_engagements (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT fk_cwk_access_expiry_receipts_2 FOREIGN KEY (tenant_id, access_request_public_id) REFERENCES hris_people_modern.ppl_cwk_access_requests (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_cwk_access_expiry_receipts_1 CHECK (message_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_people_modern.ppl_cwk_access_expiry_receipts IS 'sealed contingent access expiry receipt | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_cwk_access_expiry_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_cwk_access_expiry_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_cwk_access_expiry_receipts USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE INDEX ix_cwk_access_expiry_receipts_1 ON hris_people_modern.ppl_cwk_access_expiry_receipts (tenant_id, message_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_people_modern.ppl_cwk_access_expiry_receipts FOR EACH ROW EXECUTE FUNCTION hris_people_modern.reject_immutable_mutation();


CREATE TABLE hris_people_modern.ppl_hrs_cases (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    case_number VARCHAR(80) NOT NULL,
    requester_worker_public_id UUID NOT NULL,
    subject_worker_public_id UUID,
    worker_owner VARCHAR(32) NOT NULL DEFAULT 'HRIS-HRM',
    category_code VARCHAR(80) NOT NULL,
    priority_code VARCHAR(24) NOT NULL,
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'OPEN',
    assigned_agent_public_id UUID,
    sla_due_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hrs_cases_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hrs_cases_version CHECK (version >= 0),
    CONSTRAINT uk_hrs_cases_1 UNIQUE (tenant_id, case_number),
    CONSTRAINT ck_hrs_cases_1 CHECK (priority_code IN ('LOW','NORMAL','HIGH','CRITICAL')),
    CONSTRAINT ck_hrs_cases_2 CHECK (lifecycle_state IN ('OPEN','TRIAGED','ASSIGNED','WAITING','RESOLVED','CANCELLED')),
    CONSTRAINT ck_hrs_cases_3 CHECK (resolved_at IS NULL OR lifecycle_state IN ('RESOLVED','CANCELLED'))
);
COMMENT ON TABLE hris_people_modern.ppl_hrs_cases IS 'HR service case aggregate | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_hrs_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_hrs_cases FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_hrs_cases USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE INDEX ix_hrs_cases_1 ON hris_people_modern.ppl_hrs_cases (tenant_id, lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_people_modern.ppl_hrs_cases FOR EACH ROW EXECUTE FUNCTION hris_people_modern.enforce_cas_version();


CREATE TABLE hris_people_modern.ppl_hrs_case_actions (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    case_public_id UUID NOT NULL,
    action_ordinal INTEGER NOT NULL,
    action_type VARCHAR(40) NOT NULL,
    visibility VARCHAR(24) NOT NULL,
    actor_public_id UUID NOT NULL,
    actor_owner VARCHAR(32) NOT NULL,
    action_payload_sha256 CHAR(64) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hrs_case_actions_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hrs_case_actions_version CHECK (version >= 0),
    CONSTRAINT uk_hrs_case_actions_1 UNIQUE (tenant_id, case_public_id, action_ordinal),
    CONSTRAINT fk_hrs_case_actions_1 FOREIGN KEY (tenant_id, case_public_id) REFERENCES hris_people_modern.ppl_hrs_cases (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_hrs_case_actions_1 CHECK (action_ordinal > 0),
    CONSTRAINT ck_hrs_case_actions_2 CHECK (visibility IN ('REQUESTER','ASSIGNEE','HR_ONLY','AUDIT')),
    CONSTRAINT ck_hrs_case_actions_3 CHECK (action_payload_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_people_modern.ppl_hrs_case_actions IS 'ordered immutable HR case action | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_hrs_case_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_hrs_case_actions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_hrs_case_actions USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE INDEX ix_hrs_case_actions_1 ON hris_people_modern.ppl_hrs_case_actions (tenant_id, action_payload_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_people_modern.ppl_hrs_case_actions FOR EACH ROW EXECUTE FUNCTION hris_people_modern.reject_immutable_mutation();


CREATE TABLE hris_people_modern.ppl_hrs_sla_receipts (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    case_public_id UUID NOT NULL,
    message_public_id UUID NOT NULL,
    message_sha256 CHAR(64) NOT NULL,
    milestone_code VARCHAR(40) NOT NULL,
    milestone_at TIMESTAMPTZ NOT NULL,
    breached BOOLEAN NOT NULL,
    acknowledgement_code VARCHAR(40) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hrs_sla_receipts_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hrs_sla_receipts_version CHECK (version >= 0),
    CONSTRAINT uk_hrs_sla_receipts_1 UNIQUE (tenant_id, message_public_id),
    CONSTRAINT fk_hrs_sla_receipts_1 FOREIGN KEY (tenant_id, case_public_id) REFERENCES hris_people_modern.ppl_hrs_cases (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_hrs_sla_receipts_1 CHECK (message_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_people_modern.ppl_hrs_sla_receipts IS 'HR service SLA owner receipt | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_hrs_sla_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_hrs_sla_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_hrs_sla_receipts USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE INDEX ix_hrs_sla_receipts_1 ON hris_people_modern.ppl_hrs_sla_receipts (tenant_id, message_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_people_modern.ppl_hrs_sla_receipts FOR EACH ROW EXECUTE FUNCTION hris_people_modern.reject_immutable_mutation();


CREATE TABLE hris_people_modern.ppl_jny_templates (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    template_code VARCHAR(120) NOT NULL,
    display_name VARCHAR(240) NOT NULL,
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    current_revision BIGINT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_jny_templates_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_jny_templates_version CHECK (version >= 0),
    CONSTRAINT uk_jny_templates_1 UNIQUE (tenant_id, template_code),
    CONSTRAINT ck_jny_templates_1 CHECK (lifecycle_state IN ('DRAFT','ACTIVE','RETIRED'))
);
COMMENT ON TABLE hris_people_modern.ppl_jny_templates IS 'onboarding template aggregate | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_jny_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_jny_templates FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_jny_templates USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE INDEX ix_jny_templates_1 ON hris_people_modern.ppl_jny_templates (tenant_id, lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_people_modern.ppl_jny_templates FOR EACH ROW EXECUTE FUNCTION hris_people_modern.enforce_cas_version();


CREATE TABLE hris_people_modern.ppl_jny_template_versions (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    template_public_id UUID NOT NULL,
    template_revision BIGINT NOT NULL,
    lifecycle_state VARCHAR(24) NOT NULL,
    content JSONB NOT NULL,
    content_sha256 CHAR(64) NOT NULL,
    approval_receipt_public_id UUID,
    publication_proof_id UUID,
    published_payload_sha256 CHAR(64),
    published_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_jny_template_versions_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_jny_template_versions_version CHECK (version >= 0),
    CONSTRAINT uk_jny_template_versions_1 UNIQUE (tenant_id, template_public_id, template_revision),
    CONSTRAINT fk_jny_template_versions_1 FOREIGN KEY (tenant_id, template_public_id) REFERENCES hris_people_modern.ppl_jny_templates (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_jny_template_versions_1 CHECK (template_revision > 0),
    CONSTRAINT ck_jny_template_versions_2 CHECK (lifecycle_state IN ('DRAFT','VALIDATED','PUBLISHED','RETIRED')),
    CONSTRAINT ck_jny_template_versions_3 CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_jny_template_versions_4 CHECK (published_payload_sha256 IS NULL OR published_payload_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_jny_template_versions_5 CHECK ((lifecycle_state <> 'PUBLISHED') OR (approval_receipt_public_id IS NOT NULL AND publication_proof_id IS NOT NULL AND published_payload_sha256 IS NOT NULL AND published_at IS NOT NULL))
);
COMMENT ON TABLE hris_people_modern.ppl_jny_template_versions IS 'immutable onboarding template revision | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_jny_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_jny_template_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_jny_template_versions USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE INDEX ix_jny_template_versions_1 ON hris_people_modern.ppl_jny_template_versions (tenant_id, lifecycle_state);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_people_modern.ppl_jny_template_versions FOR EACH ROW EXECUTE FUNCTION hris_people_modern.reject_immutable_mutation();


CREATE TABLE hris_people_modern.ppl_jny_assignments (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    worker_public_id UUID NOT NULL,
    worker_owner VARCHAR(32) NOT NULL DEFAULT 'HRIS-HRM',
    template_public_id UUID NOT NULL,
    template_revision BIGINT NOT NULL,
    occurrence_key VARCHAR(120) NOT NULL DEFAULT 'SINGLE',
    starts_on DATE NOT NULL,
    due_on DATE,
    completed_at TIMESTAMPTZ,
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'ASSIGNED',
    completion_revision BIGINT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_jny_assignments_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_jny_assignments_version CHECK (version >= 0),
    CONSTRAINT uk_jny_assignments_1 UNIQUE (tenant_id, worker_public_id, template_public_id, template_revision, occurrence_key),
    CONSTRAINT fk_jny_assignments_1 FOREIGN KEY (tenant_id, template_public_id, template_revision) REFERENCES hris_people_modern.ppl_jny_template_versions (tenant_id, template_public_id, template_revision) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_jny_assignments_1 CHECK (due_on IS NULL OR due_on >= starts_on),
    CONSTRAINT ck_jny_assignments_2 CHECK (lifecycle_state IN ('ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED')),
    CONSTRAINT ck_jny_assignments_3 CHECK (completion_revision >= 0)
);
COMMENT ON TABLE hris_people_modern.ppl_jny_assignments IS 'recurrence-safe onboarding assignment | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_jny_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_jny_assignments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_jny_assignments USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE INDEX ix_jny_assignments_1 ON hris_people_modern.ppl_jny_assignments (tenant_id, lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_people_modern.ppl_jny_assignments FOR EACH ROW EXECUTE FUNCTION hris_people_modern.enforce_cas_version();


CREATE TABLE hris_people_modern.ppl_jny_assignment_revisions (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    assignment_public_id UUID NOT NULL,
    assignment_revision BIGINT NOT NULL,
    lifecycle_state VARCHAR(24) NOT NULL,
    completed_task_count INTEGER NOT NULL,
    total_task_count INTEGER NOT NULL,
    reduction_sha256 CHAR(64) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_jny_assignment_revisions_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_jny_assignment_revisions_version CHECK (version >= 0),
    CONSTRAINT uk_jny_assignment_revisions_1 UNIQUE (tenant_id, assignment_public_id, assignment_revision),
    CONSTRAINT fk_jny_assignment_revisions_1 FOREIGN KEY (tenant_id, assignment_public_id) REFERENCES hris_people_modern.ppl_jny_assignments (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_jny_assignment_revisions_1 CHECK (assignment_revision > 0),
    CONSTRAINT ck_jny_assignment_revisions_2 CHECK (completed_task_count >= 0),
    CONSTRAINT ck_jny_assignment_revisions_3 CHECK (total_task_count >= 0),
    CONSTRAINT ck_jny_assignment_revisions_4 CHECK (completed_task_count <= total_task_count),
    CONSTRAINT ck_jny_assignment_revisions_5 CHECK (reduction_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_jny_assignment_revisions_6 CHECK (lifecycle_state IN ('ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED'))
);
COMMENT ON TABLE hris_people_modern.ppl_jny_assignment_revisions IS 'immutable onboarding assignment reduction | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_jny_assignment_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_jny_assignment_revisions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_jny_assignment_revisions USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE INDEX ix_jny_assignment_revisions_1 ON hris_people_modern.ppl_jny_assignment_revisions (tenant_id, reduction_sha256);
CREATE INDEX ix_jny_assignment_revisions_2 ON hris_people_modern.ppl_jny_assignment_revisions (tenant_id, lifecycle_state);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_people_modern.ppl_jny_assignment_revisions FOR EACH ROW EXECUTE FUNCTION hris_people_modern.reject_immutable_mutation();


CREATE TABLE hris_people_modern.ppl_jny_assignment_tasks (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    assignment_public_id UUID NOT NULL,
    task_ordinal INTEGER NOT NULL,
    occurrence_key VARCHAR(120) NOT NULL DEFAULT 'SINGLE',
    task_type VARCHAR(80) NOT NULL,
    due_at TIMESTAMPTZ,
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    evidence_required BOOLEAN NOT NULL DEFAULT FALSE,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_jny_assignment_tasks_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_jny_assignment_tasks_version CHECK (version >= 0),
    CONSTRAINT uk_jny_assignment_tasks_1 UNIQUE (tenant_id, assignment_public_id, occurrence_key, task_ordinal),
    CONSTRAINT fk_jny_assignment_tasks_1 FOREIGN KEY (tenant_id, assignment_public_id) REFERENCES hris_people_modern.ppl_jny_assignments (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_jny_assignment_tasks_1 CHECK (task_ordinal > 0),
    CONSTRAINT ck_jny_assignment_tasks_2 CHECK (lifecycle_state IN ('PENDING','IN_PROGRESS','COMPLETED','WAIVED','CANCELLED'))
);
COMMENT ON TABLE hris_people_modern.ppl_jny_assignment_tasks IS 'typed recurrence-safe onboarding task | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_jny_assignment_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_jny_assignment_tasks FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_jny_assignment_tasks USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE INDEX ix_jny_assignment_tasks_1 ON hris_people_modern.ppl_jny_assignment_tasks (tenant_id, lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_people_modern.ppl_jny_assignment_tasks FOR EACH ROW EXECUTE FUNCTION hris_people_modern.enforce_cas_version();


CREATE TABLE hris_people_modern.ppl_jny_assignment_task_revisions (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    assignment_public_id UUID NOT NULL,
    assignment_revision BIGINT NOT NULL,
    task_public_id UUID NOT NULL,
    task_ordinal INTEGER NOT NULL,
    task_revision BIGINT NOT NULL,
    lifecycle_state VARCHAR(24) NOT NULL,
    due_at TIMESTAMPTZ,
    evidence_required BOOLEAN NOT NULL,
    task_payload_sha256 CHAR(64) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_jny_assignment_task_revisions_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_jny_assignment_task_revisions_version CHECK (version >= 0),
    CONSTRAINT uk_jny_assignment_task_revisions_1 UNIQUE (tenant_id, assignment_public_id, assignment_revision, task_ordinal, task_revision),
    CONSTRAINT fk_jny_assignment_task_revisions_1 FOREIGN KEY (tenant_id, assignment_public_id, assignment_revision) REFERENCES hris_people_modern.ppl_jny_assignment_revisions (tenant_id, assignment_public_id, assignment_revision) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT fk_jny_assignment_task_revisions_2 FOREIGN KEY (tenant_id, task_public_id) REFERENCES hris_people_modern.ppl_jny_assignment_tasks (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_jny_assignment_task_revisions_1 CHECK (task_ordinal > 0),
    CONSTRAINT ck_jny_assignment_task_revisions_2 CHECK (task_revision > 0),
    CONSTRAINT ck_jny_assignment_task_revisions_3 CHECK (task_payload_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_people_modern.ppl_jny_assignment_task_revisions IS 'typed child ordinal onboarding task revision | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_jny_assignment_task_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_jny_assignment_task_revisions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_jny_assignment_task_revisions USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE INDEX ix_jny_assignment_task_revisions_1 ON hris_people_modern.ppl_jny_assignment_task_revisions (tenant_id, task_payload_sha256);
CREATE INDEX ix_jny_assignment_task_revisions_2 ON hris_people_modern.ppl_jny_assignment_task_revisions (tenant_id, lifecycle_state);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_people_modern.ppl_jny_assignment_task_revisions FOR EACH ROW EXECUTE FUNCTION hris_people_modern.reject_immutable_mutation();


CREATE TABLE hris_people_modern.ppl_jny_task_evidence (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    task_public_id UUID NOT NULL,
    evidence_ordinal INTEGER NOT NULL,
    evidence_type VARCHAR(60) NOT NULL,
    evidence_public_id UUID,
    evidence_owner VARCHAR(40),
    evidence_sha256 CHAR(64) NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_jny_task_evidence_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_jny_task_evidence_version CHECK (version >= 0),
    CONSTRAINT uk_jny_task_evidence_1 UNIQUE (tenant_id, task_public_id, evidence_ordinal),
    CONSTRAINT fk_jny_task_evidence_1 FOREIGN KEY (tenant_id, task_public_id) REFERENCES hris_people_modern.ppl_jny_assignment_tasks (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_jny_task_evidence_1 CHECK (evidence_ordinal > 0),
    CONSTRAINT ck_jny_task_evidence_2 CHECK (evidence_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_jny_task_evidence_3 CHECK ((evidence_public_id IS NULL) = (evidence_owner IS NULL))
);
COMMENT ON TABLE hris_people_modern.ppl_jny_task_evidence IS 'immutable onboarding task evidence | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_jny_task_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_jny_task_evidence FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_jny_task_evidence USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE INDEX ix_jny_task_evidence_1 ON hris_people_modern.ppl_jny_task_evidence (tenant_id, evidence_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_people_modern.ppl_jny_task_evidence FOR EACH ROW EXECUTE FUNCTION hris_people_modern.reject_immutable_mutation();


CREATE TABLE hris_people_modern.ppl_rec_requisitions (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    requisition_code VARCHAR(120) NOT NULL,
    title VARCHAR(240) NOT NULL,
    employment_type VARCHAR(60) NOT NULL,
    hiring_manager_public_id UUID NOT NULL,
    hiring_manager_owner VARCHAR(32) NOT NULL DEFAULT 'HRIS-HRM',
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    publication_proof_id UUID,
    approval_receipt_public_id UUID,
    published_payload_sha256 CHAR(64),
    published_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_rec_requisitions_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_rec_requisitions_version CHECK (version >= 0),
    CONSTRAINT uk_rec_requisitions_1 UNIQUE (tenant_id, requisition_code),
    CONSTRAINT ck_rec_requisitions_1 CHECK (lifecycle_state IN ('DRAFT','PUBLISHED','PAUSED','CLOSED','CANCELLED')),
    CONSTRAINT ck_rec_requisitions_2 CHECK (published_payload_sha256 IS NULL OR published_payload_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_rec_requisitions_3 CHECK ((lifecycle_state <> 'PUBLISHED') OR (publication_proof_id IS NOT NULL AND approval_receipt_public_id IS NOT NULL AND published_payload_sha256 IS NOT NULL AND published_at IS NOT NULL))
);
COMMENT ON TABLE hris_people_modern.ppl_rec_requisitions IS 'requisition lifecycle with write-once publication proof | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_rec_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_rec_requisitions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_rec_requisitions USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE INDEX ix_rec_requisitions_1 ON hris_people_modern.ppl_rec_requisitions (tenant_id, lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_people_modern.ppl_rec_requisitions FOR EACH ROW EXECUTE FUNCTION hris_people_modern.enforce_cas_version();
CREATE TRIGGER guard_publication_proof BEFORE UPDATE ON hris_people_modern.ppl_rec_requisitions FOR EACH ROW EXECUTE FUNCTION hris_people_modern.guard_publication_proof();


CREATE TABLE hris_people_modern.ppl_rec_candidate_cases (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    requisition_public_id UUID NOT NULL,
    candidate_public_id UUID NOT NULL,
    candidate_owner VARCHAR(40) NOT NULL DEFAULT 'HRIS-RECRUITING',
    current_stage VARCHAR(40) NOT NULL,
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'ADMITTED',
    stage_revision BIGINT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_rec_candidate_cases_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_rec_candidate_cases_version CHECK (version >= 0),
    CONSTRAINT uk_rec_candidate_cases_1 UNIQUE (tenant_id, requisition_public_id, candidate_public_id),
    CONSTRAINT fk_rec_candidate_cases_1 FOREIGN KEY (tenant_id, requisition_public_id) REFERENCES hris_people_modern.ppl_rec_requisitions (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_rec_candidate_cases_1 CHECK (lifecycle_state IN ('ADMITTED','SCREENING','INTERVIEW','OFFERED','HIRED_PENDING_HANDOFF','HIRED','REJECTED','WITHDRAWN','CANCELLED')),
    CONSTRAINT ck_rec_candidate_cases_2 CHECK (stage_revision >= 0)
);
COMMENT ON TABLE hris_people_modern.ppl_rec_candidate_cases IS 'candidate case aggregate | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_rec_candidate_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_rec_candidate_cases FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_rec_candidate_cases USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE INDEX ix_rec_candidate_cases_1 ON hris_people_modern.ppl_rec_candidate_cases (tenant_id, lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_people_modern.ppl_rec_candidate_cases FOR EACH ROW EXECUTE FUNCTION hris_people_modern.enforce_cas_version();


CREATE TABLE hris_people_modern.ppl_rec_candidate_stage_history (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    candidate_case_public_id UUID NOT NULL,
    stage_ordinal INTEGER NOT NULL,
    from_stage VARCHAR(40),
    to_stage VARCHAR(40) NOT NULL,
    decision_receipt_public_id UUID,
    reason_code VARCHAR(80),
    transitioned_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_rec_candidate_stage_history_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_rec_candidate_stage_history_version CHECK (version >= 0),
    CONSTRAINT uk_rec_candidate_stage_history_1 UNIQUE (tenant_id, candidate_case_public_id, stage_ordinal),
    CONSTRAINT fk_rec_candidate_stage_history_1 FOREIGN KEY (tenant_id, candidate_case_public_id) REFERENCES hris_people_modern.ppl_rec_candidate_cases (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_rec_candidate_stage_history_1 CHECK (stage_ordinal > 0),
    CONSTRAINT ck_rec_candidate_stage_history_2 CHECK (from_stage IS DISTINCT FROM to_stage)
);
COMMENT ON TABLE hris_people_modern.ppl_rec_candidate_stage_history IS 'append-only candidate stage history | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_rec_candidate_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_rec_candidate_stage_history FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_rec_candidate_stage_history USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_people_modern.ppl_rec_candidate_stage_history FOR EACH ROW EXECUTE FUNCTION hris_people_modern.reject_immutable_mutation();


CREATE TABLE hris_people_modern.ppl_rec_offers (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    candidate_case_public_id UUID NOT NULL,
    offer_revision BIGINT NOT NULL,
    currency_code CHAR(3) NOT NULL,
    amount NUMERIC(19,4) NOT NULL,
    expires_at TIMESTAMPTZ,
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    issued_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_rec_offers_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_rec_offers_version CHECK (version >= 0),
    CONSTRAINT uk_rec_offers_1 UNIQUE (tenant_id, candidate_case_public_id, offer_revision),
    CONSTRAINT fk_rec_offers_1 FOREIGN KEY (tenant_id, candidate_case_public_id) REFERENCES hris_people_modern.ppl_rec_candidate_cases (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_rec_offers_1 CHECK (offer_revision > 0),
    CONSTRAINT ck_rec_offers_2 CHECK (amount >= 0),
    CONSTRAINT ck_rec_offers_3 CHECK (lifecycle_state IN ('DRAFT','ISSUED','ACCEPTED','DECLINED','WITHDRAWN','EXPIRED')),
    CONSTRAINT ck_rec_offers_4 CHECK (responded_at IS NULL OR lifecycle_state IN ('ACCEPTED','DECLINED'))
);
COMMENT ON TABLE hris_people_modern.ppl_rec_offers IS 'candidate offer lifecycle | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_rec_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_rec_offers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_rec_offers USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE INDEX ix_rec_offers_1 ON hris_people_modern.ppl_rec_offers (tenant_id, lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_people_modern.ppl_rec_offers FOR EACH ROW EXECUTE FUNCTION hris_people_modern.enforce_cas_version();


CREATE TABLE hris_people_modern.ppl_rec_hire_requests (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    candidate_case_public_id UUID NOT NULL,
    offer_public_id UUID NOT NULL,
    worker_owner VARCHAR(32) NOT NULL DEFAULT 'HRIS-HRM',
    proposed_effective_date DATE NOT NULL,
    handoff_state VARCHAR(32) NOT NULL DEFAULT 'REQUESTED',
    request_sha256 CHAR(64) NOT NULL,
    correlation_id UUID NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_rec_hire_requests_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_rec_hire_requests_version CHECK (version >= 0),
    CONSTRAINT uk_rec_hire_requests_1 UNIQUE (tenant_id, candidate_case_public_id, offer_public_id),
    CONSTRAINT fk_rec_hire_requests_1 FOREIGN KEY (tenant_id, candidate_case_public_id) REFERENCES hris_people_modern.ppl_rec_candidate_cases (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT fk_rec_hire_requests_2 FOREIGN KEY (tenant_id, offer_public_id) REFERENCES hris_people_modern.ppl_rec_offers (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_rec_hire_requests_1 CHECK (handoff_state IN ('REQUESTED','DISPATCHED','CONFIRMED','REJECTED','CANCELLED','FAILED_RETRYABLE')),
    CONSTRAINT ck_rec_hire_requests_2 CHECK (request_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_people_modern.ppl_rec_hire_requests IS 'hire handoff saga request | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_rec_hire_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_rec_hire_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_rec_hire_requests USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE INDEX ix_rec_hire_requests_1 ON hris_people_modern.ppl_rec_hire_requests (tenant_id, correlation_id);
CREATE INDEX ix_rec_hire_requests_2 ON hris_people_modern.ppl_rec_hire_requests (tenant_id, request_sha256);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_people_modern.ppl_rec_hire_requests FOR EACH ROW EXECUTE FUNCTION hris_people_modern.enforce_cas_version();


CREATE TABLE hris_people_modern.ppl_rec_hire_handoff_receipts (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    hire_request_public_id UUID NOT NULL,
    message_public_id UUID NOT NULL,
    message_sha256 CHAR(64) NOT NULL,
    worker_public_id UUID,
    effective_date DATE,
    outcome_code VARCHAR(40) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_rec_hire_handoff_receipts_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_rec_hire_handoff_receipts_version CHECK (version >= 0),
    CONSTRAINT uk_rec_hire_handoff_receipts_1 UNIQUE (tenant_id, message_public_id),
    CONSTRAINT fk_rec_hire_handoff_receipts_1 FOREIGN KEY (tenant_id, hire_request_public_id) REFERENCES hris_people_modern.ppl_rec_hire_requests (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_rec_hire_handoff_receipts_1 CHECK (message_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_rec_hire_handoff_receipts_2 CHECK ((outcome_code <> 'CONFIRMED') OR (worker_public_id IS NOT NULL AND effective_date IS NOT NULL))
);
COMMENT ON TABLE hris_people_modern.ppl_rec_hire_handoff_receipts IS 'sealed hire handoff owner acknowledgement | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_rec_hire_handoff_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_rec_hire_handoff_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_rec_hire_handoff_receipts USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE INDEX ix_rec_hire_handoff_receipts_1 ON hris_people_modern.ppl_rec_hire_handoff_receipts (tenant_id, message_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_people_modern.ppl_rec_hire_handoff_receipts FOR EACH ROW EXECUTE FUNCTION hris_people_modern.reject_immutable_mutation();


CREATE TABLE hris_people_modern.ppl_wfp_scenarios (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    scenario_code VARCHAR(120) NOT NULL,
    planning_period_start DATE NOT NULL,
    planning_period_end DATE NOT NULL,
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    current_revision BIGINT NOT NULL DEFAULT 0,
    headcount_target INTEGER,
    budget_currency CHAR(3),
    budget_amount NUMERIC(19,4),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_wfp_scenarios_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_wfp_scenarios_version CHECK (version >= 0),
    CONSTRAINT uk_wfp_scenarios_1 UNIQUE (tenant_id, scenario_code),
    CONSTRAINT ck_wfp_scenarios_1 CHECK (planning_period_end > planning_period_start),
    CONSTRAINT ck_wfp_scenarios_2 CHECK (lifecycle_state IN ('DRAFT','SIMULATED','SUBMITTED','APPROVED','PUBLISHED','CANCELLED')),
    CONSTRAINT ck_wfp_scenarios_3 CHECK (current_revision >= 0),
    CONSTRAINT ck_wfp_scenarios_4 CHECK (headcount_target IS NULL OR headcount_target >= 0),
    CONSTRAINT ck_wfp_scenarios_5 CHECK (budget_amount IS NULL OR budget_amount >= 0)
);
COMMENT ON TABLE hris_people_modern.ppl_wfp_scenarios IS 'workforce planning scenario aggregate | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_wfp_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_wfp_scenarios FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_wfp_scenarios USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE INDEX ix_wfp_scenarios_1 ON hris_people_modern.ppl_wfp_scenarios (tenant_id, lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_people_modern.ppl_wfp_scenarios FOR EACH ROW EXECUTE FUNCTION hris_people_modern.enforce_cas_version();


CREATE TABLE hris_people_modern.ppl_wfp_scenario_revisions (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    scenario_public_id UUID NOT NULL,
    scenario_revision BIGINT NOT NULL,
    lifecycle_state VARCHAR(24) NOT NULL,
    input_snapshot_public_id UUID NOT NULL,
    input_owner VARCHAR(40) NOT NULL,
    assumption_set JSONB NOT NULL,
    result_set JSONB,
    content_sha256 CHAR(64) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_wfp_scenario_revisions_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_wfp_scenario_revisions_version CHECK (version >= 0),
    CONSTRAINT uk_wfp_scenario_revisions_1 UNIQUE (tenant_id, scenario_public_id, scenario_revision),
    CONSTRAINT fk_wfp_scenario_revisions_1 FOREIGN KEY (tenant_id, scenario_public_id) REFERENCES hris_people_modern.ppl_wfp_scenarios (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_wfp_scenario_revisions_1 CHECK (scenario_revision > 0),
    CONSTRAINT ck_wfp_scenario_revisions_2 CHECK (lifecycle_state IN ('DRAFT','SIMULATED','SUBMITTED','APPROVED','PUBLISHED','CANCELLED')),
    CONSTRAINT ck_wfp_scenario_revisions_3 CHECK (content_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_people_modern.ppl_wfp_scenario_revisions IS 'immutable workforce scenario revision | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_wfp_scenario_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_wfp_scenario_revisions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_wfp_scenario_revisions USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE INDEX ix_wfp_scenario_revisions_1 ON hris_people_modern.ppl_wfp_scenario_revisions (tenant_id, content_sha256);
CREATE INDEX ix_wfp_scenario_revisions_2 ON hris_people_modern.ppl_wfp_scenario_revisions (tenant_id, lifecycle_state);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_people_modern.ppl_wfp_scenario_revisions FOR EACH ROW EXECUTE FUNCTION hris_people_modern.reject_immutable_mutation();


CREATE TABLE hris_people_modern.ppl_wfp_publish_receipts (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    scenario_public_id UUID NOT NULL,
    scenario_revision BIGINT NOT NULL,
    approval_receipt_public_id UUID NOT NULL,
    publication_proof_id UUID NOT NULL,
    published_payload_sha256 CHAR(64) NOT NULL,
    published_at TIMESTAMPTZ NOT NULL,
    publisher_public_id UUID NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_wfp_publish_receipts_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_wfp_publish_receipts_version CHECK (version >= 0),
    CONSTRAINT uk_wfp_publish_receipts_1 UNIQUE (tenant_id, scenario_public_id, scenario_revision),
    CONSTRAINT fk_wfp_publish_receipts_1 FOREIGN KEY (tenant_id, scenario_public_id, scenario_revision) REFERENCES hris_people_modern.ppl_wfp_scenario_revisions (tenant_id, scenario_public_id, scenario_revision) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_wfp_publish_receipts_1 CHECK (scenario_revision > 0),
    CONSTRAINT ck_wfp_publish_receipts_2 CHECK (published_payload_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_people_modern.ppl_wfp_publish_receipts IS 'immutable workforce scenario approval/publication ledger | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_people_modern.ppl_wfp_publish_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_people_modern.ppl_wfp_publish_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_people_modern.ppl_wfp_publish_receipts USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);
CREATE INDEX ix_wfp_publish_receipts_1 ON hris_people_modern.ppl_wfp_publish_receipts (tenant_id, published_payload_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_people_modern.ppl_wfp_publish_receipts FOR EACH ROW EXECUTE FUNCTION hris_people_modern.reject_immutable_mutation();

-- Interval overlap fences are recurrence-aware and use half-open periods.
ALTER TABLE hris_people_modern.ppl_cwk_sponsor_assignments
  ADD CONSTRAINT ex_cwk_sponsor_period EXCLUDE USING gist
  (tenant_id WITH =, engagement_public_id WITH =, daterange(effective_from,effective_to,'[)') WITH &&);
ALTER TABLE hris_people_modern.ppl_bnf_enrollments
  ADD CONSTRAINT ex_bnf_enrollment_period EXCLUDE USING gist
  (tenant_id WITH =, worker_public_id WITH =, plan_public_id WITH =, occurrence_key WITH =, daterange(effective_from,effective_to,'[)') WITH &&);

-- Exact owner-local ACL. Command runtime has no DELETE. Internal event handlers use a
-- distinct principal. Reader has no raw-table grant; G3 publishes only approved views.
REVOKE ALL ON ALL TABLES IN SCHEMA hris_people_modern FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE
  hris_people_modern.ppl_bnf_plans,
  hris_people_modern.ppl_bnf_enrollments,
  hris_people_modern.ppl_bnf_life_events,
  hris_people_modern.ppl_bnf_provider_requests,
  hris_people_modern.ppl_cwk_engagements,
  hris_people_modern.ppl_cwk_access_requests,
  hris_people_modern.ppl_hrs_cases,
  hris_people_modern.ppl_jny_templates,
  hris_people_modern.ppl_jny_assignments,
  hris_people_modern.ppl_jny_assignment_tasks,
  hris_people_modern.ppl_rec_requisitions,
  hris_people_modern.ppl_rec_candidate_cases,
  hris_people_modern.ppl_rec_offers,
  hris_people_modern.ppl_rec_hire_requests,
  hris_people_modern.ppl_wfp_scenarios
TO dwp_hris_people_runtime;
GRANT SELECT, INSERT ON TABLE
  hris_people_modern.ppl_bnf_plan_versions,
  hris_people_modern.ppl_bnf_enrollment_decisions,
  hris_people_modern.ppl_cwk_sponsor_assignments,
  hris_people_modern.ppl_hrs_case_actions,
  hris_people_modern.ppl_jny_template_versions,
  hris_people_modern.ppl_jny_assignment_revisions,
  hris_people_modern.ppl_jny_assignment_task_revisions,
  hris_people_modern.ppl_jny_task_evidence,
  hris_people_modern.ppl_rec_candidate_stage_history,
  hris_people_modern.ppl_wfp_scenario_revisions,
  hris_people_modern.ppl_wfp_publish_receipts
TO dwp_hris_people_runtime;
GRANT SELECT, UPDATE ON TABLE
  hris_people_modern.ppl_bnf_provider_requests,
  hris_people_modern.ppl_bnf_enrollments,
  hris_people_modern.ppl_bnf_life_events,
  hris_people_modern.ppl_cwk_engagements,
  hris_people_modern.ppl_cwk_access_requests,
  hris_people_modern.ppl_hrs_cases,
  hris_people_modern.ppl_rec_candidate_cases,
  hris_people_modern.ppl_rec_offers,
  hris_people_modern.ppl_rec_hire_requests
TO dwp_hris_people_handler;
GRANT SELECT, INSERT ON TABLE
  hris_people_modern.ppl_bnf_provider_receipts,
  hris_people_modern.ppl_cwk_classification_receipts,
  hris_people_modern.ppl_cwk_access_expiry_receipts,
  hris_people_modern.ppl_hrs_sla_receipts,
  hris_people_modern.ppl_rec_hire_handoff_receipts
TO dwp_hris_people_handler;
ALTER DEFAULT PRIVILEGES FOR ROLE dwp_hris_people_owner IN SCHEMA hris_people_modern REVOKE ALL ON TABLES FROM PUBLIC;

-- Fail closed on table drift, missing common physical columns, or forbidden unique correlation/hash keys.
DO $verify$
DECLARE expected TEXT[] := ARRAY['ppl_bnf_plans','ppl_bnf_plan_versions','ppl_bnf_enrollments','ppl_bnf_enrollment_decisions','ppl_bnf_life_events','ppl_bnf_provider_requests','ppl_bnf_provider_receipts','ppl_cwk_engagements','ppl_cwk_sponsor_assignments','ppl_cwk_classification_receipts','ppl_cwk_access_requests','ppl_cwk_access_expiry_receipts','ppl_hrs_cases','ppl_hrs_case_actions','ppl_hrs_sla_receipts','ppl_jny_templates','ppl_jny_template_versions','ppl_jny_assignments','ppl_jny_assignment_revisions','ppl_jny_assignment_tasks','ppl_jny_assignment_task_revisions','ppl_jny_task_evidence','ppl_rec_requisitions','ppl_rec_candidate_cases','ppl_rec_candidate_stage_history','ppl_rec_offers','ppl_rec_hire_requests','ppl_rec_hire_handoff_receipts','ppl_wfp_scenarios','ppl_wfp_scenario_revisions','ppl_wfp_publish_receipts']; actual TEXT[]; t TEXT;
BEGIN
  SELECT array_agg(tablename ORDER BY tablename) INTO actual FROM pg_tables WHERE schemaname='hris_people_modern';
  SELECT array_agg(x ORDER BY x) INTO expected FROM unnest(expected) x;
  IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'HRM exact table set mismatch expected %, actual %', expected, actual; END IF;
  FOREACH t IN ARRAY expected LOOP
    IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='hris_people_modern' AND table_name=t AND column_name IN ('tenant_id','public_id','version','created_at','updated_at')) <> 5
    THEN RAISE EXCEPTION 'required physical columns missing on %', t; END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='hris_people_modern' AND i.indisunique AND EXISTS (
      SELECT 1 FROM unnest(i.indkey) k JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k
      WHERE a.attname ~ '(correlation|sha256|digest|hash)'
    )
  ) THEN RAISE EXCEPTION 'unique correlation/hash/digest index is forbidden'; END IF;
  IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner WHERE n.nspname='hris_people_modern' AND c.relkind IN('r','p') AND r.rolname<>'dwp_hris_people_owner') THEN RAISE EXCEPTION 'HRM table owner mismatch';END IF;
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner WHERE n.nspname='hris_people_modern' AND r.rolname<>'dwp_hris_people_owner') THEN RAISE EXCEPTION 'HRM function owner mismatch';END IF;
END $verify$;
COMMIT;

-- MIGRATION NOTES
-- 1. Provision roles/extension out-of-band, profile collisions and invalid/overlapping periods, quarantine failures.
-- 2. Apply this strict, single-run owner schema in a newly allocated HRM Flyway migration under the common verification semaphore.
--    Flyway history supplies replay idempotence; direct replay or any pre-created table/index/policy/trigger/function collision fails closed.
-- 3. Backfill by tenant with RLS context; reconcile counts/digests; then add/validate any deferred legacy bridge constraints.
-- 4. Rollback is forward correction only. Never drop immutable proof/history/receipt rows.
-- 5. Cross-owner UUID references deliberately have no database FK; handlers must resolve typed owner/purpose/version receipts.
