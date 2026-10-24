import { defineConfig } from 'vite';

const VIRTUAL_UIKIT_WEBGPU_ID = '\0virtual:uikit-webgpu';

export default defineConfig({
  plugins: [
    {
      name: 'stub-uikit-webgpu',
      resolveId(id) {
        if (id === '@pmndrs/uikit/webgpu') {
          return VIRTUAL_UIKIT_WEBGPU_ID;
        }
        return null;
      },
      load(id) {
        if (id === VIRTUAL_UIKIT_WEBGPU_ID) {
          return 'export const getWebGPUHandlers = undefined; export const setWebGPUHandlers = undefined; export default {};';
        }
        return null;
      },
    },
  ],
  server: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: true,
  },
  esbuild: {
    target: 'esnext',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
    exclude: ['xrblocks', '@pmndrs/uikit'],
  },
  build: {
    target: 'esnext',
  },
});
