import React from 'react';
import { PrismaFlowData } from '../types';
import { Icons } from './Icons';

interface PrismaDiagramProps {
  data: PrismaFlowData;
}

export const PrismaDiagram: React.FC<PrismaDiagramProps> = ({ data }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-10 text-white shadow-xl relative overflow-hidden group font-sans">
      <div className="flex items-center gap-3 mb-8 relative z-10">
        <div className="p-3 bg-brand-500/10 text-brand-400 rounded-2xl group-hover:scale-110 transition-transform duration-300 border border-brand-500/20">
          <Icons.Activity className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-xl font-display font-bold text-white">Automated PRISMA Flow Diagram</h3>
          <p className="text-sm text-slate-400 font-medium">Literature screening and inclusion mapping</p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto space-y-6 relative z-10">
        
        {/* Step 1: Identification */}
        <div className="w-full flex justify-center relative">
          <div className="bg-slate-800/80 border border-slate-700 w-64 p-4 rounded-xl shadow-lg relative z-20 hover:border-brand-500/50 transition-colors">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 text-center">Identification</h4>
            <div className="text-center text-sm font-medium text-slate-200">
              Total records identified in BibTeX<br />
              <span className="text-2xl font-bold text-brand-400 mt-2 block">(n = {data.totalIdentified})</span>
            </div>
          </div>
          {/* Vertical Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 h-10 w-0.5 bg-brand-500/30"></div>
          <div className="absolute top-[calc(100%+36px)] left-1/2 -translate-x-1/2 w-3 h-3 border-r-2 border-b-2 border-brand-500/30 rotate-45"></div>
        </div>

        <div className="h-10"></div> {/* Spacer for arrow */}

        {/* Step 2: Screening */}
        <div className="w-full flex flex-col md:flex-row justify-center gap-8 md:gap-16 relative">
          <div className="flex-1 flex justify-end relative">
            <div className="bg-slate-800/80 border border-slate-700 w-64 p-4 rounded-xl shadow-lg relative z-20 hover:border-brand-500/50 transition-colors">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 text-center">Screening</h4>
              <div className="text-center text-sm font-medium text-slate-200">
                Records screened (Cited in manuscript)<br />
                <span className="text-2xl font-bold text-brand-400 mt-2 block">(n = {data.screened})</span>
              </div>
            </div>
             {/* Horizontal Arrow Line (Desktop) */}
             <div className="hidden md:block absolute top-1/2 left-full w-16 h-0.5 bg-red-500/30"></div>
             <div className="hidden md:block absolute top-1/2 left-[calc(100%+60px)] -translate-y-1/2 w-3 h-3 border-r-2 border-b-2 border-red-500/30 -rotate-45"></div>
          </div>

          <div className="flex-1 flex justify-start relative">
            <div className="bg-red-500/5 border border-red-500/20 w-64 p-4 rounded-xl shadow-lg relative z-20 hover:border-red-500/40 transition-colors">
               <h4 className="text-xs font-bold text-red-400/80 uppercase tracking-widest mb-1 text-center">Excluded</h4>
               <div className="text-center text-sm font-medium text-slate-300">
                 Records not cited in text<br />
                 <span className="text-2xl font-bold text-red-400 mt-2 block">(n = {data.uncitedExcluded})</span>
               </div>
            </div>
          </div>

          {/* Vertical Arrow for Left Box */}
          <div className="absolute top-full left-1/2 md:left-1/4 -translate-x-1/2 h-10 w-0.5 bg-brand-500/30"></div>
          <div className="absolute top-[calc(100%+36px)] left-1/2 md:left-1/4 -translate-x-1/2 w-3 h-3 border-r-2 border-b-2 border-brand-500/30 rotate-45"></div>
        </div>

        <div className="h-10"></div> {/* Spacer for arrow */}

        {/* Step 3: Eligibility / Automated Exclusions */}
        <div className="w-full flex flex-col md:flex-row justify-center gap-8 md:gap-16 relative">
          <div className="flex-1 flex justify-end relative">
            <div className="bg-slate-800/80 border border-slate-700 w-64 p-4 rounded-xl shadow-lg relative z-20 hover:border-brand-500/50 transition-colors">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 text-center">Eligibility</h4>
              <div className="text-center text-sm font-medium text-slate-200">
                Assessed for full relevance<br />
                <span className="text-2xl font-bold text-brand-400 mt-2 block">(n = {data.screened})</span>
              </div>
            </div>
             {/* Horizontal Arrow Line (Desktop) */}
             <div className="hidden md:block absolute top-1/2 left-full w-16 h-0.5 bg-red-500/30"></div>
             <div className="hidden md:block absolute top-1/2 left-[calc(100%+60px)] -translate-y-1/2 w-3 h-3 border-r-2 border-b-2 border-red-500/30 -rotate-45"></div>
          </div>

          <div className="flex-1 flex justify-start relative">
             <div className="bg-red-500/5 border border-red-500/20 w-64 p-4 rounded-xl shadow-lg relative z-20 hover:border-red-500/40 transition-colors flex flex-col items-center">
                <h4 className="text-xs font-bold text-red-400/80 uppercase tracking-widest mb-2 text-center">Excluded</h4>
                <div className="w-full space-y-2">
                  <div className="bg-red-500/10 p-2 rounded-lg text-xs font-medium text-slate-300 flex justify-between items-center">
                     <span>Low Relevance Score</span>
                     <span className="text-red-400 font-bold">(n = {data.lowRelevanceExcluded})</span>
                  </div>
                  <div className="bg-red-500/10 p-2 rounded-lg text-xs font-medium text-slate-300 flex justify-between items-center">
                     <span>Outdated Citation</span>
                     <span className="text-red-400 font-bold">(n = {data.outdatedExcluded})</span>
                  </div>
                </div>
             </div>
          </div>

          {/* Vertical Arrow for Left Box */}
          <div className="absolute top-full left-1/2 md:left-1/4 -translate-x-1/2 h-10 w-0.5 bg-brand-500/30"></div>
          <div className="absolute top-[calc(100%+36px)] left-1/2 md:left-1/4 -translate-x-1/2 w-3 h-3 border-r-2 border-b-2 border-brand-500/30 rotate-45"></div>
        </div>

        <div className="h-10"></div> {/* Spacer for arrow */}

        {/* Step 4: Included */}
        <div className="w-full flex justify-center relative md:pr-[50%]">
          <div className="bg-brand-500/10 border-2 border-brand-500 w-64 p-4 rounded-xl shadow-lg shadow-brand-500/10 relative z-20">
            <h4 className="text-xs font-bold text-brand-300 uppercase tracking-widest mb-1 text-center">Included</h4>
            <div className="text-center text-sm font-medium text-slate-200">
              Included in final synthesis<br />
              <span className="text-3xl font-display font-bold text-brand-400 mt-2 block">(n = {data.finalIncluded})</span>
            </div>
          </div>
        </div>

      </div>

      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-slate-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
    </div>
  );
};
