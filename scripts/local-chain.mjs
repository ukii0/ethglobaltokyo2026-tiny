import ganache from 'ganache';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createPublicClient, createWalletClient, defineChain, http } from 'viem';
import { compile } from './compile.mjs';
const root = new URL('../', import.meta.url);
await mkdir(new URL('.local-chain', root), { recursive: true });
const server = ganache.server({ chain: { chainId: 31337, hardfork: 'shanghai' }, database: { dbPath: new URL('.local-chain/db', root).pathname }, wallet: { deterministic: true, totalAccounts: 3 }, logging: { quiet: true }, miner: { blockTime: 2 }, server: { ws: false } });
await server.listen(8545, '127.0.0.1');
const chain = defineChain({ id: 31337, name: 'Local Garden', nativeCurrency: { name: 'Test Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } } });
const client = createPublicClient({ chain, transport: http() });
const wallet = createWalletClient({ chain, transport: http() });
const [account] = await wallet.getAddresses();
const artifact = await compile();
let deployment;
try { deployment = JSON.parse(await readFile(new URL('.local-chain/deployment.json', root), 'utf8')); } catch {}
if (!deployment || await client.getCode({ address: deployment.address }) !== artifact.deployedBytecode) {
  const hash = await wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode, account, gas: await client.estimateGas({ account, data: artifact.bytecode }) });
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error('Local deployment failed.');
  deployment = { chainId: chain.id, address: receipt.contractAddress, transactionHash: hash };
  await writeFile(new URL('.local-chain/deployment.json', root), JSON.stringify(deployment, null, 2));
}
await writeFile(new URL('.env.development.local', root), `VITE_GARDEN_NETWORK=local\nVITE_GARDEN_CONTRACT_ADDRESS=${deployment.address}\n`);
console.log(`Local blockchain ready at http://127.0.0.1:8545\nContract: ${deployment.address}\nDevelopment-only unlocked wallet enabled. No real assets.\nRun npm run dev in another terminal. Production builds always use Base Sepolia.`);
let closing = false;
const shutdown = async () => { if (closing) return; closing = true; await server.close(); process.exit(0); };
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
