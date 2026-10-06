-- HRIS-PAY PostgreSQL physical DDL blueprint.
-- CODE_READY_PROPOSAL only: Integration Control assigns the Flyway version.
-- No statutory rate/formula, bank/ERP endpoint, credential, customer table or SKKF expression appears here.
-- Cross-context references are tenant-scoped public UUIDs and intentionally have no FK.
-- DECIMAL-SSOT: coding-readiness/decimal-value-types.v1.json. Every decimal bind is
-- precision/scale validated and explicitly quantized in the application domain;
-- binary floating point and PostgreSQL implicit rounding are forbidden.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE pay_worker_projections (
    projection_id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    worker_public_id UUID NOT NULL,
    assignment_public_id UUID NOT NULL,
    legal_entity_public_id UUID NOT NULL,
    compensation_basis_public_id UUID,
    bank_token_public_id UUID,
    bank_token_version BIGINT,
    bank_verification_status VARCHAR(20),
    effective_from DATE NOT NULL,
    effective_to DATE,
    source_revision BIGINT NOT NULL,
    field_set_version VARCHAR(30) NOT NULL,
    payload_digest CHAR(64) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uk_pay_worker_projection_revision UNIQUE (tenant_id, assignment_public_id, source_revision),
    CONSTRAINT ck_pay_worker_projection_period CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT ck_pay_worker_projection_revision CHECK (source_revision > 0),
    CONSTRAINT ck_pay_bank_verification CHECK (bank_verification_status IS NULL OR bank_verification_status IN ('UNVERIFIED','PENDING','VERIFIED','REVOKED'))
);
CREATE INDEX ix_pay_worker_projection_current ON pay_worker_projections (tenant_id, worker_public_id, effective_from DESC, effective_to);

CREATE TABLE pay_time_handoff_snapshots (
    time_handoff_snapshot_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    handoff_public_id UUID NOT NULL,
    closed_time_result_public_id UUID NOT NULL,
    close_period_public_id UUID NOT NULL,
    close_revision BIGINT NOT NULL,
    payroll_entity_public_id UUID NOT NULL,
    pay_period_public_id UUID NOT NULL,
    schema_version VARCHAR(30) NOT NULL,
    ledger_revision_from BIGINT NOT NULL,
    ledger_revision_to BIGINT NOT NULL,
    source_digest CHAR(64) NOT NULL,
    rule_digest CHAR(64) NOT NULL,
    payload_digest CHAR(64) NOT NULL,
    worker_count INTEGER NOT NULL,
    line_count INTEGER NOT NULL,
    supersedes_snapshot_public_id UUID,
    received_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uk_pay_time_handoff_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_pay_time_handoff_internal UNIQUE (tenant_id, time_handoff_snapshot_id),
    CONSTRAINT uk_pay_time_handoff_source UNIQUE (tenant_id, handoff_public_id),
    CONSTRAINT uk_pay_time_handoff_result UNIQUE (tenant_id, closed_time_result_public_id),
    CONSTRAINT uk_pay_time_handoff_revision UNIQUE (tenant_id, close_period_public_id, close_revision, payroll_entity_public_id, pay_period_public_id),
    CONSTRAINT fk_pay_time_handoff_supersedes FOREIGN KEY (tenant_id, supersedes_snapshot_public_id) REFERENCES pay_time_handoff_snapshots (tenant_id, public_id),
    CONSTRAINT ck_pay_time_handoff_revision CHECK (close_revision > 0 AND ledger_revision_from > 0 AND ledger_revision_to >= ledger_revision_from),
    CONSTRAINT ck_pay_time_handoff_counts CHECK (worker_count >= 0 AND line_count >= 0)
);

CREATE TABLE pay_time_handoff_lines (
    time_handoff_line_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    time_handoff_snapshot_id BIGINT NOT NULL,
    line_no INTEGER NOT NULL,
    worker_public_id UUID NOT NULL,
    assignment_public_id UUID NOT NULL,
    pay_code VARCHAR(80) NOT NULL,
    unit VARCHAR(12) NOT NULL,
    quantity NUMERIC(19,6) NOT NULL,
    currency_code CHAR(3) NOT NULL DEFAULT 'XXX',
    source_entry_count INTEGER NOT NULL,
    source_entry_digest CHAR(64) NOT NULL,
    CONSTRAINT uk_pay_time_handoff_line_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_pay_time_handoff_line_no UNIQUE (tenant_id, time_handoff_snapshot_id, line_no),
    CONSTRAINT fk_pay_time_handoff_line_header FOREIGN KEY (tenant_id, time_handoff_snapshot_id) REFERENCES pay_time_handoff_snapshots (tenant_id, time_handoff_snapshot_id),
    CONSTRAINT ck_pay_time_handoff_line_no CHECK (line_no > 0),
    CONSTRAINT ck_pay_time_handoff_line_unit CHECK (unit IN ('MINUTE','HOUR','DAY','COUNT','AMOUNT')),
    CONSTRAINT ck_pay_time_handoff_line_currency CHECK (
        (unit = 'AMOUNT' AND currency_code <> 'XXX' AND currency_code ~ '^[A-Z]{3}$')
        OR (unit <> 'AMOUNT' AND currency_code = 'XXX')
    ),
    CONSTRAINT ck_pay_time_handoff_line_sources CHECK (source_entry_count > 0)
);

CREATE TABLE pay_time_handoff_ingest_receipts (
    time_handoff_ingest_receipt_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    time_handoff_snapshot_id BIGINT NOT NULL,
    source_event_id UUID NOT NULL,
    idempotency_key VARCHAR(160) NOT NULL,
    request_digest CHAR(64) NOT NULL,
    response_digest CHAR(64),
    status VARCHAR(20) NOT NULL,
    reason_code VARCHAR(80),
    row_version BIGINT NOT NULL DEFAULT 0,
    received_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    CONSTRAINT uk_pay_time_handoff_receipt_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_pay_time_handoff_receipt_event UNIQUE (tenant_id, source_event_id),
    CONSTRAINT uk_pay_time_handoff_receipt_idem UNIQUE (tenant_id, idempotency_key),
    CONSTRAINT fk_pay_time_handoff_receipt_header FOREIGN KEY (tenant_id, time_handoff_snapshot_id) REFERENCES pay_time_handoff_snapshots (tenant_id, time_handoff_snapshot_id),
    CONSTRAINT ck_pay_time_handoff_receipt_status CHECK (status IN ('RECEIVED','VALIDATING','ACCEPTED','REJECTED','QUARANTINED','RESULT_UNKNOWN'))
);

CREATE TABLE pay_legal_payroll_entities (
    legal_payroll_entity_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    entity_key VARCHAR(100) NOT NULL,
    legal_entity_public_id UUID NOT NULL,
    jurisdiction_code VARCHAR(20) NOT NULL,
    base_currency CHAR(3) NOT NULL,
    time_zone VARCHAR(80) NOT NULL,
    status VARCHAR(20) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    CONSTRAINT uk_pay_legal_entity_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_pay_legal_entity_internal UNIQUE (tenant_id, legal_payroll_entity_id),
    CONSTRAINT uk_pay_legal_entity_key UNIQUE (tenant_id, entity_key, valid_from),
    CONSTRAINT ck_pay_legal_entity_currency CHECK (base_currency ~ '^[A-Z]{3}$'),
    CONSTRAINT ck_pay_legal_entity_status CHECK (status IN ('DRAFT','ACTIVE','SUSPENDED','RETIRED')),
    CONSTRAINT ck_pay_legal_entity_period CHECK (valid_to IS NULL OR valid_to > valid_from)
);
ALTER TABLE pay_legal_payroll_entities ADD CONSTRAINT ex_pay_legal_entity_overlap
    EXCLUDE USING gist (tenant_id WITH =, entity_key WITH =, daterange(valid_from, COALESCE(valid_to, 'infinity'::date), '[)') WITH &&)
    WHERE (status = 'ACTIVE');

CREATE TABLE pay_pay_groups (
    pay_group_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    legal_payroll_entity_id BIGINT NOT NULL,
    group_key VARCHAR(100) NOT NULL,
    frequency_code VARCHAR(30) NOT NULL,
    currency_code CHAR(3) NOT NULL,
    payment_method VARCHAR(30) NOT NULL,
    eligibility_policy_ref UUID NOT NULL,
    status VARCHAR(20) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    CONSTRAINT uk_pay_group_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_pay_group_internal UNIQUE (tenant_id, pay_group_id),
    CONSTRAINT uk_pay_group_key UNIQUE (tenant_id, group_key, valid_from),
    CONSTRAINT fk_pay_group_entity FOREIGN KEY (tenant_id, legal_payroll_entity_id) REFERENCES pay_legal_payroll_entities (tenant_id, legal_payroll_entity_id),
    CONSTRAINT ck_pay_group_currency CHECK (currency_code ~ '^[A-Z]{3}$'),
    CONSTRAINT ck_pay_group_status CHECK (status IN ('DRAFT','ACTIVE','SUSPENDED','RETIRED')),
    CONSTRAINT ck_pay_group_period CHECK (valid_to IS NULL OR valid_to > valid_from)
);
ALTER TABLE pay_pay_groups ADD CONSTRAINT ex_pay_group_overlap
    EXCLUDE USING gist (tenant_id WITH =, group_key WITH =, daterange(valid_from, COALESCE(valid_to, 'infinity'::date), '[)') WITH &&)
    WHERE (status = 'ACTIVE');

