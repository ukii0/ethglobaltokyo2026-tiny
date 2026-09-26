import { loadEnv } from 'vite';
import { createPublicClient, http, isAddress } from 'viem';
import { baseSepolia } from 'viem/chains';
import { compile } from './compile.mjs';
const env = { ...loadEnv('production', process.cwd(), ''), ...process.env };
const address = env.VITE_GARDEN_CONTRACT_ADDRESS;
if (!address || !isAddress(address)) {
  console.error('Public deployment is not configured. Deploy through the app, then set VITE_GARDEN_CONTRACT_ADDRESS in .env.production.local.');
  process.exit(1);
}
const client = createPublicClient({ chain: baseSepolia, transport: http(env.VITE_GARDEN_RPC_URL || baseSepolia.rpcUrls.default.http[0]) });
try {
  const artifact = await compile();
  if (await client.getChainId() !== baseSepolia.id) throw new Error('RPC chain must be Base Sepolia (84532).');
  if ((await client.getCode({ address }))?.toLowerCase() !== artifact.deployedBytecode.toLowerCase()) throw new Error('Configured contract does not match TinySprout.');
  console.log(`Verified TinySprout on Base Sepolia: https://sepolia.basescan.org/address/${address}`);
} catch (error) { console.error(error.shortMessage || error.message); process.exit(1); }
