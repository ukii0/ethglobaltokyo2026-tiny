import type { Address, PublicClient } from 'viem';
import { abi } from './contract';
import { pots, type Sprout } from '../gardenModel';

// Read every page at one block so another tab's transaction cannot mix snapshots.
export async function readGarden(client: PublicClient, contract: Address, owner: Address, chainId: number) {
  const block = await client.getBlock();
  const [plantedAt, style, name, total] = await client.readContract({ address: contract, abi, functionName: 'getSprout', args: [owner], blockNumber: block.number });
  const now = new Date(Number(block.timestamp) * 1000);
  if (plantedAt === 0n) return { garden: null, now };
  const days: number[] = [];
  for (let offset = 0n; offset < total; offset += 256n) {
    days.push(...await client.readContract({ address: contract, abi, functionName: 'getCareDays', args: [owner, offset, 256n], blockNumber: block.number }));
  }
  if (!pots[style]) throw new Error('This contract returned an unknown pot style.');
  const garden: Sprout = { version: 2, mode: 'onchain', pot: pots[style].id, name, plantedAt: new Date(Number(plantedAt) * 1000).toISOString(), timeZone: 'UTC', wateredDays: days.map(day => new Date(day * 86_400_000).toISOString().slice(0, 10)), owner, contract, chainId };
  return { garden, now };
}
