import { freezeTypedJson, typedDecimal, typedNumeric } from './approval-form-typed-model';
import {
  workflowExactKeys,
  workflowInteger,
  workflowInvalid,
  workflowObject,
} from './approval-workflow-typed-model';

import type { CompiledApprovalTypedForm } from './approval-form-typed-model';
import type {
  ApprovalTypedWorkflowClause,
  ApprovalTypedWorkflowCondition,
  ApprovalTypedWorkflowDefinition,
  ApprovalTypedWorkflowScalar,
} from './approval-workflow-typed-model';

function scalar(raw: unknown, path: string): ApprovalTypedWorkflowScalar {
  if (
    typeof raw === 'string' &&
    raw.length <= 2000 &&
    Array.from(raw).every((character) => {
      const code = character.codePointAt(0)!;
      return code > 31 && (code < 127 || code > 159);
    })
  )
    return raw;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number')
    return workflowInteger(raw, -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, path);
  return workflowInvalid('condition-scalar', path);
}

export function compileApprovalTypedWorkflowCondition(
  raw: unknown,
  path: string
): ApprovalTypedWorkflowCondition {
  const condition = workflowObject(raw, path);
  workflowExactKeys(condition, ['all'], path);
  if (!Array.isArray(condition.all) || condition.all.length < 1 || condition.all.length > 50)
    workflowInvalid('condition-clause-count', `${path}.all`);
  const all = Array.from(condition.all).map((rawClause, index): ApprovalTypedWorkflowClause => {
    const clausePath = `${path}.all[${index}]`;
    const clause = workflowObject(rawClause, clausePath);
    workflowExactKeys(clause, ['field', 'operator', 'value'], clausePath);
    if (typeof clause.field !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_]{0,79}$/u.test(clause.field))
      workflowInvalid('condition-field', `${clausePath}.field`);
    if (clause.operator === 'IN') {
      if (!Array.isArray(clause.value) || clause.value.length < 1 || clause.value.length > 50)
        workflowInvalid('condition-in-count', `${clausePath}.value`);
      return Object.freeze({
        field: clause.field,
        operator: 'IN',
        value: Object.freeze(
          Array.from(clause.value).map((value, valueIndex) =>
            scalar(value, `${clausePath}.value[${valueIndex}]`)
          )
        ),
      });
    }
    if (
      clause.operator !== 'EQ' &&
      clause.operator !== 'GT' &&
      clause.operator !== 'GTE' &&
      clause.operator !== 'LT' &&
      clause.operator !== 'LTE'
    )
      workflowInvalid('condition-operator', `${clausePath}.operator`);
    return Object.freeze({
      field: clause.field,
      operator: clause.operator,
      value: scalar(clause.value, `${clausePath}.value`),
    });
  });
  const result = Object.freeze({ all: Object.freeze(all) });
  try {
    freezeTypedJson(result);
  } catch {
    workflowInvalid('condition-complexity', path);
  }
  return result;
}

export function approvalTypedWorkflowRouteFieldOptions(schema: CompiledApprovalTypedForm) {
  return schema.scope.order.filter(
    (field) => field.type !== 'REPEATING_GROUP' && field.visibleWhen === null
  );
}

/** Static field checks only; a compiled schema is not a runtime source decision or SIM capability. */
export function validateApprovalTypedWorkflowRouteFields(
  definition: ApprovalTypedWorkflowDefinition,
  schema?: CompiledApprovalTypedForm
): 'NO_CONDITIONS' | 'SOURCE_UNKNOWN' | 'FIELDS_VALID' {
  if (!definition.stages.some((stage) => stage.routeCondition !== undefined))
    return 'NO_CONDITIONS';
  if (!schema) return 'SOURCE_UNKNOWN';
  definition.stages.forEach((stage, stageIndex) =>
    stage.routeCondition?.all.forEach((clause, index) => {
      const path = `stages[${stageIndex}].routeCondition.all[${index}]`;
      const field = Object.hasOwn(schema.scope.fields, clause.field)
        ? schema.scope.fields[clause.field]
        : undefined;
      if (!field || field.type === 'REPEATING_GROUP' || field.visibleWhen !== null)
        workflowInvalid('condition-field-source', `${path}.field`);
      if (!typedNumeric(field) && clause.operator !== 'EQ' && clause.operator !== 'IN')
        workflowInvalid('condition-numeric-field', `${path}.operator`);
      if (typedNumeric(field)) {
        const values = clause.operator === 'IN' ? clause.value : [clause.value];
        values.forEach((value) => {
          try {
            typedDecimal(value);
          } catch {
            workflowInvalid('condition-decimal', `${path}.value`);
          }
        });
      }
    })
  );
  return 'FIELDS_VALID';
}

/** The codes must come from a current owner source. Presence does not assert active/staffed authority. */
export function inspectApprovalTypedWorkflowRoleCodes(
  definition: ApprovalTypedWorkflowDefinition,
  roleCodes?: readonly string[]
): Readonly<{
  status: 'SOURCE_UNKNOWN' | 'INVALID_SOURCE' | 'REFERENCES_PRESENT' | 'MISSING_ROLES';
  missing: readonly string[];
}> {
  if (!roleCodes) return Object.freeze({ status: 'SOURCE_UNKNOWN', missing: Object.freeze([]) });
  if (
    !Array.isArray(roleCodes) ||
    roleCodes.length > 1000 ||
    Array.from(roleCodes).some(
      (code) => typeof code !== 'string' || !/^[A-Z][A-Z0-9_]{1,49}$/u.test(code)
    ) ||
    new Set(roleCodes).size !== roleCodes.length
  )
    return Object.freeze({ status: 'INVALID_SOURCE', missing: Object.freeze([]) });
  const codes = new Set(roleCodes);
  const missing = Object.freeze([
    ...new Set(
      definition.stages.map((stage) => stage.candidateRole).filter((role) => !codes.has(role))
    ),
  ]);
  return Object.freeze({
    status: missing.length ? 'MISSING_ROLES' : 'REFERENCES_PRESENT',
    missing,
  });
}