CREATE TABLE pay_pay_periods (
    pay_period_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    pay_group_id BIGINT NOT NULL,
    period_key VARCHAR(80) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    input_cutoff_at TIMESTAMPTZ NOT NULL,
    pay_date DATE NOT NULL,
    status VARCHAR(24) NOT NULL,
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_pay_period_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_pay_period_internal UNIQUE (tenant_id, pay_period_id),
    CONSTRAINT uk_pay_period_key UNIQUE (tenant_id, pay_group_id, period_key),
    CONSTRAINT fk_pay_period_group FOREIGN KEY (tenant_id, pay_group_id) REFERENCES pay_pay_groups (tenant_id, pay_group_id),
    CONSTRAINT ck_pay_period_dates CHECK (period_end >= period_start AND pay_date >= period_start),
    CONSTRAINT ck_pay_period_status CHECK (status IN ('OPEN','INPUT_LOCKED','CALCULATING','VALIDATED','APPROVED','FINALIZED','CLOSED','REOPENED'))
);

CREATE TABLE pay_element_versions (
    element_version_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    element_key VARCHAR(100) NOT NULL,
    version_no INTEGER NOT NULL,
    name_key VARCHAR(160) NOT NULL,
    element_type VARCHAR(30) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    currency_code CHAR(3),
    processing_priority INTEGER NOT NULL,
    eligibility_policy_ref UUID,
    formula_public_id UUID,
    tax_classification VARCHAR(80),
    insurance_classification VARCHAR(80),
    accounting_classification VARCHAR(80),
    status VARCHAR(20) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    validation_digest CHAR(64),
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    CONSTRAINT uk_pay_element_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_pay_element_version UNIQUE (tenant_id, element_key, version_no),
    CONSTRAINT ck_pay_element_type CHECK (element_type IN ('EARNING','DEDUCTION','EMPLOYER_COST','INFORMATION','BALANCE')),
    CONSTRAINT ck_pay_element_unit CHECK (unit IN ('MONEY','RATE','QUANTITY','BOOLEAN','CODE')),
    CONSTRAINT ck_pay_element_priority CHECK (processing_priority BETWEEN 0 AND 100000),
    CONSTRAINT ck_pay_element_status CHECK (status IN ('DRAFT','VALIDATED','APPROVED','PUBLISHED','RETIRED')),
    CONSTRAINT ck_pay_element_period CHECK (valid_to IS NULL OR valid_to > valid_from),
    CONSTRAINT ck_pay_element_currency CHECK (
        (unit = 'MONEY' AND currency_code ~ '^[A-Z]{3}$')
        OR (unit <> 'MONEY' AND currency_code IS NULL)
    )
);
ALTER TABLE pay_element_versions ADD CONSTRAINT ex_pay_element_overlap
    EXCLUDE USING gist (tenant_id WITH =, element_key WITH =, daterange(valid_from, COALESCE(valid_to, 'infinity'::date), '[)') WITH &&)
    WHERE (status = 'PUBLISHED');

CREATE TABLE pay_formula_versions (
    formula_version_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    formula_key VARCHAR(100) NOT NULL,
    version_no INTEGER NOT NULL,
    language_version VARCHAR(30) NOT NULL,
    input_schema JSONB NOT NULL,
    output_type VARCHAR(40) NOT NULL,
    output_unit VARCHAR(20) NOT NULL,
    ast_payload JSONB NOT NULL,
    function_set_version VARCHAR(30) NOT NULL,
    rounding_policy_public_id UUID,
    compiled_digest CHAR(64),
    golden_digest CHAR(64),
    max_nodes INTEGER NOT NULL,
    max_depth INTEGER NOT NULL,
    timeout_millis INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    CONSTRAINT uk_pay_formula_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_pay_formula_internal UNIQUE (tenant_id, formula_version_id),
    CONSTRAINT uk_pay_formula_version UNIQUE (tenant_id, formula_key, version_no),
    CONSTRAINT ck_pay_formula_schema CHECK (jsonb_typeof(input_schema) = 'object'),
    CONSTRAINT ck_pay_formula_ast CHECK (jsonb_typeof(ast_payload) = 'object'),
    CONSTRAINT ck_pay_formula_limits CHECK (max_nodes BETWEEN 1 AND 10000 AND max_depth BETWEEN 1 AND 100 AND timeout_millis BETWEEN 1 AND 30000),
    CONSTRAINT ck_pay_formula_status CHECK (status IN ('DRAFT','VALIDATED','APPROVED','PUBLISHED','RETIRED')),
    CONSTRAINT ck_pay_formula_period CHECK (valid_to IS NULL OR valid_to > valid_from)
);
ALTER TABLE pay_formula_versions ADD CONSTRAINT ex_pay_formula_overlap
    EXCLUDE USING gist (tenant_id WITH =, formula_key WITH =, daterange(valid_from, COALESCE(valid_to, 'infinity'::date), '[)') WITH &&)
    WHERE (status = 'PUBLISHED');

CREATE TABLE pay_formula_dependencies (
    formula_dependency_id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    formula_version_id BIGINT NOT NULL,
    dependency_kind VARCHAR(20) NOT NULL,
    dependency_key VARCHAR(100) NOT NULL,
    dependency_version_public_id UUID,
    CONSTRAINT uk_pay_formula_dependency UNIQUE (tenant_id, formula_version_id, dependency_kind, dependency_key),
    CONSTRAINT fk_pay_formula_dependency_formula FOREIGN KEY (tenant_id, formula_version_id) REFERENCES pay_formula_versions (tenant_id, formula_version_id),
    CONSTRAINT ck_pay_formula_dependency_kind CHECK (dependency_kind IN ('INPUT','ELEMENT','FORMULA','BALANCE','TABLE'))
);

CREATE TABLE pay_formula_test_cases (
    formula_test_case_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    formula_version_id BIGINT NOT NULL,
    case_key VARCHAR(120) NOT NULL,
    input_payload JSONB NOT NULL,
    expected_payload JSONB NOT NULL,
    expected_error_code VARCHAR(80),
    evidence_ref VARCHAR(300) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    CONSTRAINT uk_pay_formula_test_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_pay_formula_test_key UNIQUE (tenant_id, formula_version_id, case_key),
    CONSTRAINT fk_pay_formula_test_formula FOREIGN KEY (tenant_id, formula_version_id) REFERENCES pay_formula_versions (tenant_id, formula_version_id),
    CONSTRAINT ck_pay_formula_test_input CHECK (jsonb_typeof(input_payload) = 'object'),
    CONSTRAINT ck_pay_formula_test_expected CHECK (jsonb_typeof(expected_payload) = 'object')
);

CREATE TABLE pay_rounding_policy_versions (
    rounding_policy_version_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    policy_key VARCHAR(100) NOT NULL,
    version_no INTEGER NOT NULL,
    stage VARCHAR(30) NOT NULL,
    scale SMALLINT NOT NULL,
    mode VARCHAR(30) NOT NULL,
    currency_code CHAR(3),
    jurisdiction_code VARCHAR(20),
    status VARCHAR(20) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    CONSTRAINT uk_pay_rounding_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_pay_rounding_version UNIQUE (tenant_id, policy_key, version_no),
    CONSTRAINT ck_pay_rounding_scale CHECK (scale BETWEEN 0 AND 8),
    CONSTRAINT ck_pay_rounding_mode CHECK (mode IN ('HALF_UP','HALF_EVEN','DOWN','UP','FLOOR','CEILING')),
    CONSTRAINT ck_pay_rounding_status CHECK (status IN ('DRAFT','VALIDATED','APPROVED','PUBLISHED','RETIRED')),
    CONSTRAINT ck_pay_rounding_period CHECK (valid_to IS NULL OR valid_to > valid_from)
);
ALTER TABLE pay_rounding_policy_versions ADD CONSTRAINT ex_pay_rounding_overlap
    EXCLUDE USING gist (tenant_id WITH =, policy_key WITH =, daterange(valid_from, COALESCE(valid_to, 'infinity'::date), '[)') WITH &&)
    WHERE (status = 'PUBLISHED');

CREATE TABLE pay_worker_element_entries (
    worker_element_entry_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    worker_public_id UUID NOT NULL,
    assignment_public_id UUID NOT NULL,
    element_public_id UUID NOT NULL,
    entry_kind VARCHAR(20) NOT NULL,
    amount NUMERIC(19,6),
    currency_code CHAR(3),
    quantity NUMERIC(19,6),
    rate NUMERIC(19,8),
    code_value VARCHAR(100),
    source_type VARCHAR(30) NOT NULL,
    source_public_id UUID,
    valid_from DATE NOT NULL,
    valid_to DATE,
    status VARCHAR(20) NOT NULL,
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID NOT NULL,
    CONSTRAINT uk_pay_worker_entry_public UNIQUE (tenant_id, public_id),
    CONSTRAINT ck_pay_worker_entry_kind CHECK (entry_kind IN ('FIXED','VARIABLE','OVERRIDE','CORRECTION')),
    CONSTRAINT ck_pay_worker_entry_source CHECK (source_type IN ('MANUAL','HRM','TIME','IMPORT','MIGRATION','CORRECTION')),
    CONSTRAINT ck_pay_worker_entry_status CHECK (status IN ('DRAFT','ACTIVE','ENDED','VOIDED')),
    CONSTRAINT ck_pay_worker_entry_period CHECK (valid_to IS NULL OR valid_to > valid_from),
    CONSTRAINT ck_pay_worker_entry_value CHECK (num_nonnulls(amount, quantity, rate, code_value) = 1),
    CONSTRAINT ck_pay_worker_entry_currency CHECK (
        (amount IS NOT NULL AND currency_code IS NOT NULL AND currency_code ~ '^[A-Z]{3}$')
        OR (amount IS NULL AND currency_code IS NULL)
    )
);
CREATE INDEX ix_pay_worker_entry_effective ON pay_worker_element_entries (tenant_id, worker_public_id, valid_from DESC, valid_to);

