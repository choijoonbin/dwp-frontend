-- DWP HRIS modern physical successor / TIM / authored forward-DDL blueprint v3
-- SOURCE_MANIFEST_FILE_SHA256: be4e5fc198af218db740d46b6a264644f2fd9cae686ca35c3b0cd430541f04b6
-- SOURCE_MANIFEST_SEALED_PAYLOAD_SHA256: 00bb8fba8b91addbc9dea24d0441bc70f6e6833db9997bd89e85da26984f9a0a
-- DESIGN_STATE: PRE_G3_NOT_IMPLEMENTED; PRODUCTION_STATE: NOT_AUTHORIZED_G6
-- COPY RULE: allocate a new owner migration; retain this file as design evidence; never edit G2 SQL.
BEGIN;
DO $preflight$ DECLARE role_name TEXT;role_row RECORD;expected_login BOOLEAN;BEGIN IF current_setting('server_version_num')::INTEGER<160000 THEN RAISE EXCEPTION 'PostgreSQL 16+ required';END IF;IF NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='btree_gist') THEN RAISE EXCEPTION 'btree_gist must be provisioned by DBA';END IF;FOREACH role_name IN ARRAY ARRAY['dwp_hris_time_owner','dwp_hris_time_runtime','dwp_hris_time_reader','dwp_hris_time_migrator','dwp_hris_time_handler'] LOOP SELECT * INTO role_row FROM pg_roles WHERE rolname=role_name;IF NOT FOUND THEN RAISE EXCEPTION 'required role missing: %',role_name;END IF;expected_login:=role_name<>'dwp_hris_time_owner';IF role_row.rolsuper OR role_row.rolinherit OR role_row.rolcreaterole OR role_row.rolcreatedb OR role_row.rolreplication OR role_row.rolbypassrls OR role_row.rolcanlogin IS DISTINCT FROM expected_login THEN RAISE EXCEPTION 'unsafe role attributes for % (expected LOGIN %, NOINHERIT/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS)',role_name,expected_login;END IF;END LOOP;IF current_user IS DISTINCT FROM 'dwp_hris_time_migrator' THEN RAISE EXCEPTION 'migration login must be dwp_hris_time_migrator, got %',current_user;END IF;IF NOT pg_has_role(current_user,'dwp_hris_time_owner','MEMBER') THEN RAISE EXCEPTION 'migrator must be a direct/indirect member of owner for explicit SET ROLE';END IF;END $preflight$;
SET LOCAL ROLE dwp_hris_time_owner;
CREATE SCHEMA IF NOT EXISTS hris_time_modern AUTHORIZATION dwp_hris_time_owner; REVOKE ALL ON SCHEMA hris_time_modern FROM PUBLIC; GRANT USAGE ON SCHEMA hris_time_modern TO dwp_hris_time_runtime,dwp_hris_time_reader,dwp_hris_time_handler;
DO $schema_owner$ DECLARE actual_owner TEXT; BEGIN
 SELECT r.rolname INTO actual_owner FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner WHERE n.nspname='hris_time_modern';
 IF actual_owner IS DISTINCT FROM 'dwp_hris_time_owner' THEN RAISE EXCEPTION 'schema owner mismatch: %',actual_owner; END IF;
END $schema_owner$;
CREATE FUNCTION hris_time_modern.reject_immutable_mutation() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$ BEGIN RAISE EXCEPTION 'immutable ledger % rejects %',TG_TABLE_NAME,TG_OP USING ERRCODE='55000'; END $fn$;
CREATE FUNCTION hris_time_modern.enforce_cas_version() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$ BEGIN IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.public_id IS DISTINCT FROM OLD.public_id THEN RAISE EXCEPTION 'immutable identity changed'; END IF; IF NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'CAS version must increment exactly once'; END IF; NEW.updated_at:=transaction_timestamp(); RETURN NEW; END $fn$;
REVOKE ALL ON FUNCTION hris_time_modern.reject_immutable_mutation() FROM PUBLIC,dwp_hris_time_runtime,dwp_hris_time_reader,dwp_hris_time_handler;
REVOKE ALL ON FUNCTION hris_time_modern.enforce_cas_version() FROM PUBLIC,dwp_hris_time_runtime,dwp_hris_time_reader,dwp_hris_time_handler;
GRANT EXECUTE ON FUNCTION hris_time_modern.reject_immutable_mutation() TO dwp_hris_time_owner,dwp_hris_time_migrator;
GRANT EXECUTE ON FUNCTION hris_time_modern.enforce_cas_version() TO dwp_hris_time_owner,dwp_hris_time_migrator;

