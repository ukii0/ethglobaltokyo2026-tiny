import { gardenTimeZone, isPotId, normalizeName, readRecord, recordWatering, type PotId, type Sprout } from './gardenModel';
export { pots, isPotId, type PotId, type Sprout } from './gardenModel';
// Keep the original key so existing demo sprouts retain their pot and planting date.
export const STORAGE_KEY = 'tiny-sprout:demo:v1';
export function getSprout(): Sprout | null {
  try { return readRecord(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')); }
  catch { return null; }
}
function persist(sprout: Sprout) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sprout)); }
  catch { throw new Error('Your browser could not save this change. Allow local storage and try again.'); }
  return sprout;
}
async function withGardenLock<T>(action: () => T): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) return navigator.locks.request('tiny-sprout:garden', action);
  return action();
}
export function pause(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
    const onAbort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); };
    const timer = globalThis.setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
export async function connectDemoWallet(signal?: AbortSignal) { await pause(650, signal); }
export async function plantSprout(pot: PotId, name: string, signal?: AbortSignal): Promise<Sprout> {
  if (!isPotId(pot)) throw new Error('Please choose one of the three pots.');
  const normalizedName = normalizeName(name.trim() || 'Little Sprout');
  await pause(1400, signal);
  return withGardenLock(() => {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (getSprout()) throw new Error('There is already a sprout here. Refresh to see it.');
    return persist({ version: 2, pot, name: normalizedName, plantedAt: new Date().toISOString(), timeZone: gardenTimeZone(), wateredDays: [], mode: 'demo' });
  });
}
export async function waterSprout(now = new Date()): Promise<Sprout> {
  return withGardenLock(() => {
    const sprout = getSprout();
    if (!sprout) throw new Error('Your sprout is no longer here. Plant a new one to begin.');
    return persist(recordWatering(sprout, now));
  });
}
export async function renameSprout(name: string): Promise<Sprout> {
  const normalizedName = normalizeName(name);
  return withGardenLock(() => {
    const sprout = getSprout();
    if (!sprout) throw new Error('Your sprout is no longer here. Refresh to begin again.');
    return persist({ ...sprout, name: normalizedName });
  });
}
export async function resetDemo() { return withGardenLock(() => localStorage.removeItem(STORAGE_KEY)); }
