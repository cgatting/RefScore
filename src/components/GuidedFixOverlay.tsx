
import React, { useState, useEffect, useMemo } from 'react';
import { Icons } from './Icons';
import { AnalysisResult, AnalyzedSentence, ProcessedReference } from '../types';
import { GuidedFixService, FixAction } from '../services/GuidedFixService';
import { CitationFinderService } from '../services/CitationFinderService';
import { computeWeightedTotal } from '../services/scoring/ScoringEngine';

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
  const [currentFixIndex, setCurrentFixIndex] = useState(0);
  const [history, setHistory] = useState<{text: string, bib: string, description: string}[]>([]);
  const [currentText, setCurrentText] = useState(manuscriptText);
  const [currentBib, setCurrentBib] = useState(bibliographyText);
  const [notification, setNotification] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualText, setManualText] = useState('');

  const [fixPlan, setFixPlan] = useState<FixAction[]>([]);
  const [loadingPlan, setLoadingPlan] = useState(false);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);
  
  // Re-generate plan when result changes (or initial load)
  useEffect(() => {
    if (!result) return;
    setLoadingPlan(true);
    new GuidedFixService().generateFixPlan(result).then(plan => {
      setFixPlan(plan);
      setLoadingPlan(false);
    });
  }, [result]);

  const currentAction = fixPlan[currentFixIndex];

  // Effect to sync internal text state with prop
  useEffect(() => {
    setCurrentText(manuscriptText);
    setCurrentBib(bibliographyText);
  }, [manuscriptText, bibliographyText]);

  if (!isOpen) return null;

  if (loadingPlan) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl max-w-md text-center shadow-2xl">
          <Icons.RefreshCw className="w-8 h-8 text-brand-400 animate-spin mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Analyzing Fixes...</h3>
          <p className="text-slate-400">Searching for better sources and generating fix plan.</p>
        </div>
      </div>
    );
  }

  if (fixPlan.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl max-w-md text-center shadow-2xl">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icons.Success className="w-8 h-8 text-green-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Issues Found!</h3>
          <p className="text-slate-400 mb-6">Your manuscript looks clean. Great job!</p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!currentAction) {
     return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl max-w-md text-center shadow-2xl">
          <div className="w-16 h-16 bg-brand-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icons.Success className="w-8 h-8 text-brand-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">All Fixes Reviewed</h3>
          <p className="text-slate-400 mb-6">You've gone through all suggested improvements.</p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition-colors"
          >
            Finish
          </button>
        </div>
      </div>
    );
  }

  const handleApply = () => {
    setIsApplying(true);
    try {
      setHistory(prev => [...prev, { text: currentText, bib: currentBib, description: `Fixed: ${currentAction.type}` }]);
      let newText = currentText;
      if (currentAction.apply) {
        const originalSentence = result.analyzedSentences[currentAction.sentenceIndex].text;
        const fixedSentence = currentAction.apply(originalSentence);
        if (currentText.includes(originalSentence)) {
          newText = currentText.replace(originalSentence, fixedSentence);
        } else {
          const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const flexible = new RegExp(escapeRegex(originalSentence).replace(/\\s+/g, '\\s+'), 'm');
          if (flexible.test(currentText)) {
            newText = currentText.replace(flexible, fixedSentence);
          } else {
            setNotification("Could not locate the target sentence. No changes made.");
            return;
          }
        }
      } else {
        openManual();
        return;
      }
      setCurrentText(newText);
      onUpdate(newText, currentBib);
      setNotification("Fix applied successfully");
      setCurrentFixIndex(prev => prev + 1);
    } finally {
      setIsApplying(false);
    }
  };

  const handleSuggestionSelect = (ref: ProcessedReference) => {
    setIsApplying(true);
    try {
      const finder = new CitationFinderService();
      let update;

      if (currentAction.type === 'low_relevance' && currentAction.citationKey) {
          setHistory(prev => [...prev, { text: currentText, bib: currentBib, description: `Replaced citation ${currentAction.citationKey} with ${ref.id}` }]);
          update = finder.updateFiles(currentAction.citationKey, ref, currentText, currentBib);
      } else {
          setHistory(prev => [...prev, { text: currentText, bib: currentBib, description: `Added citation: ${ref.id}` }]);
          const originalSentence = result.analyzedSentences[currentAction.sentenceIndex].text;
          update = finder.autoAddForGap(
            originalSentence,
            result.analyzedSentences[currentAction.sentenceIndex].triggerPhrase,
            ref,
            currentText,
            currentBib
          );
      }

      setCurrentText(update.manuscript);
      setCurrentBib(update.bib);
      onUpdate(update.manuscript, update.bib);
      
      setNotification(currentAction.type === 'low_relevance' ? `Replaced with ${ref.id}` : `Added citation ${ref.id}`);
      setCurrentFixIndex(prev => prev + 1);
    } catch (e) {
      console.error(e);
      setNotification("Failed to apply citation");
    } finally {
      setIsApplying(false);
    }
  };

  const handleApplyAll = async () => {
    setIsApplying(true);
    setHistory(prev => [...prev, { text: currentText, bib: currentBib, description: "Batch applied all remaining fixes" }]);

    let newText = currentText;
    let newBib = currentBib;
    let appliedCount = 0;

    // Get all remaining auto-fixable actions
    const remainingActions = fixPlan.slice(currentFixIndex).filter(a => a.autoFixAvailable);
    
    // Process complex fixes first (those needing citations)
    // Then simple string replacements
    const finder = new CitationFinderService();

    try {
      for (const action of remainingActions) {
        const originalSentence = result.analyzedSentences[action.sentenceIndex].text;
        
        // Ensure we are working on the latest text state
        if (!newText.includes(originalSentence)) {
          // If strict match fails, try fuzzy match or skip
          // For batch apply, we skip if we can't reliably find the sentence
          continue;
        }

        // Case 1: Missing Citation or Gap with Suggestions
        if ((action.type === 'missing_citation' || action.type === 'gap') && action.suggestedReferences && action.suggestedReferences.length > 0) {
           const bestRef = action.suggestedReferences[0]; // Take top suggestion
           
           try {
             const update = finder.autoAddForGap(
               originalSentence,
               result.analyzedSentences[action.sentenceIndex].triggerPhrase,
               bestRef,
               newText,
               newBib
             );
             
             if (update.manuscript !== newText) {
               newText = update.manuscript;
               newBib = update.bib;
               appliedCount++;
             }
           } catch (e) {
             console.warn(`Failed to auto-apply citation for action ${action.id}`, e);
           }
        } 
        // Case 2: Low Relevance (NEW)
        else if (action.type === 'low_relevance' && action.citationKey && action.suggestedReferences && action.suggestedReferences.length > 0) {
            const bestRef = action.suggestedReferences[0];
            try {
                const update = finder.updateFiles(action.citationKey, bestRef, newText, newBib);
                if (update.manuscript !== newText) {
                    newText = update.manuscript;
                    newBib = update.bib;
                    appliedCount++;
                }
            } catch (e) {
                console.warn(`Failed to auto-replace citation for action ${action.id}`, e);
            }
        }
        // Case 3: Simple Text Replacement (Formatting, etc.)
        else if (action.apply) {
           const fixedSentence = action.apply(originalSentence);
           if (fixedSentence !== originalSentence) {
             newText = newText.replace(originalSentence, fixedSentence);
             appliedCount++;
           }
        }
      }

      if (appliedCount > 0) {
          setCurrentText(newText);
          setCurrentBib(newBib);
          onUpdate(newText, newBib);
          setNotification(`Applied ${appliedCount} fixes automatically`);
          
          // Move to end or next manual action
          const nextManualIndex = fixPlan.findIndex((action, i) => i >= currentFixIndex && !action.autoFixAvailable);
          setCurrentFixIndex(nextManualIndex !== -1 ? nextManualIndex : fixPlan.length);
      } else {
          setNotification("No remaining auto-fixes could be applied.");
      }
    } catch (error) {
      console.error("Batch apply failed", error);
      setNotification("Batch apply encountered an error.");
    } finally {
      setIsApplying(false);
    }
  };

  const handleSkip = () => {
    setCurrentFixIndex(prev => prev + 1);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    setCurrentText(previousState.text);
    setCurrentBib(previousState.bib);
    onUpdate(previousState.text, previousState.bib);
    setHistory(prev => prev.slice(0, -1));
    setCurrentFixIndex(prev => Math.max(0, prev - 1));
    setNotification("Undid last action");
  };

  // Calculate progress
  const progress = ((currentFixIndex) / fixPlan.length) * 100;

  const openManual = () => {
    if (!currentAction) return;
    const originalSentence = result.analyzedSentences[currentAction.sentenceIndex].text;
    setManualText(originalSentence);
    setManualOpen(true);
  };
  const applyManual = () => {
    if (!currentAction) return;
    const originalSentence = result.analyzedSentences[currentAction.sentenceIndex].text;
    const newText = currentText.includes(originalSentence)
      ? currentText.replace(originalSentence, manualText)
      : currentText;
    setHistory(prev => [...prev, { text: currentText, bib: currentBib, description: `Manual fix: ${currentAction.type}` }]);
    setCurrentText(newText);
    onUpdate(newText, currentBib);
    setNotification("Manual fix applied");
    setCurrentFixIndex(prev => prev + 1);
    setManualOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
      {/* Main Container */}
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-800/50 p-4 border-b border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-brand-500/20 rounded-lg">
                <Icons.Analyzing className="w-5 h-5 text-brand-400" />
             </div>
             <div>
               <h2 className="text-lg font-bold text-white">Guided Fix Mode</h2>
               <p className="text-xs text-slate-400">Interactive Debugging Assistant</p>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Progress</span>
                <p className="text-sm font-mono text-brand-400">{currentFixIndex + 1} / {fixPlan.length}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
              <Icons.Close className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-slate-800 w-full">
            <div 
              className="h-full bg-brand-500 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-3 gap-6">
            
            {/* Left: Context (The Sentence) */}
            <div className="col-span-2 space-y-4">
                <div className="bg-black/30 p-6 rounded-xl border border-slate-700/50 min-h-[200px] flex items-center justify-center">
                    <p className="text-xl font-serif text-slate-200 leading-relaxed text-center">
                        "{result.analyzedSentences[currentAction.sentenceIndex].text}"
                    </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Root Cause</span>
                        <div className="flex items-start gap-2">
                             <Icons.Alert className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                             <p className="text-sm text-slate-300">{currentAction.description}</p>
                        </div>
                    </div>
                    <div className="p-4 bg-brand-900/10 rounded-xl border border-brand-500/20">
                         <span className="text-xs font-bold text-brand-500/70 uppercase tracking-wider mb-1 block">Recommended Action</span>
                         <div className="flex items-start gap-2">
                             <Icons.Sparkles className="w-4 h-4 text-brand-400 mt-0.5 shrink-0" />
                             <p className="text-sm text-brand-100 font-medium">{currentAction.suggestion}</p>
                         </div>
                    </div>
                </div>

                {currentAction.suggestedReferences && currentAction.suggestedReferences.length > 0 && (
                  <div className="mt-6 animate-fade-in-up">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Icons.Search className="w-3 h-3" />
                        Suggested Sources
                      </span>
                      <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                        Based on claim context
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {currentAction.suggestedReferences.map((ref) => {
                        const score = ref.scores ? Math.round(computeWeightedTotal(ref.scores)) : 0;
                        return (
                          <div 
                            key={ref.id} 
                            onClick={() => handleSuggestionSelect(ref)}
                            className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/60 hover:border-brand-500/50 hover:bg-slate-800/80 transition-all group cursor-pointer relative overflow-hidden"
                          >
                             <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-xs font-bold text-brand-400 bg-brand-500/10 px-2 py-1 rounded-lg border border-brand-500/20">Apply This Source</span>
                             </div>
                             
                             <div className="flex justify-between items-start mb-2 pr-20">
                                <h4 className="text-sm font-bold text-slate-200 group-hover:text-brand-300 leading-snug">{ref.title}</h4>
                             </div>
                             
                             <p className="text-xs text-slate-400 mb-3 line-clamp-2 leading-relaxed">{ref.abstract}</p>
                             
                             <div className="flex items-center gap-3">
                                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold ${
                                  score >= 70 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                  score >= 50 ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                  'bg-slate-700 text-slate-400 border-slate-600'
                                }`}>
                                   <Icons.Chart className="w-3 h-3" />
                                   Match: {score}/100
                                </div>
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[10px] text-slate-400 font-mono">
                                   <Icons.Calendar className="w-3 h-3" />
                                   {ref.year}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate max-w-[150px]">
                                  {ref.authors.slice(0, 2).join(', ')}{ref.authors.length > 2 ? ' et al.' : ''}
                                </div>
                             </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
            </div>

            {/* Right: Controls & Metadata */}
            <div className="col-span-1 space-y-6 flex flex-col">
                
                {/* Severity Badge */}
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">SEVERITY</span>
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                        currentAction.severity === 'high' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                        currentAction.severity === 'medium' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    }`}>
                        {currentAction.severity}
                    </span>
                </div>

                {/* Audit Trail Preview */}
                <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 p-4 overflow-y-auto relative">
                    {notification && (
                      <div className="absolute top-2 right-2 left-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-2 rounded-lg text-xs font-bold animate-in fade-in slide-in-from-top-2 flex items-center gap-2">
                        <Icons.Check className="w-3 h-3" />
                        {notification}
                      </div>
                    )}
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Action Log</h4>
                    <div className="space-y-3">
                        {history.length === 0 ? (
                            <p className="text-xs text-slate-600 italic">No actions taken yet.</p>
                        ) : (
                            history.map((item, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                                    <Icons.Check className="w-3 h-3 text-green-500" />
                                    <span>{item.description}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 pt-4 border-t border-slate-700">
                    <button 
                        onClick={handleApply}
                        disabled={!currentAction.autoFixAvailable || isApplying}
                        className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                            currentAction.autoFixAvailable && !isApplying
                            ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-500/20' 
                            : currentAction.autoFixAvailable && isApplying
                            ? 'bg-brand-600 text-white opacity-80 cursor-wait'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                    >
                        <Icons.Magic className={`w-4 h-4 ${isApplying ? 'animate-spin' : ''}`} />
                        {currentAction.autoFixAvailable ? (isApplying ? 'Applying…' : 'Apply Fix') : 'Manual Fix Required'}
                    </button>
                    
                    {!currentAction.autoFixAvailable && (
                      <button
                        onClick={openManual}
                        className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                      >
                        <Icons.Lightbulb className="w-4 h-4" />
                        Apply Manual Fix
                      </button>
                    )}
                    
                    <button
                        onClick={handleApplyAll}
                        disabled={!fixPlan.some((a, i) => i >= currentFixIndex && a.autoFixAvailable)}
                        className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                             fixPlan.some((a, i) => i >= currentFixIndex && a.autoFixAvailable)
                             ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                             : 'bg-slate-800 text-slate-500 cursor-not-allowed hidden'
                        }`}
                    >
                        <Icons.ApplyAll className="w-4 h-4" />
                        Apply All Remaining
                    </button>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={handleSkip}
                            className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-colors border border-slate-700"
                        >
                            Skip
                        </button>
                        <button 
                            onClick={handleUndo}
                            disabled={history.length === 0}
                            className={`py-3 rounded-xl font-medium transition-colors border ${
                                history.length > 0
                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                : 'bg-transparent text-slate-600 border-transparent cursor-not-allowed'
                            }`}
                        >
                            Undo
                        </button>
                    </div>
                </div>

            </div>
        </div>

        {/* Manual Fix Modal */}
        {manualOpen && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-6">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-xl shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-2">Manual Fix</h3>
              <p className="text-xs text-slate-400 mb-3">Edit the sentence below and apply your changes.</p>
              <textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                className="w-full h-40 p-3 rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
              />
              <div className="mt-4 flex gap-3 justify-end">
                <button
                  onClick={() => setManualOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                >Cancel</button>
                <button
                  onClick={applyManual}
                  className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white"
                >Apply</button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="bg-slate-900 p-3 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500 px-6">
            <span>Latency: &lt;10ms</span>
            <div className="flex gap-4">
                <span>Linter: Active</span>
                <span>Type Check: Passed</span>
                <span>Tests: 12/12</span>
            </div>
        </div>

      </div>
    </div>
  );
};