CREATE TABLE hris_time_modern.tme_wfm_demand_forecasts (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    forecast_code VARCHAR(120) NOT NULL,
    organization_public_id UUID NOT NULL,
    organization_owner VARCHAR(32) NOT NULL DEFAULT 'HRIS-HRM',
    horizon_start TIMESTAMPTZ NOT NULL,
    horizon_end TIMESTAMPTZ NOT NULL,
    timezone_id VARCHAR(80) NOT NULL,
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    current_revision BIGINT NOT NULL DEFAULT 0,
    source_snapshot_public_id UUID NOT NULL,
    source_snapshot_owner VARCHAR(40) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_wfm_demand_forecasts_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_wfm_demand_forecasts_version CHECK (version>=0),
    CONSTRAINT uk_wfm_demand_forecasts_1 UNIQUE (tenant_id, forecast_code),
    CONSTRAINT ck_wfm_demand_forecasts_1 CHECK (horizon_end>horizon_start),
    CONSTRAINT ck_wfm_demand_forecasts_2 CHECK (lifecycle_state IN ('DRAFT','READY','OPTIMIZING','CLOSED','CANCELLED')),
    CONSTRAINT ck_wfm_demand_forecasts_3 CHECK (current_revision>=0)
);
COMMENT ON TABLE hris_time_modern.tme_wfm_demand_forecasts IS 'WFM demand forecast aggregate | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_time_modern.tme_wfm_demand_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_time_modern.tme_wfm_demand_forecasts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_time_modern.tme_wfm_demand_forecasts USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_wfm_demand_forecasts_1 ON hris_time_modern.tme_wfm_demand_forecasts(tenant_id,lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_time_modern.tme_wfm_demand_forecasts FOR EACH ROW EXECUTE FUNCTION hris_time_modern.enforce_cas_version();


