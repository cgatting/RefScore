import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { DocumentViewer } from '../src/components/DocumentViewer';
import { AnalysisResult } from '../src/types';
import type { ScoringConfig } from '../src/services/scoring/ScoringEngine';

const mockResult: AnalysisResult = {
  analyzedSentences: [
    {
      text: "This is a sentence with a citation \\cite{ref1}.",
      citations: ['ref1'],
      entities: [],
      hasNumbers: false,
      isMissingCitation: false,
      isHighImpact: false,
      gapIdentified: false,
      scores: {
        ref1: {
          Alignment: 80,
          Numbers: 0,
          Entities: 0,
          Methods: 0,
          Recency: 0,
          Authority: 0
        }
      }
    },
    {
      text: "This sentence has no citation.",
      citations: [],
      entities: [],
      hasNumbers: false,
      isMissingCitation: true,
      isHighImpact: false,
      gapIdentified: false,
    }
  ],
  references: {
    ref1: {
      id: 'ref1',
      title: 'Test Reference',
      authors: ['Test Author'],
      year: 2023,
      venue: 'Test Venue',
      abstract: 'Test Abstract'
    }
  },
  overallScore: 80,
  dimensionScores: {
    Alignment: 80,
    Numbers: 0,
    Entities: 0,
    Methods: 0,
    Recency: 0,
    Authority: 0
  },
  summary: '',
  gaps: []
};

const mockConfig: ScoringConfig = {
  weights: {
    Alignment: 1,
    Numbers: 1,
    Entities: 1,
    Methods: 1,
    Recency: 1,
    Authority: 1
  }
};

describe('DocumentViewer', () => {
  it('renders manuscript text correctly', () => {
    render(
      <DocumentViewer
        result={mockResult}
        onReset={() => {}}
        onUpdate={() => {}}
        manuscriptText="This is a sentence with a citation \\cite{ref1}. This sentence has no citation."
        bibliographyText=""
        scoringConfig={mockConfig}
      />
    );

    expect(screen.getAllByText(/This is a sentence with a citation/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Author 2023/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/This sentence has no citation/).length).toBeGreaterThan(0);
  });

  it('handles complex citations', () => {
     const complexResult: AnalysisResult = {
        ...mockResult,
        analyzedSentences: [
            {
                text: "Here is a complex citation \\parencite[p. 23]{ref1, ref2}.",
                citations: ['ref1', 'ref2'],
                entities: [],
                hasNumbers: false,
                isMissingCitation: false,
                isHighImpact: false,
                gapIdentified: false,
                scores: {
                    ref1: { Alignment: 80, Numbers: 0, Entities: 0, Methods: 0, Recency: 0, Authority: 0 },
                    ref2: { Alignment: 70, Numbers: 0, Entities: 0, Methods: 0, Recency: 0, Authority: 0 }
                }
            }
        ]
     };

     render(
        <DocumentViewer
            result={complexResult}
            onReset={() => {}}
            onUpdate={() => {}}
            manuscriptText="Here is a complex citation \\parencite[p. 23]{ref1, ref2}."
            bibliographyText=""
            scoringConfig={mockConfig}
        />
     );

    expect(screen.getByText(/Here is a complex citation/)).toBeInTheDocument();
    expect(screen.getAllByText(/Author 2023/).length).toBeGreaterThan(0);
     expect(screen.getAllByText(/ref2/).length).toBeGreaterThan(0);
  });

  it('renders Research Gaps panel with filtering and source finding', async () => {
    const gapResult: AnalysisResult = {
      ...mockResult,
      analyzedSentences: [
        {
          text: "It remains unknown whether quiet luxury cues affect trust.",
          citations: [],
          entities: [],
          hasNumbers: false,
          isMissingCitation: false,
          isHighImpact: false,
          gapIdentified: true,
          triggerPhrase: 'unknown',
        }
      ],
      references: {},
    };

    // Mock finder service
    const finderMock: any = {
      findSourcesForGap: vi.fn().mockResolvedValue([
        {
          id: 'Smith2020Trust',
          title: 'Trust and Minimalist Signaling in Consumer Contexts',
          authors: ['Smith'],
          year: 2020,
          venue: 'Journal of Marketing',
          abstract: '...',
          doi: '10.1234/example'
        }
      ]),
      generateBibTeX: vi.fn().mockReturnValue('@article{Smith2020Trust, title={...}}'),
      autoAddForGap: vi.fn().mockReturnValue({
        manuscript: "It remains unknown whether quiet luxury cues affect trust. \\cite{Smith2020Trust}",
        bib: "@article{Smith2020Trust, title={...}}"
      })
    };

    render(
      <DocumentViewer
        result={gapResult}
        onReset={() => {}}
        onUpdate={vi.fn()}
        manuscriptText={gapResult.analyzedSentences[0].text}
        bibliographyText=""
        scoringConfig={mockConfig}
        finderOverride={finderMock}
      />
    );

    // Heading with count
    expect(screen.getByText(/Research Gaps \(1\)/)).toBeInTheDocument();

    // Filter input exists
    const filterInput = screen.getByLabelText(/Filter research gaps/);
    fireEvent.change(filterInput, { target: { value: 'quiet' } });
    expect(screen.getByText(/quiet luxury cues/)).toBeInTheDocument();

    // Click Find Sources
    const btn = screen.getByRole('button', { name: /Find sources/i });
    fireEvent.click(btn);

    // Loading state appears then recommendation renders
    await waitFor(() => expect(finderMock.findSourcesForGap).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText(/Trust and Minimalist Signaling/)).toBeInTheDocument());

    // Copy BibTeX button present
    expect(screen.getByRole('button', { name: /Copy BibTeX/i })).toBeInTheDocument();

    const autoAddBtn = screen.getByRole('button', { name: /Auto Add/i });
    expect(autoAddBtn).toBeInTheDocument();
    fireEvent.click(autoAddBtn);
    expect(finderMock.autoAddForGap).toHaveBeenCalledTimes(1);
  });
});
