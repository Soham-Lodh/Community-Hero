import React from 'react';
import { Sparkles, ShieldCheck, Zap, Compass, AlertTriangle, Eye, ThumbsUp, Mail, MessageSquare } from 'lucide-react';

export default function HowItWorks() {
  const agents = [
    {
      id: 1,
      name: "1. Intake & Vision Agent",
      icon: <Eye className="h-5 w-5 text-civic-accent" />,
      desc: "Triggered on photo upload. Gemini multimodal models parse category, title, description, and severity (Low to Critical) automatically."
    },
    {
      id: 2,
      name: "2. Geo-Duplicate Agent",
      icon: <AlertTriangle className="h-5 w-5 text-civic-accent" />,
      desc: "Queries Firestore for matching open reports within 150m of same category. Intercepts duplicates and suggests pooling verifications."
    },
    {
      id: 3,
      name: "3. Priority & Routing Agent",
      icon: <Zap className="h-5 w-5 text-civic-accent" />,
      desc: "Computes urgency scores from severity and upvote weight. Dispatches reports directly to department queues (Roads, Water, etc.)."
    },
    {
      id: 4,
      name: "4. Verification & Upvote Agent",
      icon: <ThumbsUp className="h-5 w-5 text-civic-accent" />,
      desc: "Ensures one upvote per user. If citizen uploads a confirming photo, lightweight vision is run to verify integrity before scoring."
    },
    {
      id: 5,
      name: "5. Predictive Insights Agent",
      icon: <TrendingUp className="h-5 w-5 text-civic-accent" />,
      desc: "Aggregates recent community open queue history and generates actionable advisory notes for city staff and neighborhood councils."
    },
    {
      id: 6,
      name: "6. Resolution Agent",
      icon: <CheckCircle className="h-5 w-5 text-civic-accent" />,
      desc: "Triggered on official resolve. Compiles technical repair notes into a polished public resolution note, distributing points."
    },
    {
      id: 7,
      name: "7. Escalation Agent",
      icon: <Mail className="h-5 w-5 text-civic-accent" />,
      desc: "Runs if reports remain stale. Auto-drafts formal ready-to-copy administrative letters citing severity, duration, and upvote volume."
    },
    {
      id: 8,
      name: "8. Community Geo-Validation Agent",
      icon: <Compass className="h-5 w-5 text-civic-accent" />,
      desc: "Triggers on community establishment. Resolves address parameters and checks center distances against existing boundaries to avoid overlap."
    },
    {
      id: 9,
      name: "9. Chat Moderation Agent",
      icon: <MessageSquare className="h-5 w-5 text-civic-accent" />,
      desc: "Checks message streams in real time. Blocks harassment, commercial spam, or non-neighborhood political debates instantly."
    }
  ];

  return (
    <div id="how_it_works_view" className="p-4 md:p-8 space-y-6 bg-civic-light/30 min-h-screen selection:bg-civic-accent selection:text-civic-darkest">
      
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Title Header - glass-light */}
        <div className="glass-light p-6.5 rounded-3xl border border-white shadow-sm text-center max-w-2xl mx-auto space-y-2">
          <Sparkles className="h-7 w-7 text-civic-primary mx-auto animate-pulse" />
          <h1 className="font-display font-bold text-2xl text-civic-darkest tracking-tight">Agentic Pipeline Blueprint</h1>
          <p className="text-xs text-civic-darkest/70 leading-relaxed font-medium">
            CivicPulse coordinates 9 distinct server-side agentic workflows powered by Gemini LLM reasoning to automate public works reporting and resolution dispatch.
          </p>
        </div>

        {/* Catalog Grid - glass dark boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {agents.map(agent => (
            <div 
              key={agent.id}
              className="glass-dark text-white p-5 rounded-2xl border border-white/10 space-y-3.5 shadow-md flex flex-col justify-between hover:bg-[#2f3e46] transition-colors duration-300 hover:shadow-lg hover:scale-[1.01]"
            >
              <div className="space-y-3">
                <div className="bg-white/10 border border-white/5 p-2.5 rounded-xl inline-block shadow-inner">
                  {agent.icon}
                </div>
                <h3 className="font-display font-bold text-sm text-civic-accent tracking-tight leading-snug">{agent.name}</h3>
                <p className="text-xs text-white/70 leading-relaxed font-sans">{agent.desc}</p>
              </div>

              <span className="text-[8px] font-mono font-bold text-[#84a98c] block pt-2.5 border-t border-white/10 uppercase tracking-widest">
                Server Runtime Node
              </span>
            </div>
          ))}
        </div>

        {/* Structural Policy Notice */}
        <div className="glass-light p-5 rounded-2xl border border-white shadow-sm text-center flex items-center justify-center space-x-2.5 text-xs text-civic-darkest/75 font-medium">
          <ShieldCheck className="h-5 w-5 text-civic-primary" />
          <span>All decision logs are cryptographically stamped to the public ledger for civic accountability.</span>
        </div>

      </div>

    </div>
  );
}

// Simple internal icon helpers
function TrendingUp(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function CheckCircle(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
