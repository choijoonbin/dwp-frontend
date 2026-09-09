import argparse
import copy
from datetime import datetime, timezone
import hashlib
import html
import json
from pathlib import Path
import re
import shutil
import struct

parser = argparse.ArgumentParser()
parser.add_argument('run', type=Path)
parser.add_argument('report', type=Path)
args = parser.parse_args()
root = Path('/Users/a10697/Work/DWP/dwp-frontend')
gallery = root / 'docs/05-features/DWP-R1-WRK-001-unified-work-execution/implementation-evidence/2026-09-07-resume/owned-scope-final/gallery-2026-09-08'
run = args.run.resolve()
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
def pixels(path):
    data = path.read_bytes()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', path
    return list(struct.unpack('>II', data[16:24]))
last = json.loads((run / '.last-run.json').read_text())
assert last['status'] == 'passed' and not last['failedTests'], last
report = json.loads(args.report.read_text())
assert report['stats']['unexpected'] == 0 and report['stats']['flaky'] == 0 and report['stats']['expected'] > 0 and not report['errors'], report['stats']
expected_files = {'work-access-review-responsive', 'work-activity-return-focus', 'work-command-center', 'work-direct-action-owner-transition', 'work-hub-foundation', 'work-mobile-accessibility-audit', 'work-personal-design-actions', 'work-route-access', 'work-selected-assist-contract', 'work-source-decisions', 'work-source-design-evidence', 'work-stitch-design-sync', 'work-task-edit-conflict'}
assert {Path(s['file']).name.removesuffix('.spec.ts') for s in report['suites']} == expected_files
assert {p['name'] for p in report['config']['projects']} == {'chromium', 'mobile'}
assert all(Path(p['outputDir']).resolve() == run for p in report['config']['projects'])
assert report['config']['workers'] == 1
assert report['config']['webServer']['reuseExistingServer'] is False
assert report['config']['shard'] is None
assert all(p['repeatEach'] == 1 and p['retries'] == 0 for p in report['config']['projects'])
def executed_tests(suites):
    for suite in suites:
        for spec in suite.get('specs', []):
            for test in spec['tests']:
                yield suite, spec, test
        yield from executed_tests(suite.get('suites', []))
execution = list(executed_tests(report['suites']))
assert len(execution) == report['stats']['expected'] + report['stats']['skipped']
assert len(execution) == 246, 'The complete 13-spec suite registers 123 cases per project'
assert all(sum(t['projectName'] == project for _, _, t in execution) == 123 for project in {'chromium', 'mobile'})
assert all(t['status'] in {'expected', 'skipped'} for _, _, t in execution)
assert all(any(t['projectName'] == project and t['status'] == 'expected' for _, _, t in execution) for project in {'chromium', 'mobile'})
assert all(not t.get('results') or all(r['status'] in {'passed', 'skipped'} for r in t['results']) for _, _, t in execution)
failures = [p for p in run.rglob('*') if p.is_file() and (p.name == 'error-context.md' or re.match(r'test-failed-.*\.png', p.name))]
assert not failures, failures
manifest = json.loads((gallery / 'manifest.json').read_text())
assert len(manifest['frames']) == 18
assert {f['key'] for f in manifest['frames']} == {f'{n:02}-D' for n in range(1,12)} | {f'{n:02}-M' for n in range(1,6)} | {'12-M1', '12-M2'}
old = copy.deepcopy(manifest)
resolved = []
for frame in manifest['frames']:
    if frame['key'] == '12-M1':
        frame['implementation']['selector']['basename'] = 'M1-390-ko-decision-preview.png'
        frame['implementation']['captureMode'] = 'viewport'
        frame['implementation']['selectionReason'] = 'A viewport capture preserves the fixed confirmation dialog and backdrop; the full-page capture combines it with offscreen content.'
    selector = frame['implementation']['selector']
    matches = [p for p in run.rglob(selector['basename']) if re.fullmatch(selector['parentPattern'], p.parent.name) and pixels(p)[0] == selector['requiredPixelWidth']]
    assert len(matches) == 1, (frame['key'], matches)
    source = matches[0]
    assert source.resolve().is_relative_to(run), source
    reference = gallery / frame['designReference']['path']
    assert sha(reference) == frame['designReference']['sha256'], reference
    assert pixels(reference) == frame['designReference']['pixels'], reference
    implementation = frame['implementation']
    implementation.update(sha256=sha(source), pixels=pixels(source), sourcePath=str(source), sourceRunRelativePath=str(source.relative_to(run)))
    resolved.append((source, gallery / implementation['path']))
