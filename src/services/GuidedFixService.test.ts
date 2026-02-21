
import { describe, it, expect } from 'vitest';
import { GuidedFixService } from './GuidedFixService';
import { AnalysisResult, AnalyzedSentence } from '../types';

describe('GuidedFixService', () => {
  const service = new GuidedFixService();

  const mockResult = (sentence: AnalyzedSentence): AnalysisResult => ({
    overallScore: 50,
    analyzedSentences: [sentence],
    references: {},
    summary: 'Test summary',
    dimensionScores: { Alignment: 0, Numbers: 0, Entities: 0, Methods: 0, Recency: 0, Authority: 0 },
    gaps: [],
  });

  it('should generate an auto-fix for missing citations', () => {
    const sentence: AnalyzedSentence = {
      text: 'This is a claim.',
      citations: [],
      entities: [],
      hasNumbers: false,
      isMissingCitation: true,
    };

    const actions = service.generateFixPlan(mockResult(sentence));
    const action = actions.find(a => a.type === 'missing_citation');

    expect(action).toBeDefined();
    expect(action?.autoFixAvailable).toBe(true);
    expect(action?.apply).toBeDefined();
    
    if (action?.apply) {
      const fixed = action.apply(sentence.text);
      expect(fixed).toBe('This is a claim. [CITATION NEEDED]');
    }
  });

  it('should generate an auto-fix for low relevance citations', () => {
    const sentence: AnalyzedSentence = {
      text: 'This is cited [Ref1].',
      citations: ['Ref1'],
      entities: [],
      hasNumbers: false,
      scores: {
        'Ref1': { Alignment: 0.1, Recency: 0.8, Authority: 0.5, Numbers: 0, Entities: 0, Methods: 0 }
      }
    };

    const actions = service.generateFixPlan(mockResult(sentence));
    const action = actions.find(a => a.type === 'low_relevance');

    expect(action).toBeDefined();
    expect(action?.autoFixAvailable).toBe(true);
    
    if (action?.apply) {
      const fixed = action.apply(sentence.text);
      expect(fixed).toBe('This is cited [Ref1]. [RELEVANCE CHECK: Ref1]');
    }
  });

  it('should generate an auto-fix for outdated citations', () => {
    const sentence: AnalyzedSentence = {
      text: 'This is cited [Ref1].',
      citations: ['Ref1'],
      entities: [],
      hasNumbers: false,
      scores: {
        'Ref1': { Alignment: 0.8, Recency: 0.1, Authority: 0.5, Numbers: 0, Entities: 0, Methods: 0 }
      }
    };

    const actions = service.generateFixPlan(mockResult(sentence));
    const action = actions.find(a => a.type === 'outdated');

    expect(action).toBeDefined();
    expect(action?.autoFixAvailable).toBe(true);
    
    if (action?.apply) {
      const fixed = action.apply(sentence.text);
      expect(fixed).toBe('This is cited [Ref1]. [UPDATE NEEDED: Ref1]');
    }
  });
});
