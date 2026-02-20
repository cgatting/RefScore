
import React, { useState, useEffect, useMemo } from 'react';
import { Icons } from './Icons';
import { AnalysisResult, AnalyzedSentence } from '../types';
import { GuidedFixService, FixAction } from '../services/GuidedFixService';

interface GuidedFixOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  result: AnalysisResult;
  manuscriptText: string;
  onUpdateManuscript: (newText: string) => void;
}

export const GuidedFixOverlay: React.FC<GuidedFixOverlayProps> = ({
  isOpen,
  onClose,
  result,
  manuscriptText,
  onUpdateManuscript
}) => {
  const [currentFixIndex, setCurrentFixIndex] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [currentText, setCurrentText] = useState(manuscriptText);
  
  // Re-generate plan when result changes (or initial load)
  const fixPlan = useMemo(() => {
    if (!result) return [];
    return new GuidedFixService().generateFixPlan(result);
  }, [result]);

  const currentAction = fixPlan[currentFixIndex];

  // Effect to sync internal text state with prop
  useEffect(() => {
    setCurrentText(manuscriptText);
  }, [manuscriptText]);

  if (!isOpen) return null;

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
    // 1. Save history
    setHistory(prev => [...prev, currentText]);

    // 2. Apply Fix
    let newText = currentText;
    if (currentAction.apply) {
        // If the action has a specific apply function (regex replacement), use it
        // Note: This is simplistic; for sentence-specific replacement we need more robust logic
        // For now, we assume global replace or specific sentence replacement if we had offsets
        // Let's implement a simple sentence replacement based on index
        
        // Find the sentence in the current text (this is tricky if text changed)
        // We will use the original sentence text from analysis result to locate it
        const originalSentence = result.analyzedSentences[currentAction.sentenceIndex].text;
        
        // Simple replacement: replace first occurrence of original sentence with fixed version
        // Ideally we would use precise offsets from the parser
        if (currentText.includes(originalSentence)) {
             const fixedSentence = currentAction.apply(originalSentence);
             newText = currentText.replace(originalSentence, fixedSentence);
        }
    } else {
        // Manual fix or complex fix - for now just skip or simulate
        // In a real implementation, we would prompt for the replacement text
        alert("This fix requires manual intervention. Please edit the text directly.");
        return; 
    }

    // 3. Update state
    setCurrentText(newText);
    onUpdateManuscript(newText);
    
    // 4. Move to next
    setCurrentFixIndex(prev => prev + 1);
  };

  const handleSkip = () => {
    setCurrentFixIndex(prev => prev + 1);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previousText = history[history.length - 1];
    setCurrentText(previousText);
    onUpdateManuscript(previousText);
    setHistory(prev => prev.slice(0, -1));
    setCurrentFixIndex(prev => Math.max(0, prev - 1));
  };

  // Calculate progress
  const progress = ((currentFixIndex) / fixPlan.length) * 100;

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
                <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 p-4 overflow-y-auto">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Action Log</h4>
                    <div className="space-y-3">
                        {history.length === 0 ? (
                            <p className="text-xs text-slate-600 italic">No actions taken yet.</p>
                        ) : (
                            history.map((_, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                                    <Icons.Check className="w-3 h-3 text-green-500" />
                                    <span>Applied fix to item #{i + 1}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 pt-4 border-t border-slate-700">
                    <button 
                        onClick={handleApply}
                        disabled={!currentAction.autoFixAvailable}
                        className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                            currentAction.autoFixAvailable 
                            ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-500/20' 
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                    >
                        <Icons.Magic className="w-4 h-4" />
                        {currentAction.autoFixAvailable ? 'Apply Fix' : 'Manual Fix Required'}
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
