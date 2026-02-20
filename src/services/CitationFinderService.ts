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
  public async findBetterSources(currentRef: ProcessedReference, contextSentence: string): Promise<ProcessedReference[]> {
    
    // 1. Extract keywords from the sentence context
    let keywords = contextSentence
      .split(/\W+/)
      .filter(w => w.length > 4 && !['reference', 'citation', 'however', 'because', 'although', 'study', 'work', 'paper'].includes(w.toLowerCase()))
      .slice(0, 5)
      .join(' ');

    // 2. If weak, fallback to title or entities
    if (!keywords || keywords.length < 5) {
        const entities = this.entityExtractor.extract(contextSentence);
        if (entities.length > 0) {
            keywords = entities.join(' ');
        } else {
            // Use title topic
            keywords = currentRef.title.split(':')[0];
        }
    }

    const topic = keywords;
    
    console.log(`Querying OpenAlex for topic: "${topic}"`);

    // Fetch 200 candidates to score and filter
    const candidates = await this.oaService.searchPapers(topic, 200);

    if (candidates.length === 0) return [];

    return this.scoreAndRankCandidates(candidates, contextSentence);
  }

  /**
   * Finds papers to fill a detected research gap or missing citation.
   */
  public async findSourcesForGap(contextSentence: string): Promise<ProcessedReference[]> {
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

    console.log(`Searching OpenAlex for gap filling: "${keywords}"`);
    
    const candidates = await this.oaService.searchPapers(keywords, 500);
    
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
    
    // Robust replacement of citation key in the manuscript
    const escapedId = oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedId}\\b`, 'g');
    
    const newManuscript = manuscriptContent.replace(regex, newRef.id);

    // Update bibliography
    const newBib = upsertAndSortBibTexEntries(bibContent, [this.generateBibTeX(newRef)]);

    return { manuscript: newManuscript, bib: newBib };
  }
}