CREATE TABLE hris_time_modern.tme_wfm_forecast_revision_counters (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    forecast_public_id UUID NOT NULL,
    forecast_revision BIGINT NOT NULL,
    input_snapshot_public_id UUID NOT NULL,
    input_snapshot_owner VARCHAR(40) NOT NULL,
    input_sha256 CHAR(64) NOT NULL,
    line_count INTEGER NOT NULL,
    revision_created_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_wfm_forecast_revision_counters_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_wfm_forecast_revision_counters_version CHECK (version>=0),
    CONSTRAINT uk_wfm_forecast_revision_counters_1 UNIQUE (tenant_id, forecast_public_id, forecast_revision),
    CONSTRAINT fk_wfm_forecast_revision_counters_1 FOREIGN KEY (tenant_id, forecast_public_id) REFERENCES hris_time_modern.tme_wfm_demand_forecasts (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_wfm_forecast_revision_counters_1 CHECK (forecast_revision>0),
    CONSTRAINT ck_wfm_forecast_revision_counters_2 CHECK (line_count>0),
    CONSTRAINT ck_wfm_forecast_revision_counters_3 CHECK (input_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_time_modern.tme_wfm_forecast_revision_counters IS 'immutable demand forecast revision fence | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_time_modern.tme_wfm_forecast_revision_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_time_modern.tme_wfm_forecast_revision_counters FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_time_modern.tme_wfm_forecast_revision_counters USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_wfm_forecast_revision_counters_1 ON hris_time_modern.tme_wfm_forecast_revision_counters(tenant_id,input_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_time_modern.tme_wfm_forecast_revision_counters FOR EACH ROW EXECUTE FUNCTION hris_time_modern.reject_immutable_mutation();


CREATE TABLE hris_time_modern.tme_wfm_demand_lines (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    forecast_public_id UUID NOT NULL,
    forecast_revision BIGINT NOT NULL,
    line_ordinal INTEGER NOT NULL,
    work_interval_start TIMESTAMPTZ NOT NULL,
    work_interval_end TIMESTAMPTZ NOT NULL,
    role_public_id UUID NOT NULL,
    role_owner VARCHAR(32) NOT NULL DEFAULT 'HRIS-HRM',
    location_public_id UUID,
    location_owner VARCHAR(32),
    required_headcount NUMERIC(12,4) NOT NULL,
    required_hours NUMERIC(12,4) NOT NULL,
    line_sha256 CHAR(64) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_wfm_demand_lines_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_wfm_demand_lines_version CHECK (version>=0),
    CONSTRAINT uk_wfm_demand_lines_1 UNIQUE (tenant_id, forecast_public_id, forecast_revision, line_ordinal),
    CONSTRAINT fk_wfm_demand_lines_1 FOREIGN KEY (tenant_id, forecast_public_id, forecast_revision) REFERENCES hris_time_modern.tme_wfm_forecast_revision_counters (tenant_id, forecast_public_id, forecast_revision) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_wfm_demand_lines_1 CHECK (forecast_revision>0),
    CONSTRAINT ck_wfm_demand_lines_2 CHECK (line_ordinal>0),
    CONSTRAINT ck_wfm_demand_lines_3 CHECK (work_interval_end>work_interval_start),
    CONSTRAINT ck_wfm_demand_lines_4 CHECK (required_headcount>=0),
    CONSTRAINT ck_wfm_demand_lines_5 CHECK (required_hours>=0),
    CONSTRAINT ck_wfm_demand_lines_6 CHECK ((location_public_id IS NULL)=(location_owner IS NULL)),
    CONSTRAINT ck_wfm_demand_lines_7 CHECK (line_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_time_modern.tme_wfm_demand_lines IS 'normalized typed demand interval line | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_time_modern.tme_wfm_demand_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_time_modern.tme_wfm_demand_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_time_modern.tme_wfm_demand_lines USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_wfm_demand_lines_1 ON hris_time_modern.tme_wfm_demand_lines(tenant_id,line_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_time_modern.tme_wfm_demand_lines FOR EACH ROW EXECUTE FUNCTION hris_time_modern.reject_immutable_mutation();


CREATE TABLE hris_time_modern.tme_wfm_optimization_requests (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    forecast_public_id UUID NOT NULL,
    forecast_revision BIGINT NOT NULL,
    request_revision BIGINT NOT NULL,
    processing_state VARCHAR(32) NOT NULL DEFAULT 'REQUESTED',
    constraint_snapshot_public_id UUID NOT NULL,
    constraint_snapshot_owner VARCHAR(40) NOT NULL,
    engine_revision VARCHAR(160) NOT NULL,
    deterministic_seed BIGINT NOT NULL,
    request_sha256 CHAR(64) NOT NULL,
    correlation_id UUID NOT NULL,
    result_candidate_public_id UUID,
    result_sha256 CHAR(64),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_wfm_optimization_requests_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_wfm_optimization_requests_version CHECK (version>=0),
    CONSTRAINT uk_wfm_optimization_requests_1 UNIQUE (tenant_id, forecast_public_id, forecast_revision, request_revision),
    CONSTRAINT fk_wfm_optimization_requests_1 FOREIGN KEY (tenant_id, forecast_public_id, forecast_revision) REFERENCES hris_time_modern.tme_wfm_forecast_revision_counters (tenant_id, forecast_public_id, forecast_revision) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_wfm_optimization_requests_1 CHECK (forecast_revision>0),
    CONSTRAINT ck_wfm_optimization_requests_2 CHECK (request_revision>0),
    CONSTRAINT ck_wfm_optimization_requests_3 CHECK (processing_state IN ('REQUESTED','DISPATCHED','RUNNING','SUCCEEDED','FAILED_RETRYABLE','FAILED_FINAL','CANCELLED')),
    CONSTRAINT ck_wfm_optimization_requests_4 CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_wfm_optimization_requests_5 CHECK (result_sha256 IS NULL OR result_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_time_modern.tme_wfm_optimization_requests IS 'WFM optimization async request lifecycle | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_time_modern.tme_wfm_optimization_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_time_modern.tme_wfm_optimization_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_time_modern.tme_wfm_optimization_requests USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_wfm_optimization_requests_1 ON hris_time_modern.tme_wfm_optimization_requests(tenant_id,request_sha256);
CREATE INDEX ix_wfm_optimization_requests_2 ON hris_time_modern.tme_wfm_optimization_requests(tenant_id,result_sha256);
CREATE INDEX ix_wfm_optimization_requests_3 ON hris_time_modern.tme_wfm_optimization_requests(tenant_id,correlation_id);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_time_modern.tme_wfm_optimization_requests FOR EACH ROW EXECUTE FUNCTION hris_time_modern.enforce_cas_version();


CREATE TABLE hris_time_modern.tme_wfm_schedule_candidates (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    forecast_public_id UUID NOT NULL,
    forecast_revision BIGINT NOT NULL,
    occurrence_key VARCHAR(120) NOT NULL,
    lifecycle_state VARCHAR(32) NOT NULL DEFAULT 'GENERATED',
    current_revision BIGINT NOT NULL DEFAULT 1,
    optimization_request_public_id UUID NOT NULL,
    latest_validation_receipt_public_id UUID,
    latest_approval_request_public_id UUID,
    canonical_schedule_period_public_id UUID,
    canonical_schedule_owner VARCHAR(40),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_wfm_schedule_candidates_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_wfm_schedule_candidates_version CHECK (version>=0),
    CONSTRAINT uk_wfm_schedule_candidates_1 UNIQUE (tenant_id, forecast_public_id, forecast_revision, occurrence_key),
    CONSTRAINT fk_wfm_schedule_candidates_1 FOREIGN KEY (tenant_id, forecast_public_id, forecast_revision) REFERENCES hris_time_modern.tme_wfm_forecast_revision_counters (tenant_id, forecast_public_id, forecast_revision) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT fk_wfm_schedule_candidates_2 FOREIGN KEY (tenant_id, optimization_request_public_id) REFERENCES hris_time_modern.tme_wfm_optimization_requests (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_wfm_schedule_candidates_1 CHECK (forecast_revision>0),
    CONSTRAINT ck_wfm_schedule_candidates_2 CHECK (current_revision>0),
    CONSTRAINT ck_wfm_schedule_candidates_3 CHECK (lifecycle_state IN ('GENERATED','VALIDATED','INVALID','SUBMITTED','APPROVED','REJECTED','PUBLISHED','CANCELLED')),
    CONSTRAINT ck_wfm_schedule_candidates_4 CHECK ((canonical_schedule_period_public_id IS NULL)=(canonical_schedule_owner IS NULL))
);
COMMENT ON TABLE hris_time_modern.tme_wfm_schedule_candidates IS 'recurrence-safe schedule candidate aggregate | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_time_modern.tme_wfm_schedule_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_time_modern.tme_wfm_schedule_candidates FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_time_modern.tme_wfm_schedule_candidates USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_wfm_schedule_candidates_1 ON hris_time_modern.tme_wfm_schedule_candidates(tenant_id,lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_time_modern.tme_wfm_schedule_candidates FOR EACH ROW EXECUTE FUNCTION hris_time_modern.enforce_cas_version();


CREATE TABLE hris_time_modern.tme_wfm_schedule_candidate_versions (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    candidate_public_id UUID NOT NULL,
    candidate_revision BIGINT NOT NULL,
    lifecycle_state VARCHAR(32) NOT NULL,
    input_snapshot_public_id UUID NOT NULL,
    input_snapshot_owner VARCHAR(40) NOT NULL,
    engine_revision VARCHAR(160) NOT NULL,
    candidate_sha256 CHAR(64) NOT NULL,
    shift_line_count INTEGER NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL,
    producer_kind VARCHAR(24) NOT NULL DEFAULT 'OWNER_ENGINE',
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_wfm_schedule_candidate_versions_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_wfm_schedule_candidate_versions_version CHECK (version>=0),
    CONSTRAINT uk_wfm_schedule_candidate_versions_1 UNIQUE (tenant_id, candidate_public_id, candidate_revision),
    CONSTRAINT fk_wfm_schedule_candidate_versions_1 FOREIGN KEY (tenant_id, candidate_public_id) REFERENCES hris_time_modern.tme_wfm_schedule_candidates (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_wfm_schedule_candidate_versions_1 CHECK (candidate_revision>0),
    CONSTRAINT ck_wfm_schedule_candidate_versions_2 CHECK (shift_line_count>0),
    CONSTRAINT ck_wfm_schedule_candidate_versions_3 CHECK (candidate_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_wfm_schedule_candidate_versions_4 CHECK (producer_kind='OWNER_ENGINE'),
    CONSTRAINT ck_wfm_schedule_candidate_versions_5 CHECK (lifecycle_state IN ('GENERATED','VALIDATED','INVALID','SUBMITTED','APPROVED','REJECTED','PUBLISHED','CANCELLED'))
);
COMMENT ON TABLE hris_time_modern.tme_wfm_schedule_candidate_versions IS 'immutable engine-produced schedule candidate revision | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_time_modern.tme_wfm_schedule_candidate_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_time_modern.tme_wfm_schedule_candidate_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_time_modern.tme_wfm_schedule_candidate_versions USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_wfm_schedule_candidate_versions_1 ON hris_time_modern.tme_wfm_schedule_candidate_versions(tenant_id,candidate_sha256);
CREATE INDEX ix_wfm_schedule_candidate_versions_2 ON hris_time_modern.tme_wfm_schedule_candidate_versions(tenant_id,lifecycle_state);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_time_modern.tme_wfm_schedule_candidate_versions FOR EACH ROW EXECUTE FUNCTION hris_time_modern.reject_immutable_mutation();


CREATE TABLE hris_time_modern.tme_wfm_candidate_shift_lines (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    candidate_public_id UUID NOT NULL,
    candidate_revision BIGINT NOT NULL,
    line_ordinal INTEGER NOT NULL,
    worker_public_id UUID,
    worker_owner VARCHAR(32),
    role_public_id UUID NOT NULL,
    role_owner VARCHAR(32) NOT NULL DEFAULT 'HRIS-HRM',
    location_public_id UUID,
    location_owner VARCHAR(32),
    shift_start TIMESTAMPTZ NOT NULL,
    shift_end TIMESTAMPTZ NOT NULL,
    break_minutes INTEGER NOT NULL DEFAULT 0,
    line_sha256 CHAR(64) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_wfm_candidate_shift_lines_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_wfm_candidate_shift_lines_version CHECK (version>=0),
    CONSTRAINT uk_wfm_candidate_shift_lines_1 UNIQUE (tenant_id, candidate_public_id, candidate_revision, line_ordinal),
    CONSTRAINT fk_wfm_candidate_shift_lines_1 FOREIGN KEY (tenant_id, candidate_public_id, candidate_revision) REFERENCES hris_time_modern.tme_wfm_schedule_candidate_versions (tenant_id, candidate_public_id, candidate_revision) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_wfm_candidate_shift_lines_1 CHECK (candidate_revision>0),
    CONSTRAINT ck_wfm_candidate_shift_lines_2 CHECK (line_ordinal>0),
    CONSTRAINT ck_wfm_candidate_shift_lines_3 CHECK (shift_end>shift_start),
    CONSTRAINT ck_wfm_candidate_shift_lines_4 CHECK (break_minutes>=0 AND break_minutes<1440),
    CONSTRAINT ck_wfm_candidate_shift_lines_5 CHECK ((worker_public_id IS NULL)=(worker_owner IS NULL)),
    CONSTRAINT ck_wfm_candidate_shift_lines_6 CHECK ((location_public_id IS NULL)=(location_owner IS NULL)),
    CONSTRAINT ck_wfm_candidate_shift_lines_7 CHECK (line_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_time_modern.tme_wfm_candidate_shift_lines IS 'typed ordinal schedule shift interval | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_time_modern.tme_wfm_candidate_shift_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_time_modern.tme_wfm_candidate_shift_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_time_modern.tme_wfm_candidate_shift_lines USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_wfm_candidate_shift_lines_1 ON hris_time_modern.tme_wfm_candidate_shift_lines(tenant_id,line_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_time_modern.tme_wfm_candidate_shift_lines FOR EACH ROW EXECUTE FUNCTION hris_time_modern.reject_immutable_mutation();


CREATE TABLE hris_time_modern.tme_wfm_constraint_evaluation_receipts (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    candidate_public_id UUID NOT NULL,
    candidate_revision BIGINT NOT NULL,
    evaluation_revision BIGINT NOT NULL,
    validation_suite_version VARCHAR(160) NOT NULL,
    constraint_snapshot_public_id UUID NOT NULL,
    constraint_snapshot_owner VARCHAR(40) NOT NULL,
    input_sha256 CHAR(64) NOT NULL,
    evaluation_sha256 CHAR(64) NOT NULL,
    blocking_violation_count INTEGER NOT NULL,
    fairness_metric_count INTEGER NOT NULL,
    validation_outcome VARCHAR(24) NOT NULL,
    evaluated_at TIMESTAMPTZ NOT NULL,
    producer_kind VARCHAR(32) NOT NULL DEFAULT 'OWNER_VALIDATOR',
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_wfm_constraint_evaluation_receipts_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_wfm_constraint_evaluation_receipts_version CHECK (version>=0),
    CONSTRAINT uk_wfm_constraint_evaluation_receipts_1 UNIQUE (tenant_id, candidate_public_id, candidate_revision, evaluation_revision),
    CONSTRAINT fk_wfm_constraint_evaluation_receipts_1 FOREIGN KEY (tenant_id, candidate_public_id, candidate_revision) REFERENCES hris_time_modern.tme_wfm_schedule_candidate_versions (tenant_id, candidate_public_id, candidate_revision) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_wfm_constraint_evaluation_receipts_1 CHECK (candidate_revision>0),
    CONSTRAINT ck_wfm_constraint_evaluation_receipts_2 CHECK (evaluation_revision>0),
    CONSTRAINT ck_wfm_constraint_evaluation_receipts_3 CHECK (blocking_violation_count>=0),
    CONSTRAINT ck_wfm_constraint_evaluation_receipts_4 CHECK (fairness_metric_count>=0),
    CONSTRAINT ck_wfm_constraint_evaluation_receipts_5 CHECK (input_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_wfm_constraint_evaluation_receipts_6 CHECK (evaluation_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_wfm_constraint_evaluation_receipts_7 CHECK (validation_outcome IN ('VALID','INVALID')),
    CONSTRAINT ck_wfm_constraint_evaluation_receipts_8 CHECK (producer_kind='OWNER_VALIDATOR'),
    CONSTRAINT ck_wfm_constraint_evaluation_receipts_9 CHECK ((validation_outcome='VALID')=(blocking_violation_count=0))
);
COMMENT ON TABLE hris_time_modern.tme_wfm_constraint_evaluation_receipts IS 'owner-produced normalized WFM validation receipt | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_time_modern.tme_wfm_constraint_evaluation_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_time_modern.tme_wfm_constraint_evaluation_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_time_modern.tme_wfm_constraint_evaluation_receipts USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_wfm_constraint_evaluation_receipts_1 ON hris_time_modern.tme_wfm_constraint_evaluation_receipts(tenant_id,input_sha256);
CREATE INDEX ix_wfm_constraint_evaluation_receipts_2 ON hris_time_modern.tme_wfm_constraint_evaluation_receipts(tenant_id,evaluation_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_time_modern.tme_wfm_constraint_evaluation_receipts FOR EACH ROW EXECUTE FUNCTION hris_time_modern.reject_immutable_mutation();


CREATE TABLE hris_time_modern.tme_wfm_constraint_violation_lines (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    evaluation_receipt_public_id UUID NOT NULL,
    violation_ordinal INTEGER NOT NULL,
    constraint_code VARCHAR(120) NOT NULL,
    severity VARCHAR(24) NOT NULL,
    subject_ref_type VARCHAR(40) NOT NULL,
    subject_public_id UUID,
    interval_start TIMESTAMPTZ,
    interval_end TIMESTAMPTZ,
    violation_sha256 CHAR(64) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_wfm_constraint_violation_lines_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_wfm_constraint_violation_lines_version CHECK (version>=0),
    CONSTRAINT uk_wfm_constraint_violation_lines_1 UNIQUE (tenant_id, evaluation_receipt_public_id, violation_ordinal),
    CONSTRAINT fk_wfm_constraint_violation_lines_1 FOREIGN KEY (tenant_id, evaluation_receipt_public_id) REFERENCES hris_time_modern.tme_wfm_constraint_evaluation_receipts (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_wfm_constraint_violation_lines_1 CHECK (violation_ordinal>0),
    CONSTRAINT ck_wfm_constraint_violation_lines_2 CHECK (severity IN ('WARNING','BLOCKING')),
    CONSTRAINT ck_wfm_constraint_violation_lines_3 CHECK ((interval_start IS NULL)=(interval_end IS NULL)),
    CONSTRAINT ck_wfm_constraint_violation_lines_4 CHECK (interval_end IS NULL OR interval_end>interval_start),
    CONSTRAINT ck_wfm_constraint_violation_lines_5 CHECK (violation_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_time_modern.tme_wfm_constraint_violation_lines IS 'normalized typed WFM constraint violation | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_time_modern.tme_wfm_constraint_violation_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_time_modern.tme_wfm_constraint_violation_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_time_modern.tme_wfm_constraint_violation_lines USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_wfm_constraint_violation_lines_1 ON hris_time_modern.tme_wfm_constraint_violation_lines(tenant_id,violation_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_time_modern.tme_wfm_constraint_violation_lines FOR EACH ROW EXECUTE FUNCTION hris_time_modern.reject_immutable_mutation();


CREATE TABLE hris_time_modern.tme_wfm_fairness_measure_values (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    evaluation_receipt_public_id UUID NOT NULL,
    measure_ordinal INTEGER NOT NULL,
    metric_code VARCHAR(120) NOT NULL,
    cohort_key VARCHAR(160) NOT NULL,
    measured_value NUMERIC(19,8) NOT NULL,
    threshold_value NUMERIC(19,8) NOT NULL,
    comparison_operator VARCHAR(8) NOT NULL,
    measure_outcome VARCHAR(24) NOT NULL,
    measure_sha256 CHAR(64) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_wfm_fairness_measure_values_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_wfm_fairness_measure_values_version CHECK (version>=0),
    CONSTRAINT uk_wfm_fairness_measure_values_1 UNIQUE (tenant_id, evaluation_receipt_public_id, measure_ordinal),
    CONSTRAINT fk_wfm_fairness_measure_values_1 FOREIGN KEY (tenant_id, evaluation_receipt_public_id) REFERENCES hris_time_modern.tme_wfm_constraint_evaluation_receipts (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_wfm_fairness_measure_values_1 CHECK (measure_ordinal>0),
    CONSTRAINT ck_wfm_fairness_measure_values_2 CHECK (comparison_operator IN ('LT','LTE','EQ','GTE','GT')),
    CONSTRAINT ck_wfm_fairness_measure_values_3 CHECK (measure_outcome IN ('PASS','FAIL')),
    CONSTRAINT ck_wfm_fairness_measure_values_4 CHECK (measure_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_time_modern.tme_wfm_fairness_measure_values IS 'normalized WFM fairness metric value | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_time_modern.tme_wfm_fairness_measure_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_time_modern.tme_wfm_fairness_measure_values FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_time_modern.tme_wfm_fairness_measure_values USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_wfm_fairness_measure_values_1 ON hris_time_modern.tme_wfm_fairness_measure_values(tenant_id,measure_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_time_modern.tme_wfm_fairness_measure_values FOR EACH ROW EXECUTE FUNCTION hris_time_modern.reject_immutable_mutation();


CREATE TABLE hris_time_modern.tme_wfm_approval_requests (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    candidate_public_id UUID NOT NULL,
    candidate_revision BIGINT NOT NULL,
    evaluation_receipt_public_id UUID NOT NULL,
    request_revision BIGINT NOT NULL,
    approval_state VARCHAR(24) NOT NULL DEFAULT 'REQUESTED',
    approval_policy_public_id UUID NOT NULL,
    approval_policy_owner VARCHAR(40) NOT NULL DEFAULT 'DWP-WORKFLOW',
    approval_receipt_public_id UUID,
    request_sha256 CHAR(64) NOT NULL,
    correlation_id UUID NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_wfm_approval_requests_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_wfm_approval_requests_version CHECK (version>=0),
    CONSTRAINT uk_wfm_approval_requests_1 UNIQUE (tenant_id, candidate_public_id, candidate_revision, request_revision),
    CONSTRAINT fk_wfm_approval_requests_1 FOREIGN KEY (tenant_id, candidate_public_id, candidate_revision) REFERENCES hris_time_modern.tme_wfm_schedule_candidate_versions (tenant_id, candidate_public_id, candidate_revision) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT fk_wfm_approval_requests_2 FOREIGN KEY (tenant_id, evaluation_receipt_public_id) REFERENCES hris_time_modern.tme_wfm_constraint_evaluation_receipts (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_wfm_approval_requests_1 CHECK (candidate_revision>0),
    CONSTRAINT ck_wfm_approval_requests_2 CHECK (request_revision>0),
    CONSTRAINT ck_wfm_approval_requests_3 CHECK (approval_state IN ('REQUESTED','PENDING','APPROVED','REJECTED','CANCELLED','FAILED_RETRYABLE')),
    CONSTRAINT ck_wfm_approval_requests_4 CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_wfm_approval_requests_5 CHECK ((approval_state<>'APPROVED') OR approval_receipt_public_id IS NOT NULL)
);
COMMENT ON TABLE hris_time_modern.tme_wfm_approval_requests IS 'WFM approval request lifecycle | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_time_modern.tme_wfm_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_time_modern.tme_wfm_approval_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_time_modern.tme_wfm_approval_requests USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_wfm_approval_requests_1 ON hris_time_modern.tme_wfm_approval_requests(tenant_id,request_sha256);
CREATE INDEX ix_wfm_approval_requests_2 ON hris_time_modern.tme_wfm_approval_requests(tenant_id,correlation_id);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_time_modern.tme_wfm_approval_requests FOR EACH ROW EXECUTE FUNCTION hris_time_modern.enforce_cas_version();


CREATE TABLE hris_time_modern.tme_wfm_schedule_publish_ledger (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    candidate_public_id UUID NOT NULL,
    candidate_revision BIGINT NOT NULL,
    evaluation_receipt_public_id UUID NOT NULL,
    approval_request_public_id UUID NOT NULL,
    approval_receipt_public_id UUID NOT NULL,
    canonical_schedule_period_public_id UUID NOT NULL,
    canonical_schedule_owner VARCHAR(40) NOT NULL DEFAULT 'HRIS-TIM-CANONICAL',
    canonical_owner_receipt_public_id UUID NOT NULL,
    same_owner_publish_token_sha256 CHAR(64) NOT NULL,
    published_payload_sha256 CHAR(64) NOT NULL,
    published_at TIMESTAMPTZ NOT NULL,
    publisher_public_id UUID NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_wfm_schedule_publish_ledger_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_wfm_schedule_publish_ledger_version CHECK (version>=0),
    CONSTRAINT uk_wfm_schedule_publish_ledger_1 UNIQUE (tenant_id, candidate_public_id, candidate_revision),
    CONSTRAINT fk_wfm_schedule_publish_ledger_1 FOREIGN KEY (tenant_id, candidate_public_id, candidate_revision) REFERENCES hris_time_modern.tme_wfm_schedule_candidate_versions (tenant_id, candidate_public_id, candidate_revision) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT fk_wfm_schedule_publish_ledger_2 FOREIGN KEY (tenant_id, evaluation_receipt_public_id) REFERENCES hris_time_modern.tme_wfm_constraint_evaluation_receipts (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT fk_wfm_schedule_publish_ledger_3 FOREIGN KEY (tenant_id, approval_request_public_id) REFERENCES hris_time_modern.tme_wfm_approval_requests (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_wfm_schedule_publish_ledger_1 CHECK (candidate_revision>0),
    CONSTRAINT ck_wfm_schedule_publish_ledger_2 CHECK (canonical_schedule_owner='HRIS-TIM-CANONICAL'),
    CONSTRAINT ck_wfm_schedule_publish_ledger_3 CHECK (same_owner_publish_token_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_wfm_schedule_publish_ledger_4 CHECK (published_payload_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_time_modern.tme_wfm_schedule_publish_ledger IS 'immutable same-owner WFM publication proof ledger | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_time_modern.tme_wfm_schedule_publish_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_time_modern.tme_wfm_schedule_publish_ledger FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_time_modern.tme_wfm_schedule_publish_ledger USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_wfm_schedule_publish_ledger_1 ON hris_time_modern.tme_wfm_schedule_publish_ledger(tenant_id,same_owner_publish_token_sha256);
CREATE INDEX ix_wfm_schedule_publish_ledger_2 ON hris_time_modern.tme_wfm_schedule_publish_ledger(tenant_id,published_payload_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_time_modern.tme_wfm_schedule_publish_ledger FOR EACH ROW EXECUTE FUNCTION hris_time_modern.reject_immutable_mutation();

-- Cross-row validation cardinality is checked at commit; callers cannot supply authoritative counts.
CREATE FUNCTION hris_time_modern.assert_wfm_validation_complete() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,hris_time_modern AS $fn$
DECLARE rid UUID; expected_blocking INTEGER;expected_fairness INTEGER;actual_blocking BIGINT;actual_fairness BIGINT;
BEGIN rid:=CASE WHEN TG_TABLE_NAME='tme_wfm_constraint_evaluation_receipts' THEN NEW.public_id ELSE NEW.evaluation_receipt_public_id END;
 SELECT blocking_violation_count,fairness_metric_count INTO expected_blocking,expected_fairness FROM hris_time_modern.tme_wfm_constraint_evaluation_receipts WHERE tenant_id=NEW.tenant_id AND public_id=rid;
 SELECT count(*) FILTER(WHERE severity='BLOCKING') INTO actual_blocking FROM hris_time_modern.tme_wfm_constraint_violation_lines WHERE tenant_id=NEW.tenant_id AND evaluation_receipt_public_id=rid;
 SELECT count(*) INTO actual_fairness FROM hris_time_modern.tme_wfm_fairness_measure_values WHERE tenant_id=NEW.tenant_id AND evaluation_receipt_public_id=rid;
 IF expected_blocking IS NULL OR expected_blocking<>actual_blocking OR expected_fairness<>actual_fairness THEN RAISE EXCEPTION 'incomplete WFM normalized validation %',rid; END IF; RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION hris_time_modern.assert_wfm_validation_complete() FROM PUBLIC,dwp_hris_time_runtime,dwp_hris_time_reader,dwp_hris_time_handler;
GRANT EXECUTE ON FUNCTION hris_time_modern.assert_wfm_validation_complete() TO dwp_hris_time_owner,dwp_hris_time_migrator;
CREATE CONSTRAINT TRIGGER assert_validation_header_complete AFTER INSERT ON hris_time_modern.tme_wfm_constraint_evaluation_receipts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hris_time_modern.assert_wfm_validation_complete();
CREATE CONSTRAINT TRIGGER assert_validation_violation_complete AFTER INSERT ON hris_time_modern.tme_wfm_constraint_violation_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hris_time_modern.assert_wfm_validation_complete();
CREATE CONSTRAINT TRIGGER assert_validation_fairness_complete AFTER INSERT ON hris_time_modern.tme_wfm_fairness_measure_values DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hris_time_modern.assert_wfm_validation_complete();

-- Half-open interval exclusion prevents worker double-booking within one immutable candidate revision.
ALTER TABLE hris_time_modern.tme_wfm_candidate_shift_lines ADD CONSTRAINT ex_wfm_worker_shift_overlap EXCLUDE USING gist(tenant_id WITH =,candidate_public_id WITH =,candidate_revision WITH =,worker_public_id WITH =,tstzrange(shift_start,shift_end,'[)') WITH &&) WHERE(worker_public_id IS NOT NULL);

-- Exact ACL: API command role cannot DELETE or write engine output; event handler can
-- only CAS its requests/roots and append normalized output. Reader gets G3 views only.
REVOKE ALL ON ALL TABLES IN SCHEMA hris_time_modern FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON TABLE hris_time_modern.tme_wfm_demand_forecasts,hris_time_modern.tme_wfm_optimization_requests,hris_time_modern.tme_wfm_approval_requests TO dwp_hris_time_runtime;
GRANT SELECT,INSERT ON TABLE hris_time_modern.tme_wfm_forecast_revision_counters,hris_time_modern.tme_wfm_demand_lines,hris_time_modern.tme_wfm_schedule_publish_ledger TO dwp_hris_time_runtime;
GRANT SELECT ON TABLE hris_time_modern.tme_wfm_schedule_candidates,hris_time_modern.tme_wfm_schedule_candidate_versions,hris_time_modern.tme_wfm_candidate_shift_lines,hris_time_modern.tme_wfm_constraint_evaluation_receipts,hris_time_modern.tme_wfm_constraint_violation_lines,hris_time_modern.tme_wfm_fairness_measure_values TO dwp_hris_time_runtime;
GRANT SELECT,UPDATE ON TABLE hris_time_modern.tme_wfm_optimization_requests,hris_time_modern.tme_wfm_approval_requests,hris_time_modern.tme_wfm_schedule_candidates TO dwp_hris_time_handler;
GRANT SELECT,INSERT ON TABLE hris_time_modern.tme_wfm_schedule_candidate_versions,hris_time_modern.tme_wfm_candidate_shift_lines,hris_time_modern.tme_wfm_constraint_evaluation_receipts,hris_time_modern.tme_wfm_constraint_violation_lines,hris_time_modern.tme_wfm_fairness_measure_values TO dwp_hris_time_handler;
ALTER DEFAULT PRIVILEGES FOR ROLE dwp_hris_time_owner IN SCHEMA hris_time_modern REVOKE ALL ON TABLES FROM PUBLIC;

-- Fail closed on exact table set, common shape and correlation/hash uniqueness.
DO $verify$ DECLARE expected TEXT[]:=ARRAY['tme_wfm_demand_forecasts','tme_wfm_forecast_revision_counters','tme_wfm_demand_lines','tme_wfm_optimization_requests','tme_wfm_schedule_candidates','tme_wfm_schedule_candidate_versions','tme_wfm_candidate_shift_lines','tme_wfm_constraint_evaluation_receipts','tme_wfm_constraint_violation_lines','tme_wfm_fairness_measure_values','tme_wfm_approval_requests','tme_wfm_schedule_publish_ledger'];actual TEXT[];t TEXT; BEGIN SELECT array_agg(tablename ORDER BY tablename) INTO actual FROM pg_tables WHERE schemaname='hris_time_modern';SELECT array_agg(x ORDER BY x) INTO expected FROM unnest(expected)x;IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'TIM exact table set mismatch expected %, actual %',expected,actual;END IF;FOREACH t IN ARRAY expected LOOP IF(SELECT count(*) FROM information_schema.columns WHERE table_schema='hris_time_modern' AND table_name=t AND column_name IN('tenant_id','public_id','version','created_at','updated_at'))<>5 THEN RAISE EXCEPTION 'required physical columns missing on %',t;END IF;END LOOP;IF EXISTS(SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='hris_time_modern' AND i.indisunique AND EXISTS(SELECT 1 FROM unnest(i.indkey)k JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k WHERE a.attname~'(correlation|sha256|digest|hash)'))THEN RAISE EXCEPTION 'unique correlation/hash/digest index is forbidden';END IF;IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner WHERE n.nspname='hris_time_modern' AND c.relkind IN('r','p') AND r.rolname<>'dwp_hris_time_owner')THEN RAISE EXCEPTION 'TIM table owner mismatch';END IF;IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner WHERE n.nspname='hris_time_modern' AND r.rolname<>'dwp_hris_time_owner')THEN RAISE EXCEPTION 'TIM function owner mismatch';END IF;END $verify$;
COMMIT;

-- MIGRATION NOTES
-- 1. Engine output is normalized into candidate revision/shift lines; validation is normalized into receipt/violation/fairness lines. Caller counts/outcomes are never authoritative.
-- 2. Publish locks candidate+revision, refetches local validation and approved request, invokes the typed same-service canonical schedule owner port, and appends the immutable publish ledger.
-- 3. Provision roles/extension and apply a strict, single-run newly allocated TIM migration under the common verification semaphore; never edit G2.
--    Flyway history supplies replay idempotence; direct replay or any pre-created table/index/policy/trigger/function collision fails closed.
-- 4. Profile timezone/DST and overlap anomalies; quarantine rather than coerce. Recurrence keys preserve legitimate repeated forecast periods.
-- 5. Rollback is forward correction; published ledgers, engine revisions and validation evidence are never deleted.
