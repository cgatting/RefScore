import { describe, it, expect } from 'vitest';
import { AnalysisService } from '../../src/services/AnalysisService';
import { LatexParser } from '../../src/services/parsers/LatexParser';

describe('AnalysisService citation state tracking', () => {
  it('tracks already cited sentences and builds a citation database', async () => {
    const service = new AnalysisService();
    const manuscript = `
      Prior work supports this approach (Smith, 2020).
      This method has been evaluated [4].
      Latex evidence exists \\cite{refA}.
      This statement still needs a supporting source.
    `;
    const bibliography = `
      @article{refA,
        title={Evidence A},
        author={Author, A.},
        year={2020},
        journal={Journal}
      }
    `;

    const result = await service.analyze(manuscript, bibliography);
    const apa = result.analyzedSentences.find(s => s.text.includes('(Smith, 2020)'));
    const ieee = result.analyzedSentences.find(s => s.text.includes('[4]'));
    const latex = result.analyzedSentences.find(s => s.text.includes('\\cite{refA}'));
    const uncited = result.analyzedSentences.find(s => s.text.includes('still needs a supporting source'));

    expect(apa?.alreadyCited).toBe(true);
    expect(apa?.detectedCitationFormats).toContain('APA');
    expect(ieee?.alreadyCited).toBe(true);
    expect(ieee?.detectedCitationFormats).toContain('IEEE');
    expect(latex?.alreadyCited).toBe(true);
    expect(latex?.detectedCitationFormats).toContain('LaTeX');
    expect(uncited?.alreadyCited).toBe(false);

    const db = result.citedSentenceDatabase || {};
    const apaKey = LatexParser.normalizeSentenceForCitationDatabase('Prior work supports this approach (Smith, 2020).');
    const uncitedKey = LatexParser.normalizeSentenceForCitationDatabase('This statement still needs a supporting source.');

    expect(db[apaKey]?.alreadyCited).toBe(true);
    expect(db[apaKey]?.citationFormats).toContain('APA');
    expect(db[uncitedKey]?.alreadyCited).toBe(false);
  });
});
