-- DESIGN_PROPOSED / AUTHOR_ONLY / NOT EXECUTED / NO FLYWAY VERSION ALLOCATED

-- Payroll canonical payroll-main / public / flyway_schema_history / classpath:db/migration.

-- Historical G2 blob is preserved. This separate draft normalizes physical ownership only.

-- All tables first, local composite FKs second. Cross-owner FK or SQL reads are forbidden.

-- Exact state/CAS/payload/interval/append-only source review remains G3 OPEN.

-- No tenant, company, currency minor-unit, statutory number, bank endpoint or grant is seeded.

SET LOCAL search_path = pg_catalog, public;

CREATE TABLE public.pay_legal_payroll_entities (
    legal_payroll_entity_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    entity_key VARCHAR(100) NOT NULL,
    legal_entity_public_id UUID NOT NULL,
    jurisdiction_code VARCHAR(20) NOT NULL,
    base_currency CHAR(3) NOT NULL,
    time_zone VARCHAR(80) NOT NULL,
    status VARCHAR(20) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, legal_payroll_entity_id)
);

CREATE TABLE public.pay_pay_groups (
    pay_group_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
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
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, pay_group_id)
);

CREATE TABLE public.pay_pay_periods (
    pay_period_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    pay_group_id BIGINT NOT NULL,
    period_key VARCHAR(80) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    input_cutoff_at TIMESTAMPTZ NOT NULL,
    pay_date DATE NOT NULL,
    status VARCHAR(24) NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, pay_period_id)
);

CREATE TABLE public.pay_element_versions (
    element_version_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
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
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, element_version_id)
);

CREATE TABLE public.pay_formula_versions (
    formula_version_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
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
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, formula_version_id)
);

CREATE TABLE public.pay_formula_dependencies (
    formula_dependency_id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    formula_version_id BIGINT NOT NULL,
    dependency_kind VARCHAR(20) NOT NULL,
    dependency_key VARCHAR(100) NOT NULL,
    dependency_version_public_id UUID,
    UNIQUE (tenant_id, formula_dependency_id)
);

CREATE TABLE public.pay_formula_test_cases (
    formula_test_case_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    formula_version_id BIGINT NOT NULL,
    case_key VARCHAR(120) NOT NULL,
    input_payload JSONB NOT NULL,
    expected_payload JSONB NOT NULL,
    expected_error_code VARCHAR(80),
    evidence_ref VARCHAR(300) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, formula_test_case_id)
);

CREATE TABLE public.pay_rounding_policy_versions (
    rounding_policy_version_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    policy_key VARCHAR(100) NOT NULL,
    version_no INTEGER NOT NULL,
    jurisdiction_code VARCHAR(20),
    status VARCHAR(20) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, rounding_policy_version_id)
);

CREATE TABLE public.pay_worker_element_entries (
    worker_element_entry_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
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
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    updated_by UUID NOT NULL,
    value_type VARCHAR(20) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    number_value NUMERIC(24,8),
    boolean_value BOOLEAN,
    date_value DATE,
    instant_value TIMESTAMPTZ,
    element_version_public_id UUID NOT NULL,
    entry_revision BIGINT NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, worker_element_entry_id)
);

CREATE TABLE public.pay_input_snapshots (
    input_snapshot_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    pay_period_public_id UUID NOT NULL,
    target_revision BIGINT NOT NULL,
    people_projection_revision BIGINT NOT NULL,
    time_handoff_public_id UUID,
    time_close_revision BIGINT,
    rule_set_digest CHAR(64) NOT NULL,
    input_digest CHAR(64),
    worker_count INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    as_of TIMESTAMPTZ NOT NULL,
    source_vector_digest CHAR(64),
    row_version BIGINT NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, input_snapshot_id)
);

CREATE TABLE public.pay_payroll_runs (
    payroll_run_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    pay_period_id BIGINT NOT NULL,
    run_type VARCHAR(20) NOT NULL,
    input_snapshot_id BIGINT,
    supersedes_run_public_id UUID,
    status VARCHAR(24) NOT NULL,
    target_worker_count INTEGER NOT NULL,
    blocking_issue_count INTEGER NOT NULL,
    latest_attempt_no INTEGER NOT NULL,
    approval_case_public_id UUID,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    updated_by UUID NOT NULL,
    finalized_at TIMESTAMPTZ,
    finalized_by UUID,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, payroll_run_id)
);

CREATE TABLE public.pay_payroll_run_workers (
    payroll_run_worker_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    payroll_run_id BIGINT NOT NULL,
    worker_public_id UUID NOT NULL,
    assignment_public_id UUID NOT NULL,
    status VARCHAR(24) NOT NULL,
    inclusion_reason VARCHAR(80) NOT NULL,
    exclusion_code VARCHAR(80),
    input_digest CHAR(64) NOT NULL,
    row_version BIGINT NOT NULL,
    currency_code CHAR(3) NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, payroll_run_worker_id)
);

CREATE TABLE public.pay_payroll_run_attempts (
    payroll_run_attempt_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
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
    row_version BIGINT NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, payroll_run_attempt_id)
);

CREATE TABLE public.pay_worker_results (
    worker_result_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
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
    calculated_at TIMESTAMPTZ NOT NULL,
    assignment_public_id UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, worker_result_id)
);

CREATE TABLE public.pay_result_lines (
    result_line_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
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
    calculated_at TIMESTAMPTZ NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, result_line_id)
);

CREATE TABLE public.pay_calculation_trace_nodes (
    calculation_trace_node_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
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
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, calculation_trace_node_id)
);

CREATE TABLE public.pay_balance_ledger_entries (
    balance_ledger_entry_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
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
    ledger_revision BIGINT NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, balance_ledger_entry_id)
);

CREATE TABLE public.pay_retro_events (
    retro_event_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    worker_public_id UUID NOT NULL,
    source_change_event_public_id UUID NOT NULL,
    affected_from DATE NOT NULL,
    affected_to DATE NOT NULL,
    discovered_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(24) NOT NULL,
    processing_run_public_id UUID,
    source_digest CHAR(64) NOT NULL,
    row_version BIGINT NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, retro_event_id)
);

CREATE TABLE public.pay_reconciliation_issues (
    reconciliation_issue_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
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
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, reconciliation_issue_id)
);

CREATE TABLE public.pay_run_approvals (
    run_approval_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
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
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, run_approval_id)
);

CREATE TABLE public.pay_payment_batches (
    payment_batch_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
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
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    released_at TIMESTAMPTZ,
    released_by UUID,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, payment_batch_id)
);

CREATE TABLE public.pay_payment_instructions (
    payment_instruction_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    payment_batch_id BIGINT NOT NULL,
    worker_public_id UUID NOT NULL,
    bank_token_public_id UUID,
    bank_token_version BIGINT,
    amount NUMERIC(19,4) NOT NULL,
    currency_code CHAR(3) NOT NULL,
    status VARCHAR(24) NOT NULL,
    source_worker_result_public_id UUID NOT NULL,
    instruction_digest CHAR(64) NOT NULL,
    provider_reference VARCHAR(160),
    row_version BIGINT NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, payment_instruction_id)
);

CREATE TABLE public.pay_connector_receipts (
    connector_receipt_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
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
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, connector_receipt_id)
);

CREATE TABLE public.pay_gl_mapping_rule_versions (
    gl_mapping_rule_version_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
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
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, gl_mapping_rule_version_id)
);

CREATE TABLE public.pay_gl_batches (
    gl_batch_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
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
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, gl_batch_id)
);

CREATE TABLE public.pay_gl_lines (
    gl_line_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
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
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, gl_line_id)
);

