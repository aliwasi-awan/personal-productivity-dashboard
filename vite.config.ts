import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { ankiRoute } from './ankiRoute';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'ANKI_REVIEW_');
  return { plugins: [react(), tailwindcss(), ankiRoute([env.ANKI_REVIEW_DECK_1 || '', env.ANKI_REVIEW_DECK_2 || ''])], base: './' };
});
