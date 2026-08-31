import { spawn } from 'node:child_process';
import { mkdir, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import {
  FIXTURE_PRIVACY_ASSERTIONS,
  SCREENSHOT_SHOTS,
  type ScreenshotShot,
} from './fixtures';
import { isScreenshotShot } from '../lib/screenshot-fixture';

type CaptureSet = 'iphone-69' | 'ipad-13';

const SETS = {
  'iphone-69': { width: 1320, height: 2868, deviceType: 'IPHONE_69' },
  'ipad-13': { width: 2064, height: 2752, deviceType: 'IPAD_PRO_3GEN_129' },
} satisfies Record<CaptureSet, { width: number; height: number; deviceType: string }>;

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const OUTPUT_ROOT = resolve(
  SCRIPT_DIRECTORY,
  '../../../../release/app-store/screenshots/raw',
);

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    'bundle-id': { type: 'string', default: 'com.beegreat.app' },
    help: { type: 'boolean', short: 'h', default: false },
    mode: { type: 'string', default: 'fixture' },
    'output-dir': { type: 'string', default: OUTPUT_ROOT },
    set: { type: 'string' },
    shot: { type: 'string' },
    udid: { type: 'string' },
    'wait-ms': { type: 'string', default: '1400' },
  },
  strict: true,
});

if (values.help) {
  printHelp();
  process.exit(0);
}

const set = values.set;
if (set !== 'iphone-69' && set !== 'ipad-13') {
  fail('Pass --set iphone-69 or --set ipad-13.');
}

const mode = values.mode;
if (mode !== 'fixture' && mode !== 'live-paywall') {
  fail('Pass --mode fixture or --mode live-paywall.');
}

const udid = values.udid?.trim();
if (!udid) fail('Pass the clean, booted simulator UDID with --udid.');

const waitMs = Number(values['wait-ms']);
if (!Number.isFinite(waitMs) || waitMs < 500 || waitMs > 10_000) {
  fail('--wait-ms must be between 500 and 10000.');
}

const bundleId = values['bundle-id'];
const outputRoot = resolve(values['output-dir']);
const captureSet = SETS[set];
const setDirectory = resolve(outputRoot, set);

await assertBooted(udid);
await assertInstalled(udid, bundleId);
await mkdir(setDirectory, { recursive: true });

await run(
  [
    'xcrun',
    'simctl',
    'status_bar',
    udid,
    'override',
    '--time',
    '9:41',
    '--batteryState',
    'charged',
    '--batteryLevel',
    '100',
    '--wifiBars',
    '3',
    '--cellularMode',
    'active',
    '--cellularBars',
    '4',
  ],
  { allowFailure: true },
);
await run(['xcrun', 'simctl', 'ui', udid, 'appearance', 'light'], {
  allowFailure: true,
});

try {
  if (mode === 'fixture') {
    const shots = requestedFixtureShots(values.shot);

    for (const shot of shots) {
      await launchAndVerifyApp(udid, bundleId, waitMs);
      await captureFixtureShot({
        bundleId,
        captureSet,
        outputDirectory: setDirectory,
        shot,
        udid,
        waitMs,
      });
    }
  } else {
    await launchAndVerifyApp(udid, bundleId, waitMs);
    await captureLivePaywall({
      bundleId,
      captureSet,
      outputDirectory: setDirectory,
      set,
      udid,
      waitMs,
    });
  }

  await run([
    'asc',
    'screenshots',
    'validate',
    '--path',
    setDirectory,
    '--device-type',
    captureSet.deviceType,
    '--output',
    'table',
  ]);
} finally {
  await run(['xcrun', 'simctl', 'status_bar', udid, 'clear'], {
    allowFailure: true,
  });
}

for (const assertion of FIXTURE_PRIVACY_ASSERTIONS) {
  console.log(`privacy: ${assertion}`);
}
console.log(`capture complete: ${setDirectory}`);

