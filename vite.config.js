import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const path = fileURLToPath(import.meta.url);

export default {
  root: join(dirname(path), "client"),
  plugins: [react()],
  logLevel: 'error',
  css: {
    devSourcemap: false,
    postcss: {
      plugins: [
        tailwindcss(),
        autoprefixer()
      ]
    }
  },
  server: {
    hmr: {
    },
  },
};