CREATE TABLE pay_worker_tax_profiles (
    worker_tax_profile_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    worker_public_id UUID NOT NULL,
    jurisdiction_code VARCHAR(20) NOT NULL,
    country_pack_version_public_id UUID NOT NULL,
    encrypted_profile_ref UUID NOT NULL,
    profile_digest CHAR(64) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    status VARCHAR(20) NOT NULL,
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    CONSTRAINT uk_pay_tax_profile_public UNIQUE (tenant_id, public_id),
    CONSTRAINT ck_pay_tax_profile_period CHECK (valid_to IS NULL OR valid_to > valid_from),
    CONSTRAINT ck_pay_tax_profile_status CHECK (status IN ('DRAFT','ACTIVE','ENDED','REVOKED'))
);

CREATE TABLE pay_input_snapshots (
    input_snapshot_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    pay_period_public_id UUID NOT NULL,
    target_revision BIGINT NOT NULL,
    people_projection_revision BIGINT NOT NULL,
    time_handoff_public_id UUID,
    time_close_revision BIGINT,
    rule_set_digest CHAR(64) NOT NULL,
    input_digest CHAR(64) NOT NULL,
    worker_count INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    CONSTRAINT uk_pay_input_snapshot_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_pay_input_snapshot_internal UNIQUE (tenant_id, input_snapshot_id),
    CONSTRAINT uk_pay_input_snapshot_digest UNIQUE (tenant_id, pay_period_public_id, input_digest),
    CONSTRAINT fk_pay_input_snapshot_handoff FOREIGN KEY (tenant_id, time_handoff_public_id) REFERENCES pay_time_handoff_snapshots (tenant_id, public_id),
    CONSTRAINT ck_pay_input_snapshot_count CHECK (worker_count >= 0),
    CONSTRAINT ck_pay_input_snapshot_status CHECK (status IN ('BUILDING','FROZEN','INVALIDATED')),
    CONSTRAINT ck_pay_time_snapshot_pair CHECK ((time_handoff_public_id IS NULL) = (time_close_revision IS NULL))
);

CREATE TABLE pay_payroll_runs (
    payroll_run_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    pay_period_id BIGINT NOT NULL,
    run_type VARCHAR(20) NOT NULL,
    input_snapshot_id BIGINT,
    supersedes_run_public_id UUID,
    status VARCHAR(24) NOT NULL,
    target_worker_count INTEGER NOT NULL DEFAULT 0,
    blocking_issue_count INTEGER NOT NULL DEFAULT 0,
    latest_attempt_no INTEGER NOT NULL DEFAULT 0,
    approval_case_public_id UUID,
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID NOT NULL,
    finalized_at TIMESTAMPTZ,
    finalized_by UUID,
    CONSTRAINT uk_pay_run_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_pay_run_internal UNIQUE (tenant_id, payroll_run_id),
    CONSTRAINT fk_pay_run_period FOREIGN KEY (tenant_id, pay_period_id) REFERENCES pay_pay_periods (tenant_id, pay_period_id),
    CONSTRAINT fk_pay_run_snapshot FOREIGN KEY (tenant_id, input_snapshot_id) REFERENCES pay_input_snapshots (tenant_id, input_snapshot_id),
    CONSTRAINT fk_pay_run_supersedes FOREIGN KEY (tenant_id, supersedes_run_public_id) REFERENCES pay_payroll_runs (tenant_id, public_id),
    CONSTRAINT ck_pay_run_type CHECK (run_type IN ('REGULAR','OFF_CYCLE','RETRO','CORRECTION','SIMULATION')),
    CONSTRAINT ck_pay_run_status CHECK (status IN ('PREPARING','READY','CALCULATING','VALIDATED','APPROVED','FINALIZED','PAYMENT_PENDING','POSTING_PENDING','CLOSED','FAILED','CANCELLED','RESULT_UNKNOWN')),
    CONSTRAINT ck_pay_run_counts CHECK (target_worker_count >= 0 AND blocking_issue_count >= 0 AND latest_attempt_no >= 0),
    CONSTRAINT ck_pay_run_finalized CHECK (status NOT IN ('FINALIZED','PAYMENT_PENDING','POSTING_PENDING','CLOSED') OR finalized_at IS NOT NULL)
);
CREATE UNIQUE INDEX uk_pay_one_regular_run ON pay_payroll_runs (tenant_id, pay_period_id) WHERE run_type = 'REGULAR' AND status <> 'CANCELLED';

CREATE TABLE pay_payroll_run_workers (
    payroll_run_worker_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    payroll_run_id BIGINT NOT NULL,
    worker_public_id UUID NOT NULL,
    assignment_public_id UUID NOT NULL,
    status VARCHAR(24) NOT NULL,
    inclusion_reason VARCHAR(80) NOT NULL,
    exclusion_code VARCHAR(80),
    input_digest CHAR(64) NOT NULL,
    row_version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uk_pay_run_worker_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_pay_run_worker UNIQUE (tenant_id, payroll_run_id, worker_public_id),
    CONSTRAINT fk_pay_run_worker_run FOREIGN KEY (tenant_id, payroll_run_id) REFERENCES pay_payroll_runs (tenant_id, payroll_run_id),
    CONSTRAINT ck_pay_run_worker_status CHECK (status IN ('PENDING','CALCULATING','CALCULATED','WARNING','BLOCKED','EXCLUDED','FAILED'))
);

CREATE TABLE pay_payroll_run_attempts (
    payroll_run_attempt_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    payroll_run_id BIGINT NOT NULL,
    attempt_no INTEGER NOT NULL,
    status VARCHAR(24) NOT NULL,
    engine_version VARCHAR(50) NOT NULL,
    formula_set_digest CHAR(64) NOT NULL,
    input_snapshot_digest CHAR(64) NOT NULL,
    idempotency_key VARCHAR(160) NOT NULL,
    lease_token UUID,
    lease_expires_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    output_digest CHAR(64),
    error_code VARCHAR(80),
    correlation_id UUID NOT NULL,
    created_by UUID NOT NULL,
    CONSTRAINT uk_pay_run_attempt_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_pay_run_attempt_no UNIQUE (tenant_id, payroll_run_id, attempt_no),
    CONSTRAINT uk_pay_run_attempt_idem UNIQUE (tenant_id, idempotency_key),
    CONSTRAINT uk_pay_run_attempt_internal UNIQUE (tenant_id, payroll_run_attempt_id),
    CONSTRAINT fk_pay_run_attempt_run FOREIGN KEY (tenant_id, payroll_run_id) REFERENCES pay_payroll_runs (tenant_id, payroll_run_id),
    CONSTRAINT ck_pay_run_attempt_no CHECK (attempt_no > 0),
    CONSTRAINT ck_pay_run_attempt_status CHECK (status IN ('QUEUED','RUNNING','SUCCEEDED','FAILED','RESULT_UNKNOWN','SUPERSEDED'))
);

CREATE TABLE pay_worker_results (
    worker_result_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    payroll_run_attempt_id BIGINT NOT NULL,
    worker_public_id UUID NOT NULL,
    currency_code CHAR(3) NOT NULL,
    gross_amount NUMERIC(19,4) NOT NULL,
    deduction_amount NUMERIC(19,4) NOT NULL,
    net_amount NUMERIC(19,4) NOT NULL,
    employer_cost_amount NUMERIC(19,4) NOT NULL,
    line_count INTEGER NOT NULL,
    result_digest CHAR(64) NOT NULL,
    posted_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uk_pay_worker_result_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_pay_worker_result_attempt UNIQUE (tenant_id, payroll_run_attempt_id, worker_public_id),
    CONSTRAINT fk_pay_worker_result_attempt FOREIGN KEY (tenant_id, payroll_run_attempt_id) REFERENCES pay_payroll_run_attempts (tenant_id, payroll_run_attempt_id),
    CONSTRAINT ck_pay_worker_result_currency CHECK (currency_code ~ '^[A-Z]{3}$'),
    CONSTRAINT ck_pay_worker_result_totals CHECK (net_amount = gross_amount - deduction_amount),
    CONSTRAINT ck_pay_worker_result_lines CHECK (line_count >= 0)
);
CREATE INDEX ix_pay_worker_result_worker ON pay_worker_results (tenant_id, worker_public_id, posted_at DESC);

CREATE TABLE pay_result_lines (
    result_line_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    worker_result_public_id UUID NOT NULL,
    element_public_id UUID NOT NULL,
    element_version_public_id UUID NOT NULL,
    line_type VARCHAR(30) NOT NULL,
    amount NUMERIC(19,4) NOT NULL,
    currency_code CHAR(3) NOT NULL,
    rate NUMERIC(19,8),
    quantity NUMERIC(19,6),
    balance_effect NUMERIC(19,6),
    trace_public_id UUID NOT NULL,
    source_entry_public_id UUID,
    reverses_line_public_id UUID,
    posted_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uk_pay_result_line_public UNIQUE (tenant_id, public_id),
    CONSTRAINT fk_pay_result_line_worker_result FOREIGN KEY (tenant_id, worker_result_public_id) REFERENCES pay_worker_results (tenant_id, public_id),
    CONSTRAINT fk_pay_result_line_element_version FOREIGN KEY (tenant_id, element_version_public_id) REFERENCES pay_element_versions (tenant_id, public_id),
    CONSTRAINT fk_pay_result_line_reversal FOREIGN KEY (tenant_id, reverses_line_public_id) REFERENCES pay_result_lines (tenant_id, public_id),
    CONSTRAINT ck_pay_result_line_currency CHECK (currency_code ~ '^[A-Z]{3}$'),
    CONSTRAINT ck_pay_result_line_type CHECK (line_type IN ('EARNING','DEDUCTION','EMPLOYER_COST','INFORMATION','REVERSAL')),
    CONSTRAINT ck_pay_result_line_reversal CHECK ((line_type = 'REVERSAL') = (reverses_line_public_id IS NOT NULL)),
    CONSTRAINT ck_pay_result_line_not_self_reversal CHECK (reverses_line_public_id IS NULL OR reverses_line_public_id <> public_id)
);
CREATE INDEX ix_pay_result_line_worker_result ON pay_result_lines (tenant_id, worker_result_public_id, element_public_id);
CREATE UNIQUE INDEX uk_pay_result_line_single_reversal
    ON pay_result_lines (tenant_id, reverses_line_public_id)
    WHERE line_type = 'REVERSAL';

