import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Markdown } from '../src/components/Markdown';
import { safeTextStyle } from '../src/lib/richText';

describe('formatted Markdown previews', () => {
  const render = (body: string) => renderToStaticMarkup(<Markdown body={body} assets={{}} onNavigate={() => {}} />);
  it('renders saved text formatting and node links', () => {
    const html = render('Alpha **<span style="color: #aa2233; font-family: Georgia; font-size: 24px">beta</span>** <u>gamma</u> [Idea](node://start)');
    expect(html).toContain('<strong>');
    expect(html).toContain('color:#aa2233');
    expect(html).toContain('font-size:24px');
    expect(html).toContain('<u>gamma</u>');
    expect(html).toContain('href="node://start"');
  });
  it('does not execute HTML or permit arbitrary CSS from imported Markdown', () => {
    const html = render('<script>alert(1)</script>\n\n<span onclick="alert(2)" style="position:fixed; background-image:url(https://example.com/tracker); color:#123456">safe</span> [Bad](javascript:alert)');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('position:');
    expect(html).not.toContain('tracker');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('color:#123456');
    expect(safeTextStyle({ fontSize: '999px', fontFamily: 'url(evil)', color: 'expression(evil)' })).toEqual({});
  });
});
