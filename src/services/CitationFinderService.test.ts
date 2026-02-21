import { describe, it, expect } from 'vitest';
import { CitationFinderService } from './CitationFinderService';

describe('CitationFinderService.autoAddForGap', () => {
  const service = new CitationFinderService();

  it('inserts \\cite and updates .bib when trigger phrase is present', () => {
    const manuscript = 'It remains unknown whether quiet luxury cues affect trust.';
    const bib = '';
    const ref: any = {
      id: 'Smith2020Trust',
      title: 'Trust and Minimalist Signaling in Consumer Contexts',
      authors: ['Smith'],
      year: 2020,
      venue: 'Journal of Marketing',
      abstract: '...',
      doi: '10.1234/example'
    };
    const updated = service.autoAddForGap(manuscript, 'unknown', ref, manuscript, bib);
    expect(updated.manuscript).toMatch(/\\cite\{Smith2020Trust\}/);
    expect(updated.bib).toMatch(/@article\{Smith2020Trust/);
  });

  it('does not duplicate citation if already present', () => {
    const manuscript = 'Something here \\cite{Smith2020Trust}.';
    const bib = '@article{Smith2020Trust, title={Old}}';
    const ref: any = {
      id: 'Smith2020Trust',
      title: 'New',
      authors: ['Smith'],
      year: 2020,
      venue: 'J',
      abstract: '...',
    };
    const updated = service.autoAddForGap('Something here', 'here', ref, manuscript, bib);
    const matches = updated.manuscript.match(/\\cite\{Smith2020Trust\}/g) || [];
    expect(matches.length).toBe(1);
  });
});
