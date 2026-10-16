import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 開発用の入口は app/index.html。ビルド結果は site/ に出力してリポジトリに含める。
// （GitHub Pages が「ブランチから公開」でも「GitHub Actions から公開」でも動くようにするため）
export default defineConfig({
  root: 'app',
  base: './',
  publicDir: '../public',
  plugins: [react()],
  build: {
    outDir: '../site',
    emptyOutDir: true,
  },
});
