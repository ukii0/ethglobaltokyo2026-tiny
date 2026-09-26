import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { isPotId, type PotId } from './sproutService';

type PreviewState = { selected: PotId; stage: string; connected: boolean; name: string; careDays: number; growth: string; wateredToday: boolean };
type Tool = { name: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean }; execute: (input: unknown) => unknown };
type ModelContext = { registerTool: (tool: Tool, options: { signal: AbortSignal }) => void | Promise<void> };

export function usePreviewTools(state: PreviewState, select: (pot: PotId) => void) {
  const latest = useRef({ state, select });
  latest.current = { state, select };
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools: Tool[] = [
      { name: 'get_sprout_preview', description: 'Read the visible garden UI state. Does not request wallet signatures or send transactions.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: () => ({ ...latest.current.state, mode: 'onchain' }) },
      { name: 'select_sprout_pot', description: 'Choose the pot shown in the preview. Does not connect a wallet or save a sprout.', inputSchema: { type: 'object', properties: { pot: { type: 'string', enum: ['paper', 'pebble', 'sunshine'] } }, required: ['pot'], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: input => {
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 1 || !isPotId((input as { pot?: unknown }).pot)) throw new Error('Choose paper, pebble, or sunshine.');
        if (latest.current.state.stage !== 'choose') throw new Error('The pot can only be changed before planting.');
        const pot = (input as { pot: PotId }).pot;
        flushSync(() => latest.current.select(pot));
        return { selected: pot, saved: false, mode: 'onchain' };
      } },
    ];
    for (const tool of tools) {
      try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); }
      catch { /* The normal interface remains available in unsupported browsers. */ }
    }
    return () => lifecycle.abort();
  }, []);
}
