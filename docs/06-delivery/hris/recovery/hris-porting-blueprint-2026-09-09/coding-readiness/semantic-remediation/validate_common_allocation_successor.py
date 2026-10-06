#!/usr/bin/env python3
"""Read-only AUTHOR allocation verifier. Never writes SQL/registers or grants G3.

Git-only facts, exact predecessor slice/test strings and proposed filename slots
are checked. Domain SQL grouping, owner source semantics and native replay are
NOT validated. Existing historical inventory verifier is imported unchanged.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys

HERE = Path(__file__).resolve().parent
BLUEPRINT = HERE.parent.parent
REPO = '/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend'
BASE = '6f1ed92d2610ace3df75f094297032e8b476ef5d'
CURRENT = 'db0d2b5067e6fbee27ee58121c5a4406cab132b9'
FILE_SHA = 'b983d1452c25b35461caf9fd311642dd33447e42f1cfb48dfde9a052dcb46d65'
OLD_SHA = 'a3c9a01a1a2a49bf3dd3dfff5283a880a6eebe424337b5c53632ee6677d3346d'
PRIVATE = {
    'platform-hris-configuration': ('dwp-platform-server', 'hris_configuration',
        'flyway_hris_configuration_history', 'hris-configuration-migration',
        'dwp_hris_configuration_migration', [('CONFIGURATION', 'dwp_hris_configuration_runtime', False)]),
    'platform-hris-protected': ('dwp-platform-server', 'hris_listening_protected',
        'flyway_hris_listening_protected_history', 'hris-listening-protected-migration',
        'dwp_hris_listening_protected_migration', [('LISTENING_ADMISSION', 'dwp_hris_listening_admission_runtime', False)]),
    'platform-hris-insights': ('dwp-platform-server', 'hris_insights',
        'flyway_hris_insights_history', 'hris-insights-migration',
        'dwp_hris_insights_migration', [('INSIGHTS_EXECUTION_WRITE', 'dwp_hris_insights_execution_runtime', False),
            ('INSIGHTS_QUERY', 'dwp_hris_insights_query_runtime', True)]),
    'auth-hris-participation-issuer': ('dwp-auth-server', 'hris_participation_issuer',
        'flyway_hris_participation_issuer_history', 'hris-participation-issuer-migration',
        'dwp_hris_participation_issuer_migration', [('PARTICIPATION_ISSUER', 'dwp_hris_participation_issuer_runtime', False)])
}
PUBLIC_RANGES = {
    'people-main': (50, 72), 'people-performance': (1, 63), 'auth-main': (214, 242),
    'platform-main': (238, 266), 'time-main': (1, 39), 'payroll-main': (1, 49)
}


def strict_load(path: Path):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError('Duplicate JSON key: ' + key)
            result[key] = value
        return result
    def integer_only(raw):
        raise ValueError('JSON fractional/exponential numbers unsupported: ' + raw)
    return json.loads(path.read_text(), object_pairs_hook=pairs, parse_float=integer_only,
        parse_constant=integer_only)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def unique(items, key, label):
    result = {}
    for item in items:
        value = item[key]
        require(value not in result, 'Duplicate ' + label + ': ' + str(value))
        result[value] = item
    return result


def load_oracle():
    path = HERE / 'validate_common_migration_baseline_proposal.py'
    spec = importlib.util.spec_from_file_location('preserved_inventory', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def inputs(doc):
    pins = unique(doc['sourcePins'], 'path', 'source path')
    required = {'g0/migration-allocation-register.csv', 'g0/file-ownership-register.csv',
        'coding-readiness/g3-file-allocation-register.csv', 'coding-readiness/g3-slice-code-go-register.csv',
        'coding-readiness/physical-owner-prefix-register.csv', 'coding-readiness/target-family-resolution-register.csv',
        'coding-readiness/semantic-remediation/common-migration-baseline.proposal.v1.json',
        'coding-readiness/semantic-remediation/sys-stream-authority-decision.proposal.v1.md',
        'coding-readiness/semantic-remediation/runtime-only-startup-authority-boundary.proposal.v1.md',
        'coding-readiness/semantic-remediation/stream-authority-composite-scaffold.v1.md',
        'coding-readiness/reports/workforce-controlled-export-registration-diagnostic-2026-09-14.json',
        'coding-readiness/reports/workforce-controlled-export-registration-diagnostic-2026-09-14.md'}
    require(set(pins) == required, 'Required current/historical register/source pin scope differs')
    for relative, pin in pins.items():
        path = BLUEPRINT / relative
        require(not Path(relative).is_absolute() and '..' not in Path(relative).parts,
            'Source pin outside blueprint')
        require(sha(path) == pin['sha256'], 'Source pin changed: ' + relative)
    old = HERE / 'common-migration-baseline.proposal.v1.json'
    require(sha(old) == OLD_SHA, 'Preserved historical proposal bytes changed')
    predecessor = strict_load(old)
    with (HERE.parent / 'g3-slice-code-go-register.csv').open(newline='') as stream:
        slices = unique(list(csv.DictReader(stream)), 'slice_id', 'registered slice')
    return predecessor, slices


def expected_rows(predecessor, slices):
    result = {}
    for group in predecessor['successorAllocationDesign']:
        for old in group['namedSliceProposal']:
            source_id = old['sliceId']
            require(source_id in slices, 'Predecessor refers to unregistered slice')
            source = slices[source_id]
            require(source['planned_migration_file'] != 'NO_MIGRATION_RETIRED',
                'Retired slice cannot receive reservation')
            if source_id.startswith('MOD-SYS-'):
                targets = ['platform-hris-configuration', 'platform-hris-insights']
                if source_id == 'MOD-SYS-LISTEN':
                    targets += ['platform-hris-protected', 'auth-hris-participation-issuer']
                version = {'MOD-SYS-LISTEN': 2, 'MOD-SYS-ANALYTICS': 3, 'MOD-SYS-AI': 4}[source_id]
                for target in targets:
                    service, _, _, directory, _, _ = PRIVATE[target]
                    tag = {'platform-hris-configuration': 'hris_configuration',
                        'platform-hris-insights': 'hris_insights', 'platform-hris-protected': 'hris_protected',
                        'auth-hris-participation-issuer': 'hris_issuer'}[target]
                    filename = f'{service}/src/main/resources/db/{directory}/V{version}__{tag}_modern_{source_id[8:].lower()}.sql'
                    result[f'SA-{source_id}-{target}'] = (source, old, target, version, filename)
            else:
                version = old['version'] + (1 if group['stream'] in ['auth-main', 'people-main'] else 0)
                filename = re.sub(r'/V\d+__', f'/V{version}__', old['proposalFile'])
                result['SA-' + source_id] = (source, old, group['stream'], version, filename)
    return result


def check_private(streams):
    for key, values in PRIVATE.items():
        service, schema, history, directory, migration, purposes = values
        row = streams[key]
        require((row['service'], row['schema'], row['historyTable'], row['migrationDir'],
            row['location'], row['migrationPrincipal']) == (service, schema, history,
                f'{service}/src/main/resources/db/{directory}', f'classpath:db/{directory}', migration),
            'Private stream binding mismatch: ' + key)
        require(row['status'] == 'DESIGN_REGISTERED_NOT_IMPLEMENTED' and row['createSchemas'] is False
            and row['bootstrapOwner'] == 'EXTERNAL_CONTROL_ONLY_NOT_APP', 'Private implementation/DDL false claim')
        require(len(row['runtimePrincipals']) == len(purposes), 'Private purpose cardinality')
        for actual, (purpose, principal, readonly) in zip(row['runtimePrincipals'], purposes):
            require((actual['purpose'], actual['principal'], actual['readOnly']) == (purpose, principal, readonly)
                and actual['readOnly'] is readonly, 'Private purpose/role/readOnly mismatch')
            require(actual['searchPath'] == ['pg_catalog', schema] and
                actual['objectGrants'] == 'DENY_ALL_UNTIL_EXACT_OWNER_OBJECT_ALLOWLIST_APPROVED',
                'Private path/default grant mismatch')
        require(row['crossBoundary'] == 'VERSIONED_PUBLIC_UUID_OWNER_PORT_ONLY_NO_CROSS_SCHEMA_FK_IMPORT',
            'Private cross-boundary policy changed')


def structure(doc, predecessor, slices, oracle_groups):
    require(set(doc) == {'schemaVersion', 'contractId', 'status', 'authorValidationOnly', 'readinessPass',
        'g3Authorization', 'scope', 'committedBaseline', 'sourcePins', 'streams', 'ranges', 'moduleReservations',
        'commonReservations', 'predecessorDisposition', 'payrollDefault', 'requiredPublicationInputs', 'openIssues'},
        'Unknown/missing allocation envelope or executable mixed dialect')
    require(type(doc.get('schemaVersion')) is int and doc['schemaVersion'] == 1
        and doc['contractId'] == 'COMMON_ALLOCATION_SUCCESSOR_V1', 'Wrong typed contract envelope')
    require(doc['status'] == 'DESIGN_PROPOSED_NOT_CANONICAL' and doc['readinessPass'] is False
        and doc['authorValidationOnly'] is True and doc['g3Authorization'] == 'NONE', 'Author/G3 boundary changed')
    for field in ['historicalInputsEdited', 'canonicalRegistersEdited', 'backendOrFrontendEdited', 'workingTreeSqlRead']:
        require(doc['scope'][field] is False, 'Write/SQL scope false claim')
    require(doc['scope']['sourceApproval'] == 'NONE' and doc['scope']['newRuntimeWiring'] == 'OUT_OF_SCOPE_NOT_IMPLEMENTED',
        'Unimplemented runtime/source falsely approved')
    streams = unique(doc['streams'], 'streamKey', 'stream identity')
    expected_streams = {x['streamKey'] for x in oracle_groups if x['boundary'] == 'CONTROL'} | set(PRIVATE)
    require(set(streams) == expected_streams, '8-service/13-stream exact scope mismatch')
    check_private(streams)
    for actual in oracle_groups:
        if actual['boundary'] == 'CONTROL':
            require(all(streams[actual['streamKey']].get(k) == v for k, v in actual.items() if k != 'files'),
                'Current scalar stream reclassified or historical metadata drift')
    expected = expected_rows(predecessor, slices)
    registered_scope = {key for key, row in slices.items()
        if row['planned_migration_file'] not in ['NO_MIGRATION_RETIRED', 'NO_MIGRATION_QUERY_ONLY']}
    require({item[0]['slice_id'] for item in expected.values()} == registered_scope,
        'Historical tentative slots omit/extend actual registered schema-touch scope')
    rows = unique(doc['moduleReservations'], 'reservationId', 'reservation ID')
    require(set(rows) == set(expected), 'Missing/extra exact registered successor reservation')
    checks = 0
    for key, (source, old, stream, version, filename) in expected.items():
        row = rows[key]
        exact = {'sourceSliceId': source['slice_id'], 'sourceOwnerSession': source['session_id'],
            'sourcePlannedFile': source['planned_migration_file'], 'previousTentativeFile': old['proposalFile'],
            'sourceAllocationIds': source['migration_allocation_ids'], 'testEvidenceRefs': source['test_evidence_refs'],
            'g3VerificationCommands': source['g3_verification_commands'], 'g4Assertions': source['required_g4_assertions'],
            'sourceSchemaRefs': source['schema_state_contract_refs'], 'streamKey': stream, 'version': version,
            'exactFilename': filename, 'writerAction': 'CREATE_ONLY', 'controlAction': 'MERGE_IDENTICAL_GIT_BLOB_NO_REWRITE',
            'permissionState': 'DESIGN_RESERVATION_NOT_CREATE_AUTHORIZATION', 'semanticClosure': 'NOT_CERTIFIED'}
        require(all(row.get(k) == v for k, v in exact.items()) and type(row['version']) is int,
            'Exact slice/filename/test/source/CREATE binding differs: ' + key)
        require(row['writerRole'] == 'ROLE.HRIS_' + source['session_id'][5:] + '_ENGINEERING', 'Owner writer differs')
        if stream == 'platform-main':
            require(row['routeStatus'] == 'LEGACY_PUBLIC_ROUTE_REQUIRES_OWNER_TABLE_RECLASSIFICATION',
                'Legacy private-routing gap must remain OPEN')
        checks += len(exact)
    common = unique(doc['commonReservations'], 'reservationId', 'common ID')
    require(set(common) == {'SC-WCE-REGISTRY', 'SC-PEOPLE-NATIVE-EMPLOYER-UUID'} | {'SC-' + k for k in PRIVATE}, 'Exact common reservations differ')
    for key, row in common.items():
        stream = 'auth-main' if key == 'SC-WCE-REGISTRY' else 'people-main' if key == 'SC-PEOPLE-NATIVE-EMPLOYER-UUID' else key[3:]
        version = 213 if key == 'SC-WCE-REGISTRY' else 49 if key == 'SC-PEOPLE-NATIVE-EMPLOYER-UUID' else 1
        tag = streams[stream]['schema'].replace('listening_', '').replace('participation_', '')
        name = 'V213__publish_workforce_controlled_export_resource_catalog_only.sql' if version == 213 else 'V49__add_native_legal_employer_public_id.sql' if version == 49 else f'V1__{tag}_privilege_baseline.sql'
        require(row['streamKey'] == stream and row['version'] == version and type(row['version']) is int
            and row['exactFilename'] == streams[stream]['migrationDir'] + '/' + name,
            'Common slot does not bind exact stream/filename')
        require(row['approval'].endswith('NOT_PRESENT'), 'Common reservation falsely approved')
        require(row['writerRole'] == 'ROLE.INTEGRATION_CONTROL' and row['writerAction'] == 'CREATE_ONLY'
            and row['controlAction'] == 'MERGE_IDENTICAL_GIT_BLOB_NO_REWRITE'
            and row['deliverySubroot'] == streams[stream]['migrationDir'], 'Common Control owner/delivery boundary changed')
        require(row['testPath'].startswith(streams[stream]['service'] + '/src/test/java/')
            and row['testPath'].endswith('PostgresTest.java'), 'Common native test path missing/wrong owner')
        if version == 49:
            require(row['writerRole'] == 'ROLE.INTEGRATION_CONTROL' and row['writerAction'] == 'CREATE_ONLY'
                and row['controlAction'] == 'MERGE_IDENTICAL_GIT_BLOB_NO_REWRITE', 'Native allocator common/HRM ownership conflict')
            native = row['nativeColumnProposal']
            require((native['table'], native['column'], native['type'], native['default']) ==
                ('public.ppl_legal_employers', 'public_id', 'UUID', 'pg_catalog.gen_random_uuid()')
                and native['notNull'] is True and native['uniqueness'] == [['public_id'], ['tenant_id', 'public_id']],
                'Native employer UUID must be actual owner allocator with NOT NULL/tenant uniqueness')
    all_rows = list(rows.values()) + list(common.values())
    seen = set()
    for row in all_rows:
        key = (row['streamKey'], row['version'])
        require(key not in seen, 'Module/common or private reservation collision')
        seen.add(key)
        require('..' not in Path(row['exactFilename']).parts, 'Filename traversal')
        existing = next((x for x in oracle_groups if x['streamKey'] == row['streamKey']), None)
        if existing:
            normalized = (row['version'],)
            committed = {tuple(map(int, x['version'].split('.'))) for x in existing['files'] if x['version']}
            require(normalized not in committed, 'Proposed reservation consumes committed version')
    ranges = unique(doc['ranges'], 'streamKey', 'range')
    require(set(ranges) == set(PUBLIC_RANGES) | set(PRIVATE), 'Range scope incomplete')
    for stream, spec in ranges.items():
        lower, upper = PUBLIC_RANGES.get(stream, (2, 4 if stream in ['platform-hris-configuration', 'platform-hris-insights'] else 2))
        require((spec['start'], spec['end'], spec['capacity']) == (lower, upper, upper-lower+1)
            and type(spec['start']) is int and type(spec['end']) is int, 'Range boundaries/capacity altered')
        used = {row['version'] for row in rows.values() if row['streamKey'] == stream}
        require(used <= set(range(lower, upper+1)) and spec['namedReservationCount'] == len(used)
            and spec['unusedVersions'] == [v for v in range(lower, upper+1) if v not in used], 'Capacity closure differs')
        require(not any(k == stream and lower <= v <= upper for k, v in
            [(r['streamKey'], r['version']) for r in common.values()]), 'Range overlaps common private/registry reservation')
    pay = doc['payrollDefault']
    require((pay['streamKey'], pay['schema'], pay['prefix'], pay['historyTable'], pay['location'], pay['decision']) ==
        ('payroll-main', 'public', 'pay_', 'flyway_schema_history', 'classpath:db/migration', 'KEEP_CURRENT_DEFAULT'),
        'PAY default changed without architecture successor')
    require(all(x['state'] in ['OPEN', 'NOT_EXECUTED', 'NOT_AUTHORIZED'] for x in doc['openIssues']), 'OPEN falsely closed')
    return {'exactSliceReservations': len(rows), 'exactCommonReservations': len(common),
        'traceFieldComparisons': checks, 'privateStreamBindings': len(PRIVATE), 'ranges': len(ranges),
        'legacyPublicRoutingStillOpen': sum(r['streamKey'] == 'platform-main' for r in rows.values())}


def verify(doc, repo=REPO):
    predecessor, slices = inputs(doc)
    oracle = load_oracle()
    baseline = doc['committedBaseline']
    require(baseline['historicalCommit'] == BASE and baseline['currentCommit'] == CURRENT,
        'Exact committed baseline replaced')
    actual = oracle.inventory(repo, BASE, CURRENT)
    require(actual['historicalSqlFiles'] == baseline['historicalSqlCount'] == 503
        and actual['currentSqlFiles'] == baseline['currentSqlCount'] == 521
        and len(actual['addedPaths']) == baseline['addedOnly'] == 18, 'Git inventory cardinality drift')
    fingerprint = hashlib.sha256(json.dumps({'streams': actual['streams'], 'localFixtureFiles': actual['localFixtureFiles']},
        sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    require(fingerprint == baseline['fullFileManifestSha256'] == FILE_SHA, 'Exact 521-file Git blob/SHA manifest changed')
    require(actual['currentTree'] == baseline['currentTree'] and actual['baseTree'] == baseline['historicalTree'], 'Git tree changed')
    for pin in baseline['currentGitBlobPins']:
        oid = oracle.git(repo, 'rev-parse', CURRENT + ':' + pin['path']).decode().strip()
        require(oid == pin['gitBlobOid'] and hashlib.sha256(oracle.blob(repo, oid)).hexdigest() == pin['sha256'], 'Git input changed')
    result = structure(doc, predecessor, slices, actual['streams'])
    result.update({'historicalImmutableFiles': 503, 'committedFiles': 521, 'addedOnly': 18,
        'historicalRegisters': 'UNCHANGED', 'workingTreeSqlRead': False, 'nativeSqlReplay': 'NOT_EXECUTED',
        'sqlBusinessSemanticCapacity': 'NOT_VERIFIED', 'canonicalSuccessorPublication': 'NOT_IMPLEMENTED',
        'authorOnly': True, 'readinessPass': False, 'g3Authorization': 'NONE', 'currentCommit': CURRENT})
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--proposal', type=Path, default=HERE / 'common-allocation-successor.v1.json')
    parser.add_argument('--repo', default=REPO)
    parser.add_argument('--require-g3', action='store_true')
    args = parser.parse_args()
    try:
        result = verify(strict_load(args.proposal), args.repo)
        print(json.dumps(result, sort_keys=True))
        if args.require_g3:
            print('G3_DENIED: author reservation design is not canonical approval', file=sys.stderr)
            return 1
        return 0
    except (ValueError, KeyError, TypeError, OSError) as exc:
        print(json.dumps({'authorOnly': True, 'readinessPass': False, 'error': str(exc)}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
