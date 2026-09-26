import { defineChain, getAddress, isAddress } from 'viem';
import { baseSepolia } from 'viem/chains';
export const isLocalChain = import.meta.env.DEV && import.meta.env.VITE_GARDEN_NETWORK === 'local';
export const localChain = defineChain({ id: 31337, name: 'Local Garden', nativeCurrency: { name: 'Test Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } } });
export const chain = isLocalChain ? localChain : baseSepolia;
export const rpcUrl = isLocalChain ? '/__garden_rpc' : import.meta.env.VITE_GARDEN_RPC_URL || baseSepolia.rpcUrls.default.http[0];
const addressKey = `tiny-sprout:contract:${chain.id}`;
export function getContractAddress() {
  const configured = import.meta.env.VITE_GARDEN_CONTRACT_ADDRESS;
  let stored: string | null = null;
  try { stored = localStorage.getItem(addressKey); } catch { /* Storage is optional for configured sites. */ }
  const value = configured || stored;
  return value && isAddress(value) ? getAddress(value) : null;
}
export function storeContractAddress(address: string) { localStorage.setItem(addressKey, getAddress(address)); }
export function explorerUrl(kind: 'tx' | 'address', value: string) { return isLocalChain ? null : `${baseSepolia.blockExplorers.default.url}/${kind}/${value}`; }
export const shortAddress = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;
