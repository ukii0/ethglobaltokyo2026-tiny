import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ArrowRight, Check, CircleHelp, Droplets, Heart, Leaf, LoaderCircle, LockKeyhole, Sparkles, Sprout as SproutIcon, Wallet, X } from 'lucide-react';
import { chain, checkTransaction, connectWallet, deployGarden, disconnectWallet, explorerUrl, friendlyError, getGardenState, initializeGarden, isLocalChain, plantSprout, pots, refreshGarden, renameSprout, shortAddress, subscribeGarden, useExistingContract, waterSprout, type PotId } from './sproutService';
import { usePreviewTools } from './usePreviewTools';
import { careSummary, normalizeName, type GrowthId } from './gardenModel';
import { GrowthPreview } from './GrowthPreview';
import { CareJournal, CarePanel, GrowthJourney, PlantArt } from './GardenCare';

type ModalKind = 'connect' | 'approve' | 'help' | 'wallet' | 'setup' | 'rename' | 'journal' | 'growth' | null;
type Stage = 'choose' | 'planting' | 'saved';

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => { dialog?.close(); previousFocus?.focus(); };
  }, []);
  useEffect(() => { ref.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [title]);
  return <dialog ref={ref} aria-labelledby="dialog-title" className="dialog" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="dialog-inner">
      <button className="icon-button modal-close" aria-label="Close dialog" onClick={onClose}><X size={21} /></button>
      <h2 id="dialog-title" className="hand">{title}</h2>
      {children}
    </div>
  </dialog>;
}