CREATE TABLE pay_calculation_trace_nodes (
    calculation_trace_node_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    payroll_run_attempt_public_id UUID NOT NULL,
    worker_public_id UUID NOT NULL,
    node_key VARCHAR(160) NOT NULL,
    node_type VARCHAR(30) NOT NULL,
    formula_version_public_id UUID,
    input_digest CHAR(64) NOT NULL,
    output_digest CHAR(64) NOT NULL,
    unrounded_output_amount NUMERIC(24,8),
    output_amount NUMERIC(24,8),
    currency_code CHAR(3),
    rounding_policy_public_id UUID,
    rounding_stage VARCHAR(32),
    rounding_scale SMALLINT,
    rounding_mode VARCHAR(16),
    rounding_policy_digest CHAR(64),
    parent_node_public_id UUID,
    evaluated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uk_pay_trace_public UNIQUE (tenant_id, public_id),
    CONSTRAINT fk_pay_trace_attempt FOREIGN KEY (tenant_id, payroll_run_attempt_public_id) REFERENCES pay_payroll_run_attempts (tenant_id, public_id),
    CONSTRAINT fk_pay_trace_parent FOREIGN KEY (tenant_id, parent_node_public_id) REFERENCES pay_calculation_trace_nodes (tenant_id, public_id),
    CONSTRAINT ck_pay_trace_currency CHECK (currency_code IS NULL OR currency_code ~ '^[A-Z]{3}$'),
    CONSTRAINT ck_pay_trace_type CHECK (node_type IN ('INPUT','FORMULA','DECISION','AGGREGATION','ROUNDING','OUTPUT')),
    CONSTRAINT ck_pay_trace_rounding_stage CHECK (rounding_stage IS NULL OR rounding_stage IN ('SOURCE_NORMALIZE','FORMULA_DECLARED','ELEMENT','WORKER_RESULT','SETTLEMENT_OR_STATUTORY')),
    CONSTRAINT ck_pay_trace_rounding_scale CHECK (rounding_scale IS NULL OR rounding_scale BETWEEN 0 AND 8),
    CONSTRAINT ck_pay_trace_rounding_mode CHECK (rounding_mode IS NULL OR rounding_mode IN ('HALF_UP','HALF_EVEN','DOWN','UP','FLOOR','CEILING')),
    CONSTRAINT ck_pay_trace_rounding_evidence CHECK (
        (rounding_stage IS NULL AND rounding_scale IS NULL AND rounding_mode IS NULL AND rounding_policy_digest IS NULL)
        OR
        (rounding_stage IS NOT NULL AND rounding_scale IS NOT NULL AND rounding_mode IS NOT NULL AND rounding_policy_digest ~ '^[0-9a-f]{64}$')
    )
);
CREATE INDEX ix_pay_trace_worker ON pay_calculation_trace_nodes (tenant_id, payroll_run_attempt_public_id, worker_public_id, node_key);
ALTER TABLE pay_result_lines ADD CONSTRAINT fk_pay_result_line_trace
    FOREIGN KEY (tenant_id, trace_public_id) REFERENCES pay_calculation_trace_nodes (tenant_id, public_id);

CREATE TABLE pay_balance_ledger_entries (
    balance_ledger_entry_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    worker_public_id UUID NOT NULL,
    balance_key VARCHAR(100) NOT NULL,
    period_key VARCHAR(80) NOT NULL,
    value_kind VARCHAR(12) NOT NULL,
    amount_delta NUMERIC(19,6),
    currency_code CHAR(3),
    quantity_delta NUMERIC(19,6),
    unit VARCHAR(12),
    source_result_line_public_id UUID NOT NULL,
    reverses_entry_public_id UUID,
    entry_type VARCHAR(20) NOT NULL,
    posted_at TIMESTAMPTZ NOT NULL,
    posted_by UUID NOT NULL,
    correlation_id UUID NOT NULL,
    CONSTRAINT uk_pay_balance_ledger_public UNIQUE (tenant_id, public_id),
    CONSTRAINT fk_pay_balance_source_line FOREIGN KEY (tenant_id, source_result_line_public_id) REFERENCES pay_result_lines (tenant_id, public_id),
    CONSTRAINT fk_pay_balance_reversal FOREIGN KEY (tenant_id, reverses_entry_public_id) REFERENCES pay_balance_ledger_entries (tenant_id, public_id),
    CONSTRAINT ck_pay_balance_entry_type CHECK (entry_type IN ('POST','ADJUST','REVERSE')),
    CONSTRAINT ck_pay_balance_value_kind CHECK (value_kind IN ('AMOUNT','QUANTITY')),
    CONSTRAINT ck_pay_balance_value_shape CHECK (
        (value_kind = 'AMOUNT' AND amount_delta IS NOT NULL AND currency_code ~ '^[A-Z]{3}$'
         AND quantity_delta IS NULL AND unit IS NULL)
        OR
        (value_kind = 'QUANTITY' AND amount_delta IS NULL AND currency_code IS NULL
         AND quantity_delta IS NOT NULL AND unit IN ('MINUTE','HOUR','DAY','COUNT'))
    ),
    CONSTRAINT ck_pay_balance_reversal CHECK ((entry_type = 'REVERSE') = (reverses_entry_public_id IS NOT NULL)),
    CONSTRAINT ck_pay_balance_not_self_reversal CHECK (reverses_entry_public_id IS NULL OR reverses_entry_public_id <> public_id)
);
CREATE INDEX ix_pay_balance_worker ON pay_balance_ledger_entries (tenant_id, worker_public_id, balance_key, period_key);
CREATE UNIQUE INDEX uk_pay_balance_single_reversal
    ON pay_balance_ledger_entries (tenant_id, reverses_entry_public_id)
    WHERE entry_type = 'REVERSE';

CREATE TABLE pay_retro_events (
    retro_event_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    worker_public_id UUID NOT NULL,
    source_change_event_public_id UUID NOT NULL,
    affected_from DATE NOT NULL,
    affected_to DATE NOT NULL,
    discovered_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(24) NOT NULL,
    processing_run_public_id UUID,
    source_digest CHAR(64) NOT NULL,
    row_version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uk_pay_retro_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_pay_retro_source UNIQUE (tenant_id, source_change_event_public_id, worker_public_id),
    CONSTRAINT ck_pay_retro_period CHECK (affected_to >= affected_from),
    CONSTRAINT ck_pay_retro_status CHECK (status IN ('DETECTED','ASSESSED','QUEUED','PROCESSED','IGNORED','FAILED'))
);

CREATE TABLE pay_reconciliation_issues (
    reconciliation_issue_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    scope_type VARCHAR(30) NOT NULL,
    scope_public_id UUID NOT NULL,
    issue_code VARCHAR(80) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    expected_digest CHAR(64),
    actual_digest CHAR(64),
    expected_amount NUMERIC(19,4),
    actual_amount NUMERIC(19,4),
    currency_code CHAR(3),
    status VARCHAR(20) NOT NULL,
    owner_actor_public_id UUID,
    resolution_code VARCHAR(80),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID,
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_pay_reconciliation_public UNIQUE (tenant_id, public_id),
    CONSTRAINT ck_pay_reconciliation_severity CHECK (severity IN ('INFO','WARNING','BLOCKING')),
    CONSTRAINT ck_pay_reconciliation_amount_currency CHECK (
        (expected_amount IS NULL AND actual_amount IS NULL AND currency_code IS NULL)
        OR ((expected_amount IS NOT NULL OR actual_amount IS NOT NULL) AND currency_code ~ '^[A-Z]{3}$')
    ),
    CONSTRAINT ck_pay_reconciliation_status CHECK (status IN ('OPEN','ASSIGNED','RESOLVED','WAIVED','SUPERSEDED'))
);
CREATE INDEX ix_pay_reconciliation_queue ON pay_reconciliation_issues (tenant_id, status, severity, created_at);

CREATE TABLE pay_run_approvals (
    run_approval_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    payroll_run_id BIGINT NOT NULL,
    approval_stage VARCHAR(30) NOT NULL,
    decision VARCHAR(20) NOT NULL,
    actor_public_id UUID NOT NULL,
    actor_duty VARCHAR(100) NOT NULL,
    aggregate_revision BIGINT NOT NULL,
    approval_case_public_id UUID NOT NULL,
    decision_digest CHAR(64) NOT NULL,
    decided_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uk_pay_run_approval_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_pay_run_approval_stage UNIQUE (tenant_id, payroll_run_id, approval_stage, aggregate_revision),
    CONSTRAINT fk_pay_run_approval_run FOREIGN KEY (tenant_id, payroll_run_id) REFERENCES pay_payroll_runs (tenant_id, payroll_run_id),
    CONSTRAINT ck_pay_run_approval_decision CHECK (decision IN ('APPROVED','REJECTED','REVOKED'))
);