CREATE TABLE public.pay_payslips (
    payslip_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
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
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, payslip_id)
);

CREATE TABLE public.pay_payslip_access_events (
    payslip_access_event_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    payslip_public_id UUID NOT NULL,
    actor_public_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL,
    purpose_code VARCHAR(80) NOT NULL,
    field_policy_revision BIGINT NOT NULL,
    step_up_session_public_id UUID,
    occurred_at TIMESTAMPTZ NOT NULL,
    correlation_id UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, payslip_access_event_id)
);

CREATE TABLE public.pay_country_pack_versions (
    country_pack_version_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
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
    row_version BIGINT NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, country_pack_version_id)
);

CREATE TABLE public.pay_year_end_cases (
    year_end_case_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
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
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    updated_by UUID NOT NULL,
    basis_version_id BIGINT NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, year_end_case_id)
);

CREATE TABLE public.pay_year_end_evidence (
    year_end_evidence_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
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
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, year_end_evidence_id)
);

CREATE TABLE public.pay_year_end_provider_invocations (
    provider_invocation_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
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
    created_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, provider_invocation_id)
);

CREATE TABLE public.pay_worker_projections (
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

CREATE TABLE public.pay_time_handoff_snapshots (
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
    CONSTRAINT ck_pay_time_handoff_revision CHECK (close_revision > 0 AND ledger_revision_from > 0 AND ledger_revision_to >= ledger_revision_from),
    CONSTRAINT ck_pay_time_handoff_counts CHECK (worker_count >= 0 AND line_count >= 0)
);

CREATE TABLE public.pay_time_handoff_lines (
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
    CONSTRAINT ck_pay_time_handoff_line_no CHECK (line_no > 0),
    CONSTRAINT ck_pay_time_handoff_line_unit CHECK (unit IN ('MINUTE','HOUR','DAY','COUNT','AMOUNT')),
    CONSTRAINT ck_pay_time_handoff_line_currency CHECK (
        (unit = 'AMOUNT' AND currency_code <> 'XXX' AND currency_code ~ '^[A-Z]{3}$')
        OR (unit <> 'AMOUNT' AND currency_code = 'XXX')
    ),
    CONSTRAINT ck_pay_time_handoff_line_sources CHECK (source_entry_count > 0)
);

CREATE TABLE public.pay_time_handoff_ingest_receipts (
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
    CONSTRAINT ck_pay_time_handoff_receipt_status CHECK (status IN ('RECEIVED','VALIDATING','ACCEPTED','REJECTED','QUARANTINED','RESULT_UNKNOWN'))
);

CREATE TABLE public.pay_worker_tax_profiles (
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

CREATE TABLE public.pay_payment_files (
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
    CONSTRAINT ck_pay_payment_file_class CHECK (classification IN ('HIGHLY_RESTRICTED','REGULATED'))
);

CREATE TABLE public.pay_statutory_cases (
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

CREATE TABLE public.pay_command_receipts (
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

CREATE TABLE public.pay_inbox_receipts (
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

CREATE TABLE public.pay_outbox_events (
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

CREATE TABLE public.pay_config_artifact_versions (
    config_artifact_version_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    artifact_kind VARCHAR(30) NOT NULL,
    artifact_key VARCHAR(100) NOT NULL,
    version_no INTEGER NOT NULL,
    payload_table VARCHAR(80) NOT NULL,
    payload_public_id UUID NOT NULL,
    schema_version VARCHAR(80) NOT NULL,
    payload_digest CHAR(64) NOT NULL,
    legal_payroll_entity_public_id UUID,
    pay_group_public_id UUID,
    valid_from DATE NOT NULL,
    valid_to DATE,
    status VARCHAR(24) NOT NULL,
    governance_snapshot_public_id UUID NOT NULL,
    governance_revision BIGINT NOT NULL,
    governance_digest CHAR(64) NOT NULL,
    evaluation_public_id UUID,
    golden_report_public_id UUID,
    approval_binding_public_id UUID,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, config_artifact_version_id)
);

CREATE TABLE public.pay_artifact_revision_counters (
    artifact_revision_counter_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    artifact_kind VARCHAR(30) NOT NULL,
    artifact_key VARCHAR(100) NOT NULL,
    next_version_no INTEGER NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, artifact_revision_counter_id)
);

CREATE TABLE public.pay_calendar_versions (
    calendar_version_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    calendar_key VARCHAR(100) NOT NULL,
    version_no INTEGER NOT NULL,
    periods_payload JSONB NOT NULL,
    payload_digest CHAR(64) NOT NULL,
    time_zone_policy VARCHAR(30) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    status VARCHAR(24) NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, calendar_version_id)
);

CREATE TABLE public.pay_eligibility_policy_versions (
    eligibility_policy_version_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    policy_key VARCHAR(100) NOT NULL,
    version_no INTEGER NOT NULL,
    input_schema JSONB NOT NULL,
    ast_payload JSONB NOT NULL,
    output_type VARCHAR(20) NOT NULL,
    payload_digest CHAR(64) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    status VARCHAR(24) NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, eligibility_policy_version_id)
);

CREATE TABLE public.pay_rounding_policy_stage_rules (
    rounding_policy_stage_rule_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    rounding_policy_version_id BIGINT NOT NULL,
    stage VARCHAR(32) NOT NULL,
    scale INTEGER NOT NULL,
    mode VARCHAR(20) NOT NULL,
    currency_code CHAR(3),
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, rounding_policy_stage_rule_id)
);

CREATE TABLE public.pay_config_evaluations (
    config_evaluation_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    artifact_version_id BIGINT NOT NULL,
    artifact_revision BIGINT NOT NULL,
    input_digest CHAR(64) NOT NULL,
    dependency_vector_digest CHAR(64) NOT NULL,
    status VARCHAR(24) NOT NULL,
    violation_rows JSONB NOT NULL,
    compiled_digest CHAR(64),
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, config_evaluation_id)
);

CREATE TABLE public.pay_config_golden_reports (
    config_golden_report_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    artifact_version_id BIGINT NOT NULL,
    artifact_revision BIGINT NOT NULL,
    engine_version VARCHAR(40) NOT NULL,
    case_results JSONB NOT NULL,
    golden_digest CHAR(64) NOT NULL,
    status VARCHAR(24) NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, config_golden_report_id)
);

CREATE TABLE public.pay_config_approval_bindings (
    config_approval_binding_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    subject_public_id UUID NOT NULL,
    subject_revision BIGINT NOT NULL,
    subject_digest CHAR(64) NOT NULL,
    maker_principal_public_id UUID NOT NULL,
    approval_case_public_id UUID,
    owner_decision_revision BIGINT,
    owner_decision_digest CHAR(64),
    decision VARCHAR(24) NOT NULL,
    decision_actor_public_id UUID,
    decided_at TIMESTAMPTZ,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, config_approval_binding_id)
);

CREATE TABLE public.pay_run_approval_bindings (
    run_approval_binding_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    subject_public_id UUID NOT NULL,
    subject_revision BIGINT NOT NULL,
    subject_digest CHAR(64) NOT NULL,
    maker_principal_public_id UUID NOT NULL,
    approval_case_public_id UUID,
    owner_decision_revision BIGINT,
    owner_decision_digest CHAR(64),
    decision VARCHAR(24) NOT NULL,
    decision_actor_public_id UUID,
    decided_at TIMESTAMPTZ,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, run_approval_binding_id)
);

