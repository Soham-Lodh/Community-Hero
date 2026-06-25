import React from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, MapPin, MessageSquare, Award, ArrowRight, Activity, Zap, AlertTriangle } from 'lucide-react';

interface LandingPageProps {
  onStart: () => void;
}

export default function LandingPage({ onStart }: LandingPageProps) {
  const { allIssuesCityWide, communities } = useApp();

  // Aggregate global stats
  const totalMembers = communities.reduce((sum, c) => sum + (c.memberUids?.length || 0), 0);
  const resolvedReports = allIssuesCityWide.filter(i => i.status === 'Completed').length;
  const inProgressReports = allIssuesCityWide.filter(i => i.status === 'In Progress').length;
  const reportedCount = allIssuesCityWide.filter(i => i.status === 'Reported' || i.status === 'Reviewed').length;

  return (
    <div id="landing_page" className="min-h-screen bg-civic-light text-civic-darkest font-sans flex flex-col justify-between selection:bg-civic-accent selection:text-civic-darkest">
      
      {/* Header with Glassmorphism */}
      <header className="glass-dark sticky top-0 text-white px-8 py-5 flex justify-between items-center shadow-lg z-50">
        <div className="flex items-center space-x-3">
          <div className="bg-civic-primary/20 p-2.5 rounded-xl border border-civic-accent/20">
            <Zap className="h-6 w-6 text-civic-accent animate-pulse" />
          </div>
          <div>
            <span className="font-display font-bold text-2xl tracking-tight block">CivicPulse</span>
            <span className="text-[9px] font-mono tracking-widest text-civic-accent uppercase">Hyperlocal Infrastructure Hub</span>
          </div>
        </div>
        <button 
          onClick={onStart}
          className="neumorph-dark-out-sm text-white px-5 py-2.5 rounded-xl font-bold transition duration-300 hover:text-civic-accent hover:scale-[1.02] flex items-center space-x-2 border border-civic-accent/15 cursor-pointer"
        >
          <span>Enter App</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </header>

      {/* Main Hero Block */}
      <main className="max-w-7xl mx-auto px-6 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center flex-grow">
        
        {/* Left Side Content */}
        <div className="lg:col-span-6 space-y-8 animate-fade-in">
          <div className="inline-flex items-center space-x-2 bg-civic-primary/10 border border-civic-primary/15 px-4 py-2 rounded-full text-civic-primary font-bold text-xs uppercase tracking-wider">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-civic-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-civic-primary"></span>
            </span>
            <span>COMMUNITY CIRCLES ENGINE</span>
          </div>

          <h1 className="font-display font-bold text-4xl sm:text-5xl lg:text-6xl text-civic-darkest tracking-tight leading-[1.1]">
            Turn Neighborhood Concerns into <span className="text-civic-primary bg-civic-accent/25 px-2 rounded-xl">Verified Actions</span>
          </h1>

          <p className="text-md sm:text-lg text-civic-darkest/80 leading-relaxed max-w-xl">
            CivicPulse organizes street level infrastructure repairs within real, non-overlapping geolocated bounds. 
            Empower your community with AI duplicate mitigation, real-time authenticated chat rooms, 
            and transparent micro-status tracking updates directly from municipal crews.
          </p>

          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-5 pt-2">
            <button
              onClick={onStart}
              className="bg-civic-primary hover:bg-civic-dark text-white px-8 py-4.5 rounded-2xl font-bold shadow-lg transition duration-300 hover:scale-[1.01] active:scale-[0.99] text-center flex items-center justify-center space-x-3 text-lg cursor-pointer"
            >
              <span>Explore My Neighborhood</span>
              <ArrowRight className="h-5 w-5 text-civic-accent" />
            </button>
            <a
              href="#how_it_works"
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById('about_section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="neumorph-out-sm neumorph-out-hover px-8 py-4.5 rounded-2xl font-bold text-civic-primary text-center text-lg cursor-pointer border border-white/40"
            >
              How It Works
            </a>
          </div>
        </div>

        {/* Right Side Cards Display using Neumorphic / Glassmorphism Deck */}
        <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
          
          <div className="neumorph-out p-6 rounded-2xl border border-white/50 transform -rotate-1 hover:rotate-0 transition duration-300">
            <div className="flex items-center space-x-2.5 mb-4">
              <div className="bg-red-50 p-2 rounded-xl text-red-600 border border-red-100 shadow-sm">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <span className="font-mono text-xs text-civic-dark font-bold uppercase tracking-wider">Roads Team</span>
            </div>
            <h3 className="font-display font-bold text-lg text-civic-darkest mb-1.5 leading-snug">Deep Pothole on 24th BART</h3>
            <p className="text-xs text-civic-darkest/75 leading-relaxed mb-5">Deep asphalt rupture causing safety risks. Several vehicles reported damage today.</p>
            <div className="flex justify-between items-center pt-2 border-t border-civic-darkest/5">
              <span className="bg-civic-accent/30 text-civic-darkest px-3 py-1 rounded-xl text-[10px] font-bold">22 Verifications</span>
              <span className="text-[10px] text-civic-primary font-bold uppercase tracking-wider">IN PROGRESS</span>
            </div>
          </div>

          <div className="neumorph-out p-6 rounded-2xl border border-white/50 transform rotate-2 hover:rotate-0 transition duration-300 sm:translate-y-8">
            <div className="flex items-center space-x-2.5 mb-4">
              <div className="bg-blue-50 p-2 rounded-xl text-blue-600 border border-blue-100 shadow-sm">
                <Activity className="h-5 w-5" />
              </div>
              <span className="font-mono text-xs text-civic-dark font-bold uppercase tracking-wider">Water Board</span>
            </div>
            <h3 className="font-display font-bold text-lg text-civic-darkest mb-1.5 leading-snug">Sidewalk Valve Leak</h3>
            <p className="text-xs text-civic-darkest/75 leading-relaxed mb-5">Main line valve water logging the cycle track, causing dangerous icing overnight.</p>
            <div className="flex justify-between items-center pt-2 border-t border-civic-darkest/5">
              <span className="bg-civic-accent/30 text-civic-darkest px-3 py-1 rounded-xl text-[10px] font-bold">14 Verifications</span>
              <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wider">REVIEWED</span>
            </div>
          </div>

          <div className="neumorph-out p-6 rounded-2xl border border-white/50 transform -rotate-2 hover:rotate-0 transition duration-300 sm:-translate-y-4">
            <div className="flex items-center space-x-2.5 mb-4">
              <div className="bg-green-50 p-2 rounded-xl text-green-600 border border-green-100 shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <span className="font-mono text-xs text-civic-dark font-bold uppercase tracking-wider">Electric Grid</span>
            </div>
            <h3 className="font-display font-bold text-lg text-civic-darkest mb-1.5 leading-snug">Streetlamp Restored</h3>
            <p className="text-xs text-civic-darkest/75 leading-relaxed mb-5">Secondary alley bulb replaced safely within 24 hours of reporting.</p>
            <div className="flex justify-between items-center pt-2 border-t border-civic-darkest/5">
              <span className="bg-civic-accent text-civic-darkest px-3 py-1 rounded-xl text-[10px] font-bold">5 Citizens Rewarded</span>
              <span className="text-[10px] text-civic-darkest font-bold bg-civic-accent/40 px-2.5 py-1 rounded-lg uppercase tracking-wider">RESOLVED</span>
            </div>
          </div>

          <div className="glass-dark text-white p-6 rounded-2xl shadow-xl transform rotate-1 hover:rotate-0 transition duration-300 sm:translate-y-4 border border-civic-accent/20">
            <div className="flex items-center space-x-2.5 mb-4">
              <Award className="h-6 w-6 text-civic-accent animate-pulse" />
              <span className="font-display font-bold text-md text-civic-accent tracking-tight">Active Badges</span>
            </div>
            <div className="space-y-3 pt-1">
              <div className="flex items-center space-x-3">
                <span className="bg-civic-primary/40 p-1.5 rounded-lg text-xs border border-white/10">⭐</span>
                <span className="text-xs font-semibold text-white/90">First Report Milestone</span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="bg-civic-primary/40 p-1.5 rounded-lg text-xs border border-white/10">🤝</span>
                <span className="text-xs font-semibold text-white/90">Verified Civic Steward (+10)</span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="bg-civic-primary/40 p-1.5 rounded-lg text-xs border border-white/10">🏆</span>
                <span className="text-xs font-semibold text-white/90">Neighborhood Titan (Top 10%)</span>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Live Impact Stats Ticker with Glassmorphism overlay */}
      <section className="glass-dark text-white py-8 border-y border-civic-accent/10 relative shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-5 gap-8 text-center">
          <div className="space-y-1">
            <span className="block text-4xl font-display font-bold text-civic-accent">{communities.length || 3}</span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-white/65">Active Districts</span>
          </div>
          <div className="space-y-1">
            <span className="block text-4xl font-display font-bold text-civic-accent">{totalMembers || 8}</span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-white/65">Registered Citizens</span>
          </div>
          <div className="space-y-1">
            <span className="block text-4xl font-display font-bold text-civic-accent">{reportedCount || 6}</span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-white/65">Open Reports</span>
          </div>
          <div className="space-y-1">
            <span className="block text-4xl font-display font-bold text-civic-accent">{inProgressReports || 3}</span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-white/65">Crews Dispatched</span>
          </div>
          <div className="col-span-2 md:col-span-1 space-y-1">
            <span className="block text-4xl font-display font-bold text-civic-accent">{resolvedReports || 2}</span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-white/65">Completed Repairs</span>
          </div>
        </div>
      </section>

      {/* Core Mission Cards */}
      <section id="about_section" className="bg-civic-light py-20 border-t border-civic-primary/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-2">
            <h2 className="font-display font-bold text-3xl md:text-4xl text-civic-darkest tracking-tight">
              Community Hero — Local Problem Solver
            </h2>
            <p className="text-civic-darkest/75 leading-relaxed text-sm">
              Why CivicPulse outperforms traditional municipality web portals:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="neumorph-out p-6.5 rounded-2xl border border-white/60 space-y-4">
              <div className="bg-civic-primary/10 p-3 rounded-xl inline-block text-civic-primary border border-civic-primary/20">
                <MapPin className="h-6 w-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-civic-darkest">1. Hard Geo-Validation</h3>
              <p className="text-xs text-civic-darkest/75 leading-relaxed">
                Communities never overlap. Radius-bound checks prevent false reporting errors. One neighborhood per citizen.
              </p>
            </div>

            <div className="neumorph-out p-6.5 rounded-2xl border border-white/60 space-y-4">
              <div className="bg-civic-primary/10 p-3 rounded-xl inline-block text-civic-primary border border-civic-primary/20">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-civic-darkest">2. AI Duplicate Mitigation</h3>
              <p className="text-xs text-civic-darkest/75 leading-relaxed">
                Before a pothole duplicate is posted, our Geo-Duplicate Agent finds matches within 150m, pooling photos and upvotes.
              </p>
            </div>

            <div className="neumorph-out p-6.5 rounded-2xl border border-white/60 space-y-4">
              <div className="bg-civic-primary/10 p-3 rounded-xl inline-block text-civic-primary border border-civic-primary/20">
                <MessageSquare className="h-6 w-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-civic-darkest">3. Moderated Chat Rooms</h3>
              <p className="text-xs text-civic-darkest/75 leading-relaxed">
                Neighborhood group channels are protected by real-time Gemini moderation to prevent harassment, political debates, or spam.
              </p>
            </div>

            <div className="neumorph-out p-6.5 rounded-2xl border border-white/60 space-y-4">
              <div className="bg-civic-primary/10 p-3 rounded-xl inline-block text-civic-primary border border-civic-primary/20">
                <Award className="h-6 w-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-civic-darkest">4. Gamified Verification</h3>
              <p className="text-xs text-civic-darkest/75 leading-relaxed">
                Citizens upvote and upload confirmation images to verify reports. Earn points, ranks, and custom AI-generated badges.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-civic-darkest text-white/50 text-xs py-10 border-t border-white/5 text-center space-y-2">
        <p className="font-medium tracking-tight">&copy; 2026 CivicPulse • Vibe2Ship Community Hero Submission.</p>
        <p className="text-[10px] text-white/30">Gemini • React • Tailwind • Firebase</p>
      </footer>

    </div>
  );
}
