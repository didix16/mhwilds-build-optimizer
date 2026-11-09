import { build } from 'esbuild';
await build({ entryPoints: ['src/vendor/calculator/entry.ts'], outfile: 'src/engine/combat-reference.mjs', bundle: true, format: 'esm', platform: 'browser', target:'es2022', legalComments:'inline' });
