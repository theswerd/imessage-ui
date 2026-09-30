#!/usr/bin/env python3
"""Run the native Messages reference and registry journeys in a real iOS simulator."""
import argparse
import datetime
import json
import pathlib
import shutil
import signal
import subprocess
import sys
import urllib.request
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--udid', required=True, help='Dedicated iPhone 17 Pro / iOS 26.0 simulator UDID')
parser.add_argument('--base-url', default='http://localhost:3100')
parser.add_argument('--runtime-build', help='Optional Xcode SDK runtime override, e.g. 23A343')
parser.add_argument('--initial-path', default='/components/image-viewer')
parser.add_argument('--only-testing', help='Optional XCTest identifier, e.g. SimulatorReview/SimulatorReview/testConversationList')
parser.add_argument('--output', type=pathlib.Path, default=ROOT / 'artifacts' / 'ios-review' / datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
args = parser.parse_args()
output = args.output.resolve()
output.mkdir(parents=True, exist_ok=True)
initial_url = args.base_url.rstrip('/') + args.initial_path + ('&' if '?' in args.initial_path else '?') + urllib.parse.urlencode({'review': output.name})
with urllib.request.urlopen(args.base_url.rstrip('/') + args.initial_path, timeout=10) as response:
    if response.status != 200:
        raise RuntimeError(f'Preview server returned HTTP {response.status}')


def run(*command, **kwargs):
    return subprocess.run(command, cwd=ROOT, check=True, **kwargs)


def boot():
    devices = json.loads(subprocess.check_output(['xcrun', 'simctl', 'list', 'devices', '--json']))
    device = next(device for group in devices['devices'].values() for device in group if device['udid'] == args.udid)
    if device['state'] != 'Booted':
        run('xcrun', 'simctl', 'boot', args.udid)
    run('xcrun', 'simctl', 'bootstatus', args.udid, '-b')


recording = None
sdk_version = subprocess.check_output(['xcrun', '--sdk', 'iphoneos', '--show-sdk-version'], text=True).strip()
try:
    if args.runtime_build:
        run('xcrun', 'simctl', 'runtime', 'match', 'set', f'iphoneos{sdk_version}', args.runtime_build)
    boot()
    app = output / 'ViewerReference.app'
    app.mkdir(exist_ok=True)
    shutil.copy(ROOT / 'tests/ios/ViewerReference.plist', app / 'Info.plist')
    for photo in ['lake', 'cabin', 'mountain']:
        shutil.copy(ROOT / f'public/showcase/{photo}.jpg', app / f'{photo}.jpg')
    shutil.copy(ROOT / 'public/fixtures/viewer-probe.jpg', app / 'viewer-probe.jpg')
    sdk = subprocess.check_output(['xcrun', '--sdk', 'iphonesimulator', '--show-sdk-path'], text=True).strip()
    run('xcrun', 'clang', '-target', 'arm64-apple-ios18.0-simulator', '-isysroot', sdk, '-fobjc-arc', '-framework', 'UIKit', '-framework', 'QuickLook', str(ROOT / 'tests/ios/ViewerReference.m'), '-o', str(app / 'ViewerReference'))
    run('codesign', '--force', '--sign', '-', str(app))
    run('xcrun', 'simctl', 'install', args.udid, str(app))
    project = ROOT / 'tests/ios/SimulatorReview.xcodeproj'
    build = output / 'build'
    common = ['-project', str(project), '-scheme', 'SimulatorReview', '-destination', f'platform=iOS Simulator,id={args.udid}', '-derivedDataPath', str(build), 'CODE_SIGNING_ALLOWED=NO']
    with (output / 'build.log').open('w') as log:
        run('xcodebuild', 'build-for-testing', *common, stdout=log, stderr=subprocess.STDOUT)
    run('xcrun', 'simctl', 'launch', args.udid, 'com.apple.mobilesafari')
    run('xcrun', 'simctl', 'openurl', args.udid, initial_url)
    with (output / 'recording.log').open('w') as recording_log, (output / 'test.log').open('w') as log:
        recording = subprocess.Popen(['xcrun', 'simctl', 'io', args.udid, 'recordVideo', '--codec', 'h264', str(output / 'walkthrough.mp4')], stdout=recording_log, stderr=subprocess.STDOUT)
        selection = [f'-only-testing:{args.only_testing}'] if args.only_testing else []
        test = subprocess.Popen(['xcodebuild', 'test-without-building', *common, *selection, '-parallel-testing-enabled', 'NO', '-collect-test-diagnostics', 'never', '-resultBundlePath', str(output / 'review.xcresult')], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        for line in test.stdout:
            log.write(line)
            log.flush()
            if 'Test Suite' in line and (' passed ' in line or ' failed ' in line) and recording.poll() is None:
                recording.send_signal(signal.SIGINT)
                try:
                    recording.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    recording.terminate()
        code = test.wait()
    run('xcrun', 'xcresulttool', 'export', 'attachments', '--path', str(output / 'review.xcresult'), '--output-path', str(output / 'screenshots'))
    print(f'XCTest exit: {code}. Screenshots, recording and result bundle: {output}', flush=True)
    sys.exit(code)
finally:
    if recording and recording.poll() is None:
        recording.send_signal(signal.SIGINT)
        try:
            recording.wait(timeout=15)
        except subprocess.TimeoutExpired:
            recording.terminate()
    if args.runtime_build:
        run('xcrun', 'simctl', 'runtime', 'match', 'set', f'iphoneos{sdk_version}', '--default')
    # XCTest shuts its simulator down. Restore Safari for continued manual review.
    boot()
    run('xcrun', 'simctl', 'launch', args.udid, 'com.apple.mobilesafari')
    run('xcrun', 'simctl', 'openurl', args.udid, initial_url)
