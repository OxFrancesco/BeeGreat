const STORE_VERSION = 1;
const MAX_STORED_DRAFTS = 62;
const STORE_FILE_NAME = 'bee-healthy-drafts-v1.json';
const BACKUP_FILE_NAME = 'bee-healthy-drafts-v1.backup.json';
const TEMP_FILE_NAME = 'bee-healthy-drafts-v1.tmp.json';
const BACKUP_TEMP_FILE_NAME = 'bee-healthy-drafts-v1.backup.tmp.json';
const WEB_STORE_KEY = 'bee-healthy-drafts-v1';
const WEB_BACKUP_KEY = 'bee-healthy-drafts-v1-backup';

type StoredDraft = {
  journal: string;
  updatedAt: number;
};

type DraftStore = {
  version: typeof STORE_VERSION;
  drafts: Record<string, StoredDraft>;
};

type StoreReadResult = {
  store: DraftStore;
  storageWarning: string | null;
};

export type JournalDraftLoadResult = {
  journal: string | null;
  storageWarning: string | null;
};

let cachedStore: DraftStore | null = null;
let cachedStorageWarning: string | null = null;
let loadPromise: Promise<StoreReadResult> | null = null;
let operationQueue: Promise<void> = Promise.resolve();

function draftKey(userId: string, localDate: string) {
  return `${userId}:${localDate}`;
}

function emptyStore(): DraftStore {
  return { version: STORE_VERSION, drafts: {} };
}

function isStoredDraft(value: unknown): value is StoredDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<StoredDraft>;
  return (
    typeof draft.journal === 'string' &&
    typeof draft.updatedAt === 'number' &&
    Number.isFinite(draft.updatedAt)
  );
}

function parseStore(serialized: string): DraftStore {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error('The stored journal data is not valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('The stored journal data has an invalid shape.');
  }

  const candidate = parsed as { version?: unknown; drafts?: unknown };
  if (
    candidate.version !== STORE_VERSION ||
    !candidate.drafts ||
    typeof candidate.drafts !== 'object' ||
    Array.isArray(candidate.drafts)
  ) {
    throw new Error('The stored journal data has an unsupported format.');
  }

  const entries = Object.entries(candidate.drafts);
  if (entries.some(([, draft]) => !isStoredDraft(draft))) {
    throw new Error('One or more stored journal drafts are damaged.');
  }

  return {
    version: STORE_VERSION,
    drafts: Object.fromEntries(entries) as Record<string, StoredDraft>,
  };
}

function recoverStore(primary: string | null, backup: string | null): StoreReadResult {
  if (primary !== null) {
    try {
      return { store: parseStore(primary), storageWarning: null };
    } catch {
      if (backup !== null) {
        try {
          return {
            store: parseStore(backup),
            storageWarning:
              'Your offline journal drafts were recovered from a backup because the main copy was unreadable.',
          };
        } catch {
          throw new Error(
            'Both copies of your offline journal drafts are unreadable. Your on-screen reflection was not changed.',
          );
        }
      }

      throw new Error(
        'Your offline journal drafts are unreadable and no backup is available. Your on-screen reflection was not changed.',
      );
    }
  }

  if (backup !== null) {
    try {
      return {
        store: parseStore(backup),
        storageWarning:
          'Your offline journal drafts were recovered from a backup after an interrupted save.',
      };
    } catch {
      throw new Error(
        'The backup copy of your offline journal drafts is unreadable. Your on-screen reflection was not changed.',
      );
    }
  }

  return { store: emptyStore(), storageWarning: null };
}

function isWebRuntime() {
  return process.env.EXPO_OS === 'web' || typeof document !== 'undefined';
}

function browserStorage() {
  try {
    if (typeof globalThis.localStorage === 'undefined') {
      throw new Error('Browser storage is unavailable.');
    }
    return globalThis.localStorage;
  } catch {
    throw new Error(
      'Offline journal storage is unavailable in this browser. Keep this screen open until your reflection is saved.',
    );
  }
}

function readWebStore(): StoreReadResult {
  const storage = browserStorage();
  try {
    return recoverStore(
      storage.getItem(WEB_STORE_KEY),
      storage.getItem(WEB_BACKUP_KEY),
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('offline journal drafts')) {
      throw error;
    }
    throw new Error(
      'Offline journal storage could not be read. Keep this screen open until your reflection is saved.',
    );
  }
}

