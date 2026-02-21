import React, { useState, useCallback } from 'react';
import { 
  ArrowRight, 
  CheckCircle, 
  Zap, 
  Search, 
  BookOpen, 
  BarChart3, 
  ShieldCheck, 
  ChevronDown, 
  ChevronUp, 
  Github, 
  Cpu, 
  Layers, 
  FileText,
  Activity,
  Globe,
  Database
} from 'lucide-react';

interface LandingPageProps {
  onStart: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  const logoUrl = new URL('../../logo.png', import.meta.url).href;
  const [isMathOpen, setIsMathOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const handleStart = useCallback(() => {
    onStart();
  }, [onStart]);

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-brand-500 selection:text-slate-950 overflow-x-hidden bg-grid relative">
      
      <Navigation onStart={handleStart} logoUrl={logoUrl} />

      <main className="relative z-10">
        <Hero onStart={handleStart} />
        <Features />
        <HowItWorks activeStep={activeStep} setActiveStep={setActiveStep} />
        <Benefits onStart={handleStart} />
        <TechnicalDeepDive isOpen={isMathOpen} setIsOpen={setIsMathOpen} />
        <CTASection onStart={handleStart} />
      </main>

      <Footer logoUrl={logoUrl} />
    </div>
  );
};

// --- Sub-components ---

const Navigation = ({ onStart, logoUrl }: { onStart: () => void; logoUrl: string }) => (
  <nav className="fixed w-full z-50 border-b border-slate-800 bg-slate-950">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center h-20">
        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="bg-slate-900 p-2 rounded-lg border border-slate-700">
            <img src={logoUrl} alt="RefScore logo" className="w-8 h-8 rounded-sm" />
          </div>
          <span className="font-display font-bold text-2xl tracking-tight text-white">
            Ref<span className="text-brand-500">Score</span>
          </span>
        </div>
        
        <div className="hidden md:flex items-center gap-10">
          <NavLink href="#features">Features</NavLink>
          <NavLink href="#how-it-works">Workflow</NavLink>
          <NavLink href="#deep-dive">Technical</NavLink>
          <button 
            onClick={onStart}
            className="px-6 py-2 bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold rounded-sm transition-all duration-200 shadow-[4px_4px_0px_0px_rgba(255,215,0,0.2)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
          >
            Launch App
          </button>
        </div>
      </div>
    </div>
  </nav>
);

const Hero = ({ onStart }: { onStart: () => void }) => (
  <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-slate-900 border border-slate-700 text-brand-500 text-xs font-bold uppercase tracking-widest mb-10">
        Academic Analysis Engine
      </div>
      
      <h1 className="text-6xl md:text-8xl font-display font-bold text-white mb-10 leading-none tracking-tight">
        Master Your <br /><span className="text-brand-500">Academic References</span>
      </h1>
      
      <p className="max-w-3xl text-xl md:text-2xl text-slate-400 mb-14 leading-relaxed font-normal">
        A multi-dimensional scoring engine built for serious researchers. 
        Validate alignment, authority, and factual consistency.
      </p>
      
      <div className="flex flex-col sm:flex-row items-center gap-6 mb-24">
        <button 
          onClick={onStart}
          className="w-full sm:w-auto px-10 py-5 bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xl rounded-sm transition-all duration-200 flex items-center justify-center gap-3 shadow-[8px_8px_0px_0px_rgba(255,215,0,0.2)] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none"
        >
          Start Analyzing Now 
          <ArrowRight className="w-6 h-6" />
        </button>
        <a 
          href="#features"
          className="w-full sm:w-auto px-10 py-5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xl rounded-sm border border-slate-700 transition-all duration-200"
        >
          Explore Features
        </a>
      </div>

      {/* Solid Informational Grid instead of Mockup */}
      <div className="grid md:grid-cols-4 gap-4">
        <DataPoint label="Analysis Depth" value="5D Scoring" />
        <DataPoint label="Processing" value="Browser-Native" />
        <DataPoint label="Data Source" value="OpenAlex API" />
        <DataPoint label="Privacy" value="100% Local" />
      </div>
    </div>
  </section>
);

