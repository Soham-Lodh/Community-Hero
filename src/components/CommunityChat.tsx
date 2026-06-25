import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Issue } from '../types';
import { Send, ShieldAlert, Sparkles, MessageSquare, ChevronRight } from 'lucide-react';
import UserAvatar from './UserAvatar';

interface CommunityChatProps {
  onNavigateToIssue: (id: string) => void;
}

export default function CommunityChat({ onNavigateToIssue }: CommunityChatProps) {
  const { currentCommunity, chatMessages, issues, sendChatMessage, userProfile } = useApp();
  
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Issue sharing modal state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Auto scroll ref
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new message load
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Handle message sending
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !userProfile || loading) return;

    setError(null);
    setLoading(true);
    const textToSend = inputText;
    setInputText('');

    try {
      const res = await sendChatMessage(textToSend, 'text');
      if (!res.approved) {
        setError(`Message Moderated: ${res.reason || 'Blocked by security checks.'}`);
      }
    } catch (err: any) {
      setError("Failed to broadcast message: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle sharing an issue
  const handleShareIssue = async (issue: Issue) => {
    setIsShareModalOpen(false);
    setError(null);
    setLoading(true);

    try {
      const textSummary = `[Shared Issue] ${issue.title}`;
      const res = await sendChatMessage(textSummary, 'issueShare', issue.id, issue.title);
      if (!res.approved) {
        setError(`Failed to share: ${res.reason}`);
      }
    } catch (err: any) {
      setError("Failed to share issue: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="community_chat_view" className="flex flex-col h-[calc(100vh-140px)] min-h-[500px] bg-civic-light/30 selection:bg-civic-accent selection:text-civic-darkest">
      
      {/* Thread Header - Glassmorphic */}
      <div className="bg-[#cad2c5]/50 backdrop-blur-md px-6 py-4.5 border-b border-civic-primary/10 flex justify-between items-center shadow-sm z-10">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="bg-civic-primary/10 p-2 rounded-xl text-civic-primary border border-civic-primary/15">
              <MessageSquare className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-civic-darkest leading-none">Community Chat Board</h1>
              <p className="text-[10px] font-mono text-civic-darkest/60 mt-1 uppercase tracking-wider">
                District: <b className="text-civic-primary">#{currentCommunity?.name.replace(/\s+/g, '-').toLowerCase()}</b>
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsShareModalOpen(true)}
          className="neumorph-out-sm neumorph-out-hover px-4 py-2 rounded-xl text-xs font-bold text-civic-primary border border-white/50 flex items-center space-x-1.5 cursor-pointer"
        >
          <span>Share Issue Card</span>
        </button>
      </div>

      {/* Moderation Error Banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 text-red-900 px-6 py-3.5 flex items-start space-x-2.5 text-xs animate-slide-down shrink-0">
          <ShieldAlert className="h-4.5 w-4.5 text-red-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Chat Moderation Notice</span>
            <span className="opacity-80 block">{error}</span>
          </div>
        </div>
      )}

      {/* Message List Area */}
      <div className="flex-grow overflow-y-auto p-6 space-y-5 custom-scrollbar bg-gradient-to-b from-[#cad2c5]/10 to-transparent">
        
        {/* Help Info Box with subtle Glassmorphism */}
        <div className="max-w-md mx-auto glass-light p-4.5 rounded-2xl border border-white/40 text-center space-y-2 text-xs text-civic-darkest/75 shadow-sm">
          <div className="bg-civic-primary/15 p-1.5 rounded-lg inline-block text-civic-primary border border-civic-primary/25">
            <Sparkles className="h-4.5 w-4.5 animate-spin" />
          </div>
          <h4 className="font-display font-bold text-sm text-civic-darkest">Live AI Moderation Protocol Active</h4>
          <p className="leading-relaxed text-[10px] text-civic-darkest/70">
            Messages are analyzed real-time by Gemini models to keep neighbor discussions safe, constructive, and focused on local utility and safety updates.
          </p>
        </div>

        {chatMessages.length === 0 ? (
          <div className="text-center py-20 text-civic-darkest/45 text-xs font-medium">
            No messages recorded in this channel. Be the first to start the neighborhood discussion!
          </div>
        ) : (
          chatMessages.map((msg) => {
            const isMe = msg.uid === userProfile?.uid;

            return (
              <div 
                key={msg.id} 
                className={`flex items-start space-x-3 max-w-xl ${isMe ? 'ml-auto flex-row-reverse space-x-reverse' : 'mr-auto'}`}
              >
                {/* Avatar with subtle border highlight */}
                <UserAvatar src={msg.userPhotoURL} name={msg.userName} className="w-8.5 h-8.5 mt-0.5" />

                {/* Message Bubble Body */}
                <div className="space-y-1">
                  {/* Sender details */}
                  <div className={`flex items-center space-x-2 text-[10px] ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <span className="font-bold text-civic-darkest/80">{msg.userName}</span>
                    <span className="text-civic-darkest/40 font-mono">
                      {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>

                  {/* Bubble text with hybrid styling */}
                  {msg.type === 'issueShare' ? (
                    <div 
                      onClick={() => msg.linkedIssueId && onNavigateToIssue(msg.linkedIssueId)}
                      className="neumorph-out p-4.5 rounded-2xl border border-white hover:border-civic-accent cursor-pointer transition-all duration-300 text-left max-w-sm"
                    >
                      <span className="text-[9px] font-bold text-civic-primary uppercase block mb-1 tracking-wider">📢 SHARED HAZARD REPORT</span>
                      <h4 className="font-display font-bold text-sm text-civic-darkest line-clamp-1">{msg.linkedIssueTitle}</h4>
                      <div className="flex items-center justify-between text-[10px] text-civic-primary/90 mt-2.5 font-bold uppercase tracking-wider">
                        <span>Inspect circular detail</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  ) : (
                    <div 
                      className={`px-4.5 py-3 rounded-2xl text-xs leading-relaxed ${
                        isMe 
                          ? 'bg-civic-primary text-white rounded-tr-none shadow-md border-b-2 border-civic-primary/30' 
                          : 'bg-white/80 text-civic-darkest border border-white/60 rounded-tl-none shadow-sm'
                      }`}
                    >
                      {msg.text}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        <div ref={threadEndRef} />
      </div>

      {/* Input Form Footer - Neumorphic alignment */}
      <form onSubmit={handleSend} className="bg-white/30 backdrop-blur-md px-6 py-4.5 border-t border-civic-primary/10 flex space-x-3 items-center shrink-0 z-10">
        <input
          type="text"
          placeholder={userProfile ? "Broadcast moderated message..." : "Onboard to join discussion..."}
          disabled={!userProfile || loading}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="flex-1 px-4.5 py-3 bg-[#c2cbbe] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-civic-primary text-civic-darkest neumorph-in border-0"
        />
        <button
          type="submit"
          disabled={!userProfile || !inputText.trim() || loading}
          className="bg-civic-primary hover:bg-civic-dark text-white p-3 rounded-xl disabled:bg-[#cad2c5]/50 disabled:text-civic-darkest/40 transition duration-300 shadow-md flex items-center justify-center cursor-pointer"
        >
          <Send className="h-4.5 w-4.5" />
        </button>
      </form>

      {/* Issue share selection dialog - Glassmorphic overlay */}
      {isShareModalOpen && (
        <div className="fixed inset-0 bg-civic-darkest/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-light p-6.5 rounded-3xl border border-white max-w-md w-full shadow-2xl space-y-5 animate-scale-up">
            <div className="flex justify-between items-center pb-2.5 border-b border-civic-primary/10">
              <h3 className="font-display font-bold text-md text-civic-darkest">Select Community Report</h3>
              <button 
                onClick={() => setIsShareModalOpen(false)}
                className="text-civic-darkest/60 hover:text-civic-darkest text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
              {issues.length === 0 ? (
                <div className="text-center py-8 text-xs text-civic-darkest/40">
                  No issues registered yet to share.
                </div>
              ) : (
                issues.map(i => (
                  <div 
                    key={i.id}
                    onClick={() => handleShareIssue(i)}
                    className="p-3.5 bg-white/40 hover:bg-white/80 border border-white/50 rounded-xl cursor-pointer transition duration-200 text-left hover:scale-[1.01]"
                  >
                    <span className="text-[9px] font-bold text-civic-primary uppercase block mb-0.5 tracking-wider">{i.category}</span>
                    <h5 className="font-bold text-xs text-civic-darkest truncate">{i.title}</h5>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
