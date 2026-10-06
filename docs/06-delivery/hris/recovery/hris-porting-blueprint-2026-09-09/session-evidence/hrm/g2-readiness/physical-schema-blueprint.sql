-- HRIS-HRM PostgreSQL physical schema blueprint v1
-- STATUS: READY_FOR_G3_CODE; NOT A FLYWAY MIGRATION; DO NOT EXECUTE DIRECTLY.
-- A central migration number, data profiling/remediation, load model and DBA approval
-- are required before this is translated into executable migrations.
-- Existing DWP tables are strengthened in place; no SKKF table is cloned.
-- DECIMAL-SSOT: coding-readiness/decimal-value-types.v1.json. Decimal values are
-- validated and canonicalized with application decimal arithmetic before SQL bind;
-- PostgreSQL implicit scale coercion is never a rounding operation.

-- Expected platform capability. Installation is a DBA/platform action.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------------
-- 0. Preconditions and existing canonical tables
-- ---------------------------------------------------------------------------
-- Existing canonical tables retained:
--   ppl_persons, ppl_person_names,
--   ppl_contacts, ppl_profile_media, ppl_workers, ppl_work_relationships,
--   ppl_assignments, ppl_legal_employers, ppl_organizations,
--   ppl_organization_relationships, ppl_job_profiles, ppl_job_grades,
--   ppl_positions, ppl_locations,
--   int_source_systems, int_external_mappings, int_sync_runs/errors,
--   sys_people_audit_events, sys_people_outbox_events.
-- V43 intentionally retired the provisional private/identifier/custom-attribute
-- placeholders. No HRIS code may recreate or depend on those tables. Raw tax
-- identifiers and payment-destination values live only in an approved restricted
-- vault; People owns purpose-bound opaque token references in
-- ppl_worker_restricted_tokens.
--
-- Before adding range constraints, legacy inclusive end dates must be profiled and
-- converted to exclusive end dates. Invalid/overlapping records go to a migration
-- quarantine; the migration must never silently discard or delete a slice.

ALTER TABLE ppl_legal_employers
    ADD COLUMN IF NOT EXISTS public_id UUID DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS valid_from DATE DEFAULT DATE '1900-01-01',
    ADD COLUMN IF NOT EXISTS valid_to DATE;

ALTER TABLE ppl_legal_employers
    ALTER COLUMN public_id SET NOT NULL,
    ALTER COLUMN valid_from SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_ppl_legal_employers_public_id
    ON ppl_legal_employers(public_id);

ALTER TABLE ppl_work_relationships
    ADD COLUMN IF NOT EXISTS public_id UUID DEFAULT gen_random_uuid();
ALTER TABLE ppl_work_relationships ALTER COLUMN public_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uk_ppl_work_relationships_public_id
    ON ppl_work_relationships(public_id);

ALTER TABLE ppl_assignments
    ADD COLUMN IF NOT EXISTS public_id UUID DEFAULT gen_random_uuid();
ALTER TABLE ppl_assignments ALTER COLUMN public_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uk_ppl_assignments_public_id
    ON ppl_assignments(public_id);

ALTER TABLE ppl_job_profiles
    ADD COLUMN IF NOT EXISTS public_id UUID DEFAULT gen_random_uuid();
ALTER TABLE ppl_job_profiles ALTER COLUMN public_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uk_ppl_job_profiles_public_id
    ON ppl_job_profiles(public_id);

ALTER TABLE ppl_job_grades
    ADD COLUMN IF NOT EXISTS public_id UUID DEFAULT gen_random_uuid();
ALTER TABLE ppl_job_grades ALTER COLUMN public_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uk_ppl_job_grades_public_id
    ON ppl_job_grades(public_id);

ALTER TABLE ppl_positions
    ADD COLUMN IF NOT EXISTS public_id UUID DEFAULT gen_random_uuid();
ALTER TABLE ppl_positions ALTER COLUMN public_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uk_ppl_positions_public_id
    ON ppl_positions(public_id);

ALTER TABLE ppl_locations
    ADD COLUMN IF NOT EXISTS public_id UUID DEFAULT gen_random_uuid();
ALTER TABLE ppl_locations ALTER COLUMN public_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uk_ppl_locations_public_id
    ON ppl_locations(public_id);

-- Add only after end-date normalization and overlap remediation.
ALTER TABLE ppl_work_relationships
    ADD CONSTRAINT ex_ppl_work_relationships_primary_period
    EXCLUDE USING gist (
        tenant_id WITH =,
        worker_id WITH =,
        daterange(start_date, end_date, '[)') WITH &&
    ) WHERE (primary_relationship);

ALTER TABLE ppl_assignments
    ADD CONSTRAINT ex_ppl_assignments_primary_period
    EXCLUDE USING gist (
        tenant_id WITH =,
        work_relationship_id WITH =,
        daterange(effective_start_date, effective_end_date, '[)') WITH &&
    ) WHERE (primary_assignment);

-- ---------------------------------------------------------------------------
-- 1. Enterprise and organization extensions
-- ---------------------------------------------------------------------------

CREATE TABLE ppl_legal_entity_registrations (
    legal_entity_registration_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    legal_employer_id BIGINT NOT NULL,
    jurisdiction_code VARCHAR(40) NOT NULL,
    registration_type VARCHAR(60) NOT NULL,
    registration_value_hash CHAR(64) NOT NULL,
    encrypted_registration_value BYTEA NOT NULL,
    key_reference VARCHAR(255) NOT NULL,
    display_suffix VARCHAR(16),
    valid_from DATE NOT NULL,
    valid_to DATE,
    version BIGINT NOT NULL DEFAULT 0,
    retention_class VARCHAR(40) NOT NULL DEFAULT 'STATUTORY',
    retention_until DATE,
    legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT NOT NULL,
    CONSTRAINT uk_ppl_legal_entity_registrations_public UNIQUE (public_id),
    CONSTRAINT uk_ppl_legal_entity_registrations_id UNIQUE (tenant_id, legal_entity_registration_id),
    CONSTRAINT uk_ppl_legal_entity_registrations_hash UNIQUE
        (tenant_id, jurisdiction_code, registration_type, registration_value_hash),
    CONSTRAINT fk_ppl_legal_entity_registrations_employer FOREIGN KEY
        (tenant_id, legal_employer_id)
        REFERENCES ppl_legal_employers(tenant_id, legal_employer_id),
    CONSTRAINT ck_ppl_legal_entity_registrations_period
        CHECK (valid_to IS NULL OR valid_to > valid_from)
);

