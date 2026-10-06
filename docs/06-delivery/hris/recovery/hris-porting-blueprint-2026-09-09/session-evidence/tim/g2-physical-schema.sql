-- HRIS-TIM PostgreSQL physical DDL blueprint.
-- CODE_READY_PROPOSAL only: Integration Control assigns the Flyway version.
-- Cross-context references are tenant-scoped public UUIDs and intentionally have no FK.
-- DECIMAL-SSOT: coding-readiness/decimal-value-types.v1.json. Quantity/amount values
-- are canonical decimal strings on the wire and validated before SQL bind; binary
-- floating point and PostgreSQL implicit rounding are forbidden.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE tme_worker_projections (
    projection_id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    worker_public_id UUID NOT NULL,
    assignment_public_id UUID NOT NULL,
    legal_entity_public_id UUID NOT NULL,
    workplace_public_id UUID,
    manager_worker_public_id UUID,
    time_zone VARCHAR(80) NOT NULL,
    availability_code VARCHAR(40) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    source_revision BIGINT NOT NULL,
    payload_digest CHAR(64) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT ck_tme_worker_projection_period CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT ck_tme_worker_projection_revision CHECK (source_revision > 0),
    CONSTRAINT uk_tme_worker_projection_revision UNIQUE (tenant_id, assignment_public_id, source_revision)
);
CREATE INDEX ix_tme_worker_projection_current
    ON tme_worker_projections (tenant_id, worker_public_id, effective_from DESC, effective_to);

CREATE TABLE tme_work_rule_set_versions (
    work_rule_set_version_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    rule_key VARCHAR(100) NOT NULL,
    version_no INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    time_zone VARCHAR(80) NOT NULL,
    policy_schema_version VARCHAR(30) NOT NULL,
    policy_payload JSONB NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    validation_digest CHAR(64),
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    CONSTRAINT uk_tme_rule_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_tme_rule_version UNIQUE (tenant_id, rule_key, version_no),
    CONSTRAINT ck_tme_rule_status CHECK (status IN ('DRAFT','VALIDATED','APPROVED','PUBLISHED','RETIRED')),
    CONSTRAINT ck_tme_rule_period CHECK (valid_to IS NULL OR valid_to > valid_from),
    CONSTRAINT ck_tme_rule_payload CHECK (jsonb_typeof(policy_payload) = 'object'),
    CONSTRAINT ck_tme_rule_publish CHECK (status NOT IN ('PUBLISHED','RETIRED') OR published_at IS NOT NULL)
);
ALTER TABLE tme_work_rule_set_versions ADD CONSTRAINT ex_tme_rule_effective_overlap
    EXCLUDE USING gist (tenant_id WITH =, rule_key WITH =, daterange(valid_from, COALESCE(valid_to, 'infinity'::date), '[)') WITH &&)
    WHERE (status = 'PUBLISHED');

CREATE TABLE tme_shift_template_versions (
    shift_template_version_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    shift_key VARCHAR(100) NOT NULL,
    version_no INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    local_start TIME NOT NULL,
    local_end TIME NOT NULL,
    crosses_midnight BOOLEAN NOT NULL,
    scheduled_minutes INTEGER NOT NULL,
    break_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
    valid_from DATE NOT NULL,
    valid_to DATE,
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    CONSTRAINT uk_tme_shift_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_tme_shift_version UNIQUE (tenant_id, shift_key, version_no),
    CONSTRAINT ck_tme_shift_status CHECK (status IN ('DRAFT','VALIDATED','APPROVED','PUBLISHED','RETIRED')),
    CONSTRAINT ck_tme_shift_minutes CHECK (scheduled_minutes BETWEEN 0 AND 2880),
    CONSTRAINT ck_tme_shift_period CHECK (valid_to IS NULL OR valid_to > valid_from),
    CONSTRAINT ck_tme_shift_break CHECK (jsonb_typeof(break_policy) = 'object')
);

CREATE TABLE tme_schedule_patterns (
    schedule_pattern_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    pattern_key VARCHAR(100) NOT NULL,
    version_no INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    cycle_days INTEGER NOT NULL,
    pattern_payload JSONB NOT NULL,
    calendar_public_id UUID,
    work_rule_set_public_id UUID NOT NULL,
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    CONSTRAINT uk_tme_pattern_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_tme_pattern_version UNIQUE (tenant_id, pattern_key, version_no),
    CONSTRAINT ck_tme_pattern_status CHECK (status IN ('DRAFT','VALIDATED','APPROVED','PUBLISHED','RETIRED')),
    CONSTRAINT ck_tme_pattern_cycle CHECK (cycle_days BETWEEN 1 AND 366),
    CONSTRAINT ck_tme_pattern_payload CHECK (jsonb_typeof(pattern_payload) = 'object')
);

CREATE TABLE tme_worker_schedule_assignments (
    schedule_assignment_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    worker_public_id UUID NOT NULL,
    assignment_public_id UUID NOT NULL,
    schedule_pattern_public_id UUID NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    source_type VARCHAR(20) NOT NULL,
    source_ref UUID,
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    CONSTRAINT uk_tme_schedule_assignment_public UNIQUE (tenant_id, public_id),
    CONSTRAINT ck_tme_schedule_assignment_period CHECK (valid_to IS NULL OR valid_to > valid_from),
    CONSTRAINT ck_tme_schedule_assignment_source CHECK (source_type IN ('POLICY','REQUEST','CORRECTION','MIGRATION'))
);
ALTER TABLE tme_worker_schedule_assignments ADD CONSTRAINT ex_tme_worker_schedule_overlap
    EXCLUDE USING gist (tenant_id WITH =, assignment_public_id WITH =, daterange(valid_from, COALESCE(valid_to, 'infinity'::date), '[)') WITH &&);