CREATE TABLE public.pay_payment_approval_bindings (
    payment_approval_binding_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    subject_public_id UUID NOT NULL,
    subject_revision BIGINT NOT NULL,
    subject_digest CHAR(64) NOT NULL,
    maker_principal_public_id UUID NOT NULL,
    approval_case_public_id UUID,
    owner_decision_revision BIGINT,
    owner_decision_digest CHAR(64),
    decision VARCHAR(24) NOT NULL,
    decision_actor_public_id UUID,
    decided_at TIMESTAMPTZ,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, payment_approval_binding_id)
);

CREATE TABLE public.pay_gl_approval_bindings (
    gl_approval_binding_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    subject_public_id UUID NOT NULL,
    subject_revision BIGINT NOT NULL,
    subject_digest CHAR(64) NOT NULL,
    maker_principal_public_id UUID NOT NULL,
    approval_case_public_id UUID,
    owner_decision_revision BIGINT,
    owner_decision_digest CHAR(64),
    decision VARCHAR(24) NOT NULL,
    decision_actor_public_id UUID,
    decided_at TIMESTAMPTZ,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, gl_approval_binding_id)
);

CREATE TABLE public.pay_case_approval_bindings (
    case_approval_binding_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    subject_public_id UUID NOT NULL,
    subject_revision BIGINT NOT NULL,
    subject_digest CHAR(64) NOT NULL,
    maker_principal_public_id UUID NOT NULL,
    approval_case_public_id UUID,
    owner_decision_revision BIGINT,
    owner_decision_digest CHAR(64),
    decision VARCHAR(24) NOT NULL,
    decision_actor_public_id UUID,
    decided_at TIMESTAMPTZ,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, case_approval_binding_id)
);

CREATE TABLE public.pay_group_memberships (
    group_membership_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    pay_group_id BIGINT NOT NULL,
    worker_public_id UUID NOT NULL,
    assignment_public_id UUID NOT NULL,
    workforce_snapshot_public_id UUID NOT NULL,
    workforce_revision BIGINT NOT NULL,
    workforce_digest CHAR(64) NOT NULL,
    eligibility_evaluation_public_id UUID NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    membership_revision BIGINT NOT NULL,
    status VARCHAR(24) NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, group_membership_id)
);

CREATE TABLE public.pay_membership_revision_counters (
    membership_revision_counter_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    pay_group_id BIGINT NOT NULL,
    next_revision BIGINT NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, membership_revision_counter_id)
);

CREATE TABLE public.pay_period_lock_bindings (
    period_lock_binding_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    pay_period_id BIGINT NOT NULL,
    lock_revision BIGINT NOT NULL,
    entry_watermark BIGINT NOT NULL,
    membership_revision BIGINT NOT NULL,
    actor_principal_public_id UUID NOT NULL,
    approval_snapshot_public_id UUID,
    status VARCHAR(24) NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, period_lock_binding_id)
);

CREATE TABLE public.pay_worker_entry_correction_links (
    worker_entry_correction_link_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    original_entry_id BIGINT NOT NULL,
    replacement_entry_id BIGINT NOT NULL,
    reason_code VARCHAR(240) NOT NULL,
    original_digest CHAR(64) NOT NULL,
    replacement_digest CHAR(64) NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, worker_entry_correction_link_id)
);

CREATE TABLE public.pay_input_source_vectors (
    input_source_vector_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    input_snapshot_id BIGINT NOT NULL,
    source_kind VARCHAR(40) NOT NULL,
    owner_session VARCHAR(20) NOT NULL,
    contract_ref VARCHAR(160) NOT NULL,
    owner_object_public_id UUID NOT NULL,
    owner_revision BIGINT NOT NULL,
    schema_version VARCHAR(80) NOT NULL,
    as_of TIMESTAMPTZ NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    payload_digest CHAR(64) NOT NULL,
    line_count INTEGER NOT NULL,
    ingest_receipt_public_id UUID NOT NULL,
    field_set_version VARCHAR(80) NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, input_source_vector_id)
);

CREATE TABLE public.pay_input_source_ingest_receipts (
    input_source_ingest_receipt_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    input_snapshot_id BIGINT NOT NULL,
    contract_ref VARCHAR(160) NOT NULL,
    owner_object_public_id UUID NOT NULL,
    owner_revision BIGINT NOT NULL,
    expected_digest CHAR(64) NOT NULL,
    actual_digest CHAR(64),
    expected_line_count INTEGER,
    actual_line_count INTEGER,
    status VARCHAR(24) NOT NULL,
    reason_code VARCHAR(80),
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, input_source_ingest_receipt_id)
);

CREATE TABLE public.pay_owner_snapshot_payloads (
    owner_snapshot_payload_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    ingest_receipt_id BIGINT NOT NULL,
    contract_ref VARCHAR(160) NOT NULL,
    schema_version VARCHAR(80) NOT NULL,
    payload_digest CHAR(64) NOT NULL,
    protected_object_ref UUID,
    public_payload JSONB,
    field_set_version VARCHAR(80) NOT NULL,
    retention_policy_public_id UUID NOT NULL,
    verified_at TIMESTAMPTZ NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, owner_snapshot_payload_id)
);

CREATE TABLE public.pay_run_attempt_counters (
    run_attempt_counter_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    payroll_run_id BIGINT NOT NULL,
    next_attempt_no INTEGER NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, run_attempt_counter_id)
);

CREATE TABLE public.pay_attempt_fences (
    attempt_fence_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    attempt_id BIGINT NOT NULL,
    fence_no BIGINT NOT NULL,
    lease_token UUID NOT NULL,
    workload_id VARCHAR(120) NOT NULL,
    lease_expires_at TIMESTAMPTZ NOT NULL,
    last_heartbeat_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(24) NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, attempt_fence_id)
);

CREATE TABLE public.pay_result_staging_manifests (
    result_staging_manifest_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    attempt_id BIGINT NOT NULL,
    fence_no BIGINT NOT NULL,
    input_digest CHAR(64) NOT NULL,
    result_digest CHAR(64) NOT NULL,
    worker_count INTEGER NOT NULL,
    line_count INTEGER NOT NULL,
    staged_artifact_public_id UUID NOT NULL,
    status VARCHAR(24) NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, result_staging_manifest_id)
);

CREATE TABLE public.pay_run_validation_reports (
    run_validation_report_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    payroll_run_id BIGINT NOT NULL,
    attempt_id BIGINT NOT NULL,
    input_digest CHAR(64) NOT NULL,
    result_digest CHAR(64) NOT NULL,
    control_totals JSONB NOT NULL,
    target_dispositions JSONB NOT NULL,
    blocking_issue_count INTEGER NOT NULL,
    status VARCHAR(24) NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, run_validation_report_id)
);

CREATE TABLE public.pay_run_finalization_receipts (
    run_finalization_receipt_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    payroll_run_id BIGINT NOT NULL,
    attempt_id BIGINT NOT NULL,
    run_revision BIGINT NOT NULL,
    input_digest CHAR(64) NOT NULL,
    result_digest CHAR(64) NOT NULL,
    validation_report_id BIGINT NOT NULL,
    approval_binding_id BIGINT NOT NULL,
    balance_watermark BIGINT NOT NULL,
    audit_bundle_digest CHAR(64) NOT NULL,
    finalized_at TIMESTAMPTZ NOT NULL,
    finalized_by UUID NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, run_finalization_receipt_id)
);

CREATE TABLE public.pay_run_successor_links (
    run_successor_link_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    original_public_id UUID NOT NULL,
    successor_public_id UUID NOT NULL,
    successor_kind VARCHAR(40) NOT NULL,
    reason_code VARCHAR(240) NOT NULL,
    original_digest CHAR(64) NOT NULL,
    successor_basis_digest CHAR(64) NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, run_successor_link_id)
);

