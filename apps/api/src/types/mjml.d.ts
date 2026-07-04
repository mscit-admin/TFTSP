// Minimal type shim for mjml (no official @types package).
declare module 'mjml' {
  interface MjmlError {
    line: number;
    message: string;
    tagName: string;
  }
  interface MjmlResult {
    html: string;
    errors: MjmlError[];
  }
  interface MjmlOptions {
    minify?: boolean;
    validationLevel?: 'strict' | 'soft' | 'skip';
  }
  export default function mjml2html(mjml: string, options?: MjmlOptions): MjmlResult;
}
