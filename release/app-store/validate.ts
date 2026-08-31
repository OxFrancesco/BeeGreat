type StoreMetadata = {
  appName: string;
  version: string;
  subtitle: string;
  promotionalText: string;
  description: string;
  keywords: string;
  supportUrl: string;
  marketingUrl: string;
  privacyPolicyUrl: string;
  termsUrl: string;
  copyright: string;
  primaryCategory: string;
  secondaryCategory: string;
  subscription: {
    referenceName: string;
    productId: string;
    period: string;
    usPrice: string;
    freeTrial: boolean;
  };
};

type ScreenshotPlan = {
  sets: Array<{
    key: string;
    label: string;
    width: number;
    height: number;
  }>;
  shots: Array<{
    order: number;
    slug: string;
    headline: string;
    state: string;
  }>;
  subscriptionReview: {
    setKey: string;
    filename: string;
    requirements: string[];
  };
};

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = { [key: string]: JsonValue };

function isJsonRecord(value: JsonValue | undefined): value is JsonRecord {
  return value !== null && value !== undefined && !Array.isArray(value) && Object(value) === value;
}

function isJsonString(value: JsonValue | undefined): value is string {
  return String(value) === value;
}

function parseRecord(value: JsonValue | undefined, label: string): JsonRecord {
  if (!isJsonRecord(value)) throw new Error(`${label} must be a JSON object`);
  return value;
}

function parseString(value: JsonValue | undefined, label: string): string {
  if (!isJsonString(value)) throw new Error(`${label} must be a string`);
  return value;
}

function parseNumber(value: JsonValue | undefined, label: string): number {
  // A JSON number is the only value that round-trips through Number unchanged.
  const isNumber = (candidate: JsonValue | undefined): candidate is number =>
    Number(candidate) === candidate;
  if (!isNumber(value)) throw new Error(`${label} must be a number`);
  return value;
}

function parseBoolean(value: JsonValue | undefined, label: string): boolean {
  if (value !== true && value !== false) throw new Error(`${label} must be a boolean`);
  return value;
}