CREATE TABLE public.pay_case_successor_links (
    case_successor_link_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    original_public_id UUID NOT NULL,
    successor_public_id UUID NOT NULL,
    successor_kind VARCHAR(40) NOT NULL,
    reason_code VARCHAR(240) NOT NULL,
    original_digest CHAR(64) NOT NULL,
    successor_basis_digest CHAR(64) NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, case_successor_link_id)
);

CREATE TABLE public.pay_run_reopen_requests (
    run_reopen_request_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    original_run_id BIGINT NOT NULL,
    approval_snapshot_public_id UUID NOT NULL,
    approval_revision BIGINT NOT NULL,
    approval_digest CHAR(64) NOT NULL,
    successor_run_public_id UUID NOT NULL,
    reason_code VARCHAR(240) NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, run_reopen_request_id)
);

CREATE TABLE public.pay_correction_basis_links (
    correction_basis_link_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    original_final_run_id BIGINT NOT NULL,
    successor_run_id BIGINT NOT NULL,
    original_finalization_receipt_id BIGINT NOT NULL,
    correction_kind VARCHAR(40) NOT NULL,
    basis_digest CHAR(64) NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, correction_basis_link_id)
);

CREATE TABLE public.pay_settlement_invocations (
    settlement_invocation_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    subject_public_id UUID NOT NULL,
    invocation_kind VARCHAR(20) NOT NULL,
    connection_public_id UUID,
    logical_command_public_id UUID NOT NULL,
    idempotency_key VARCHAR(160) NOT NULL,
    request_digest CHAR(64) NOT NULL,
    payload_digest CHAR(64) NOT NULL,
    status VARCHAR(24) NOT NULL,
    provider_reference VARCHAR(160),
    sent_at TIMESTAMPTZ,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, settlement_invocation_id)
);

CREATE TABLE public.pay_settlement_receipts (
    settlement_receipt_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    invocation_public_id UUID,
    subject_public_id UUID NOT NULL,
    receipt_kind VARCHAR(20) NOT NULL,
    owner_receipt_public_id UUID NOT NULL,
    owner_revision BIGINT NOT NULL,
    owner_payload_digest CHAR(64) NOT NULL,
    status VARCHAR(24) NOT NULL,
    settled_amount NUMERIC(19,4),
    currency_code CHAR(3),
    effective_at TIMESTAMPTZ NOT NULL,
    evidence_object_ref UUID,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, settlement_receipt_id)
);

CREATE TABLE public.pay_payment_reversal_links (
    payment_reversal_link_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    original_batch_id BIGINT NOT NULL,
    successor_batch_id BIGINT NOT NULL,
    original_receipt_public_id UUID NOT NULL,
    reason_code VARCHAR(240) NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, payment_reversal_link_id)
);

CREATE TABLE public.pay_gl_reversal_links (
    gl_reversal_link_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    original_batch_id BIGINT NOT NULL,
    successor_batch_id BIGINT NOT NULL,
    original_receipt_public_id UUID NOT NULL,
    reason_code VARCHAR(240) NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, gl_reversal_link_id)
);

CREATE TABLE public.pay_issue_resolution_events (
    issue_resolution_event_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    issue_id BIGINT NOT NULL,
    original_issue_revision BIGINT NOT NULL,
    resolution_code VARCHAR(80) NOT NULL,
    evidence_snapshot_public_id UUID NOT NULL,
    evidence_revision BIGINT NOT NULL,
    evidence_digest CHAR(64) NOT NULL,
    reason_code VARCHAR(240) NOT NULL,
    actor_principal_public_id UUID NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, issue_resolution_event_id)
);

CREATE TABLE public.pay_retirement_basis_versions (
    retirement_basis_version_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    worker_public_id UUID NOT NULL,
    legal_payroll_entity_public_id UUID NOT NULL,
    version_no INTEGER NOT NULL,
    basis_payload JSONB NOT NULL,
    payload_digest CHAR(64) NOT NULL,
    currency_code CHAR(3) NOT NULL,
    as_of TIMESTAMPTZ NOT NULL,
    effective_date DATE NOT NULL,
    status VARCHAR(24) NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, retirement_basis_version_id)
);

CREATE TABLE public.pay_retirement_basis_source_refs (
    retirement_basis_source_ref_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    basis_version_id BIGINT NOT NULL,
    source_kind VARCHAR(40) NOT NULL,
    contract_ref VARCHAR(160) NOT NULL,
    source_public_id UUID NOT NULL,
    source_revision BIGINT NOT NULL,
    payload_digest CHAR(64) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    line_count INTEGER NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, retirement_basis_source_ref_id)
);

CREATE TABLE public.pay_year_end_basis_versions (
    year_end_basis_version_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    worker_public_id UUID NOT NULL,
    legal_payroll_entity_public_id UUID NOT NULL,
    version_no INTEGER NOT NULL,
    basis_payload JSONB NOT NULL,
    payload_digest CHAR(64) NOT NULL,
    currency_code CHAR(3) NOT NULL,
    as_of TIMESTAMPTZ NOT NULL,
    effective_date DATE NOT NULL,
    status VARCHAR(24) NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, year_end_basis_version_id)
);

CREATE TABLE public.pay_year_end_basis_source_refs (
    year_end_basis_source_ref_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    basis_version_id BIGINT NOT NULL,
    source_kind VARCHAR(40) NOT NULL,
    contract_ref VARCHAR(160) NOT NULL,
    source_public_id UUID NOT NULL,
    source_revision BIGINT NOT NULL,
    payload_digest CHAR(64) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    line_count INTEGER NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, year_end_basis_source_ref_id)
);

CREATE TABLE public.pay_retirement_cases (
    retirement_case_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    basis_version_id BIGINT NOT NULL,
    worker_public_id UUID NOT NULL,
    case_kind VARCHAR(40) NOT NULL,
    effective_date DATE NOT NULL,
    status VARCHAR(24) NOT NULL,
    latest_output_public_id UUID,
    approval_binding_public_id UUID,
    posting_run_public_id UUID,
    supersedes_case_public_id UUID,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, retirement_case_id)
);

CREATE TABLE public.pay_case_validation_reports (
    case_validation_report_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    case_kind VARCHAR(20) NOT NULL,
    case_public_id UUID NOT NULL,
    case_revision BIGINT NOT NULL,
    basis_digest CHAR(64) NOT NULL,
    eligibility_artifact_public_id UUID,
    status VARCHAR(24) NOT NULL,
    violation_rows JSONB NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, case_validation_report_id)
);

CREATE TABLE public.pay_case_outputs (
    case_output_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    case_kind VARCHAR(20) NOT NULL,
    case_public_id UUID NOT NULL,
    basis_public_id UUID NOT NULL,
    basis_digest CHAR(64) NOT NULL,
    country_pack_public_id UUID,
    provider_invocation_public_id UUID,
    currency_code CHAR(3) NOT NULL,
    gross_amount NUMERIC(19,4) NOT NULL,
    withholding_amount NUMERIC(19,4) NOT NULL,
    net_amount NUMERIC(19,4) NOT NULL,
    line_count INTEGER NOT NULL,
    payload_digest CHAR(64) NOT NULL,
    supersedes_output_public_id UUID,
    statutory_approved BOOLEAN NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, case_output_id)
);

CREATE TABLE public.pay_case_output_lines (
    case_output_line_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    case_output_id BIGINT NOT NULL,
    line_no INTEGER NOT NULL,
    component_code VARCHAR(80) NOT NULL,
    amount NUMERIC(19,4) NOT NULL,
    currency_code CHAR(3) NOT NULL,
    source_basis_line_refs JSONB NOT NULL,
    formula_artifact_public_id UUID NOT NULL,
    trace_public_id UUID NOT NULL,
    line_digest CHAR(64) NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, case_output_line_id)
);

