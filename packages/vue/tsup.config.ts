import { defineConfig } from 'tsup';
import vuePlugin from 'esbuild-plugin-vue3';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: false, // Manual type declarations due to Vue SFC
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  external: ['vue', '@raw34/openclaw-webchat'],
  esbuildPlugins: [vuePlugin()],
});
