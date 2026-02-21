import { ProcessedReference, AnalyzedSentence } from '../types';
import { upsertAndSortBibTexEntries } from './parsers/BibTexFileEditor';
import { OpenAlexService } from './OpenAlexService';
import { TfIdfVectorizer } from './nlp/TfIdfVectorizer';
import { EntityExtractor } from './nlp/EntityExtractor';
import { ScoringEngine, computeWeightedTotal } from './scoring/ScoringEngine';

export class CitationFinderService {
  private oaService = new OpenAlexService();
  private vectorizer = new TfIdfVectorizer();
  private entityExtractor = new EntityExtractor();
  private scoringEngine: ScoringEngine;

  constructor(config?: any) {
    this.scoringEngine = new ScoringEngine(config);
  }

  /**
   * Queries OpenAlex for better alternative sources.
   * @param currentRef The reference currently being used
   * @param contextSentence The sentence where it is cited
   */
  public async findBetterSources(currentRef: ProcessedReference, contextSentence: string, baselineTotal?: number, progress?: (msg: string) => void): Promise<ProcessedReference[]> {
    const isGenericTitle = (t: string) =>
      /(^|\b)(contents|index|author index|editorial|preface|foreword|issue|volume)\b/i.test(t);
      
    progress?.('Extracting context and entities');
    const tokens = contextSentence
      .split(/\W+/)
      .filter(w => w.length > 4 && !['reference', 'citation', 'however', 'because', 'although', 'study', 'work', 'paper'].includes(w.toLowerCase()))
      .slice(0, 6)
      .join(' ');
    const entities = this.entityExtractor.extract(contextSentence);
    const titleTopic = (currentRef.title || '').split(':')[0];
    
    const queries = Array.from(new Set([
      tokens,
      entities.join(' '),
      isGenericTitle(titleTopic) ? '' : titleTopic
    ].filter(q => q && q.trim().length > 3)));

    progress?.(`Running ${queries.length} OpenAlex queries`);
    const perQueryLimit = Math.max(1, Math.floor(1000 / Math.max(1, queries.length)));
    const collected: ProcessedReference[] = [];
    for (const q of queries) {
      progress?.(`Query: "${q}" (${perQueryLimit} results target)`);
      const res = await this.oaService.searchPapers(q, perQueryLimit, progress);
      collected.push(...res);
    }

    progress?.('Filtering and deduplicating candidates');
    const seen = new Set<string>();
    const uniqueCandidates = collected.filter(c => {
      const key = (c.doi ? c.doi.toLowerCase() : '') + '|' + (c.title ? c.title.toLowerCase() : '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).filter(c => (c.abstract && c.abstract.length >= 80) && (!c.title || !isGenericTitle(c.title) ? true : false));

    if (uniqueCandidates.length === 0) {
      progress?.('No viable candidates found');
      return [];
    }

    progress?.(`Scoring ${uniqueCandidates.length} candidates`);
    const ranked = this.scoreAndRankCandidates(uniqueCandidates, contextSentence);
    if (typeof baselineTotal === 'number') {
      const better = ranked.filter(r => {
        const total = r.scores ? this.scoringEngine.computeWeightedTotal(r.scores) : 0;
        return total > baselineTotal + 0.5; // require a meaningful improvement
      });
      if (better.length > 0) {
        progress?.(`Found ${better.length} better sources`);
        return better;
      }
      progress?.('No better sources found, expanding search');
      const gap = await this.findSourcesForGap(contextSentence, progress);
      const gapBetter = gap.filter(r => {
        const total = r.scores ? this.scoringEngine.computeWeightedTotal(r.scores) : 0;
        return total > baselineTotal + 0.5;
      });
      if (gapBetter.length > 0) {
        progress?.(`Found ${gapBetter.length} better sources with expanded search`);
        return gapBetter;
      }
      progress?.('Expanded search found no improvements');
      return [];
    }
    return ranked;
  }

  /**
   * Finds papers to fill a detected research gap or missing citation.
   */
  public async findSourcesForGap(contextSentence: string, progress?: (msg: string) => void): Promise<ProcessedReference[]> {
    // 1. Extract potential search terms
    let keywords = contextSentence
      .split(/\W+/)
      .filter(w => w.length > 4 && !['however', 'because', 'although', 'studies', 'shown', 'research', 'indicated', 'found', 'results'].includes(w.toLowerCase()))
      .slice(0, 5)
      .join(' ');

    // 2. If keywords are weak, try Entity Extractor
    if (!keywords || keywords.length < 5) {
        const entities = this.entityExtractor.extract(contextSentence);
        if (entities.length > 0) {
            keywords = entities.join(' ');
        }
    }

    // 3. Fallback: Use the whole sentence (cleaned) if still empty
    if (!keywords || keywords.length < 3) {
        keywords = contextSentence.replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3).slice(0, 8).join(' ');
    }

    if (!keywords || keywords.length < 3) {
        console.warn("Could not extract meaningful keywords from sentence:", contextSentence);
        return [];
    }

    progress?.('Searching for gap-filling sources');
    
    const candidates = await this.oaService.searchPapers(keywords, 1000, progress);
    
    if (candidates.length === 0) return [];

    return this.scoreAndRankCandidates(candidates, contextSentence);
  }

  private scoreAndRankCandidates(candidates: ProcessedReference[], contextSentence: string): ProcessedReference[] {
    // 1. Prepare Corpus (Context + Candidates)
    const corpus = [
      contextSentence,
      ...candidates.map(c => c.abstract)
    ];

    // 2. Fit Vectorizer locally
    this.vectorizer.fit(corpus);

    // 3. Analyze Context Sentence
    const sentenceEmbedding = this.vectorizer.transform(contextSentence);
    const sentenceEntities = this.entityExtractor.extract(contextSentence);
    
    const analyzedSentence: AnalyzedSentence = {
      text: contextSentence,
      embedding: sentenceEmbedding,
      entities: sentenceEntities,
      hasNumbers: /\d/.test(contextSentence),
      isMissingCitation: false,
      isHighImpact: false,
      gapIdentified: false,
      citations: []
    };

    // 4. Score Candidates
    const scoredCandidates = candidates.map(candidate => {
      // Generate embedding for candidate abstract
      candidate.embedding = this.vectorizer.transform(candidate.abstract);

      // Calculate detailed scores
      const scores = this.scoringEngine.calculateScore(analyzedSentence, candidate);
      candidate.scores = scores;
      
      return {
        candidate,
        totalScore: this.scoringEngine.computeWeightedTotal(scores)
      };
    });

    // 5. Sort by Total Score and return top 3
    return scoredCandidates
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 3)
      .map(item => item.candidate);
  }

  /**
   * Generates a BibTeX entry for the new source
   */
  public generateBibTeX(ref: ProcessedReference): string {
    return `@article{${ref.id},
  author = {${ref.authors.join(' and ')}},
  title = {${ref.title}},
  journal = {${ref.venue}},
  year = {${ref.year}},
  abstract = {${ref.abstract}}${ref.doi ? `,\n  doi = {${ref.doi}}` : ''}
}`;
  }

  /**
   * Updates the .tex and .bib files with the new reference
   */
  public updateFiles(
    oldId: string, 
    newRef: ProcessedReference, 
    manuscriptContent: string, 
    bibContent: string
  ): { manuscript: string, bib: string } {
    
    const escapedId = oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedId}\\b`, 'g');
    
    const newManuscript = manuscriptContent.replace(regex, newRef.id);

    const newBib = upsertAndSortBibTexEntries(bibContent, [this.generateBibTeX(newRef)]);

    return { manuscript: newManuscript, bib: newBib };
  }

  public autoAddForGap(
    sentenceText: string,
    triggerPhrase: string | undefined,
    newRef: ProcessedReference,
    manuscriptContent: string,
    bibContent: string
  ): { manuscript: string; bib: string } {
    let updated = manuscriptContent;
    const key = newRef.id;
    const citePattern = new RegExp(`\\\\(?:cite|parencite|textcite|footcite)[^\\{]*\\{[^}]*\\b${key}\\b[^}]*\\}`);
    if (!citePattern.test(updated)) {
      const insertCite = (text: string, idx: number) => {
        const citeStr = ` \\cite{${key}}`;
        const before = text.slice(0, idx);
        const after = text.slice(idx);
        return before + citeStr + after;
      };
      let inserted = false;
      if (triggerPhrase && triggerPhrase.trim().length > 0) {
        const ci = updated.toLowerCase().indexOf(triggerPhrase.toLowerCase());
        if (ci !== -1) {
          const at = ci + triggerPhrase.length;
          updated = insertCite(updated, at);
          inserted = true;
        }
      }
      if (!inserted) {
        const esc = sentenceText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const si = updated.search(new RegExp(esc));
        if (si !== -1) {
          const at = si + sentenceText.length;
          updated = insertCite(updated, at);
          inserted = true;
        }
      }
      if (!inserted) {
        updated = `${updated}\n\n% RefScore\n\\noindent\\textit{\\small Added citation: }\\cite{${key}}.`;
      }
    }
    const newBib = upsertAndSortBibTexEntries(bibContent, [this.generateBibTeX(newRef)]);
    return { manuscript: updated, bib: newBib };
  }
}
