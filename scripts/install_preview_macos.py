#!/usr/bin/env python3
"""Install an already-built local preview, preserving state across login and reboot."""
import argparse, os, plistlib, shutil, subprocess, sys
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('binary', type=Path, help='Trusted, locally built macOS English Quest binary')
a=p.parse_args()
if sys.platform!='darwin': p.error('This installer is for macOS only.')
source=a.binary.resolve()
if not source.is_file(): p.error('Binary does not exist.')
base=Path.home()/'Library/Application Support/EnglishQuestPreview'
base.mkdir(parents=True,exist_ok=True)
state=base/'state';state.mkdir(exist_ok=True)
state.chmod(0o700)
label='com.osh.english-preview'
plist=Path.home()/'Library/LaunchAgents'/f'{label}.plist';plist.parent.mkdir(parents=True,exist_ok=True)
domain=f'gui/{os.getuid()}'
subprocess.run(['launchctl','bootout',f'{domain}/{label}'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
# Keep the previous executable available; state is never replaced or copied from production.
target=base/'english-quest-preview'
if target.exists(): shutil.copy2(target,base/'english-quest-preview.previous')
staged=base/'english-quest-preview.new';shutil.copy2(source,staged);staged.chmod(0o755);staged.replace(target)
config={'Label':label,'ProgramArguments':[str(target),'-port','19004','-state-dir',str(state)],
 'WorkingDirectory':str(base),'RunAtLoad':True,'KeepAlive':True,'ThrottleInterval':15,
 'StandardOutPath':str(base/'service.log'),'StandardErrorPath':str(base/'service-error.log'),
 'EnvironmentVariables':{'ENGLISH_PAYMENT_PROVIDER':'mock','ENGLISH_PAYMENT_TEST_PRICES':'1'}}
plist.write_bytes(plistlib.dumps(config))
subprocess.run(['launchctl','bootstrap',domain,str(plist)],check=True)
print('Preview installed at http://127.0.0.1:19004/; local state preserved; payments simulated.')
