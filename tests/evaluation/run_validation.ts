
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ScoringEngine } from '../../src/services/scoring/ScoringEngine';
import { TfIdfVectorizer } from '../../src/services/nlp/TfIdfVectorizer';
import { EntityExtractor } from '../../src/services/nlp/EntityExtractor';
import { AnalyzedSentence, ProcessedReference } from '../../src/types';

// ESM dirname fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple Pearson Correlation
function calculatePearson(x: number[], y: number[]): number {
    const n = x.length;
    if (n !== y.length) throw new Error("Arrays must have same length");
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    
    const sumX2 = x.reduce((a, b) => a + b * b, 0);
    const sumY2 = y.reduce((a, b) => a + b * b, 0);
    
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    if (denominator === 0) return 0;
    return numerator / denominator;
}

// Statistical Helper Functions
function calculateMean(data: number[]): number {
    return data.reduce((a, b) => a + b, 0) / data.length;
}

function calculateStdDev(data: number[]): number {
    const mean = calculateMean(data);
    const squareDiffs = data.map(value => Math.pow(value - mean, 2));
    return Math.sqrt(calculateMean(squareDiffs));
}

function calculateConfidenceInterval(r: number, n: number): { lower: number, upper: number } {
    // Fisher transformation
    const z = 0.5 * Math.log((1 + r) / (1 - r));
    const zSe = 1 / Math.sqrt(n - 3);
    const zLower = z - 1.96 * zSe;
    const zUpper = z + 1.96 * zSe;
    
    // Inverse Fisher
    const lower = (Math.exp(2 * zLower) - 1) / (Math.exp(2 * zLower) + 1);
    const upper = (Math.exp(2 * zUpper) - 1) / (Math.exp(2 * zUpper) + 1);
    
    return { lower, upper };
}

interface DatasetItem {
    id: string;
    sentence: string;
    reference: {
        id: string;
        title: string;
        abstract: string;
        year: number;
        authors: string[];
    };
    human_score: number;
}

