import { build } from 'esbuild'

// Bundle the h3 server into a Nitro-style entrypoint so the root Dockerfile
// (`node .output/server/index.mjs`) runs it unchanged.
await build({
  entryPoints: ['src/server.ts'],
  outfile: '.output/server/index.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  // Some transitive deps are CommonJS and call require(); provide it in ESM.
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
})

console.log('built .output/server/index.mjs')
