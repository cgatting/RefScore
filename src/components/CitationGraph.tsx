import React, { useMemo, useEffect, useRef, useState, Suspense } from 'react';

// Dynamically import ForceGraph2D to avoid issues with SSR or strict module loading
const ForceGraph2D = React.lazy(() => import('react-force-graph-2d'));
import { ProcessedReference } from '../types';

interface CitationGraphProps {
  references: Record<string, ProcessedReference>;
}

export const CitationGraph: React.FC<CitationGraphProps> = ({ references }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setDimensions({
          width: entries[0].contentRect.width,
          height: entries[0].contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const graphData = useMemo(() => {
    const nodes: any[] = [];
    const links: any[] = [];
    
    // Create a mapping from openAlexId to internal reference id
    const openAlexToRefId: Record<string, string> = {};
    
    Object.values(references).forEach(ref => {
      // Clean up the OpenAlex ID format just in case it is returning 'https://openalex.org/W...'
      const cleanId = ref.openAlexId ? ref.openAlexId.replace('https://openalex.org/', '') : '';
      
      nodes.push({
        id: ref.id,
        name: ref.title,
        val: ref.citationCount ? Math.log10(ref.citationCount + 1) + 1 : 1,
        color: '#f59e0b' // Brand color
      });
      if (cleanId) {
        openAlexToRefId[cleanId] = ref.id;
        openAlexToRefId[ref.openAlexId!] = ref.id; // Store both just to be safe
      }
    });

    Object.values(references).forEach(ref => {
      if (ref.referencedWorks && ref.referencedWorks.length > 0) {
        ref.referencedWorks.forEach(workUrl => {
          // OpenAlex returns full URLs in referenced_works, so let's match safely
          const workId = workUrl.replace('https://openalex.org/', '');
          const targetRefId = openAlexToRefId[workId] || openAlexToRefId[workUrl];
          
          if (targetRefId && targetRefId !== ref.id) {
            links.push({
              source: ref.id,
              target: targetRefId,
            });
          }
        });
      }
    });

    return { nodes, links };
  }, [references]);

  if (graphData.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-900 rounded-xl border border-slate-700 text-slate-500 text-sm">
        No citation graph data available.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-[500px] bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden relative shadow-inner">
      <div className="absolute top-4 left-4 z-10 bg-slate-800/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 font-medium">
        Citation Network ({graphData.nodes.length} nodes, {graphData.links.length} links)
      </div>
      <Suspense fallback={<div className="flex items-center justify-center h-full text-slate-500">Loading graph...</div>}>
        <ForceGraph2D
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeLabel="name"
          nodeColor="color"
          linkColor={() => 'rgba(255, 255, 255, 0.2)'}
          linkDirectionalArrowLength={3.5}
          linkDirectionalArrowRelPos={1}
          nodeRelSize={6}
          d3VelocityDecay={0.3}
          backgroundColor="#0f172a" // match slate-900
        />
      </Suspense>
    </div>
  );
};