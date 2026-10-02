import { build } from 'esbuild';

export async function buildElectron() {
  await build({
    entryPoints: { index: 'src/main/index.ts', preload: 'src/main/preload.ts' },
    outdir: 'dist/main',
    outExtension: { '.js': '.cjs' },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    external: ['electron'],
    sourcemap: true,
  });
}
