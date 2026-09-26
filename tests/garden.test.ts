import test from 'node:test';
import assert from 'node:assert/strict';
import { careSummary, dayKey, normalizeName, readRecord, recordWatering, type Sprout } from '../src/gardenModel.ts';
import { getSprout, renameSprout, STORAGE_KEY, waterSprout } from '../src/demoService.ts';
const seed = (patch: Partial<Sprout> = {}): Sprout => ({ version: 2, pot: 'paper', name: 'Mochi', plantedAt: '2026-09-01T00:00:00Z', timeZone: 'Asia/Seoul', wateredDays: [], mode: 'demo', ...patch });
const at = (day: string) => new Date(`${day}T03:00:00Z`);

test('first watering counts once; refresh and repeat do not add care days', () => {
  const first = recordWatering(seed(), at('2026-09-20'));
  assert.equal(careSummary(first, at('2026-09-20')).streak, 1);
  assert.equal(careSummary(first, at('2026-09-20')).wateredToday, true);
  assert.throws(() => recordWatering(first, at('2026-09-20')), /tomorrow/);
  assert.equal(first.wateredDays.length, 1);
});
test('new care day is local midnight, even when less than 24 hours has passed', () => {
  const before = new Date('2026-09-20T14:59:59Z'), after = new Date('2026-09-20T15:00:00Z');
  assert.equal(dayKey(before, 'Asia/Seoul'), '2026-09-20');
  assert.equal(dayKey(after, 'Asia/Seoul'), '2026-09-21');
  const two = recordWatering(recordWatering(seed(), before), after);
  assert.equal(careSummary(two, after).streak, 2);
});
test('DST fallback still allows only one watering on the same local day', () => {
  const plant = seed({ timeZone: 'America/New_York' });
  const first = recordWatering(plant, new Date('2026-11-01T05:30:00Z'));
  assert.throws(() => recordWatering(first, new Date('2026-11-01T06:30:00Z')), /tomorrow/);
  const next = recordWatering(first, new Date('2026-11-02T05:01:00Z'));
  assert.equal(careSummary(next, new Date('2026-11-02T05:01:00Z')).streak, 2);
});
test('a missed day resets streak, keeps longest streak and growth', () => {
  const grown = seed({ wateredDays: ['2026-09-17', '2026-09-18', '2026-09-19'] });
  assert.equal(careSummary(grown, at('2026-09-20')).streak, 3);
  assert.equal(careSummary(grown, at('2026-09-21')).streak, 0);
  const returned = recordWatering(grown, at('2026-09-21'));
  const care = careSummary(returned, at('2026-09-21'));
  assert.equal(care.streak, 1); assert.equal(care.longest, 3); assert.equal(care.growth.id, 'leafy');
});
test('growth unlocks at exactly 3 and 7 total days, consecutive or not', () => {
  let plant = seed();
  for (let i = 1; i <= 7; i++) {
    const date = at(`2026-09-${String(i * 2).padStart(2, '0')}`);
    plant = recordWatering(plant, date);
    assert.equal(careSummary(plant, date).growth.id, i < 3 ? 'sprout' : i < 7 ? 'leafy' : 'bloom');
  }
  assert.equal(careSummary(plant, at('2026-09-15')).next, null);
});
test('old saved sprouts retain pot and date and gain safe defaults', () => {
  const old = { pot: 'sunshine', plantedAt: '2026-09-19T00:00:00Z', mode: 'demo' };
  const migrated = readRecord(old, 'Asia/Seoul');
  assert.ok(migrated); assert.equal(migrated.pot, old.pot); assert.equal(migrated.plantedAt, old.plantedAt);
  assert.equal(migrated.name, 'Little Sprout'); assert.deepEqual(migrated.wateredDays, []);
});
test('damaged history is filtered, sorted, and deduplicated without invented days', () => {
  const result = readRecord(seed({ wateredDays: ['2026-09-20', 'nonsense', '2026-09-19', '2026-09-20', '2026-02-31', '2026-08-31'] }));
  assert.deepEqual(result?.wateredDays, ['2026-09-19', '2026-09-20']);
  assert.equal(readRecord({ pot: 'unknown' }), null);
});
test('seven-day strip crosses month and year boundaries correctly', () => {
  const care = careSummary(seed(), at('2027-01-02'));
  assert.equal(care.week[0].day, '2026-12-27'); assert.equal(care.week[6].day, '2027-01-02');
  assert.equal(care.week.filter(day => day.isToday).length, 1);
});
test('names handle Unicode and reject blank or overlong names', () => {
  assert.equal(normalizeName('  작은   새싹 🌱  '), '작은 새싹 🌱');
  assert.throws(() => normalizeName('    ')); assert.throws(() => normalizeName('a'.repeat(21)));
});
test('moving the device clock backwards cannot add earlier history', () => {
  assert.throws(() => recordWatering(seed({ wateredDays: ['2026-09-21'] }), at('2026-09-20')), /clock/);
});
test('saved changes survive rereads; duplicate calls reject; storage errors preserve data', async () => {
  const records = new Map<string, string>();
  let failWrite = false;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => records.get(key) ?? null,
    setItem: (key: string, value: string) => { if (failWrite) throw new Error('quota'); records.set(key, value); },
    removeItem: (key: string) => records.delete(key),
  }});
  records.set(STORAGE_KEY, JSON.stringify(seed()));
  await waterSprout(at('2026-09-20'));
  await renameSprout('Bean');
  assert.equal(getSprout()?.name, 'Bean'); assert.deepEqual(getSprout()?.wateredDays, ['2026-09-20']);
  await assert.rejects(waterSprout(at('2026-09-20')), /tomorrow/);
  failWrite = true;
  await assert.rejects(waterSprout(at('2026-09-21')), /could not save/);
  assert.deepEqual(getSprout()?.wateredDays, ['2026-09-20']);
  delete (globalThis as { localStorage?: unknown }).localStorage;
});