CREATE TABLE tme_scheduled_segments (
    scheduled_segment_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    worker_public_id UUID NOT NULL,
    assignment_public_id UUID NOT NULL,
    local_work_date DATE NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    source_time_zone VARCHAR(80) NOT NULL,
    source_utc_offset_minutes SMALLINT NOT NULL,
    segment_type VARCHAR(30) NOT NULL,
    schedule_assignment_public_id UUID NOT NULL,
    rule_snapshot_digest CHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_tme_scheduled_segment_public UNIQUE (tenant_id, public_id),
    CONSTRAINT ck_tme_scheduled_segment_range CHECK (ends_at > starts_at),
    CONSTRAINT ck_tme_scheduled_segment_offset CHECK (source_utc_offset_minutes BETWEEN -840 AND 840),
    CONSTRAINT ck_tme_scheduled_segment_type CHECK (segment_type IN ('WORK','BREAK','ON_CALL','TRAINING','ABSENCE','OTHER'))
);
CREATE INDEX ix_tme_scheduled_worker_date ON tme_scheduled_segments (tenant_id, worker_public_id, local_work_date);

CREATE TABLE tme_clock_sources (
    clock_source_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    source_key VARCHAR(100) NOT NULL,
    source_type VARCHAR(30) NOT NULL,
    connection_ref UUID,
    trust_level VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    schema_version VARCHAR(30) NOT NULL,
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    CONSTRAINT uk_tme_clock_source_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_tme_clock_source_key UNIQUE (tenant_id, source_key),
    CONSTRAINT ck_tme_clock_source_type CHECK (source_type IN ('WEB','MOBILE','KIOSK','DEVICE','IMPORT','API')),
    CONSTRAINT ck_tme_clock_source_trust CHECK (trust_level IN ('LOW','STANDARD','VERIFIED')),
    CONSTRAINT ck_tme_clock_source_status CHECK (status IN ('DRAFT','ACTIVE','SUSPENDED','RETIRED'))
);

