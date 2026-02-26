
import { AnalysisResult, AnalyzedSentence, ProcessedReference } from '../types';
import { CitationFinderService } from './CitationFinderService';

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
  citationKey?: string;
}

export class GuidedFixService {
  private citationFinder = new CitationFinderService();

  /**
   * Generates a list of fix actions based on the analysis result.
   */
  public async generateFixPlan(result: AnalysisResult): Promise<FixAction[]> {
    const actions: FixAction[] = [];

    await Promise.all(result.analyzedSentences.map(async (sentence, index) => {
      // 1. Check for Missing Citations
      if (sentence.isMissingCitation) {
        let suggestions = sentence.suggestedReferences || [];
        if (suggestions.length === 0) {
            try {
                suggestions = await this.citationFinder.findSourcesForGap(sentence.text);
            } catch (e) {
                console.warn(`Failed to find gap sources for missing citation at index ${index}`, e);
            }
        }

        const hasSuggestions = suggestions.length > 0;
        actions.push({
          id: `fix-missing-${index}`,
          sentenceIndex: index,
          type: 'missing_citation',
          severity: 'high',
          description: `Sentence contains a claim ("${sentence.triggerPhrase || 'suggests'}") but lacks a citation.`,
          suggestion: hasSuggestions 
            ? `Auto-add best matching source: "${suggestions[0].title.substring(0, 40)}..."`
            : 'Add a citation placeholder to support this claim.',
          autoFixAvailable: true, 
          apply: (text) => `${text} [CITATION NEEDED]`,
          suggestedReferences: suggestions,
        });
      }

      // 2. Check for Low Relevance Scores
      if (sentence.citations.length > 0 && sentence.scores) {
        await Promise.all(Object.entries(sentence.scores).map(async ([citKey, scores]) => {
          if (scores.Alignment < 0.4) {
            let suggestions: ProcessedReference[] = [];
            const ref = result.references[citKey];
            
            if (ref) {
              try {
                // Search for better sources (Alignment > current + improvement threshold)
                suggestions = await this.citationFinder.findBetterSources(ref, sentence.text, scores.Alignment);
              } catch (e) {
                console.warn(`Failed to find better sources for ${citKey}`, e);
              }
            }

            const hasSuggestions = suggestions.length > 0;
            actions.push({
              id: `fix-low-rel-${index}-${citKey}`,
              sentenceIndex: index,
              type: 'low_relevance',
              severity: 'medium',
              description: `Citation [${citKey}] has low relevance alignment (${Math.round(scores.Alignment * 100)}%).`,
              suggestion: hasSuggestions 
                ? `Replace with high-relevance source: "${suggestions[0].title.substring(0, 40)}..."`
                : 'Mark for review with a relevance placeholder.',
              autoFixAvailable: true,
              apply: (text) => `${text} [RELEVANCE CHECK: ${citKey}]`,
              suggestedReferences: suggestions,
              citationKey: citKey,
            });
          }
          if (scores.Recency < 0.2) {
             actions.push({
              id: `fix-outdated-${index}-${citKey}`,
              sentenceIndex: index,
              type: 'outdated',
              severity: 'low',
              description: `Citation [${citKey}] is significantly older than the field average.`,
              suggestion: 'Add a recency reminder placeholder.',
              autoFixAvailable: true,
              apply: (text) => `${text} [UPDATE NEEDED: ${citKey}]`,
            }); 
          }
        }));
      }

      // 4. Check for Identified Gaps
      if (sentence.gapIdentified) {
        let suggestions = sentence.suggestedReferences || [];
        if (suggestions.length === 0) {
            try {
                suggestions = await this.citationFinder.findSourcesForGap(sentence.text);
            } catch (e) {
                console.warn(`Failed to find gap sources at index ${index}`, e);
            }
        }

        const hasSuggestions = suggestions.length > 0;
        actions.push({
          id: `fix-gap-${index}`,
          sentenceIndex: index,
          type: 'gap',
          severity: 'medium',
          description: 'This sentence identifies a potential research gap.',
          suggestion: hasSuggestions 
            ? `Fill gap with suggested paper: "${suggestions[0].title.substring(0, 40)}..."` 
            : 'Highlight this gap with a research placeholder.',
          autoFixAvailable: true,
          apply: (text) => `${text} [RESEARCH GAP]`,
          suggestedReferences: suggestions,
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
    }));

    return actions.sort((a, b) => {
        // Sort by severity
        const severityMap = { high: 0, medium: 1, low: 2 };
        return severityMap[a.severity] - severityMap[b.severity];
    });
  }
}