CREATE TABLE ppl_business_units (
    business_unit_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    business_unit_key VARCHAR(100) NOT NULL,
    legal_employer_id BIGINT,
    organization_id BIGINT,
    name VARCHAR(240) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    lifecycle_state VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT NOT NULL,
    CONSTRAINT uk_ppl_business_units_public UNIQUE (public_id),
    CONSTRAINT uk_ppl_business_units_id UNIQUE (tenant_id, business_unit_id),
    CONSTRAINT uk_ppl_business_units_slice UNIQUE (tenant_id, business_unit_key, valid_from),
    CONSTRAINT fk_ppl_business_units_employer FOREIGN KEY (tenant_id, legal_employer_id)
        REFERENCES ppl_legal_employers(tenant_id, legal_employer_id),
    CONSTRAINT fk_ppl_business_units_org FOREIGN KEY (tenant_id, organization_id)
        REFERENCES ppl_organizations(tenant_id, organization_id),
    CONSTRAINT ck_ppl_business_units_state CHECK (lifecycle_state IN ('ACTIVE','INACTIVE')),
    CONSTRAINT ck_ppl_business_units_period CHECK (valid_to IS NULL OR valid_to > valid_from),
    CONSTRAINT ex_ppl_business_units_period EXCLUDE USING gist
        (tenant_id WITH =, business_unit_key WITH =, daterange(valid_from, valid_to, '[)') WITH &&)
);

CREATE TABLE ppl_establishments (
    establishment_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    establishment_key VARCHAR(100) NOT NULL,
    legal_employer_id BIGINT NOT NULL,
    location_id BIGINT NOT NULL,
    organization_id BIGINT,
    establishment_type VARCHAR(40) NOT NULL,
    name VARCHAR(240) NOT NULL,
    jurisdiction_code VARCHAR(40),
    valid_from DATE NOT NULL,
    valid_to DATE,
    lifecycle_state VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT NOT NULL,
    CONSTRAINT uk_ppl_establishments_public UNIQUE (public_id),
    CONSTRAINT uk_ppl_establishments_id UNIQUE (tenant_id, establishment_id),
    CONSTRAINT uk_ppl_establishments_slice UNIQUE (tenant_id, establishment_key, valid_from),
    CONSTRAINT fk_ppl_establishments_employer FOREIGN KEY (tenant_id, legal_employer_id)
        REFERENCES ppl_legal_employers(tenant_id, legal_employer_id),
    CONSTRAINT fk_ppl_establishments_location FOREIGN KEY (tenant_id, location_id)
        REFERENCES ppl_locations(tenant_id, location_id),
    CONSTRAINT fk_ppl_establishments_org FOREIGN KEY (tenant_id, organization_id)
        REFERENCES ppl_organizations(tenant_id, organization_id),
    CONSTRAINT ck_ppl_establishments_state CHECK (lifecycle_state IN ('ACTIVE','INACTIVE')),
    CONSTRAINT ck_ppl_establishments_period CHECK (valid_to IS NULL OR valid_to > valid_from),
    CONSTRAINT ex_ppl_establishments_period EXCLUDE USING gist
        (tenant_id WITH =, establishment_key WITH =, daterange(valid_from, valid_to, '[)') WITH &&)
);

-- ---------------------------------------------------------------------------
-- 2. Employment, assignment and compensation basis
-- ---------------------------------------------------------------------------

CREATE TABLE ppl_employment_terms (
    employment_terms_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    work_relationship_id BIGINT NOT NULL,
    assignment_id BIGINT,
    terms_type VARCHAR(40) NOT NULL,
    employment_type VARCHAR(40) NOT NULL,
    standard_weekly_hours NUMERIC(8,2),
    full_time_equivalent NUMERIC(7,6),
    pay_group_public_id UUID,
    collective_agreement_ref VARCHAR(160),
    valid_from DATE NOT NULL,
    valid_to DATE,
    source_system_id BIGINT,
    source_record_key VARCHAR(255),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT NOT NULL,
    CONSTRAINT uk_ppl_employment_terms_public UNIQUE (public_id),
    CONSTRAINT uk_ppl_employment_terms_id UNIQUE (tenant_id, employment_terms_id),
    CONSTRAINT uk_ppl_employment_terms_source UNIQUE
        (tenant_id, source_system_id, source_record_key),
    CONSTRAINT fk_ppl_employment_terms_relationship FOREIGN KEY
        (tenant_id, work_relationship_id)
        REFERENCES ppl_work_relationships(tenant_id, work_relationship_id),
    CONSTRAINT fk_ppl_employment_terms_assignment FOREIGN KEY (tenant_id, assignment_id)
        REFERENCES ppl_assignments(tenant_id, assignment_id),
    CONSTRAINT ck_ppl_employment_terms_period CHECK (valid_to IS NULL OR valid_to > valid_from),
    CONSTRAINT ck_ppl_employment_terms_hours CHECK
        (standard_weekly_hours IS NULL OR standard_weekly_hours BETWEEN 0 AND 168),
    CONSTRAINT ck_ppl_employment_terms_fte CHECK
        (full_time_equivalent IS NULL OR full_time_equivalent BETWEEN 0 AND 1),
    CONSTRAINT ex_ppl_employment_terms_period EXCLUDE USING gist
        (tenant_id WITH =, work_relationship_id WITH =,
         (COALESCE(assignment_id, 0)) WITH =, terms_type WITH =,
         daterange(valid_from, valid_to, '[)') WITH &&)
);

