import { ProcessedReference, DimensionScores } from '../types';

interface OpenAlexAuthor {
  author: {
    id: string;
    display_name: string;
  };
}

interface OpenAlexWork {
  id: string;
  doi: string | null;
  title: string;
  display_name: string;
  publication_year: number;
  cited_by_count: number;
  authorships: OpenAlexAuthor[];
  primary_location?: {
    source?: {
      display_name: string;
    };
  };
  host_venue?: {
    display_name: string;
  };
  abstract_inverted_index?: Record<string, number[]>;
}

export interface OpenAlexPaper extends Omit<OpenAlexWork, 'abstract_inverted_index'> {
  abstract: string;
}

interface OpenAlexListResponse {
  meta: {
    count: number;
    db_response_time_ms: number;
    page: number;
    per_page: number;
  };
  results: OpenAlexWork[];
}

export class OpenAlexService {
  private static BASE_URL = 'https://api.openalex.org';
  public static normalizeDoi(doi: string): string {
    return doi
      .replace(/^doi:/i, '')
      .replace(/^https?:\/\/doi\.org\//i, '')
      .trim()
      .toLowerCase();
  }

  /**
   * Searches for papers using OpenAlex API.
   * @param query The search query (title, keywords, etc.)
   * @param limit Number of results to return (default 3)
   */
  public async searchPapers(query: string, limit: number = 3, progress?: (msg: string) => void): Promise<ProcessedReference[]> {
    try {
      const collected: OpenAlexWork[] = [];
      const perPage = Math.min(200, Math.max(1, limit));
      let page = 1;
      while (collected.length < limit) {
        const remaining = limit - collected.length;
        const per = Math.min(perPage, remaining);
        progress?.(`OpenAlex: fetching page ${page} (${per} per page)`);
        const url = `${OpenAlexService.BASE_URL}/works?search=${encodeURIComponent(query)}&per_page=${per}&page=${page}`;
        const response = await fetch(url);
        if (!response.ok) break;
        const data: OpenAlexListResponse = await response.json();
        if (!data.results || data.results.length === 0) break;
        collected.push(...data.results);
        progress?.(`OpenAlex: received ${data.results.length} results (total ${collected.length})`);
        if (data.results.length < per) break;
        page += 1;
      }
      if (collected.length === 0) return [];
      return collected.slice(0, limit).map(work => {
        const paper = this.convertToPaper(work);
        return this.mapOpenAlexPaperToReference(paper);
      });
    } catch (error) {
      console.error("OpenAlex Search Failed:", error);
      return [];
    }
  }

  /**
   * Fetches details for multiple papers in a single batch request.
   * Uses DOIs.
   * @param ids Array of DOIs
   */
  public async getBatchDetails(ids: string[]): Promise<Record<string, OpenAlexPaper>> {
    if (ids.length === 0) return {};

    try {
        console.log(`Batch fetching metadata for ${ids.length} papers from OpenAlex...`);
        
        const cleanIds = ids.map(id => OpenAlexService.normalizeDoi(id));
        const filter = cleanIds.join('|');
        
        const url = `${OpenAlexService.BASE_URL}/works?filter=doi:${filter}&per_page=${ids.length}`;
        
        const response = await fetch(url);

        if (!response.ok) {
             throw new Error(`OpenAlex Batch API Error: ${response.status} ${response.statusText}`);
        }

        const data: OpenAlexListResponse = await response.json();
        
        const result: Record<string, OpenAlexPaper> = {};
        
        data.results.forEach((work) => {
            const paper = this.convertToPaper(work);
            
            if (paper.doi) {
                const norm = OpenAlexService.normalizeDoi(paper.doi);
                result[norm] = paper;
            }
        });

        return result;

    } catch (error) {
        console.error("OpenAlex Batch Fetch Failed:", error);
        return {};
    }
  }

  private convertToPaper(work: OpenAlexWork): OpenAlexPaper {
      const abstract = this.reconstructAbstract(work.abstract_inverted_index);
      const { abstract_inverted_index, ...rest } = work;
      return {
          ...rest,
          abstract
      };
  }

  private mapOpenAlexPaperToReference(paper: OpenAlexPaper): ProcessedReference {
    const authors = paper.authorships?.map(a => a.author.display_name) || ["Unknown"];
    const year = paper.publication_year || new Date().getFullYear();
    
    const firstAuthor = authors[0]?.split(' ').pop()?.replace(/\W/g, '') || "Unknown";
    const citationKey = `${firstAuthor}${year}`;

    const scores = this.calculateScores(paper);

    return {
      id: citationKey,
      title: paper.display_name || paper.title,
      authors: authors,
      year: year,
      venue: paper.primary_location?.source?.display_name || paper.host_venue?.display_name || "Unknown Venue",
      abstract: paper.abstract || "No abstract available.",
      doi: paper.doi ? paper.doi.replace('https://doi.org/', '') : undefined,
      citationCount: paper.cited_by_count,
      scores: scores
    };
  }

  private reconstructAbstract(invertedIndex: Record<string, number[]> | undefined): string {
    if (!invertedIndex) return "";
    
    const words: { word: string; index: number }[] = [];
    
    Object.entries(invertedIndex).forEach(([word, indices]) => {
      indices.forEach(index => {
        words.push({ word, index });
      });
    });
    
    words.sort((a, b) => a.index - b.index);
    
    return words.map(w => w.word).join(' ');
  }

  public calculateScores(paper: OpenAlexPaper): DimensionScores {
    const recencyScore = this.calculateRecencyScore(paper.publication_year);
    const authorityScore = this.calculateAuthorityScore(paper.cited_by_count || 0);
    const title = (paper.display_name || paper.title || '').toLowerCase();
    const abstract = (paper.abstract || '');
    const absLower = abstract.toLowerCase();
    const stop = new Set(['the','and','for','with','that','this','from','into','within','between','using','use','via','their','our','your','are','was','were','been','being','have','has','had','not','but','can','could','should','would','may','might','than','then','over','under','on','off','into','onto','about','after','before','during','while','because','as','of','in','to','by','at','or','an','a']);
    const tokens = (s: string) => s.split(/\W+/).filter(w => w.length > 2 && !stop.has(w));
    const tSet = new Set(tokens(title));
    const aSet = new Set(tokens(absLower));
    let inter = 0;
    tSet.forEach(w => { if (aSet.has(w)) inter++; });
    const union = new Set([...tSet, ...aSet]).size || 1;
    const alignmentScore = Math.min(100, Math.max(0, (inter / union) * 100));
    const numbersScore = /\d/.test(abstract) ? 100 : 40;
    const acronyms = (abstract.match(/\b[A-Z]{2,}\b/g) || []).length;
    const entitiesScore = Math.min(100, 50 + acronyms * 10);
    const methodKeywords = ['method','approach','algorithm','framework','model','randomized','experiment','evaluation','metric','pipeline','procedure'];
    const mkCount = methodKeywords.reduce((acc, k) => acc + (absLower.includes(k) ? 1 : 0), 0);
    const methodsScore = Math.min(100, 50 + mkCount * 10);
    return {
      Alignment: alignmentScore,
      Numbers: numbersScore,
      Entities: entitiesScore,
      Methods: methodsScore,
      Recency: recencyScore,
      Authority: authorityScore
    };
  }

  private calculateRecencyScore(year: number): number {
    if (!year) return 50;
    const currentYear = new Date().getFullYear();
    const age = currentYear - year;
    if (age <= 2) return 100;
    if (age <= 5) return 90;
    if (age <= 10) return 70;
    return 50;
  }

  private calculateAuthorityScore(citations: number): number {
    if (citations > 1000) return 100;
    if (citations > 100) return 90;
    if (citations > 50) return 80;
    if (citations > 10) return 70;
    return 60;
  }
}