CREATE TABLE public.pay_case_posting_links (
    case_posting_link_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    case_public_id UUID NOT NULL,
    case_output_id BIGINT NOT NULL,
    approval_binding_id BIGINT NOT NULL,
    posting_run_id BIGINT NOT NULL,
    basis_digest CHAR(64) NOT NULL,
    output_digest CHAR(64) NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, case_posting_link_id)
);

CREATE TABLE public.pay_artifact_effective_publications (
    artifact_effective_publication_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    artifact_version_id BIGINT NOT NULL,
    artifact_kind VARCHAR(30) NOT NULL,
    artifact_key VARCHAR(100) NOT NULL,
    scope_digest CHAR(64) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    published_at TIMESTAMPTZ NOT NULL,
    publisher_principal_public_id UUID NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, artifact_effective_publication_id)
);

CREATE TABLE public.pay_approval_cancellation_requests (
    approval_cancellation_request_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    subject_kind VARCHAR(30) NOT NULL,
    subject_public_id UUID NOT NULL,
    approval_binding_public_id UUID NOT NULL,
    owner_request_public_id UUID,
    owner_result_digest CHAR(64),
    status VARCHAR(24) NOT NULL,
    reason_code VARCHAR(240) NOT NULL,
    row_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, approval_cancellation_request_id)
);

CREATE TABLE public.pay_source_invalidation_facts (
    source_invalidation_fact_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL,
    tenant_id BIGINT NOT NULL,
    input_snapshot_id BIGINT NOT NULL,
    source_object_public_id UUID NOT NULL,
    source_revision BIGINT NOT NULL,
    owner_change_snapshot_public_id UUID NOT NULL,
    owner_change_digest CHAR(64) NOT NULL,
    change_kind VARCHAR(40) NOT NULL,
    effect VARCHAR(30) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    recorded_by UUID NOT NULL,
    UNIQUE (tenant_id, public_id),
    UNIQUE (tenant_id, source_invalidation_fact_id)
);

CREATE TABLE public.pay_input_revision_counters (
    input_revision_counter_id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    revision_kind VARCHAR(20) NOT NULL,
    next_revision BIGINT NOT NULL,
    UNIQUE (tenant_id, input_revision_counter_id)
);

ALTER TABLE public.pay_pay_groups ADD CONSTRAINT pay_v2_fk_1 FOREIGN KEY (tenant_id, legal_payroll_entity_id) REFERENCES public.pay_legal_payroll_entities (tenant_id, legal_payroll_entity_id);

ALTER TABLE public.pay_pay_periods ADD CONSTRAINT pay_v2_fk_2 FOREIGN KEY (tenant_id, pay_group_id) REFERENCES public.pay_pay_groups (tenant_id, pay_group_id);

ALTER TABLE public.pay_formula_dependencies ADD CONSTRAINT pay_v2_fk_3 FOREIGN KEY (tenant_id, formula_version_id) REFERENCES public.pay_formula_versions (tenant_id, formula_version_id);

ALTER TABLE public.pay_formula_test_cases ADD CONSTRAINT pay_v2_fk_4 FOREIGN KEY (tenant_id, formula_version_id) REFERENCES public.pay_formula_versions (tenant_id, formula_version_id);

ALTER TABLE public.pay_input_snapshots ADD CONSTRAINT pay_v2_fk_5 FOREIGN KEY (tenant_id, time_handoff_public_id) REFERENCES public.pay_time_handoff_snapshots (tenant_id, public_id);

ALTER TABLE public.pay_payroll_runs ADD CONSTRAINT pay_v2_fk_6 FOREIGN KEY (tenant_id, pay_period_id) REFERENCES public.pay_pay_periods (tenant_id, pay_period_id);

ALTER TABLE public.pay_payroll_runs ADD CONSTRAINT pay_v2_fk_7 FOREIGN KEY (tenant_id, input_snapshot_id) REFERENCES public.pay_input_snapshots (tenant_id, input_snapshot_id);

ALTER TABLE public.pay_payroll_runs ADD CONSTRAINT pay_v2_fk_8 FOREIGN KEY (tenant_id, supersedes_run_public_id) REFERENCES public.pay_payroll_runs (tenant_id, public_id);

ALTER TABLE public.pay_payroll_run_workers ADD CONSTRAINT pay_v2_fk_9 FOREIGN KEY (tenant_id, payroll_run_id) REFERENCES public.pay_payroll_runs (tenant_id, payroll_run_id);

ALTER TABLE public.pay_payroll_run_attempts ADD CONSTRAINT pay_v2_fk_10 FOREIGN KEY (tenant_id, payroll_run_id) REFERENCES public.pay_payroll_runs (tenant_id, payroll_run_id);

ALTER TABLE public.pay_worker_results ADD CONSTRAINT pay_v2_fk_11 FOREIGN KEY (tenant_id, payroll_run_attempt_id) REFERENCES public.pay_payroll_run_attempts (tenant_id, payroll_run_attempt_id);

ALTER TABLE public.pay_result_lines ADD CONSTRAINT pay_v2_fk_12 FOREIGN KEY (tenant_id, worker_result_public_id) REFERENCES public.pay_worker_results (tenant_id, public_id);

ALTER TABLE public.pay_result_lines ADD CONSTRAINT pay_v2_fk_13 FOREIGN KEY (tenant_id, element_version_public_id) REFERENCES public.pay_element_versions (tenant_id, public_id);

ALTER TABLE public.pay_result_lines ADD CONSTRAINT pay_v2_fk_14 FOREIGN KEY (tenant_id, reverses_line_public_id) REFERENCES public.pay_result_lines (tenant_id, public_id);

ALTER TABLE public.pay_calculation_trace_nodes ADD CONSTRAINT pay_v2_fk_15 FOREIGN KEY (tenant_id, payroll_run_attempt_public_id) REFERENCES public.pay_payroll_run_attempts (tenant_id, public_id);

ALTER TABLE public.pay_calculation_trace_nodes ADD CONSTRAINT pay_v2_fk_16 FOREIGN KEY (tenant_id, parent_node_public_id) REFERENCES public.pay_calculation_trace_nodes (tenant_id, public_id);

ALTER TABLE public.pay_balance_ledger_entries ADD CONSTRAINT pay_v2_fk_17 FOREIGN KEY (tenant_id, source_result_line_public_id) REFERENCES public.pay_result_lines (tenant_id, public_id);

ALTER TABLE public.pay_balance_ledger_entries ADD CONSTRAINT pay_v2_fk_18 FOREIGN KEY (tenant_id, reverses_entry_public_id) REFERENCES public.pay_balance_ledger_entries (tenant_id, public_id);

ALTER TABLE public.pay_run_approvals ADD CONSTRAINT pay_v2_fk_19 FOREIGN KEY (tenant_id, payroll_run_id) REFERENCES public.pay_payroll_runs (tenant_id, payroll_run_id);

ALTER TABLE public.pay_payment_batches ADD CONSTRAINT pay_v2_fk_20 FOREIGN KEY (tenant_id, payroll_run_id) REFERENCES public.pay_payroll_runs (tenant_id, payroll_run_id);

ALTER TABLE public.pay_payment_instructions ADD CONSTRAINT pay_v2_fk_21 FOREIGN KEY (tenant_id, payment_batch_id) REFERENCES public.pay_payment_batches (tenant_id, payment_batch_id);

ALTER TABLE public.pay_payment_instructions ADD CONSTRAINT pay_v2_fk_22 FOREIGN KEY (tenant_id, source_worker_result_public_id) REFERENCES public.pay_worker_results (tenant_id, public_id);