const DataPoint = ({ label, value }: { label: string; value: string }) => (
    <div className="p-6 bg-slate-900 border border-slate-800 rounded-sm">
        <div className="text-slate-500 text-xs uppercase tracking-widest font-bold mb-2">{label}</div>
        <div className="text-brand-500 font-display font-bold text-2xl">{value}</div>
    </div>
);

const Features = () => (
  <section id="features" className="py-32 border-t border-slate-900">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mb-24">
        <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-6">
          System Features
        </h2>
        <p className="text-slate-400 text-xl font-normal">
          NLP, authority metrics, and factual alignment in a single source of truth.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <FeatureCard 
          icon={<Cpu className="w-10 h-10 text-brand-500" />}
          title="Contextual NLP"
          description="Analyzes the semantic distance between your claims and the cited abstract using TF-IDF vectorization."
        />
        <FeatureCard 
          icon={<BarChart3 className="w-10 h-10 text-brand-500" />}
          title="Impact Calibration"
          description="Scores author authority and venue prestige dynamically, ensuring your citations are current and respected."
        />
        <FeatureCard 
          icon={<ShieldCheck className="w-10 h-10 text-brand-500" />}
          title="Integrity Validation"
          description="Detects metadata gaps and potential hallucinations instantly, ensuring your BibTeX is publication-ready."
        />
      </div>
    </div>
  </section>
);

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
  <div className="p-10 bg-slate-900 border border-slate-800 hover:border-brand-500 transition-colors duration-300 rounded-sm group">
    <div className="mb-8 p-4 bg-slate-950 border border-slate-800 inline-block">
      {icon}
    </div>
    <h3 className="text-2xl font-bold text-white mb-4 uppercase tracking-tight">{title}</h3>
    <p className="text-slate-400 leading-relaxed text-lg font-normal">
      {description}
    </p>
  </div>
);

