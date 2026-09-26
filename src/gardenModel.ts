export const pots = [
  { id: 'paper', name: 'Paper', description: 'A classic little daydream.', color: '#fffef8' },
  { id: 'pebble', name: 'Pebble', description: 'Quietly doing its own thing.', color: '#aeaeaa' },
  { id: 'sunshine', name: 'Sunshine', description: 'A pocketful of good energy.', color: '#ffda50' },
] as const;
export type PotId = typeof pots[number]['id'];
export type GrowthId = 'sprout' | 'leafy' | 'bloom';
export type Sprout = { version: 2; pot: PotId; name: string; plantedAt: string; timeZone: string; wateredDays: string[]; mode: 'demo' | 'onchain'; owner?: string; chainId?: number; contract?: string };
export const growthStages = [
  { id: 'sprout', name: 'Little sprout', days: 0, note: 'Every beginning is a little brave.' },
  { id: 'leafy', name: 'Finding its leaves', days: 3, note: 'A little care goes a long way.' },
  { id: 'bloom', name: 'In full bloom', days: 7, note: 'Look what your little ritual grew.' },
] as const;
export function isPotId(value: unknown): value is PotId { return pots.some(pot => pot.id === value); }
export function gardenTimeZone(): string { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
export function normalizeName(value: string): string {
  const name = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (!name) throw new Error('Give your sprout a little name.');
  if ([...name].length > 20) throw new Error('Keep your sprout’s name to 20 characters.');
  if (/[\u0000-\u001f\u007f]/u.test(name)) throw new Error('Use letters, numbers, or a little emoji.');
  return name;
}
export function dayKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
}
export function dayOrdinal(day: string): number { return Date.parse(`${day}T00:00:00Z`) / 86_400_000; }
export function shiftDay(day: string, offset: number): string { return new Date((dayOrdinal(day) + offset) * 86_400_000).toISOString().slice(0, 10); }
function validDay(day: unknown): day is string {
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(dayOrdinal(day)) && shiftDay(day, 0) === day;
}
export function readRecord(value: unknown, fallbackZone = gardenTimeZone()): Sprout | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (raw.mode !== 'demo' || !isPotId(raw.pot) || typeof raw.plantedAt !== 'string' || !Number.isFinite(Date.parse(raw.plantedAt))) return null;
  if (raw.version !== undefined && raw.version !== 2) return null;
  let name: string;
  try { name = normalizeName(typeof raw.name === 'string' ? raw.name : 'Little Sprout'); } catch { name = 'Little Sprout'; }
  let timeZone = typeof raw.timeZone === 'string' ? raw.timeZone : fallbackZone;
  try { dayKey(new Date(), timeZone); } catch { timeZone = 'UTC'; }
  const firstDay = dayKey(new Date(raw.plantedAt), timeZone);
  const wateredDays = Array.isArray(raw.wateredDays) ? [...new Set(raw.wateredDays.filter(validDay).filter(day => day >= firstDay))].sort() : [];
  return { version: 2, pot: raw.pot, name, plantedAt: raw.plantedAt, timeZone, wateredDays, mode: 'demo' };
}
export function careSummary(sprout: Sprout, now = new Date()) {
  const today = dayKey(now, sprout.timeZone);
  const days = sprout.wateredDays;
  const wateredToday = days.includes(today);
  let cursor = wateredToday ? today : shiftDay(today, -1);
  let streak = 0;
  const entries = new Set(days);
  while (entries.has(cursor)) { streak++; cursor = shiftDay(cursor, -1); }
  let longest = 0, run = 0;
  days.forEach((day, index) => { run = index > 0 && dayOrdinal(day) - dayOrdinal(days[index - 1]) === 1 ? run + 1 : 1; longest = Math.max(longest, run); });
  const growth = days.length >= 7 ? growthStages[2] : days.length >= 3 ? growthStages[1] : growthStages[0];
  const next = growth.id === 'sprout' ? growthStages[1] : growth.id === 'leafy' ? growthStages[2] : null;
  return { today, wateredToday, streak, longest, total: days.length, growth, next, daysToNext: next ? next.days - days.length : 0,
    week: Array.from({ length: 7 }, (_, i) => { const day = shiftDay(today, i - 6); return { day, watered: entries.has(day), isToday: day === today }; }) };
}
export function recordWatering(sprout: Sprout, now = new Date()): Sprout {
  const today = dayKey(now, sprout.timeZone);
  if (sprout.wateredDays.includes(today)) throw new Error('All watered for today. Come back tomorrow!');
  if (today < dayKey(new Date(sprout.plantedAt), sprout.timeZone) || sprout.wateredDays.some(day => day > today)) throw new Error('Your garden’s clock is ahead of today. Check your device date and try again.');
  return { ...sprout, wateredDays: [...sprout.wateredDays, today].sort() };
}