CREATE TABLE pay_payment_batches (
    payment_batch_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    payroll_run_id BIGINT NOT NULL,
    connection_public_id UUID,
    format_key VARCHAR(100),
    format_version VARCHAR(30),
    status VARCHAR(24) NOT NULL,
    currency_code CHAR(3) NOT NULL,
    instruction_count INTEGER NOT NULL,
    total_amount NUMERIC(19,4) NOT NULL,
    payload_digest CHAR(64),
    approval_case_public_id UUID,
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    released_at TIMESTAMPTZ,
    released_by UUID,
    CONSTRAINT uk_pay_payment_batch_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_pay_payment_batch_internal UNIQUE (tenant_id, payment_batch_id),
    CONSTRAINT fk_pay_payment_batch_run FOREIGN KEY (tenant_id, payroll_run_id) REFERENCES pay_payroll_runs (tenant_id, payroll_run_id),
    CONSTRAINT ck_pay_payment_batch_currency CHECK (currency_code ~ '^[A-Z]{3}$'),
    CONSTRAINT ck_pay_payment_batch_status CHECK (status IN ('DRAFT','VALIDATING','APPROVED','RELEASED','ACKNOWLEDGED','REJECTED','RESULT_UNKNOWN','REVERSED')),
    CONSTRAINT ck_pay_payment_batch_totals CHECK (instruction_count >= 0 AND total_amount >= 0)
);

CREATE TABLE pay_payment_instructions (
    payment_instruction_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    payment_batch_id BIGINT NOT NULL,
    worker_public_id UUID NOT NULL,
    bank_token_public_id UUID NOT NULL,
    bank_token_version BIGINT NOT NULL,
    amount NUMERIC(19,4) NOT NULL,
    currency_code CHAR(3) NOT NULL,
    status VARCHAR(24) NOT NULL,
    source_worker_result_public_id UUID NOT NULL,
    instruction_digest CHAR(64) NOT NULL,
    provider_reference VARCHAR(160),
    row_version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uk_pay_payment_instruction_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_pay_payment_instruction_worker UNIQUE (tenant_id, payment_batch_id, worker_public_id),
    CONSTRAINT fk_pay_payment_instruction_batch FOREIGN KEY (tenant_id, payment_batch_id) REFERENCES pay_payment_batches (tenant_id, payment_batch_id),
    CONSTRAINT fk_pay_payment_instruction_result FOREIGN KEY (tenant_id, source_worker_result_public_id) REFERENCES pay_worker_results (tenant_id, public_id),
    CONSTRAINT ck_pay_payment_instruction_currency CHECK (currency_code ~ '^[A-Z]{3}$'),
    CONSTRAINT ck_pay_payment_instruction_amount CHECK (amount >= 0),
    CONSTRAINT ck_pay_payment_instruction_status CHECK (status IN ('DRAFT','VALID','RELEASED','ACKNOWLEDGED','REJECTED','RETURNED','REVERSED'))
);

CREATE TABLE pay_payment_files (
    payment_file_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    payment_batch_id BIGINT NOT NULL,
    object_ref UUID NOT NULL,
    object_digest CHAR(64) NOT NULL,
    format_key VARCHAR(100) NOT NULL,
    format_version VARCHAR(30) NOT NULL,
    classification VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    revoked_at TIMESTAMPTZ,
    CONSTRAINT uk_pay_payment_file_public UNIQUE (tenant_id, public_id),
    CONSTRAINT fk_pay_payment_file_batch FOREIGN KEY (tenant_id, payment_batch_id) REFERENCES pay_payment_batches (tenant_id, payment_batch_id),
    CONSTRAINT ck_pay_payment_file_class CHECK (classification IN ('HIGHLY_RESTRICTED','REGULATED'))
);

CREATE TABLE pay_connector_receipts (
    connector_receipt_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    connector_kind VARCHAR(30) NOT NULL,
    connection_public_id UUID NOT NULL,
    request_public_id UUID NOT NULL,
    idempotency_key VARCHAR(160) NOT NULL,
    request_digest CHAR(64) NOT NULL,
    status VARCHAR(24) NOT NULL,
    provider_reference VARCHAR(160),
    response_digest CHAR(64),
    reason_code VARCHAR(80),
    sent_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    correlation_id UUID NOT NULL,
    CONSTRAINT uk_pay_connector_receipt_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_pay_connector_receipt_idem UNIQUE (tenant_id, connector_kind, connection_public_id, idempotency_key),
    CONSTRAINT ck_pay_connector_kind CHECK (connector_kind IN ('BANK','ERP','STATUTORY','YEA','LEGACY')),
    CONSTRAINT ck_pay_connector_status CHECK (status IN ('PENDING','SENT','ACKNOWLEDGED','REJECTED','RESULT_UNKNOWN','SUPERSEDED'))
);

CREATE TABLE pay_gl_mapping_rule_versions (
    gl_mapping_rule_version_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    mapping_key VARCHAR(100) NOT NULL,
    version_no INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    source_element_key VARCHAR(100) NOT NULL,
    debit_account_ref VARCHAR(160),
    credit_account_ref VARCHAR(160),
    cost_object_mapping_ref UUID,
    valid_from DATE NOT NULL,
    valid_to DATE,
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    CONSTRAINT uk_pay_gl_mapping_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_pay_gl_mapping_version UNIQUE (tenant_id, mapping_key, version_no),
    CONSTRAINT ck_pay_gl_mapping_status CHECK (status IN ('DRAFT','VALIDATED','APPROVED','PUBLISHED','RETIRED')),
    CONSTRAINT ck_pay_gl_mapping_period CHECK (valid_to IS NULL OR valid_to > valid_from)
);
ALTER TABLE pay_gl_mapping_rule_versions ADD CONSTRAINT ex_pay_gl_mapping_overlap
    EXCLUDE USING gist (tenant_id WITH =, mapping_key WITH =, daterange(valid_from, COALESCE(valid_to, 'infinity'::date), '[)') WITH &&)
    WHERE (status = 'PUBLISHED');

CREATE TABLE pay_gl_batches (
    gl_batch_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    payroll_run_id BIGINT NOT NULL,
    connection_public_id UUID,
    mapping_set_digest CHAR(64) NOT NULL,
    status VARCHAR(24) NOT NULL,
    currency_code CHAR(3) NOT NULL,
    line_count INTEGER NOT NULL,
    debit_total NUMERIC(19,4) NOT NULL,
    credit_total NUMERIC(19,4) NOT NULL,
    payload_digest CHAR(64),
    approval_case_public_id UUID,
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    CONSTRAINT uk_pay_gl_batch_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_pay_gl_batch_internal UNIQUE (tenant_id, gl_batch_id),
    CONSTRAINT fk_pay_gl_batch_run FOREIGN KEY (tenant_id, payroll_run_id) REFERENCES pay_payroll_runs (tenant_id, payroll_run_id),
    CONSTRAINT ck_pay_gl_batch_currency CHECK (currency_code ~ '^[A-Z]{3}$'),
    CONSTRAINT ck_pay_gl_batch_status CHECK (status IN ('DRAFT','BALANCED','APPROVED','SENT','POSTED','REJECTED','RESULT_UNKNOWN','REVERSED')),
    CONSTRAINT ck_pay_gl_batch_balance CHECK (debit_total = credit_total),
    CONSTRAINT ck_pay_gl_batch_lines CHECK (line_count >= 0)
);

CREATE TABLE pay_gl_lines (
    gl_line_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    gl_batch_id BIGINT NOT NULL,
    line_no INTEGER NOT NULL,
    debit_credit VARCHAR(6) NOT NULL,
    account_ref VARCHAR(160) NOT NULL,
    cost_object_ref VARCHAR(160),
    amount NUMERIC(19,4) NOT NULL,
    currency_code CHAR(3) NOT NULL,
    source_result_line_public_id UUID NOT NULL,
    mapping_rule_public_id UUID NOT NULL,
    line_digest CHAR(64) NOT NULL,
    CONSTRAINT uk_pay_gl_line_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_pay_gl_line_no UNIQUE (tenant_id, gl_batch_id, line_no),
    CONSTRAINT fk_pay_gl_line_batch FOREIGN KEY (tenant_id, gl_batch_id) REFERENCES pay_gl_batches (tenant_id, gl_batch_id),
    CONSTRAINT fk_pay_gl_line_result FOREIGN KEY (tenant_id, source_result_line_public_id) REFERENCES pay_result_lines (tenant_id, public_id),
    CONSTRAINT ck_pay_gl_line_currency CHECK (currency_code ~ '^[A-Z]{3}$'),
    CONSTRAINT ck_pay_gl_line_side CHECK (debit_credit IN ('DEBIT','CREDIT')),
    CONSTRAINT ck_pay_gl_line_amount CHECK (amount >= 0)
);

CREATE TABLE pay_payslips (
    payslip_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    payroll_run_id BIGINT NOT NULL,
    worker_public_id UUID NOT NULL,
    worker_result_public_id UUID NOT NULL,
    document_version INTEGER NOT NULL,
    object_ref UUID NOT NULL,
    object_digest CHAR(64) NOT NULL,
    template_public_id UUID NOT NULL,
    template_version INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    published_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    CONSTRAINT uk_pay_payslip_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_pay_payslip_version UNIQUE (tenant_id, payroll_run_id, worker_public_id, document_version),
    CONSTRAINT fk_pay_payslip_run FOREIGN KEY (tenant_id, payroll_run_id) REFERENCES pay_payroll_runs (tenant_id, payroll_run_id),
    CONSTRAINT fk_pay_payslip_worker_result FOREIGN KEY (tenant_id, worker_result_public_id) REFERENCES pay_worker_results (tenant_id, public_id),
    CONSTRAINT ck_pay_payslip_status CHECK (status IN ('GENERATED','PUBLISHED','REVOKED')),
    CONSTRAINT ck_pay_payslip_publish CHECK (
        (status = 'GENERATED' AND published_at IS NULL AND revoked_at IS NULL)
        OR (status = 'PUBLISHED' AND published_at IS NOT NULL AND revoked_at IS NULL)
        OR (status = 'REVOKED' AND published_at IS NOT NULL AND revoked_at IS NOT NULL)
    )
);