ALTER TABLE public.pay_gl_batches ADD CONSTRAINT pay_v2_fk_23 FOREIGN KEY (tenant_id, payroll_run_id) REFERENCES public.pay_payroll_runs (tenant_id, payroll_run_id);

ALTER TABLE public.pay_gl_lines ADD CONSTRAINT pay_v2_fk_24 FOREIGN KEY (tenant_id, gl_batch_id) REFERENCES public.pay_gl_batches (tenant_id, gl_batch_id);

ALTER TABLE public.pay_gl_lines ADD CONSTRAINT pay_v2_fk_25 FOREIGN KEY (tenant_id, source_result_line_public_id) REFERENCES public.pay_result_lines (tenant_id, public_id);

ALTER TABLE public.pay_payslips ADD CONSTRAINT pay_v2_fk_26 FOREIGN KEY (tenant_id, payroll_run_id) REFERENCES public.pay_payroll_runs (tenant_id, payroll_run_id);

ALTER TABLE public.pay_payslips ADD CONSTRAINT pay_v2_fk_27 FOREIGN KEY (tenant_id, worker_result_public_id) REFERENCES public.pay_worker_results (tenant_id, public_id);

ALTER TABLE public.pay_payslip_access_events ADD CONSTRAINT pay_v2_fk_28 FOREIGN KEY (tenant_id, payslip_public_id) REFERENCES public.pay_payslips (tenant_id, public_id);

ALTER TABLE public.pay_year_end_cases ADD CONSTRAINT pay_v2_fk_29 FOREIGN KEY (tenant_id, basis_version_id) REFERENCES public.pay_year_end_basis_versions (tenant_id, year_end_basis_version_id);

ALTER TABLE public.pay_year_end_evidence ADD CONSTRAINT pay_v2_fk_30 FOREIGN KEY (tenant_id, year_end_case_id) REFERENCES public.pay_year_end_cases (tenant_id, year_end_case_id);

ALTER TABLE public.pay_year_end_provider_invocations ADD CONSTRAINT pay_v2_fk_31 FOREIGN KEY (tenant_id, year_end_case_id) REFERENCES public.pay_year_end_cases (tenant_id, year_end_case_id);

ALTER TABLE public.pay_time_handoff_snapshots ADD CONSTRAINT pay_v2_fk_32 FOREIGN KEY (tenant_id, supersedes_snapshot_public_id) REFERENCES public.pay_time_handoff_snapshots (tenant_id, public_id);

ALTER TABLE public.pay_time_handoff_lines ADD CONSTRAINT pay_v2_fk_33 FOREIGN KEY (tenant_id, time_handoff_snapshot_id) REFERENCES public.pay_time_handoff_snapshots (tenant_id, time_handoff_snapshot_id);

ALTER TABLE public.pay_time_handoff_ingest_receipts ADD CONSTRAINT pay_v2_fk_34 FOREIGN KEY (tenant_id, time_handoff_snapshot_id) REFERENCES public.pay_time_handoff_snapshots (tenant_id, time_handoff_snapshot_id);

ALTER TABLE public.pay_payment_files ADD CONSTRAINT pay_v2_fk_35 FOREIGN KEY (tenant_id, payment_batch_id) REFERENCES public.pay_payment_batches (tenant_id, payment_batch_id);

ALTER TABLE public.pay_rounding_policy_stage_rules ADD CONSTRAINT pay_v2_fk_36 FOREIGN KEY (tenant_id, rounding_policy_version_id) REFERENCES public.pay_rounding_policy_versions (tenant_id, rounding_policy_version_id);

ALTER TABLE public.pay_config_evaluations ADD CONSTRAINT pay_v2_fk_37 FOREIGN KEY (tenant_id, artifact_version_id) REFERENCES public.pay_config_artifact_versions (tenant_id, config_artifact_version_id);

ALTER TABLE public.pay_config_golden_reports ADD CONSTRAINT pay_v2_fk_38 FOREIGN KEY (tenant_id, artifact_version_id) REFERENCES public.pay_config_artifact_versions (tenant_id, config_artifact_version_id);

ALTER TABLE public.pay_group_memberships ADD CONSTRAINT pay_v2_fk_39 FOREIGN KEY (tenant_id, pay_group_id) REFERENCES public.pay_pay_groups (tenant_id, pay_group_id);

ALTER TABLE public.pay_membership_revision_counters ADD CONSTRAINT pay_v2_fk_40 FOREIGN KEY (tenant_id, pay_group_id) REFERENCES public.pay_pay_groups (tenant_id, pay_group_id);

ALTER TABLE public.pay_period_lock_bindings ADD CONSTRAINT pay_v2_fk_41 FOREIGN KEY (tenant_id, pay_period_id) REFERENCES public.pay_pay_periods (tenant_id, pay_period_id);

ALTER TABLE public.pay_worker_entry_correction_links ADD CONSTRAINT pay_v2_fk_42 FOREIGN KEY (tenant_id, original_entry_id) REFERENCES public.pay_worker_element_entries (tenant_id, worker_element_entry_id);

ALTER TABLE public.pay_worker_entry_correction_links ADD CONSTRAINT pay_v2_fk_43 FOREIGN KEY (tenant_id, replacement_entry_id) REFERENCES public.pay_worker_element_entries (tenant_id, worker_element_entry_id);

ALTER TABLE public.pay_input_source_vectors ADD CONSTRAINT pay_v2_fk_44 FOREIGN KEY (tenant_id, input_snapshot_id) REFERENCES public.pay_input_snapshots (tenant_id, input_snapshot_id);

ALTER TABLE public.pay_input_source_ingest_receipts ADD CONSTRAINT pay_v2_fk_45 FOREIGN KEY (tenant_id, input_snapshot_id) REFERENCES public.pay_input_snapshots (tenant_id, input_snapshot_id);

ALTER TABLE public.pay_owner_snapshot_payloads ADD CONSTRAINT pay_v2_fk_46 FOREIGN KEY (tenant_id, ingest_receipt_id) REFERENCES public.pay_input_source_ingest_receipts (tenant_id, input_source_ingest_receipt_id);

ALTER TABLE public.pay_run_attempt_counters ADD CONSTRAINT pay_v2_fk_47 FOREIGN KEY (tenant_id, payroll_run_id) REFERENCES public.pay_payroll_runs (tenant_id, payroll_run_id);

ALTER TABLE public.pay_attempt_fences ADD CONSTRAINT pay_v2_fk_48 FOREIGN KEY (tenant_id, attempt_id) REFERENCES public.pay_payroll_run_attempts (tenant_id, payroll_run_attempt_id);

ALTER TABLE public.pay_result_staging_manifests ADD CONSTRAINT pay_v2_fk_49 FOREIGN KEY (tenant_id, attempt_id) REFERENCES public.pay_payroll_run_attempts (tenant_id, payroll_run_attempt_id);

ALTER TABLE public.pay_run_validation_reports ADD CONSTRAINT pay_v2_fk_50 FOREIGN KEY (tenant_id, payroll_run_id) REFERENCES public.pay_payroll_runs (tenant_id, payroll_run_id);

ALTER TABLE public.pay_run_validation_reports ADD CONSTRAINT pay_v2_fk_51 FOREIGN KEY (tenant_id, attempt_id) REFERENCES public.pay_payroll_run_attempts (tenant_id, payroll_run_attempt_id);

ALTER TABLE public.pay_run_finalization_receipts ADD CONSTRAINT pay_v2_fk_52 FOREIGN KEY (tenant_id, payroll_run_id) REFERENCES public.pay_payroll_runs (tenant_id, payroll_run_id);

