import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ base: process.env.GITHUB_ACTIONS ? "/ethglobaltokyo2026-tiny/" : "/", plugins: [react()], server: { proxy: { '/__garden_rpc': { target: 'http://127.0.0.1:8545', changeOrigin: true, rewrite: () => '/' } } } });
