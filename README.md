# RefScore

RefScore is a multi-dimensional system for automated academic reference analysis and manuscript alignment. It combines OpenAlex metadata with local NLP (TF-IDF, entity extraction) to validate citations, surface gaps, and improve bibliography quality.

## Features

- **Document parsing**: LaTeX and BibTeX ingestion.
- **Citation analysis**: Extraction, validation, and gap detection.
- **Reference scoring**: Multi-dimensional relevance scoring.
- **OpenAlex integration**: Metadata retrieval and paper validation.
- **Interactive dashboards**: Visualize alignment, gaps, and reference quality.

## Pipeline Overview

RefScore processes a manuscript and bibliography in a deterministic pipeline that enriches references, scores alignment, and proposes guided fixes.

1. **Parse inputs**
   - LaTeX manuscript is parsed into sentences and citation keys.
   - BibTeX is parsed into structured references with IDs, authors, titles, venues, years, and DOIs.
2. **Enrich references**
   - If DOIs are present, OpenAlex batch metadata is fetched.
   - Missing fields (abstract, venue, authors, year, citation count) are filled from OpenAlex and Crossref as a fallback.
3. **Build the vector space**
   - A TF‑IDF corpus is built from manuscript sentences and reference abstracts.
   - The vectorizer is fitted once per analysis pass.
4. **Embed references**
   - Each reference abstract is embedded into the TF‑IDF space for similarity scoring.
5. **Analyze each sentence**
   - Sentence embeddings are computed.
   - Entities are extracted for topical overlap scoring.
   - If citations exist, each cited reference is scored per dimension.
6. **Score alignment**
   - Dimension scores are calculated for each sentence‑citation pair.
   - Weighted totals produce per‑citation alignment, then aggregated into overall alignment.
7. **Detect issues**
   - Missing citations are flagged using claim marker heuristics.
   - Research gaps are detected from gap/uncertainty markers.
   - High‑impact statements are annotated for review.
8. **Suggest sources for gaps**
   - For missing citations or gaps, OpenAlex search retrieves up to 1000 candidates.
   - Candidates are scored and ranked; the top 3 are surfaced as suggested references.
9. **Aggregate outputs**
   - Reference‑level scores are averaged from sentence‑level scores.
   - Dimension averages and overall alignment are computed.
   - A summary and gap list are produced for the UI.

## Scoring Dimensions

Alignment is computed as a weighted blend of:
- **Alignment** (semantic similarity between sentence and abstract)
- **Numbers** (numeric signal overlap)
- **Entities** (shared entities and terms)
- **Methods** (methodological keyword alignment)
- **Recency** (publication year vs field expectations)
- **Authority** (venue/citation signals)

## Guided Fix Automation

RefScore can auto‑generate and apply fixes based on analysis output:
- **Missing citations**: Uses OpenAlex search to propose top 3 sources and inserts a citation into the sentence.
- **Low‑relevance citations**: Finds better‑aligned alternatives and replaces citation keys in manuscript and BibTeX.
- **Research gaps**: Suggests new sources and inserts citations near the gap trigger.
- **Formatting**: Fixes common formatting issues such as “et al” without a period.

Updates modify both manuscript text and BibTeX to keep citations consistent.

## Prerequisites

- Node.js (v18 or higher recommended)

## Getting Started

1.  **Install Dependencies**

    ```bash
    npm install
    ```

2.  **Run Development Server**

    ```bash
    npm run dev
    ```

    The application will be available at `http://localhost:5173` (or similar).

3.  **Run Tests**

    ```bash
    npm test
    ```

## Scripts

- `npm run dev`: Start the Vite dev server
- `npm run build`: Create a production build
- `npm run preview`: Preview the production build
- `npm run test`: Run unit tests with Vitest
- `npm run test:e2e`: Run Playwright end-to-end tests
- `npm run test:backend`: Run backend pytest suite
- `npm run lint`: Run ESLint
- `npm run perf:run`: Run the performance test suite

## Project Structure

- `src/`: Application source
- `src/components/`: React UI components
- `src/services/`: NLP, parsing, scoring, and API services
- `src/utils/`: Shared utilities
- `tests/`: Unit, integration, and e2e tests
- `examples/`: Sample LaTeX and BibTeX files

## License

MIT
