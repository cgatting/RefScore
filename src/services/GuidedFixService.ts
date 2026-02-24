
import { AnalysisResult, AnalyzedSentence, ProcessedReference } from '../types';

export interface FixAction {
  id: string;
  sentenceIndex: number;
  type: 'missing_citation' | 'low_relevance' | 'formatting' | 'gap' | 'outdated';
  severity: 'high' | 'medium' | 'low';
  description: string;
  suggestion: string;
  autoFixAvailable: boolean;
  apply?: (currentText: string) => string;
  suggestedReferences?: ProcessedReference[];
}

export class GuidedFixService {
  /**
   * Generates a list of fix actions based on the analysis result.
   */
  public generateFixPlan(result: AnalysisResult): FixAction[] {
    const actions: FixAction[] = [];

    result.analyzedSentences.forEach((sentence, index) => {
      // 1. Check for Missing Citations
      if (sentence.isMissingCitation) {
        actions.push({
          id: `fix-missing-${index}`,
          sentenceIndex: index,
          type: 'missing_citation',
          severity: 'high',
          description: `Sentence contains a claim ("${sentence.triggerPhrase || 'suggests'}") but lacks a citation.`,
          suggestion: sentence.suggestedReferences && sentence.suggestedReferences.length > 0 
            ? 'Select a suggested source or add a placeholder.' 
            : 'Add a citation placeholder to support this claim.',
          autoFixAvailable: true, 
          apply: (text) => `${text} [CITATION NEEDED]`,
          suggestedReferences: sentence.suggestedReferences,
        });
      }

      // 2. Check for Low Relevance Scores
      if (sentence.citations.length > 0 && sentence.scores) {
        Object.entries(sentence.scores).forEach(([citKey, scores]) => {
          if (scores.Alignment < 0.4) {
            actions.push({
              id: `fix-low-rel-${index}-${citKey}`,
              sentenceIndex: index,
              type: 'low_relevance',
              severity: 'medium',
              description: `Citation [${citKey}] has low relevance alignment (${Math.round(scores.Alignment * 100)}%).`,
              suggestion: 'Mark for review with a placeholder.',
              autoFixAvailable: true,
              apply: (text) => `${text} [RELEVANCE CHECK: ${citKey}]`,
            });
          }
          if (scores.Recency < 0.2) {
             actions.push({
              id: `fix-outdated-${index}-${citKey}`,
              sentenceIndex: index,
              type: 'outdated',
              severity: 'low',
              description: `Citation [${citKey}] is significantly older than the field average.`,
              suggestion: 'Mark for update with a placeholder.',
              autoFixAvailable: true,
              apply: (text) => `${text} [UPDATE NEEDED: ${citKey}]`,
            }); 
          }
        });
      }

      // 4. Check for Identified Gaps
      if (sentence.gapIdentified) {
        actions.push({
          id: `fix-gap-${index}`,
          sentenceIndex: index,
          type: 'gap',
          severity: 'medium',
          description: 'This sentence identifies a potential research gap.',
          suggestion: sentence.suggestedReferences && sentence.suggestedReferences.length > 0 
            ? 'Fill this gap with a suggested paper.' 
            : 'Highlight this gap for further exploration.',
          autoFixAvailable: true,
          apply: (text) => `${text} [RESEARCH GAP]`,
          suggestedReferences: sentence.suggestedReferences,
        });
      }

      // 5. Check for Formatting (Heuristic)
      // Example: "et al" without dot, or multiple spaces
      if (sentence.text.includes('et al ') && !sentence.text.includes('et al.')) {
        actions.push({
          id: `fix-fmt-etal-${index}`,
          sentenceIndex: index,
          type: 'formatting',
          severity: 'low',
          description: 'Detected typo in "et al" (missing period).',
          suggestion: 'Change "et al" to "et al."',
          autoFixAvailable: true,
          apply: (text) => text.replace(/et al(?!\.)/g, 'et al.'),
        });
      }
      
      if (/\s{2,}/.test(sentence.text)) {
         actions.push({
          id: `fix-fmt-space-${index}`,
          sentenceIndex: index,
          type: 'formatting',
          severity: 'low',
          description: 'Detected multiple spaces.',
          suggestion: 'Remove extra spaces.',
          autoFixAvailable: true,
          apply: (text) => text.replace(/\s{2,}/g, ' '),
        });
      }
    });

    return actions.sort((a, b) => {
        // Sort by severity
        const severityMap = { high: 0, medium: 1, low: 2 };
        return severityMap[a.severity] - severityMap[b.severity];
    });
  }
}