CREATE TABLE pay_payslip_access_events (
    payslip_access_event_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    payslip_public_id UUID NOT NULL,
    actor_public_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL,
    purpose_code VARCHAR(80) NOT NULL,
    field_policy_revision BIGINT NOT NULL,
    step_up_session_public_id UUID,
    occurred_at TIMESTAMPTZ NOT NULL,
    correlation_id UUID NOT NULL,
    CONSTRAINT uk_pay_payslip_access_public UNIQUE (tenant_id, public_id),
    CONSTRAINT fk_pay_payslip_access_payslip FOREIGN KEY (tenant_id, payslip_public_id) REFERENCES pay_payslips (tenant_id, public_id),
    CONSTRAINT ck_pay_payslip_access_action CHECK (action IN ('VIEW','DOWNLOAD','PRINT','EXPORT'))
);

CREATE TABLE pay_country_pack_versions (
    country_pack_version_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    jurisdiction_code VARCHAR(20) NOT NULL,
    pack_key VARCHAR(100) NOT NULL,
    version_no INTEGER NOT NULL,
    artifact_digest CHAR(64) NOT NULL,
    compatibility_version VARCHAR(30) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    status VARCHAR(20) NOT NULL,
    official_reference_set_ref UUID,
    golden_pack_ref UUID,
    statutory_approved_by UUID,
    statutory_approved_at TIMESTAMPTZ,
    installed_at TIMESTAMPTZ,
    activated_at TIMESTAMPTZ,
    row_version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uk_pay_country_pack_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_pay_country_pack_version UNIQUE (tenant_id, jurisdiction_code, pack_key, version_no),
    CONSTRAINT ck_pay_country_pack_period CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT ck_pay_country_pack_status CHECK (status IN ('AVAILABLE','INSTALLED','VALIDATED','APPROVED','ACTIVE','SUSPENDED','RETIRED')),
    CONSTRAINT ck_pay_country_pack_activation CHECK (
        status NOT IN ('ACTIVE','SUSPENDED','RETIRED')
        OR (
            official_reference_set_ref IS NOT NULL
            AND golden_pack_ref IS NOT NULL
            AND statutory_approved_by IS NOT NULL
            AND statutory_approved_at IS NOT NULL
            AND activated_at IS NOT NULL
        )
    ),
    CONSTRAINT ck_pay_country_pack_activation_marker CHECK (
        (status IN ('ACTIVE','SUSPENDED','RETIRED') AND activated_at IS NOT NULL)
        OR (status NOT IN ('ACTIVE','SUSPENDED','RETIRED') AND activated_at IS NULL)
    ),
    CONSTRAINT ex_pay_country_pack_ever_active_period EXCLUDE USING gist (
        tenant_id WITH =,
        jurisdiction_code WITH =,
        pack_key WITH =,
        daterange(effective_from, COALESCE(effective_to, 'infinity'::date), '[)') WITH &&
    ) WHERE (activated_at IS NOT NULL)
);

CREATE OR REPLACE FUNCTION pay_guard_country_pack_activation_lineage() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'PAY_COUNTRY_PACK_VERSION_CANNOT_BE_DELETED' USING ERRCODE = '55000';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.activated_at IS NOT NULL THEN
        IF NEW.activated_at IS DISTINCT FROM OLD.activated_at
           OR NEW.jurisdiction_code IS DISTINCT FROM OLD.jurisdiction_code
           OR NEW.pack_key IS DISTINCT FROM OLD.pack_key
           OR NEW.version_no IS DISTINCT FROM OLD.version_no
           OR NEW.artifact_digest IS DISTINCT FROM OLD.artifact_digest
           OR NEW.compatibility_version IS DISTINCT FROM OLD.compatibility_version
           OR NEW.official_reference_set_ref IS DISTINCT FROM OLD.official_reference_set_ref
           OR NEW.golden_pack_ref IS DISTINCT FROM OLD.golden_pack_ref
           OR NEW.statutory_approved_by IS DISTINCT FROM OLD.statutory_approved_by
           OR NEW.statutory_approved_at IS DISTINCT FROM OLD.statutory_approved_at
           OR NEW.effective_from IS DISTINCT FROM OLD.effective_from THEN
            RAISE EXCEPTION 'PAY_COUNTRY_PACK_ACTIVE_LINEAGE_IMMUTABLE' USING ERRCODE = '55000';
        END IF;
        IF NEW.effective_to IS DISTINCT FROM OLD.effective_to
           AND NOT (
               OLD.effective_to IS NULL
               AND NEW.effective_to IS NOT NULL
               AND NEW.effective_to > OLD.effective_from
           ) THEN
            RAISE EXCEPTION 'PAY_COUNTRY_PACK_PERIOD_REWRITE_FORBIDDEN' USING ERRCODE = '55000';
        END IF;
        IF OLD.status = 'RETIRED' AND NEW.status <> 'RETIRED' THEN
            RAISE EXCEPTION 'PAY_COUNTRY_PACK_RETIREMENT_MONOTONIC' USING ERRCODE = '55000';
        END IF;
    ELSIF NEW.status IN ('ACTIVE','SUSPENDED','RETIRED') THEN
        NEW.activated_at := COALESCE(NEW.activated_at, CURRENT_TIMESTAMP);
    ELSIF NEW.activated_at IS NOT NULL THEN
        RAISE EXCEPTION 'PAY_COUNTRY_PACK_ACTIVATION_MARKER_WITHOUT_ACTIVE_LINEAGE' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_pay_country_pack_activation_lineage
    BEFORE INSERT OR UPDATE OR DELETE ON pay_country_pack_versions
    FOR EACH ROW EXECUTE FUNCTION pay_guard_country_pack_activation_lineage();

CREATE TABLE pay_statutory_cases (
    statutory_case_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    worker_public_id UUID,
    legal_payroll_entity_public_id UUID NOT NULL,
    pay_period_public_id UUID,
    case_type VARCHAR(40) NOT NULL,
    jurisdiction_code VARCHAR(20) NOT NULL,
    country_pack_version_public_id UUID NOT NULL,
    status VARCHAR(24) NOT NULL,
    input_snapshot_digest CHAR(64) NOT NULL,
    result_digest CHAR(64),
    filing_receipt_public_id UUID,
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    CONSTRAINT uk_pay_statutory_case_public UNIQUE (tenant_id, public_id),
    CONSTRAINT ck_pay_statutory_case_type CHECK (case_type IN ('WITHHOLDING','INSURANCE','RETIREMENT','GARNISHMENT','FILING','CORRECTION')),
    CONSTRAINT ck_pay_statutory_case_status CHECK (status IN ('OPEN','READY','CALCULATING','CALCULATED','REVIEWED','FILED','REJECTED','CORRECTION_REQUIRED','CLOSED'))
);

CREATE TABLE pay_year_end_cases (
    year_end_case_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    worker_public_id UUID NOT NULL,
    tax_year SMALLINT NOT NULL,
    jurisdiction_code VARCHAR(20) NOT NULL,
    provider_mode VARCHAR(20) NOT NULL,
    provider_connection_public_id UUID,
    country_pack_version_public_id UUID,
    status VARCHAR(30) NOT NULL,
    consent_revision BIGINT,
    input_snapshot_digest CHAR(64),
    provider_result_digest CHAR(64),
    reconciled_result_digest CHAR(64),
    supersedes_case_public_id UUID,
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID NOT NULL,
    CONSTRAINT uk_pay_year_end_case_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_pay_year_end_case_internal UNIQUE (tenant_id, year_end_case_id),
    CONSTRAINT uk_pay_year_end_case_worker UNIQUE (tenant_id, worker_public_id, tax_year, jurisdiction_code, supersedes_case_public_id),
    CONSTRAINT ck_pay_year_end_mode CHECK (provider_mode IN ('EXTERNAL_PROVIDER','NATIVE_COUNTRY_PACK','HYBRID')),
    CONSTRAINT ck_pay_year_end_provider CHECK ((provider_mode = 'NATIVE_COUNTRY_PACK' AND country_pack_version_public_id IS NOT NULL) OR (provider_mode <> 'NATIVE_COUNTRY_PACK' AND provider_connection_public_id IS NOT NULL)),
    CONSTRAINT ck_pay_year_end_status CHECK (status IN ('OPEN','COLLECTING','READY','SUBMITTED_TO_PROVIDER','CALCULATED','REVIEWED','FILED','CORRECTION_REQUIRED','CLOSED','CANCELLED'))
);

CREATE TABLE pay_year_end_evidence (
    year_end_evidence_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    year_end_case_id BIGINT NOT NULL,
    evidence_type VARCHAR(80) NOT NULL,
    object_ref UUID NOT NULL,
    object_digest CHAR(64) NOT NULL,
    sensitivity VARCHAR(30) NOT NULL,
    purpose_code VARCHAR(80) NOT NULL,
    retention_policy_ref UUID NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL,
    submitted_by UUID NOT NULL,
    revoked_at TIMESTAMPTZ,
    CONSTRAINT uk_pay_year_end_evidence_public UNIQUE (tenant_id, public_id),
    CONSTRAINT fk_pay_year_end_evidence_case FOREIGN KEY (tenant_id, year_end_case_id) REFERENCES pay_year_end_cases (tenant_id, year_end_case_id),
    CONSTRAINT ck_pay_year_end_evidence_sensitivity CHECK (sensitivity IN ('RESTRICTED','HIGHLY_RESTRICTED','REGULATED'))
);