CREATE TABLE ppl_assignment_events (
    assignment_event_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    assignment_id BIGINT NOT NULL,
    event_type VARCHAR(40) NOT NULL,
    reason_code VARCHAR(80) NOT NULL,
    lifecycle_state VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    effective_date DATE NOT NULL,
    expected_assignment_version BIGINT NOT NULL,
    input_snapshot_hash CHAR(64) NOT NULL,
    impact_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    approval_case_public_id UUID,
    supersedes_event_id BIGINT,
    correlation_id UUID NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    validated_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT NOT NULL,
    CONSTRAINT uk_ppl_assignment_events_public UNIQUE (public_id),
    CONSTRAINT uk_ppl_assignment_events_id UNIQUE (tenant_id, assignment_event_id),
    CONSTRAINT uk_ppl_assignment_events_correlation UNIQUE (tenant_id, correlation_id),
    CONSTRAINT fk_ppl_assignment_events_assignment FOREIGN KEY (tenant_id, assignment_id)
        REFERENCES ppl_assignments(tenant_id, assignment_id),
    CONSTRAINT fk_ppl_assignment_events_supersedes FOREIGN KEY (tenant_id, supersedes_event_id)
        REFERENCES ppl_assignment_events(tenant_id, assignment_event_id),
    CONSTRAINT ck_ppl_assignment_events_type CHECK
        (event_type IN ('HIRE','REHIRE','TRANSFER','PROMOTION','DEMOTION','CONCURRENT_ASSIGNMENT',
                        'CHANGE_MANAGER','CHANGE_LOCATION','LEAVE','RETURN','TERMINATION','CORRECTION')),
    CONSTRAINT ck_ppl_assignment_events_state CHECK
        (lifecycle_state IN ('DRAFT','VALIDATED','PENDING_APPROVAL','APPROVED','PUBLISHED','REJECTED','CANCELLED')),
    CONSTRAINT ck_ppl_assignment_events_impact CHECK (jsonb_typeof(impact_snapshot) = 'object')
);

CREATE TABLE ppl_sensitive_change_payloads (
    sensitive_change_payload_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    schema_key VARCHAR(120) NOT NULL,
    schema_version INTEGER NOT NULL,
    encrypted_payload BYTEA NOT NULL,
    payload_hash CHAR(64) NOT NULL,
    key_reference VARCHAR(255) NOT NULL,
    retention_class VARCHAR(40) NOT NULL,
    retention_until DATE,
    legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT NOT NULL,
    CONSTRAINT uk_ppl_sensitive_change_payloads_public UNIQUE (public_id),
    CONSTRAINT uk_ppl_sensitive_change_payloads_id UNIQUE (tenant_id, sensitive_change_payload_id),
    CONSTRAINT uk_ppl_sensitive_change_payloads_hash UNIQUE (tenant_id, schema_key, payload_hash),
    CONSTRAINT ck_ppl_sensitive_change_payloads_schema CHECK (schema_version > 0)
);

CREATE TABLE ppl_assignment_event_items (
    assignment_event_item_id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    assignment_event_id BIGINT NOT NULL,
    field_path VARCHAR(180) NOT NULL,
    field_group VARCHAR(60) NOT NULL,
    before_payload_id BIGINT,
    after_payload_id BIGINT,
    change_digest CHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT NOT NULL,
    CONSTRAINT uk_ppl_assignment_event_items_field UNIQUE
        (tenant_id, assignment_event_id, field_path),
    CONSTRAINT fk_ppl_assignment_event_items_event FOREIGN KEY (tenant_id, assignment_event_id)
        REFERENCES ppl_assignment_events(tenant_id, assignment_event_id),
    CONSTRAINT fk_ppl_assignment_event_items_before FOREIGN KEY (tenant_id, before_payload_id)
        REFERENCES ppl_sensitive_change_payloads(tenant_id, sensitive_change_payload_id),
    CONSTRAINT fk_ppl_assignment_event_items_after FOREIGN KEY (tenant_id, after_payload_id)
        REFERENCES ppl_sensitive_change_payloads(tenant_id, sensitive_change_payload_id)
);

CREATE TABLE ppl_compensation_basis (
    compensation_basis_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    assignment_id BIGINT NOT NULL,
    basis_type VARCHAR(40) NOT NULL,
    amount NUMERIC(19,6),
    currency_code CHAR(3),
    frequency_code VARCHAR(40),
    grade_public_id UUID,
    source_event_public_id UUID,
    valid_from DATE NOT NULL,
    valid_to DATE,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT NOT NULL,
    CONSTRAINT uk_ppl_compensation_basis_public UNIQUE (public_id),
    CONSTRAINT uk_ppl_compensation_basis_id UNIQUE (tenant_id, compensation_basis_id),
    CONSTRAINT fk_ppl_compensation_basis_assignment FOREIGN KEY (tenant_id, assignment_id)
        REFERENCES ppl_assignments(tenant_id, assignment_id),
    CONSTRAINT ck_ppl_compensation_basis_value CHECK
        ((amount IS NULL AND currency_code IS NULL)
         OR (amount IS NOT NULL AND amount >= 0 AND currency_code ~ '^[A-Z]{3}$')),
    CONSTRAINT ck_ppl_compensation_basis_period CHECK (valid_to IS NULL OR valid_to > valid_from),
    CONSTRAINT ex_ppl_compensation_basis_period EXCLUDE USING gist
        (tenant_id WITH =, assignment_id WITH =, basis_type WITH =,
         daterange(valid_from, valid_to, '[)') WITH &&)
);

CREATE TABLE ppl_employment_contracts (
    employment_contract_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    work_relationship_id BIGINT NOT NULL,
    assignment_id BIGINT,
    contract_type VARCHAR(40) NOT NULL,
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    template_public_id UUID NOT NULL,
    template_version INTEGER NOT NULL,
    object_reference VARCHAR(500),
    content_sha256 CHAR(64),
    signature_case_public_id UUID,
    valid_from DATE NOT NULL,
    valid_to DATE,
    supersedes_contract_id BIGINT,
    retention_class VARCHAR(40) NOT NULL DEFAULT 'EMPLOYMENT_CONTRACT',
    retention_until DATE,
    legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
    correlation_id UUID NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    issued_at TIMESTAMPTZ,
    signed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT NOT NULL,
    CONSTRAINT uk_ppl_employment_contracts_public UNIQUE (public_id),
    CONSTRAINT uk_ppl_employment_contracts_id UNIQUE (tenant_id, employment_contract_id),
    CONSTRAINT uk_ppl_employment_contracts_correlation UNIQUE (tenant_id, correlation_id),
    CONSTRAINT fk_ppl_employment_contracts_relationship FOREIGN KEY (tenant_id, work_relationship_id)
        REFERENCES ppl_work_relationships(tenant_id, work_relationship_id),
    CONSTRAINT fk_ppl_employment_contracts_assignment FOREIGN KEY (tenant_id, assignment_id)
        REFERENCES ppl_assignments(tenant_id, assignment_id),
    CONSTRAINT fk_ppl_employment_contracts_supersedes FOREIGN KEY (tenant_id, supersedes_contract_id)
        REFERENCES ppl_employment_contracts(tenant_id, employment_contract_id),
    CONSTRAINT ck_ppl_employment_contracts_state CHECK
        (lifecycle_state IN ('DRAFT','ISSUED','SIGNED','ACTIVE','DECLINED','SUPERSEDED','EXPIRED','REVOKED')),
    CONSTRAINT ck_ppl_employment_contracts_period CHECK (valid_to IS NULL OR valid_to > valid_from),
    CONSTRAINT ck_ppl_employment_contracts_content CHECK
        ((object_reference IS NULL AND content_sha256 IS NULL) OR
         (object_reference IS NOT NULL AND content_sha256 IS NOT NULL))
);

