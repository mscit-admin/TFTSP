import { buildTreeHtml } from './tree-html';

describe('buildTreeHtml (export render input)', () => {
  const nodes = [
    { id: 'a', name: 'محمد', gender: 'male' as const, isDeceased: true },
    { id: 'b', name: 'خالد', gender: 'male' as const, isDeceased: false },
    { id: 'c', name: 'فاطمة', gender: 'female' as const, isDeceased: false },
  ];
  const edges = [
    { parentId: 'a', childId: 'b' },
    { parentId: 'a', childId: 'c' },
  ];

  it('renders an RTL Arabic document with the requested paper size', () => {
    const html = buildTreeHtml(nodes, edges, { paper: 'A3', layout: 'vertical' });
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="ar"');
    expect(html).toContain('size: A3');
    expect(html).toMatch(/font-family:[^;]*Arabic/i);
  });

  it('nests children under their parent and marks the deceased', () => {
    const html = buildTreeHtml(nodes, edges, { paper: 'A4', layout: 'vertical' });
    expect(html).toContain('محمد †'); // deceased marker
    expect(html).toContain('خالد');
    expect(html).toContain('فاطمة');
    // parent contains a nested <ul> with the children
    expect(html).toMatch(/محمد[^<]*<\/span><ul>/);
  });

  it('escapes markup in names (no injection)', () => {
    const html = buildTreeHtml(
      [{ id: 'x', name: '<script>alert(1)</script>', gender: 'male', isDeceased: false }],
      [],
      { paper: 'A4', layout: 'vertical' },
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