CREATE TABLE pay_year_end_provider_invocations (
    provider_invocation_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    year_end_case_id BIGINT NOT NULL,
    provider_connection_public_id UUID NOT NULL,
    operation VARCHAR(30) NOT NULL,
    contract_version VARCHAR(30) NOT NULL,
    idempotency_key VARCHAR(160) NOT NULL,
    request_digest CHAR(64) NOT NULL,
    status VARCHAR(24) NOT NULL,
    provider_reference VARCHAR(160),
    response_digest CHAR(64),
    reason_code VARCHAR(80),
    correlation_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    CONSTRAINT uk_pay_year_end_invocation_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_pay_year_end_invocation_idem UNIQUE (tenant_id, provider_connection_public_id, idempotency_key),
    CONSTRAINT fk_pay_year_end_invocation_case FOREIGN KEY (tenant_id, year_end_case_id) REFERENCES pay_year_end_cases (tenant_id, year_end_case_id),
    CONSTRAINT ck_pay_year_end_operation CHECK (operation IN ('VALIDATE','CALCULATE','FILE','CORRECT','STATUS')),
    CONSTRAINT ck_pay_year_end_invocation_status CHECK (status IN ('PENDING','SENT','ACKNOWLEDGED','REJECTED','RESULT_UNKNOWN','SUPERSEDED'))
);