ALTER TABLE public.pay_run_finalization_receipts ADD CONSTRAINT pay_v2_fk_53 FOREIGN KEY (tenant_id, attempt_id) REFERENCES public.pay_payroll_run_attempts (tenant_id, payroll_run_attempt_id);

ALTER TABLE public.pay_run_finalization_receipts ADD CONSTRAINT pay_v2_fk_54 FOREIGN KEY (tenant_id, validation_report_id) REFERENCES public.pay_run_validation_reports (tenant_id, run_validation_report_id);

ALTER TABLE public.pay_run_finalization_receipts ADD CONSTRAINT pay_v2_fk_55 FOREIGN KEY (tenant_id, approval_binding_id) REFERENCES public.pay_run_approval_bindings (tenant_id, run_approval_binding_id);

ALTER TABLE public.pay_run_reopen_requests ADD CONSTRAINT pay_v2_fk_56 FOREIGN KEY (tenant_id, original_run_id) REFERENCES public.pay_payroll_runs (tenant_id, payroll_run_id);

ALTER TABLE public.pay_correction_basis_links ADD CONSTRAINT pay_v2_fk_57 FOREIGN KEY (tenant_id, original_final_run_id) REFERENCES public.pay_payroll_runs (tenant_id, payroll_run_id);

ALTER TABLE public.pay_correction_basis_links ADD CONSTRAINT pay_v2_fk_58 FOREIGN KEY (tenant_id, successor_run_id) REFERENCES public.pay_payroll_runs (tenant_id, payroll_run_id);

ALTER TABLE public.pay_correction_basis_links ADD CONSTRAINT pay_v2_fk_59 FOREIGN KEY (tenant_id, original_finalization_receipt_id) REFERENCES public.pay_run_finalization_receipts (tenant_id, run_finalization_receipt_id);

ALTER TABLE public.pay_payment_reversal_links ADD CONSTRAINT pay_v2_fk_60 FOREIGN KEY (tenant_id, original_batch_id) REFERENCES public.pay_payment_batches (tenant_id, payment_batch_id);

ALTER TABLE public.pay_payment_reversal_links ADD CONSTRAINT pay_v2_fk_61 FOREIGN KEY (tenant_id, successor_batch_id) REFERENCES public.pay_payment_batches (tenant_id, payment_batch_id);

ALTER TABLE public.pay_gl_reversal_links ADD CONSTRAINT pay_v2_fk_62 FOREIGN KEY (tenant_id, original_batch_id) REFERENCES public.pay_gl_batches (tenant_id, gl_batch_id);

ALTER TABLE public.pay_gl_reversal_links ADD CONSTRAINT pay_v2_fk_63 FOREIGN KEY (tenant_id, successor_batch_id) REFERENCES public.pay_gl_batches (tenant_id, gl_batch_id);

ALTER TABLE public.pay_issue_resolution_events ADD CONSTRAINT pay_v2_fk_64 FOREIGN KEY (tenant_id, issue_id) REFERENCES public.pay_reconciliation_issues (tenant_id, reconciliation_issue_id);

ALTER TABLE public.pay_retirement_basis_source_refs ADD CONSTRAINT pay_v2_fk_65 FOREIGN KEY (tenant_id, basis_version_id) REFERENCES public.pay_retirement_basis_versions (tenant_id, retirement_basis_version_id);

ALTER TABLE public.pay_year_end_basis_source_refs ADD CONSTRAINT pay_v2_fk_66 FOREIGN KEY (tenant_id, basis_version_id) REFERENCES public.pay_year_end_basis_versions (tenant_id, year_end_basis_version_id);

ALTER TABLE public.pay_retirement_cases ADD CONSTRAINT pay_v2_fk_67 FOREIGN KEY (tenant_id, basis_version_id) REFERENCES public.pay_retirement_basis_versions (tenant_id, retirement_basis_version_id);

ALTER TABLE public.pay_case_output_lines ADD CONSTRAINT pay_v2_fk_68 FOREIGN KEY (tenant_id, case_output_id) REFERENCES public.pay_case_outputs (tenant_id, case_output_id);

ALTER TABLE public.pay_case_posting_links ADD CONSTRAINT pay_v2_fk_69 FOREIGN KEY (tenant_id, case_output_id) REFERENCES public.pay_case_outputs (tenant_id, case_output_id);

ALTER TABLE public.pay_case_posting_links ADD CONSTRAINT pay_v2_fk_70 FOREIGN KEY (tenant_id, approval_binding_id) REFERENCES public.pay_case_approval_bindings (tenant_id, case_approval_binding_id);

ALTER TABLE public.pay_case_posting_links ADD CONSTRAINT pay_v2_fk_71 FOREIGN KEY (tenant_id, posting_run_id) REFERENCES public.pay_payroll_runs (tenant_id, payroll_run_id);

ALTER TABLE public.pay_artifact_effective_publications ADD CONSTRAINT pay_v2_fk_72 FOREIGN KEY (tenant_id, artifact_version_id) REFERENCES public.pay_config_artifact_versions (tenant_id, config_artifact_version_id);

ALTER TABLE public.pay_source_invalidation_facts ADD CONSTRAINT pay_v2_fk_73 FOREIGN KEY (tenant_id, input_snapshot_id) REFERENCES public.pay_input_snapshots (tenant_id, input_snapshot_id);

ALTER TABLE public.pay_config_artifact_versions ADD CONSTRAINT pay_v2_state_pay_config_artifact_versions CHECK (status IN ('DRAFT','VALIDATION_FAILED','VALIDATED','APPROVAL_PENDING','APPROVED','REJECTED','PUBLISHED','RETIRED','CANCELLED'));

ALTER TABLE public.pay_payroll_runs ADD CONSTRAINT pay_v2_state_pay_payroll_runs CHECK (status IN ('PREPARING','READY','CALCULATING','CALCULATED','VALIDATION_FAILED','VALIDATED','APPROVAL_PENDING','APPROVED','FINALIZED','FAILED','RESULT_UNKNOWN','INPUT_INVALIDATED','SUPERSEDED','CANCELLED'));

ALTER TABLE public.pay_payroll_run_attempts ADD CONSTRAINT pay_v2_state_pay_payroll_run_attempts CHECK (status IN ('QUEUED','RUNNING','SUCCEEDED','FAILED','RESULT_UNKNOWN'));

ALTER TABLE public.pay_payment_batches ADD CONSTRAINT pay_v2_state_pay_payment_batches CHECK (status IN ('DRAFT','VALIDATED','APPROVAL_PENDING','APPROVED','RELEASED','ACKNOWLEDGED','REJECTED','RESULT_UNKNOWN','PARTIALLY_ACKNOWLEDGED','MANUALLY_RECORDED','CANCELLED'));

ALTER TABLE public.pay_gl_batches ADD CONSTRAINT pay_v2_state_pay_gl_batches CHECK (status IN ('DRAFT','BALANCED','APPROVAL_PENDING','APPROVED','SENT','POSTED','REJECTED','RESULT_UNKNOWN','NATIVE_POSTED','CANCELLED'));

ALTER TABLE public.pay_retirement_cases ADD CONSTRAINT pay_v2_state_pay_retirement_cases CHECK (status IN ('OPEN','VALIDATED','VALIDATION_FAILED','CALCULATED','REVIEWED','POSTED','CANCELLED'));

ALTER TABLE public.pay_year_end_cases ADD CONSTRAINT pay_v2_state_pay_year_end_cases CHECK (status IN ('COLLECTING','READY','VALIDATION_FAILED','SUBMITTED','CALCULATED','REVIEWED','FILED','POSTED','CORRECTION_REQUIRED','RESULT_UNKNOWN','CANCELLED'));

