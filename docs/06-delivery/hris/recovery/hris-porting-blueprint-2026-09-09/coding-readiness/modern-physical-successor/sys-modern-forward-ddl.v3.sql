-- DWP HRIS modern physical successor / SYS / authored forward-DDL blueprint v3
-- SOURCE_MANIFEST_FILE_SHA256: be4e5fc198af218db740d46b6a264644f2fd9cae686ca35c3b0cd430541f04b6
-- SOURCE_MANIFEST_SEALED_PAYLOAD_SHA256: 00bb8fba8b91addbc9dea24d0441bc70f6e6833db9997bd89e85da26984f9a0a
-- DESIGN_STATE: PRE_G3_NOT_IMPLEMENTED; PRODUCTION_STATE: NOT_AUTHORIZED_G6
-- AI BOUNDARY: typed references to DWP-AI-GOVERNANCE; no duplicated governance authority; fail closed before G6.
-- LISTENING BOUNDARY: four owner-local schemas; no cross-database transaction or protected identity leakage.
-- COPY RULE: split into newly allocated owner-stream migrations; retain this file as design evidence; never edit G2 SQL.
BEGIN;
DO $preflight$ DECLARE role_name TEXT;role_row RECORD;expected_login BOOLEAN;BEGIN
 IF current_setting('server_version_num')::INTEGER<160000 THEN RAISE EXCEPTION 'PostgreSQL 16+ required'; END IF;
 FOREACH role_name IN ARRAY ARRAY['dwp_hris_sys_migrator','dwp_hris_ai_owner','dwp_hris_ai_runtime','dwp_hris_ai_reader','dwp_hris_ai_migrator','dwp_hris_ai_handler','dwp_hris_analytics_owner','dwp_hris_analytics_runtime','dwp_hris_analytics_reader','dwp_hris_analytics_migrator','dwp_hris_analytics_handler','dwp_hris_configuration_owner','dwp_hris_configuration_runtime','dwp_hris_configuration_reader','dwp_hris_configuration_migrator','dwp_hris_configuration_handler','dwp_hris_listening_protected_owner','dwp_hris_listening_protected_runtime','dwp_hris_listening_protected_reader','dwp_hris_listening_protected_migrator','dwp_hris_listening_protected_handler','dwp_hris_listening_erasure_runtime','dwp_hris_insights_owner','dwp_hris_insights_projection_runtime','dwp_hris_insights_query_runtime','dwp_hris_insights_migrator','dwp_hris_participation_issuer_owner','dwp_hris_participation_issuer_runtime','dwp_hris_participation_issuer_reader','dwp_hris_participation_issuer_migrator'] LOOP
  SELECT * INTO role_row FROM pg_roles WHERE rolname=role_name;
  IF NOT FOUND THEN RAISE EXCEPTION 'required role missing: %',role_name;END IF;
  expected_login:=right(role_name,6)<>'_owner';
  IF role_row.rolsuper OR role_row.rolinherit OR role_row.rolcreaterole OR role_row.rolcreatedb OR role_row.rolreplication OR role_row.rolbypassrls OR role_row.rolcanlogin IS DISTINCT FROM expected_login THEN RAISE EXCEPTION 'unsafe role attributes for % (expected LOGIN %, NOINHERIT/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS)',role_name,expected_login;END IF;
 END LOOP;
 IF current_user IS DISTINCT FROM 'dwp_hris_sys_migrator' THEN RAISE EXCEPTION 'migration login must be dwp_hris_sys_migrator, got %',current_user;END IF;
 FOREACH role_name IN ARRAY ARRAY['dwp_hris_ai_owner','dwp_hris_analytics_owner','dwp_hris_configuration_owner','dwp_hris_listening_protected_owner','dwp_hris_insights_owner','dwp_hris_participation_issuer_owner'] LOOP IF NOT pg_has_role(current_user,role_name,'MEMBER') THEN RAISE EXCEPTION 'SYS migrator lacks SET ROLE membership in %',role_name;END IF;END LOOP;
