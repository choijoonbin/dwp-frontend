import hashlib
import json
import subprocess
import sys
from pathlib import Path

root = Path('/Users/a10697/Work/DWP/dwp-frontend')
names = subprocess.check_output(['git', 'ls-files', '-co', '--exclude-standard', '-z'], cwd=root).decode().split('\0')
files = {}
for name in sorted(set(names)):
    path = root / name
    if not name or not path.is_file():
        continue
    if name.startswith(('apps/', 'libs/', 'e2e/', 'scripts/', 'public/', '.yarn/')) or '/' not in name:
        if path.suffix == '.tsbuildinfo' or name.startswith(('.env', '.codex')) or '/dist/' in name or '/node_modules/' in name:
            continue
        files[name] = hashlib.sha256(path.read_bytes()).hexdigest()
payload = {'scope': 'tracked and untracked non-dist apps/libs/e2e/scripts/public/.yarn and root configuration; docs, environment files, local helper files and build output excluded', 'files': files}
payload['sha256'] = hashlib.sha256(json.dumps(files, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
Path(sys.argv[1]).write_text(json.dumps(payload, indent=2) + '\n')
print(json.dumps({'sha256': payload['sha256'], 'files': len(files), 'output': sys.argv[1]}))