-- ---------------------------------------------------------------------------
-- 3. Purpose-bound People profile records
-- ---------------------------------------------------------------------------

-- Restricted identity/payment SoR boundary. This is the canonical provider for
-- WorkerTaxIdentitySnapshot.v1 and WorkerBankAccountTokenSnapshot.v1 token fields.
-- vault_token_ref is opaque and non-reversible to this service; raw identifiers,
-- account/routing numbers and account-holder plaintext are forbidden in this DB.
CREATE TABLE ppl_worker_restricted_tokens (
    worker_restricted_token_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    worker_id BIGINT NOT NULL,
    token_kind VARCHAR(40) NOT NULL,
    purpose_code VARCHAR(60) NOT NULL,
    jurisdiction_code VARCHAR(40) NOT NULL,
    vault_provider_key VARCHAR(80) NOT NULL,
    vault_token_ref VARCHAR(255) NOT NULL,
    token_revision BIGINT NOT NULL,
    masked_display VARCHAR(32),
    currency_code CHAR(3),
    payment_priority SMALLINT,
    residency_status VARCHAR(40),
    verification_state VARCHAR(24) NOT NULL DEFAULT 'UNVERIFIED',
    primary_for_purpose BOOLEAN NOT NULL DEFAULT FALSE,
    valid_from DATE NOT NULL,
    valid_to DATE,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT NOT NULL,
    CONSTRAINT uk_ppl_worker_restricted_tokens_public UNIQUE (public_id),
    CONSTRAINT uk_ppl_worker_restricted_tokens_id UNIQUE (tenant_id, worker_restricted_token_id),
    CONSTRAINT uk_ppl_worker_restricted_tokens_vault UNIQUE
        (tenant_id, vault_provider_key, vault_token_ref, token_revision),
    CONSTRAINT fk_ppl_worker_restricted_tokens_worker FOREIGN KEY (tenant_id, worker_id)
        REFERENCES ppl_workers(tenant_id, worker_id),
    CONSTRAINT ck_ppl_worker_restricted_tokens_kind CHECK
        (token_kind IN ('TAX_IDENTITY','PAYMENT_DESTINATION')),
    CONSTRAINT ck_ppl_worker_restricted_tokens_revision CHECK (token_revision > 0),
    CONSTRAINT ck_ppl_worker_restricted_tokens_verify CHECK
        (verification_state IN ('UNVERIFIED','PENDING','VERIFIED','REJECTED','REVOKED')),
    CONSTRAINT ck_ppl_worker_restricted_tokens_shape CHECK
        ((token_kind = 'TAX_IDENTITY' AND currency_code IS NULL AND payment_priority IS NULL)
         OR
         (token_kind = 'PAYMENT_DESTINATION' AND currency_code ~ '^[A-Z]{3}$'
          AND payment_priority IS NOT NULL AND payment_priority > 0)),
    CONSTRAINT ck_ppl_worker_restricted_tokens_period CHECK (valid_to IS NULL OR valid_to > valid_from),
    CONSTRAINT ex_ppl_worker_restricted_tokens_primary EXCLUDE USING gist
        (tenant_id WITH =, worker_id WITH =, token_kind WITH =, purpose_code WITH =,
         daterange(valid_from, valid_to, '[)') WITH &&) WHERE (primary_for_purpose)
);

CREATE TABLE ppl_dependents (
    dependent_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    person_id BIGINT NOT NULL,
    related_person_public_id UUID,
    relationship_type VARCHAR(40) NOT NULL,
    encrypted_profile BYTEA NOT NULL,
    profile_schema_version INTEGER NOT NULL,
    key_reference VARCHAR(255) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT NOT NULL,
    CONSTRAINT uk_ppl_dependents_public UNIQUE (public_id),
    CONSTRAINT uk_ppl_dependents_id UNIQUE (tenant_id, dependent_id),
    CONSTRAINT fk_ppl_dependents_person FOREIGN KEY (tenant_id, person_id)
        REFERENCES ppl_persons(tenant_id, person_id),
    CONSTRAINT ck_ppl_dependents_schema CHECK (profile_schema_version > 0),
    CONSTRAINT ck_ppl_dependents_period CHECK (valid_to IS NULL OR valid_to > valid_from)
);

CREATE TABLE ppl_educations (
    education_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    person_id BIGINT NOT NULL,
    institution_name VARCHAR(240) NOT NULL,
    education_level_code VARCHAR(60),
    field_of_study VARCHAR(160),
    start_date DATE,
    end_date DATE,
    verification_state VARCHAR(24) NOT NULL DEFAULT 'UNVERIFIED',
    evidence_object_public_id UUID,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT NOT NULL,
    CONSTRAINT uk_ppl_educations_public UNIQUE (public_id),
    CONSTRAINT uk_ppl_educations_id UNIQUE (tenant_id, education_id),
    CONSTRAINT fk_ppl_educations_person FOREIGN KEY (tenant_id, person_id)
        REFERENCES ppl_persons(tenant_id, person_id),
    CONSTRAINT ck_ppl_educations_period CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
    CONSTRAINT ck_ppl_educations_verify CHECK
        (verification_state IN ('UNVERIFIED','PENDING','VERIFIED','REJECTED'))
);

