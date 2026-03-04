import { AnalyzedSentence } from '../../types';
import { Result, ok, err } from '../../utils/result';
import { ParsingError } from '../../utils/AppError';

export class LatexParser {
  private static CITE_EXTRACT_REGEX = /(\\(?:cite|parencite|textcite|footcite)[a-zA-Z]*\*?(?:\[[^\]]*\])*\{([^}]+)\})/g;
  private static IEEE_BRACKET_REGEX = /\[(?:\s*\d+\s*(?:[-–]\s*\d+)?\s*)(?:,\s*\d+\s*(?:[-–]\s*\d+)?\s*)*\]/;
  private static NUMBERED_PAREN_REGEX = /\((?:\s*\d+\s*(?:[-–]\s*\d+)?\s*)(?:,\s*\d+\s*(?:[-–]\s*\d+)?\s*)*\)/;
  private static APA_PARENTHESES_REGEX = /\((?:[A-Z][A-Za-z'’`\-]+(?:\s+(?:et al\.?|&|and)\s+[A-Z][A-Za-z'’`\-]+)?(?:,\s*)?(?:19|20)\d{2}[a-z]?(?:;\s*[A-Z][A-Za-z'’`\-]+(?:,\s*)?(?:19|20)\d{2}[a-z]?)*)(?:,\s*p{1,2}\.?\s*\d+(?:-\d+)?)?\)/;
  private static NARRATIVE_AUTHOR_YEAR_REGEX = /\b[A-Z][A-Za-z'’`\-]+(?:\s+et al\.)?\s*\((?:19|20)\d{2}[a-z]?\)/;
  private static MLA_PARENTHESES_REGEX = /\([A-Z][A-Za-z'’`\-]+(?:\s+and\s+[A-Z][A-Za-z'’`\-]+)?\s+\d{1,4}(?:[-–]\d{1,4})?\)/;
  private static SUPERSCRIPT_FOOTNOTE_REGEX = /[⁰¹²³⁴⁵⁶⁷⁸⁹]+/;

  public extractTitle(content: string): string | undefined {
    const titleStart = content.indexOf('\\title{');
    if (titleStart === -1) return undefined;

    let depth = 0;
    let start = titleStart + 7; // Length of "\title{"
    let end = -1;

    for (let i = start; i < content.length; i++) {
      if (content[i] === '{') {
        depth++;
      } else if (content[i] === '}') {
        if (depth === 0) {
          end = i;
          break;
        }
        depth--;
      }
    }

    if (end !== -1) {
      const rawContent = content.substring(start, end);
      // Clean first to handle nested formatting like \textbf{Title \\ Subtitle}
      const cleaned = this.cleanLatex(rawContent);
      // Split by double backslash (\\) or \newline command and take the first part
      // Note: cleanLatex preserves \\ and \newline but replaces \n with space
      const parts = cleaned.split(/\\\\|\\newline/);
      return parts[0].trim();
    }
    return undefined;
  }

  /**
   * Attempts to extract only the main body of the document (from Introduction to Conclusion).
   * Also strips out common non-main-body environments like abstract, appendices, and index.
   */
  private extractMainBody(content: string): string {
    let cleaned = content;

    // 1. Try to start from Introduction
    const introRegex = /\\(section|chapter|subsection)\*?(?:\[[^\]]*\])?\{[^}]*intro[^}]*\}/i;
    const introMatch = introRegex.exec(cleaned);
    if (introMatch) {
      cleaned = cleaned.substring(introMatch.index);
    } else {
      // Fallback: start from \begin{document}
      const docStart = cleaned.indexOf('\\begin{document}');
      if (docStart !== -1) {
        cleaned = cleaned.substring(docStart);
      }
    }

    // 2. Try to end after Conclusion (meaning before the next major section after Conclusion, or appendix)
    const conclusionRegex = /\\(section|chapter|subsection)\*?(?:\[[^\]]*\])?\{[^}]*conclu[^}]*\}/i;
    const conclusionMatch = conclusionRegex.exec(cleaned);
    
    let endCutoffIndex = cleaned.length;

    if (conclusionMatch) {
      const conclusionLevel = conclusionMatch[1].toLowerCase();
      const afterConclusionIndex = conclusionMatch.index + conclusionMatch[0].length;
      const restOfDoc = cleaned.substring(afterConclusionIndex);
      
      let nextLevelRegex: RegExp;
      if (conclusionLevel === 'chapter') {
        nextLevelRegex = /\\(?:chapter|appendix|begin\{thebibliography\}|bibliography\{|printbibliography|printindex)/i;
      } else if (conclusionLevel === 'section') {
        nextLevelRegex = /\\(?:section|chapter|appendix|begin\{thebibliography\}|bibliography\{|printbibliography|printindex)/i;
      } else {
        nextLevelRegex = /\\(?:subsection|section|chapter|appendix|begin\{thebibliography\}|bibliography\{|printbibliography|printindex)/i;
      }
      
      const nextSectionMatch = nextLevelRegex.exec(restOfDoc);
      
      if (nextSectionMatch) {
         endCutoffIndex = afterConclusionIndex + nextSectionMatch.index;
      }
    }

    // 3. Independent of Conclusion, always cut off at Appendices, Bibliography, or Index
    const hardEndMarkers = [
      /\\appendix\b/i,
      /\\begin\{appendices\}/i,
      /\\begin\{thebibliography\}/i,
      /\\bibliography\{/i,
      /\\printbibliography\b/i,
      /\\printindex\b/i,
      /\\end\{document\}/i
    ];

    for (const marker of hardEndMarkers) {
      const match = marker.exec(cleaned);
      if (match && match.index < endCutoffIndex) {
        endCutoffIndex = match.index;
      }
    }

    cleaned = cleaned.substring(0, endCutoffIndex);

    // 4. Strip out abstract if it happens to be inside the extracted portion
    cleaned = cleaned.replace(/\\begin\{abstract\}[\s\S]*?\\end\{abstract\}/gi, '');

    return cleaned;
  }

  /**
   * Removes content that should not be parsed (verbatim, comment environments, iffalse blocks)
   */
  private removeNonTextContent(content: string): string {
    return content
      .replace(/\\begin\{verbatim\}([\s\S]*?)\\end\{verbatim\}/g, '')
      .replace(/\\begin\{comment\}([\s\S]*?)\\end\{comment\}/g, '')
      .replace(/\\iffalse([\s\S]*?)\\fi/g, '');
  }

  /**
   * Extracts all citation keys from the LaTeX content.
   * Handles \cite{key}, \cite{key1, key2}, \parencite{key}, etc.
   */
  public extractCitations(content: string): string[] {
    // Extract main body first
    const mainBody = this.extractMainBody(content);
    // Clean content first to avoid extracting citations from ignored blocks
    let cleanContent = this.removeNonTextContent(mainBody);
    // Also remove comments for simple extraction
    cleanContent = cleanContent.replace(/%.*$/gm, '');

    const citations = new Set<string>();
    // Regex to match citation commands and capture the keys inside {}
    // Matches \cite, \parencite, \textcite, \footcite, etc.
    // Handles optional arguments like [page] before the brace
    const citationRegex = /\\(?:cite|parencite|textcite|footcite|citep|citet)[a-zA-Z]*\*?(?:\[[^\]]*\])*\{([^}]+)\}/g;
    
    let match;
    while ((match = citationRegex.exec(cleanContent)) !== null) {
      // match[1] contains the keys "key1, key2"
      const keys = match[1].split(',');
      keys.forEach(key => {
        const trimmed = key.trim();
        if (trimmed) {
          citations.add(trimmed);
        }
      });
    }
    
    return Array.from(citations);
  }

  /**
   * Removes specified citation keys from the LaTeX content.
   * If a citation command becomes empty (e.g. \cite{removed}), the command is removed.
   * If a citation command has multiple keys (e.g. \cite{kept, removed}), only the removed key is deleted.
   */
  public removeCitations(content: string, keysToRemove: string[]): string {
    if (keysToRemove.length === 0) return content;
    
    const keysSet = new Set(keysToRemove);
    const citationRegex = /(\\(?:cite|parencite|textcite|footcite|citep|citet)[a-zA-Z]*\*?(?:\[[^\]]*\])*)\{([^}]+)\}/g;

    return content.replace(citationRegex, (fullMatch, commandPrefix, keysBody) => {
      const currentKeys = keysBody.split(',').map((k: string) => k.trim());
      const keptKeys = currentKeys.filter((k: string) => !keysSet.has(k));

      if (keptKeys.length === 0) {
        // All keys removed, remove the entire citation command
        // We might want to leave a marker, but user asked to remove.
        return ''; 
      }

      // Reconstruct the citation with kept keys
      return `${commandPrefix}{${keptKeys.join(', ')}}`;
    });
  }

  public static normalizeSentenceForCitationDatabase(sentence: string): string {
    return sentence
      .replace(/\\(?:cite|parencite|textcite|footcite|citep|citet)[a-zA-Z]*\*?(?:\[[^\]]*\])*\{[^}]+\}/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  public static detectCitationFormats(sentence: string): string[] {
    const formats: string[] = [];
    if (/(\\(?:cite|parencite|textcite|footcite|citep|citet)[a-zA-Z]*\*?(?:\[[^\]]*\])*\{[^}]+\})/.test(sentence)) {
      formats.push('LaTeX');
    }
    if (LatexParser.IEEE_BRACKET_REGEX.test(sentence)) {
      formats.push('IEEE');
    }
    if (LatexParser.NUMBERED_PAREN_REGEX.test(sentence)) {
      formats.push('Numbered');
    }
    if (LatexParser.APA_PARENTHESES_REGEX.test(sentence) || LatexParser.NARRATIVE_AUTHOR_YEAR_REGEX.test(sentence)) {
      formats.push('APA');
    }
    if (LatexParser.MLA_PARENTHESES_REGEX.test(sentence)) {
      formats.push('MLA');
    }
    if (LatexParser.SUPERSCRIPT_FOOTNOTE_REGEX.test(sentence) || /<sup>\d+<\/sup>/.test(sentence)) {
      formats.push('Chicago');
    }
    return Array.from(new Set(formats));
  }

  /**
   * Parses LaTeX manuscript content into analyzed sentences.
   * @param content Raw LaTeX string
   */
  public parse(content: string): Result<AnalyzedSentence[], ParsingError> {
    try {
      if (!content || content.trim().length === 0) {
        return err(new ParsingError('Content is empty'));
      }

      // 0. Extract main body
      const mainBody = this.extractMainBody(content);

      // 1. Pre-clean non-text content (verbatim, iffalse, etc.)
      const cleanContent = this.removeNonTextContent(mainBody);

      // 1. Placeholder map to protect citations from sentence splitting
      const placeholders: string[] = [];
      
      // Replace citations with placeholders __CITE_0__, __CITE_1__...
      let protectedText = cleanContent.replace(LatexParser.CITE_EXTRACT_REGEX, (match) => {
        placeholders.push(match);
        return `__CITE_${placeholders.length - 1}__`;
      });

      // 2. Clean other LaTeX artifacts
      protectedText = this.cleanLatex(protectedText);

      // 3. Split into sentences
      // Split on punctuation (.!?) that is followed by a space or end of string.
      const rawSentences = protectedText.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [protectedText];

      const analyzedSentences = rawSentences
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .map(sentenceWithPlaceholders => this.processSentence(sentenceWithPlaceholders, placeholders))
        .filter(s => s.text.length > 20); // Filter out tiny fragments

      return ok(analyzedSentences);

    } catch (error) {
      return err(new ParsingError('Unexpected error during LaTeX parsing', error));
    }
  }

  private cleanLatex(text: string): string {
    return text
      .replace(/%.*$/gm, '') // Remove comments
      .replace(/\\(sub)*section\*?\{([^}]+)\}/g, '$2. ') 
      .replace(/\\textbf\{([^}]+)\}/g, '$1')
      .replace(/\\textit\{([^}]+)\}/g, '$1')
      .replace(/\\emph\{([^}]+)\}/g, '$1')
      .replace(/\\label\{([^}]+)\}/g, '')
      .replace(/\s+/g, ' ');
  }

  private processSentence(sentenceWithPlaceholders: string, placeholders: string[]): AnalyzedSentence {
    const citations: string[] = [];
      
    const restoredSentence = sentenceWithPlaceholders.replace(/__CITE_(\d+)__/g, (match, index) => {
      const original = placeholders[parseInt(index, 10)];
      if (!original) return match;

      // Extract keys from the original citation string
      const keyMatch = /\{([^}]+)\}/.exec(original);
      if (keyMatch) {
        const keys = keyMatch[1].split(',').map(k => k.trim());
        citations.push(...keys);
      }
      
      return original;
    });

    const hasNumbers = /\d+%?|\d+\.\d+/.test(restoredSentence);
    const detectedCitationFormats = LatexParser.detectCitationFormats(restoredSentence);
    const alreadyCited = citations.length > 0 || detectedCitationFormats.length > 0;

    return {
      text: restoredSentence,
      citations,
      alreadyCited,
      detectedCitationFormats,
      entities: [], // Will be filled by EntityExtractor later
      hasNumbers
    };
  }
}
