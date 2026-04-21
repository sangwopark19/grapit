/**
 * Vitest setup — jsdom polyfills.
 *
 * Phase 12 Plan 12-02 (Rule 3 blocking):
 * jsdom's `Blob`/`File` polyfills do not implement `Blob.prototype.text()` / `.arrayBuffer()`
 * which Plan 12-02 + Wave 0 svg-preview.test.tsx depend on (`await file.text()`).
 * Real browsers and Node 22+ native `File` do implement it. This shim closes that gap.
 */

if (
  typeof Blob !== 'undefined' &&
  typeof Blob.prototype.text !== 'function'
) {
  Blob.prototype.text = function text(): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this as Blob);
    });
  };
}

if (
  typeof Blob !== 'undefined' &&
  typeof Blob.prototype.arrayBuffer !== 'function'
) {
  Blob.prototype.arrayBuffer = function arrayBuffer(): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this as Blob);
    });
  };
}
