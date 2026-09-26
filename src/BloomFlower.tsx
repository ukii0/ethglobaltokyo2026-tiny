import type { PotId } from './gardenModel';

/** Decorative bloom artwork shares the pots' rounded black outlines. */
export function BloomFlower({ pot }: { pot: PotId }) {
  return <svg className={`bloom-flower bloom-flower--${pot}`} viewBox="0 0 100 112" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" stroke="var(--ink)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M50 58 C54 78 47 94 48 110" strokeWidth="5"/>
    {pot === 'paper' && <>
      {Array.from({ length: 8 }, (_, index) => <ellipse key={index} cx="50" cy="20" rx="10" ry="18" transform={`rotate(${index * 45} 50 45)`} fill="var(--paper)"/>)}
      <circle cx="50" cy="45" r="13" fill="var(--yellow)"/>
      <path d="M45 43 H45.2 M54 47 H54.2" strokeWidth="3"/>
    </>}
    {pot === 'pebble' && <>
      <path d="M28 50 Q29 25 50 8 Q72 27 72 50 L66 73 H34Z" fill="#d1d1cb"/>
      <path d="M19 26 Q42 28 53 53 Q62 70 50 81 Q26 80 23 60Z" fill="var(--paper)"/>
      <path d="M81 26 Q61 31 49 54 Q38 74 50 81 Q74 79 78 59Z" fill="#aeaeaa"/>
      <path d="M29 40 Q33 49 34 57" stroke="white" strokeWidth="4"/>
    </>}
    {pot === 'sunshine' && <>
      {Array.from({ length: 12 }, (_, index) => <path key={index} d="M43 30 Q37 15 50 2 Q63 15 57 30Z" transform={`rotate(${index * 30} 50 45)`} fill="var(--yellow)" strokeWidth="3"/>)}
      <circle cx="50" cy="45" r="19" fill="var(--ink)"/>
      <g fill="var(--paper)" stroke="none"><circle cx="44" cy="38" r="2"/><circle cx="55" cy="38" r="2"/><circle cx="39" cy="46" r="2"/><circle cx="50" cy="46" r="2"/><circle cx="60" cy="46" r="2"/><circle cx="44" cy="54" r="2"/><circle cx="55" cy="54" r="2"/></g>
    </>}
  </svg>;
}
