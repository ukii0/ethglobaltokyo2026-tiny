import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import ganache from 'ganache';
import { createPublicClient, createWalletClient, custom, defineChain } from 'viem';
import { abi, bytecode } from '../src/chain/contract.ts';

const storage = () => {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
};

test('wallet service handles real EVM writes, rejection, account changes and reconnect', async t => {
  const provider = ganache.provider({ chain: { chainId: 84532, hardfork: 'shanghai' }, logging: { quiet: true } });
  const transport = custom(provider as any);
  const chain = defineChain({ id: 84532, name: 'Test', nativeCurrency: { name: 'Test Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['http://garden.test'] } } });
  const client = createPublicClient({ chain, transport, pollingInterval: 10 });
  const wallet = createWalletClient({ chain, transport });
  const [alice, bob] = await wallet.getAddresses();
  const hash = await wallet.deployContract({ account: alice, abi, bytecode, gas: await client.estimateGas({ account: alice, data: bytecode }) });
  const address = (await client.waitForTransactionReceipt({ hash })).contractAddress!;
  const directory = await mkdtemp(join(tmpdir(), 'sprout-wallet-'));
  const oldFetch = globalThis.fetch;
  let selected = alice, rejectConnect = true, rejectWrite = false;
  const events = new Map<string, (...args: any[]) => void>();
  const injected = {
    on: (event: string, fn: (...args: any[]) => void) => { events.set(event, fn); },
    request: async ({ method, params }: { method: string; params?: any[] }) => {
      if (method === 'eth_requestAccounts') { if (rejectConnect) throw { code: 4001, message: 'User rejected the request' }; return [selected]; }
      if (method === 'eth_accounts') return rejectConnect ? [] : [selected];
      if (method === 'eth_sendTransaction' && rejectWrite) throw { code: 4001, message: 'User rejected the request' };
      return provider.request({ method, params: params ?? [] } as any);
    },
  };
  Object.defineProperty(globalThis, 'window', { value: { ethereum: injected }, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: storage(), configurable: true });
  Object.defineProperty(globalThis, 'sessionStorage', { value: storage(), configurable: true });
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init!.body as string);
    try { return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: await provider.request({ method: body.method, params: body.params ?? [] }) }), { status: 200 }); }
    catch (error: any) { return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: error.code ?? -32000, message: error.message, data: error.data } }), { status: 200 }); }
  };
  try {
    const file = join(directory, 'service.mjs');
    const output = await build({ entryPoints: ['src/sproutService.ts'], bundle: true, platform: 'node', format: 'esm', write: false, define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_GARDEN_CONTRACT_ADDRESS: address, VITE_GARDEN_RPC_URL: 'http://garden.test' }) } });
    await writeFile(file, output.outputFiles[0].text);
    const service = await import(pathToFileURL(file).href);
    await t.test('wallet rejection is actionable and does not fabricate a connection', async () => {
      await assert.rejects(service.connectWallet(), (error: unknown) => /declined/.test(service.friendlyError(error)));
      assert.equal(service.getGardenState().address, null);
    });
    await t.test('a rejected signature leaves no sprout and allows a retry', async () => {
      rejectConnect = false; await service.connectWallet();
      rejectWrite = true; await assert.rejects(service.plantSprout('paper', 'Bean'));
      assert.equal(service.getGardenState().garden, null); assert.equal(service.getGardenState().transaction, null);
      rejectWrite = false; await service.plantSprout('paper', 'Bean');
      assert.equal(service.getGardenState().garden.name, 'Bean'); assert.equal(service.getGardenState().transaction.status, 'success');
    });
    await t.test('concurrent water requests record only one day and recover onchain data', async () => {
      const results = await Promise.allSettled([service.waterSprout(), service.waterSprout()]);
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
      assert.equal(service.getGardenState().garden.wateredDays.length, 1);
      await assert.rejects(service.waterSprout());
      assert.equal(service.getGardenState().transaction, null);
    });
    await t.test('switching accounts clears the prior garden; same wallet restores its own record', async () => {
      selected = bob; events.get('accountsChanged')!([bob]);
      await service.refreshGarden();
      assert.equal(service.getGardenState().garden, null);
      await service.plantSprout('pebble', 'Bob');
      selected = alice; events.get('accountsChanged')!([alice]);
      await service.refreshGarden();
      assert.equal(service.getGardenState().garden.name, 'Bean');
      assert.equal(service.getGardenState().garden.wateredDays.length, 1);
    });
    await t.test('disconnect does not delete records; reconnect and rename preserve care', async () => {
      service.disconnectWallet(); assert.equal(service.getGardenState().garden, null);
      await service.connectWallet(); await service.renameSprout('Mochi');
      assert.equal(service.getGardenState().garden.name, 'Mochi');
      assert.equal(service.getGardenState().garden.wateredDays.length, 1);
    });
    await t.test('a fresh session recovers a submitted transaction by hash without resending it', async () => {
      const call = { account: alice, address, abi, functionName: 'rename' as const, args: ['Recovered'] as const };
      const transactionHash = await wallet.writeContract({ ...call, gas: await client.estimateContractGas(call) });
      localStorage.setItem(`tiny-sprout:pending:84532:${alice.toLowerCase()}`, JSON.stringify({ action: 'rename', status: 'pending', hash: transactionHash }));
      const originalAccountListener = events.get('accountsChanged')!;
      const originalChainListener = events.get('chainChanged')!;
      const fresh = await import(`${pathToFileURL(file).href}?fresh-session`);
      await fresh.connectWallet();
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => { unsubscribe(); reject(new Error('Receipt recovery timed out')); }, 3000);
        const unsubscribe = fresh.subscribeGarden(() => {
          if (fresh.getGardenState().transaction?.status === 'success' && fresh.getGardenState().garden?.name === 'Recovered') {
            clearTimeout(timer); unsubscribe(); resolve();
          }
        });
      });
      assert.equal(fresh.getGardenState().garden.wateredDays.length, 1);
      assert.equal(localStorage.getItem(`tiny-sprout:pending:84532:${alice.toLowerCase()}`), null);
      // The fresh session now owns the provider listeners.
      fresh.disconnectWallet();
      events.set('accountsChanged', originalAccountListener);
      events.set('chainChanged', originalChainListener);
    });
    await t.test('network changes disconnect the session before any further writes', async () => {
      events.get('chainChanged')!('0x1');
      assert.equal(service.getGardenState().address, null);
      await assert.rejects(service.waterSprout(), /Connect your wallet/);
    });
  } finally {
    globalThis.fetch = oldFetch;
    for (const key of ['window', 'localStorage', 'sessionStorage']) delete (globalThis as any)[key];
    await provider.disconnect(); await rm(directory, { recursive: true, force: true });
  }
});
