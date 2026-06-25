import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Sparkles, BarChart2, CheckCircle, ShieldCheck, HelpCircle, Smile, TrendingUp, TrendingDown, MoveRight, Users, MessageSquare, RefreshCw } from 'lucide-react';

interface PredictiveInsight {
  title: string;
  text: string;
  category: string;
}

interface CommunitySentiment {
  sentimentScore: number;
  moraleCategory: string;
  trend: string;
  trendSummary: string;
  insights: string[];
}

export default function ImpactDashboard() {
  const { currentCommunity, issues, allIssuesCityWide, chatMessages } = useApp();

  // Scope state: 'community' or 'city'
  const [scope, setScope] = useState<'community' | 'city'>('community');

  // Insights state
  const [insights, setInsights] = useState<PredictiveInsight[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);

  // Sentiment state
  const [sentiment, setSentiment] = useState<CommunitySentiment | null>(null);
  const [loadingSentiment, setLoadingSentiment] = useState(false);

  // Pick target active issues list
  const activeIssues = scope === 'community' 
    ? issues 
    : allIssuesCityWide;

  const currentName = scope === 'community' 
    ? (currentCommunity?.name || "My Community") 
    : "City-Wide Public Grid";

  // Aggregate stats
  const total = activeIssues.length;
  const reported = activeIssues.filter(i => i.status === 'Reported').length;
  const reviewed = activeIssues.filter(i => i.status === 'Reviewed').length;
  const inProgress = activeIssues.filter(i => i.status === 'In Progress').length;
  const completed = activeIssues.filter(i => i.status === 'Completed').length;

  const severityLow = activeIssues.filter(i => i.severity === 'Low').length;
  const severityMedium = activeIssues.filter(i => i.severity === 'Medium').length;
  const severityHigh = activeIssues.filter(i => i.severity === 'High').length;
  const severityCritical = activeIssues.filter(i => i.severity === 'Critical').length;

  // Percentage complete
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Load Gemini insights dynamically based on active issue records
  useEffect(() => {
    const fetchInsights = async () => {
      setLoadingInsights(true);
      try {
        const response = await fetch('/api/ai/predictive-insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            communityId: scope === 'community' ? currentCommunity?.id : null,
            communityName: scope === 'community' ? currentCommunity?.name : "San Francisco City"
          })
        });
        const data = await response.json();
        setInsights(data.insights || []);
      } catch (err) {
        console.error("Failed to load insights:", err);
      } finally {
        setLoadingInsights(false);
      }
    };

    fetchInsights();
  }, [scope, currentCommunity, issues.length]);

  // Load Community Sentiment dynamically
  useEffect(() => {
    if (scope !== 'community' || !currentCommunity) {
      setSentiment(null);
      return;
    }

    const fetchSentiment = async () => {
      setLoadingSentiment(true);
      try {
        const response = await fetch('/api/ai/community-sentiment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            communityId: currentCommunity.id
          })
        });
        const data = await response.json();
        setSentiment(data);
      } catch (err) {
        console.error("Failed to load community sentiment:", err);
      } finally {
        setLoadingSentiment(false);
      }
    };

    fetchSentiment();
  }, [scope, currentCommunity, issues.length, chatMessages?.length]);

  return (
    <div id="impact_dashboard_view" className="p-4 md:p-8 space-y-6 bg-civic-light/30 min-h-screen selection:bg-civic-accent selection:text-civic-darkest">
      
      {/* Scope Selector Header with Glassmorphism */}
      <div className="glass-light p-5.5 rounded-3xl border border-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <div>
          <h1 className="font-display font-bold text-2xl text-civic-darkest tracking-tight">Municipal Impact & Transparency</h1>
          <p className="text-xs text-civic-darkest/65 mt-1 font-medium">
            Active Catchment Scope: <span className="text-civic-primary font-bold">{currentName}</span> • Registered issues: <span className="font-bold">{total}</span>
          </p>
        </div>

        <div className="bg-[#c2cbbe]/30 p-1 rounded-2xl flex border border-white shrink-0 shadow-inner">
          <button
            onClick={() => setScope('community')}
            className={`px-4.5 py-2 rounded-xl text-xs font-bold transition duration-300 cursor-pointer ${
              scope === 'community' ? 'bg-civic-primary text-white shadow-md' : 'text-civic-darkest/70 hover:text-civic-darkest'
            }`}
          >
            My Neighborhood
          </button>
          <button
            onClick={() => setScope('city')}
            className={`px-4.5 py-2 rounded-xl text-xs font-bold transition duration-300 cursor-pointer ${
              scope === 'city' ? 'bg-civic-primary text-white shadow-md' : 'text-civic-darkest/70 hover:text-civic-darkest'
            }`}
          >
            City-Wide Public View
          </button>
        </div>
      </div>

      {/* KPI stats section - Neumorphic Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4.5">
        
        <div className="bg-white/80 p-5 rounded-2xl border border-white shadow-sm space-y-2 flex flex-col justify-between hover:shadow-md transition duration-300">
          <span className="text-[10px] uppercase tracking-wider text-civic-darkest/60 font-mono font-bold">Volume Handled</span>
          <div className="flex justify-between items-baseline pt-1">
            <span className="text-3xl font-mono font-bold text-civic-darkest">{total}</span>
            <span className="text-[10px] font-bold text-civic-primary bg-civic-primary/15 px-2 py-0.5 rounded-md uppercase tracking-wider font-mono">REPORTS</span>
          </div>
        </div>

        <div className="bg-white/80 p-5 rounded-2xl border border-white shadow-sm space-y-2 flex flex-col justify-between hover:shadow-md transition duration-300">
          <span className="text-[10px] uppercase tracking-wider text-civic-darkest/60 font-mono font-bold">Repairs Fixed</span>
          <div className="flex justify-between items-baseline pt-1">
            <span className="text-3xl font-mono font-bold text-civic-darkest">{completed}</span>
            <span className="text-[10px] font-bold text-green-800 bg-green-100 px-2 py-0.5 rounded-md uppercase tracking-wider font-mono">{completionRate}% rate</span>
          </div>
        </div>

        <div className="bg-white/80 p-5 rounded-2xl border border-white shadow-sm space-y-2 flex flex-col justify-between hover:shadow-md transition duration-300">
          <span className="text-[10px] uppercase tracking-wider text-civic-darkest/60 font-mono font-bold">Crews Dispatched</span>
          <div className="flex justify-between items-baseline pt-1">
            <span className="text-3xl font-mono font-bold text-civic-dark">{inProgress}</span>
            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md uppercase tracking-wider font-mono">ACTIVE</span>
          </div>
        </div>

        <div className="bg-white/80 p-5 rounded-2xl border border-white shadow-sm space-y-2 flex flex-col justify-between hover:shadow-md transition duration-300">
          <span className="text-[10px] uppercase tracking-wider text-civic-darkest/60 font-mono font-bold">Pending Review</span>
          <div className="flex justify-between items-baseline pt-1">
            <span className="text-3xl font-mono font-bold text-civic-primary">{reported + reviewed}</span>
            <span className="text-[10px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-md uppercase tracking-wider font-mono">INSPECTION</span>
          </div>
        </div>

      </div>

      {/* Community Sentiment Gauge Section */}
      {scope === 'community' && (
        <div className="glass-light p-6 rounded-3xl border border-white shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-civic-primary/15 pb-3">
            <div className="flex items-center space-x-2">
              <Smile className="h-5 w-5 text-civic-primary" />
              <h3 className="font-display font-bold text-md text-civic-darkest">Community Sentiment & Neighborhood Morale</h3>
            </div>
            <span className="text-[9px] bg-[#cad2c5]/50 border border-civic-primary/10 px-2.5 py-1 rounded-md font-mono text-civic-darkest/70 uppercase font-bold tracking-wider">
              Social Pulse Agent
            </span>
          </div>

          {loadingSentiment ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-2 text-civic-darkest/60 text-xs font-medium">
              <RefreshCw className="h-5 w-5 text-civic-primary animate-spin" />
              <span className="font-mono uppercase tracking-widest font-bold text-[9px]">Analyzing chat logs and report discussions...</span>
            </div>
          ) : sentiment ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Left Column: Gauge SVG & Badge */}
              <div className="md:col-span-4 text-center space-y-3 border-r border-civic-primary/10 md:pr-6">
                <div className="relative">
                  <svg viewBox="0 0 100 55" className="w-44 h-26 mx-auto">
                    {/* Background Arc */}
                    <path
                      d="M 10 50 A 40 40 0 0 1 90 50"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="7"
                      strokeLinecap="round"
                    />
                    {/* Active Progress Arc */}
                    <path
                      d="M 10 50 A 40 40 0 0 1 90 50"
                      fill="none"
                      stroke={
                        sentiment.sentimentScore >= 80 ? '#10b981' : 
                        sentiment.sentimentScore >= 65 ? '#84a98c' : 
                        sentiment.sentimentScore >= 50 ? '#d97706' : 
                        '#dc2626'
                      }
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray="125.6"
                      strokeDashoffset={125.6 - (125.6 * sentiment.sentimentScore) / 100}
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  {/* Score Text in Center */}
                  <div className="absolute bottom-1 left-0 right-0 text-center">
                    <span className="text-2xl font-mono font-bold text-civic-darkest">{sentiment.sentimentScore}</span>
                    <span className="text-xs text-civic-darkest/60 font-mono font-bold">/100</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="inline-flex items-center space-x-1.5 bg-civic-primary/10 border border-civic-primary/20 px-3.5 py-1 rounded-full text-[10px] font-bold text-civic-primary uppercase tracking-wider">
                    <span>
                      {sentiment.sentimentScore >= 80 ? '😊' : 
                       sentiment.sentimentScore >= 65 ? '🤝' : 
                       sentiment.sentimentScore >= 50 ? '😐' : 
                       '😟'}
                    </span>
                    <span>Morale: {sentiment.moraleCategory}</span>
                  </div>
                </div>
              </div>

              {/* Middle Column: Trend & Description */}
              <div className="md:col-span-4 space-y-2 border-r border-civic-primary/10 md:px-6">
                <span className="text-[10px] font-bold uppercase tracking-wider text-civic-darkest/60 font-mono flex items-center space-x-1">
                  {sentiment.trend === 'Rising' && <TrendingUp className="h-3.5 w-3.5 text-green-600 mr-1" />}
                  {sentiment.trend === 'Declining' && <TrendingDown className="h-3.5 w-3.5 text-red-600 mr-1" />}
                  {sentiment.trend === 'Stable' && <MoveRight className="h-3.5 w-3.5 text-gray-500 mr-1" />}
                  Trend: <span className={`ml-1 font-bold ${
                    sentiment.trend === 'Rising' ? 'text-green-600' :
                    sentiment.trend === 'Declining' ? 'text-red-600' :
                    'text-gray-500'
                  }`}>{sentiment.trend}</span>
                </span>
                <p className="text-xs text-civic-darkest/75 leading-relaxed font-sans">{sentiment.trendSummary}</p>
                <div className="pt-2 text-[9px] text-civic-darkest/50 font-mono">
                  Derived from <span className="font-bold">{chatMessages?.length || 0} active chats</span> and <span className="font-bold">{issues?.length || 0} reports</span>.
                </div>
              </div>

              {/* Right Column: Key Morale Drivers/Insights */}
              <div className="md:col-span-4 space-y-2.5 md:pl-6">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-civic-darkest/60 font-mono">Morale Insights & Drivers</span>
                <div className="space-y-2">
                  {sentiment.insights.map((insight, idx) => (
                    <div key={idx} className="flex items-start space-x-2 text-[11px] text-civic-darkest/80 font-sans leading-relaxed">
                      <span className="text-civic-primary font-bold mt-0.5">•</span>
                      <span>{insight}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-civic-darkest/45">
              Not enough neighborhood interaction data to formulate sentiment scores. Try chatting and filing issues first!
            </div>
          )}
        </div>
      )}

      {/* Main Analysis Display Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6.5 items-stretch">
        
        {/* Left Side: Visual Progress Charts - glass light */}
        <div className="md:col-span-6 glass-light p-6 rounded-3xl border border-white shadow-sm space-y-6">
          <div className="flex items-center space-x-2 border-b border-civic-primary/15 pb-3.5">
            <BarChart2 className="h-5 w-5 text-civic-primary" />
            <h3 className="font-display font-bold text-md text-civic-darkest">Statistical Metrics Summary</h3>
          </div>

          {total === 0 ? (
            <div className="text-center py-20 text-civic-darkest/45 text-xs font-medium space-y-2">
              <HelpCircle className="h-7 w-7 mx-auto text-civic-primary/20 animate-pulse" />
              <p>No reports registered to render chart statistics yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Category distribution */}
              <div className="space-y-4">
                <span className="block text-[10px] font-bold uppercase tracking-widest text-civic-darkest/60 font-mono">Categories Weight Breakdown</span>
                
                <div className="space-y-3.5 text-xs">
                  {['Pothole', 'Streetlight', 'Water Leak', 'Garbage Overflow', 'Damaged Property'].map(cat => {
                    const count = activeIssues.filter(i => i.category === cat).length;
                    const percent = Math.round((count / total) * 100);

                    return (
                      <div key={cat} className="space-y-1.5">
                        <div className="flex justify-between font-bold text-civic-darkest">
                          <span>{cat}</span>
                          <span className="font-mono text-[11px]">{count} ({percent}%)</span>
                        </div>
                        <div className="w-full h-3 bg-[#c2cbbe]/30 rounded-full overflow-hidden shadow-inner border border-white/40">
                          <div style={{ width: `${percent}%` }} className="h-full bg-civic-primary rounded-full transition-all duration-500 shadow"></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Severity distribution */}
              <div className="space-y-4 pt-4 border-t border-civic-primary/10">
                <span className="block text-[10px] font-bold uppercase tracking-widest text-civic-darkest/60 font-mono">Severity Priority Dispersion</span>
                
                <div className="grid grid-cols-4 gap-2.5 text-center">
                  <div className="bg-[#84a98c]/20 border border-[#84a98c]/30 p-3 rounded-2xl shadow-sm">
                    <span className="block text-xl font-mono font-bold text-civic-darkest">{severityLow}</span>
                    <span className="text-[8px] uppercase tracking-wider text-civic-darkest/70 font-bold font-mono">Low</span>
                  </div>
                  <div className="bg-[#52796f]/20 border border-[#52796f]/30 p-3 rounded-2xl shadow-sm">
                    <span className="block text-xl font-mono font-bold text-civic-darkest">{severityMedium}</span>
                    <span className="text-[8px] uppercase tracking-wider text-civic-darkest/70 font-bold font-mono">Medium</span>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl shadow-sm">
                    <span className="block text-xl font-mono font-bold text-amber-700">{severityHigh}</span>
                    <span className="text-[8px] uppercase tracking-wider text-amber-800/80 font-bold font-mono">High</span>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-2xl shadow-sm">
                    <span className="block text-xl font-mono font-bold text-red-700">{severityCritical}</span>
                    <span className="text-[8px] uppercase tracking-wider text-red-800/80 font-bold font-mono">Critical</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Right Side: Gemini Predictive Insights - glass dark */}
        <div className="md:col-span-6 glass-dark text-white p-6 rounded-3xl shadow-lg border border-white/10 flex flex-col justify-between">
          <div className="space-y-4.5">
            
            <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-civic-accent animate-pulse" />
                <h3 className="font-display font-bold text-md text-civic-accent">Gemini Predictive Insights</h3>
              </div>
              <span className="text-[9px] bg-white/10 border border-white/5 px-2.5 py-1 rounded-md font-mono text-white/70 uppercase font-bold tracking-wider">Predictive Agent</span>
            </div>

            {loadingInsights ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-3 text-white/60 text-xs">
                <RefreshCw className="h-6 w-6 text-civic-accent animate-spin" />
                <span className="font-mono uppercase tracking-widest font-bold text-[10px] text-center">Crunching municipal trends...</span>
              </div>
            ) : insights.length === 0 ? (
              <div className="py-20 text-center text-white/40 text-xs font-medium">
                No predictive insights generated yet. Seed or report more community hazards to parse trends.
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1.5 custom-scrollbar">
                {insights.map((insight, idx) => (
                  <div 
                    key={idx} 
                    className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2 hover:bg-white/10 transition duration-300 shadow-sm"
                  >
                    <div className="flex justify-between items-center text-[8px] font-bold text-civic-accent uppercase tracking-widest font-mono">
                      <span>{insight.category} Trend Alert</span>
                      <span>💡 INSIGHT</span>
                    </div>
                    <h5 className="font-display font-bold text-sm text-white tracking-tight">{insight.title}</h5>
                    <p className="text-xs text-white/75 leading-relaxed font-sans">{insight.text}</p>
                  </div>
                ))}
              </div>
            )}

          </div>

          <div className="pt-4.5 border-t border-white/10 flex items-center space-x-2 text-[9px] text-white/45 justify-center font-mono uppercase tracking-wider font-bold">
            <ShieldCheck className="h-4 w-4 text-civic-accent" />
            <span>AI Predictive models compared against city historical records.</span>
          </div>
        </div>

      </div>

    </div>
  );
}

// End of ImpactDashboard component
