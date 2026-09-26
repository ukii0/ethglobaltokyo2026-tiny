import { decodeErrorResult } from 'viem';
import { abi } from './contract';

// RPCs differ: some put Solidity revert data directly in data; others wrap it.
export function contractErrorName(error: unknown): string | null {
  let current = error;
  for (let depth = 0; current && typeof current === 'object' && depth < 12; depth++) {
    const value = current as { data?: unknown; cause?: unknown };
    const data = value.data;
    const candidates = [data, data && typeof data === 'object' ? (data as { result?: unknown }).result : null, data && typeof data === 'object' ? (data as { data?: unknown }).data : null];
    for (const item of candidates) {
      if (typeof item === 'string' && item.startsWith('0x')) {
        try { return decodeErrorResult({ abi, data: item as `0x${string}` }).errorName; } catch { /* Not Solidity revert data. */ }
      }
      if (item && typeof item === 'object' && 'errorName' in item && typeof item.errorName === 'string') return item.errorName;
    }
    if (data && typeof data === 'object' && 'errorName' in data && typeof data.errorName === 'string') return data.errorName;
    current = value.cause;
  }
  return null;
}
