"""Build a deterministic, instruction-only skill ZIP; no runtime dependencies."""
from pathlib import Path
import hashlib,json,subprocess,zipfile,argparse

root=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser()
parser.add_argument('--out',default='artifacts/skill')
args=parser.parse_args()
out=(root/args.out).resolve()
assert out.is_relative_to(root) and out!=root, 'Output must stay inside the workspace'
manifest=json.loads(subprocess.check_output(['node',str(root/'scripts/validate-skill.mjs')],cwd=root,encoding='utf-8'))
folder=root/'skills/sixhat-compass'
out.mkdir(parents=True,exist_ok=True)
name=f"sixhat-compass-skill-{manifest['version']}.zip"
target=out/name
with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_STORED) as archive:
    for entry in manifest['files']:
        raw=(folder/entry['path']).read_bytes().replace(b'\r\n',b'\n')
        assert hashlib.sha256(raw).hexdigest()==entry['sha256'], 'Source changed during packaging'
        info=zipfile.ZipInfo('sixhat-compass/'+entry['path'],date_time=(2020,1,1,0,0,0))
        # Explicit metadata and stored bytes avoid OS/zlib-dependent archives.
        info.create_system=3
        info.compress_type=zipfile.ZIP_STORED
        info.external_attr=0o100644 << 16
        archive.writestr(info,raw,compress_type=zipfile.ZIP_STORED)
digest=hashlib.sha256(target.read_bytes()).hexdigest()
(out/'SHA256SUMS.txt').write_bytes(f'{digest}  {name}\n'.encode('ascii'))
manifest.update({'archive':name,'sha256':digest,'runtimeDependencies':[]})
(out/'package-manifest.json').write_bytes((json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None
    assert sorted(archive.namelist())==sorted('sixhat-compass/'+e['path'] for e in manifest['files'])
print(json.dumps({'archive':name,'sha256':digest,'files':len(manifest['files'])}))