END $preflight$;
SET LOCAL ROLE dwp_hris_ai_owner;
CREATE SCHEMA IF NOT EXISTS hris_ai_modern AUTHORIZATION dwp_hris_ai_owner; REVOKE ALL ON SCHEMA hris_ai_modern FROM PUBLIC; GRANT USAGE ON SCHEMA hris_ai_modern TO dwp_hris_ai_runtime,dwp_hris_ai_reader,dwp_hris_ai_handler;
DO $schema_ai$ DECLARE actual_owner TEXT; BEGIN SELECT r.rolname INTO actual_owner FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner WHERE n.nspname='hris_ai_modern'; IF actual_owner IS DISTINCT FROM 'dwp_hris_ai_owner' THEN RAISE EXCEPTION 'schema owner mismatch: %',actual_owner; END IF; END $schema_ai$;
CREATE FUNCTION hris_ai_modern.reject_immutable_mutation() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$ BEGIN RAISE EXCEPTION 'immutable ledger % rejects %',TG_TABLE_NAME,TG_OP USING ERRCODE='55000'; END $fn$;
CREATE FUNCTION hris_ai_modern.enforce_cas_version() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$ BEGIN IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.public_id IS DISTINCT FROM OLD.public_id THEN RAISE EXCEPTION 'immutable identity changed'; END IF; IF NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'CAS version must increment exactly once'; END IF; NEW.updated_at:=transaction_timestamp(); RETURN NEW; END $fn$;
REVOKE ALL ON FUNCTION hris_ai_modern.reject_immutable_mutation() FROM PUBLIC,dwp_hris_ai_runtime,dwp_hris_ai_reader,dwp_hris_ai_handler; REVOKE ALL ON FUNCTION hris_ai_modern.enforce_cas_version() FROM PUBLIC,dwp_hris_ai_runtime,dwp_hris_ai_reader,dwp_hris_ai_handler;
GRANT EXECUTE ON FUNCTION hris_ai_modern.reject_immutable_mutation() TO dwp_hris_ai_owner,dwp_hris_ai_migrator; GRANT EXECUTE ON FUNCTION hris_ai_modern.enforce_cas_version() TO dwp_hris_ai_owner,dwp_hris_ai_migrator;
SET LOCAL ROLE dwp_hris_analytics_owner;
CREATE SCHEMA IF NOT EXISTS hris_analytics_modern AUTHORIZATION dwp_hris_analytics_owner; REVOKE ALL ON SCHEMA hris_analytics_modern FROM PUBLIC; GRANT USAGE ON SCHEMA hris_analytics_modern TO dwp_hris_analytics_runtime,dwp_hris_analytics_reader,dwp_hris_analytics_handler;
DO $schema_analytics$ DECLARE actual_owner TEXT; BEGIN SELECT r.rolname INTO actual_owner FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner WHERE n.nspname='hris_analytics_modern'; IF actual_owner IS DISTINCT FROM 'dwp_hris_analytics_owner' THEN RAISE EXCEPTION 'schema owner mismatch: %',actual_owner; END IF; END $schema_analytics$;
CREATE FUNCTION hris_analytics_modern.reject_immutable_mutation() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$ BEGIN RAISE EXCEPTION 'immutable ledger % rejects %',TG_TABLE_NAME,TG_OP USING ERRCODE='55000'; END $fn$;
CREATE FUNCTION hris_analytics_modern.enforce_cas_version() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$ BEGIN IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.public_id IS DISTINCT FROM OLD.public_id THEN RAISE EXCEPTION 'immutable identity changed'; END IF; IF NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'CAS version must increment exactly once'; END IF; NEW.updated_at:=transaction_timestamp(); RETURN NEW; END $fn$;
REVOKE ALL ON FUNCTION hris_analytics_modern.reject_immutable_mutation() FROM PUBLIC,dwp_hris_analytics_runtime,dwp_hris_analytics_reader,dwp_hris_analytics_handler; REVOKE ALL ON FUNCTION hris_analytics_modern.enforce_cas_version() FROM PUBLIC,dwp_hris_analytics_runtime,dwp_hris_analytics_reader,dwp_hris_analytics_handler;
GRANT EXECUTE ON FUNCTION hris_analytics_modern.reject_immutable_mutation() TO dwp_hris_analytics_owner,dwp_hris_analytics_migrator; GRANT EXECUTE ON FUNCTION hris_analytics_modern.enforce_cas_version() TO dwp_hris_analytics_owner,dwp_hris_analytics_migrator;
SET LOCAL ROLE dwp_hris_configuration_owner;
CREATE SCHEMA IF NOT EXISTS hris_configuration AUTHORIZATION dwp_hris_configuration_owner; REVOKE ALL ON SCHEMA hris_configuration FROM PUBLIC; GRANT USAGE ON SCHEMA hris_configuration TO dwp_hris_configuration_runtime,dwp_hris_configuration_reader,dwp_hris_configuration_handler;
DO $schema_config$ DECLARE actual_owner TEXT; BEGIN SELECT r.rolname INTO actual_owner FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner WHERE n.nspname='hris_configuration'; IF actual_owner IS DISTINCT FROM 'dwp_hris_configuration_owner' THEN RAISE EXCEPTION 'schema owner mismatch: %',actual_owner; END IF; END $schema_config$;
CREATE FUNCTION hris_configuration.reject_immutable_mutation() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$ BEGIN RAISE EXCEPTION 'immutable ledger % rejects %',TG_TABLE_NAME,TG_OP USING ERRCODE='55000'; END $fn$;
CREATE FUNCTION hris_configuration.enforce_cas_version() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$ BEGIN IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.public_id IS DISTINCT FROM OLD.public_id THEN RAISE EXCEPTION 'immutable identity changed'; END IF; IF NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'CAS version must increment exactly once'; END IF; NEW.updated_at:=transaction_timestamp(); RETURN NEW; END $fn$;
CREATE FUNCTION hris_configuration.guard_outbox_delivery_transition() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$ BEGIN IF TG_OP='DELETE' THEN RAISE EXCEPTION 'outbox rows cannot be deleted';END IF;IF (to_jsonb(NEW)-ARRAY['delivery_state','version','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['delivery_state','version','updated_at']) OR OLD.delivery_state<>'PENDING' OR NEW.delivery_state NOT IN('PUBLISHED','QUARANTINED') OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'outbox permits one payload-preserving PENDING terminal CAS';END IF;NEW.updated_at:=transaction_timestamp();RETURN NEW;END $fn$;
REVOKE ALL ON FUNCTION hris_configuration.reject_immutable_mutation() FROM PUBLIC,dwp_hris_configuration_runtime,dwp_hris_configuration_reader,dwp_hris_configuration_handler; REVOKE ALL ON FUNCTION hris_configuration.enforce_cas_version() FROM PUBLIC,dwp_hris_configuration_runtime,dwp_hris_configuration_reader,dwp_hris_configuration_handler; REVOKE ALL ON FUNCTION hris_configuration.guard_outbox_delivery_transition() FROM PUBLIC,dwp_hris_configuration_runtime,dwp_hris_configuration_reader,dwp_hris_configuration_handler;
GRANT EXECUTE ON FUNCTION hris_configuration.reject_immutable_mutation() TO dwp_hris_configuration_owner,dwp_hris_configuration_migrator; GRANT EXECUTE ON FUNCTION hris_configuration.enforce_cas_version() TO dwp_hris_configuration_owner,dwp_hris_configuration_migrator; GRANT EXECUTE ON FUNCTION hris_configuration.guard_outbox_delivery_transition() TO dwp_hris_configuration_owner,dwp_hris_configuration_migrator;
SET LOCAL ROLE dwp_hris_listening_protected_owner;
CREATE SCHEMA IF NOT EXISTS hris_listening_protected AUTHORIZATION dwp_hris_listening_protected_owner; REVOKE ALL ON SCHEMA hris_listening_protected FROM PUBLIC; GRANT USAGE ON SCHEMA hris_listening_protected TO dwp_hris_listening_protected_runtime,dwp_hris_listening_protected_reader,dwp_hris_listening_protected_handler,dwp_hris_listening_erasure_runtime;
DO $schema_protected$ DECLARE actual_owner TEXT; BEGIN SELECT r.rolname INTO actual_owner FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner WHERE n.nspname='hris_listening_protected'; IF actual_owner IS DISTINCT FROM 'dwp_hris_listening_protected_owner' THEN RAISE EXCEPTION 'schema owner mismatch: %',actual_owner; END IF; END $schema_protected$;
CREATE FUNCTION hris_listening_protected.reject_immutable_mutation() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$ BEGIN RAISE EXCEPTION 'immutable ledger % rejects %',TG_TABLE_NAME,TG_OP USING ERRCODE='55000'; END $fn$;
CREATE FUNCTION hris_listening_protected.enforce_cas_version() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$ BEGIN IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.public_id IS DISTINCT FROM OLD.public_id THEN RAISE EXCEPTION 'immutable identity changed'; END IF; IF NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'CAS version must increment exactly once'; END IF; NEW.updated_at:=transaction_timestamp(); RETURN NEW; END $fn$;
CREATE FUNCTION hris_listening_protected.guard_outbox_delivery_transition() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$ BEGIN IF TG_OP='DELETE' THEN RAISE EXCEPTION 'outbox rows cannot be deleted';END IF;IF (to_jsonb(NEW)-ARRAY['delivery_state','version','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['delivery_state','version','updated_at']) OR OLD.delivery_state<>'PENDING' OR NEW.delivery_state NOT IN('PUBLISHED','QUARANTINED') OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'outbox permits one payload-preserving PENDING terminal CAS';END IF;NEW.updated_at:=transaction_timestamp();RETURN NEW;END $fn$;
REVOKE ALL ON FUNCTION hris_listening_protected.reject_immutable_mutation() FROM PUBLIC,dwp_hris_listening_protected_runtime,dwp_hris_listening_protected_reader,dwp_hris_listening_protected_handler,dwp_hris_listening_erasure_runtime; REVOKE ALL ON FUNCTION hris_listening_protected.enforce_cas_version() FROM PUBLIC,dwp_hris_listening_protected_runtime,dwp_hris_listening_protected_reader,dwp_hris_listening_protected_handler,dwp_hris_listening_erasure_runtime; REVOKE ALL ON FUNCTION hris_listening_protected.guard_outbox_delivery_transition() FROM PUBLIC,dwp_hris_listening_protected_runtime,dwp_hris_listening_protected_reader,dwp_hris_listening_protected_handler,dwp_hris_listening_erasure_runtime;
GRANT EXECUTE ON FUNCTION hris_listening_protected.reject_immutable_mutation() TO dwp_hris_listening_protected_owner,dwp_hris_listening_protected_migrator; GRANT EXECUTE ON FUNCTION hris_listening_protected.enforce_cas_version() TO dwp_hris_listening_protected_owner,dwp_hris_listening_protected_migrator; GRANT EXECUTE ON FUNCTION hris_listening_protected.guard_outbox_delivery_transition() TO dwp_hris_listening_protected_owner,dwp_hris_listening_protected_migrator;
SET LOCAL ROLE dwp_hris_insights_owner;
CREATE SCHEMA IF NOT EXISTS hris_insights AUTHORIZATION dwp_hris_insights_owner; REVOKE ALL ON SCHEMA hris_insights FROM PUBLIC; GRANT USAGE ON SCHEMA hris_insights TO dwp_hris_insights_projection_runtime,dwp_hris_insights_query_runtime;
DO $schema_insights$ DECLARE actual_owner TEXT; BEGIN SELECT r.rolname INTO actual_owner FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner WHERE n.nspname='hris_insights'; IF actual_owner IS DISTINCT FROM 'dwp_hris_insights_owner' THEN RAISE EXCEPTION 'schema owner mismatch: %',actual_owner; END IF; END $schema_insights$;
CREATE FUNCTION hris_insights.reject_immutable_mutation() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$ BEGIN RAISE EXCEPTION 'immutable ledger % rejects %',TG_TABLE_NAME,TG_OP USING ERRCODE='55000'; END $fn$;
CREATE FUNCTION hris_insights.enforce_cas_version() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$ BEGIN IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.public_id IS DISTINCT FROM OLD.public_id THEN RAISE EXCEPTION 'immutable identity changed'; END IF; IF NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'CAS version must increment exactly once'; END IF; NEW.updated_at:=transaction_timestamp(); RETURN NEW; END $fn$;
CREATE FUNCTION hris_insights.guard_outbox_delivery_transition() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$ BEGIN IF TG_OP='DELETE' THEN RAISE EXCEPTION 'outbox rows cannot be deleted';END IF;IF (to_jsonb(NEW)-ARRAY['delivery_state','version','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['delivery_state','version','updated_at']) OR OLD.delivery_state<>'PENDING' OR NEW.delivery_state NOT IN('PUBLISHED','QUARANTINED') OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'outbox permits one payload-preserving PENDING terminal CAS';END IF;NEW.updated_at:=transaction_timestamp();RETURN NEW;END $fn$;
REVOKE ALL ON FUNCTION hris_insights.reject_immutable_mutation() FROM PUBLIC,dwp_hris_insights_projection_runtime,dwp_hris_insights_query_runtime; REVOKE ALL ON FUNCTION hris_insights.enforce_cas_version() FROM PUBLIC,dwp_hris_insights_projection_runtime,dwp_hris_insights_query_runtime; REVOKE ALL ON FUNCTION hris_insights.guard_outbox_delivery_transition() FROM PUBLIC,dwp_hris_insights_projection_runtime,dwp_hris_insights_query_runtime;
GRANT EXECUTE ON FUNCTION hris_insights.reject_immutable_mutation() TO dwp_hris_insights_owner,dwp_hris_insights_migrator; GRANT EXECUTE ON FUNCTION hris_insights.enforce_cas_version() TO dwp_hris_insights_owner,dwp_hris_insights_migrator; GRANT EXECUTE ON FUNCTION hris_insights.guard_outbox_delivery_transition() TO dwp_hris_insights_owner,dwp_hris_insights_migrator;
SET LOCAL ROLE dwp_hris_participation_issuer_owner;
CREATE SCHEMA IF NOT EXISTS hris_participation_issuer AUTHORIZATION dwp_hris_participation_issuer_owner; REVOKE ALL ON SCHEMA hris_participation_issuer FROM PUBLIC; GRANT USAGE ON SCHEMA hris_participation_issuer TO dwp_hris_participation_issuer_runtime,dwp_hris_participation_issuer_reader;
DO $schema_issuer$ DECLARE actual_owner TEXT; BEGIN SELECT r.rolname INTO actual_owner FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner WHERE n.nspname='hris_participation_issuer'; IF actual_owner IS DISTINCT FROM 'dwp_hris_participation_issuer_owner' THEN RAISE EXCEPTION 'schema owner mismatch: %',actual_owner; END IF; END $schema_issuer$;
CREATE FUNCTION hris_participation_issuer.reject_immutable_mutation() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$ BEGIN RAISE EXCEPTION 'immutable ledger % rejects %',TG_TABLE_NAME,TG_OP USING ERRCODE='55000'; END $fn$;
CREATE FUNCTION hris_participation_issuer.enforce_cas_version() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$ BEGIN IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.public_id IS DISTINCT FROM OLD.public_id THEN RAISE EXCEPTION 'immutable identity changed'; END IF; IF NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'CAS version must increment exactly once'; END IF; NEW.updated_at:=transaction_timestamp(); RETURN NEW; END $fn$;
CREATE FUNCTION hris_participation_issuer.guard_outbox_delivery_transition() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$ BEGIN IF TG_OP='DELETE' THEN RAISE EXCEPTION 'outbox rows cannot be deleted';END IF;IF (to_jsonb(NEW)-ARRAY['delivery_state','version','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['delivery_state','version','updated_at']) OR OLD.delivery_state<>'PENDING' OR NEW.delivery_state NOT IN('PUBLISHED','QUARANTINED') OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'outbox permits one payload-preserving PENDING terminal CAS';END IF;NEW.updated_at:=transaction_timestamp();RETURN NEW;END $fn$;
REVOKE ALL ON FUNCTION hris_participation_issuer.reject_immutable_mutation() FROM PUBLIC,dwp_hris_participation_issuer_runtime,dwp_hris_participation_issuer_reader; REVOKE ALL ON FUNCTION hris_participation_issuer.enforce_cas_version() FROM PUBLIC,dwp_hris_participation_issuer_runtime,dwp_hris_participation_issuer_reader; REVOKE ALL ON FUNCTION hris_participation_issuer.guard_outbox_delivery_transition() FROM PUBLIC,dwp_hris_participation_issuer_runtime,dwp_hris_participation_issuer_reader;
GRANT EXECUTE ON FUNCTION hris_participation_issuer.reject_immutable_mutation() TO dwp_hris_participation_issuer_owner,dwp_hris_participation_issuer_migrator; GRANT EXECUTE ON FUNCTION hris_participation_issuer.enforce_cas_version() TO dwp_hris_participation_issuer_owner,dwp_hris_participation_issuer_migrator; GRANT EXECUTE ON FUNCTION hris_participation_issuer.guard_outbox_delivery_transition() TO dwp_hris_participation_issuer_owner,dwp_hris_participation_issuer_migrator;

SET LOCAL ROLE dwp_hris_ai_owner;

CREATE TABLE hris_ai_modern.sys_hris_ai_use_policies (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    use_case_key VARCHAR(160) NOT NULL,
    risk_class VARCHAR(24) NOT NULL,
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    current_revision BIGINT NOT NULL DEFAULT 0,
    governance_policy_public_id UUID NOT NULL,
    governance_policy_owner VARCHAR(40) NOT NULL DEFAULT 'DWP-AI-GOVERNANCE',
    governance_policy_revision VARCHAR(120) NOT NULL,
    impact_assessment_receipt_public_id UUID NOT NULL,
    conformity_receipt_public_id UUID,
    monitoring_plan_receipt_public_id UUID NOT NULL,
    human_oversight_mode VARCHAR(40) NOT NULL,
    affected_worker_disclosure_required BOOLEAN NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    kill_switch_receipt_public_id UUID,
    suspended_at TIMESTAMPTZ,
    incident_binding_public_id UUID,
    rollback_binding_public_id UUID,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_ai_use_policies_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_ai_use_policies_version CHECK (version>=0),
    CONSTRAINT uk_hris_ai_use_policies_1 UNIQUE (tenant_id, use_case_key),
    CONSTRAINT ck_hris_ai_use_policies_1 CHECK (risk_class IN ('MINIMAL','LIMITED','HIGH','PROHIBITED')),
    CONSTRAINT ck_hris_ai_use_policies_2 CHECK (risk_class<>'PROHIBITED'),
    CONSTRAINT ck_hris_ai_use_policies_3 CHECK (lifecycle_state IN ('DRAFT','VALIDATED','PUBLISHED','ACTIVE','SUSPENDED','RETIRED','EXPIRED')),
    CONSTRAINT ck_hris_ai_use_policies_4 CHECK (human_oversight_mode IN ('HUMAN_IN_LOOP','HUMAN_ON_LOOP','HUMAN_REVIEW_BEFORE_EFFECT')),
    CONSTRAINT ck_hris_ai_use_policies_5 CHECK (governance_policy_owner='DWP-AI-GOVERNANCE'),
    CONSTRAINT ck_hris_ai_use_policies_6 CHECK (expires_at>created_at),
    CONSTRAINT ck_hris_ai_use_policies_7 CHECK ((lifecycle_state<>'SUSPENDED') OR (kill_switch_receipt_public_id IS NOT NULL AND suspended_at IS NOT NULL AND rollback_binding_public_id IS NOT NULL))
);
COMMENT ON TABLE hris_ai_modern.sys_hris_ai_use_policies IS 'AI use-case policy root with typed DWP governance authority references | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_ai_modern.sys_hris_ai_use_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_ai_modern.sys_hris_ai_use_policies FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_ai_modern.sys_hris_ai_use_policies USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_ai_use_policies_1 ON hris_ai_modern.sys_hris_ai_use_policies(tenant_id,lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_ai_modern.sys_hris_ai_use_policies FOR EACH ROW EXECUTE FUNCTION hris_ai_modern.enforce_cas_version();


CREATE TABLE hris_ai_modern.sys_hris_ai_policy_versions (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    policy_public_id UUID NOT NULL,
    policy_revision BIGINT NOT NULL,
    lifecycle_state VARCHAR(24) NOT NULL,
    risk_class VARCHAR(24) NOT NULL,
    model_revision_ref VARCHAR(200) NOT NULL,
    prompt_revision_ref VARCHAR(200) NOT NULL,
    data_revision_ref VARCHAR(200) NOT NULL,
    evaluation_revision_ref VARCHAR(200) NOT NULL,
    governance_policy_public_id UUID NOT NULL,
    governance_policy_revision VARCHAR(120) NOT NULL,
    impact_assessment_receipt_public_id UUID NOT NULL,
    conformity_receipt_public_id UUID,
    monitoring_plan_receipt_public_id UUID NOT NULL,
    human_oversight_mode VARCHAR(40) NOT NULL,
    affected_worker_disclosure_evidence_public_id UUID,
    approval_receipt_public_id UUID,
    publication_proof_id UUID,
    published_payload_sha256 CHAR(64),
    published_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    content_sha256 CHAR(64) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_ai_policy_versions_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_ai_policy_versions_version CHECK (version>=0),
    CONSTRAINT uk_hris_ai_policy_versions_1 UNIQUE (tenant_id, policy_public_id, policy_revision),
    CONSTRAINT fk_hris_ai_policy_versions_1 FOREIGN KEY (tenant_id, policy_public_id) REFERENCES hris_ai_modern.sys_hris_ai_use_policies (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_hris_ai_policy_versions_1 CHECK (policy_revision>0),
    CONSTRAINT ck_hris_ai_policy_versions_2 CHECK (risk_class IN ('MINIMAL','LIMITED','HIGH')),
    CONSTRAINT ck_hris_ai_policy_versions_3 CHECK (lifecycle_state IN ('DRAFT','VALIDATED','PUBLISHED','RETIRED','SUSPENDED')),
    CONSTRAINT ck_hris_ai_policy_versions_4 CHECK (human_oversight_mode IN ('HUMAN_IN_LOOP','HUMAN_ON_LOOP','HUMAN_REVIEW_BEFORE_EFFECT')),
    CONSTRAINT ck_hris_ai_policy_versions_5 CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_ai_policy_versions_6 CHECK (published_payload_sha256 IS NULL OR published_payload_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_ai_policy_versions_7 CHECK (expires_at>created_at),
    CONSTRAINT ck_hris_ai_policy_versions_8 CHECK ((lifecycle_state<>'PUBLISHED') OR (approval_receipt_public_id IS NOT NULL AND publication_proof_id IS NOT NULL AND published_payload_sha256 IS NOT NULL AND published_at IS NOT NULL))
);
COMMENT ON TABLE hris_ai_modern.sys_hris_ai_policy_versions IS 'immutable governed AI policy revision pin set | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_ai_modern.sys_hris_ai_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_ai_modern.sys_hris_ai_policy_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_ai_modern.sys_hris_ai_policy_versions USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_ai_policy_versions_1 ON hris_ai_modern.sys_hris_ai_policy_versions(tenant_id,content_sha256);
CREATE INDEX ix_hris_ai_policy_versions_2 ON hris_ai_modern.sys_hris_ai_policy_versions(tenant_id,published_payload_sha256);
CREATE INDEX ix_hris_ai_policy_versions_3 ON hris_ai_modern.sys_hris_ai_policy_versions(tenant_id,lifecycle_state);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_ai_modern.sys_hris_ai_policy_versions FOR EACH ROW EXECUTE FUNCTION hris_ai_modern.reject_immutable_mutation();


CREATE TABLE hris_ai_modern.sys_hris_ai_evaluation_requests (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    policy_public_id UUID NOT NULL,
    policy_revision BIGINT NOT NULL,
    request_revision BIGINT NOT NULL,
    processing_state VARCHAR(24) NOT NULL DEFAULT 'REQUESTED',
    model_revision_ref VARCHAR(200) NOT NULL,
    prompt_revision_ref VARCHAR(200) NOT NULL,
    data_revision_ref VARCHAR(200) NOT NULL,
    evaluation_revision_ref VARCHAR(200) NOT NULL,
    evaluation_suite_public_id UUID NOT NULL,
    evaluation_suite_owner VARCHAR(40) NOT NULL DEFAULT 'DWP-AI-GOVERNANCE',
    request_sha256 CHAR(64) NOT NULL,
    correlation_id UUID NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    incident_binding_public_id UUID,
    rollback_binding_public_id UUID,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_ai_evaluation_requests_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_ai_evaluation_requests_version CHECK (version>=0),
    CONSTRAINT uk_hris_ai_evaluation_requests_1 UNIQUE (tenant_id, policy_public_id, policy_revision, request_revision),
    CONSTRAINT fk_hris_ai_evaluation_requests_1 FOREIGN KEY (tenant_id, policy_public_id, policy_revision) REFERENCES hris_ai_modern.sys_hris_ai_policy_versions (tenant_id, policy_public_id, policy_revision) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_hris_ai_evaluation_requests_1 CHECK (policy_revision>0),
    CONSTRAINT ck_hris_ai_evaluation_requests_2 CHECK (request_revision>0),
    CONSTRAINT ck_hris_ai_evaluation_requests_3 CHECK (processing_state IN ('REQUESTED','RUNNING','PASSED','FAILED','CANCELLED','EXPIRED')),
    CONSTRAINT ck_hris_ai_evaluation_requests_4 CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_ai_evaluation_requests_5 CHECK (evaluation_suite_owner='DWP-AI-GOVERNANCE'),
    CONSTRAINT ck_hris_ai_evaluation_requests_6 CHECK (expires_at>created_at)
);
COMMENT ON TABLE hris_ai_modern.sys_hris_ai_evaluation_requests IS 'AI evaluation lifecycle with exact revision pins | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_ai_modern.sys_hris_ai_evaluation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_ai_modern.sys_hris_ai_evaluation_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_ai_modern.sys_hris_ai_evaluation_requests USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_ai_evaluation_requests_1 ON hris_ai_modern.sys_hris_ai_evaluation_requests(tenant_id,request_sha256);
CREATE INDEX ix_hris_ai_evaluation_requests_2 ON hris_ai_modern.sys_hris_ai_evaluation_requests(tenant_id,correlation_id);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_ai_modern.sys_hris_ai_evaluation_requests FOR EACH ROW EXECUTE FUNCTION hris_ai_modern.enforce_cas_version();


CREATE TABLE hris_ai_modern.sys_hris_ai_evaluation_receipts (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    evaluation_request_public_id UUID NOT NULL,
    message_public_id UUID NOT NULL,
    message_sha256 CHAR(64) NOT NULL,
    evaluation_revision_ref VARCHAR(200) NOT NULL,
    outcome_code VARCHAR(24) NOT NULL,
    metrics JSONB NOT NULL,
    impact_assessment_receipt_public_id UUID NOT NULL,
    conformity_receipt_public_id UUID,
    incident_binding_public_id UUID,
    rollback_binding_public_id UUID,
    evaluated_at TIMESTAMPTZ NOT NULL,
    receipt_sha256 CHAR(64) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_ai_evaluation_receipts_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_ai_evaluation_receipts_version CHECK (version>=0),
    CONSTRAINT uk_hris_ai_evaluation_receipts_1 UNIQUE (tenant_id, message_public_id),
    CONSTRAINT fk_hris_ai_evaluation_receipts_1 FOREIGN KEY (tenant_id, evaluation_request_public_id) REFERENCES hris_ai_modern.sys_hris_ai_evaluation_requests (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_hris_ai_evaluation_receipts_1 CHECK (message_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_ai_evaluation_receipts_2 CHECK (receipt_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_ai_evaluation_receipts_3 CHECK (outcome_code IN ('PASS','FAIL','CANCELLED')),
    CONSTRAINT ck_hris_ai_evaluation_receipts_4 CHECK (jsonb_typeof(metrics)='object')
);
COMMENT ON TABLE hris_ai_modern.sys_hris_ai_evaluation_receipts IS 'sealed governed AI evaluation receipt | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_ai_modern.sys_hris_ai_evaluation_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_ai_modern.sys_hris_ai_evaluation_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_ai_modern.sys_hris_ai_evaluation_receipts USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_ai_evaluation_receipts_1 ON hris_ai_modern.sys_hris_ai_evaluation_receipts(tenant_id,message_sha256);
CREATE INDEX ix_hris_ai_evaluation_receipts_2 ON hris_ai_modern.sys_hris_ai_evaluation_receipts(tenant_id,receipt_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_ai_modern.sys_hris_ai_evaluation_receipts FOR EACH ROW EXECUTE FUNCTION hris_ai_modern.reject_immutable_mutation();


CREATE TABLE hris_ai_modern.sys_hris_ai_assistance_requests (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    policy_public_id UUID NOT NULL,
    policy_revision BIGINT NOT NULL,
    requester_public_id UUID NOT NULL,
    requester_owner VARCHAR(32) NOT NULL DEFAULT 'DWP-IAM',
    affected_worker_public_id UUID,
    affected_worker_owner VARCHAR(32),
    risk_class VARCHAR(24) NOT NULL,
    model_revision_ref VARCHAR(200) NOT NULL,
    prompt_revision_ref VARCHAR(200) NOT NULL,
    data_revision_ref VARCHAR(200) NOT NULL,
    evaluation_revision_ref VARCHAR(200) NOT NULL,
    instruction_sha256 CHAR(64) NOT NULL,
    source_set_sha256 CHAR(64) NOT NULL,
    output_sha256 CHAR(64),
    lifecycle_state VARCHAR(32) NOT NULL DEFAULT 'REQUESTED',
    human_oversight_mode VARCHAR(40) NOT NULL,
    human_review_receipt_public_id UUID,
    affected_worker_disclosure_evidence_public_id UUID,
    incident_binding_public_id UUID,
    rollback_binding_public_id UUID,
    expires_at TIMESTAMPTZ NOT NULL,
    correlation_id UUID NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_ai_assistance_requests_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_ai_assistance_requests_version CHECK (version>=0),
    CONSTRAINT fk_hris_ai_assistance_requests_1 FOREIGN KEY (tenant_id, policy_public_id, policy_revision) REFERENCES hris_ai_modern.sys_hris_ai_policy_versions (tenant_id, policy_public_id, policy_revision) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_hris_ai_assistance_requests_1 CHECK (policy_revision>0),
    CONSTRAINT ck_hris_ai_assistance_requests_2 CHECK (risk_class IN ('MINIMAL','LIMITED','HIGH')),
    CONSTRAINT ck_hris_ai_assistance_requests_3 CHECK (instruction_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_ai_assistance_requests_4 CHECK (source_set_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_ai_assistance_requests_5 CHECK (output_sha256 IS NULL OR output_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_ai_assistance_requests_6 CHECK (lifecycle_state IN ('REQUESTED','PRODUCED','PENDING_REVIEW','CONFIRMED','REJECTED','REVOKED','CANCELLED','EXPIRED')),
    CONSTRAINT ck_hris_ai_assistance_requests_7 CHECK (human_oversight_mode IN ('HUMAN_IN_LOOP','HUMAN_ON_LOOP','HUMAN_REVIEW_BEFORE_EFFECT')),
    CONSTRAINT ck_hris_ai_assistance_requests_8 CHECK ((affected_worker_public_id IS NULL)=(affected_worker_owner IS NULL)),
    CONSTRAINT ck_hris_ai_assistance_requests_9 CHECK ((lifecycle_state NOT IN ('CONFIRMED','REJECTED')) OR human_review_receipt_public_id IS NOT NULL),
    CONSTRAINT ck_hris_ai_assistance_requests_10 CHECK (expires_at>created_at)
);
COMMENT ON TABLE hris_ai_modern.sys_hris_ai_assistance_requests IS 'governed AI assistance lifecycle and human/disclosure proof | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_ai_modern.sys_hris_ai_assistance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_ai_modern.sys_hris_ai_assistance_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_ai_modern.sys_hris_ai_assistance_requests USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_ai_assistance_requests_1 ON hris_ai_modern.sys_hris_ai_assistance_requests(tenant_id,instruction_sha256);
CREATE INDEX ix_hris_ai_assistance_requests_2 ON hris_ai_modern.sys_hris_ai_assistance_requests(tenant_id,source_set_sha256);
CREATE INDEX ix_hris_ai_assistance_requests_3 ON hris_ai_modern.sys_hris_ai_assistance_requests(tenant_id,output_sha256);
CREATE INDEX ix_hris_ai_assistance_requests_4 ON hris_ai_modern.sys_hris_ai_assistance_requests(tenant_id,correlation_id);
CREATE INDEX ix_hris_ai_assistance_requests_5 ON hris_ai_modern.sys_hris_ai_assistance_requests(tenant_id,lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_ai_modern.sys_hris_ai_assistance_requests FOR EACH ROW EXECUTE FUNCTION hris_ai_modern.enforce_cas_version();


CREATE TABLE hris_ai_modern.sys_hris_ai_provenance_receipts (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    assistance_request_public_id UUID NOT NULL,
    source_ordinal INTEGER NOT NULL,
    source_ref_type VARCHAR(60) NOT NULL,
    source_public_id UUID NOT NULL,
    source_owner VARCHAR(40) NOT NULL,
    source_revision_ref VARCHAR(200) NOT NULL,
    purpose_code VARCHAR(80) NOT NULL,
    source_sha256 CHAR(64) NOT NULL,
    authorized_at TIMESTAMPTZ NOT NULL,
    authority_receipt_public_id UUID NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_ai_provenance_receipts_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_ai_provenance_receipts_version CHECK (version>=0),
    CONSTRAINT uk_hris_ai_provenance_receipts_1 UNIQUE (tenant_id, assistance_request_public_id, source_ordinal),
    CONSTRAINT fk_hris_ai_provenance_receipts_1 FOREIGN KEY (tenant_id, assistance_request_public_id) REFERENCES hris_ai_modern.sys_hris_ai_assistance_requests (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_hris_ai_provenance_receipts_1 CHECK (source_ordinal>0),
    CONSTRAINT ck_hris_ai_provenance_receipts_2 CHECK (source_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_ai_modern.sys_hris_ai_provenance_receipts IS 'immutable typed AI provenance authority receipt | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_ai_modern.sys_hris_ai_provenance_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_ai_modern.sys_hris_ai_provenance_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_ai_modern.sys_hris_ai_provenance_receipts USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_ai_provenance_receipts_1 ON hris_ai_modern.sys_hris_ai_provenance_receipts(tenant_id,source_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_ai_modern.sys_hris_ai_provenance_receipts FOR EACH ROW EXECUTE FUNCTION hris_ai_modern.reject_immutable_mutation();


SET LOCAL ROLE dwp_hris_analytics_owner;
CREATE TABLE hris_analytics_modern.sys_hris_metric_definitions (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    metric_code VARCHAR(120) NOT NULL,
    display_name VARCHAR(240) NOT NULL,
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    current_revision BIGINT NOT NULL DEFAULT 0,
    sensitivity_class VARCHAR(32) NOT NULL,
    minimum_cohort_size INTEGER NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_metric_definitions_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_metric_definitions_version CHECK (version>=0),
    CONSTRAINT uk_hris_metric_definitions_1 UNIQUE (tenant_id, metric_code),
    CONSTRAINT ck_hris_metric_definitions_1 CHECK (lifecycle_state IN ('DRAFT','ACTIVE','RETIRED')),
    CONSTRAINT ck_hris_metric_definitions_2 CHECK (sensitivity_class IN ('INTERNAL','CONFIDENTIAL','RESTRICTED')),
    CONSTRAINT ck_hris_metric_definitions_3 CHECK (minimum_cohort_size>=5)
);
COMMENT ON TABLE hris_analytics_modern.sys_hris_metric_definitions IS 'people metric definition aggregate | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_analytics_modern.sys_hris_metric_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_analytics_modern.sys_hris_metric_definitions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_analytics_modern.sys_hris_metric_definitions USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_metric_definitions_1 ON hris_analytics_modern.sys_hris_metric_definitions(tenant_id,lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_analytics_modern.sys_hris_metric_definitions FOR EACH ROW EXECUTE FUNCTION hris_analytics_modern.enforce_cas_version();


CREATE TABLE hris_analytics_modern.sys_hris_metric_versions (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    metric_public_id UUID NOT NULL,
    metric_revision BIGINT NOT NULL,
    lifecycle_state VARCHAR(24) NOT NULL,
    formula_dsl TEXT NOT NULL,
    cohort_definition_public_id UUID NOT NULL,
    cohort_owner VARCHAR(40) NOT NULL,
    anonymity_threshold INTEGER NOT NULL,
    content_sha256 CHAR(64) NOT NULL,
    approval_receipt_public_id UUID,
    publication_proof_id UUID,
    published_payload_sha256 CHAR(64),
    published_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_metric_versions_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_metric_versions_version CHECK (version>=0),
    CONSTRAINT uk_hris_metric_versions_1 UNIQUE (tenant_id, metric_public_id, metric_revision),
    CONSTRAINT fk_hris_metric_versions_1 FOREIGN KEY (tenant_id, metric_public_id) REFERENCES hris_analytics_modern.sys_hris_metric_definitions (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_hris_metric_versions_1 CHECK (metric_revision>0),
    CONSTRAINT ck_hris_metric_versions_2 CHECK (lifecycle_state IN ('DRAFT','VALIDATED','PUBLISHED','RETIRED')),
    CONSTRAINT ck_hris_metric_versions_3 CHECK (anonymity_threshold>=5),
    CONSTRAINT ck_hris_metric_versions_4 CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_metric_versions_5 CHECK (published_payload_sha256 IS NULL OR published_payload_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_metric_versions_6 CHECK ((lifecycle_state<>'PUBLISHED') OR (approval_receipt_public_id IS NOT NULL AND publication_proof_id IS NOT NULL AND published_payload_sha256 IS NOT NULL AND published_at IS NOT NULL))
);
COMMENT ON TABLE hris_analytics_modern.sys_hris_metric_versions IS 'immutable metric formula revision and publication proof | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_analytics_modern.sys_hris_metric_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_analytics_modern.sys_hris_metric_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_analytics_modern.sys_hris_metric_versions USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_metric_versions_1 ON hris_analytics_modern.sys_hris_metric_versions(tenant_id,content_sha256);
CREATE INDEX ix_hris_metric_versions_2 ON hris_analytics_modern.sys_hris_metric_versions(tenant_id,published_payload_sha256);
CREATE INDEX ix_hris_metric_versions_3 ON hris_analytics_modern.sys_hris_metric_versions(tenant_id,lifecycle_state);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_analytics_modern.sys_hris_metric_versions FOR EACH ROW EXECUTE FUNCTION hris_analytics_modern.reject_immutable_mutation();


CREATE TABLE hris_analytics_modern.sys_hris_metric_projection_requests (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    metric_public_id UUID NOT NULL,
    metric_revision BIGINT NOT NULL,
    request_revision BIGINT NOT NULL,
    as_of TIMESTAMPTZ NOT NULL,
    cohort_definition_public_id UUID NOT NULL,
    cohort_owner VARCHAR(40) NOT NULL,
    processing_state VARCHAR(24) NOT NULL DEFAULT 'REQUESTED',
    source_snapshot_public_id UUID NOT NULL,
    source_snapshot_owner VARCHAR(40) NOT NULL,
    request_sha256 CHAR(64) NOT NULL,
    correlation_id UUID NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_metric_projection_requests_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_metric_projection_requests_version CHECK (version>=0),
    CONSTRAINT uk_hris_metric_projection_requests_1 UNIQUE (tenant_id, metric_public_id, metric_revision, request_revision),
    CONSTRAINT fk_hris_metric_projection_requests_1 FOREIGN KEY (tenant_id, metric_public_id, metric_revision) REFERENCES hris_analytics_modern.sys_hris_metric_versions (tenant_id, metric_public_id, metric_revision) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_hris_metric_projection_requests_1 CHECK (metric_revision>0),
    CONSTRAINT ck_hris_metric_projection_requests_2 CHECK (request_revision>0),
    CONSTRAINT ck_hris_metric_projection_requests_3 CHECK (processing_state IN ('REQUESTED','RUNNING','READY','FAILED_RETRYABLE','FAILED_FINAL','CANCELLED','EXPIRED')),
    CONSTRAINT ck_hris_metric_projection_requests_4 CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_metric_projection_requests_5 CHECK (as_of<=expires_at)
);
COMMENT ON TABLE hris_analytics_modern.sys_hris_metric_projection_requests IS 'people metric projection request lifecycle | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_analytics_modern.sys_hris_metric_projection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_analytics_modern.sys_hris_metric_projection_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_analytics_modern.sys_hris_metric_projection_requests USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_metric_projection_requests_1 ON hris_analytics_modern.sys_hris_metric_projection_requests(tenant_id,request_sha256);
CREATE INDEX ix_hris_metric_projection_requests_2 ON hris_analytics_modern.sys_hris_metric_projection_requests(tenant_id,correlation_id);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_analytics_modern.sys_hris_metric_projection_requests FOR EACH ROW EXECUTE FUNCTION hris_analytics_modern.enforce_cas_version();


CREATE TABLE hris_analytics_modern.sys_hris_metric_projections (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    projection_request_public_id UUID NOT NULL,
    projection_revision BIGINT NOT NULL,
    as_of TIMESTAMPTZ NOT NULL,
    calculated_at TIMESTAMPTZ NOT NULL,
    subject_count INTEGER NOT NULL,
    anonymity_threshold INTEGER NOT NULL,
    projection_payload JSONB NOT NULL,
    projection_sha256 CHAR(64) NOT NULL,
    result_owner VARCHAR(40) NOT NULL DEFAULT 'HRIS-SYS-ANALYTICS',
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_metric_projections_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_metric_projections_version CHECK (version>=0),
    CONSTRAINT uk_hris_metric_projections_1 UNIQUE (tenant_id, projection_request_public_id, projection_revision),
    CONSTRAINT fk_hris_metric_projections_1 FOREIGN KEY (tenant_id, projection_request_public_id) REFERENCES hris_analytics_modern.sys_hris_metric_projection_requests (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_hris_metric_projections_1 CHECK (projection_revision>0),
    CONSTRAINT ck_hris_metric_projections_2 CHECK (calculated_at>=as_of),
    CONSTRAINT ck_hris_metric_projections_3 CHECK (subject_count>=anonymity_threshold),
    CONSTRAINT ck_hris_metric_projections_4 CHECK (anonymity_threshold>=5),
    CONSTRAINT ck_hris_metric_projections_5 CHECK (projection_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_metric_projections_6 CHECK (result_owner='HRIS-SYS-ANALYTICS')
);
COMMENT ON TABLE hris_analytics_modern.sys_hris_metric_projections IS 'immutable privacy-thresholded people metric projection | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_analytics_modern.sys_hris_metric_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_analytics_modern.sys_hris_metric_projections FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_analytics_modern.sys_hris_metric_projections USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_metric_projections_1 ON hris_analytics_modern.sys_hris_metric_projections(tenant_id,projection_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_analytics_modern.sys_hris_metric_projections FOR EACH ROW EXECUTE FUNCTION hris_analytics_modern.reject_immutable_mutation();


CREATE TABLE hris_analytics_modern.sys_hris_analytics_export_receipts (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    projection_public_id UUID,
    request_public_id UUID NOT NULL,
    request_sha256 CHAR(64) NOT NULL,
    processing_state VARCHAR(24) NOT NULL DEFAULT 'REQUESTED',
    object_token_public_id UUID,
    object_owner VARCHAR(40),
    result_sha256 CHAR(64),
    expires_at TIMESTAMPTZ NOT NULL,
    correlation_id UUID NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_analytics_export_receipts_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_analytics_export_receipts_version CHECK (version>=0),
    CONSTRAINT uk_hris_analytics_export_receipts_1 UNIQUE (tenant_id, request_public_id),
    CONSTRAINT fk_hris_analytics_export_receipts_1 FOREIGN KEY (tenant_id, projection_public_id) REFERENCES hris_analytics_modern.sys_hris_metric_projections (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_hris_analytics_export_receipts_1 CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_analytics_export_receipts_2 CHECK (result_sha256 IS NULL OR result_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_analytics_export_receipts_3 CHECK (processing_state IN ('REQUESTED','PROCESSING','READY','FAILED_RETRYABLE','FAILED_FINAL','EXPIRED','CANCELLED')),
    CONSTRAINT ck_hris_analytics_export_receipts_4 CHECK ((object_token_public_id IS NULL)=(object_owner IS NULL))
);
COMMENT ON TABLE hris_analytics_modern.sys_hris_analytics_export_receipts IS 'analytics export lifecycle receipt | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_analytics_modern.sys_hris_analytics_export_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_analytics_modern.sys_hris_analytics_export_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_analytics_modern.sys_hris_analytics_export_receipts USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_analytics_export_receipts_1 ON hris_analytics_modern.sys_hris_analytics_export_receipts(tenant_id,request_sha256);
CREATE INDEX ix_hris_analytics_export_receipts_2 ON hris_analytics_modern.sys_hris_analytics_export_receipts(tenant_id,result_sha256);
CREATE INDEX ix_hris_analytics_export_receipts_3 ON hris_analytics_modern.sys_hris_analytics_export_receipts(tenant_id,correlation_id);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_analytics_modern.sys_hris_analytics_export_receipts FOR EACH ROW EXECUTE FUNCTION hris_analytics_modern.enforce_cas_version();


SET LOCAL ROLE dwp_hris_configuration_owner;
CREATE TABLE hris_configuration.sys_hris_listening_surveys (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    survey_code VARCHAR(120) NOT NULL,
    display_name VARCHAR(240) NOT NULL,
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    current_revision BIGINT NOT NULL DEFAULT 0,
    active_admission_public_id UUID,
    active_admission_owner VARCHAR(40),
    opens_at TIMESTAMPTZ,
    closes_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_listening_surveys_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_listening_surveys_version CHECK (version>=0),
    CONSTRAINT uk_hris_listening_surveys_1 UNIQUE (tenant_id, survey_code),
    CONSTRAINT ck_hris_listening_surveys_1 CHECK (lifecycle_state IN ('DRAFT','PUBLISHING','PUBLISHED','CLOSING','CLOSED','CANCELLED')),
    CONSTRAINT ck_hris_listening_surveys_2 CHECK (closes_at IS NULL OR opens_at IS NULL OR closes_at>opens_at),
    CONSTRAINT ck_hris_listening_surveys_3 CHECK ((active_admission_public_id IS NULL)=(active_admission_owner IS NULL))
);
COMMENT ON TABLE hris_configuration.sys_hris_listening_surveys IS 'listening configuration survey aggregate | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_configuration.sys_hris_listening_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_configuration.sys_hris_listening_surveys FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_configuration.sys_hris_listening_surveys USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_listening_surveys_1 ON hris_configuration.sys_hris_listening_surveys(tenant_id,lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_configuration.sys_hris_listening_surveys FOR EACH ROW EXECUTE FUNCTION hris_configuration.enforce_cas_version();


CREATE TABLE hris_configuration.sys_hris_listening_survey_versions (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    survey_public_id UUID NOT NULL,
    survey_revision BIGINT NOT NULL,
    lifecycle_state VARCHAR(24) NOT NULL,
    opens_at TIMESTAMPTZ NOT NULL,
    closes_at TIMESTAMPTZ NOT NULL,
    anonymity_threshold INTEGER NOT NULL,
    questionnaire JSONB NOT NULL,
    content_sha256 CHAR(64) NOT NULL,
    approval_receipt_public_id UUID,
    publication_proof_id UUID,
    published_payload_sha256 CHAR(64),
    published_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_listening_survey_versions_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_listening_survey_versions_version CHECK (version>=0),
    CONSTRAINT uk_hris_listening_survey_versions_1 UNIQUE (tenant_id, survey_public_id, survey_revision),
    CONSTRAINT uk_hris_listening_survey_versions_2 UNIQUE (tenant_id, public_id, survey_revision),
    CONSTRAINT fk_hris_listening_survey_versions_1 FOREIGN KEY (tenant_id, survey_public_id) REFERENCES hris_configuration.sys_hris_listening_surveys (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_hris_listening_survey_versions_1 CHECK (survey_revision>0),
    CONSTRAINT ck_hris_listening_survey_versions_2 CHECK (closes_at>opens_at),
    CONSTRAINT ck_hris_listening_survey_versions_3 CHECK (anonymity_threshold>=5),
    CONSTRAINT ck_hris_listening_survey_versions_4 CHECK (lifecycle_state IN ('DRAFT','PUBLISHED','CLOSED')),
    CONSTRAINT ck_hris_listening_survey_versions_5 CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_listening_survey_versions_6 CHECK (published_payload_sha256 IS NULL OR published_payload_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_listening_survey_versions_7 CHECK ((lifecycle_state<>'PUBLISHED') OR (approval_receipt_public_id IS NOT NULL AND publication_proof_id IS NOT NULL AND published_payload_sha256 IS NOT NULL AND published_at IS NOT NULL))
);
COMMENT ON TABLE hris_configuration.sys_hris_listening_survey_versions IS 'immutable listening survey revision and publication proof | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_configuration.sys_hris_listening_survey_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_configuration.sys_hris_listening_survey_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_configuration.sys_hris_listening_survey_versions USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_listening_survey_versions_1 ON hris_configuration.sys_hris_listening_survey_versions(tenant_id,content_sha256);
CREATE INDEX ix_hris_listening_survey_versions_2 ON hris_configuration.sys_hris_listening_survey_versions(tenant_id,published_payload_sha256);
CREATE INDEX ix_hris_listening_survey_versions_3 ON hris_configuration.sys_hris_listening_survey_versions(tenant_id,lifecycle_state);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_configuration.sys_hris_listening_survey_versions FOR EACH ROW EXECUTE FUNCTION hris_configuration.reject_immutable_mutation();


CREATE TABLE hris_configuration.sys_hris_listening_actions (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    survey_version_public_id UUID NOT NULL,
    action_ordinal INTEGER NOT NULL,
    owner_public_id UUID NOT NULL,
    owner_type VARCHAR(40) NOT NULL,
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'OPEN',
    action_sha256 CHAR(64) NOT NULL,
    due_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_listening_actions_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_listening_actions_version CHECK (version>=0),
    CONSTRAINT uk_hris_listening_actions_1 UNIQUE (tenant_id, survey_version_public_id, action_ordinal),
    CONSTRAINT fk_hris_listening_actions_1 FOREIGN KEY (tenant_id, survey_version_public_id) REFERENCES hris_configuration.sys_hris_listening_survey_versions (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_hris_listening_actions_1 CHECK (action_ordinal>0),
    CONSTRAINT ck_hris_listening_actions_2 CHECK (lifecycle_state IN ('OPEN','IN_PROGRESS','COMPLETED','CANCELLED')),
    CONSTRAINT ck_hris_listening_actions_3 CHECK (action_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_listening_actions_4 CHECK (completed_at IS NULL OR lifecycle_state='COMPLETED')
);
COMMENT ON TABLE hris_configuration.sys_hris_listening_actions IS 'listening follow-up action lifecycle | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_configuration.sys_hris_listening_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_configuration.sys_hris_listening_actions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_configuration.sys_hris_listening_actions USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_listening_actions_1 ON hris_configuration.sys_hris_listening_actions(tenant_id,action_sha256);
CREATE INDEX ix_hris_listening_actions_2 ON hris_configuration.sys_hris_listening_actions(tenant_id,lifecycle_state);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_configuration.sys_hris_listening_actions FOR EACH ROW EXECUTE FUNCTION hris_configuration.enforce_cas_version();


CREATE TABLE hris_configuration.sys_hris_listening_operation_receipts (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    consumer_key VARCHAR(120) NOT NULL,
    message_public_id UUID NOT NULL,
    message_sha256 CHAR(64) NOT NULL,
    processing_state VARCHAR(24) NOT NULL DEFAULT 'RECEIVED',
    aggregate_public_id UUID,
    expected_version BIGINT,
    closed_ack JSONB,
    ack_sha256 CHAR(64),
    received_at TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_listening_operation_receipts_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_listening_operation_receipts_version CHECK (version>=0),
    CONSTRAINT uk_hris_listening_operation_receipts_1 UNIQUE (tenant_id, consumer_key, message_public_id),
    CONSTRAINT ck_hris_listening_operation_receipts_1 CHECK (message_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_listening_operation_receipts_2 CHECK (ack_sha256 IS NULL OR ack_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_listening_operation_receipts_3 CHECK (processing_state IN ('RECEIVED','PROCESSING','PROCESSED','QUARANTINED'))
);
COMMENT ON TABLE hris_configuration.sys_hris_listening_operation_receipts IS 'configuration owner inbox and closed acknowledgement | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_configuration.sys_hris_listening_operation_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_configuration.sys_hris_listening_operation_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_configuration.sys_hris_listening_operation_receipts USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_listening_operation_receipts_1 ON hris_configuration.sys_hris_listening_operation_receipts(tenant_id,message_sha256);
CREATE INDEX ix_hris_listening_operation_receipts_2 ON hris_configuration.sys_hris_listening_operation_receipts(tenant_id,ack_sha256);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_configuration.sys_hris_listening_operation_receipts FOR EACH ROW EXECUTE FUNCTION hris_configuration.enforce_cas_version();


CREATE TABLE hris_configuration.sys_hris_listening_domain_outbox (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    event_public_id UUID NOT NULL,
    aggregate_public_id UUID NOT NULL,
    aggregate_version BIGINT NOT NULL,
    event_type VARCHAR(160) NOT NULL,
    payload JSONB NOT NULL,
    payload_sha256 CHAR(64) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    delivery_state VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    correlation_id UUID NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_listening_domain_outbox_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_listening_domain_outbox_version CHECK (version>=0),
    CONSTRAINT uk_hris_listening_domain_outbox_1 UNIQUE (tenant_id, event_public_id),
    CONSTRAINT ck_hris_listening_domain_outbox_1 CHECK (aggregate_version>=0),
    CONSTRAINT ck_hris_listening_domain_outbox_2 CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_listening_domain_outbox_3 CHECK (delivery_state IN ('PENDING','PUBLISHED','QUARANTINED'))
);
COMMENT ON TABLE hris_configuration.sys_hris_listening_domain_outbox IS 'configuration owner immutable outbox | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_configuration.sys_hris_listening_domain_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_configuration.sys_hris_listening_domain_outbox FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_configuration.sys_hris_listening_domain_outbox USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_listening_domain_outbox_1 ON hris_configuration.sys_hris_listening_domain_outbox(tenant_id,payload_sha256);
CREATE INDEX ix_hris_listening_domain_outbox_2 ON hris_configuration.sys_hris_listening_domain_outbox(tenant_id,correlation_id);
CREATE TRIGGER guard_outbox_delivery_transition BEFORE UPDATE OR DELETE ON hris_configuration.sys_hris_listening_domain_outbox FOR EACH ROW EXECUTE FUNCTION hris_configuration.guard_outbox_delivery_transition();


SET LOCAL ROLE dwp_hris_listening_protected_owner;
CREATE TABLE hris_listening_protected.sys_hris_listening_admission_versions (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    survey_public_id UUID NOT NULL,
    survey_revision BIGINT NOT NULL,
    admission_revision BIGINT NOT NULL,
    eligibility_snapshot_public_id UUID NOT NULL,
    eligibility_owner VARCHAR(40) NOT NULL DEFAULT 'AUTH-HRIS-PARTICIPATION-ISSUER',
    opens_at TIMESTAMPTZ NOT NULL,
    closes_at TIMESTAMPTZ NOT NULL,
    privacy_state VARCHAR(24) NOT NULL,
    admission_sha256 CHAR(64) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_listening_admission_versions_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_listening_admission_versions_version CHECK (version>=0),
    CONSTRAINT uk_hris_listening_admission_versions_1 UNIQUE (tenant_id, survey_public_id, survey_revision, admission_revision),
    CONSTRAINT ck_hris_listening_admission_versions_1 CHECK (survey_revision>0),
    CONSTRAINT ck_hris_listening_admission_versions_2 CHECK (admission_revision>0),
    CONSTRAINT ck_hris_listening_admission_versions_3 CHECK (closes_at>opens_at),
    CONSTRAINT ck_hris_listening_admission_versions_4 CHECK (privacy_state IN ('INSTALLED','ACTIVE','CLOSED','ERASED')),
    CONSTRAINT ck_hris_listening_admission_versions_5 CHECK (admission_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_listening_protected.sys_hris_listening_admission_versions IS 'protected immutable admission revision | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_listening_protected.sys_hris_listening_admission_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_listening_protected.sys_hris_listening_admission_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_listening_protected.sys_hris_listening_admission_versions USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_listening_admission_versions_1 ON hris_listening_protected.sys_hris_listening_admission_versions(tenant_id,admission_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_listening_protected.sys_hris_listening_admission_versions FOR EACH ROW EXECUTE FUNCTION hris_listening_protected.reject_immutable_mutation();


CREATE TABLE hris_listening_protected.sys_hris_listening_responses (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    admission_version_public_id UUID NOT NULL,
    response_ordinal BIGINT NOT NULL,
    participation_token_sha256 CHAR(64) NOT NULL,
    encrypted_payload BYTEA,
    key_reference VARCHAR(240),
    privacy_state VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    submitted_at TIMESTAMPTZ NOT NULL,
    erased_at TIMESTAMPTZ,
    response_sha256 CHAR(64) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_listening_responses_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_listening_responses_version CHECK (version>=0),
    CONSTRAINT uk_hris_listening_responses_1 UNIQUE (tenant_id, admission_version_public_id, response_ordinal),
    CONSTRAINT fk_hris_listening_responses_1 FOREIGN KEY (tenant_id, admission_version_public_id) REFERENCES hris_listening_protected.sys_hris_listening_admission_versions (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_hris_listening_responses_1 CHECK (response_ordinal>0),
    CONSTRAINT ck_hris_listening_responses_2 CHECK (participation_token_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_listening_responses_3 CHECK (response_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_listening_responses_4 CHECK (privacy_state IN ('ACTIVE','ERASURE_REQUESTED','ERASED')),
    CONSTRAINT ck_hris_listening_responses_5 CHECK ((privacy_state='ERASED')=(encrypted_payload IS NULL AND key_reference IS NULL AND erased_at IS NOT NULL))
);
COMMENT ON TABLE hris_listening_protected.sys_hris_listening_responses IS 'protected encrypted response with owner-local crypto-erasure state | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_listening_protected.sys_hris_listening_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_listening_protected.sys_hris_listening_responses FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_listening_protected.sys_hris_listening_responses USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_listening_responses_1 ON hris_listening_protected.sys_hris_listening_responses(tenant_id,participation_token_sha256);
CREATE INDEX ix_hris_listening_responses_2 ON hris_listening_protected.sys_hris_listening_responses(tenant_id,response_sha256);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_listening_protected.sys_hris_listening_responses FOR EACH ROW EXECUTE FUNCTION hris_listening_protected.enforce_cas_version();


CREATE TABLE hris_listening_protected.sys_hris_listening_answer_values (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    response_public_id UUID NOT NULL,
    answer_ordinal INTEGER NOT NULL,
    question_code VARCHAR(120) NOT NULL,
    encrypted_value BYTEA,
    key_reference VARCHAR(240),
    privacy_state VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    answer_sha256 CHAR(64) NOT NULL,
    erased_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_listening_answer_values_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_listening_answer_values_version CHECK (version>=0),
    CONSTRAINT uk_hris_listening_answer_values_1 UNIQUE (tenant_id, response_public_id, answer_ordinal),
    CONSTRAINT fk_hris_listening_answer_values_1 FOREIGN KEY (tenant_id, response_public_id) REFERENCES hris_listening_protected.sys_hris_listening_responses (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_hris_listening_answer_values_1 CHECK (answer_ordinal>0),
    CONSTRAINT ck_hris_listening_answer_values_2 CHECK (answer_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_listening_answer_values_3 CHECK (privacy_state IN ('ACTIVE','ERASED')),
    CONSTRAINT ck_hris_listening_answer_values_4 CHECK ((privacy_state='ERASED')=(encrypted_value IS NULL AND key_reference IS NULL AND erased_at IS NOT NULL))
);
COMMENT ON TABLE hris_listening_protected.sys_hris_listening_answer_values IS 'protected typed ordinal answer with crypto-erasure | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_listening_protected.sys_hris_listening_answer_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_listening_protected.sys_hris_listening_answer_values FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_listening_protected.sys_hris_listening_answer_values USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_listening_answer_values_1 ON hris_listening_protected.sys_hris_listening_answer_values(tenant_id,answer_sha256);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_listening_protected.sys_hris_listening_answer_values FOR EACH ROW EXECUTE FUNCTION hris_listening_protected.enforce_cas_version();


CREATE TABLE hris_listening_protected.sys_hris_listening_token_consumptions (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    admission_version_public_id UUID NOT NULL,
    token_issuance_public_id UUID NOT NULL,
    token_owner VARCHAR(40) NOT NULL DEFAULT 'AUTH-HRIS-PARTICIPATION-ISSUER',
    consumed_at TIMESTAMPTZ NOT NULL,
    consumption_sha256 CHAR(64) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_listening_token_consumptions_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_listening_token_consumptions_version CHECK (version>=0),
    CONSTRAINT uk_hris_listening_token_consumptions_1 UNIQUE (tenant_id, admission_version_public_id, token_issuance_public_id),
    CONSTRAINT fk_hris_listening_token_consumptions_1 FOREIGN KEY (tenant_id, admission_version_public_id) REFERENCES hris_listening_protected.sys_hris_listening_admission_versions (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_hris_listening_token_consumptions_1 CHECK (consumption_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_listening_protected.sys_hris_listening_token_consumptions IS 'protected one-time participation token consumption | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_listening_protected.sys_hris_listening_token_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_listening_protected.sys_hris_listening_token_consumptions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_listening_protected.sys_hris_listening_token_consumptions USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_listening_token_consumptions_1 ON hris_listening_protected.sys_hris_listening_token_consumptions(tenant_id,consumption_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_listening_protected.sys_hris_listening_token_consumptions FOR EACH ROW EXECUTE FUNCTION hris_listening_protected.reject_immutable_mutation();


CREATE TABLE hris_listening_protected.sys_hris_listening_protected_receipts (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    consumer_key VARCHAR(120) NOT NULL,
    message_public_id UUID NOT NULL,
    message_sha256 CHAR(64) NOT NULL,
    response_public_id UUID,
    processing_state VARCHAR(24) NOT NULL DEFAULT 'RECEIVED',
    closed_ack JSONB,
    ack_sha256 CHAR(64),
    received_at TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_listening_protected_receipts_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_listening_protected_receipts_version CHECK (version>=0),
    CONSTRAINT uk_hris_listening_protected_receipts_1 UNIQUE (tenant_id, consumer_key, message_public_id),
    CONSTRAINT fk_hris_listening_protected_receipts_1 FOREIGN KEY (tenant_id, response_public_id) REFERENCES hris_listening_protected.sys_hris_listening_responses (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_hris_listening_protected_receipts_1 CHECK (message_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_listening_protected_receipts_2 CHECK (ack_sha256 IS NULL OR ack_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_listening_protected_receipts_3 CHECK (processing_state IN ('RECEIVED','PROCESSING','PROCESSED','QUARANTINED'))
);
COMMENT ON TABLE hris_listening_protected.sys_hris_listening_protected_receipts IS 'protected owner inbox and sealed closed acknowledgement | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_listening_protected.sys_hris_listening_protected_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_listening_protected.sys_hris_listening_protected_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_listening_protected.sys_hris_listening_protected_receipts USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_listening_protected_receipts_1 ON hris_listening_protected.sys_hris_listening_protected_receipts(tenant_id,message_sha256);
CREATE INDEX ix_hris_listening_protected_receipts_2 ON hris_listening_protected.sys_hris_listening_protected_receipts(tenant_id,ack_sha256);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_listening_protected.sys_hris_listening_protected_receipts FOR EACH ROW EXECUTE FUNCTION hris_listening_protected.enforce_cas_version();


CREATE TABLE hris_listening_protected.sys_hris_listening_erasure_tickets (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    response_public_id UUID NOT NULL,
    idempotency_key VARCHAR(200) NOT NULL,
    request_sha256 CHAR(64) NOT NULL,
    retention_policy_revision BIGINT NOT NULL,
    due_at TIMESTAMPTZ NOT NULL,
    processing_state VARCHAR(24) NOT NULL DEFAULT 'REQUESTED',
    lease_revision BIGINT NOT NULL DEFAULT 0,
    lease_until TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    tombstone_sha256 CHAR(64),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_listening_erasure_tickets_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_listening_erasure_tickets_version CHECK (version>=0),
    CONSTRAINT uk_hris_listening_erasure_tickets_1 UNIQUE (tenant_id, idempotency_key),
    CONSTRAINT fk_hris_listening_erasure_tickets_1 FOREIGN KEY (tenant_id, response_public_id) REFERENCES hris_listening_protected.sys_hris_listening_responses (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_hris_listening_erasure_tickets_1 CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_listening_erasure_tickets_2 CHECK (tombstone_sha256 IS NULL OR tombstone_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_listening_erasure_tickets_3 CHECK (retention_policy_revision>0),
    CONSTRAINT ck_hris_listening_erasure_tickets_4 CHECK (processing_state IN ('REQUESTED','CLAIMED','COMPLETED','FAILED_RETRYABLE','FAILED_FINAL')),
    CONSTRAINT ck_hris_listening_erasure_tickets_5 CHECK (lease_revision>=0)
);
COMMENT ON TABLE hris_listening_protected.sys_hris_listening_erasure_tickets IS 'protected owner-local erasure lifecycle ticket | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_listening_protected.sys_hris_listening_erasure_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_listening_protected.sys_hris_listening_erasure_tickets FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_listening_protected.sys_hris_listening_erasure_tickets USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_listening_erasure_tickets_1 ON hris_listening_protected.sys_hris_listening_erasure_tickets(tenant_id,request_sha256);
CREATE INDEX ix_hris_listening_erasure_tickets_2 ON hris_listening_protected.sys_hris_listening_erasure_tickets(tenant_id,tombstone_sha256);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_listening_protected.sys_hris_listening_erasure_tickets FOR EACH ROW EXECUTE FUNCTION hris_listening_protected.enforce_cas_version();


CREATE TABLE hris_listening_protected.sys_hris_listening_cohort_budgets (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    admission_version_public_id UUID NOT NULL,
    budget_revision BIGINT NOT NULL,
    privacy_budget_total NUMERIC(19,8) NOT NULL,
    privacy_budget_spent NUMERIC(19,8) NOT NULL DEFAULT 0,
    minimum_cohort_size INTEGER NOT NULL,
    budget_state VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_listening_cohort_budgets_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_listening_cohort_budgets_version CHECK (version>=0),
    CONSTRAINT uk_hris_listening_cohort_budgets_1 UNIQUE (tenant_id, admission_version_public_id, budget_revision),
    CONSTRAINT fk_hris_listening_cohort_budgets_1 FOREIGN KEY (tenant_id, admission_version_public_id) REFERENCES hris_listening_protected.sys_hris_listening_admission_versions (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_hris_listening_cohort_budgets_1 CHECK (budget_revision>0),
    CONSTRAINT ck_hris_listening_cohort_budgets_2 CHECK (privacy_budget_total>0),
    CONSTRAINT ck_hris_listening_cohort_budgets_3 CHECK (privacy_budget_spent>=0 AND privacy_budget_spent<=privacy_budget_total),
    CONSTRAINT ck_hris_listening_cohort_budgets_4 CHECK (minimum_cohort_size>=5),
    CONSTRAINT ck_hris_listening_cohort_budgets_5 CHECK (budget_state IN ('ACTIVE','EXHAUSTED','CLOSED'))
);
COMMENT ON TABLE hris_listening_protected.sys_hris_listening_cohort_budgets IS 'protected cohort privacy budget | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_listening_protected.sys_hris_listening_cohort_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_listening_protected.sys_hris_listening_cohort_budgets FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_listening_protected.sys_hris_listening_cohort_budgets USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_listening_protected.sys_hris_listening_cohort_budgets FOR EACH ROW EXECUTE FUNCTION hris_listening_protected.enforce_cas_version();


CREATE TABLE hris_listening_protected.sys_hris_listening_cohort_packages (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    cohort_budget_public_id UUID NOT NULL,
    package_revision BIGINT NOT NULL,
    survey_public_id UUID NOT NULL,
    minimum_cohort_size INTEGER NOT NULL,
    subject_count INTEGER NOT NULL,
    minimized_payload JSONB NOT NULL,
    package_sha256 CHAR(64) NOT NULL,
    privacy_spend NUMERIC(19,8) NOT NULL,
    produced_at TIMESTAMPTZ NOT NULL,
    projection_state VARCHAR(24) NOT NULL DEFAULT 'READY',
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_listening_cohort_packages_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_listening_cohort_packages_version CHECK (version>=0),
    CONSTRAINT uk_hris_listening_cohort_packages_1 UNIQUE (tenant_id, cohort_budget_public_id, package_revision),
    CONSTRAINT fk_hris_listening_cohort_packages_1 FOREIGN KEY (tenant_id, cohort_budget_public_id) REFERENCES hris_listening_protected.sys_hris_listening_cohort_budgets (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_hris_listening_cohort_packages_1 CHECK (package_revision>0),
    CONSTRAINT ck_hris_listening_cohort_packages_2 CHECK (minimum_cohort_size>=5),
    CONSTRAINT ck_hris_listening_cohort_packages_3 CHECK (subject_count>=minimum_cohort_size),
    CONSTRAINT ck_hris_listening_cohort_packages_4 CHECK (package_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_listening_cohort_packages_5 CHECK (privacy_spend>=0),
    CONSTRAINT ck_hris_listening_cohort_packages_6 CHECK (projection_state IN ('READY','PROJECTED','REJECTED'))
);
COMMENT ON TABLE hris_listening_protected.sys_hris_listening_cohort_packages IS 'privacy-minimized protected cohort package | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_listening_protected.sys_hris_listening_cohort_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_listening_protected.sys_hris_listening_cohort_packages FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_listening_protected.sys_hris_listening_cohort_packages USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_listening_cohort_packages_1 ON hris_listening_protected.sys_hris_listening_cohort_packages(tenant_id,package_sha256);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_listening_protected.sys_hris_listening_cohort_packages FOR EACH ROW EXECUTE FUNCTION hris_listening_protected.enforce_cas_version();


CREATE TABLE hris_listening_protected.sys_hris_listening_protected_outbox (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    event_public_id UUID NOT NULL,
    message_type VARCHAR(160) NOT NULL,
    payload JSONB NOT NULL,
    payload_sha256 CHAR(64) NOT NULL,
    privacy_class VARCHAR(24) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    delivery_state VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    correlation_id UUID NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_listening_protected_outbox_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_listening_protected_outbox_version CHECK (version>=0),
    CONSTRAINT uk_hris_listening_protected_outbox_1 UNIQUE (tenant_id, event_public_id),
    CONSTRAINT ck_hris_listening_protected_outbox_1 CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_listening_protected_outbox_2 CHECK (privacy_class IN ('MINIMIZED_INTERNAL','NON_LINKABLE_ACK')),
    CONSTRAINT ck_hris_listening_protected_outbox_3 CHECK (delivery_state IN ('PENDING','PUBLISHED','QUARANTINED'))
);
COMMENT ON TABLE hris_listening_protected.sys_hris_listening_protected_outbox IS 'protected privacy-safe immutable outbox | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_listening_protected.sys_hris_listening_protected_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_listening_protected.sys_hris_listening_protected_outbox FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_listening_protected.sys_hris_listening_protected_outbox USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_listening_protected_outbox_1 ON hris_listening_protected.sys_hris_listening_protected_outbox(tenant_id,payload_sha256);
CREATE INDEX ix_hris_listening_protected_outbox_2 ON hris_listening_protected.sys_hris_listening_protected_outbox(tenant_id,correlation_id);
CREATE TRIGGER guard_outbox_delivery_transition BEFORE UPDATE OR DELETE ON hris_listening_protected.sys_hris_listening_protected_outbox FOR EACH ROW EXECUTE FUNCTION hris_listening_protected.guard_outbox_delivery_transition();


SET LOCAL ROLE dwp_hris_insights_owner;
CREATE TABLE hris_insights.sys_hris_listening_cohort_projections (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    survey_public_id UUID NOT NULL,
    projection_revision BIGINT NOT NULL,
    source_package_public_id UUID NOT NULL,
    source_package_owner VARCHAR(40) NOT NULL DEFAULT 'PLATFORM-HRIS-LISTENING-PROTECTED',
    minimum_cohort_size INTEGER NOT NULL,
    subject_count INTEGER NOT NULL,
    projection_payload JSONB NOT NULL,
    projection_sha256 CHAR(64) NOT NULL,
    as_of TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_listening_cohort_projections_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_listening_cohort_projections_version CHECK (version>=0),
    CONSTRAINT uk_hris_listening_cohort_projections_1 UNIQUE (tenant_id, survey_public_id, projection_revision),
    CONSTRAINT ck_hris_listening_cohort_projections_1 CHECK (projection_revision>0),
    CONSTRAINT ck_hris_listening_cohort_projections_2 CHECK (minimum_cohort_size>=5),
    CONSTRAINT ck_hris_listening_cohort_projections_3 CHECK (subject_count>=minimum_cohort_size),
    CONSTRAINT ck_hris_listening_cohort_projections_4 CHECK (projection_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_insights.sys_hris_listening_cohort_projections IS 'insights-only minimized cohort projection | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_insights.sys_hris_listening_cohort_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_insights.sys_hris_listening_cohort_projections FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_insights.sys_hris_listening_cohort_projections USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_listening_cohort_projections_1 ON hris_insights.sys_hris_listening_cohort_projections(tenant_id,projection_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_insights.sys_hris_listening_cohort_projections FOR EACH ROW EXECUTE FUNCTION hris_insights.reject_immutable_mutation();


CREATE TABLE hris_insights.sys_hris_listening_lineage_receipts (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    cohort_projection_public_id UUID NOT NULL,
    source_package_public_id UUID NOT NULL,
    source_package_sha256 CHAR(64) NOT NULL,
    projection_sha256 CHAR(64) NOT NULL,
    lineage_receipt_public_id UUID NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_listening_lineage_receipts_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_listening_lineage_receipts_version CHECK (version>=0),
    CONSTRAINT uk_hris_listening_lineage_receipts_1 UNIQUE (tenant_id, lineage_receipt_public_id),
    CONSTRAINT fk_hris_listening_lineage_receipts_1 FOREIGN KEY (tenant_id, cohort_projection_public_id) REFERENCES hris_insights.sys_hris_listening_cohort_projections (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_hris_listening_lineage_receipts_1 CHECK (source_package_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_listening_lineage_receipts_2 CHECK (projection_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_insights.sys_hris_listening_lineage_receipts IS 'immutable minimized projection lineage receipt | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_insights.sys_hris_listening_lineage_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_insights.sys_hris_listening_lineage_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_insights.sys_hris_listening_lineage_receipts USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_listening_lineage_receipts_1 ON hris_insights.sys_hris_listening_lineage_receipts(tenant_id,source_package_sha256);
CREATE INDEX ix_hris_listening_lineage_receipts_2 ON hris_insights.sys_hris_listening_lineage_receipts(tenant_id,projection_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_insights.sys_hris_listening_lineage_receipts FOR EACH ROW EXECUTE FUNCTION hris_insights.reject_immutable_mutation();


CREATE TABLE hris_insights.sys_hris_listening_export_receipts (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    cohort_projection_public_id UUID NOT NULL,
    request_public_id UUID NOT NULL,
    request_sha256 CHAR(64) NOT NULL,
    processing_state VARCHAR(24) NOT NULL DEFAULT 'REQUESTED',
    object_token_public_id UUID,
    object_owner VARCHAR(40),
    result_sha256 CHAR(64),
    expires_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_listening_export_receipts_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_listening_export_receipts_version CHECK (version>=0),
    CONSTRAINT uk_hris_listening_export_receipts_1 UNIQUE (tenant_id, request_public_id),
    CONSTRAINT fk_hris_listening_export_receipts_1 FOREIGN KEY (tenant_id, cohort_projection_public_id) REFERENCES hris_insights.sys_hris_listening_cohort_projections (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_hris_listening_export_receipts_1 CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_listening_export_receipts_2 CHECK (result_sha256 IS NULL OR result_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_listening_export_receipts_3 CHECK (processing_state IN ('REQUESTED','READY','FAILED','EXPIRED','CANCELLED')),
    CONSTRAINT ck_hris_listening_export_receipts_4 CHECK ((object_token_public_id IS NULL)=(object_owner IS NULL))
);
COMMENT ON TABLE hris_insights.sys_hris_listening_export_receipts IS 'insights export lifecycle receipt | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_insights.sys_hris_listening_export_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_insights.sys_hris_listening_export_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_insights.sys_hris_listening_export_receipts USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_listening_export_receipts_1 ON hris_insights.sys_hris_listening_export_receipts(tenant_id,request_sha256);
CREATE INDEX ix_hris_listening_export_receipts_2 ON hris_insights.sys_hris_listening_export_receipts(tenant_id,result_sha256);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_insights.sys_hris_listening_export_receipts FOR EACH ROW EXECUTE FUNCTION hris_insights.enforce_cas_version();


CREATE TABLE hris_insights.sys_hris_listening_insights_inbox (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    consumer_key VARCHAR(120) NOT NULL,
    message_public_id UUID NOT NULL,
    message_sha256 CHAR(64) NOT NULL,
    processing_state VARCHAR(24) NOT NULL DEFAULT 'RECEIVED',
    closed_ack JSONB,
    ack_sha256 CHAR(64),
    received_at TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_listening_insights_inbox_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_listening_insights_inbox_version CHECK (version>=0),
    CONSTRAINT uk_hris_listening_insights_inbox_1 UNIQUE (tenant_id, consumer_key, message_public_id),
    CONSTRAINT ck_hris_listening_insights_inbox_1 CHECK (message_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_listening_insights_inbox_2 CHECK (ack_sha256 IS NULL OR ack_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_listening_insights_inbox_3 CHECK (processing_state IN ('RECEIVED','PROCESSING','PROCESSED','QUARANTINED'))
);
COMMENT ON TABLE hris_insights.sys_hris_listening_insights_inbox IS 'insights owner inbox and closed acknowledgement | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_insights.sys_hris_listening_insights_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_insights.sys_hris_listening_insights_inbox FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_insights.sys_hris_listening_insights_inbox USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_listening_insights_inbox_1 ON hris_insights.sys_hris_listening_insights_inbox(tenant_id,message_sha256);
CREATE INDEX ix_hris_listening_insights_inbox_2 ON hris_insights.sys_hris_listening_insights_inbox(tenant_id,ack_sha256);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_insights.sys_hris_listening_insights_inbox FOR EACH ROW EXECUTE FUNCTION hris_insights.enforce_cas_version();


CREATE TABLE hris_insights.sys_hris_listening_insights_outbox (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    event_public_id UUID NOT NULL,
    message_type VARCHAR(160) NOT NULL,
    payload JSONB NOT NULL,
    payload_sha256 CHAR(64) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    delivery_state VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    correlation_id UUID NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_listening_insights_outbox_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_listening_insights_outbox_version CHECK (version>=0),
    CONSTRAINT uk_hris_listening_insights_outbox_1 UNIQUE (tenant_id, event_public_id),
    CONSTRAINT ck_hris_listening_insights_outbox_1 CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_listening_insights_outbox_2 CHECK (delivery_state IN ('PENDING','PUBLISHED','QUARANTINED'))
);
COMMENT ON TABLE hris_insights.sys_hris_listening_insights_outbox IS 'insights owner immutable outbox | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_insights.sys_hris_listening_insights_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_insights.sys_hris_listening_insights_outbox FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_insights.sys_hris_listening_insights_outbox USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_listening_insights_outbox_1 ON hris_insights.sys_hris_listening_insights_outbox(tenant_id,payload_sha256);
CREATE INDEX ix_hris_listening_insights_outbox_2 ON hris_insights.sys_hris_listening_insights_outbox(tenant_id,correlation_id);
CREATE TRIGGER guard_outbox_delivery_transition BEFORE UPDATE OR DELETE ON hris_insights.sys_hris_listening_insights_outbox FOR EACH ROW EXECUTE FUNCTION hris_insights.guard_outbox_delivery_transition();


SET LOCAL ROLE dwp_hris_participation_issuer_owner;
CREATE TABLE hris_participation_issuer.sys_hris_listening_eligibility_versions (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    survey_public_id UUID NOT NULL,
    eligibility_revision BIGINT NOT NULL,
    audience_definition_public_id UUID NOT NULL,
    audience_owner VARCHAR(40) NOT NULL DEFAULT 'DWP-IAM',
    effective_from TIMESTAMPTZ NOT NULL,
    effective_to TIMESTAMPTZ NOT NULL,
    eligibility_sha256 CHAR(64) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_listening_eligibility_versions_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_listening_eligibility_versions_version CHECK (version>=0),
    CONSTRAINT uk_hris_listening_eligibility_versions_1 UNIQUE (tenant_id, survey_public_id, eligibility_revision),
    CONSTRAINT ck_hris_listening_eligibility_versions_1 CHECK (eligibility_revision>0),
    CONSTRAINT ck_hris_listening_eligibility_versions_2 CHECK (effective_to>effective_from),
    CONSTRAINT ck_hris_listening_eligibility_versions_3 CHECK (eligibility_sha256 ~ '^[0-9a-f]{64}$')
);
COMMENT ON TABLE hris_participation_issuer.sys_hris_listening_eligibility_versions IS 'issuer-owned immutable participation eligibility revision | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_participation_issuer.sys_hris_listening_eligibility_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_participation_issuer.sys_hris_listening_eligibility_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_participation_issuer.sys_hris_listening_eligibility_versions USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_listening_eligibility_versions_1 ON hris_participation_issuer.sys_hris_listening_eligibility_versions(tenant_id,eligibility_sha256);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_participation_issuer.sys_hris_listening_eligibility_versions FOR EACH ROW EXECUTE FUNCTION hris_participation_issuer.reject_immutable_mutation();


CREATE TABLE hris_participation_issuer.sys_hris_listening_token_issuances (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    eligibility_version_public_id UUID NOT NULL,
    issuance_ordinal BIGINT NOT NULL,
    subject_public_id UUID NOT NULL,
    subject_owner VARCHAR(32) NOT NULL DEFAULT 'DWP-IAM',
    token_sha256 CHAR(64) NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_listening_token_issuances_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_listening_token_issuances_version CHECK (version>=0),
    CONSTRAINT uk_hris_listening_token_issuances_1 UNIQUE (tenant_id, eligibility_version_public_id, issuance_ordinal),
    CONSTRAINT fk_hris_listening_token_issuances_1 FOREIGN KEY (tenant_id, eligibility_version_public_id) REFERENCES hris_participation_issuer.sys_hris_listening_eligibility_versions (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_hris_listening_token_issuances_1 CHECK (issuance_ordinal>0),
    CONSTRAINT ck_hris_listening_token_issuances_2 CHECK (token_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_listening_token_issuances_3 CHECK (expires_at>issued_at)
);
COMMENT ON TABLE hris_participation_issuer.sys_hris_listening_token_issuances IS 'issuer one-time participation token issuance | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_participation_issuer.sys_hris_listening_token_issuances ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_participation_issuer.sys_hris_listening_token_issuances FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_participation_issuer.sys_hris_listening_token_issuances USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_participation_issuer.sys_hris_listening_token_issuances FOR EACH ROW EXECUTE FUNCTION hris_participation_issuer.reject_immutable_mutation();


CREATE TABLE hris_participation_issuer.sys_hris_listening_token_revocations (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    token_issuance_public_id UUID NOT NULL,
    revocation_ordinal INTEGER NOT NULL,
    reason_code VARCHAR(80) NOT NULL,
    revoked_at TIMESTAMPTZ NOT NULL,
    authority_receipt_public_id UUID NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_listening_token_revocations_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_listening_token_revocations_version CHECK (version>=0),
    CONSTRAINT uk_hris_listening_token_revocations_1 UNIQUE (tenant_id, token_issuance_public_id, revocation_ordinal),
    CONSTRAINT fk_hris_listening_token_revocations_1 FOREIGN KEY (tenant_id, token_issuance_public_id) REFERENCES hris_participation_issuer.sys_hris_listening_token_issuances (tenant_id, public_id) DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT ck_hris_listening_token_revocations_1 CHECK (revocation_ordinal>0)
);
COMMENT ON TABLE hris_participation_issuer.sys_hris_listening_token_revocations IS 'issuer immutable token revocation | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_participation_issuer.sys_hris_listening_token_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_participation_issuer.sys_hris_listening_token_revocations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_participation_issuer.sys_hris_listening_token_revocations USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE TRIGGER reject_immutable_mutation BEFORE UPDATE OR DELETE ON hris_participation_issuer.sys_hris_listening_token_revocations FOR EACH ROW EXECUTE FUNCTION hris_participation_issuer.reject_immutable_mutation();


CREATE TABLE hris_participation_issuer.sys_hris_listening_issuer_receipts (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    consumer_key VARCHAR(120) NOT NULL,
    message_public_id UUID NOT NULL,
    message_sha256 CHAR(64) NOT NULL,
    processing_state VARCHAR(24) NOT NULL DEFAULT 'RECEIVED',
    closed_ack JSONB,
    ack_sha256 CHAR(64),
    received_at TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_listening_issuer_receipts_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_listening_issuer_receipts_version CHECK (version>=0),
    CONSTRAINT uk_hris_listening_issuer_receipts_1 UNIQUE (tenant_id, consumer_key, message_public_id),
    CONSTRAINT ck_hris_listening_issuer_receipts_1 CHECK (message_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_listening_issuer_receipts_2 CHECK (ack_sha256 IS NULL OR ack_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_listening_issuer_receipts_3 CHECK (processing_state IN ('RECEIVED','PROCESSING','PROCESSED','QUARANTINED'))
);
COMMENT ON TABLE hris_participation_issuer.sys_hris_listening_issuer_receipts IS 'participation issuer inbox and closed acknowledgement | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_participation_issuer.sys_hris_listening_issuer_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_participation_issuer.sys_hris_listening_issuer_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_participation_issuer.sys_hris_listening_issuer_receipts USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_listening_issuer_receipts_1 ON hris_participation_issuer.sys_hris_listening_issuer_receipts(tenant_id,message_sha256);
CREATE INDEX ix_hris_listening_issuer_receipts_2 ON hris_participation_issuer.sys_hris_listening_issuer_receipts(tenant_id,ack_sha256);
CREATE TRIGGER enforce_cas_version BEFORE UPDATE ON hris_participation_issuer.sys_hris_listening_issuer_receipts FOR EACH ROW EXECUTE FUNCTION hris_participation_issuer.enforce_cas_version();


CREATE TABLE hris_participation_issuer.sys_hris_listening_issuer_outbox (
    tenant_id BIGINT NOT NULL,
    public_id UUID NOT NULL,
    event_public_id UUID NOT NULL,
    message_type VARCHAR(160) NOT NULL,
    payload JSONB NOT NULL,
    payload_sha256 CHAR(64) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    delivery_state VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    correlation_id UUID NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT pk_hris_listening_issuer_outbox_public PRIMARY KEY (tenant_id, public_id),
    CONSTRAINT ck_hris_listening_issuer_outbox_version CHECK (version>=0),
    CONSTRAINT uk_hris_listening_issuer_outbox_1 UNIQUE (tenant_id, event_public_id),
    CONSTRAINT ck_hris_listening_issuer_outbox_1 CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_hris_listening_issuer_outbox_2 CHECK (delivery_state IN ('PENDING','PUBLISHED','QUARANTINED'))
);
COMMENT ON TABLE hris_participation_issuer.sys_hris_listening_issuer_outbox IS 'participation issuer immutable outbox | closed-set v3 | NOT_AUTHORIZED_G6';
ALTER TABLE hris_participation_issuer.sys_hris_listening_issuer_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE hris_participation_issuer.sys_hris_listening_issuer_outbox FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hris_participation_issuer.sys_hris_listening_issuer_outbox USING(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT) WITH CHECK(tenant_id=NULLIF(current_setting('dwp.tenant_id',true),'')::BIGINT);
CREATE INDEX ix_hris_listening_issuer_outbox_1 ON hris_participation_issuer.sys_hris_listening_issuer_outbox(tenant_id,payload_sha256);
CREATE INDEX ix_hris_listening_issuer_outbox_2 ON hris_participation_issuer.sys_hris_listening_issuer_outbox(tenant_id,correlation_id);
CREATE TRIGGER guard_outbox_delivery_transition BEFORE UPDATE OR DELETE ON hris_participation_issuer.sys_hris_listening_issuer_outbox FOR EACH ROW EXECUTE FUNCTION hris_participation_issuer.guard_outbox_delivery_transition();

-- AI activation is fail closed: publication/assistance must have live typed DWP governance receipts,
-- unexpired exact model/prompt/data/evaluation pins, required worker disclosure, monitoring and rollback bindings.
-- These references are owner-port verified in application code; cross-owner database FKs are forbidden.
SET LOCAL ROLE dwp_hris_ai_owner;
CREATE FUNCTION hris_ai_modern.assert_ai_activation_shape() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
BEGIN
 IF NEW.lifecycle_state IN ('PUBLISHED','ACTIVE','CONFIRMED') AND
   (NEW.expires_at<=transaction_timestamp() OR NEW.governance_policy_public_id IS NULL OR NEW.impact_assessment_receipt_public_id IS NULL OR NEW.monitoring_plan_receipt_public_id IS NULL)
 THEN RAISE EXCEPTION 'AI activation governance evidence missing or expired'; END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION hris_ai_modern.assert_ai_activation_shape() FROM PUBLIC,dwp_hris_ai_runtime,dwp_hris_ai_reader,dwp_hris_ai_handler;
GRANT EXECUTE ON FUNCTION hris_ai_modern.assert_ai_activation_shape() TO dwp_hris_ai_owner,dwp_hris_ai_migrator;
CREATE TRIGGER assert_ai_activation_shape BEFORE INSERT OR UPDATE ON hris_ai_modern.sys_hris_ai_use_policies FOR EACH ROW EXECUTE FUNCTION hris_ai_modern.assert_ai_activation_shape();

-- Protected erasure can only move ACTIVE -> ERASURE_REQUESTED -> ERASED and must remove ciphertext/key refs.
SET LOCAL ROLE dwp_hris_listening_protected_owner;
CREATE FUNCTION hris_listening_protected.guard_privacy_erasure_transition() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
BEGIN
 IF OLD.privacy_state='ERASED' THEN RAISE EXCEPTION 'erased tombstone is immutable'; END IF;
 IF OLD.privacy_state='ACTIVE' AND NEW.privacy_state NOT IN('ACTIVE','ERASURE_REQUESTED','ERASED') THEN RAISE EXCEPTION 'invalid privacy transition'; END IF;
 IF OLD.privacy_state='ERASURE_REQUESTED' AND NEW.privacy_state NOT IN('ERASURE_REQUESTED','ERASED') THEN RAISE EXCEPTION 'invalid privacy transition'; END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION hris_listening_protected.guard_privacy_erasure_transition() FROM PUBLIC,dwp_hris_listening_protected_runtime,dwp_hris_listening_protected_reader,dwp_hris_listening_protected_handler,dwp_hris_listening_erasure_runtime;
GRANT EXECUTE ON FUNCTION hris_listening_protected.guard_privacy_erasure_transition() TO dwp_hris_listening_protected_owner,dwp_hris_listening_protected_migrator;
CREATE TRIGGER guard_privacy_erasure_transition BEFORE UPDATE ON hris_listening_protected.sys_hris_listening_responses FOR EACH ROW EXECUTE FUNCTION hris_listening_protected.guard_privacy_erasure_transition();
CREATE TRIGGER guard_privacy_erasure_transition BEFORE UPDATE ON hris_listening_protected.sys_hris_listening_answer_values FOR EACH ROW EXECUTE FUNCTION hris_listening_protected.guard_privacy_erasure_transition();

-- Exact ACL by owner and table class. Raw readers/query roles receive no table grant;
-- G3 must publish only the 44 authorized projections/views. No application role can DELETE.
SET LOCAL ROLE dwp_hris_ai_owner;
REVOKE ALL ON ALL TABLES IN SCHEMA hris_ai_modern FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON TABLE hris_ai_modern.sys_hris_ai_use_policies,hris_ai_modern.sys_hris_ai_evaluation_requests,hris_ai_modern.sys_hris_ai_assistance_requests TO dwp_hris_ai_runtime;
GRANT SELECT,INSERT ON TABLE hris_ai_modern.sys_hris_ai_policy_versions TO dwp_hris_ai_runtime;
GRANT SELECT,UPDATE ON TABLE hris_ai_modern.sys_hris_ai_evaluation_requests,hris_ai_modern.sys_hris_ai_assistance_requests TO dwp_hris_ai_handler;
GRANT SELECT,INSERT ON TABLE hris_ai_modern.sys_hris_ai_evaluation_receipts,hris_ai_modern.sys_hris_ai_provenance_receipts TO dwp_hris_ai_handler;
ALTER DEFAULT PRIVILEGES FOR ROLE dwp_hris_ai_owner IN SCHEMA hris_ai_modern REVOKE ALL ON TABLES FROM PUBLIC;

SET LOCAL ROLE dwp_hris_analytics_owner;
REVOKE ALL ON ALL TABLES IN SCHEMA hris_analytics_modern FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON TABLE hris_analytics_modern.sys_hris_metric_definitions,hris_analytics_modern.sys_hris_metric_projection_requests,hris_analytics_modern.sys_hris_analytics_export_receipts TO dwp_hris_analytics_runtime;
GRANT SELECT,INSERT ON TABLE hris_analytics_modern.sys_hris_metric_versions TO dwp_hris_analytics_runtime;
GRANT SELECT,UPDATE ON TABLE hris_analytics_modern.sys_hris_metric_projection_requests,hris_analytics_modern.sys_hris_analytics_export_receipts TO dwp_hris_analytics_handler;
GRANT SELECT,INSERT ON TABLE hris_analytics_modern.sys_hris_metric_projections TO dwp_hris_analytics_handler;
ALTER DEFAULT PRIVILEGES FOR ROLE dwp_hris_analytics_owner IN SCHEMA hris_analytics_modern REVOKE ALL ON TABLES FROM PUBLIC;

SET LOCAL ROLE dwp_hris_configuration_owner;
REVOKE ALL ON ALL TABLES IN SCHEMA hris_configuration FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON TABLE hris_configuration.sys_hris_listening_surveys,hris_configuration.sys_hris_listening_actions TO dwp_hris_configuration_runtime;
GRANT SELECT,INSERT ON TABLE hris_configuration.sys_hris_listening_survey_versions,hris_configuration.sys_hris_listening_domain_outbox TO dwp_hris_configuration_runtime;
GRANT SELECT,INSERT,UPDATE ON TABLE hris_configuration.sys_hris_listening_operation_receipts TO dwp_hris_configuration_handler;
GRANT SELECT,UPDATE ON TABLE hris_configuration.sys_hris_listening_surveys TO dwp_hris_configuration_handler;
GRANT SELECT,INSERT ON TABLE hris_configuration.sys_hris_listening_survey_versions TO dwp_hris_configuration_handler;
GRANT SELECT,INSERT,UPDATE ON TABLE hris_configuration.sys_hris_listening_domain_outbox TO dwp_hris_configuration_handler;
ALTER DEFAULT PRIVILEGES FOR ROLE dwp_hris_configuration_owner IN SCHEMA hris_configuration REVOKE ALL ON TABLES FROM PUBLIC;

SET LOCAL ROLE dwp_hris_listening_protected_owner;
REVOKE ALL ON ALL TABLES IN SCHEMA hris_listening_protected FROM PUBLIC;
GRANT SELECT,INSERT ON TABLE hris_listening_protected.sys_hris_listening_responses,hris_listening_protected.sys_hris_listening_answer_values,hris_listening_protected.sys_hris_listening_token_consumptions TO dwp_hris_listening_protected_runtime;
GRANT SELECT,INSERT ON TABLE hris_listening_protected.sys_hris_listening_admission_versions TO dwp_hris_listening_protected_handler;
GRANT SELECT,INSERT,UPDATE ON TABLE hris_listening_protected.sys_hris_listening_protected_receipts,hris_listening_protected.sys_hris_listening_erasure_tickets,hris_listening_protected.sys_hris_listening_cohort_budgets,hris_listening_protected.sys_hris_listening_cohort_packages,hris_listening_protected.sys_hris_listening_protected_outbox TO dwp_hris_listening_protected_handler;
GRANT SELECT,UPDATE ON TABLE hris_listening_protected.sys_hris_listening_responses,hris_listening_protected.sys_hris_listening_answer_values,hris_listening_protected.sys_hris_listening_erasure_tickets TO dwp_hris_listening_erasure_runtime;
GRANT SELECT,INSERT ON TABLE hris_listening_protected.sys_hris_listening_protected_receipts,hris_listening_protected.sys_hris_listening_protected_outbox TO dwp_hris_listening_erasure_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE dwp_hris_listening_protected_owner IN SCHEMA hris_listening_protected REVOKE ALL ON TABLES FROM PUBLIC;

SET LOCAL ROLE dwp_hris_insights_owner;
REVOKE ALL ON ALL TABLES IN SCHEMA hris_insights FROM PUBLIC;
GRANT SELECT,INSERT ON TABLE hris_insights.sys_hris_listening_cohort_projections,hris_insights.sys_hris_listening_lineage_receipts TO dwp_hris_insights_projection_runtime;
GRANT SELECT,INSERT,UPDATE ON TABLE hris_insights.sys_hris_listening_export_receipts,hris_insights.sys_hris_listening_insights_inbox,hris_insights.sys_hris_listening_insights_outbox TO dwp_hris_insights_projection_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE dwp_hris_insights_owner IN SCHEMA hris_insights REVOKE ALL ON TABLES FROM PUBLIC;

SET LOCAL ROLE dwp_hris_participation_issuer_owner;
REVOKE ALL ON ALL TABLES IN SCHEMA hris_participation_issuer FROM PUBLIC;
GRANT SELECT,INSERT ON TABLE hris_participation_issuer.sys_hris_listening_eligibility_versions,hris_participation_issuer.sys_hris_listening_token_issuances,hris_participation_issuer.sys_hris_listening_token_revocations TO dwp_hris_participation_issuer_runtime;
GRANT SELECT,INSERT,UPDATE ON TABLE hris_participation_issuer.sys_hris_listening_issuer_receipts,hris_participation_issuer.sys_hris_listening_issuer_outbox TO dwp_hris_participation_issuer_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE dwp_hris_participation_issuer_owner IN SCHEMA hris_participation_issuer REVOKE ALL ON TABLES FROM PUBLIC;

-- Fail closed on exact 35-table union, common physical shape and forbidden correlation/digest uniqueness.
DO $verify$ DECLARE expected TEXT[]:=ARRAY['sys_hris_ai_use_policies','sys_hris_ai_policy_versions','sys_hris_ai_evaluation_requests','sys_hris_ai_evaluation_receipts','sys_hris_ai_assistance_requests','sys_hris_ai_provenance_receipts','sys_hris_metric_definitions','sys_hris_metric_versions','sys_hris_metric_projection_requests','sys_hris_metric_projections','sys_hris_analytics_export_receipts','sys_hris_listening_surveys','sys_hris_listening_survey_versions','sys_hris_listening_actions','sys_hris_listening_operation_receipts','sys_hris_listening_domain_outbox','sys_hris_listening_admission_versions','sys_hris_listening_responses','sys_hris_listening_answer_values','sys_hris_listening_token_consumptions','sys_hris_listening_protected_receipts','sys_hris_listening_erasure_tickets','sys_hris_listening_cohort_budgets','sys_hris_listening_cohort_packages','sys_hris_listening_protected_outbox','sys_hris_listening_cohort_projections','sys_hris_listening_lineage_receipts','sys_hris_listening_export_receipts','sys_hris_listening_insights_inbox','sys_hris_listening_insights_outbox','sys_hris_listening_eligibility_versions','sys_hris_listening_token_issuances','sys_hris_listening_token_revocations','sys_hris_listening_issuer_receipts','sys_hris_listening_issuer_outbox'];actual TEXT[];table_name TEXT; BEGIN
 SELECT array_agg(c.relname ORDER BY c.relname) INTO actual FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname=ANY(ARRAY['hris_ai_modern','hris_analytics_modern','hris_configuration','hris_listening_protected','hris_insights','hris_participation_issuer']);
 SELECT array_agg(x ORDER BY x) INTO expected FROM unnest(expected)x;
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'SYS exact table set mismatch expected %, actual %',expected,actual; END IF;
 FOREACH table_name IN ARRAY expected LOOP IF(SELECT count(*) FROM information_schema.columns WHERE table_schema=ANY(ARRAY['hris_ai_modern','hris_analytics_modern','hris_configuration','hris_listening_protected','hris_insights','hris_participation_issuer']) AND information_schema.columns.table_name=table_name AND column_name IN('tenant_id','public_id','version','created_at','updated_at'))<>5 THEN RAISE EXCEPTION 'required physical columns missing on %',table_name;END IF;END LOOP;
 IF EXISTS(SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY(ARRAY['hris_ai_modern','hris_analytics_modern','hris_configuration','hris_listening_protected','hris_insights','hris_participation_issuer']) AND i.indisunique AND EXISTS(SELECT 1 FROM unnest(i.indkey)k JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k WHERE a.attname~'(correlation|payload_sha256|request_sha256|message_sha256|content_sha256|digest|hash)')) THEN RAISE EXCEPTION 'unique correlation/hash/digest index is forbidden'; END IF;
 IF EXISTS(WITH owner_map(schema_name,owner_name)AS(VALUES('hris_ai_modern','dwp_hris_ai_owner'),('hris_analytics_modern','dwp_hris_analytics_owner'),('hris_configuration','dwp_hris_configuration_owner'),('hris_listening_protected','dwp_hris_listening_protected_owner'),('hris_insights','dwp_hris_insights_owner'),('hris_participation_issuer','dwp_hris_participation_issuer_owner'))SELECT 1 FROM owner_map m JOIN pg_namespace n ON n.nspname=m.schema_name JOIN pg_roles nr ON nr.oid=n.nspowner WHERE nr.rolname<>m.owner_name)THEN RAISE EXCEPTION 'SYS schema owner mismatch';END IF;
 IF EXISTS(WITH owner_map(schema_name,owner_name)AS(VALUES('hris_ai_modern','dwp_hris_ai_owner'),('hris_analytics_modern','dwp_hris_analytics_owner'),('hris_configuration','dwp_hris_configuration_owner'),('hris_listening_protected','dwp_hris_listening_protected_owner'),('hris_insights','dwp_hris_insights_owner'),('hris_participation_issuer','dwp_hris_participation_issuer_owner'))SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner JOIN owner_map m ON m.schema_name=n.nspname WHERE c.relkind IN('r','p') AND r.rolname<>m.owner_name)THEN RAISE EXCEPTION 'SYS table owner mismatch';END IF;
 IF EXISTS(WITH owner_map(schema_name,owner_name)AS(VALUES('hris_ai_modern','dwp_hris_ai_owner'),('hris_analytics_modern','dwp_hris_analytics_owner'),('hris_configuration','dwp_hris_configuration_owner'),('hris_listening_protected','dwp_hris_listening_protected_owner'),('hris_insights','dwp_hris_insights_owner'),('hris_participation_issuer','dwp_hris_participation_issuer_owner'))SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner JOIN owner_map m ON m.schema_name=n.nspname WHERE r.rolname<>m.owner_name)THEN RAISE EXCEPTION 'SYS function owner mismatch';END IF;
END $verify$;
COMMIT;

-- MIGRATION NOTES
-- 1. Author-smoke uses the pinned NOINHERIT dwp_hris_sys_migrator, which must have SET membership in all six NOLOGIN owners. G3 splits this blueprint by exact owner schema, changes each copied preflight to its already-pinned owner-specific migrator, and allocates each Flyway stream independently under the common verification semaphore.
-- 2. DWP AI governance remains authoritative. G3 adapters refetch typed purpose/version receipts; G6 activation rejects expired/missing impact, conformity, monitoring, disclosure, incident or rollback evidence.
-- 3. Listening configuration/protected/insights/issuer owners never share repositories or transactions. Signed inbox -> local CAS/domain -> closed ack -> local outbox is atomic per owner.
-- 4. Privacy erasure destroys key material and clears ciphertext before a non-linkable tombstone; raw/linkable public events are forbidden.
-- 5. Correlation/content/token hashes are never uniqueness keys; typed public IDs plus owner-local ordinals/message IDs carry identity and replay semantics.
-- 6. Flyway history supplies replay idempotence. Direct replay or any pre-created table/index/policy/trigger/function collision fails closed.
-- 7. Production use remains NOT_AUTHORIZED_G6; rollback is forward correction and immutable evidence is never deleted.
