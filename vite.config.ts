import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.PAYMONGO_SECRET_KEY': JSON.stringify(env.PAYMONGO_SECRET_KEY),
      'process.env.STRIPE_SECRET_KEY': JSON.stringify(env.STRIPE_SECRET_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api/paymongo': {
          target: 'https://api.paymongo.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/paymongo/, ''),
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              const secretKey = env.PAYMONGO_SECRET_KEY;
              const encoded = Buffer.from(`${secretKey}:`).toString('base64');
              proxyReq.setHeader('Authorization', `Basic ${encoded}`);
              proxyReq.setHeader('Content-Type', 'application/json');
            });
          },
        },
        // Stripe proxy – injects Bearer auth so the secret key stays server-side
        '/api/stripe': {
          target: 'https://api.stripe.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/stripe/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              const secretKey = env.STRIPE_SECRET_KEY;
              proxyReq.setHeader('Authorization', `Bearer ${secretKey}`);
              proxyReq.setHeader('Content-Type', 'application/x-www-form-urlencoded');
            });
          },
        },
      },
    },
  };
});