async function runValidation() {
    const datasetPath = path.join(__dirname, 'dataset.json');
    const rawData = fs.readFileSync(datasetPath, 'utf-8');
    const dataset: DatasetItem[] = JSON.parse(rawData);

    console.log(`Loaded ${dataset.length} items from dataset.`);

    // 1. Prepare Corpus for TF-IDF
    const corpus: string[] = [];
    dataset.forEach(item => {
        corpus.push(item.sentence);
        corpus.push(item.reference.abstract);
    });

    // 2. Fit Vectorizer
    const vectorizer = new TfIdfVectorizer();
    vectorizer.fit(corpus);
    console.log(`TF-IDF Vocabulary Size: ${vectorizer.vocabSize}`);

    const entityExtractor = new EntityExtractor();
    const scoringEngine = new ScoringEngine();

    const humanScores: number[] = [];
    const systemScores: number[] = [];

    // Confusion Matrix for Threshold < 40 (Misaligned)
    let tp = 0;
    let fp = 0;
    let tn = 0;
    let fn = 0;

    console.log("\n--- Individual Results ---");
    console.log("ID | Human | System | Diff | Label");
    console.log("---|---|---|---|---");

    dataset.forEach(item => {
        // Transform Sentence
        const sentenceVector = vectorizer.transform(item.sentence);
        const sentenceEntities = entityExtractor.extract(item.sentence);
        const hasNumbers = /\d/.test(item.sentence);

        const analyzedSentence: AnalyzedSentence = {
            text: item.sentence,
            citations: [item.reference.id], // Add required field
            embedding: sentenceVector,
            entities: sentenceEntities,
            hasNumbers: hasNumbers,
            // sentiment: 0 // removed as it's not in interface
        };

        // Transform Reference
        const refAbstract = item.reference.abstract;
        const refVector = vectorizer.transform(refAbstract);

        const processedRef: ProcessedReference = {
            id: item.reference.id,
            title: item.reference.title,
            abstract: refAbstract,
            year: item.reference.year,
            authors: item.reference.authors,
            embedding: refVector
        };

        // Calculate Score
        const scores = scoringEngine.calculateScore(analyzedSentence, processedRef);
        const totalScore = scoringEngine.computeWeightedTotal(scores);

        humanScores.push(item.human_score);
        systemScores.push(totalScore);

        // Classification Logic (Threshold 40)
        // "Positive" = Misaligned (Score < 40)
        const humanMisaligned = item.human_score < 40;
        const systemMisaligned = totalScore < 40;

        if (humanMisaligned && systemMisaligned) tp++;
        else if (!humanMisaligned && systemMisaligned) fp++;
        else if (!humanMisaligned && !systemMisaligned) tn++;
        else if (humanMisaligned && !systemMisaligned) fn++;

        console.log(`${item.id} | ${item.human_score} | ${totalScore.toFixed(1)} | ${(totalScore - item.human_score).toFixed(1)} | ${humanMisaligned ? 'BAD' : 'OK'}`);
    });

    // 3. Calculate Metrics
    const correlation = calculatePearson(humanScores, systemScores);
    
    const precision = tp / (tp + fp) || 0;
    const recall = tp / (tp + fn) || 0;
    const f1 = 2 * (precision * recall) / (precision + recall) || 0;
    const accuracy = (tp + tn) / (tp + tn + fp + fn);

    console.log("\n--- Final Evaluation Metrics (Full Model) ---");
    console.log(`Pearson Correlation (r): ${correlation.toFixed(4)}`);
    console.log(`Precision: ${(precision * 100).toFixed(2)}%`);
    console.log(`Recall: ${(recall * 100).toFixed(2)}%`);
    console.log(`F1 Score: ${(f1 * 100).toFixed(2)}%`);
    console.log(`Accuracy: ${(accuracy * 100).toFixed(2)}%`);

    // --- STATISTICAL ANALYSIS (Upgrade #4) ---
    console.log("\n--- Statistical Analysis ---");
    const ci = calculateConfidenceInterval(correlation, dataset.length);
    console.log(`Pearson r 95% CI: [${ci.lower.toFixed(4)}, ${ci.upper.toFixed(4)}]`);
    
    const meanHuman = calculateMean(humanScores);
    const stdHuman = calculateStdDev(humanScores);
    const meanSystem = calculateMean(systemScores);
    const stdSystem = calculateStdDev(systemScores);
    
    console.log(`Human Scores: Mean=${meanHuman.toFixed(2)}, SD=${stdHuman.toFixed(2)}`);
    console.log(`System Scores: Mean=${meanSystem.toFixed(2)}, SD=${stdSystem.toFixed(2)}`);
    
    // Distribution Analysis
    console.log("Distribution Delta (System - Human):");
    const deltas = systemScores.map((s, i) => s - humanScores[i]);
    const meanDelta = calculateMean(deltas);
    const stdDelta = calculateStdDev(deltas);
    console.log(`Mean Delta: ${meanDelta.toFixed(2)} (Positive = System Overestimates)`);
    console.log(`SD Delta: ${stdDelta.toFixed(2)}`);

    // --- STRESS TESTING / SUBGROUP ANALYSIS (Upgrade #3) ---
    console.log("\n--- Stress Testing: Performance by Context ---");
    
    // 1. Abstract Length Impact
    const shortAbstracts = dataset.filter(i => i.reference.abstract.length < 150);
    const longAbstracts = dataset.filter(i => i.reference.abstract.length >= 150);
    
    // Helper to calc correlation for a subset
    const calcSubsetCorr = (subset: DatasetItem[]) => {
        if (subset.length < 2) return 0;
        const subHuman = subset.map(i => i.human_score);
        const subSystem = subset.map(i => {
             // We need to re-calculate or find the score. For simplicity, we'll just re-find it from arrays if indices matched, 
             // but here we didn't store indices. Let's just re-calculate strictly for this report or assume order.
             // Better: Recalculate on fly.
             const sVec = vectorizer.transform(i.sentence);
             const rVec = vectorizer.transform(i.reference.abstract);
             const aSent: AnalyzedSentence = { 
                 text: i.sentence, citations: [i.reference.id], embedding: sVec, 
                 entities: entityExtractor.extract(i.sentence), hasNumbers: /\d/.test(i.sentence) 
             };
             const pRef: ProcessedReference = { 
                 id: i.reference.id, title: i.reference.title, abstract: i.reference.abstract, 
                 year: i.reference.year, authors: i.reference.authors, embedding: rVec 
             };
             return scoringEngine.computeWeightedTotal(scoringEngine.calculateScore(aSent, pRef));
        });
        return calculatePearson(subHuman, subSystem);
    };

    console.log(`Short Abstracts (<150 chars) (n=${shortAbstracts.length}): r = ${calcSubsetCorr(shortAbstracts).toFixed(4)}`);
    console.log(`Long Abstracts (>=150 chars) (n=${longAbstracts.length}): r = ${calcSubsetCorr(longAbstracts).toFixed(4)}`);

    
    console.log("\n--- Confusion Matrix (Threshold < 40) ---");
    console.log(`TP (Correctly Flagged Bad): ${tp}`);
    console.log(`FP (False Alarm): ${fp}`);
    console.log(`TN (Correctly Ignored Good): ${tn}`);
    console.log(`FN (Missed Bad): ${fn}`);

    // --- ABLATION STUDY ---
    console.log("\n--- Ablation Study: Impact of Scoring Dimensions ---");
    console.log("Configuration | Pearson Correlation (r)");
    console.log("---|---");

    const ablationConfigs = [
        { name: "Full Model", weights: ScoringEngine.DEFAULT_CONFIG.weights },
        { name: "No Entity Overlap", weights: { ...ScoringEngine.DEFAULT_CONFIG.weights, Entities: 0 } },
        { name: "No Methodological Cues", weights: { ...ScoringEngine.DEFAULT_CONFIG.weights, Methods: 0 } },
        { name: "No Recency Decay", weights: { ...ScoringEngine.DEFAULT_CONFIG.weights, Recency: 0 } },
        { name: "Pure TF-IDF (Baseline)", weights: { Alignment: 1, Numbers: 0, Entities: 0, Methods: 0, Recency: 0, Authority: 0 } }
    ];

    ablationConfigs.forEach(config => {
        const engine = new ScoringEngine({ weights: config.weights });
        const ablationScores: number[] = [];

        dataset.forEach(item => {
            // Re-use pre-calculated vectors/entities
            const sentenceVector = vectorizer.transform(item.sentence);
            const sentenceEntities = entityExtractor.extract(item.sentence);
            const hasNumbers = /\d/.test(item.sentence);

            const analyzedSentence: AnalyzedSentence = {
                text: item.sentence,
                citations: [item.reference.id],
                embedding: sentenceVector,
                entities: sentenceEntities,
                hasNumbers: hasNumbers,
            };

            const processedRef: ProcessedReference = {
                id: item.reference.id,
                title: item.reference.title,
                abstract: item.reference.abstract,
                year: item.reference.year,
                authors: item.reference.authors,
                embedding: vectorizer.transform(item.reference.abstract)
            };

            const scores = engine.calculateScore(analyzedSentence, processedRef);
            const total = engine.computeWeightedTotal(scores);
            ablationScores.push(total);
        });

        const r = calculatePearson(humanScores, ablationScores);
        console.log(`${config.name} | ${r.toFixed(4)}`);
    });
}

runValidation().catch(console.error);