assert sum(x['implementation']['pixels'][0] >= 1280 for x in manifest['frames']) == 11
assert len({str(s) for s,d in resolved}) == len({str(d) for s,d in resolved}) == 18
manifest['recordedAt'] = datetime.now(timezone.utc).isoformat()
manifest['evidencePolicy'].append('Full-page mobile captures can show fixed navigation across the middle of the long image; viewport interaction assertions are separate. The M1 confirmation uses the viewport capture from the same successful run.')
manifest['evidencePolicy'].append('The Home contribution capture includes explicitly displayed partial data delays; it proves Work contribution rendering and fallback visibility, not all-source Home availability.')
manifest['evidencePolicy'].append('Access Review action groups participate in the shared auxiliary-layer avoidance contract; both browser projects verify launcher/action spacing in the actual viewport.')
manifest['evidencePolicy'] = [note for note in manifest['evidencePolicy'] if not note.startswith('Known visual limitation in11-D:')]
manifest['evidencePolicy'].append('Work AI action controls participate in auxiliary-layer avoidance and are checked against launcher geometry in actual viewports.')
manifest['evidencePolicy'] = list(dict.fromkeys(manifest['evidencePolicy']))
manifest['visualReview'] = '../logs-2026-09-08/visual-review.json'
manifest['sourceRun'] = {'path': str(run), 'lastRunPath': str(run / '.last-run.json'), 'lastRunSha256': sha(run / '.last-run.json'), 'playwrightStatus': 'passed', 'failedTests': [], 'failureArtifactsFound': 0}
manifest['sourceRun'].update(reportPath=str(args.report.resolve()), reportSha256=sha(args.report), stats=report['stats'], specFiles=sorted(expected_files))
manifest['sourceRun'].update(reportBundlePath='../logs-2026-09-08/' + args.report.name, lastRunBundlePath='../logs-2026-09-08/playwright-last-run.json')
manifest['sourceRun'].update(registeredTests=len(execution), outputDirectories=[p['outputDir'] for p in report['config']['projects']], workers=report['config']['workers'], reuseExistingServer=False)
reference_manifest = root / manifest['designReference']['manifestPath']
assert sha(reference_manifest) == manifest['designReference']['manifestSha256']
page = (gallery / 'index.html').read_text()
assert old['sourceRun']['path'] in page and old['recordedAt'] in page
page = page.replace(old['sourceRun']['path'], str(run)).replace(old['recordedAt'], manifest['recordedAt'])
new_policies = '<ul>' + ''.join('<li>' + html.escape(note) + '</li>' for note in manifest['evidencePolicy']) + '</ul>'
page, count = re.subn(r'(<h2 id="evidence-policy">.*?</h2>)\s*<ul>.*?</ul>', lambda m: m[1] + new_policies, page, count=1, flags=re.S)
assert count == 1
for before, after in zip(old['frames'], manifest['frames']):
    for key in ['sha256', 'sourcePath', 'sourceRunRelativePath']:
        page = page.replace(before['implementation'][key], after['implementation'][key])
    width, height = after['implementation']['pixels']
    pattern = r'(<article class="frame" id="' + re.escape(after['key']) + r'">)(.*?)(</article>)'
    def update_frame(match):
        body, count = re.subn(r'(<figcaption>\s*<strong>현재 구현</strong>\s*<span>)\d+×\d+px', lambda m: m[1] + f'{width}×{height}px', match[2])
        assert count == 1, after['key']
        return match[1] + body + match[3]
    page, count = re.subn(pattern, update_frame, page, flags=re.S)
    assert count == 1, after['key']
for source, destination in resolved:
    shutil.copy2(source, destination)
(gallery / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
(gallery / 'index.html').write_text(page)
for frame in manifest['frames']:
    assert sha(gallery / frame['implementation']['path']) == frame['implementation']['sha256']
    assert pixels(gallery / frame['implementation']['path']) == frame['implementation']['pixels']
assert len(list((gallery / 'screens').glob('*.png'))) == 18
print(json.dumps({'captures': 18, 'desktop': 11, 'mobile': 7, 'failureArtifacts': 0, 'manifestSha256': sha(gallery / 'manifest.json'), 'sourceRun': str(run)}, indent=2))