CREATE TABLE tme_clock_events (
    clock_event_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    source_public_id UUID NOT NULL,
    source_event_key VARCHAR(200) NOT NULL,
    worker_public_id UUID NOT NULL,
    assignment_public_id UUID NOT NULL,
    event_type VARCHAR(30) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL,
    source_local_datetime TIMESTAMP NOT NULL,
    source_time_zone VARCHAR(80) NOT NULL,
    source_utc_offset_minutes SMALLINT NOT NULL,
    dst_resolution VARCHAR(40) NOT NULL,
    instant_authority VARCHAR(32) NOT NULL,
    tzdb_version VARCHAR(40) NOT NULL,
    time_zone_rule_version VARCHAR(80) NOT NULL,
    source_provenance_digest CHAR(64) NOT NULL,
    source_sequence VARCHAR(100),
    payload_digest CHAR(64) NOT NULL,
    trust_level VARCHAR(20) NOT NULL,
    voids_event_public_id UUID,
    correlation_id UUID NOT NULL,
    recorded_by UUID NOT NULL,
    CONSTRAINT uk_tme_clock_event_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_tme_clock_source_event UNIQUE (tenant_id, source_public_id, source_event_key),
    CONSTRAINT fk_tme_clock_event_source FOREIGN KEY (tenant_id, source_public_id) REFERENCES tme_clock_sources (tenant_id, public_id),
    CONSTRAINT fk_tme_clock_event_voids FOREIGN KEY (tenant_id, voids_event_public_id) REFERENCES tme_clock_events (tenant_id, public_id),
    CONSTRAINT ck_tme_clock_event_type CHECK (event_type IN ('IN','OUT','BREAK_START','BREAK_END','VOID','OTHER')),
    CONSTRAINT ck_tme_clock_event_offset CHECK (source_utc_offset_minutes BETWEEN -840 AND 840),
    CONSTRAINT ck_tme_clock_event_dst_resolution CHECK (dst_resolution IN ('EXACT_OFFSET_SUPPLIED','EARLIER_OFFSET_SELECTED','LATER_OFFSET_SELECTED','GAP_SHIFT_FORWARD')),
    CONSTRAINT ck_tme_clock_event_instant_authority CHECK (instant_authority IN ('SOURCE_INSTANT','LOCAL_WITH_OFFSET','SERVER_RESOLVED')),
    CONSTRAINT ck_tme_clock_event_provenance_digest CHECK (source_provenance_digest ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_tme_clock_event_void CHECK ((event_type = 'VOID') = (voids_event_public_id IS NOT NULL)),
    CONSTRAINT ck_tme_clock_event_not_self_void CHECK (voids_event_public_id IS NULL OR voids_event_public_id <> public_id)
);
CREATE INDEX ix_tme_clock_worker_time ON tme_clock_events (tenant_id, worker_public_id, occurred_at DESC);
CREATE UNIQUE INDEX uk_tme_clock_event_single_void
    ON tme_clock_events (tenant_id, voids_event_public_id)
    WHERE event_type = 'VOID';

CREATE TABLE tme_interpretation_runs (
    interpretation_run_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    worker_public_id UUID,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    run_scope VARCHAR(20) NOT NULL,
    status VARCHAR(24) NOT NULL,
    input_snapshot_digest CHAR(64) NOT NULL,
    rule_snapshot_digest CHAR(64) NOT NULL,
    requested_idempotency_key VARCHAR(160) NOT NULL,
    correlation_id UUID NOT NULL,
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    CONSTRAINT uk_tme_interpretation_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_tme_interpretation_internal UNIQUE (tenant_id, interpretation_run_id),
    CONSTRAINT uk_tme_interpretation_idem UNIQUE (tenant_id, requested_idempotency_key),
    CONSTRAINT ck_tme_interpretation_period CHECK (period_end >= period_start),
    CONSTRAINT ck_tme_interpretation_scope CHECK (run_scope IN ('WORKER','GROUP','PERIOD')),
    CONSTRAINT ck_tme_interpretation_status CHECK (status IN ('QUEUED','RUNNING','SUCCEEDED','FAILED','RESULT_UNKNOWN','SUPERSEDED'))
);

CREATE TABLE tme_interpretation_attempts (
    interpretation_attempt_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    interpretation_run_id BIGINT NOT NULL,
    attempt_no INTEGER NOT NULL,
    status VARCHAR(24) NOT NULL,
    lease_token UUID,
    lease_expires_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    output_digest CHAR(64),
    error_code VARCHAR(80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_tme_interpretation_attempt_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_tme_interpretation_attempt_internal UNIQUE (tenant_id, interpretation_attempt_id),
    CONSTRAINT uk_tme_interpretation_attempt_no UNIQUE (tenant_id, interpretation_run_id, attempt_no),
    CONSTRAINT fk_tme_interpretation_attempt_run FOREIGN KEY (tenant_id, interpretation_run_id) REFERENCES tme_interpretation_runs (tenant_id, interpretation_run_id),
    CONSTRAINT ck_tme_interpretation_attempt_no CHECK (attempt_no > 0),
    CONSTRAINT ck_tme_interpretation_attempt_status CHECK (status IN ('QUEUED','RUNNING','SUCCEEDED','FAILED','RESULT_UNKNOWN'))
);

CREATE TABLE tme_interpreted_segments (
    interpreted_segment_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    interpretation_attempt_id BIGINT NOT NULL,
    worker_public_id UUID NOT NULL,
    local_work_date DATE NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    segment_type VARCHAR(30) NOT NULL,
    minutes INTEGER NOT NULL,
    source_event_digest CHAR(64) NOT NULL,
    rule_trace_digest CHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_tme_interpreted_segment_public UNIQUE (tenant_id, public_id),
    CONSTRAINT fk_tme_interpreted_attempt FOREIGN KEY (tenant_id, interpretation_attempt_id) REFERENCES tme_interpretation_attempts (tenant_id, interpretation_attempt_id),
    CONSTRAINT ck_tme_interpreted_segment_range CHECK (ends_at > starts_at),
    CONSTRAINT ck_tme_interpreted_segment_minutes CHECK (minutes BETWEEN 0 AND 2880),
    CONSTRAINT ck_tme_interpreted_segment_type CHECK (segment_type IN ('REGULAR','OVERTIME','NIGHT','HOLIDAY','BREAK','ABSENCE','UNPAID','OTHER'))
);

CREATE TABLE tme_time_ledger_entries (
    time_ledger_entry_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    worker_public_id UUID NOT NULL,
    local_work_date DATE NOT NULL,
    pay_code VARCHAR(80) NOT NULL,
    unit VARCHAR(12) NOT NULL,
    quantity NUMERIC(19,6) NOT NULL,
    source_type VARCHAR(30) NOT NULL,
    source_public_id UUID NOT NULL,
    interpretation_attempt_public_id UUID,
    reverses_entry_public_id UUID,
    reason_code VARCHAR(80),
    ledger_revision BIGINT NOT NULL,
    input_digest CHAR(64) NOT NULL,
    rule_digest CHAR(64) NOT NULL,
    posted_at TIMESTAMPTZ NOT NULL,
    posted_by UUID NOT NULL,
    correlation_id UUID NOT NULL,
    CONSTRAINT uk_tme_time_ledger_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_tme_time_ledger_public_posted UNIQUE (tenant_id, public_id, posted_at),
    CONSTRAINT uk_tme_time_ledger_revision UNIQUE (tenant_id, worker_public_id, ledger_revision),
    CONSTRAINT fk_tme_time_ledger_attempt FOREIGN KEY (tenant_id, interpretation_attempt_public_id) REFERENCES tme_interpretation_attempts (tenant_id, public_id),
    CONSTRAINT fk_tme_time_ledger_reversal FOREIGN KEY (tenant_id, reverses_entry_public_id) REFERENCES tme_time_ledger_entries (tenant_id, public_id),
    CONSTRAINT ck_tme_time_ledger_revision CHECK (ledger_revision > 0),
    CONSTRAINT ck_tme_time_ledger_unit CHECK (unit IN ('MINUTE','HOUR','DAY','COUNT')),
    CONSTRAINT ck_tme_time_ledger_source CHECK (source_type IN ('INTERPRETATION','MANUAL_CORRECTION','REVERSAL','MIGRATION')),
    CONSTRAINT ck_tme_time_ledger_reversal CHECK ((source_type = 'REVERSAL') = (reverses_entry_public_id IS NOT NULL)),
    CONSTRAINT ck_tme_time_ledger_not_self_reversal CHECK (reverses_entry_public_id IS NULL OR reverses_entry_public_id <> public_id)
);
CREATE INDEX ix_tme_time_ledger_worker_date ON tme_time_ledger_entries (tenant_id, worker_public_id, local_work_date, pay_code);
CREATE INDEX ix_tme_time_ledger_revision ON tme_time_ledger_entries (tenant_id, worker_public_id, ledger_revision);
CREATE UNIQUE INDEX uk_tme_time_ledger_single_reversal
    ON tme_time_ledger_entries (tenant_id, reverses_entry_public_id)
    WHERE source_type = 'REVERSAL';

CREATE TABLE tme_time_cards (
    time_card_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    worker_public_id UUID NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    interpretation_run_public_id UUID,
    ledger_revision BIGINT NOT NULL,
    blocking_exception_count INTEGER NOT NULL DEFAULT 0,
    submitted_at TIMESTAMPTZ,
    submitted_by UUID,
    decided_at TIMESTAMPTZ,
    decided_by UUID,
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_tme_time_card_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_tme_time_card_internal UNIQUE (tenant_id, time_card_id),
    CONSTRAINT uk_tme_time_card_period UNIQUE (tenant_id, worker_public_id, period_start, period_end),
    CONSTRAINT ck_tme_time_card_period CHECK (period_end >= period_start),
    CONSTRAINT ck_tme_time_card_status CHECK (status IN ('OPEN','SUBMITTED','APPROVED','REJECTED','LOCKED','CORRECTION_REQUIRED')),
    CONSTRAINT ck_tme_time_card_exceptions CHECK (blocking_exception_count >= 0)
);

CREATE TABLE tme_time_exceptions (
    time_exception_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    time_card_id BIGINT NOT NULL,
    worker_public_id UUID NOT NULL,
    exception_code VARCHAR(80) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    occurred_on DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    owner_actor_public_id UUID,
    evidence_object_ref UUID,
    resolution_code VARCHAR(80),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID,
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_tme_exception_public UNIQUE (tenant_id, public_id),
    CONSTRAINT fk_tme_exception_card FOREIGN KEY (tenant_id, time_card_id) REFERENCES tme_time_cards (tenant_id, time_card_id),
    CONSTRAINT ck_tme_exception_severity CHECK (severity IN ('INFO','WARNING','BLOCKING')),
    CONSTRAINT ck_tme_exception_status CHECK (status IN ('OPEN','ASSIGNED','RESOLVED','WAIVED','SUPERSEDED'))
);
CREATE INDEX ix_tme_exception_queue ON tme_time_exceptions (tenant_id, status, severity, occurred_on);

CREATE TABLE tme_work_requests (
    work_request_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    worker_public_id UUID NOT NULL,
    request_type VARCHAR(40) NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    requested_quantity NUMERIC(19,6),
    status VARCHAR(20) NOT NULL,
    approval_case_public_id UUID,
    policy_revision_public_id UUID NOT NULL,
    supersedes_request_public_id UUID,
    row_version BIGINT NOT NULL DEFAULT 0,
    submitted_at TIMESTAMPTZ,
    decided_at TIMESTAMPTZ,
    decided_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    CONSTRAINT uk_tme_work_request_public UNIQUE (tenant_id, public_id),
    CONSTRAINT ck_tme_work_request_range CHECK (ends_at > starts_at),
    CONSTRAINT ck_tme_work_request_status CHECK (status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED','CANCELLED','CORRECTION_REQUIRED'))
);

CREATE TABLE abs_leave_plan_versions (
    leave_plan_version_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    plan_key VARCHAR(100) NOT NULL,
    version_no INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    unit VARCHAR(12) NOT NULL,
    jurisdiction_code VARCHAR(20),
    country_pack_version_public_id UUID,
    eligibility_rule_ref UUID NOT NULL,
    accrual_rule_ref UUID NOT NULL,
    expiry_rule_ref UUID,
    carryover_rule_ref UUID,
    valid_from DATE NOT NULL,
    valid_to DATE,
    validation_digest CHAR(64),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    CONSTRAINT uk_abs_plan_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_abs_plan_version UNIQUE (tenant_id, plan_key, version_no),
    CONSTRAINT ck_abs_plan_status CHECK (status IN ('DRAFT','VALIDATED','APPROVED','PUBLISHED','RETIRED')),
    CONSTRAINT ck_abs_plan_unit CHECK (unit IN ('MINUTE','HOUR','DAY')),
    CONSTRAINT ck_abs_plan_period CHECK (valid_to IS NULL OR valid_to > valid_from)
);
ALTER TABLE abs_leave_plan_versions ADD CONSTRAINT ex_abs_plan_effective_overlap
    EXCLUDE USING gist (tenant_id WITH =, plan_key WITH =, daterange(valid_from, COALESCE(valid_to, 'infinity'::date), '[)') WITH &&)
    WHERE (status = 'PUBLISHED');

CREATE TABLE abs_worker_plan_enrollments (
    enrollment_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    worker_public_id UUID NOT NULL,
    assignment_public_id UUID NOT NULL,
    leave_plan_public_id UUID NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    enrollment_reason VARCHAR(80) NOT NULL,
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    CONSTRAINT uk_abs_enrollment_public UNIQUE (tenant_id, public_id),
    CONSTRAINT ck_abs_enrollment_period CHECK (valid_to IS NULL OR valid_to > valid_from)
);
ALTER TABLE abs_worker_plan_enrollments ADD CONSTRAINT ex_abs_worker_plan_overlap
    EXCLUDE USING gist (tenant_id WITH =, worker_public_id WITH =, leave_plan_public_id WITH =, daterange(valid_from, COALESCE(valid_to, 'infinity'::date), '[)') WITH &&);

CREATE TABLE abs_leave_requests (
    leave_request_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    worker_public_id UUID NOT NULL,
    leave_plan_public_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL,
    requested_quantity NUMERIC(19,6) NOT NULL,
    unit VARCHAR(12) NOT NULL,
    approval_case_public_id UUID,
    evidence_object_ref UUID,
    reason_classification VARCHAR(40),
    supersedes_request_public_id UUID,
    row_version BIGINT NOT NULL DEFAULT 0,
    submitted_at TIMESTAMPTZ,
    decided_at TIMESTAMPTZ,
    decided_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    CONSTRAINT uk_abs_leave_request_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_abs_leave_request_internal UNIQUE (tenant_id, leave_request_id),
    CONSTRAINT ck_abs_leave_request_quantity CHECK (requested_quantity > 0),
    CONSTRAINT ck_abs_leave_request_unit CHECK (unit IN ('MINUTE','HOUR','DAY')),
    CONSTRAINT ck_abs_leave_request_status CHECK (status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED','CANCELLED','CORRECTION_REQUIRED'))
);

CREATE TABLE abs_leave_request_segments (
    leave_request_segment_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    leave_request_id BIGINT NOT NULL,
    local_date DATE NOT NULL,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    quantity NUMERIC(19,6) NOT NULL,
    schedule_segment_public_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_abs_segment_public UNIQUE (tenant_id, public_id),
    CONSTRAINT fk_abs_segment_request FOREIGN KEY (tenant_id, leave_request_id) REFERENCES abs_leave_requests (tenant_id, leave_request_id),
    CONSTRAINT ck_abs_segment_quantity CHECK (quantity > 0),
    CONSTRAINT ck_abs_segment_range CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE abs_entitlement_runs (
    entitlement_run_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    leave_plan_public_id UUID NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    run_mode VARCHAR(12) NOT NULL,
    status VARCHAR(24) NOT NULL,
    input_snapshot_digest CHAR(64) NOT NULL,
    rule_snapshot_digest CHAR(64) NOT NULL,
    idempotency_key VARCHAR(160) NOT NULL,
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    CONSTRAINT uk_abs_entitlement_run_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_abs_entitlement_idem UNIQUE (tenant_id, idempotency_key),
    CONSTRAINT ck_abs_entitlement_period CHECK (period_end >= period_start),
    CONSTRAINT ck_abs_entitlement_mode CHECK (run_mode IN ('DRY_RUN','COMMIT')),
    CONSTRAINT ck_abs_entitlement_status CHECK (status IN ('QUEUED','RUNNING','SUCCEEDED','FAILED','RESULT_UNKNOWN','SUPERSEDED'))
);

CREATE TABLE abs_entitlement_ledger_entries (
    entitlement_ledger_entry_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    worker_public_id UUID NOT NULL,
    leave_plan_public_id UUID NOT NULL,
    entry_type VARCHAR(20) NOT NULL,
    effective_date DATE NOT NULL,
    quantity NUMERIC(19,6) NOT NULL,
    unit VARCHAR(12) NOT NULL,
    source_public_id UUID NOT NULL,
    reverses_entry_public_id UUID,
    rule_snapshot_digest CHAR(64) NOT NULL,
    posted_at TIMESTAMPTZ NOT NULL,
    posted_by UUID NOT NULL,
    correlation_id UUID NOT NULL,
    CONSTRAINT uk_abs_ledger_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_abs_ledger_source UNIQUE (tenant_id, source_public_id, worker_public_id, leave_plan_public_id, entry_type, effective_date),
    CONSTRAINT fk_abs_ledger_plan FOREIGN KEY (tenant_id, leave_plan_public_id) REFERENCES abs_leave_plan_versions (tenant_id, public_id),
    CONSTRAINT fk_abs_ledger_reversal FOREIGN KEY (tenant_id, reverses_entry_public_id) REFERENCES abs_entitlement_ledger_entries (tenant_id, public_id),
    CONSTRAINT ck_abs_ledger_type CHECK (entry_type IN ('GRANT','USE','RELEASE','ADJUST','EXPIRE','CARRYOVER','REVERSE')),
    CONSTRAINT ck_abs_ledger_unit CHECK (unit IN ('MINUTE','HOUR','DAY')),
    CONSTRAINT ck_abs_ledger_reversal CHECK ((entry_type = 'REVERSE') = (reverses_entry_public_id IS NOT NULL)),
    CONSTRAINT ck_abs_ledger_not_self_reversal CHECK (reverses_entry_public_id IS NULL OR reverses_entry_public_id <> public_id)
);
CREATE INDEX ix_abs_ledger_worker_plan ON abs_entitlement_ledger_entries (tenant_id, worker_public_id, leave_plan_public_id, effective_date);
CREATE UNIQUE INDEX uk_abs_ledger_single_reversal
    ON abs_entitlement_ledger_entries (tenant_id, reverses_entry_public_id)
    WHERE entry_type = 'REVERSE';

CREATE TABLE abs_leave_balance_projections (
    leave_balance_projection_id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    worker_public_id UUID NOT NULL,
    leave_plan_public_id UUID NOT NULL,
    as_of_date DATE NOT NULL,
    quantity NUMERIC(19,6) NOT NULL,
    unit VARCHAR(12) NOT NULL,
    ledger_revision BIGINT NOT NULL,
    rebuilt_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uk_abs_balance_projection UNIQUE (tenant_id, worker_public_id, leave_plan_public_id, as_of_date),
    CONSTRAINT ck_abs_balance_unit CHECK (unit IN ('MINUTE','HOUR','DAY'))
);

CREATE TABLE tme_close_periods (
    close_period_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    close_scope VARCHAR(20) NOT NULL,
    scope_public_id UUID NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status VARCHAR(24) NOT NULL,
    close_revision BIGINT NOT NULL DEFAULT 0,
    ledger_revision BIGINT,
    approval_case_public_id UUID,
    closed_at TIMESTAMPTZ,
    closed_by UUID,
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_tme_close_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_tme_close_internal UNIQUE (tenant_id, close_period_id),
    CONSTRAINT uk_tme_close_scope_period UNIQUE (tenant_id, close_scope, scope_public_id, period_start, period_end),
    CONSTRAINT ck_tme_close_period CHECK (period_end >= period_start),
    CONSTRAINT ck_tme_close_scope CHECK (close_scope IN ('DAY','MONTH','PAYROLL_PERIOD')),
    CONSTRAINT ck_tme_close_status CHECK (status IN ('OPEN','VALIDATING','CLOSING','CLOSED','REOPEN_REQUESTED','REOPENED','FAILED'))
);

CREATE TABLE tme_close_attempts (
    close_attempt_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    close_period_id BIGINT NOT NULL,
    attempt_no INTEGER NOT NULL,
    requested_action VARCHAR(20) NOT NULL,
    status VARCHAR(24) NOT NULL,
    expected_row_version BIGINT NOT NULL,
    blocker_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    input_digest CHAR(64) NOT NULL,
    output_digest CHAR(64),
    idempotency_key VARCHAR(160) NOT NULL,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    requested_by UUID NOT NULL,
    correlation_id UUID NOT NULL,
    CONSTRAINT uk_tme_close_attempt_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_tme_close_attempt_no UNIQUE (tenant_id, close_period_id, attempt_no),
    CONSTRAINT uk_tme_close_attempt_idem UNIQUE (tenant_id, idempotency_key),
    CONSTRAINT fk_tme_close_attempt_period FOREIGN KEY (tenant_id, close_period_id) REFERENCES tme_close_periods (tenant_id, close_period_id),
    CONSTRAINT ck_tme_close_attempt_action CHECK (requested_action IN ('CLOSE','REOPEN','RECLOSE')),
    CONSTRAINT ck_tme_close_attempt_status CHECK (status IN ('QUEUED','RUNNING','SUCCEEDED','BLOCKED','FAILED','RESULT_UNKNOWN')),
    CONSTRAINT ck_tme_close_blockers CHECK (jsonb_typeof(blocker_snapshot) = 'array')
);

CREATE TABLE tme_closed_time_results (
    closed_time_result_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    close_period_id BIGINT NOT NULL,
    close_revision BIGINT NOT NULL,
    payroll_entity_public_id UUID NOT NULL,
    pay_period_public_id UUID NOT NULL,
    ledger_revision_from BIGINT NOT NULL,
    ledger_revision_to BIGINT NOT NULL,
    worker_count INTEGER NOT NULL,
    line_count INTEGER NOT NULL,
    source_digest CHAR(64) NOT NULL,
    rule_digest CHAR(64) NOT NULL,
    payload_digest CHAR(64) NOT NULL,
    supersedes_result_public_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    correlation_id UUID NOT NULL,
    CONSTRAINT uk_tme_closed_result_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_tme_closed_result_internal UNIQUE (tenant_id, closed_time_result_id),
    CONSTRAINT uk_tme_closed_result_revision UNIQUE (tenant_id, close_period_id, close_revision, payroll_entity_public_id, pay_period_public_id),
    CONSTRAINT fk_tme_closed_result_period FOREIGN KEY (tenant_id, close_period_id) REFERENCES tme_close_periods (tenant_id, close_period_id),
    CONSTRAINT fk_tme_closed_result_supersedes FOREIGN KEY (tenant_id, supersedes_result_public_id) REFERENCES tme_closed_time_results (tenant_id, public_id),
    CONSTRAINT ck_tme_closed_result_revision CHECK (close_revision > 0 AND ledger_revision_from > 0 AND ledger_revision_to >= ledger_revision_from),
    CONSTRAINT ck_tme_closed_result_counts CHECK (worker_count >= 0 AND line_count >= 0)
);

CREATE TABLE tme_closed_time_result_lines (
    closed_time_result_line_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    closed_time_result_id BIGINT NOT NULL,
    line_no INTEGER NOT NULL,
    worker_public_id UUID NOT NULL,
    assignment_public_id UUID NOT NULL,
    pay_code VARCHAR(80) NOT NULL,
    unit VARCHAR(12) NOT NULL,
    quantity NUMERIC(19,6) NOT NULL,
    currency_code CHAR(3) NOT NULL DEFAULT 'XXX',
    work_date_from DATE NOT NULL,
    work_date_to DATE NOT NULL,
    source_entry_count INTEGER NOT NULL,
    source_entry_digest CHAR(64) NOT NULL,
    CONSTRAINT uk_tme_closed_result_line_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_tme_closed_result_line_internal UNIQUE (tenant_id, closed_time_result_line_id),
    CONSTRAINT uk_tme_closed_result_line_no UNIQUE (tenant_id, closed_time_result_id, line_no),
    CONSTRAINT fk_tme_closed_result_line_header FOREIGN KEY (tenant_id, closed_time_result_id) REFERENCES tme_closed_time_results (tenant_id, closed_time_result_id),
    CONSTRAINT ck_tme_closed_result_line_no CHECK (line_no > 0),
    CONSTRAINT ck_tme_closed_result_line_unit CHECK (unit IN ('MINUTE','HOUR','DAY','COUNT','AMOUNT')),
    CONSTRAINT ck_tme_closed_result_line_currency CHECK (
        (unit = 'AMOUNT' AND currency_code <> 'XXX' AND currency_code ~ '^[A-Z]{3}$')
        OR (unit <> 'AMOUNT' AND currency_code = 'XXX')
    ),
    CONSTRAINT ck_tme_closed_result_line_dates CHECK (work_date_to >= work_date_from),
    CONSTRAINT ck_tme_closed_result_line_sources CHECK (source_entry_count > 0)
);

CREATE TABLE tme_closed_time_result_sources (
    closed_time_result_source_id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    closed_time_result_line_id BIGINT NOT NULL,
    ledger_entry_public_id UUID NOT NULL,
    ledger_entry_posted_at TIMESTAMPTZ NOT NULL,
    ledger_revision BIGINT NOT NULL,
    contribution_quantity NUMERIC(19,6) NOT NULL,
    contribution_unit VARCHAR(12) NOT NULL,
    entry_digest CHAR(64) NOT NULL,
    CONSTRAINT uk_tme_closed_result_source UNIQUE (tenant_id, closed_time_result_line_id, ledger_entry_public_id, ledger_entry_posted_at),
    CONSTRAINT fk_tme_closed_result_source_line FOREIGN KEY (tenant_id, closed_time_result_line_id) REFERENCES tme_closed_time_result_lines (tenant_id, closed_time_result_line_id),
    CONSTRAINT fk_tme_closed_result_source_ledger FOREIGN KEY (tenant_id, ledger_entry_public_id, ledger_entry_posted_at) REFERENCES tme_time_ledger_entries (tenant_id, public_id, posted_at),
    CONSTRAINT ck_tme_closed_result_source_revision CHECK (ledger_revision > 0),
    CONSTRAINT ck_tme_closed_result_source_unit CHECK (contribution_unit IN ('MINUTE','HOUR','DAY','COUNT','AMOUNT'))
);

CREATE TABLE tme_payroll_handoffs (
    payroll_handoff_id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    closed_time_result_id BIGINT NOT NULL,
    close_period_public_id UUID NOT NULL,
    close_revision BIGINT NOT NULL,
    payroll_entity_public_id UUID NOT NULL,
    pay_period_public_id UUID NOT NULL,
    status VARCHAR(24) NOT NULL,
    worker_count INTEGER NOT NULL,
    line_count INTEGER NOT NULL,
    source_digest CHAR(64) NOT NULL,
    rule_digest CHAR(64) NOT NULL,
    payload_digest CHAR(64) NOT NULL,
    idempotency_key VARCHAR(160) NOT NULL,
    receiver_receipt_public_id UUID,
    receiver_reason_code VARCHAR(80),
    sent_at TIMESTAMPTZ,
    reconciled_at TIMESTAMPTZ,
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    CONSTRAINT uk_tme_handoff_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_tme_handoff_revision UNIQUE (tenant_id, close_period_public_id, close_revision, payroll_entity_public_id, pay_period_public_id),
    CONSTRAINT uk_tme_handoff_idem UNIQUE (tenant_id, idempotency_key),
    CONSTRAINT fk_tme_handoff_closed_result FOREIGN KEY (tenant_id, closed_time_result_id) REFERENCES tme_closed_time_results (tenant_id, closed_time_result_id),
    CONSTRAINT ck_tme_handoff_status CHECK (status IN ('PENDING','SENT','ACKNOWLEDGED','REJECTED','RESULT_UNKNOWN','SUPERSEDED')),
    CONSTRAINT ck_tme_handoff_counts CHECK (worker_count >= 0 AND line_count >= 0)
);
CREATE INDEX ix_tme_handoff_reconcile ON tme_payroll_handoffs (tenant_id, status, created_at);

CREATE TABLE tme_command_receipts (
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
    CONSTRAINT uk_tme_receipt_public UNIQUE (tenant_id, public_id),
    CONSTRAINT uk_tme_receipt_idem UNIQUE (tenant_id, subject_principal_public_id, originating_action, idempotency_key),
    CONSTRAINT ck_tme_receipt_auth_revisions CHECK (field_policy_revision > 0 AND authorization_revision > 0),
    CONSTRAINT ck_tme_receipt_population_digest CHECK (population_scope_digest ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_tme_receipt_request_digest CHECK (request_digest ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_tme_receipt_status CHECK (status IN ('ACCEPTED','RUNNING','SUCCEEDED','REJECTED','FAILED','RESULT_UNKNOWN'))
);

CREATE OR REPLACE FUNCTION tme_guard_command_receipt_seal()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'TIM command receipt cannot be deleted';
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
        RAISE EXCEPTION 'TIM command receipt originating authorization and idempotency context is immutable';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_tme_command_receipt_seal
    BEFORE UPDATE OR DELETE ON tme_command_receipts
    FOR EACH ROW EXECUTE FUNCTION tme_guard_command_receipt_seal();

CREATE TABLE tme_inbox_receipts (
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
    CONSTRAINT uk_tme_inbox_event UNIQUE (tenant_id, event_id),
    CONSTRAINT ck_tme_inbox_status CHECK (status IN ('RECEIVED','PROCESSED','QUARANTINED','DEAD_LETTERED'))
);

CREATE TABLE tme_outbox_events (
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
    CONSTRAINT uk_tme_outbox_event UNIQUE (tenant_id, event_id),
    CONSTRAINT ck_tme_outbox_payload CHECK (jsonb_typeof(payload) = 'object'),
    CONSTRAINT ck_tme_outbox_attempts CHECK (publish_attempts >= 0)
);
CREATE INDEX ix_tme_outbox_unpublished ON tme_outbox_events (occurred_at) WHERE published_at IS NULL;

-- Ledger/raw facts are append-only at the database boundary. Corrections insert reversal rows.
CREATE OR REPLACE FUNCTION tme_reject_fact_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'TIME_FACTS_ARE_APPEND_ONLY' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION tme_guard_outbox_mutation() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'TIME_OUTBOX_EVENT_CANNOT_BE_DELETED' USING ERRCODE = '55000';
    END IF;
    IF ROW(NEW.tenant_id, NEW.event_id, NEW.aggregate_type, NEW.aggregate_public_id,
           NEW.aggregate_revision, NEW.schema_name, NEW.schema_version, NEW.payload,
           NEW.payload_digest, NEW.correlation_id, NEW.causation_id, NEW.occurred_at)
       IS DISTINCT FROM
       ROW(OLD.tenant_id, OLD.event_id, OLD.aggregate_type, OLD.aggregate_public_id,
           OLD.aggregate_revision, OLD.schema_name, OLD.schema_version, OLD.payload,
           OLD.payload_digest, OLD.correlation_id, OLD.causation_id, OLD.occurred_at) THEN
        RAISE EXCEPTION 'TIME_OUTBOX_EVENT_ENVELOPE_IMMUTABLE' USING ERRCODE = '55000';
    END IF;
    IF OLD.published_at IS NOT NULL AND NEW.published_at IS DISTINCT FROM OLD.published_at THEN
        RAISE EXCEPTION 'TIME_OUTBOX_PUBLICATION_IMMUTABLE' USING ERRCODE = '55000';
    END IF;
    IF NEW.publish_attempts < OLD.publish_attempts THEN
        RAISE EXCEPTION 'TIME_OUTBOX_ATTEMPTS_MONOTONIC' USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_tme_clock_events_immutable
    BEFORE UPDATE OR DELETE ON tme_clock_events FOR EACH ROW EXECUTE FUNCTION tme_reject_fact_mutation();
CREATE TRIGGER tr_tme_time_ledger_immutable
    BEFORE UPDATE OR DELETE ON tme_time_ledger_entries FOR EACH ROW EXECUTE FUNCTION tme_reject_fact_mutation();
CREATE TRIGGER tr_tme_interpreted_segments_immutable
    BEFORE UPDATE OR DELETE ON tme_interpreted_segments FOR EACH ROW EXECUTE FUNCTION tme_reject_fact_mutation();
CREATE TRIGGER tr_tme_closed_time_results_immutable
    BEFORE UPDATE OR DELETE ON tme_closed_time_results FOR EACH ROW EXECUTE FUNCTION tme_reject_fact_mutation();
CREATE TRIGGER tr_tme_closed_time_result_lines_immutable
    BEFORE UPDATE OR DELETE ON tme_closed_time_result_lines FOR EACH ROW EXECUTE FUNCTION tme_reject_fact_mutation();
CREATE TRIGGER tr_tme_closed_time_result_sources_immutable
    BEFORE UPDATE OR DELETE ON tme_closed_time_result_sources FOR EACH ROW EXECUTE FUNCTION tme_reject_fact_mutation();
CREATE TRIGGER tr_abs_entitlement_ledger_immutable
    BEFORE UPDATE OR DELETE ON abs_entitlement_ledger_entries FOR EACH ROW EXECUTE FUNCTION tme_reject_fact_mutation();
CREATE TRIGGER tr_tme_outbox_immutable
    BEFORE UPDATE OR DELETE ON tme_outbox_events FOR EACH ROW EXECUTE FUNCTION tme_guard_outbox_mutation();

-- G3 starts unpartitioned so inserts cannot fail for a missing monthly partition. Partitioning may
-- be enabled only by a measured-volume ADR that also allocates a default partition, ahead-of-time
-- creation job, retention detach/archive job, missing-partition alert and boundary/late-arrival tests.
-- RLS policies use the canonical DWP tenant setting below.
-- Application PEP remains mandatory; RLS is defense in depth, never the sole authorization layer.
-- API/worker roles are NOINHERIT, NOSUPERUSER and NOBYPASSRLS. Only an audited
-- migration/maintenance role owns tables; transaction scope sets dwp.tenant_id and
-- resets role plus setting before returning a connection to the pool.
DO $$
DECLARE target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'tme_worker_projections','tme_work_rule_set_versions','tme_shift_template_versions','tme_schedule_patterns',
    'tme_worker_schedule_assignments','tme_scheduled_segments','tme_clock_sources','tme_clock_events',
    'tme_interpretation_runs','tme_interpretation_attempts','tme_interpreted_segments','tme_time_ledger_entries',
    'tme_time_cards','tme_time_exceptions','tme_work_requests','abs_leave_plan_versions',
    'abs_worker_plan_enrollments','abs_leave_requests','abs_leave_request_segments','abs_entitlement_runs',
    'abs_entitlement_ledger_entries','abs_leave_balance_projections','tme_close_periods','tme_close_attempts',
    'tme_closed_time_results','tme_closed_time_result_lines','tme_closed_time_result_sources','tme_payroll_handoffs',
    'tme_command_receipts','tme_inbox_receipts','tme_outbox_events'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', target_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = NULLIF(current_setting(''dwp.tenant_id'', true), '''')::BIGINT) WITH CHECK (tenant_id = NULLIF(current_setting(''dwp.tenant_id'', true), '''')::BIGINT)',
      target_table || '_tenant_policy', target_table
    );
  END LOOP;
END $$;
