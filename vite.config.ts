import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'path';
import pkg from './package.json';

function htmlVariantPlugin(): Plugin {
  return {
    name: 'html-variant',
    transformIndexHtml(html) {
      return html
        .replace(/<title>.*?<\/title>/, `<title>XAUUSD Watcher - Institutional Gold Intelligence Terminal</title>`)
        .replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="Real-time macroeconomic, geopolitical, and technical intelligence terminal for Gold (OANDA:XAUUSD). Live bias engine, news wire, economic calendar, intermarket correlations, and order flow analytics." />`)
        .replace(/<meta name="keywords" content=".*?" \/>/, `<meta name="keywords" content="gold, XAUUSD, trading terminal, macro intelligence, geopolitical risk, economic calendar, intermarket analysis, order flow, bias engine, OANDA, real-time data" />`);
    },
  };
}

function devProxyPlugin(): Plugin {
  return {
    name: 'dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/health', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
      });
    },
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [htmlVariantPlugin(), devProxyPlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'ES2020',
    rollupOptions: {
      output: {
        manualChunks: {
          'worker': ['src/workers/analysis.worker.ts', 'src/workers/feed.worker.ts'],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});