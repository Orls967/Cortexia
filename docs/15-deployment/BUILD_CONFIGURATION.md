# Build Configuration Specification — CORTEXIA

**Document ID:** `DOC-DEP-001`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document defines the Vite, TypeScript, Web Worker, asset-pipeline, and bundle-splitting build configuration for CORTEXIA's future implementation phases (`Phases A–H`).

## 2. Vite Build Configuration (`vite.config.ts`)

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/Cortexia/',
  plugins: [react()],
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom', 'zustand'],
          'vendor-three': ['three', '@react-three/fiber', '@react-three/drei', 'three-mesh-bvh'],
          'vendor-math-katex': ['katex', 'zod'],
        },
      },
    },
  },
});
```

---

## 3. TypeScript Compiler Strictness (`tsconfig.json`)

Mandatory compiler flags:
- `"target": "ES2022"`, `"module": "ESNext"`, `"moduleResolution": "bundler"`
- `"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`, `"noImplicitReturns": true`, `"noFallthroughCasesInSwitch": true`
- Separate `tsconfig.worker.json` restricting worker files to `["ES2022", "WebWorker"]` lib types (preventing accidental `window` or `document` DOM access inside numerical solvers).

## 4. Static Asset & Registry Handling

- **Base-Path-Aware Asset URLs:** All static `.glb`, `.swc`, and lazy `.json` registry fetches MUST resolve relative to `import.meta.env.BASE_URL` (e.g., `` `${import.meta.env.BASE_URL}assets/models/whole-brain-lod0.glb` ``)—never hardcoded root `/assets/...` paths that break on GitHub Pages `/Cortexia/` subpath hosting.
- **Content-Hashed Filenames:** Vite emits content-hashed asset filenames (`assets/[name]-[hash].[ext]`) enabling immutable browser caching across releases.

## 5. Acceptance Criteria & Related Documents

- **AC-DEP-001:** `npm run build` completes with zero TypeScript, ESLint, or Rollup warnings and emits base-path-prefixed asset manifests.
- **Links:** [GITHUB_PAGES_DEPLOYMENT.md](GITHUB_PAGES_DEPLOYMENT.md), [CI_CD_AND_RELEASE_PROCESS.md](CI_CD_AND_RELEASE_PROCESS.md).
