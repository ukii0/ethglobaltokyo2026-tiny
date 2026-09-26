import test from 'node:test';
import assert from 'node:assert/strict';
import ganache from 'ganache';
import { createPublicClient, createWalletClient, custom, defineChain, type Address, type PublicClient } from 'viem';
import { abi, bytecode, deployedBytecode } from '../src/chain/contract.ts';
import { readGarden } from '../src/chain/readGarden.ts';
import { contractErrorName } from '../src/chain/errors.ts';
import { careSummary } from '../src/gardenModel.ts';

test('TinySprout real EVM contract and frontend reader', async t => {
  const provider = ganache.provider({ chain: { chainId: 31337, hardfork: 'shanghai' }, wallet: { totalAccounts: 3 }, logging: { quiet: true } });
  const chain = defineChain({ id: 31337, name: 'Test', nativeCurrency: { name: 'Test Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['http://localhost'] } } });
  const transport = custom(provider as any);
  const client = createPublicClient({ chain, transport, cacheTime: 0, pollingInterval: 10 });
  const wallet = createWalletClient({ chain, transport });
  const [alice, bob, empty] = await wallet.getAddresses();
  const deployment = await wallet.deployContract({ account: alice, abi, bytecode, gas: await client.estimateGas({ account: alice, data: bytecode }) });
  const deployed = await client.waitForTransactionReceipt({ hash: deployment });
  const address = deployed.contractAddress!;
  const read = (owner = alice) => readGarden(client as PublicClient, address, owner, chain.id);
  async function send(functionName: 'plant' | 'water' | 'rename', args: readonly unknown[] = [], account = alice) {
    const call = { address, abi, functionName, args, account } as any;
    await client.simulateContract(call);
    const hash = await wallet.writeContract({ ...call, gas: await client.estimateContractGas(call) });
    const receipt = await client.waitForTransactionReceipt({ hash });
    assert.equal(receipt.status, 'success');
    return receipt;
  }
  async function advanceDay(days = 1) {
    const block = await client.getBlock();
    const midnight = (Number(block.timestamp) / 86400 | 0) * 86400 + days * 86400;
    await provider.request({ method: 'evm_setTime', params: [midnight * 1000] });
    await provider.request({ method: 'evm_mine', params: [] });
  }
  try {
    await t.test('deployment contains the expected runtime; empty accounts have no garden', async () => {
      assert.equal(await client.getCode({ address }), deployedBytecode);
      assert.equal((await read()).garden, null);
    });
    await t.test('chain rejects invalid styles, blank names, controls and overlong Unicode', async () => {
      await assert.rejects(send('plant', [3, 'Bean']), (error: unknown) => contractErrorName(error) === 'InvalidPot');
      for (const name of ['', '   ', 'a\u0000', 'a'.repeat(21), '🌱'.repeat(21)]) await assert.rejects(send('plant', [0, name]), (error: unknown) => contractErrorName(error) === 'InvalidName');
      await assert.rejects(send('water', [], empty), (error: unknown) => contractErrorName(error) === 'NotPlanted');
      await assert.rejects(send('rename', ['Bean'], empty), (error: unknown) => contractErrorName(error) === 'NotPlanted');
    });
    await t.test('planting persists style, Unicode name, owner and block time; duplicate planting rejects', async () => {
      await send('plant', [2, '작은 새싹 🌱']);
      const { garden } = await read();
      assert.ok(garden); assert.equal(garden.name, '작은 새싹 🌱'); assert.equal(garden.pot, 'sunshine'); assert.equal(garden.owner, alice); assert.equal(garden.mode, 'onchain'); assert.equal(garden.timeZone, 'UTC');
      await assert.rejects(send('plant', [0, 'Again']), (error: unknown) => contractErrorName(error) === 'AlreadyPlanted');
    });
    await t.test('watering is verified onchain and rejects duplicates including a direct transaction', async () => {
      await send('water');
      await assert.rejects(send('water'), (error: unknown) => contractErrorName(error) === 'AlreadyWatered');
      const hash = await wallet.writeContract({ address, abi, functionName: 'water', account: alice, gas: 100000n });
      assert.equal((await client.waitForTransactionReceipt({ hash })).status, 'reverted');
      assert.equal((await read()).garden!.wateredDays.length, 1);
    });
    await t.test('UTC midnight unlocks another care day; client calendar follows block time', async () => {
      await advanceDay(); await send('water');
      const { garden, now } = await read();
      const care = careSummary(garden!, now);
      assert.equal(care.total, 2); assert.equal(care.streak, 2); assert.equal(care.wateredToday, true);
      assert.equal(garden!.wateredDays[1], now.toISOString().slice(0, 10));
    });
    await t.test('growth unlocks at 3 and 7 recorded days; missed days only reset streak', async () => {
      await advanceDay(); await send('water');
      let result = await read();
      assert.equal(careSummary(result.garden!, result.now).growth.id, 'leafy');
      await advanceDay(2); await send('water');
      result = await read();
      let care = careSummary(result.garden!, result.now);
      assert.equal(care.streak, 1); assert.equal(care.longest, 3); assert.equal(care.growth.id, 'leafy');
      for (let i = 0; i < 3; i++) { await advanceDay(); await send('water'); }
      result = await read(); care = careSummary(result.garden!, result.now);
      assert.equal(care.total, 7); assert.equal(care.growth.id, 'bloom');
    });
    await t.test('wallets cannot mutate another owner; renaming preserves care history', async () => {
      await send('plant', [0, 'Bob'], bob);
      await send('water', [], bob);
      await send('rename', ['Bob renamed'], bob);
      const before = (await read()).garden!;
      await send('rename', ['🌱'.repeat(20)]);
      const after = (await read()).garden!;
      assert.equal(after.name, '🌱'.repeat(20)); assert.deepEqual(after.wateredDays, before.wateredDays);
      assert.equal((await read(bob)).garden!.wateredDays.length, 1);
    });
    await t.test('a fresh client recovers the same garden with no browser storage', async () => {
      const fresh = createPublicClient({ chain, transport: custom(provider as any), cacheTime: 0 });
      const result = await readGarden(fresh as PublicClient, address, alice, chain.id);
      assert.deepEqual(result.garden, (await read()).garden);
    });
    await t.test('care-history pagination is bounded and handles out-of-range offsets', async () => {
      const page = (offset: bigint, limit: bigint) => client.readContract({ address, abi, functionName: 'getCareDays', args: [alice, offset, limit] });
      assert.equal((await page(0n, 3n)).length, 3);
      assert.equal((await page(3n, 3n)).length, 3);
      assert.equal((await page(6n, 3n)).length, 1);
      assert.deepEqual(await page(99n, 3n), []);
      await assert.rejects(page(0n, 257n), (error: unknown) => contractErrorName(error) === 'InvalidPage');
    });
    await t.test('contract rejects ETH deposits', async () => {
      const hash = await wallet.sendTransaction({ account: alice, to: address as Address, value: 1n, gas: 30000n });
      assert.equal((await client.waitForTransactionReceipt({ hash })).status, 'reverted');
      assert.equal(await client.getBalance({ address }), 0n);
    });
  } finally { await provider.disconnect(); }
});
