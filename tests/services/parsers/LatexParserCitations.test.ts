import { describe, it, expect } from 'vitest';
import { LatexParser } from '../../../src/services/parsers/LatexParser';

describe('LatexParser Citations', () => {
  const parser = new LatexParser();

  it('extracts standard citations', () => {
    const latex = `
      This is a claim \\cite{auth2023}.
      Another claim \\parencite{smith2022}.
    `;
    const keys = parser.extractCitations(latex);
    expect(keys).toContain('auth2023');
    expect(keys).toContain('smith2022');
    expect(keys.length).toBe(2);
  });

  it('extracts multiple keys from one command', () => {
    const latex = `See \\cite{key1, key2, key3} for details.`;
    const keys = parser.extractCitations(latex);
    expect(keys).toEqual(['key1', 'key2', 'key3']);
  });

  it('handles spaces in keys', () => {
    const latex = `See \\cite{ key1 ,  key2 }`;
    const keys = parser.extractCitations(latex);
    expect(keys).toEqual(['key1', 'key2']);
  });

  it('extracts from various citation commands', () => {
    const latex = `
      \\textcite{key1} says something.
      \\footcite{key2} is a footnote.
      \\citep{key3} and \\citet{key4}.
    `;
    const keys = parser.extractCitations(latex);
    expect(keys).toEqual(expect.arrayContaining(['key1', 'key2', 'key3', 'key4']));
  });

  it('handles optional arguments', () => {
    const latex = `\\cite[p. 23]{key1}`;
    const keys = parser.extractCitations(latex);
    expect(keys).toEqual(['key1']);
  });

  it('removes specific citation keys', () => {
    const latex = `\\cite{keep, remove}`;
    const result = parser.removeCitations(latex, ['remove']);
    expect(result).toBe('\\cite{keep}');
  });

  it('removes command if all keys removed', () => {
    const latex = `Text \\cite{remove} end.`;
    const result = parser.removeCitations(latex, ['remove']);
    expect(result).toBe('Text  end.');
  });

  it('removes multiple keys from multiple commands', () => {
    const latex = `
      \\cite{k1, r1}
      \\parencite{r2}
      \\textcite{k2, r1}
    `;
    const result = parser.removeCitations(latex, ['r1', 'r2']);
    
    // Whitespace might vary, so check for containment
    expect(result).toContain('\\cite{k1}');
    expect(result).not.toContain('r1');
    expect(result).not.toContain('r2');
    expect(result).toContain('\\textcite{k2}');
  });

  it('marks IEEE-style bracket citations as already cited', () => {
    const parsed = parser.parse('This method is robust and validated in prior work [1, 3-5].');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value[0].alreadyCited).toBe(true);
    expect(parsed.value[0].detectedCitationFormats).toContain('IEEE');
  });

  it('marks APA parenthetical citations as already cited', () => {
    const parsed = parser.parse('This aligns with prior studies (Smith, 2022; Doe, 2021).');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value[0].alreadyCited).toBe(true);
    expect(parsed.value[0].detectedCitationFormats).toContain('APA');
  });

  it('marks MLA parenthetical citations as already cited', () => {
    const parsed = parser.parse('The claim is supported by textual evidence (Johnson 45-47).');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value[0].alreadyCited).toBe(true);
    expect(parsed.value[0].detectedCitationFormats).toContain('MLA');
  });

  it('marks Chicago superscript citations as already cited', () => {
    const parsed = parser.parse('This interpretation was later challenged in archival work¹.');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value[0].alreadyCited).toBe(true);
    expect(parsed.value[0].detectedCitationFormats).toContain('Chicago');
  });

  it('marks LaTeX citation commands as already cited', () => {
    const parsed = parser.parse('This is discussed by \\cite{smith2020} in depth.');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value[0].alreadyCited).toBe(true);
    expect(parsed.value[0].detectedCitationFormats).toContain('LaTeX');
    expect(parsed.value[0].citations).toContain('smith2020');
  });
});
