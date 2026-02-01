import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Charge les variables d'environnement
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    build: {
      outDir: 'dist', // Dossier de sortie standard pour Cloudflare Pages
    },
    define: {
      // Injection sécurisée de la clé API (Vite remplace la chaîne littérale)
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    }
  };
});