async function captureFixtureShot({
  bundleId,
  captureSet: expected,
  outputDirectory,
  shot,
  udid: simulatorUdid,
  waitMs: settleMs,
}: {
  bundleId: string;
  captureSet: (typeof SETS)[CaptureSet];
  outputDirectory: string;
  shot: ScreenshotShot;
  udid: string;
  waitMs: number;
}) {
  const url = `beegreat://screenshot-harness?shot=${encodeURIComponent(shot)}`;
  await run(['xcrun', 'simctl', 'openurl', simulatorUdid, url]);
  await delay(settleMs);

  const handshake = `BeeGreat screenshot fixture ready: ${shot}`;
  const readinessDeadline = Date.now() + 30_000;
  let confirmationAttempts = 0;
  let ui = '';

  while (Date.now() < readinessDeadline) {
    ui = await describeUi(simulatorUdid);
    if (isBeeGreatDeepLinkConfirmation(ui)) {
      confirmationAttempts += 1;
      if (confirmationAttempts > 2) {
        fail(
          `Refusing to capture ${shot}: iOS did not dismiss the verified BeeGreat deep-link confirmation.`,
        );
      }
      await run([
        'axe',
        'tap',
        '--label',
        'Open',
        '--pre-delay',
        '1',
        '--post-delay',
        '1',
        '--udid',
        simulatorUdid,
      ]);
      await delay(1_000);
      continue;
    }
    if (ui.includes(handshake)) break;
    await delay(1_000);
  }

  if (ui.includes(handshake)) {
    await delay(settleMs);
    ui = await describeUi(simulatorUdid);
  }
  if (!ui.includes(handshake)) {
    fail(
      `Refusing to capture ${shot}: the development-only fixture handshake was not found. ` +
        'Start Metro with `bun run --cwd apps/mobile screenshots:start` and relaunch the dev client.',
    );
  }

  ui = await reforegroundAndDescribeApp(simulatorUdid, bundleId, settleMs);
  if (!ui.includes(handshake)) {
    fail(
      `Refusing to capture ${shot}: the BeeGreat fixture handshake disappeared after status-bar normalization.`,
    );
  }
  assertPrivacySafeUi(ui, shot);

  const order = String(SCREENSHOT_SHOTS.indexOf(shot) + 1).padStart(2, '0');
  const filename = `${order}-${shot}-${expected.width}x${expected.height}.png`;
  const output = resolve(outputDirectory, filename);
  await screenshot(simulatorUdid, output);
  await assertDimensions(output, expected.width, expected.height);
  console.log(`captured fixture: ${output}`);
}

async function captureLivePaywall({
  bundleId,
  captureSet: expected,
  outputDirectory,
  set: selectedSet,
  udid: simulatorUdid,
  waitMs: settleMs,
}: {
  bundleId: string;
  captureSet: (typeof SETS)[CaptureSet];
  outputDirectory: string;
  set: CaptureSet;
  udid: string;
  waitMs: number;
}) {
  const ui = await reforegroundAndDescribeApp(
    simulatorUdid,
    bundleId,
    settleMs,
  );
  const required = [
    'BeeGreat live paywall ready',
    'BeeGreat Pro',
    'Monthly subscription',
    'Restore Purchases',
    'Terms of Use',
    'Privacy Policy',
  ];
  const missing = required.filter((text) => !ui.includes(text));
  const hasLocalizedPurchaseLabel = /Subscribe for .+ \/ month/.test(ui);

  if (missing.length > 0 || !hasLocalizedPurchaseLabel) {
    fail(
      `Refusing to capture the live paywall. Missing visible StoreKit-backed content: ${[
        ...missing,
        ...(!hasLocalizedPurchaseLabel ? ['Subscribe for <localized price> / month'] : []),
      ].join(', ')}.`,
    );
  }
  if (ui.includes('Monthly plan unavailable') || ui.includes('Subscribe for —')) {
    fail('Refusing to capture a paywall without a live localized StoreKit price.');
  }
  assertPrivacySafeUi(ui, 'beegreat-pro');

  const filename = `06-beegreat-pro-${expected.width}x${expected.height}.png`;
  const output = resolve(outputDirectory, filename);
  await screenshot(simulatorUdid, output);
  await assertDimensions(output, expected.width, expected.height);
  console.log(`captured live paywall: ${output}`);

  if (selectedSet === 'iphone-69') {
    const reviewDirectory = resolve(outputRoot, '..', 'subscription-review');
    const reviewOutput = resolve(
      reviewDirectory,
      'beegreat-pro-monthly-1320x2868.png',
    );
    await mkdir(reviewDirectory, { recursive: true });
    await copyFile(output, reviewOutput);
    await assertDimensions(reviewOutput, 1320, 2868);
    console.log(`copied subscription review capture: ${reviewOutput}`);
  }
}

