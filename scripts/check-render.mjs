import {build} from 'esbuild';
await build({entryPoints:['tests/render-entry.jsx'],outfile:'.cache/render-check.mjs',bundle:true,format:'esm',platform:'node',external:['react','react-dom','react-dom/*'],banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},define:{'import.meta.env.BASE_URL':JSON.stringify('./')}});
await import('../.cache/render-check.mjs?run='+Date.now());
await import('./check-report.mjs');
