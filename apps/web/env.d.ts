// Type declarations for non-TS modules imported at build time.
// Phase 9 DEBT-02: MD files imported as raw strings via Turbopack raw-loader rule.
// Phase 16 D-10: `*.md?raw` query — Vite native (vitest jsdom) + Turbopack rule 양립.

declare module '*.md' {
  const content: string;
  export default content;
}

declare module '*.md?raw' {
  const content: string;
  export default content;
}

interface ImportMeta {
  glob<T = unknown>(
    pattern: string,
  ): Record<string, () => Promise<T>>;
}