ALTER TABLE public.pay_input_snapshots ADD CONSTRAINT pay_v2_state_pay_input_snapshots CHECK (status IN ('BUILDING','FROZEN','INVALIDATED'));

-- GL CANCELLED is a proposed real state reached only by common cancellation apply:

-- DRAFT/BALANCED cancel locally; APPROVAL_PENDING requires exact CANCELLED_BEFORE_DECISION.

-- APPROVED/SENT/POSTED/NATIVE_POSTED cannot become CANCELLED; use new inverse journal/refetch.

-- Interval exclusions, unique finalization, signed lineage, rounding-stage uniqueness,

-- financial append-only ACL/forward delta upgrade and production runtime-role source require

-- exact owner-reviewed successor before migration allocation; this SQL is not that approval.

ALTER TABLE public.pay_legal_payroll_entities ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_legal_payroll_entities FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_legal_payroll_entities USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_pay_groups ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_pay_groups FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_pay_groups USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_pay_periods ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_pay_periods FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_pay_periods USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_element_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_element_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_element_versions USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_formula_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_formula_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_formula_versions USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_formula_dependencies ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_formula_dependencies FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_formula_dependencies USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_formula_test_cases ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_formula_test_cases FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_formula_test_cases USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_rounding_policy_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_rounding_policy_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_rounding_policy_versions USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_worker_element_entries ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_worker_element_entries FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_worker_element_entries USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_input_snapshots ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_input_snapshots FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_input_snapshots USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_payroll_runs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_payroll_runs FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_payroll_runs USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_payroll_run_workers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_payroll_run_workers FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_payroll_run_workers USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_payroll_run_attempts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_payroll_run_attempts FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_payroll_run_attempts USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_worker_results ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_worker_results FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_worker_results USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_result_lines ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_result_lines FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_result_lines USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_calculation_trace_nodes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_calculation_trace_nodes FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_calculation_trace_nodes USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_balance_ledger_entries ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_balance_ledger_entries FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_balance_ledger_entries USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_retro_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_retro_events FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_retro_events USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_reconciliation_issues ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_reconciliation_issues FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_reconciliation_issues USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_run_approvals ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_run_approvals FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_run_approvals USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_payment_batches ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_payment_batches FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_payment_batches USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_payment_instructions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_payment_instructions FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_payment_instructions USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_connector_receipts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_connector_receipts FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_connector_receipts USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_gl_mapping_rule_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_gl_mapping_rule_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_gl_mapping_rule_versions USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_gl_batches ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_gl_batches FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_gl_batches USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_gl_lines ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_gl_lines FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_gl_lines USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_payslips ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_payslips FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_payslips USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_payslip_access_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_payslip_access_events FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_payslip_access_events USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_country_pack_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_country_pack_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_country_pack_versions USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_year_end_cases ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_year_end_cases FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_year_end_cases USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_year_end_evidence ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_year_end_evidence FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_year_end_evidence USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_year_end_provider_invocations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_year_end_provider_invocations FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_year_end_provider_invocations USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_worker_projections ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_worker_projections FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_worker_projections USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_time_handoff_snapshots ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_time_handoff_snapshots FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_time_handoff_snapshots USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_time_handoff_lines ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_time_handoff_lines FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_time_handoff_lines USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_time_handoff_ingest_receipts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_time_handoff_ingest_receipts FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_time_handoff_ingest_receipts USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_worker_tax_profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_worker_tax_profiles FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_worker_tax_profiles USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_payment_files ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_payment_files FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_payment_files USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_statutory_cases ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_statutory_cases FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_statutory_cases USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_command_receipts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_command_receipts FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_command_receipts USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_inbox_receipts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_inbox_receipts FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_inbox_receipts USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_outbox_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_outbox_events FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_outbox_events USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_config_artifact_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_config_artifact_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_config_artifact_versions USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_artifact_revision_counters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_artifact_revision_counters FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_artifact_revision_counters USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_calendar_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_calendar_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_calendar_versions USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_eligibility_policy_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_eligibility_policy_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_eligibility_policy_versions USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_rounding_policy_stage_rules ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_rounding_policy_stage_rules FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_rounding_policy_stage_rules USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_config_evaluations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_config_evaluations FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_config_evaluations USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_config_golden_reports ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_config_golden_reports FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_config_golden_reports USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_config_approval_bindings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_config_approval_bindings FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_config_approval_bindings USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_run_approval_bindings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_run_approval_bindings FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_run_approval_bindings USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_payment_approval_bindings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_payment_approval_bindings FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_payment_approval_bindings USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_gl_approval_bindings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_gl_approval_bindings FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_gl_approval_bindings USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_case_approval_bindings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_case_approval_bindings FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_case_approval_bindings USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_group_memberships ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_group_memberships FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_group_memberships USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_membership_revision_counters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_membership_revision_counters FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_membership_revision_counters USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_period_lock_bindings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_period_lock_bindings FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_period_lock_bindings USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_worker_entry_correction_links ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_worker_entry_correction_links FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_worker_entry_correction_links USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_input_source_vectors ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_input_source_vectors FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_input_source_vectors USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_input_source_ingest_receipts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_input_source_ingest_receipts FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_input_source_ingest_receipts USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_owner_snapshot_payloads ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_owner_snapshot_payloads FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_owner_snapshot_payloads USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_run_attempt_counters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_run_attempt_counters FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_run_attempt_counters USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_attempt_fences ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_attempt_fences FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_attempt_fences USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_result_staging_manifests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_result_staging_manifests FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_result_staging_manifests USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_run_validation_reports ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_run_validation_reports FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_run_validation_reports USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_run_finalization_receipts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_run_finalization_receipts FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_run_finalization_receipts USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_run_successor_links ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_run_successor_links FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_run_successor_links USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_case_successor_links ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_case_successor_links FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_case_successor_links USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_run_reopen_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_run_reopen_requests FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_run_reopen_requests USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_correction_basis_links ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_correction_basis_links FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_correction_basis_links USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_settlement_invocations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_settlement_invocations FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_settlement_invocations USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_settlement_receipts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_settlement_receipts FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_settlement_receipts USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_payment_reversal_links ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_payment_reversal_links FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_payment_reversal_links USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_gl_reversal_links ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_gl_reversal_links FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_gl_reversal_links USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_issue_resolution_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_issue_resolution_events FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_issue_resolution_events USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_retirement_basis_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_retirement_basis_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_retirement_basis_versions USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_retirement_basis_source_refs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_retirement_basis_source_refs FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_retirement_basis_source_refs USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_year_end_basis_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_year_end_basis_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_year_end_basis_versions USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_year_end_basis_source_refs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_year_end_basis_source_refs FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_year_end_basis_source_refs USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_retirement_cases ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_retirement_cases FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_retirement_cases USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_case_validation_reports ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_case_validation_reports FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_case_validation_reports USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_case_outputs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_case_outputs FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_case_outputs USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_case_output_lines ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_case_output_lines FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_case_output_lines USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_case_posting_links ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_case_posting_links FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_case_posting_links USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_artifact_effective_publications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_artifact_effective_publications FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_artifact_effective_publications USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_approval_cancellation_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_approval_cancellation_requests FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_approval_cancellation_requests USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_source_invalidation_facts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_source_invalidation_facts FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_source_invalidation_facts USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

ALTER TABLE public.pay_input_revision_counters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pay_input_revision_counters FORCE ROW LEVEL SECURITY;

CREATE POLICY pay_v2_tenant_scope ON public.pay_input_revision_counters USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);

