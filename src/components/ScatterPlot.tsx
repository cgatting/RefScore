import React from 'react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, Cell } from 'recharts';
import { ProcessedReference } from '../types';

interface ScatterPlotProps {
  references: ProcessedReference[];
}

export const ScatterPlot: React.FC<ScatterPlotProps> = ({ references }) => {
  const data = references
    .filter(ref => ref.year && ref.scores)
    .map(ref => ({
      id: ref.id,
      title: ref.title,
      year: ref.year,
      // Use citationCount if available, otherwise derived Authority score is 60-100, which is misleading as count.
      // If citationCount is undefined, we assume 0 for this chart to avoid confusion.
      authority: ref.citationCount || 0, 
      relevance: ref.scores?.Alignment || 0,
    }));

  // Determine if we have enough variation to show
  if (data.length === 0) return null;

  // Color logic: 
  // High Relevance (>80) + High Citations (>100) = Classic (Gold)
  // Recent (>2023) = Green
  // Low Relevance = Grey
  const getColor = (entry: any) => {
    if (entry.year >= new Date().getFullYear() - 2) return 'var(--color-brand-300)'; // Recent
    if (entry.relevance > 80 && entry.authority > 50) return 'var(--color-brand-500)'; // High Value
    if (entry.relevance < 40) return 'var(--color-slate-500)'; // Low Relevance
    return 'var(--color-red-500)'; // Standard
  };

  return (
    <div className="w-full h-[500px] bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl">
      <div className="mb-6">
        <h3 className="text-xl font-display font-bold text-white">Reference Impact Analysis</h3>
        <p className="text-sm text-slate-400">
          Time vs. Impact scatter plot. 
          <span className="ml-2 inline-block w-2 h-2 rounded-full bg-brand-500"></span> High Impact
          <span className="ml-2 inline-block w-2 h-2 rounded-full bg-brand-300"></span> Recent
          <span className="ml-2 inline-block w-2 h-2 rounded-full bg-red-500"></span> Standard
        </p>
      </div>
      
      <ResponsiveContainer width="100%" height="85%">
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <XAxis 
            type="number" 
            dataKey="year" 
            name="Year" 
            domain={['dataMin - 2', 'dataMax + 1']} 
            tick={{ fill: 'var(--color-slate-400)' }}
            tickLine={{ stroke: 'var(--color-slate-400)' }}
            axisLine={{ stroke: 'var(--color-slate-600)' }}
          />
          <YAxis 
            type="number" 
            dataKey="authority" 
            name="Citations" 
            unit="" 
            tick={{ fill: 'var(--color-slate-400)' }}
            tickLine={{ stroke: 'var(--color-slate-400)' }}
            axisLine={{ stroke: 'var(--color-slate-600)' }}
            label={{ value: 'Citation Count', angle: -90, position: 'insideLeft', fill: 'var(--color-slate-400)', offset: 0 }}
          />
          <ZAxis 
            type="number" 
            dataKey="relevance" 
            range={[60, 600]} 
            name="Relevance" 
            unit="%" 
          />
          <Tooltip 
            cursor={{ strokeDasharray: '3 3', stroke: 'var(--color-slate-300)' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-2xl backdrop-blur-sm bg-opacity-95">
                    <p className="font-bold text-white mb-1 text-sm">{data.id}</p>
                    <p className="text-xs text-slate-400 mb-3 max-w-[240px] leading-relaxed line-clamp-2">{data.title}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Year:</span>
                        <span className="text-slate-200 font-medium">{data.year}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Citations:</span>
                        <span className="text-slate-200 font-medium">{data.authority}</span>
                      </div>
                      <div className="flex justify-between col-span-2 border-t border-slate-700 pt-2 mt-1">
                        <span className="text-slate-500">Alignment Score:</span>
                        <span className="text-brand-300 font-bold">{data.relevance.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Scatter name="References" data={data}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry)} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};