CREATE TABLE pay_command_receipts (
    command_receipt_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    command_type VARCHAR(100) NOT NULL,
    originating_action VARCHAR(120) NOT NULL,
    subject_principal_public_id UUID NOT NULL,
    population_scope_digest CHAR(64) NOT NULL,
    field_policy_revision BIGINT NOT NULL,
    purpose_code VARCHAR(120) NOT NULL,
    authorization_revision BIGINT NOT NULL,
    idempotency_key VARCHAR(160) NOT NULL,
    request_digest CHAR(64) NOT NULL,
    aggregate_public_id UUID,
    aggregate_revision BIGINT,
    status VARCHAR(24) NOT NULL,
    result_ref UUID,
    error_code VARCHAR(80),
    correlation_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    CONSTRAINT uk_pay_command_receipt_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_pay_command_receipt_idem UNIQUE (tenant_id, subject_principal_public_id, originating_action, idempotency_key),
    CONSTRAINT ck_pay_command_receipt_auth_revisions CHECK (field_policy_revision > 0 AND authorization_revision > 0),
    CONSTRAINT ck_pay_command_receipt_population_digest CHECK (population_scope_digest ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_pay_command_receipt_request_digest CHECK (request_digest ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_pay_command_receipt_status CHECK (status IN ('ACCEPTED','RUNNING','SUCCEEDED','REJECTED','FAILED','RESULT_UNKNOWN'))
);

CREATE OR REPLACE FUNCTION pay_guard_command_receipt_seal()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'PAY command receipt cannot be deleted';
    END IF;
    IF ROW(NEW.tenant_id, NEW.command_type, NEW.originating_action,
           NEW.subject_principal_public_id, NEW.population_scope_digest,
           NEW.field_policy_revision, NEW.purpose_code,
           NEW.authorization_revision, NEW.idempotency_key,
           NEW.request_digest, NEW.correlation_id)
       IS DISTINCT FROM
       ROW(OLD.tenant_id, OLD.command_type, OLD.originating_action,
           OLD.subject_principal_public_id, OLD.population_scope_digest,
           OLD.field_policy_revision, OLD.purpose_code,
           OLD.authorization_revision, OLD.idempotency_key,
           OLD.request_digest, OLD.correlation_id) THEN
        RAISE EXCEPTION 'PAY command receipt originating authorization and idempotency context is immutable';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_pay_command_receipt_seal
    BEFORE UPDATE OR DELETE ON pay_command_receipts
    FOR EACH ROW EXECUTE FUNCTION pay_guard_command_receipt_seal();

CREATE TABLE pay_inbox_receipts (
    inbox_receipt_id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    event_id UUID NOT NULL,
    schema_name VARCHAR(120) NOT NULL,
    schema_version INTEGER NOT NULL,
    subject_public_id UUID,
    subject_revision BIGINT,
    payload_digest CHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ,
    error_code VARCHAR(80),
    CONSTRAINT uk_pay_inbox_event UNIQUE (tenant_id, event_id),
    CONSTRAINT ck_pay_inbox_status CHECK (status IN ('RECEIVED','PROCESSED','QUARANTINED','DEAD_LETTERED'))
);

CREATE TABLE pay_outbox_events (
    outbox_event_id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    event_id UUID NOT NULL,
    aggregate_type VARCHAR(80) NOT NULL,
    aggregate_public_id UUID NOT NULL,
    aggregate_revision BIGINT NOT NULL,
    schema_name VARCHAR(120) NOT NULL,
    schema_version INTEGER NOT NULL,
    payload JSONB NOT NULL,
    payload_digest CHAR(64) NOT NULL,
    correlation_id UUID NOT NULL,
    causation_id UUID,
    occurred_at TIMESTAMPTZ NOT NULL,
    published_at TIMESTAMPTZ,
    publish_attempts INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uk_pay_outbox_event UNIQUE (tenant_id, event_id),
    CONSTRAINT ck_pay_outbox_payload CHECK (jsonb_typeof(payload) = 'object'),
    CONSTRAINT ck_pay_outbox_attempts CHECK (publish_attempts >= 0)
);
CREATE INDEX ix_pay_outbox_unpublished ON pay_outbox_events (occurred_at) WHERE published_at IS NULL;

-- Final monetary facts, access evidence and published outbox records are append-only.
CREATE OR REPLACE FUNCTION pay_reject_fact_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'PAYROLL_FACTS_ARE_APPEND_ONLY' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pay_guard_published_version_mutation() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status IN ('PUBLISHED','RETIRED') THEN
            RAISE EXCEPTION 'PAYROLL_PUBLISHED_VERSION_CANNOT_BE_DELETED' USING ERRCODE = '55000';
        END IF;
        RETURN OLD;
    END IF;
    IF OLD.status = 'RETIRED' THEN
        RAISE EXCEPTION 'PAYROLL_RETIRED_VERSION_IMMUTABLE' USING ERRCODE = '55000';
    END IF;
    IF OLD.status = 'PUBLISHED' THEN
        IF (to_jsonb(NEW) - ARRAY['status','valid_to','row_version'])
           IS DISTINCT FROM
           (to_jsonb(OLD) - ARRAY['status','valid_to','row_version']) THEN
            RAISE EXCEPTION 'PAYROLL_PUBLISHED_VERSION_PAYLOAD_IMMUTABLE' USING ERRCODE = '55000';
        END IF;
        IF NEW.status NOT IN ('PUBLISHED','RETIRED') THEN
            RAISE EXCEPTION 'PAYROLL_PUBLISHED_VERSION_STATE_REWIND' USING ERRCODE = '55000';
        END IF;
        IF NEW.valid_to IS DISTINCT FROM OLD.valid_to
           AND NOT (
               OLD.valid_to IS NULL
               AND NEW.valid_to IS NOT NULL
               AND NEW.valid_to > OLD.valid_from
           ) THEN
            RAISE EXCEPTION 'PAYROLL_PUBLISHED_VERSION_PERIOD_REWRITE' USING ERRCODE = '55000';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pay_guard_input_snapshot_mutation() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status IN ('FROZEN','INVALIDATED') THEN
            RAISE EXCEPTION 'PAYROLL_FROZEN_INPUT_SNAPSHOT_CANNOT_BE_DELETED' USING ERRCODE = '55000';
        END IF;
        RETURN OLD;
    END IF;
    IF OLD.status = 'INVALIDATED' THEN
        RAISE EXCEPTION 'PAYROLL_INVALIDATED_INPUT_SNAPSHOT_IMMUTABLE' USING ERRCODE = '55000';
    END IF;
    IF OLD.status = 'FROZEN' THEN
        IF (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status')
           OR NEW.status NOT IN ('FROZEN','INVALIDATED') THEN
            RAISE EXCEPTION 'PAYROLL_FROZEN_INPUT_SNAPSHOT_IMMUTABLE' USING ERRCODE = '55000';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pay_guard_run_attempt_mutation() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'PAYROLL_RUN_ATTEMPT_CANNOT_BE_DELETED' USING ERRCODE = '55000';
    END IF;
    IF ROW(NEW.tenant_id, NEW.public_id, NEW.payroll_run_id, NEW.attempt_no,
           NEW.engine_version, NEW.formula_set_digest, NEW.input_snapshot_digest,
           NEW.idempotency_key, NEW.correlation_id, NEW.created_by)
       IS DISTINCT FROM
       ROW(OLD.tenant_id, OLD.public_id, OLD.payroll_run_id, OLD.attempt_no,
           OLD.engine_version, OLD.formula_set_digest, OLD.input_snapshot_digest,
           OLD.idempotency_key, OLD.correlation_id, OLD.created_by) THEN
        RAISE EXCEPTION 'PAYROLL_RUN_ATTEMPT_IDENTITY_IMMUTABLE' USING ERRCODE = '55000';
    END IF;
    IF OLD.status IN ('SUCCEEDED','SUPERSEDED') AND NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION 'PAYROLL_TERMINAL_RUN_ATTEMPT_IMMUTABLE' USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pay_guard_payment_file_mutation() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'PAYMENT_FILE_EVIDENCE_CANNOT_BE_DELETED' USING ERRCODE = '55000';
    END IF;
    IF (to_jsonb(NEW) - 'revoked_at') IS DISTINCT FROM (to_jsonb(OLD) - 'revoked_at')
       OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at) THEN
        RAISE EXCEPTION 'PAYMENT_FILE_EVIDENCE_IMMUTABLE' USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pay_guard_connector_receipt_mutation() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'PAYROLL_CONNECTOR_RECEIPT_CANNOT_BE_DELETED' USING ERRCODE = '55000';
    END IF;
    IF ROW(NEW.tenant_id, NEW.public_id, NEW.connector_kind, NEW.connection_public_id,
           NEW.request_public_id, NEW.idempotency_key, NEW.request_digest, NEW.correlation_id)
       IS DISTINCT FROM
       ROW(OLD.tenant_id, OLD.public_id, OLD.connector_kind, OLD.connection_public_id,
           OLD.request_public_id, OLD.idempotency_key, OLD.request_digest, OLD.correlation_id) THEN
        RAISE EXCEPTION 'PAYROLL_CONNECTOR_RECEIPT_REQUEST_IMMUTABLE' USING ERRCODE = '55000';
    END IF;
    IF OLD.status IN ('ACKNOWLEDGED','REJECTED','SUPERSEDED') AND NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION 'PAYROLL_TERMINAL_CONNECTOR_RECEIPT_IMMUTABLE' USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pay_guard_payslip_mutation() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'PAYSLIP_EVIDENCE_CANNOT_BE_DELETED' USING ERRCODE = '55000';
    END IF;
    IF (to_jsonb(NEW) - ARRAY['status','published_at','revoked_at'])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['status','published_at','revoked_at']) THEN
        RAISE EXCEPTION 'PAYSLIP_DOCUMENT_IDENTITY_IMMUTABLE' USING ERRCODE = '55000';
    END IF;
    IF NOT (
        NEW IS NOT DISTINCT FROM OLD
        OR (OLD.status = 'GENERATED' AND NEW.status = 'PUBLISHED'
            AND OLD.published_at IS NULL AND NEW.published_at IS NOT NULL
            AND NEW.revoked_at IS NULL)
        OR (OLD.status = 'PUBLISHED' AND NEW.status = 'REVOKED'
            AND NEW.published_at IS NOT DISTINCT FROM OLD.published_at
            AND OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL)
    ) THEN
        RAISE EXCEPTION 'PAYSLIP_INVALID_STATE_TRANSITION' USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pay_guard_outbox_mutation() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'PAYROLL_OUTBOX_EVENT_CANNOT_BE_DELETED' USING ERRCODE = '55000';
    END IF;
    IF ROW(NEW.tenant_id, NEW.event_id, NEW.aggregate_type, NEW.aggregate_public_id,
           NEW.aggregate_revision, NEW.schema_name, NEW.schema_version, NEW.payload,
           NEW.payload_digest, NEW.correlation_id, NEW.causation_id, NEW.occurred_at)
       IS DISTINCT FROM
       ROW(OLD.tenant_id, OLD.event_id, OLD.aggregate_type, OLD.aggregate_public_id,
           OLD.aggregate_revision, OLD.schema_name, OLD.schema_version, OLD.payload,
           OLD.payload_digest, OLD.correlation_id, OLD.causation_id, OLD.occurred_at) THEN
        RAISE EXCEPTION 'PAYROLL_OUTBOX_ENVELOPE_IMMUTABLE' USING ERRCODE = '55000';
    END IF;
    IF OLD.published_at IS NOT NULL AND NEW.published_at IS DISTINCT FROM OLD.published_at THEN
        RAISE EXCEPTION 'PAYROLL_OUTBOX_PUBLICATION_IMMUTABLE' USING ERRCODE = '55000';
    END IF;
    IF NEW.publish_attempts < OLD.publish_attempts THEN
        RAISE EXCEPTION 'PAYROLL_OUTBOX_ATTEMPTS_MONOTONIC' USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_pay_element_version_published_immutable
    BEFORE UPDATE OR DELETE ON pay_element_versions FOR EACH ROW EXECUTE FUNCTION pay_guard_published_version_mutation();
CREATE TRIGGER tr_pay_formula_version_published_immutable
    BEFORE UPDATE OR DELETE ON pay_formula_versions FOR EACH ROW EXECUTE FUNCTION pay_guard_published_version_mutation();
CREATE TRIGGER tr_pay_rounding_version_published_immutable
    BEFORE UPDATE OR DELETE ON pay_rounding_policy_versions FOR EACH ROW EXECUTE FUNCTION pay_guard_published_version_mutation();
CREATE TRIGGER tr_pay_gl_mapping_version_published_immutable
    BEFORE UPDATE OR DELETE ON pay_gl_mapping_rule_versions FOR EACH ROW EXECUTE FUNCTION pay_guard_published_version_mutation();
CREATE TRIGGER tr_pay_input_snapshot_frozen
    BEFORE UPDATE OR DELETE ON pay_input_snapshots FOR EACH ROW EXECUTE FUNCTION pay_guard_input_snapshot_mutation();
CREATE TRIGGER tr_pay_run_attempt_identity
    BEFORE UPDATE OR DELETE ON pay_payroll_run_attempts FOR EACH ROW EXECUTE FUNCTION pay_guard_run_attempt_mutation();
CREATE TRIGGER tr_pay_payment_file_immutable
    BEFORE UPDATE OR DELETE ON pay_payment_files FOR EACH ROW EXECUTE FUNCTION pay_guard_payment_file_mutation();
CREATE TRIGGER tr_pay_connector_receipt_immutable
    BEFORE UPDATE OR DELETE ON pay_connector_receipts FOR EACH ROW EXECUTE FUNCTION pay_guard_connector_receipt_mutation();
CREATE TRIGGER tr_pay_payslip_immutable
    BEFORE UPDATE OR DELETE ON pay_payslips FOR EACH ROW EXECUTE FUNCTION pay_guard_payslip_mutation();

CREATE TRIGGER tr_pay_worker_results_immutable
    BEFORE UPDATE OR DELETE ON pay_worker_results FOR EACH ROW EXECUTE FUNCTION pay_reject_fact_mutation();
CREATE TRIGGER tr_pay_time_handoff_snapshots_immutable
    BEFORE UPDATE OR DELETE ON pay_time_handoff_snapshots FOR EACH ROW EXECUTE FUNCTION pay_reject_fact_mutation();
CREATE TRIGGER tr_pay_time_handoff_lines_immutable
    BEFORE UPDATE OR DELETE ON pay_time_handoff_lines FOR EACH ROW EXECUTE FUNCTION pay_reject_fact_mutation();
CREATE TRIGGER tr_pay_result_lines_immutable
    BEFORE UPDATE OR DELETE ON pay_result_lines FOR EACH ROW EXECUTE FUNCTION pay_reject_fact_mutation();
CREATE TRIGGER tr_pay_trace_immutable
    BEFORE UPDATE OR DELETE ON pay_calculation_trace_nodes FOR EACH ROW EXECUTE FUNCTION pay_reject_fact_mutation();
CREATE TRIGGER tr_pay_balance_ledger_immutable
    BEFORE UPDATE OR DELETE ON pay_balance_ledger_entries FOR EACH ROW EXECUTE FUNCTION pay_reject_fact_mutation();
CREATE TRIGGER tr_pay_run_approval_immutable
    BEFORE UPDATE OR DELETE ON pay_run_approvals FOR EACH ROW EXECUTE FUNCTION pay_reject_fact_mutation();
CREATE TRIGGER tr_pay_payslip_access_immutable
    BEFORE UPDATE OR DELETE ON pay_payslip_access_events FOR EACH ROW EXECUTE FUNCTION pay_reject_fact_mutation();
CREATE TRIGGER tr_pay_outbox_immutable
    BEFORE UPDATE OR DELETE ON pay_outbox_events FOR EACH ROW EXECUTE FUNCTION pay_guard_outbox_mutation();

-- G3 starts unpartitioned so inserts cannot fail for a missing monthly partition. Partitioning may
-- be enabled only by a measured-volume ADR that also allocates a default partition, ahead-of-time
-- creation job, retention detach/archive job, missing-partition alert and boundary/late-arrival tests.
-- RLS policies use the canonical DWP tenant setting below.
-- Application PEP is mandatory; database RLS is defense in depth, not the sole authorization layer.
-- API/worker roles are NOINHERIT, NOSUPERUSER and NOBYPASSRLS. Only an audited
-- migration/maintenance role owns tables; transaction scope sets dwp.tenant_id and
-- resets role plus setting before returning a connection to the pool.
DO $$
DECLARE target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'pay_worker_projections','pay_time_handoff_snapshots','pay_time_handoff_lines','pay_time_handoff_ingest_receipts',
    'pay_legal_payroll_entities','pay_pay_groups','pay_pay_periods','pay_element_versions','pay_formula_versions',
    'pay_formula_dependencies','pay_formula_test_cases','pay_rounding_policy_versions','pay_worker_element_entries',
    'pay_worker_tax_profiles','pay_input_snapshots','pay_payroll_runs','pay_payroll_run_workers',
    'pay_payroll_run_attempts','pay_worker_results','pay_result_lines','pay_calculation_trace_nodes',
    'pay_balance_ledger_entries','pay_retro_events','pay_reconciliation_issues','pay_run_approvals',
    'pay_payment_batches','pay_payment_instructions','pay_payment_files','pay_connector_receipts',
    'pay_gl_mapping_rule_versions','pay_gl_batches','pay_gl_lines','pay_payslips','pay_payslip_access_events',
    'pay_country_pack_versions','pay_statutory_cases','pay_year_end_cases','pay_year_end_evidence',
    'pay_year_end_provider_invocations','pay_command_receipts','pay_inbox_receipts','pay_outbox_events'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', target_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = NULLIF(current_setting(''dwp.tenant_id'', true), '''')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting(''dwp.tenant_id'', true), '''')::BIGINT)',
      target_table || '_tenant_policy', target_table
    );
  END LOOP;
END $$;
