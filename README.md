---
title: RefScore
emoji: 🚀
colorFrom: indigo
colorTo: indigo
sdk: docker
pinned: false
license: mit
---

# RefScore

RefScore is a multi-dimensional system for automated academic reference analysis and manuscript alignment. It combines OpenAlex metadata with local NLP (TF-IDF, entity extraction) to validate citations, surface gaps, and improve bibliography quality.

## Features

- **Document parsing**: LaTeX and BibTeX ingestion.
- **Citation analysis**: Extraction, validation, and gap detection.
- **Reference scoring**: Multi-dimensional relevance scoring.
- **OpenAlex integration**: Metadata retrieval and paper validation.
- **Interactive dashboards**: Visualize alignment, gaps, and reference quality.

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
