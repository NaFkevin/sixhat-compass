"""Export an explicit public source tree; never overwrite an existing directory."""
from pathlib import Path
import argparse, hashlib, json, re, shutil

root=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser()
parser.add_argument('--out',default='.release/sixhat-compass')
args=parser.parse_args()
out=(root/args.out).resolve()
assert out.is_relative_to(root) and out!=root, 'Output must be a new child of the workspace'
assert not out.exists(), 'Refusing to overwrite an existing release tree'
files=[root/p for p in ('package.json','package-lock.json','tsconfig.json','cordis.patch.yml','README.md','CHANGELOG.md','LICENSE','THIRD_PARTY_NOTICES.md','CONTRIBUTING.md','SECURITY.md','.gitignore','.gitattributes','.editorconfig')]
for folder in ('src','tests','eval/phase-d/product-snapshot','fixtures','.github','assets','docs/preview','docs/reports/compass-preview'):
    files.extend(p for p in (root/folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
files.extend(root/p for p in ('docs/baseline.md','docs/architecture.md','docs/compatibility.md','docs/RELEASING.md','docs/reports/compass-preview-report.md','docs/reports/desktop-021-report.md','docs/reports/desktop-021.json','docs/reports/desktop-021-settings.png','scripts/build-client.mjs','scripts/phase-d-score.mjs','scripts/prepare-github.py'))
secret=re.compile(rb'(?:sk-[A-Za-z0-9_-]{16,}|[?&]token=[A-Za-z0-9_-]{10,}|Bearer [A-Za-z0-9_-]{15,})')
manifest={}
for path in sorted(set(files)):
    assert path.is_file() and not path.is_symlink(), path
    raw=path.read_bytes()
    if path.suffix!='.png' and 'product-snapshot' not in path.parts:
        raw=raw.replace(b'\r\n',b'\n')
    if path.suffix!='.png':
        assert not secret.search(raw), 'Credential-like content: '+str(path.relative_to(root))
        assert not re.search(rb'[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s]+',raw), 'Local user path: '+str(path.relative_to(root))
    rel=path.relative_to(root)
    dest=out/rel
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_bytes(raw)
    manifest[rel.as_posix()]=hashlib.sha256(raw).hexdigest()
(out/'PUBLIC_FILES.json').write_text(json.dumps({'version':json.loads((root/'package.json').read_text(encoding='utf-8-sig'))['version'],'files':manifest,'scan':'explicit allowlist; credential-like tokens and local user paths rejected; screenshots contain public test material only','remotePublished':False},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'directory':str(out.relative_to(root)),'sourceFiles':len(manifest),'remotePublished':False}))