export default function App() {
  const backend = useSyncExternalStore(subscribeGarden, getGardenState);
  const saved = backend.garden;
  const connected = Boolean(backend.address);
  const transactionBusy = backend.transaction?.status === 'wallet' || backend.transaction?.status === 'pending';
  const [selected, setSelected] = useState<PotId>('paper');
  const [modal, setModal] = useState<ModalKind>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [rename, setRename] = useState('');
  const [contractInput, setContractInput] = useState('');
  const [careMessage, setCareMessage] = useState('');
  const [previewGrowth, setPreviewGrowth] = useState<GrowthId>('sprout');
  const completion = useRef<HTMLHeadingElement>(null);
  const now = backend.now;
  const busy = working || transactionBusy;
  const watering = Boolean(transactionBusy && backend.transaction?.action === 'water');
  const stage: Stage = saved ? 'saved' : transactionBusy && backend.transaction?.action === 'plant' ? 'planting' : 'choose';
  const finished = stage === 'saved';
  const pot = pots.find(item => item.id === selected)!;
  const care = saved ? careSummary(saved, now) : null;
  const visibleError = error || backend.error;
  usePreviewTools({ selected, stage, connected, name: saved?.name ?? name, careDays: care?.total ?? 0, growth: care?.growth.id ?? 'sprout', wateredToday: care?.wateredToday ?? false }, setSelected);
  useEffect(() => { void initializeGarden(); }, []);
  useEffect(() => { if (saved) setSelected(saved.pot); }, [saved]);
  useEffect(() => { if (finished) completion.current?.focus(); }, [finished]);
  useEffect(() => {
    const refresh = () => { if (!getGardenState().loading) void refreshGarden().catch(() => {}); };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);

  function closeModal() { if (!busy) { setModal(null); setError(''); } }
  function start() {
    try { normalizeName(name.trim() || 'Little Sprout'); setError(''); setModal(!connected ? 'connect' : !backend.contract ? 'setup' : 'approve'); }
    catch (cause) { setError(friendlyError(cause)); }
  }
  async function connect() {
    if (busy) return;
    setWorking(true); setError('');
    try {
      await connectWallet();
      const latest = getGardenState();
      setModal(!latest.contract ? 'setup' : latest.garden ? 'wallet' : 'approve');
    } catch (cause) { setError(friendlyError(cause)); }
    finally { setWorking(false); }
  }
  async function plant() {
    if (busy) return;
    setModal(null); setWorking(true); setError('');
    try { await plantSprout(selected, name); setCareMessage('Sprout saved.'); }
    catch (cause) { setError(friendlyError(cause)); }
    finally { setWorking(false); }
  }
  async function water() {
    if (busy || !saved) return;
    setWorking(true); setError(''); setCareMessage('');
    const previousGrowth = careSummary(saved, now).growth.id;
    try {
      await waterSprout();
      const latest = getGardenState();
      if (latest.garden) {
        const nextCare = careSummary(latest.garden, latest.now);
        setCareMessage(nextCare.growth.id !== previousGrowth ? `${nextCare.growth.id === 'bloom' ? 'Flowers' : 'New leaves'} unlocked.` : 'Watering saved.');
      }
    } catch (cause) { setError(friendlyError(cause)); }
    finally { setWorking(false); }
  }
  async function saveName() {
    if (busy) return;
    setWorking(true); setError('');
    try { await renameSprout(rename); setModal(null); setCareMessage('Name updated.'); }
    catch (cause) { setError(friendlyError(cause)); }
    finally { setWorking(false); }
  }
  async function setup(deploy: boolean) {
    if (busy) return;
    setWorking(true); setError('');
    try {
      if (deploy) { if (!getGardenState().address) await connectWallet(); await deployGarden(); }
      else await useExistingContract(contractInput);
    } catch (cause) { setError(friendlyError(cause)); }
    finally { setWorking(false); }
  }
  const transactionLink = backend.transaction?.hash ? explorerUrl('tx', backend.transaction.hash) : null;
  const contractLink = backend.contract ? explorerUrl('address', backend.contract) : null;
  const transactionLabel = backend.transaction?.status === 'wallet' ? 'Confirm the request in your wallet.' : backend.transaction?.status === 'pending' ? 'Transaction submitted. Waiting for the network…' : 'Confirmed onchain.';

  return <div className="site-shell">
    <a href="#garden" className="skip-link">Skip to your sprout</a>
    <header className="header">
      <a className="brand" href="#garden" aria-label="Tiny Sprout home"><SproutIcon size={33} strokeWidth={2.5}/><span className="hand">tiny sprout<span className="brand-period">.</span></span></a>
      <nav aria-label="Main navigation">
        <button className="help-link" onClick={() => setModal('help')}>How it works <CircleHelp size={17}/></button>
        <button className="wallet-button" disabled={busy} onClick={() => setModal(connected ? 'wallet' : 'connect')}><Wallet size={17}/><span>{backend.address ? shortAddress(backend.address) : isLocalChain ? 'Connect test wallet' : 'Connect wallet'}</span>{connected && <Check size={15}/>}</button>
      </nav>
    </header>

    <div className="network-strip"><span className="network-dot"/><span>{isLocalChain ? 'Local test chain' : 'Base Sepolia · testnet'}</span>{!backend.contract && <button onClick={() => setModal('setup')}>Set up garden ↗</button>}{connected && <button disabled={busy || backend.loading} onClick={() => { setError(''); void refreshGarden().catch(() => {}); }}>{backend.loading ? 'Loading…' : 'Refresh'}</button>}</div>
    {backend.transaction && <div className={`transaction-notice transaction-${backend.transaction.status}`} role="status"><span>{transactionBusy ? <LoaderCircle className="spin" size={16}/> : <Check size={16}/>} {transactionLabel}</span>{transactionLink && <a href={transactionLink} target="_blank" rel="noreferrer">View transaction ↗</a>}{backend.transaction.status === 'pending' && <button onClick={() => void checkTransaction()}>Check status</button>}</div>}

    <main id="garden" className={`garden ${finished ? 'garden--saved' : ''}`}>
      <section className="garden-story" aria-label="Your little beginning">
        <h1 className="hand">{finished ? <>A little care.<br/>A little growth.</> : <>Small beginnings.<br/><span className="headline-second">Big little feelings.</span></>}</h1>
        <p className="intro">{finished ? 'Water once a day to grow your sprout.' : 'Choose a pot, name it, and connect your wallet.'}</p>
        <div className={`illustration-stage ${stage === 'planting' ? 'is-planting' : ''} ${finished ? 'is-saved' : ''} ${watering ? 'is-watering' : ''}`}>
          <div className="hand side-note">{finished ? care?.wateredToday ? 'feeling loved.' : 'a little thirsty.' : 'a little you.'}<span className="curved-arrow">⤵</span></div>
          <span className="sparkle sparkle-one" aria-hidden="true">✳</span>
          <span className="sparkle sparkle-two" aria-hidden="true">✧</span>
          <div className="hero-plant" key={selected}><PlantArt pot={selected} growth={finished ? care?.growth.id : 'leafy'} growing={stage === 'planting'}/>{watering && <div className="water-drops" aria-hidden="true"><Droplets/><Droplets/><Droplets/></div>}</div>
          <span className="hand plant-caption">{finished ? saved?.name : 'ready when you are.'}</span>
          <div className="hand stamp" aria-hidden="true">{finished ? <>{care?.total ?? 0} days<br/>of little care</> : <>small<br/>is a start</>}<Sparkles size={17}/></div>
        </div>
      </section>

      <section className="workbench" aria-label={finished ? 'Your saved sprout' : 'Choose your pot'}>
        <div className="paper-card">
          {stage === 'choose' && <>
            <h2 className="hand card-title">Pick your pot.</h2>
            <fieldset className="pot-options"><legend className="sr-only">Choose a pot</legend>
              {pots.map(item => <label key={item.id} className={`pot-option ${selected === item.id ? 'is-selected' : ''}`}>
                <input type="radio" name="pot" value={item.id} checked={selected === item.id} onChange={() => setSelected(item.id)}/>
                <span className="pot-thumbnail"><PlantArt pot={item.id} small/>{selected === item.id && <span className="selection-check"><Check size={12} strokeWidth={3}/></span>}</span>
                <span className="hand pot-name">{item.name}</span>
              </label>)}
            </fieldset>
            <div className="name-field"><label htmlFor="sprout-name">Name <span>optional</span></label><input id="sprout-name" value={name} onChange={event => { setName(event.target.value); setError(''); }} placeholder="Little Sprout" maxLength={40} autoComplete="off" aria-describedby="name-hint"/><span id="name-hint">Up to 20 characters.</span></div>
            <button className="primary-button" disabled={busy || backend.loading} onClick={start}>{backend.loading ? 'Finding your sprout…' : 'Plant my sprout'} <ArrowRight size={19}/></button>
            {visibleError && <p className="error-message" role="alert">{visibleError}</p>}
          </>}
          {stage === 'planting' && <div className="planting-content" role="status" aria-live="polite">
            <div className="spinner-ring"><LoaderCircle size={36}/></div>
            <h2 className="hand card-title">Putting down roots…</h2>
            <div className="progress-track"><div/></div><span className="progress-label">Saving your sprout onchain</span>
          </div>}
          {finished && saved && <CarePanel sprout={saved} now={now} watering={watering} disabled={busy || backend.loading} message={careMessage} error={modal ? '' : visibleError} onWater={water} onRename={() => { setRename(saved.name); setError(''); setModal('rename'); }} onJournal={() => setModal('journal')} headingRef={completion}/>}
        </div>
      </section>
    </main>

    {finished && saved ? <GrowthJourney sprout={saved} now={now} onPreview={growth => { setPreviewGrowth(growth); setModal('growth'); }}/> : <section className="journey" aria-label="How your sprout works">
      <div><span className="step-number hand">1.</span><span><strong>Choose your pot</strong></span></div>
      <span className="journey-arrow" aria-hidden="true">⤳</span>
      <div><span className="step-number hand">2.</span><span><strong>Water once a day</strong></span></div>
      <span className="journey-arrow" aria-hidden="true">⤳</span>
      <div><span className="step-number hand">3.</span><span><strong>Bloom in 7 care days</strong></span></div>
    </section>}

    {modal && <Modal title={{ connect: 'Connect wallet.', approve: 'Plant your sprout?', help: 'How it works.', wallet: 'Your wallet.', setup: 'Set up garden.', rename: 'Rename your sprout.', journal: 'Care journal.', growth: 'Growth preview.' }[modal]} onClose={closeModal}>
      {modal === 'connect' && <><div className="dialog-icon"><Wallet size={31}/></div><p>{isLocalChain ? 'Connect the local test wallet.' : 'Connect your wallet to save and retrieve your sprout.'}</p><div className="notice"><LockKeyhole size={17}/><span>{isLocalChain ? 'Local test ETH only.' : 'Use a browser wallet with Base Sepolia test ETH for gas.'}</span></div><button className="primary-button" disabled={busy} onClick={connect}>{busy ? <><LoaderCircle className="spin" size={18}/> Connecting…</> : <>{isLocalChain ? 'Connect test wallet' : 'Connect browser wallet'} <ArrowRight size={18}/></>}</button><a className="text-button faucet-link" href="https://docs.base.org/get-started/get-funds" target="_blank" rel="noreferrer">Get free test ETH ↗</a></>}
      {modal === 'approve' && <><div className="approval-pot"><PlantArt pot={selected} small/><span className="hand">{pot.name}</span></div><p>Your pot and name will be saved publicly to your wallet.</p><div className="approval-summary"><span>Network</span><strong>{chain.name}</strong><span>Cost</span><strong>Test ETH gas only</strong><span>Garden</span><strong>One per wallet</strong></div><button className="primary-button" disabled={busy || !backend.contract} onClick={plant}>Approve & plant <SproutIcon size={19}/></button><button className="text-button" disabled={busy} onClick={closeModal}>Cancel</button></>}
      {modal === 'help' && <><ol className="help-steps"><li><strong>Make it yours.</strong> Choose a pot and name your sprout. Your wallet approves planting.</li><li><strong>Water once a day.</strong> Each watering is a transaction. A new day starts at midnight UTC, using the blockchain’s clock.</li><li><strong>Watch it grow.</strong> 3 care days bring new leaves; 7 bring a bloom. A missed day resets your streak, while growth stays.</li></ol><div className="notice"><Leaf size={19}/><span>Records are public. Reconnect the same wallet to retrieve your sprout.</span></div><button className="primary-button" onClick={closeModal}>Got it <ArrowRight size={18}/></button></>}
      {modal === 'wallet' && <><div className="dialog-icon"><Wallet size={31}/></div><p>{connected ? 'Disconnecting keeps your sprout saved.' : 'Connect the same wallet to retrieve your sprout.'}</p><div className="chain-details"><span>Network</span><strong>{chain.name}</strong>{backend.address && <><span>Wallet</span><code>{backend.address}</code></>}{backend.contract && <><span>Garden contract</span>{contractLink ? <a href={contractLink} target="_blank" rel="noreferrer">{backend.contract} ↗</a> : <code>{backend.contract}</code>}</>}</div><a className="text-button faucet-link" href="https://docs.base.org/get-started/get-funds" target="_blank" rel="noreferrer">Get free test ETH ↗</a>{connected ? <button className="primary-button" disabled={busy} onClick={() => { disconnectWallet(); setCareMessage(''); setError(''); setModal(null); }}>Disconnect wallet</button> : <button className="primary-button" disabled={busy} onClick={connect}>Connect wallet</button>}</>}
      {modal === 'setup' && <><p>{backend.contract ? 'The garden contract is ready. Save this address in the production configuration so everyone uses the same garden.' : 'The shared garden needs one contract deployment. Approve it with a funded Base Sepolia wallet, or connect an existing Tiny Sprout contract.'}</p>{backend.contract ? <><div className="chain-details"><span>Contract address</span><code>{backend.contract}</code><span>Production configuration</span><code>VITE_GARDEN_CONTRACT_ADDRESS={backend.contract}</code></div>{contractLink && <a className="text-button" href={contractLink} target="_blank" rel="noreferrer">View deployed contract ↗</a>}<button className="primary-button" onClick={() => setModal(connected ? 'approve' : 'connect')}>Continue to my sprout <ArrowRight size={18}/></button></> : <><div className="notice">Network: {chain.name}. Deployment uses test ETH. No private key is entered in this app.</div><button className="primary-button" disabled={busy} onClick={() => void setup(true)}>{busy ? 'Waiting for the network…' : 'Deploy garden contract'} <SproutIcon size={18}/></button><a className="text-button faucet-link" href="https://docs.base.org/get-started/get-funds" target="_blank" rel="noreferrer">Get free test ETH ↗</a><form onSubmit={event => { event.preventDefault(); void setup(false); }}><div className="name-field"><label htmlFor="contract-address">Or use an existing contract</label><input id="contract-address" placeholder="0x…" value={contractInput} onChange={event => setContractInput(event.target.value)} required autoComplete="off"/></div><button className="text-button" disabled={busy || !contractInput}>Connect this contract</button></form></>}</>}
      {modal === 'rename' && <form onSubmit={event => { event.preventDefault(); void saveName(); }}><p>Approve the name change in your wallet. Names are public.</p><div className="name-field"><label htmlFor="rename-sprout">Your sprout’s name</label><input id="rename-sprout" value={rename} onChange={event => { setRename(event.target.value); setError(''); }} maxLength={40} autoComplete="off" required disabled={busy}/><span>Up to 20 characters.</span></div><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving onchain…' : 'Save name'} <Check size={18}/></button></form>}
      {modal === 'journal' && saved && <><CareJournal sprout={saved} now={now}/>{contractLink && <a className="text-button" href={contractLink} target="_blank" rel="noreferrer">View garden contract ↗</a>}<button className="primary-button" onClick={closeModal}>Back to garden <Heart size={18}/></button></>}
      {modal === 'growth' && <GrowthPreview initialPot={selected} initialGrowth={previewGrowth}/>}
      {modal !== 'growth' && visibleError && <p role="alert" className="error-message">{visibleError}</p>}
    </Modal>}
  </div>;
}
