import { BloomFlower } from './BloomFlower';
import type { RefObject } from 'react';
import { ArrowUpRight, Check, Droplets, Flower2, Heart, Leaf, Pencil, Sprout as SproutIcon } from 'lucide-react';
import { careSummary, growthStages, type GrowthId, type PotId, type Sprout } from './gardenModel';

export function PlantArt({ pot, small = false, growing = false, growth = 'leafy' }: { pot: PotId; small?: boolean; growing?: boolean; growth?: GrowthId }) {
  const artwork = `${import.meta.env.BASE_URL}images/${{ paper: 'sprout.png', pebble: 'sprout-pebble.png', sunshine: 'sprout-sunshine.png' }[pot]}`;
  return <div className={`plant-art plant-art--${pot} growth-${growth} ${small ? 'plant-art--small' : ''} ${growing ? 'plant-art--growing' : ''}`} aria-hidden="true">
    <img className="plant-base" src={artwork} alt="" width="1254" height="1254" draggable="false"/>
    <img className="plant-canopy" src={artwork} alt="" width="1254" height="1254" draggable="false"/>
    {growth === 'bloom' && <BloomFlower pot={pot}/>}
  </div>;
}

export function CarePanel({ sprout, now, watering, disabled, message, error, onWater, onRename, onJournal, headingRef }: {
  sprout: Sprout; now: Date; watering: boolean; disabled: boolean; message: string; error: string;
  onWater: () => void; onRename: () => void; onJournal: () => void; headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const care = careSummary(sprout, now);
  return <div className="care-content">
    <div className="care-name-row"><h2 ref={headingRef} tabIndex={-1} className="hand card-title sprout-name">{sprout.name}</h2><button className="icon-button rename-button" onClick={onRename} aria-label="Rename your sprout" disabled={disabled}><Pencil size={17}/></button></div>
    <div className="growth-summary"><span className="growth-badge"><Leaf size={14}/>{care.growth.name}</span><span>{care.total} care {care.total === 1 ? 'day' : 'days'}</span></div>
    <div className="growth-meter" role="progressbar" aria-label="Growth toward full bloom" aria-valuenow={Math.min(care.total, 7)} aria-valuemin={0} aria-valuemax={7}><span style={{ width: `${Math.min(care.total / 7, 1) * 100}%` }}/></div>
    <p className="growth-hint">{care.next ? <><strong>{care.daysToNext} more care {care.daysToNext === 1 ? 'day' : 'days'}</strong> until {care.next.id === 'leafy' ? 'new leaves' : 'full bloom'}.</> : <>Fully grown.</>}</p>
    <div className="care-week-header"><span>Your last 7 days</span><span className="streak-count"><Heart size={13}/><strong>{care.streak}</strong> day streak</span></div>
    <div className="care-week" aria-label="Watering history for the last seven days">
      {care.week.map(day => {
        const date = new Date(`${day.day}T12:00:00Z`);
        const label = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
        return <div key={day.day} className={`care-day ${day.watered ? 'is-watered' : ''} ${day.isToday ? 'is-today' : ''}`} aria-label={`${label}: ${day.watered ? 'watered' : 'not watered'}${day.isToday ? ', today' : ''}`}><span>{new Intl.DateTimeFormat('en', { weekday: 'narrow', timeZone: 'UTC' }).format(date)}</span><span className="care-day-mark">{day.watered ? <Droplets size={16}/> : date.getUTCDate()}</span><span className="today-mark">{day.isToday ? 'today' : ''}</span></div>;
      })}
    </div>
    <button className={`primary-button water-button ${care.wateredToday ? 'is-done' : ''}`} disabled={disabled || care.wateredToday} onClick={onWater}>{watering ? <>Watering… <Droplets size={19}/></> : care.wateredToday ? <>Watered today <Check size={18}/></> : <>Water sprout <Droplets size={19}/></>}</button>
    <div className="care-feedback" role="status" aria-live="polite">{message || (care.wateredToday ? 'Water again after 00:00 UTC.' : 'One watering per UTC day.')}</div>
    {error && <p className="error-message" role="alert">{error}</p>}
    <button className="journal-link" onClick={onJournal}>Open care journal <ArrowUpRight size={15}/></button>
  </div>;
}

export function GrowthJourney({ sprout, now, onPreview }: { sprout: Sprout; now: Date; onPreview: (stage: GrowthId) => void }) {
  const current = careSummary(sprout, now).growth;
  return <section className="growth-journey" aria-label="Growth milestones"><div className="growth-journey-title"><span className="hand">Growth stages</span></div><div className="milestones">
    {growthStages.map((stage, index) => { const Icon = index === 0 ? SproutIcon : index === 1 ? Leaf : Flower2; const unlocked = sprout.wateredDays.length >= stage.days;
      return <button key={stage.id} onClick={() => onPreview(stage.id)} className={`milestone ${current.id === stage.id ? 'is-current' : ''}`} aria-label={`Preview ${stage.name}`}><span className={`milestone-icon ${unlocked ? 'unlocked' : ''}`}><Icon size={25} strokeWidth={1.8}/></span><span><strong className="hand">{stage.name}</strong><span>{stage.days === 0 ? 'Your first day' : `${stage.days} days of care`}{current.id === stage.id ? ' · you are here' : unlocked ? ' · reached' : ''}</span></span><ArrowUpRight size={15}/></button>;
    })}
  </div></section>;
}

export function CareJournal({ sprout, now }: { sprout: Sprout; now: Date }) {
  const care = careSummary(sprout, now);
  return <><div className="journal-stats"><div><strong className="hand">{care.total}</strong><span>care days</span></div><div><strong className="hand">{care.streak}</strong><span>current streak</span></div><div><strong className="hand">{care.longest}</strong><span>best streak</span></div></div>
    <ol className="journal-entries">{sprout.wateredDays.slice(-14).reverse().map(day => <li key={day}><span className="journal-entry-icon"><Droplets size={17}/></span><span><strong>Watered</strong><time dateTime={day}>{new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`))}</time></span></li>)}<li><span className="journal-entry-icon"><SproutIcon size={18}/></span><span><strong>Planted</strong><time dateTime={sprout.plantedAt}>{new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric', timeZone: sprout.timeZone }).format(new Date(sprout.plantedAt))}</time></span></li></ol>
    {care.total > 14 && <p className="journal-note">Showing the latest 14 care days.</p>}
    <p className="journal-note">Daily reset: 00:00 {sprout.timeZone.replaceAll('_', ' ')}.</p>
  </>;
}