function parseArray(value: JsonValue | undefined, label: string): JsonValue[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function parseStoreMetadata(value: JsonValue): StoreMetadata {
  const record = parseRecord(value, 'metadata');
  const subscription = parseRecord(record.subscription, 'metadata.subscription');
  return {
    appName: parseString(record.appName, 'metadata.appName'),
    version: parseString(record.version, 'metadata.version'),
    subtitle: parseString(record.subtitle, 'metadata.subtitle'),
    promotionalText: parseString(record.promotionalText, 'metadata.promotionalText'),
    description: parseString(record.description, 'metadata.description'),
    keywords: parseString(record.keywords, 'metadata.keywords'),
    supportUrl: parseString(record.supportUrl, 'metadata.supportUrl'),
    marketingUrl: parseString(record.marketingUrl, 'metadata.marketingUrl'),
    privacyPolicyUrl: parseString(record.privacyPolicyUrl, 'metadata.privacyPolicyUrl'),
    termsUrl: parseString(record.termsUrl, 'metadata.termsUrl'),
    copyright: parseString(record.copyright, 'metadata.copyright'),
    primaryCategory: parseString(record.primaryCategory, 'metadata.primaryCategory'),
    secondaryCategory: parseString(record.secondaryCategory, 'metadata.secondaryCategory'),
    subscription: {
      referenceName: parseString(subscription.referenceName, 'metadata.subscription.referenceName'),
      productId: parseString(subscription.productId, 'metadata.subscription.productId'),
      period: parseString(subscription.period, 'metadata.subscription.period'),
      usPrice: parseString(subscription.usPrice, 'metadata.subscription.usPrice'),
      freeTrial: parseBoolean(subscription.freeTrial, 'metadata.subscription.freeTrial'),
    },
  };
}

function parseScreenshotPlan(value: JsonValue): ScreenshotPlan {
  const record = parseRecord(value, 'screenshot plan');
  const review = parseRecord(record.subscriptionReview, 'screenshot plan.subscriptionReview');
  return {
    sets: parseArray(record.sets, 'screenshot plan.sets').map((entry, index) => {
      const set = parseRecord(entry, `screenshot plan.sets[${index}]`);
      return {
        key: parseString(set.key, `screenshot plan.sets[${index}].key`),
        label: parseString(set.label, `screenshot plan.sets[${index}].label`),
        width: parseNumber(set.width, `screenshot plan.sets[${index}].width`),
        height: parseNumber(set.height, `screenshot plan.sets[${index}].height`),
      };
    }),
    shots: parseArray(record.shots, 'screenshot plan.shots').map((entry, index) => {
      const shot = parseRecord(entry, `screenshot plan.shots[${index}]`);
      return {
        order: parseNumber(shot.order, `screenshot plan.shots[${index}].order`),
        slug: parseString(shot.slug, `screenshot plan.shots[${index}].slug`),
        headline: parseString(shot.headline, `screenshot plan.shots[${index}].headline`),
        state: parseString(shot.state, `screenshot plan.shots[${index}].state`),
      };
    }),
    subscriptionReview: {
      setKey: parseString(review.setKey, 'screenshot plan.subscriptionReview.setKey'),
      filename: parseString(review.filename, 'screenshot plan.subscriptionReview.filename'),
      requirements: parseArray(review.requirements, 'screenshot plan.subscriptionReview.requirements').map(
        (entry, index) =>
          parseString(entry, `screenshot plan.subscriptionReview.requirements[${index}]`),
      ),
    },
  };
}

const root = new URL('./', import.meta.url);
const metadata = parseStoreMetadata(await Bun.file(new URL('metadata/en-US.json', root)).json());
const screenshotPlan = parseScreenshotPlan(await Bun.file(new URL('screenshot-plan.json', root)).json());
const reviewNotesFile = await Bun.file(new URL('review-notes.md', root)).text();

const failures: string[] = [];
const checks: string[] = [];

function check(condition: boolean, message: string) {
  if (condition) checks.push(message);
  else failures.push(message);
}

function checkLimit(label: string, value: string, maximum: number) {
  const length = [...value].length;
  check(length <= maximum, `${label}: ${length}/${maximum} characters`);
}

function checkHttps(label: string, value: string) {
  try {
    const url = new URL(value);
    check(url.protocol === 'https:', `${label}: HTTPS URL`);
  } catch {
    failures.push(`${label}: valid URL`);
  }
}

checkLimit('App name', metadata.appName, 30);
checkLimit('Subtitle', metadata.subtitle, 30);
checkLimit('Promotional text', metadata.promotionalText, 170);
checkLimit('Keywords', metadata.keywords, 100);
checkLimit('Description', metadata.description, 4_000);

const reviewNotesMatch = reviewNotesFile.match(/```text\n([\s\S]*?)\n```/);
check(Boolean(reviewNotesMatch), 'App Review notes: copy-ready text block found');
if (reviewNotesMatch) checkLimit('App Review notes', reviewNotesMatch[1], 4_000);

check(!metadata.keywords.includes(', '), 'Keywords: no spaces after commas');
check(!metadata.keywords.split(',').some((keyword) => keyword.trim().length === 0), 'Keywords: no empty entries');

for (const [label, value] of [
  ['Support URL', metadata.supportUrl],
  ['Marketing URL', metadata.marketingUrl],
  ['Privacy Policy URL', metadata.privacyPolicyUrl],
  ['Terms URL', metadata.termsUrl],
] as const) {
  checkHttps(label, value);
}

for (const [label, value] of [
  ['Support URL', metadata.supportUrl],
  ['Privacy Policy URL', metadata.privacyPolicyUrl],
  ['Terms URL', metadata.termsUrl],
] as const) {
  check(metadata.description.includes(value), `Description includes ${label.toLowerCase()}`);
}

check(metadata.version === '1.0.0', 'Version: 1.0.0');
check(metadata.primaryCategory === 'PRODUCTIVITY', 'Primary category: PRODUCTIVITY');
check(metadata.secondaryCategory === 'LIFESTYLE', 'Secondary category: LIFESTYLE');
check(metadata.copyright === '2026 Francesco Oddo', 'Copyright matches release record');
check(metadata.description.toLowerCase().includes('subscription is required'), 'Description discloses required subscription');
check(metadata.description.includes('$6.99 per month'), 'Description discloses U.S. monthly price');
check(metadata.description.toLowerCase().includes('no free trial'), 'Description discloses no free trial');
check(metadata.subscription.productId === 'com.beegreat.app.pro.monthly', 'Subscription product ID');
check(metadata.subscription.period === 'ONE_MONTH', 'Subscription period: one month');
check(metadata.subscription.usPrice === '6.99', 'Subscription U.S. price: 6.99');
check(metadata.subscription.freeTrial === false, 'Subscription trial: none');

check(screenshotPlan.sets.length === 2, 'Screenshot sets: iPhone and iPad');
check(screenshotPlan.shots.length >= 1 && screenshotPlan.shots.length <= 10, 'Screenshot count: 1–10 per set');
check(new Set(screenshotPlan.shots.map((shot) => shot.slug)).size === screenshotPlan.shots.length, 'Screenshot slugs: unique');
check(
  screenshotPlan.shots.every((shot, index) => shot.order === index + 1),
  'Screenshot order: contiguous from 1',
);
check(
  screenshotPlan.sets.some((set) => set.key === 'iphone-69' && set.width === 1320 && set.height === 2868),
  'iPhone 6.9-inch canvas: 1320x2868',
);
check(
  screenshotPlan.sets.some((set) => set.key === 'ipad-13' && set.width === 2064 && set.height === 2752),
  'iPad 13-inch canvas: 2064x2752',
);
check(
  screenshotPlan.sets.some((set) => set.key === screenshotPlan.subscriptionReview.setKey),
  'Subscription review screenshot references a defined set',
);

for (const message of checks) console.log(`PASS ${message}`);
for (const message of failures) console.error(`FAIL ${message}`);

if (failures.length > 0) {
  console.error(`\n${failures.length} validation failure${failures.length === 1 ? '' : 's'}.`);
  process.exit(1);
}

console.log(`\nValidated ${checks.length} App Store release checks.`);
