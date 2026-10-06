#!/usr/bin/env python3
"""AUTHOR-only resource registry policy model and artifact text linter.

No SQL/DB/BE/FE/Gate is changed or executed. This is not a SQL parser or native
authorization/CAS/PEP proof. Historical WCE diagnosis remains pinned unchanged.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys

HERE = Path(__file__).resolve().parent
BLUEPRINT = HERE.parent.parent
RESOURCE = 'ACTION.WORKFORCE_CONTROLLED_EXPORT'
DIAGNOSTIC_SHA = '32630c2b23f886c0da98b02e4e7f421dde61fa01ff8d11d99d99478f2cef7729'
DIAGNOSTIC_MD_SHA = 'e85b91a7eea4ab1f65ced46251713f3a3a2594d6a79f91a465b984ac02f193c6'
spec = importlib.util.spec_from_file_location('successor_inputs', HERE / 'validate_common_allocation_successor.py')
allocation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(allocation)
load = allocation.strict_load
require = allocation.require


def publication_model(state):
    """Synthetic expected insert-only lifecycle, NOT an Auth provisioner."""
    result = copy.deepcopy(state)
    factory = state.get('factory')
    if factory is not None:
        require(factory == {'resourceKey': RESOURCE, 'type': 'ACTION',
            'requiredEntitlement': 'core.people', 'state': 'RETIRED'}, 'Unsafe/conflicting automatic factory')
    for row in state['resources']:
        require(row['key'] != RESOURCE or row['type'] == 'ACTION', 'Resource type collision')
    changes = []
    for tenant in state['tenants']:
        tenant_id = tenant['tenantId']
        require(type(tenant_id) is int and tenant_id > 0, 'Invalid native tenant identity')
        if tenant['status'] != 'ACTIVE' or tenant['hcmEnabled'] is not True or tenant['rootBound'] is not True:
            continue
        existing = [row for row in state['resources'] if row['tenantId'] == tenant_id
            and row['type'] == 'ACTION' and row['key'] == RESOURCE]
        require(len(existing) <= 1, 'Synthetic duplicate native resource key')
        if existing:
            continue
        # Synthetic ID token only; never a DB ID allocator or native receipt.
        result['resources'].append({'tenantId': tenant_id, 'type': 'ACTION', 'key': RESOURCE,
            'resourceId': 'SYNTHETIC_NEW_' + str(tenant_id), 'enabled': False, 'updatedAt': 'SYNTHETIC_INSERT'})
        changes.append(tenant_id)
    return result, changes


def proposed_reenable_model(row, request):
    """Future contract counterexample model; not implemented physical owner CAS."""
    require(request['tenantId'] == row['tenantId'] and request['resourceId'] == row['resourceId'], 'Foreign target')
    require(row['enabled'] is False and request['expectedUpdatedAt'] == row['updatedAt'], 'Stale/invalid resource CAS')
    for gate in ['exactAdminScope', 'currentEntitlement', 'governedReasonApproved', 'sodAllowed', 'explicitChange']:
        require(request[gate] is True, 'Missing reenable gate: ' + gate)
    result = copy.deepcopy(row)
    result['enabled'] = True
    return result


def fixture_checks(doc):
    fixtures = doc['fixtures']
    require(type(doc['schemaVersion']) is int and doc['schemaVersion'] == 1
        and doc['mode'] == 'SYNTHETIC_POLICY_MODEL_NOT_NATIVE_AUTH', 'Wrong fixture envelope')
    require(len({row['caseId'] for row in fixtures}) == len(fixtures), 'Duplicate fixture ID')
    results = []
    for case in fixtures:
        failed = False
        try:
            if case['kind'] == 'PUBLICATION':
                after, changes = publication_model(case['before'])
                require(changes == case['expectedInsertedTenantIds'], 'Wrong selected tenant insertion')
                for row in case['before']['resources']:
                    require(row in after['resources'], 'Existing enabled/disabled/id/metadata modified')
                for name in ['factory', 'grants', 'adminAssignments', 'rootMembers', 'bundlePointer', 'peopleExportGuards']:
                    require(after[name] == case['before'][name], 'No-grant/no-activation boundary drift')
                replay, replay_changes = publication_model(after)
                require(replay == after and replay_changes == [], 'Idempotent replay drift')
            elif case['kind'] == 'REENABLE_FUTURE_CONTRACT':
                proposed_reenable_model(case['resource'], case['request'])
            else:
                raise ValueError('Unknown fixture kind')
        except ValueError:
            failed = True
        require(failed == (case['expected'] == 'REJECT'), 'Fixture expected acceptance/denial differs: ' + case['caseId'])
        results.append({'caseId': case['caseId'], 'result': 'EXPECTED_SYNTHETIC_POLICY_RESULT', 'nativeExecuted': False})
    return results


def artifact_lint(text):
    require('ARTIFACT_ONLY_NOT_APPLIED' in text, 'Artifact warning missing')
    source = re.sub(r'--[^\n]*', '', text)
    inserts = re.findall(r'\bINSERT\s+INTO\s+([a-z_]+\.[a-z_]+)', source, flags=re.I)
    require(inserts == ['public.com_resources'], 'Unexpected write target')
    require(not re.search(r'\b(UPDATE|DELETE|GRANT|REVOKE|CREATE|ALTER|DROP|TRUNCATE|COPY|EXECUTE)\b', source, re.I),
        'Forbidden mutation/DDL/privilege/dynamic execution')
    require(not re.search(r'\bSET\s+(ROLE|SESSION\s+AUTHORIZATION)\b', source, re.I), 'Role escape')
    require(source.count('DO NOTHING') == 1 and source.count('ON CONFLICT') == 1, 'Insert-only replay contract changed')
    require("lifecycle_state <> 'RETIRED'" in source and 'FALSE\n  FROM public.com_tenants' in source,
        'Disabled factory/resource contract changed')
    require("tenant.status = 'ACTIVE'" in source and "hcm.key = 'APP.HCM' AND hcm.enabled = TRUE" in source
        and "resource_set.resource_set_key = 'RS_HCM_CONFIG'" in source, 'Tenant/admin selection changed')
    require(source.index('LOCK TABLE public.com_resources') < source.index('DO $publication_preflight$'),
        'Registry locks must precede conflict inspection')
    require(set(re.findall(r'\$\{([^}]+)\}', source)) == {'authCatalog', 'authMigrationPrincipal', 'publicationReference'},
        'Unexpected/missing deployment placeholder')
    require('SESSION_USER <> CURRENT_USER' in source and 'CURRENT_USER <>' in source
        and "'Unsafe/conflicting automatic resource factory template'" in source, 'Authority/factory preflight missing')
    return {'insertTargets': inserts, 'forbiddenMutationTokens': 0,
        'meaning': 'TEXT_LINTER_ONLY_NOT_SQL_AST_TRANSACTION_OR_AUTHORITY_PROOF'}


def verify(doc):
    require(type(doc.get('schemaVersion')) is int and doc['schemaVersion'] == 1
        and doc['contractId'] == 'CONTROLLED_EXPORT_RESOURCE_PUBLICATION_V1', 'Wrong typed contract')
    require(doc['status'] == 'DESIGN_PROPOSED_ARTIFACT_ONLY_NOT_APPLIED' and doc['authorValidationOnly'] is True
        and doc['readinessPass'] is False and doc['g3Authorization'] == 'NONE'
        and doc['productionExportActivation'] == 'NOT_AUTHORIZED', 'Author/no-activation boundary changed')
    require(doc['resourceKey'] == RESOURCE, 'Exact capability changed')
    expected_pins = {'coding-readiness/reports/workforce-controlled-export-registration-diagnostic-2026-09-14.json': DIAGNOSTIC_SHA,
        'coding-readiness/reports/workforce-controlled-export-registration-diagnostic-2026-09-14.md': DIAGNOSTIC_MD_SHA}
    require({x['path']: x['sha256'] for x in doc['inputPins']} == expected_pins, 'Historical diagnosis pin substituted')
    for relative, expected in expected_pins.items():
        require(hashlib.sha256((BLUEPRINT / relative).read_bytes()).hexdigest() == expected, 'Historical diagnostic changed')
    for flag in ['noAutomaticPermissionGrants', 'noDefaultUserOrRoleAssignment', 'noAppGrantCloning',
        'noDutiesOrPackages', 'noActivationPointers', 'noGuardChanges']:
        require(doc['authorization'][flag] is True, 'Unsafe resource publication policy: ' + flag)
    require(doc['lifecycle']['legacyFactory']['policy'] == 'NO_NEW_FACTORY_ROW_NO_STATE_CHANGE'
        and doc['lifecycle']['legacyFactory']['activateFactory'] is False
        and doc['lifecycle']['existingActiveFactory'].startswith('FAIL_CLOSED'), 'Unsafe current factory lifecycle')
    require(doc['artifact']['executed'] is False and doc['artifact']['backendFlywayFileCreated'] is False
        and doc['artifact']['containsSchemaOrRoleDdl'] is False and doc['futureNativeEvidence']['executed'] is False,
        'Native/materialization proof falsely claimed')
    successor = load(HERE / 'common-allocation-successor.v1.json')
    registered = next(x for x in successor['commonReservations'] if x['reservationId'] == 'SC-WCE-REGISTRY')
    require((doc['allocation']['streamKey'], doc['allocation']['version'], doc['allocation']['exactFutureFilename']) ==
        (registered['streamKey'], registered['version'], registered['exactFilename']), 'Unregistered/common collision reservation')
    require(doc['allocation']['state'] == 'DESIGN_RESERVATION_NOT_APPROVED_NOT_MATERIALIZED', 'Allocation false approval')
    require(all(x['state'] in ['OPEN', 'NOT_AUTHORIZED'] for x in doc['openIssues']), 'Open prep/activation falsely closed')
    lint = artifact_lint((HERE / doc['artifact']['path']).read_text())
    cases = fixture_checks(load(HERE / 'controlled-export-resource-publication.fixtures.v1.json'))
    return {'authorOnly': True, 'readinessPass': False, 'g3Authorization': 'NONE', 'productionExportActivation': 'NOT_AUTHORIZED',
        'sqlApplied': False, 'nativeAuthTests': 'NOT_EXECUTED', 'syntheticCases': len(cases), 'artifactLint': lint,
        'historicalDiagnosticPins': 2, 'caseResults': cases}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--proposal', type=Path, default=HERE / 'controlled-export-resource-publication.proposal.v1.json')
    parser.add_argument('--require-g3', action='store_true')
    args = parser.parse_args()
    try:
        result = verify(load(args.proposal))
        print(json.dumps(result, sort_keys=True))
        if args.require_g3:
            print('G3_DENIED: resource artifact/model is not native preparation approval', file=sys.stderr)
            return 1
        return 0
    except (ValueError, KeyError, TypeError, OSError) as exc:
        print(json.dumps({'authorOnly': True, 'readinessPass': False, 'error': str(exc)}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
