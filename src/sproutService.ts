import { BaseError, createPublicClient, createWalletClient, custom, getAddress, http, type Address, type EIP1193Provider, type Hash, type PublicClient, type WalletClient } from 'viem';
import { abi, bytecode, deployedBytecode } from './chain/contract';
import { chain, getContractAddress, isLocalChain, rpcUrl, storeContractAddress } from './chain/config';
import { contractErrorName } from './chain/errors';
import { readGarden } from './chain/readGarden';
import { isPotId, normalizeName, pots, type PotId, type Sprout } from './gardenModel';
export { pots, isPotId, type PotId, type Sprout } from './gardenModel';
export { chain, getContractAddress, isLocalChain, explorerUrl, shortAddress } from './chain/config';

type Provider = EIP1193Provider & { on?: (event: string, listener: (...args: any[]) => void) => void };
type Action = 'plant' | 'water' | 'rename' | 'deploy';
type Transaction = { action: Action; status: 'wallet' | 'pending' | 'success'; hash?: Hash };
type Snapshot = { address: Address | null; garden: Sprout | null; now: Date; loading: boolean; error: string; transaction: Transaction | null; contract: Address | null };
let state: Snapshot = { address: null, garden: null, now: new Date(), loading: false, error: '', transaction: null, contract: getContractAddress() };
const listeners = new Set<() => void>();
export const subscribeGarden = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getGardenState = () => state;
function update(patch: Partial<Snapshot>) { state = { ...state, ...patch }; listeners.forEach(listener => listener()); }
const client = createPublicClient({ chain, transport: http(rpcUrl, { timeout: 15_000, retryCount: 1 }), pollingInterval: isLocalChain ? 600 : 2000 });
let wallet: WalletClient | null = null;
let provider: Provider | undefined;
let started = false, watching = false, generation = 0, readVersion = 0, locked = false;
const pendingKey = (owner: Address) => `tiny-sprout:pending:${chain.id}:${owner.toLowerCase()}`;
function pending(owner: Address): Transaction | null {
  try { const value = JSON.parse(localStorage.getItem(pendingKey(owner)) || 'null'); return value && /^0x[0-9a-fA-F]{64}$/.test(value.hash) && ['plant', 'water', 'rename', 'deploy'].includes(value.action) ? { ...value, status: 'pending' } : null; } catch { return null; }
}
function savePending(owner: Address, transaction: Transaction | null) {
  try { if (transaction) localStorage.setItem(pendingKey(owner), JSON.stringify(transaction)); else localStorage.removeItem(pendingKey(owner)); } catch { /* Receipts can still be checked through the explorer. */ }
}
export function friendlyError(error: unknown): string {
  const raw = `${contractErrorName(error) || ''} ${error instanceof Error ? error.message : String(error)}`;
  const details = error instanceof BaseError ? error.walk() : error;
  const code = (details as { code?: number })?.code;
  if (code === 4001 || /user rejected|user denied/i.test(raw)) return 'Request declined in your wallet. Nothing was changed.';
  if (/AlreadyWatered/.test(raw)) return 'All watered for today. Come back after midnight UTC.';
  if (/AlreadyPlanted/.test(raw)) return 'This wallet already has a sprout. Refresh your garden to see it.';
  if (/NotPlanted/.test(raw)) return 'Plant your sprout before caring for it.';
  if (/InvalidName/.test(raw)) return 'Use a name with 1–20 characters.';
  if (/insufficient funds/i.test(raw)) return 'Your wallet needs a little Base Sepolia test ETH for gas. Use the free faucet link.';
  if (/chain.*mismatch|current chain|wrong network/i.test(raw)) return `Switch your wallet to ${chain.name} and reconnect.`;
  if (/timeout|timed out|HTTP request failed|fetch failed|Failed to fetch/i.test(raw)) return 'The network is taking longer than usual. Refresh the connection; a submitted transaction may still confirm.';
  return error instanceof BaseError ? error.shortMessage : raw;
}
async function verifyContract(address: Address) {
  if (await client.getChainId() !== chain.id) throw new Error('The RPC is on the wrong network. Check the project configuration.');
  if ((await client.getCode({ address }))?.toLowerCase() !== deployedBytecode.toLowerCase()) throw new Error('The garden contract is missing or does not match this app. Open network setup.');
}
export async function refreshGarden() {
  const owner = state.address, contract = state.contract, revision = generation, read = ++readVersion;
  if (!owner || !contract) return;
  try {
    await verifyContract(contract);
    const result = await readGarden(client as PublicClient, contract, owner, chain.id);
    if (revision === generation && read === readVersion) update({ ...result, loading: false, error: '' });
  } catch (error) { if (revision === generation && read === readVersion) update({ loading: false, error: friendlyError(error) }); throw error; }
}
function injected() { return (window as Window & { ethereum?: Provider }).ethereum; }
async function selectAccount(owner: Address) {
  generation++;
  update({ address: getAddress(owner), garden: null, loading: Boolean(state.contract), error: '', transaction: pending(owner) });
  await refreshGarden();
  if (pending(owner) && !locked) void checkTransaction();
}
function watchProvider() {
  if (!provider?.on || watching) return;
  watching = true;
  provider.on('accountsChanged', (accounts: Address[]) => {
    if (!state.address) return;
    if (!accounts.length) disconnectWallet();
    else void selectAccount(accounts[0]).catch(() => {});
  });
  provider.on('chainChanged', () => {
    if (state.address) { disconnectWallet(); update({ error: `Wallet network changed. Reconnect on ${chain.name}.` }); }
  });
}
export async function initializeGarden() {
  if (started) return;
  started = true;
  try {
    if (sessionStorage.getItem('tiny-sprout:disconnected') === 'yes') return;
    provider = injected();
    if (isLocalChain) {
      if (localStorage.getItem('tiny-sprout:local-connected') !== 'yes') return;
      wallet = createWalletClient({ chain, transport: http(rpcUrl) });
    } else {
      if (!provider) return;
      wallet = createWalletClient({ chain, transport: custom(provider) });
      if (await wallet.getChainId() !== chain.id) return;
      watchProvider();
    }
    const [owner] = await wallet.getAddresses();
    if (owner) await selectAccount(owner);
  } catch (error) { update({ loading: false, error: friendlyError(error) }); }
}
export async function connectWallet() {
  provider = injected();
  if (isLocalChain) wallet = createWalletClient({ chain, transport: http(rpcUrl) });
  else {
    if (!provider) throw new Error('Open this app in a browser with MetaMask, Rabby, or another Ethereum wallet installed. The in-app preview does not include a wallet.');
    wallet = createWalletClient({ chain, transport: custom(provider) });
    await wallet.requestAddresses();
    if (await wallet.getChainId() !== chain.id) {
      try { await wallet.switchChain({ id: chain.id }); }
      catch (error) {
        if ((error as { code?: number }).code !== 4902 && !/not.*added|unrecognized chain|unknown chain/i.test(String(error))) throw error;
        await wallet.addChain({ chain }); await wallet.switchChain({ id: chain.id });
      }
    }
    watchProvider();
  }
  const [owner] = await wallet.getAddresses();
  if (!owner) throw new Error('Choose an account in your wallet and try again.');
  sessionStorage.removeItem('tiny-sprout:disconnected');
  if (isLocalChain) localStorage.setItem('tiny-sprout:local-connected', 'yes');
  await selectAccount(owner);
}
export function disconnectWallet() {
  generation++; readVersion++;
  sessionStorage.setItem('tiny-sprout:disconnected', 'yes');
  localStorage.removeItem('tiny-sprout:local-connected');
  update({ address: null, garden: null, loading: false, transaction: null, error: '' });
}
async function activeWallet() {
  const owner = state.address;
  if (!wallet || !owner) throw new Error('Connect your wallet first.');
  if (await wallet.getChainId() !== chain.id) throw new Error('Wrong network.');
  const [current] = await wallet.getAddresses();
  if (current?.toLowerCase() !== owner.toLowerCase()) throw new Error('Your wallet account changed. Reconnect before continuing.');
  return { wallet, owner };
}
async function confirm(owner: Address, transaction: Transaction) {
  let cancelled = false;
  const receipt = await client.waitForTransactionReceipt({ hash: transaction.hash!, timeout: 120_000, confirmations: 1, onReplaced: replacement => {
    cancelled = replacement.reason !== 'repriced';
    transaction = { ...transaction, hash: replacement.transactionReceipt.transactionHash };
    savePending(owner, transaction);
    if (state.address === owner) update({ transaction });
  } });
  savePending(owner, null);
  if (cancelled || receipt.status !== 'success') { if (state.address === owner) update({ transaction: null }); throw new Error(cancelled ? 'The wallet replaced or cancelled this transaction. Refresh your garden before trying again.' : 'The transaction reverted. Your garden was not changed.'); }
  if (transaction.action === 'deploy' && receipt.contractAddress) {
    await verifyContract(receipt.contractAddress);
    storeContractAddress(receipt.contractAddress);
    update({ contract: receipt.contractAddress });
  }
  if (state.address === owner) {
    update({ transaction: { ...transaction, status: 'success' } });
    await refreshGarden();
  }
}
export async function checkTransaction() {
  const owner = state.address;
  if (!owner || locked) return;
  const transaction = pending(owner);
  if (!transaction) { await refreshGarden(); return; }
  locked = true;
  update({ transaction, error: '' });
  try { await confirm(owner, transaction); }
  catch (error) { if (state.address === owner) update({ error: friendlyError(error) }); }
  finally { locked = false; }
}
async function transact(action: Action, args: readonly unknown[] = []) {
  if (locked || state.transaction?.status === 'pending' || state.transaction?.status === 'wallet') throw new Error('Your previous transaction is still being processed. Check its status first.');
  locked = true;
  let owner: Address | undefined;
  let sent = false;
  try {
    const active = await activeWallet(); owner = active.owner;
    const signer = active.wallet;
    const contract = state.contract;
    update({ error: '', transaction: { action, status: 'wallet' } });
    let hash: Hash;
    if (action === 'deploy') {
      if (contract) throw new Error('A garden contract is already configured.');
      hash = await signer.deployContract({ chain, account: owner, abi, bytecode, gas: (await client.estimateGas({ account: owner, data: bytecode })) * 120n / 100n });
    } else {
      if (!contract) throw new Error('Set up the garden contract before planting.');
      await verifyContract(contract);
      const call = { address: contract, abi, account: owner, functionName: action, args } as Parameters<typeof client.simulateContract>[0];
      await client.simulateContract(call);
      const gas = (await client.estimateContractGas(call as Parameters<typeof client.estimateContractGas>[0])) * 120n / 100n;
      // Account and chain are pinned; wallet switching cannot redirect a write silently.
      hash = await signer.writeContract({ ...call, chain, account: owner, gas } as Parameters<typeof signer.writeContract>[0]);
    }
    sent = true;
    const transaction: Transaction = { action, status: 'pending', hash };
    savePending(owner, transaction);
    if (state.address === owner) update({ transaction });
    await confirm(owner, transaction);
  } catch (error) {
    if (!owner || state.address === owner) update({ error: friendlyError(error), ...(!sent ? { transaction: null } : {}) });
    throw error;
  } finally { locked = false; }
}
export async function plantSprout(pot: PotId, name: string) {
  if (!isPotId(pot)) throw new Error('Choose one of the three pots.');
  await transact('plant', [pots.findIndex(item => item.id === pot), normalizeName(name.trim() || 'Little Sprout')]);
}
export async function waterSprout() { await transact('water'); }
export async function renameSprout(name: string) { await transact('rename', [normalizeName(name)]); }
export async function deployGarden() { await transact('deploy'); }
export async function useExistingContract(value: string) {
  if (locked || state.transaction?.status === 'pending') throw new Error('Wait for the current transaction before changing contracts.');
  const address = getAddress(value.trim());
  await verifyContract(address);
  storeContractAddress(address);
  update({ contract: address, garden: null });
  await refreshGarden();
}