const HowItWorks = ({ activeStep, setActiveStep }: { activeStep: number; setActiveStep: (n: number) => void }) => {
  const steps = [
    {
      title: "01 Ingest",
      icon: <FileText className="w-6 h-6" />,
      desc: "Upload LaTeX (.tex) and Bibliography (.bib). Every citation is mapped to its specific source key."
    },
    {
      title: "02 Enrich",
      icon: <Database className="w-6 h-6" />,
      desc: "Metadata is enriched via OpenAlex API. Abstract content is retrieved for semantic analysis."
    },
    {
      title: "03 Score",
      icon: <Activity className="w-6 h-6" />,
      desc: "5-dimensional scoring is applied: Alignment, Entities, Numbers, Methods, and Authority."
    }
  ];

  return (
    <section id="how-it-works" className="py-32 bg-slate-900 border-y border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-16">
          Operational Workflow
        </h2>
        <div className="grid lg:grid-cols-3 gap-8">
          {steps.map((step, idx) => (
            <div 
              key={idx}
              className={`p-8 border rounded-sm transition-all duration-200 ${activeStep === idx ? 'bg-slate-950 border-brand-500 shadow-[4px_4px_0px_0px_rgba(255,215,0,0.1)]' : 'border-slate-800 bg-slate-950/50'}`}
              onMouseEnter={() => setActiveStep(idx)}
            >
              <div className={`w-12 h-12 flex items-center justify-center mb-6 ${activeStep === idx ? 'bg-brand-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
                {step.icon}
              </div>
              <h4 className="text-xl font-bold text-white mb-4 uppercase">{step.title}</h4>
              <p className="text-slate-400 font-normal leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Benefits = ({ onStart }: { onStart: () => void }) => (
  <section className="py-32">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid lg:grid-cols-2 gap-20">
        <div>
          <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-8">
            Engineering Rigor
          </h2>
          <p className="text-slate-400 text-xl font-normal mb-12 leading-relaxed">
            Stop manually verifying source relevance. RefScore provides empirical evidence for every citation in your manuscript.
          </p>
          
          <div className="space-y-6 mb-12">
            <BenefitItem text="Zero " highlight="Citation Hallucinations" />
            <BenefitItem text="Verified " highlight="Contextual Relevance" />
            <BenefitItem text="Automated " highlight="Metadata Retrieval" />
            <BenefitItem text="Dynamic " highlight="Source Recency" />
          </div>

          <button 
            onClick={onStart}
            className="px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-sm border border-slate-700 transition-all duration-200 flex items-center gap-2"
          >
            Launch RefScore <ArrowRight className="w-5 h-5" />
          </button>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-10 rounded-sm">
            <h3 className="text-brand-500 font-bold uppercase tracking-widest text-sm mb-10">Dimension Weights</h3>
            <div className="space-y-8">
                <WeightBar label="Semantic Alignment" value="30%" />
                <WeightBar label="Entity Overlap" value="20%" />
                <WeightBar label="Numerical Claims" value="15%" />
                <WeightBar label="Methodology Match" value="15%" />
                <WeightBar label="Authority & Recency" value="20%" />
            </div>
        </div>
      </div>
    </div>
  </section>
);

const WeightBar = ({ label, value }: { label: string; value: string }) => (
    <div className="space-y-2">
        <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
            <span>{label}</span>
            <span className="text-brand-500">{value}</span>
        </div>
        <div className="h-1 bg-slate-800">
            <div className="h-full bg-brand-500" style={{ width: value }} />
        </div>
    </div>
);

const BenefitItem = ({ text, highlight }: { text: string; highlight: string }) => (
  <div className="flex items-center gap-4">
    <CheckCircle className="w-6 h-6 text-brand-500 shrink-0" />
    <span className="text-slate-300 text-lg">
        {text}<span className="text-white font-bold">{highlight}</span>
    </span>
  </div>
);

const TechnicalDeepDive = ({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: (o: boolean) => void }) => (
  <section id="deep-dive" className="py-24 bg-slate-900 border-y border-slate-800">
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-8">
        Technical Specification
      </h2>
      <p className="text-slate-400 text-lg font-normal mb-10">
        Transparent methodologies. Open standards. Local-first architecture.
      </p>
      
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-3 px-6 py-3 bg-slate-950 border border-slate-800 hover:border-brand-500 rounded-sm transition-all text-slate-300 font-bold uppercase text-sm tracking-widest"
      >
        {isOpen ? 'Close Specification' : 'View Scoring Math'}
        {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {isOpen && (
        <div className="mt-12 space-y-8">
          <div className="p-8 bg-slate-950 border border-slate-800 rounded-sm">
            <h3 className="text-2xl font-bold text-white mb-8 uppercase tracking-tight flex items-center gap-3">
                <Layers className="w-6 h-6 text-brand-500" />
                Scoring Logic
            </h3>
            <div className="grid md:grid-cols-2 gap-10">
              <MathFeature 
                title="TF-IDF Vectorization"
                math="idf ≈ log((N+1)/(df+1)) + 1"
                desc="Terms are weighted by frequency across document and global academic corpus."
              />
              <MathFeature 
                title="Cosine Similarity"
                math="cos(θ) = (A·B) / (||A|| ||B||)"
                desc="Measures alignment between sentence and source abstract in vector space."
              />
              <MathFeature 
                title="Entity Coverage"
                math="C = |E_s ∩ E_a| / |E_s|"
                desc="Quantifies overlap of key named entities and domain terminology."
              />
              <MathFeature 
                title="Recency Decay"
                math="S_r = e^{-k(t_{now} - t_{pub})}"
                desc="Non-linear penalty to older sources for research currency."
              />
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-8 bg-slate-950 border border-slate-800 rounded-sm">
                <h4 className="text-xl font-bold text-white mb-4 uppercase flex items-center gap-2">
                    <Globe className="w-5 h-5 text-brand-500" />
                    Data Privacy
                </h4>
                <ul className="text-slate-400 space-y-3 font-normal">
                    <li>• Analysis is performed 100% locally in browser memory.</li>
                    <li>• Minimal metadata strings are sent to OpenAlex API.</li>
                    <li>• No manuscript content is ever persisted on external servers.</li>
                </ul>
            </div>
            <div className="p-8 bg-slate-950 border border-slate-800 rounded-sm">
                <h4 className="text-xl font-bold text-white mb-4 uppercase flex items-center gap-2">
                    <Github className="w-5 h-5 text-brand-500" />
                    Open Standard
                </h4>
                <ul className="text-slate-400 space-y-3 font-normal">
                    <li>• Standard BibTeX (.bib) file support.</li>
                    <li>• LaTeX (.tex) parsing for citation mapping.</li>
                    <li>• Exportable PDF analysis reports for peer review verification.</li>
                </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  </section>
);

const MathFeature = ({ title, math, desc }: { title: string; math: string; desc: string }) => (
    <div className="space-y-4">
        <h4 className="font-bold text-white uppercase tracking-wider text-sm">{title}</h4>
        <div className="p-4 bg-black border border-slate-800 font-mono text-sm text-brand-500">
            {math}
        </div>
        <p className="text-slate-500 text-sm font-normal leading-relaxed">
            {desc}
        </p>
    </div>
);

const CTASection = ({ onStart }: { onStart: () => void }) => (
  <section className="py-32 bg-slate-950 text-center">
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <h2 className="text-5xl md:text-7xl font-display font-bold text-white mb-10 tracking-tight">
        Ready to Analyze?
      </h2>
      <p className="text-2xl text-slate-400 mb-16 max-w-2xl mx-auto font-normal leading-relaxed">
        Start your analysis now. No account required. All processing remains local to your device.
      </p>
      <button 
        onClick={onStart}
        className="px-12 py-6 bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-2xl rounded-sm transition-all duration-200 shadow-[10px_10px_0px_0px_rgba(255,215,0,0.2)] hover:translate-x-[5px] hover:translate-y-[5px] hover:shadow-none"
      >
        Launch RefScore Engine
      </button>
    </div>
  </section>
);

const Footer = ({ logoUrl }: { logoUrl: string }) => (
  <footer className="py-20 border-t border-slate-800 bg-slate-950">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-slate-400">
        <div className="col-span-2">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-slate-900 p-2 rounded-lg border border-slate-700">
                <img src={logoUrl} alt="RefScore logo" className="w-8 h-8 rounded-sm" />
            </div>
            <span className="font-display font-bold text-2xl text-white">Ref<span className="text-brand-500">Score</span></span>
          </div>
          <p className="text-slate-500 max-w-sm text-lg font-normal leading-relaxed">
            Advanced reference analysis for rigorous academic writing. Built on open standards.
          </p>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-white mb-6">Product</h4>
          <ul className="space-y-4 text-slate-500 font-normal text-sm">
            <li><a href="#features" className="hover:text-brand-500 transition-colors">Features</a></li>
            <li><a href="#how-it-works" className="hover:text-brand-500 transition-colors">Workflow</a></li>
            <li><a href="#deep-dive" className="hover:text-brand-500 transition-colors">Technical Spec</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-white mb-6">Community</h4>
          <ul className="space-y-4 text-slate-500 font-normal text-sm">
            <li><a href="https://github.com" className="hover:text-brand-500 transition-colors flex items-center gap-2"><Github className="w-4 h-4" /> GitHub</a></li>
            <li><a href="#" className="hover:text-brand-500 transition-colors">Documentation</a></li>
            <li><a href="#" className="hover:text-brand-500 transition-colors">Open Data</a></li>
          </ul>
        </div>
      </div>
      <div className="mt-20 pt-8 border-t border-slate-900 flex flex-col md:flex-row justify-between items-center gap-6">
        <p className="text-slate-600 text-xs font-bold tracking-widest uppercase">&copy; {new Date().getFullYear()} RefScore. All rights reserved.</p>
        <div className="flex gap-8 text-xs font-bold tracking-widest uppercase text-slate-600">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
        </div>
      </div>
    </div>
  </footer>
);

// --- Small Helper Components ---

const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href} className="text-xs font-bold text-slate-400 hover:text-white uppercase tracking-widest transition-colors relative group">
        {children}
        <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-brand-500 transition-all duration-300 group-hover:w-full" />
    </a>
);
