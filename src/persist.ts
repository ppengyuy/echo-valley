import type { Echo, Plan } from './types';

/**
 * P0 存储层：默认「本地珍藏」（IndexedDB），可手动切「会话模式」（sessionStorage）。
 * 两条铁律：
 * 1. 只存用户原始输入（回音原话 + 小路计划），不做摘要、不打情绪标签；
 * 2. 练习行为一律不落库——这里没有、也不会有练习日志表。
 */

export type StorageMode = 'local' | 'session';

const MODE_KEY = 'echo-valley:storage-mode';
const NOTICE_KEY = 'echo-valley:first-run-ack';
const TOUR_KEY = 'echo-valley:tour-seen';
const SESSION_ECHO_KEY = 'echo-valley:session:echoes';
const SESSION_PLAN_KEY = 'echo-valley:session:plan';

const DB_NAME = 'echo-valley';
const DB_VERSION = 1;
const STORE_ECHO = 'echo';
const STORE_PATH = 'path';
const STORE_NOTE = 'note';
const PLAN_KEY = 'main';

function readLS(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLS(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 隐私模式等场景写不进去，不阻断本次使用。
  }
}

export function getMode(): StorageMode {
  return readLS(MODE_KEY) === 'session' ? 'session' : 'local';
}

export function setMode(mode: StorageMode): void {
  writeLS(MODE_KEY, mode);
}

/** 首次启动的知情确认是否已经点过。 */
export function hasAckedNotice(): boolean {
  return readLS(NOTICE_KEY) === '1';
}

export function ackNotice(): void {
  writeLS(NOTICE_KEY, '1');
}

/** 新手引导是不是走过了（走过就不再自动弹，设置里还能重看）。 */
export function hasSeenTour(): boolean {
  return readLS(TOUR_KEY) === '1';
}

export function markTourSeen(): void {
  writeLS(TOUR_KEY, '1');
}

// ---------- IndexedDB ----------

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('indexeddb-unavailable'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_ECHO)) db.createObjectStore(STORE_ECHO, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORE_PATH)) db.createObjectStore(STORE_PATH, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORE_NOTE)) db.createObjectStore(STORE_NOTE, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('indexeddb-open-failed'));
    }).catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

function withStore<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const request = run(transaction.objectStore(store));
        transaction.oncomplete = () => resolve(request.result as T);
        transaction.onabort = () => reject(transaction.error ?? new Error('indexeddb-abort'));
        transaction.onerror = () => reject(transaction.error ?? new Error('indexeddb-error'));
      }),
  );
}

// ---------- 回音 ----------

async function readEchoesLocal(): Promise<Echo[]> {
  const rows = await withStore<Echo[]>(STORE_ECHO, 'readonly', (store) => store.getAll());
  return rows
    .filter((row) => row && typeof row.text === 'string')
    .sort((a, b) => b.createdAt - a.createdAt);
}

async function writeEchoesLocal(echoes: Echo[]): Promise<void> {
  await withStore(STORE_ECHO, 'readwrite', (store) => {
    store.clear();
    echoes.forEach((echo) => store.put(echo));
    return store.getAllKeys();
  });
}

// ---------- 小路计划 ----------

interface PlanRecord {
  id: string;
  plan: Plan;
}

async function readPlanLocal(): Promise<Plan | null> {
  const record = await withStore<PlanRecord | undefined>(STORE_PATH, 'readonly', (store) =>
    store.get(PLAN_KEY),
  );
  return record?.plan ?? null;
}

async function writePlanLocal(plan: Plan | null): Promise<void> {
  await withStore(STORE_PATH, 'readwrite', (store) => {
    if (!plan) return store.delete(PLAN_KEY);
    return store.put({ id: PLAN_KEY, plan } satisfies PlanRecord);
  });
}

// ---------- 会话模式 ----------

