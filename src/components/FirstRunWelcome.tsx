import React from 'react';
import { Plus, Users, Map } from 'lucide-react';

interface FirstRunWelcomeProps {
  onCreateFirst: () => void;
  onJoinInvited: () => void;
}

export default function FirstRunWelcome({ onCreateFirst, onJoinInvited }: FirstRunWelcomeProps) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4 md:p-8 animate-fade-in">
      <div className="glass-light p-8 md:p-12 rounded-[2.5rem] border border-white shadow-2xl max-w-2xl w-full text-center space-y-8 relative overflow-hidden">
        
        {/* Subtle background glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-civic-accent/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-civic-primary/20 rounded-full blur-3xl"></div>
        
        {/* Central Icon Stagger */}
        <div className="relative inline-block">
          <div className="bg-civic-darkest p-5 rounded-full inline-block text-white shadow-xl border border-civic-accent/15">
            <Map className="h-10 w-10 text-civic-accent animate-pulse" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-civic-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-civic-primary"></span>
          </span>
        </div>

        {/* Messaging */}
        <div className="space-y-3.5 max-w-lg mx-auto">
          <h1 className="font-display font-extrabold text-4xl md:text-5xl text-civic-darkest tracking-tight leading-tight">
            You're the first here.
          </h1>
          <p className="text-sm md:text-base text-civic-darkest/75 leading-relaxed font-medium">
            No communities exist yet in CivicPulse. Create the first boundary zone in your neighborhood and invite others to coordinate, report, and verify local concerns together.
          </p>
        </div>

        {/* CTA Actions */}
        <div className="space-y-4 pt-4 max-w-md mx-auto">
          <button
            onClick={onCreateFirst}
            className="w-full bg-civic-primary hover:bg-civic-dark text-white py-4.5 rounded-2xl font-bold transition-all duration-300 shadow-lg hover:shadow-xl active:scale-[0.99] flex items-center justify-center space-x-2 text-sm cursor-pointer border border-white/10 hover:scale-[1.01]"
          >
            <Plus className="h-5 w-5 text-civic-accent" />
            <span>Create the First Community</span>
          </button>
          
          <button
            onClick={onJoinInvited}
            className="w-full bg-[#b9c3b4]/35 hover:bg-[#b9c3b4]/60 text-civic-darkest py-4 rounded-2xl font-bold transition-all duration-300 text-xs flex items-center justify-center space-x-2 cursor-pointer border border-white/40 shadow-sm"
          >
            <Users className="h-4 w-4 text-civic-primary" />
            <span>I was invited to join one</span>
          </button>
        </div>

        {/* Feature Highlights */}
        <div className="pt-8 border-t border-civic-primary/10 grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <span className="text-xl block">📍</span>
            <span className="block text-[9px] uppercase tracking-wider font-bold text-civic-darkest/60 font-mono">Boundaries</span>
          </div>
          <div className="space-y-1">
            <span className="text-xl block">💬</span>
            <span className="block text-[9px] uppercase tracking-wider font-bold text-civic-darkest/60 font-mono">Isolated Chat</span>
          </div>
          <div className="space-y-1">
            <span className="text-xl block">🤖</span>
            <span className="block text-[9px] uppercase tracking-wider font-bold text-civic-darkest/60 font-mono">AI Diagnostics</span>
          </div>
        </div>

      </div>
    </div>
  );
}
