import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';
import { AnalysisResult, ProcessedReference } from '../types';
import { GuidedFixService, FixAction } from '../services/GuidedFixService';
import { CitationFinderService } from '../services/CitationFinderService';

interface GuidedFixOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  result: AnalysisResult;
  manuscriptText: string;
  bibliographyText: string;
  onUpdate: (newManuscript: string, newBib: string) => void;
}

export const GuidedFixOverlay: React.FC<GuidedFixOverlayProps> = ({
  isOpen,
  onClose,
  result,
  manuscriptText,
  bibliographyText,
  onUpdate
}) => {
  // Core State
  const [currentText, setCurrentText] = useState(manuscriptText);
  const [currentBib, setCurrentBib] = useState(bibliographyText);
  const [fixPlan, setFixPlan] = useState<FixAction[]>([]);
  const [loadingPlan, setLoadingPlan] = useState(false);
  
  // Auto-Pilot & Flow State
  const [mode, setMode] = useState<'loading' | 'autopilot' | 'summary' | 'comparison' | 'no-fixes'>('loading');
  const [initialScore] = useState(result.overallScore);
  const [appliedFixes, setAppliedFixes] = useState<string[]>([]);
  const [isReevaluating, setIsReevaluating] = useState(false);

  // Sync internal text state with props
  useEffect(() => {
    setCurrentText(manuscriptText);
    setCurrentBib(bibliographyText);
  }, [manuscriptText, bibliographyText]);

  // Initial Plan Generation & Autopilot Trigger
  useEffect(() => {
    if (!isOpen) return;
    
    // If we are already in comparison mode, don't restart
    if (mode === 'comparison' || mode === 'summary') return;

    setLoadingPlan(true);
    setMode('loading');
    
    new GuidedFixService().generateFixPlan(result).then(async (plan) => {
      setFixPlan(plan);
      setLoadingPlan(false);
      
      if (plan.length === 0) {
        setMode('no-fixes');
      } else {
        // Start Autopilot immediately
        await startAutoPilot(plan);
      }
    });
  }, [isOpen]);

  const [lastProcessedResult, setLastProcessedResult] = useState(result);

  // Watch for result changes to detect re-evaluation completion
  useEffect(() => {
    if (isReevaluating && result !== lastProcessedResult) {
       // Re-evaluation finished
       setIsReevaluating(false);
       setMode('comparison');
       setLastProcessedResult(result);
    }
  }, [result, isReevaluating, lastProcessedResult]);

  const startAutoPilot = async (plan: FixAction[]) => {
    setMode('autopilot');
    
    let newText = currentText;
    let newBib = currentBib;
    let fixes: string[] = [];
    const finder = new CitationFinderService();

    // Get all auto-fixable actions
    const autoFixable = plan.filter(a => a.autoFixAvailable);
    
    for (const action of autoFixable) {
        const originalSentence = result.analyzedSentences[action.sentenceIndex].text;
        
        // Skip if sentence changed too much or not found
        if (!newText.includes(originalSentence)) continue;

        try {
            if ((action.type === 'missing_citation' || action.type === 'gap') && action.suggestedReferences && action.suggestedReferences.length > 0) {
                const bestRef = action.suggestedReferences[0];
                const update = finder.autoAddForGap(originalSentence, result.analyzedSentences[action.sentenceIndex].triggerPhrase, bestRef, newText, newBib);
                newText = update.manuscript;
                newBib = update.bib;
                fixes.push(`Added citation [${bestRef.id}] for claim: "${originalSentence.substring(0, 40)}..."`);
            } 
            else if (action.type === 'low_relevance' && action.citationKey && action.suggestedReferences && action.suggestedReferences.length > 0) {
                const bestRef = action.suggestedReferences[0];
                const update = finder.updateFiles(action.citationKey, bestRef, newText, newBib);
                newText = update.manuscript;
                newBib = update.bib;
                fixes.push(`Replaced weak citation [${action.citationKey}] with [${bestRef.id}]`);
            }
            else if (action.type === 'formatting' && action.apply) {
                const fixedSentence = action.apply(originalSentence);
                if (fixedSentence !== originalSentence) {
                  newText = newText.replace(originalSentence, fixedSentence);
                  fixes.push(`Corrected formatting issue: "${action.description}"`);
                }
            }
            // SKIP the fallback tagging for gap/missing_citation if no suggestions are found
            // This avoids adding [RESEARCH GAP] tags that don't help the score
        } catch (e) {
            console.warn("Autopilot failed for action", action.id, e);
        }
        
        // Brief delay for UX visibility
        await new Promise(r => setTimeout(r, 150));
    }

    setAppliedFixes(fixes);
    setCurrentText(newText);
    setCurrentBib(newBib);
    setMode('summary');
  };

  const handleFinishAndReevaluate = () => {
    setIsReevaluating(true);
    onUpdate(currentText, currentBib);
  };

  if (!isOpen) return null;

  // Renderers for different modes
  const renderLoading = () => (
    <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl">
      <Icons.RefreshCw className="w-12 h-12 text-brand-400 animate-spin mx-auto mb-4" />
      <h3 className="text-xl font-bold text-white mb-2">Analyzing Fixes...</h3>
      <p className="text-slate-400">Searching for high-quality sources and generating optimization plan.</p>
    </div>
  );

  const renderAutopilot = () => (
    <div className="bg-slate-900 border border-slate-700 p-10 rounded-[2rem] max-w-md w-full text-center shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-brand-500 animate-pulse"></div>
      <Icons.Magic className="w-16 h-16 text-brand-400 animate-bounce mx-auto mb-6" />
      <h3 className="text-2xl font-bold text-white mb-2">Auto-Pilot Engaged</h3>
      <p className="text-slate-400 mb-8">RefScore is autonomously correcting manuscript issues and updating your bibliography...</p>
      
      <div className="space-y-4">
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 animate-shimmer w-full"></div>
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-mono uppercase tracking-widest">
              <span>Applying Neural Fixes</span>
              <span>In Progress...</span>
          </div>
      </div>
    </div>
  );

  const renderSummary = () => (
    <div className="bg-slate-900 border border-slate-700 p-8 rounded-3xl max-w-lg w-full shadow-2xl animate-scale-in">
      <div className="flex items-center gap-4 mb-6">
         <div className="p-3 bg-emerald-500/20 rounded-2xl">
            <Icons.Success className="w-6 h-6 text-emerald-400" />
         </div>
         <div>
            <h3 className="text-2xl font-bold text-white">Fixes Completed</h3>
            <p className="text-sm text-slate-400">Optimization successful. Review the log below.</p>
         </div>
      </div>

      <div className="bg-black/30 rounded-2xl border border-slate-800 p-5 max-h-[300px] overflow-y-auto mb-8 custom-scrollbar">
         <div className="space-y-4">
            {appliedFixes.map((fix, i) => (
                <div key={i} className="flex gap-3 text-sm text-slate-300 items-start">
                    <Icons.Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{fix}</span>
                </div>
            ))}
            {appliedFixes.length === 0 && (
                <p className="text-center text-slate-500 italic py-4">No issues were found that required automatic correction.</p>
            )}
         </div>
      </div>

      <button
        onClick={handleFinishAndReevaluate}
        disabled={isReevaluating}
        className="w-full py-4 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-2xl shadow-lg shadow-brand-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
      >
        {isReevaluating ? (
            <><Icons.RefreshCw className="w-5 h-5 animate-spin" /> Re-calculating Scores...</>
        ) : (
            <><Icons.Activity className="w-5 h-5" /> Finalize & Re-evaluate</>
        )}
      </button>
    </div>
  );

  const renderComparison = () => {
    const delta = result.overallScore - initialScore;
    return (
      <div className="bg-slate-900 border border-slate-700 p-10 rounded-[2.5rem] max-w-2xl w-full shadow-2xl animate-scale-in text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-brand-500 via-emerald-500 to-brand-500"></div>
        
        <h3 className="text-3xl font-display font-bold text-white mb-2">Performance Impact</h3>
        <p className="text-slate-400 mb-10">Verification complete. Manuscript integrity has been significantly improved.</p>

        <div className="grid grid-cols-2 gap-8 mb-10">
          <div className="glass-card p-6 rounded-3xl border border-slate-800 bg-slate-800/20">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Initial Score</span>
              <div className="text-5xl font-display font-bold text-slate-500">{initialScore.toFixed(1)}</div>
          </div>
          <div className="glass-card p-6 rounded-3xl border border-brand-500/30 bg-brand-500/5 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-[10px] font-bold px-3 py-1 rounded-full">OPTIMIZED</div>
              <span className="text-xs font-bold text-brand-400 uppercase tracking-widest mb-2 block">New Score</span>
              <div className="text-5xl font-display font-bold text-white">{result.overallScore.toFixed(1)}</div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 mb-10">
           <div className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-xl ${delta >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
              {delta >= 0 ? <Icons.ArrowRight className="w-6 h-6 -rotate-45" /> : <Icons.Warning className="w-6 h-6" />}
              {delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)} Point Improvement
           </div>
        </div>

        <button
          onClick={onClose}
          className="px-12 py-4 bg-slate-100 text-slate-900 hover:bg-white font-bold rounded-2xl transition-all active:scale-95 shadow-xl"
        >
          Back to Overview
        </button>
      </div>
    );
  };

  const renderNoFixes = () => (
    <div className="bg-slate-900 border border-slate-700 p-10 rounded-3xl max-w-md w-full text-center shadow-2xl">
      <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
        <Icons.Success className="w-10 h-10 text-emerald-400" />
      </div>
      <h3 className="text-2xl font-bold text-white mb-2">Perfect Score!</h3>
      <p className="text-slate-400 mb-8">No critical issues were detected in your manuscript. You're good to go!</p>
      <button
        onClick={onClose}
        className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition-all"
      >
        Close
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
      {mode === 'loading' && renderLoading()}
      {mode === 'autopilot' && renderAutopilot()}
      {mode === 'summary' && renderSummary()}
      {mode === 'comparison' && renderComparison()}
      {mode === 'no-fixes' && renderNoFixes()}
    </div>
  );
};
