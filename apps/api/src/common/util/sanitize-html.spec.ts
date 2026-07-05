import { sanitizeBiography } from './sanitize-html';

describe('sanitizeBiography', () => {
  it('keeps safe formatting tags', () => {
    const out = sanitizeBiography('<p>وُلد في <strong>الرياض</strong></p>');
    expect(out).toContain('<strong>الرياض</strong>');
    expect(out).toContain('<p>');
  });

  it('strips scripts and event handlers (no stored XSS)', () => {
    const out = sanitizeBiography('<p onclick="steal()">x</p><script>alert(1)</script>');
    expect(out).not.toContain('script');
    expect(out).not.toContain('onclick');
    expect(out).toContain('x');
  });

  it('drops disallowed tags but preserves their text', () => {
    const out = sanitizeBiography('<iframe src="evil"></iframe><div>hi</div>');
    expect(out).not.toContain('iframe');
    expect(out).not.toContain('<div>');
    expect(out).toContain('hi');
  });

  it('adds rel to links and rejects javascript: schemes', () => {
    const out = sanitizeBiography(
      '<a href="https://x.test">ok</a><a href="javascript:evil()">no</a>',
    );
    expect(out).toContain('rel="noopener noreferrer nofollow"');
    expect(out).not.toContain('javascript:');
  });
});
