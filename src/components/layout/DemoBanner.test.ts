import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DemoBanner } from './DemoBanner';

const render = (slug: string | null) => renderToStaticMarkup(createElement(DemoBanner, { slug }));

describe('DemoBanner', () => {
  it('says the data is fake on the demo family', () => {
    const html = render('demo');
    expect(html).toContain('Bản demo');
    expect(html).toContain('dữ liệu');
    expect(html).toContain('giả');
  });
  it('shows nothing on any other family, or when the family is not known yet', () => {
    expect(render('phu-oc')).toBe('');
    expect(render(null)).toBe('');
  });
});
