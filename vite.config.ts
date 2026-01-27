
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Stellt sicher, dass der API_KEY zur Laufzeit im Frontend verfügbar ist
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
  },
  server: {
    // Railway weist den Port über die Umgebungsvariable PORT zu
    port: Number(process.env.PORT) || 8080,
    host: '0.0.0.0',
    allowedHosts: true // Erlaubt den Zugriff über die .up.railway.app Domain
  },
  preview: {
    port: Number(process.env.PORT) || 8080,
    host: '0.0.0.0',
    allowedHosts: true
  },
  build: {
    outDir: 'dist',
    target: 'esnext'
  }
});