function readSessionEchoes(): Echo[] {
  try {
    const raw = sessionStorage.getItem(SESSION_ECHO_KEY);
    const list = raw ? (JSON.parse(raw) as Echo[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function readSessionPlan(): Plan | null {
  try {
    const raw = sessionStorage.getItem(SESSION_PLAN_KEY);
    return raw ? (JSON.parse(raw) as Plan) : null;
  } catch {
    return null;
  }
}

/** 会话模式仅在内存/标签页里留痕，不碰本地库。刷新按「重新开始一次会话」处理。 */
export function clearSessionData(): void {
  try {
    sessionStorage.removeItem(SESSION_ECHO_KEY);
    sessionStorage.removeItem(SESSION_PLAN_KEY);
  } catch {
    // 忽略
  }
}

// ---------- 对外读写 ----------

export async function readEchoes(mode: StorageMode): Promise<Echo[]> {
  if (mode === 'session') return readSessionEchoes();
  try {
    return await readEchoesLocal();
  } catch {
    // 本地库不可用（如隐私模式），退回本次会话，不阻断使用。
    return readSessionEchoes();
  }
}

export async function writeEchoes(mode: StorageMode, echoes: Echo[]): Promise<void> {
  if (mode === 'session') {
    try {
      sessionStorage.setItem(SESSION_ECHO_KEY, JSON.stringify(echoes));
    } catch {
      // 忽略
    }
    return;
  }
  try {
    await writeEchoesLocal(echoes);
  } catch {
    // 忽略：不影响界面里的这一条。
  }
}

export async function readPlan(mode: StorageMode): Promise<Plan | null> {
  if (mode === 'session') return readSessionPlan();
  try {
    return await readPlanLocal();
  } catch {
    return readSessionPlan();
  }
}

export async function writePlan(mode: StorageMode, plan: Plan | null): Promise<void> {
  if (mode === 'session') {
    try {
      if (plan) sessionStorage.setItem(SESSION_PLAN_KEY, JSON.stringify(plan));
      else sessionStorage.removeItem(SESSION_PLAN_KEY);
    } catch {
      // 忽略
    }
    return;
  }
  try {
    await writePlanLocal(plan);
  } catch {
    // 忽略
  }
}

/** 彻底清空本地珍藏：回音、计划、笔记一并清掉，不可恢复。 */
export async function wipeAll(): Promise<void> {
  clearSessionData();
  try {
    const db = await openDB();
    await Promise.all(
      [STORE_ECHO, STORE_PATH, STORE_NOTE].map(
        (store) =>
          new Promise<void>((resolve, reject) => {
            if (!db.objectStoreNames.contains(store)) {
              resolve();
              return;
            }
            const transaction = db.transaction(store, 'readwrite');
            transaction.objectStore(store).clear();
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error ?? new Error('wipe-failed'));
          }),
      ),
    );
  } catch {
    // 本地库不可用时，会话数据已经清掉。
  }
}

// ---------- 备份 ----------

export interface BackupFile {
  app: 'echo-valley';
  version: 2;
  mode: 'local';
  exportedAt: number;
  echoes: Echo[];
  plan: Plan | null;
}

export async function buildBackup(): Promise<BackupFile> {
  const echoes = await readEchoesLocal().catch(() => [] as Echo[]);
  const plan = await readPlanLocal().catch(() => null);
  return {
    app: 'echo-valley',
    version: 2,
    mode: 'local',
    exportedAt: Date.now(),
    echoes,
    plan,
  };
}

export interface ParsedBackup {
  echoes: Echo[];
  plan: Plan | null;
}

/** 只认本产品导出的结构；不认识的字段一律忽略，不猜。 */
export function parseBackup(raw: string): ParsedBackup {
  const data = JSON.parse(raw) as Partial<BackupFile> & { echoes?: unknown; plan?: unknown };
  if (data.app !== 'echo-valley') throw new Error('not-echo-valley');
  const echoes = Array.isArray(data.echoes)
    ? (data.echoes as Echo[]).filter(
        (echo) =>
          echo &&
          typeof echo.id === 'string' &&
          typeof echo.text === 'string' &&
          typeof echo.createdAt === 'number',
      )
    : [];
  const plan =
    data.plan && typeof data.plan === 'object' && Array.isArray((data.plan as Plan).items)
      ? (data.plan as Plan)
      : null;
  if (!echoes.length && !plan) throw new Error('empty-backup');
  return { echoes, plan };
}

/** 恢复到本地珍藏，覆盖本机现有内容。 */
export async function applyBackup(parsed: ParsedBackup): Promise<void> {
  await writeEchoesLocal(parsed.echoes);
  await writePlanLocal(parsed.plan);
}
