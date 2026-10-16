import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' で GitHub Pages のサブパスでも動くようにする
export default defineConfig({
  base: './',
  plugins: [react()],
});