function writeWebStore(store: DraftStore) {
  const storage = browserStorage();
  const serialized = JSON.stringify(store);
  parseStore(serialized);

  try {
    const primary = storage.getItem(WEB_STORE_KEY);
    const backup = storage.getItem(WEB_BACKUP_KEY);
    let primaryIsValid = false;
    if (primary !== null) {
      try {
        parseStore(primary);
        primaryIsValid = true;
      } catch {
        // Preserve an existing valid backup instead of replacing it with corrupt data.
      }
    }

    if (primaryIsValid) {
      storage.setItem(WEB_BACKUP_KEY, primary!);
    } else if (backup === null) {
      storage.setItem(WEB_BACKUP_KEY, serialized);
    }
    storage.setItem(WEB_STORE_KEY, serialized);
  } catch {
    throw new Error(
      'The offline copy of your reflection could not be saved. Keep this screen open until the app confirms it is saved.',
    );
  }
}

async function readNativeStore(): Promise<StoreReadResult> {
  try {
    const { File, Paths } = await import('expo-file-system');
    const primary = new File(Paths.document, STORE_FILE_NAME);
    const backup = new File(Paths.document, BACKUP_FILE_NAME);
    return recoverStore(
      primary.exists ? await primary.text() : null,
      backup.exists ? await backup.text() : null,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('offline journal drafts')) {
      throw error;
    }
    throw new Error(
      'Offline journal storage could not be read. Keep this screen open until your reflection is saved.',
    );
  }
}

async function writeNativeStore(store: DraftStore) {
  const serialized = JSON.stringify(store);
  parseStore(serialized);

  try {
    const { File, Paths } = await import('expo-file-system');
    const primary = new File(Paths.document, STORE_FILE_NAME);
    const backup = new File(Paths.document, BACKUP_FILE_NAME);
    const temporary = new File(Paths.document, TEMP_FILE_NAME);
    const backupTemporary = new File(Paths.document, BACKUP_TEMP_FILE_NAME);

    temporary.create({ intermediates: true, overwrite: true });
    temporary.write(serialized);
    parseStore(await temporary.text());

    let backupContents: string | null = null;
    if (primary.exists) {
      const primaryContents = await primary.text();
      try {
        parseStore(primaryContents);
        backupContents = primaryContents;
      } catch {
        // Keep the last known-good backup when the primary file is damaged.
      }
    } else if (!backup.exists) {
      backupContents = serialized;
    }

    if (backupContents !== null) {
      backupTemporary.create({ intermediates: true, overwrite: true });
      backupTemporary.write(backupContents);
      parseStore(await backupTemporary.text());
      await backupTemporary.move(backup, { overwrite: true });
    }

    await temporary.move(primary, { overwrite: true });
  } catch {
    throw new Error(
      'The offline copy of your reflection could not be saved. Keep this screen open until the app confirms it is saved.',
    );
  }
}

async function readStore() {
  if (cachedStore) {
    return { store: cachedStore, storageWarning: cachedStorageWarning };
  }
  if (loadPromise) return await loadPromise;

  loadPromise = isWebRuntime()
    ? Promise.resolve().then(readWebStore)
    : readNativeStore();

  try {
    const result = await loadPromise;
    cachedStore = result.store;
    cachedStorageWarning = result.storageWarning;
    return result;
  } finally {
    loadPromise = null;
  }
}

async function writeStore(store: DraftStore) {
  if (isWebRuntime()) {
    writeWebStore(store);
  } else {
    await writeNativeStore(store);
  }
  cachedStore = store;
  cachedStorageWarning = null;
}

function enqueueStoreUpdate(update: (store: DraftStore) => DraftStore) {
  const operation = operationQueue.then(async () => {
    const { store } = await readStore();
    await writeStore(update(store));
  });
  operationQueue = operation.catch(() => {});
  return operation;
}

export async function loadJournalDraft(
  userId: string,
  localDate: string,
): Promise<JournalDraftLoadResult> {
  await operationQueue;
  const { store, storageWarning } = await readStore();
  return {
    journal: store.drafts[draftKey(userId, localDate)]?.journal ?? null,
    storageWarning,
  };
}

export function persistJournalDraft(
  userId: string,
  localDate: string,
  journal: string,
) {
  return enqueueStoreUpdate((store) => {
    const drafts = {
      ...store.drafts,
      [draftKey(userId, localDate)]: { journal, updatedAt: Date.now() },
    };
    const newestDrafts = Object.entries(drafts)
      .sort((left, right) => right[1].updatedAt - left[1].updatedAt)
      .slice(0, MAX_STORED_DRAFTS);

    return { version: STORE_VERSION, drafts: Object.fromEntries(newestDrafts) };
  });
}

export function clearJournalDraft(userId: string, localDate: string) {
  return enqueueStoreUpdate((store) => {
    const drafts = { ...store.drafts };
    delete drafts[draftKey(userId, localDate)];
    return { version: STORE_VERSION, drafts };
  });
}