async function launchAndVerifyApp(
  simulatorUdid: string,
  appBundleId: string,
  settleMs: number,
) {
  const result = await run(
    [
      'xcrun',
      'simctl',
      'launch',
      '--terminate-running-process',
      simulatorUdid,
      appBundleId,
    ],
    { allowFailure: false },
  );
  const launchOutput = `${result.stdout}\n${result.stderr}`;
  if (!launchOutput.includes(appBundleId)) {
    fail(
      `Refusing to capture: simctl did not confirm that ${appBundleId} launched.`,
    );
  }
  await delay(settleMs);
}

async function reforegroundAndDescribeApp(
  simulatorUdid: string,
  appBundleId: string,
  settleMs: number,
) {
  // Opening a custom URL from another foreground app can leave iOS's
  // “Back to <App>” breadcrumb in the status bar. Round-trip through Home and
  // foreground the already-running BeeGreat process without resetting its
  // selected fixture route.
  await run(['axe', 'button', 'home', '--udid', simulatorUdid]);
  await delay(500);
  const result = await run([
    'xcrun',
    'simctl',
    'launch',
    simulatorUdid,
    appBundleId,
  ]);
  const launchOutput = `${result.stdout}\n${result.stderr}`;
  if (!launchOutput.includes(appBundleId)) {
    fail(
      `Refusing to capture: simctl did not confirm that ${appBundleId} returned to the foreground.`,
    );
  }
  await delay(settleMs);
  return describeUi(simulatorUdid);
}

function delay(milliseconds: number) {
  return new Promise<void>((resolveDelay) => {
    setTimeout(resolveDelay, milliseconds);
  });
}

async function describeUi(simulatorUdid: string) {
  const result = await run(['axe', 'describe-ui', '--udid', simulatorUdid]);
  return result.stdout;
}

async function screenshot(simulatorUdid: string, output: string) {
  await run(['axe', 'screenshot', '--udid', simulatorUdid, '--output', output]);
}

