import { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { growthStages, pots, type GrowthId, type PotId } from './gardenModel';
import { PlantArt } from './GardenCare';

export function GrowthPreview({ initialPot, initialGrowth }: { initialPot: PotId; initialGrowth: GrowthId }) {
  const [pot, setPot] = useState(initialPot);
  const [growth, setGrowth] = useState(initialGrowth);
  const [playing, setPlaying] = useState(false);
  const stage = growthStages.find(item => item.id === growth)!;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (growth === 'sprout') setGrowth('leafy');
      else if (growth === 'leafy') setGrowth('bloom');
      else setPlaying(false);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [playing, growth]);

  function togglePlayback() {
    if (playing) { setPlaying(false); return; }
    setGrowth('sprout'); setPlaying(true);
  }

  return <div className="growth-demo">
    <div className="preview-pot-picker" role="group" aria-label="Preview pot style">
      {pots.map(item => <button key={item.id} aria-pressed={pot === item.id} onClick={() => setPot(item.id)}><span className="preview-pot-mini"><PlantArt pot={item.id} small/></span><span className="hand">{item.name}</span></button>)}
    </div>
    <div className="growth-preview-art"><PlantArt pot={pot} growth={growth}/></div>
    <div className="preview-caption" role="status" aria-live="polite"><p className="hand preview-stage-name">{stage.name}</p></div>
    <div className="growth-preview-tabs" role="group" aria-label="Preview a growth stage">
      {growthStages.map(item => <button key={item.id} aria-pressed={growth === item.id} onClick={() => { setPlaying(false); setGrowth(item.id); }}><strong>{item.days === 0 ? 'Day 0' : `Day ${item.days}`}</strong></button>)}
    </div>
    <div className="preview-playback"><button className="primary-button" onClick={togglePlayback}>{playing ? <><Pause size={17}/> Pause growth</> : <><Play size={17}/> Watch it grow</>}</button><button className="icon-button" aria-label="Reset growth preview" onClick={() => { setPlaying(false); setGrowth('sprout'); }}><RotateCcw size={19}/></button></div>
    <p className="preview-only-note">Preview only. Your saved progress stays unchanged.</p>
  </div>;
}
