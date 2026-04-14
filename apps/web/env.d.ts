// Type declarations for non-TS modules imported at build time.
// Phase 9 DEBT-02: MD files imported as raw strings via Turbopack raw-loader rule.

declare module '*.md' {
  const content: string;
  export default content;
}