async function assertDimensions(path: string, expectedWidth: number, expectedHeight: number) {
  const result = await run(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', path]);
  const width = Number(result.stdout.match(/pixelWidth:\s*(\d+)/)?.[1]);
  const height = Number(result.stdout.match(/pixelHeight:\s*(\d+)/)?.[1]);
  if (width !== expectedWidth || height !== expectedHeight) {
    fail(
      `${path} is ${width}x${height}; expected ${expectedWidth}x${expectedHeight}. ` +
        'Use the matching simulator model at 100% native scale.',
    );
  }
}

const simctlDeviceListSchema = z.object({
  devices: z.record(
    z.string(),
    z.array(z.object({ udid: z.string(), state: z.string(), name: z.string() })),
  ),
});

async function assertBooted(simulatorUdid: string) {
  const result = await run(['xcrun', 'simctl', 'list', 'devices', '--json']);
  const parsed = simctlDeviceListSchema.parse(JSON.parse(result.stdout));
  const simulator = Object.values(parsed.devices)
    .flat()
    .find((device) => device.udid === simulatorUdid);
  if (!simulator) fail(`No simulator with UDID ${simulatorUdid} was found.`);
  if (simulator.state !== 'Booted') {
    fail(`${simulator.name} (${simulatorUdid}) must be booted before capture.`);
  }
}

async function assertInstalled(simulatorUdid: string, appBundleId: string) {
  await run([
    'xcrun',
    'simctl',
    'get_app_container',
    simulatorUdid,
    appBundleId,
    'app',
  ]);
}

function requestedFixtureShots(value: string | undefined): ScreenshotShot[] {
  if (!value) return [...SCREENSHOT_SHOTS];
  const requested = value.split(',').map((shot) => shot.trim());
  for (const shot of requested) {
    if (!isScreenshotShot(shot)) {
      fail(
        `Unknown fixture shot ${JSON.stringify(shot)}. Choose: ${SCREENSHOT_SHOTS.join(', ')}. ` +
          'BeeGreat Pro must be captured with --mode live-paywall.',
      );
    }
  }
  return requested.filter(isScreenshotShot);
}

function isBeeGreatDeepLinkConfirmation(ui: string) {
  return (
    /Open in [“"]BeeGreat[”"]\?/.test(ui) &&
    ui.includes('"AXLabel" : "Open"') &&
    ui.includes('"AXLabel" : "Cancel"')
  );
}

function assertPrivacySafeUi(ui: string, shot: string) {
  const developmentWarning = /open debugger(?: to view warnings)?/i.exec(ui);
  if (developmentWarning) {
    fail(
      `Refusing to capture ${shot}: Expo development warning UI is visible (${JSON.stringify(developmentWarning[0])}).`,
    );
  }

  const disallowed = [
    /\b[A-Z0-9._%+-]+@(?![^\s]*\.example\b)[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    /\b0x[a-f0-9]{40}\b/i,
    /\b(?:gmail|icloud|outlook)\.com\b/i,
    /\b(?:oauth|verification) code\b/i,
  ];
  const match = disallowed.find((pattern) => pattern.test(ui));
  if (match) {
    fail(`Refusing to capture ${shot}: accessibility text matched private-data pattern ${match}.`);
  }
}

async function run(
  command: string[],
  {
    allowFailure = false,
    timeoutMs = 30_000,
  }: { allowFailure?: boolean; timeoutMs?: number } = {},
) {
  const [executable, ...args] = command;
  if (!executable) fail('Cannot run an empty command.');
  const child = spawn(executable, args, {
    cwd: resolve(SCRIPT_DIRECTORY, '../..'),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk: string) => {
    stderr += chunk;
  });
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill('SIGKILL');
  }, timeoutMs);
  let exitCode: number;
  try {
    exitCode = await new Promise<number>((resolveExit, reject) => {
      child.once('error', reject);
      child.once('close', (code) => resolveExit(code ?? 1));
    });
  } finally {
    clearTimeout(timeout);
  }
  if (timedOut) {
    if (!allowFailure) {
      fail(`${command.join(' ')} timed out after ${timeoutMs}ms.`);
    }
    return { stdout, stderr, exitCode: 124 };
  }
  if (exitCode !== 0 && !allowFailure) {
    fail(
      `${command.join(' ')} failed (${exitCode}).\n${stderr.trim() || stdout.trim()}`,
    );
  }
  return { stdout, stderr, exitCode };
}

function fail(message: string): never {
  console.error(`screenshot harness: ${message}`);
  process.exit(1);
}

function printHelp() {
  console.log(`
BeeGreat deterministic App Store screenshot capture

Fixture UI (five fictional, privacy-safe product scenes):
  bun run --cwd apps/mobile screenshots:capture -- \\
    --mode fixture --set iphone-69 --udid <UDID>

Live RevenueCat/StoreKit paywall (never mocked):
  bun run --cwd apps/mobile screenshots:capture -- \\
    --mode live-paywall --set iphone-69 --udid <UDID>

Options:
  --set iphone-69|ipad-13
  --udid <booted simulator UDID>
  --mode fixture|live-paywall
  --shot <fixture slug[,fixture slug]>
  --bundle-id <bundle id>               default: com.beegreat.app
  --output-dir <directory>              default: ${OUTPUT_ROOT}
  --wait-ms <500..10000>                default: 1400
`);
}