CREATE TABLE ppl_careers (
    career_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    person_id BIGINT NOT NULL,
    employer_name VARCHAR(240) NOT NULL,
    role_title VARCHAR(240),
    start_date DATE NOT NULL,
    end_date DATE,
    encrypted_detail BYTEA,
    key_reference VARCHAR(255),
    evidence_object_public_id UUID,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT NOT NULL,
    CONSTRAINT uk_ppl_careers_public UNIQUE (public_id),
    CONSTRAINT uk_ppl_careers_id UNIQUE (tenant_id, career_id),
    CONSTRAINT fk_ppl_careers_person FOREIGN KEY (tenant_id, person_id)
        REFERENCES ppl_persons(tenant_id, person_id),
    CONSTRAINT ck_ppl_careers_period CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE ppl_qualifications (
    qualification_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    person_id BIGINT NOT NULL,
    qualification_type VARCHAR(50) NOT NULL,
    qualification_code VARCHAR(100),
    name VARCHAR(240) NOT NULL,
    issuing_organization VARCHAR(240),
    issued_date DATE,
    expiry_date DATE,
    verification_state VARCHAR(24) NOT NULL DEFAULT 'UNVERIFIED',
    evidence_object_public_id UUID,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT NOT NULL,
    CONSTRAINT uk_ppl_qualifications_public UNIQUE (public_id),
    CONSTRAINT uk_ppl_qualifications_id UNIQUE (tenant_id, qualification_id),
    CONSTRAINT fk_ppl_qualifications_person FOREIGN KEY (tenant_id, person_id)
        REFERENCES ppl_persons(tenant_id, person_id),
    CONSTRAINT ck_ppl_qualifications_period CHECK
        (expiry_date IS NULL OR issued_date IS NULL OR expiry_date >= issued_date),
    CONSTRAINT ck_ppl_qualifications_verify CHECK
        (verification_state IN ('UNVERIFIED','PENDING','VERIFIED','REJECTED','EXPIRED'))
);

CREATE TABLE ppl_service_records (
    service_record_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    person_id BIGINT NOT NULL,
    country_pack_key VARCHAR(80) NOT NULL,
    record_type VARCHAR(60) NOT NULL,
    encrypted_payload BYTEA NOT NULL,
    payload_schema_version INTEGER NOT NULL,
    key_reference VARCHAR(255) NOT NULL,
    valid_from DATE,
    valid_to DATE,
    retention_until DATE,
    legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT NOT NULL,
    CONSTRAINT uk_ppl_service_records_public UNIQUE (public_id),
    CONSTRAINT uk_ppl_service_records_id UNIQUE (tenant_id, service_record_id),
    CONSTRAINT fk_ppl_service_records_person FOREIGN KEY (tenant_id, person_id)
        REFERENCES ppl_persons(tenant_id, person_id),
    CONSTRAINT ck_ppl_service_records_schema CHECK (payload_schema_version > 0),
    CONSTRAINT ck_ppl_service_records_period CHECK
        (valid_to IS NULL OR valid_from IS NULL OR valid_to > valid_from)
);

CREATE TABLE ppl_accessibility_records (
    accessibility_record_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    person_id BIGINT NOT NULL,
    purpose_code VARCHAR(80) NOT NULL,
    encrypted_payload BYTEA NOT NULL,
    payload_schema_version INTEGER NOT NULL,
    key_reference VARCHAR(255) NOT NULL,
    consent_reference UUID,
    valid_from DATE NOT NULL,
    valid_to DATE,
    retention_until DATE,
    legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT NOT NULL,
    CONSTRAINT uk_ppl_accessibility_records_public UNIQUE (public_id),
    CONSTRAINT uk_ppl_accessibility_records_id UNIQUE (tenant_id, accessibility_record_id),
    CONSTRAINT fk_ppl_accessibility_records_person FOREIGN KEY (tenant_id, person_id)
        REFERENCES ppl_persons(tenant_id, person_id),
    CONSTRAINT ck_ppl_accessibility_records_schema CHECK (payload_schema_version > 0),
    CONSTRAINT ck_ppl_accessibility_records_period CHECK (valid_to IS NULL OR valid_to > valid_from)
);

-- ---------------------------------------------------------------------------
-- 4. Employee service, documents and separation
-- ---------------------------------------------------------------------------

CREATE TABLE ppl_employee_change_requests (
    employee_change_request_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    requester_person_id BIGINT NOT NULL,
    target_person_id BIGINT NOT NULL,
    target_aggregate_type VARCHAR(50) NOT NULL,
    target_aggregate_public_id UUID NOT NULL,
    change_type VARCHAR(80) NOT NULL,
    effective_date DATE NOT NULL,
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    expected_target_version BIGINT NOT NULL,
    patch_schema_key VARCHAR(120) NOT NULL,
    patch_schema_version INTEGER NOT NULL,
    encrypted_patch BYTEA NOT NULL,
    patch_hash CHAR(64) NOT NULL,
    key_reference VARCHAR(255) NOT NULL,
    field_groups JSONB NOT NULL,
    approval_case_public_id UUID,
    applied_target_version BIGINT,
    supersedes_request_id BIGINT,
    correlation_id UUID NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    submitted_at TIMESTAMPTZ,
    decided_at TIMESTAMPTZ,
    applied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT NOT NULL,
    CONSTRAINT uk_ppl_employee_change_requests_public UNIQUE (public_id),
    CONSTRAINT uk_ppl_employee_change_requests_id UNIQUE (tenant_id, employee_change_request_id),
    CONSTRAINT uk_ppl_employee_change_requests_correlation UNIQUE (tenant_id, correlation_id),
    CONSTRAINT fk_ppl_employee_change_requests_requester FOREIGN KEY (tenant_id, requester_person_id)
        REFERENCES ppl_persons(tenant_id, person_id),
    CONSTRAINT fk_ppl_employee_change_requests_target FOREIGN KEY (tenant_id, target_person_id)
        REFERENCES ppl_persons(tenant_id, person_id),
    CONSTRAINT fk_ppl_employee_change_requests_supersedes FOREIGN KEY (tenant_id, supersedes_request_id)
        REFERENCES ppl_employee_change_requests(tenant_id, employee_change_request_id),
    CONSTRAINT ck_ppl_employee_change_requests_state CHECK
        (lifecycle_state IN ('DRAFT','SUBMITTED','IN_REVIEW','APPROVED','REJECTED','CANCELLED','APPLYING','APPLIED','APPLY_FAILED')),
    CONSTRAINT ck_ppl_employee_change_requests_schema CHECK (patch_schema_version > 0),
    CONSTRAINT ck_ppl_employee_change_requests_fields CHECK (jsonb_typeof(field_groups) = 'array')
);

CREATE TABLE ppl_employee_change_evidence (
    employee_change_evidence_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    employee_change_request_id BIGINT NOT NULL,
    object_public_id UUID NOT NULL,
    object_version INTEGER NOT NULL,
    content_sha256 CHAR(64) NOT NULL,
    classification VARCHAR(30) NOT NULL,
    purpose_code VARCHAR(80) NOT NULL,
    retention_until DATE,
    legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT NOT NULL,
    CONSTRAINT uk_ppl_employee_change_evidence_public UNIQUE (public_id),
    CONSTRAINT uk_ppl_employee_change_evidence_object UNIQUE
        (tenant_id, employee_change_request_id, object_public_id, object_version),
    CONSTRAINT fk_ppl_employee_change_evidence_request FOREIGN KEY
        (tenant_id, employee_change_request_id)
        REFERENCES ppl_employee_change_requests(tenant_id, employee_change_request_id),
    CONSTRAINT ck_ppl_employee_change_evidence_class CHECK
        (classification IN ('INTERNAL','CONFIDENTIAL','RESTRICTED','HIGHLY_RESTRICTED'))
);

CREATE TABLE ppl_certificate_requests (
    certificate_request_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    requester_person_id BIGINT NOT NULL,
    subject_person_id BIGINT NOT NULL,
    certificate_type VARCHAR(80) NOT NULL,
    locale VARCHAR(35) NOT NULL,
    purpose_code VARCHAR(80) NOT NULL,
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'REQUESTED',
    template_public_id UUID NOT NULL,
    template_version INTEGER NOT NULL,
    correlation_id UUID NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    created_by BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT NOT NULL,
    CONSTRAINT uk_ppl_certificate_requests_public UNIQUE (public_id),
    CONSTRAINT uk_ppl_certificate_requests_id UNIQUE (tenant_id, certificate_request_id),
    CONSTRAINT uk_ppl_certificate_requests_correlation UNIQUE (tenant_id, correlation_id),
    CONSTRAINT fk_ppl_certificate_requests_requester FOREIGN KEY (tenant_id, requester_person_id)
        REFERENCES ppl_persons(tenant_id, person_id),
    CONSTRAINT fk_ppl_certificate_requests_subject FOREIGN KEY (tenant_id, subject_person_id)
        REFERENCES ppl_persons(tenant_id, person_id),
    CONSTRAINT ck_ppl_certificate_requests_state CHECK
        (lifecycle_state IN ('REQUESTED','VALIDATING','ISSUED','FAILED','CANCELLED'))
);

CREATE TABLE ppl_issued_certificates (
    issued_certificate_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    certificate_request_id BIGINT NOT NULL,
    object_public_id UUID NOT NULL,
    object_version INTEGER NOT NULL,
    content_sha256 CHAR(64) NOT NULL,
    verification_token_hash CHAR(64) NOT NULL,
    lifecycle_state VARCHAR(20) NOT NULL DEFAULT 'ISSUED',
    issued_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revoke_reason_code VARCHAR(80),
    retention_until DATE,
    legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
    created_by BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT NOT NULL,
    CONSTRAINT uk_ppl_issued_certificates_public UNIQUE (public_id),
    CONSTRAINT uk_ppl_issued_certificates_request UNIQUE (tenant_id, certificate_request_id),
    CONSTRAINT uk_ppl_issued_certificates_verify UNIQUE (tenant_id, verification_token_hash),
    CONSTRAINT fk_ppl_issued_certificates_request FOREIGN KEY (tenant_id, certificate_request_id)
        REFERENCES ppl_certificate_requests(tenant_id, certificate_request_id),
    CONSTRAINT ck_ppl_issued_certificates_state CHECK
        (lifecycle_state IN ('ISSUED','REVOKED','EXPIRED')),
    CONSTRAINT ck_ppl_issued_certificates_expiry CHECK (expires_at IS NULL OR expires_at > issued_at),
    CONSTRAINT ck_ppl_issued_certificates_revoke CHECK
        ((lifecycle_state <> 'REVOKED') OR (revoked_at IS NOT NULL AND revoke_reason_code IS NOT NULL))
);

CREATE TABLE ppl_separation_cases (
    separation_case_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    worker_id BIGINT NOT NULL,
    work_relationship_id BIGINT NOT NULL,
    separation_type VARCHAR(40) NOT NULL,
    reason_code VARCHAR(80) NOT NULL,
    effective_date DATE NOT NULL,
    last_working_date DATE,
    lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    approval_case_public_id UUID,
    reverses_case_id BIGINT,
    correlation_id UUID NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT NOT NULL,
    CONSTRAINT uk_ppl_separation_cases_public UNIQUE (public_id),
    CONSTRAINT uk_ppl_separation_cases_id UNIQUE (tenant_id, separation_case_id),
    CONSTRAINT uk_ppl_separation_cases_correlation UNIQUE (tenant_id, correlation_id),
    CONSTRAINT fk_ppl_separation_cases_worker FOREIGN KEY (tenant_id, worker_id)
        REFERENCES ppl_workers(tenant_id, worker_id),
    CONSTRAINT fk_ppl_separation_cases_relationship FOREIGN KEY (tenant_id, work_relationship_id)
        REFERENCES ppl_work_relationships(tenant_id, work_relationship_id),
    CONSTRAINT fk_ppl_separation_cases_reverses FOREIGN KEY (tenant_id, reverses_case_id)
        REFERENCES ppl_separation_cases(tenant_id, separation_case_id),
    CONSTRAINT ck_ppl_separation_cases_state CHECK
        (lifecycle_state IN ('DRAFT','PLANNED','PENDING_APPROVAL','APPROVED','IN_PROGRESS','COMPLETED','CANCELLED')),
    CONSTRAINT ck_ppl_separation_cases_dates CHECK
        (last_working_date IS NULL OR last_working_date <= effective_date)
);

CREATE TABLE ppl_separation_tasks (
    separation_task_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    separation_case_id BIGINT NOT NULL,
    task_type VARCHAR(80) NOT NULL,
    owner_type VARCHAR(30) NOT NULL,
    owner_public_id UUID,
    lifecycle_state VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    due_at TIMESTAMPTZ,
    external_receipt_public_id UUID,
    completed_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT NOT NULL,
    CONSTRAINT uk_ppl_separation_tasks_public UNIQUE (public_id),
    CONSTRAINT uk_ppl_separation_tasks_type UNIQUE (tenant_id, separation_case_id, task_type),
    CONSTRAINT fk_ppl_separation_tasks_case FOREIGN KEY (tenant_id, separation_case_id)
        REFERENCES ppl_separation_cases(tenant_id, separation_case_id),
    CONSTRAINT ck_ppl_separation_tasks_state CHECK
        (lifecycle_state IN ('PENDING','IN_PROGRESS','COMPLETED','WAIVED','FAILED'))
);

-- ---------------------------------------------------------------------------
-- 5. Command/inbox reliability and immutable-state guard
-- ---------------------------------------------------------------------------

CREATE TABLE ppl_command_receipts (
    command_receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    command_type VARCHAR(100) NOT NULL,
    idempotency_key VARCHAR(160) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    actor_public_id UUID NOT NULL,
    originating_action VARCHAR(160) NOT NULL,
    subject_principal_public_id UUID NOT NULL,
    population_scope_digest CHAR(64) NOT NULL,
    field_policy_revision BIGINT NOT NULL,
    purpose_code VARCHAR(80) NOT NULL,
    authorization_revision BIGINT NOT NULL,
    originating_context_sealed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    originating_context_digest CHAR(64) NOT NULL,
    target_type VARCHAR(80) NOT NULL,
    target_public_id UUID,
    expected_version BIGINT,
    lifecycle_state VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
    result_code VARCHAR(80),
    result_reference JSONB,
    correlation_id UUID NOT NULL,
    lease_owner VARCHAR(160),
    lease_until TIMESTAMPTZ,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ,
    last_error_code VARCHAR(80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    CONSTRAINT uk_ppl_command_receipts_tenant_id UNIQUE (tenant_id, command_receipt_id),
    CONSTRAINT uk_ppl_command_receipts_key UNIQUE
        (tenant_id, subject_principal_public_id, originating_action, idempotency_key),
    CONSTRAINT uk_ppl_command_receipts_correlation UNIQUE (tenant_id, correlation_id),
    CONSTRAINT ck_ppl_command_receipts_state CHECK
        (lifecycle_state IN ('RECEIVED','VALIDATING','RUNNING','SUCCEEDED','REJECTED','FAILED_RETRYABLE','DEAD','CANCELLED')),
    CONSTRAINT ck_ppl_command_receipts_attempt CHECK (attempt_count >= 0),
    CONSTRAINT ck_ppl_command_receipts_auth_revisions CHECK
        (field_policy_revision > 0 AND authorization_revision > 0),
    CONSTRAINT ck_ppl_command_receipts_population_digest CHECK
        (population_scope_digest ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_ppl_command_receipts_context_digest CHECK
        (originating_context_digest ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_ppl_command_receipts_result CHECK
        (result_reference IS NULL OR jsonb_typeof(result_reference) = 'object')
);

CREATE OR REPLACE FUNCTION ppl_guard_command_receipt_originating_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'HRM command receipt cannot be deleted';
    END IF;
    IF ROW(NEW.tenant_id, NEW.command_type, NEW.idempotency_key,
           NEW.request_hash, NEW.actor_public_id,
           NEW.originating_action, NEW.subject_principal_public_id,
           NEW.population_scope_digest, NEW.field_policy_revision,
           NEW.purpose_code, NEW.authorization_revision,
           NEW.originating_context_sealed_at, NEW.originating_context_digest,
           NEW.correlation_id)
       IS DISTINCT FROM
       ROW(OLD.tenant_id, OLD.command_type, OLD.idempotency_key,
           OLD.request_hash, OLD.actor_public_id,
           OLD.originating_action, OLD.subject_principal_public_id,
           OLD.population_scope_digest, OLD.field_policy_revision,
           OLD.purpose_code, OLD.authorization_revision,
           OLD.originating_context_sealed_at, OLD.originating_context_digest,
           OLD.correlation_id) THEN
        RAISE EXCEPTION 'HRM command receipt originating authorization and caller-bound idempotency context is immutable';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ppl_command_receipt_originating_auth
    BEFORE UPDATE OR DELETE ON ppl_command_receipts
    FOR EACH ROW EXECUTE FUNCTION ppl_guard_command_receipt_originating_auth();

CREATE TABLE ppl_domain_inbox_receipts (
    inbox_receipt_id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    consumer_key VARCHAR(100) NOT NULL,
    event_id UUID NOT NULL,
    event_type VARCHAR(120) NOT NULL,
    schema_version INTEGER NOT NULL,
    payload_hash CHAR(64) NOT NULL,
    lifecycle_state VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
    correlation_id UUID,
    received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    applied_at TIMESTAMPTZ,
    failure_code VARCHAR(80),
    CONSTRAINT uk_ppl_domain_inbox_receipts_event UNIQUE (tenant_id, consumer_key, event_id),
    CONSTRAINT ck_ppl_domain_inbox_receipts_schema CHECK (schema_version > 0),
    CONSTRAINT ck_ppl_domain_inbox_receipts_state CHECK
        (lifecycle_state IN ('RECEIVED','APPLIED','REJECTED','QUARANTINED'))
);

CREATE OR REPLACE FUNCTION ppl_guard_terminal_row()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    status_column TEXT := TG_ARGV[0];
    terminal_states TEXT[] := string_to_array(TG_ARGV[1], ',');
    old_status TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'HRM terminal/history rows are forward-corrected, not deleted';
    END IF;
    old_status := to_jsonb(OLD) ->> status_column;
    IF old_status = ANY(terminal_states) THEN
        RAISE EXCEPTION 'HRM terminal row is immutable; create a superseding or reversal record';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ppl_assignment_events_terminal
    BEFORE UPDATE OR DELETE ON ppl_assignment_events
    FOR EACH ROW EXECUTE FUNCTION ppl_guard_terminal_row('lifecycle_state','PUBLISHED,REJECTED,CANCELLED');

CREATE TRIGGER trg_ppl_change_requests_terminal
    BEFORE UPDATE OR DELETE ON ppl_employee_change_requests
    FOR EACH ROW EXECUTE FUNCTION ppl_guard_terminal_row('lifecycle_state','APPLIED,REJECTED,CANCELLED');

CREATE TRIGGER trg_ppl_separation_cases_terminal
    BEFORE UPDATE OR DELETE ON ppl_separation_cases
    FOR EACH ROW EXECUTE FUNCTION ppl_guard_terminal_row('lifecycle_state','COMPLETED,CANCELLED');

-- ---------------------------------------------------------------------------
-- 6. Query, operational and retention indexes
-- ---------------------------------------------------------------------------

CREATE INDEX idx_ppl_business_units_as_of
    ON ppl_business_units(tenant_id, business_unit_key, valid_from DESC, valid_to);
CREATE INDEX idx_ppl_establishments_as_of
    ON ppl_establishments(tenant_id, legal_employer_id, valid_from DESC, valid_to);
CREATE INDEX idx_ppl_employment_terms_as_of
    ON ppl_employment_terms(tenant_id, work_relationship_id, assignment_id, valid_from DESC, valid_to);
CREATE INDEX idx_ppl_assignment_events_work_queue
    ON ppl_assignment_events(tenant_id, lifecycle_state, effective_date, created_at)
    WHERE lifecycle_state IN ('DRAFT','VALIDATED','PENDING_APPROVAL','APPROVED');
CREATE INDEX idx_ppl_assignment_events_timeline
    ON ppl_assignment_events(tenant_id, assignment_id, effective_date DESC, published_at DESC);
CREATE INDEX idx_ppl_compensation_basis_as_of
    ON ppl_compensation_basis(tenant_id, assignment_id, basis_type, valid_from DESC, valid_to);
CREATE INDEX idx_ppl_contracts_work_queue
    ON ppl_employment_contracts(tenant_id, lifecycle_state, valid_from, created_at)
    WHERE lifecycle_state IN ('DRAFT','ISSUED','SIGNED');
CREATE INDEX idx_ppl_worker_restricted_tokens_scope
    ON ppl_worker_restricted_tokens
       (tenant_id, worker_id, token_kind, purpose_code, valid_from DESC);
CREATE INDEX idx_ppl_change_requests_work_queue
    ON ppl_employee_change_requests(tenant_id, lifecycle_state, effective_date, created_at)
    WHERE lifecycle_state IN ('SUBMITTED','IN_REVIEW','APPROVED','APPLYING','APPLY_FAILED');
CREATE INDEX idx_ppl_change_requests_target
    ON ppl_employee_change_requests(tenant_id, target_person_id, effective_date DESC, created_at DESC);
CREATE INDEX idx_ppl_certificate_requests_work_queue
    ON ppl_certificate_requests(tenant_id, lifecycle_state, requested_at)
    WHERE lifecycle_state IN ('REQUESTED','VALIDATING');
CREATE INDEX idx_ppl_separation_cases_work_queue
    ON ppl_separation_cases(tenant_id, lifecycle_state, effective_date, created_at)
    WHERE lifecycle_state NOT IN ('COMPLETED','CANCELLED');
CREATE INDEX idx_ppl_command_receipts_work
    ON ppl_command_receipts(lifecycle_state, next_attempt_at, lease_until, created_at)
    WHERE lifecycle_state IN ('RECEIVED','FAILED_RETRYABLE','RUNNING');
CREATE INDEX idx_ppl_command_receipts_target
    ON ppl_command_receipts(tenant_id, target_type, target_public_id, created_at DESC);
CREATE INDEX idx_ppl_domain_inbox_receipts_quarantine
    ON ppl_domain_inbox_receipts(tenant_id, lifecycle_state, received_at)
    WHERE lifecycle_state IN ('REJECTED','QUARANTINED');

-- Partition candidates after measured volume thresholds, not before:
--   ppl_assignment_events          RANGE (effective_date), tenant subpartition if justified
--   ppl_command_receipts           RANGE (created_at)
--   ppl_domain_inbox_receipts      RANGE (received_at)
-- Existing sys_people_audit_events and outbox follow their platform retention plan.
-- Profile and contract tables are not time-partitioned until volume and deletion-SLA
-- evidence show a benefit; tenant/purpose/retention indexes precede partitioning.

-- RLS is defense in depth, not the only PEP. API and worker runtime roles are NOINHERIT,
-- NOSUPERUSER and NOBYPASSRLS; only the separately audited migration/maintenance role
-- may own tables. Transaction scope performs SET LOCAL ROLE, sets dwp.tenant_id, and
-- resets both before a pooled connection is reused.
DO $$
DECLARE target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    -- Existing People SOR and integration/audit tables are in the same runtime and
    -- are read by HRIS-HRM.  They therefore receive the same fail-closed tenant
    -- boundary as the new HRIS tables; application PEP is not a substitute for it.
    'ppl_persons','ppl_person_names','ppl_contacts','ppl_profile_media','ppl_workers',
    'ppl_work_relationships','ppl_assignments','ppl_legal_employers','ppl_organizations',
    'ppl_organization_relationships','ppl_job_profiles','ppl_job_grades','ppl_positions','ppl_locations',
    'int_source_systems','int_external_mappings','int_sync_runs','int_sync_errors',
    'sys_people_audit_events','sys_people_outbox_events',
    'ppl_legal_entity_registrations','ppl_business_units','ppl_establishments','ppl_employment_terms',
    'ppl_assignment_events','ppl_sensitive_change_payloads','ppl_assignment_event_items','ppl_compensation_basis',
    'ppl_employment_contracts','ppl_worker_restricted_tokens','ppl_dependents','ppl_educations','ppl_careers',
    'ppl_qualifications','ppl_service_records','ppl_accessibility_records','ppl_employee_change_requests',
    'ppl_employee_change_evidence','ppl_certificate_requests','ppl_issued_certificates','ppl_separation_cases',
    'ppl_separation_tasks','ppl_command_receipts','ppl_domain_inbox_receipts'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', target_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = NULLIF(current_setting(''dwp.tenant_id'', true), '''')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting(''dwp.tenant_id'', true), '''')::BIGINT)',
      target_table || '_tenant_policy', target_table
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 7. Migration verification queries (non-mutating design checks)
-- ---------------------------------------------------------------------------
-- Required migration evidence per tenant:
--   person/worker/relationship/assignment counts and distinct public IDs;
--   orphan count by composite FK = 0;
--   invalid or overlapping primary relationship/assignment periods = 0;
--   source accepted + quarantined = source total;
--   command/outbox aggregate version counts and digests reconcile;
--   no clear restricted identifier/account value in table, index or logs;
--   forward-correction rehearsal reconstructs before/current/future as-of views.
