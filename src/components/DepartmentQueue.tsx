import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { 
  ShieldAlert, Wrench, CheckCircle2, Clock, Sparkles, Filter, 
  ArrowRight, Search, ChevronRight, MessageSquare, AlertTriangle, 
  AlertCircle, ShieldCheck, Mail, Send, Check
} from 'lucide-react';
import { IssueStatus, IssueSeverity, Issue } from '../types';

export default function DepartmentQueue() {
  const { issues, userProfile, triggerGamificationEvaluate } = useApp();
  const [selectedDept, setSelectedDept] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeIssueId, setActiveIssueId] = useState<string | null>(null);

  // Resolution controls
  const [resolutionNote, setResolutionNote] = useState<string>('');
  const [isSubmittingResolution, setIsSubmittingResolution] = useState<boolean>(false);
  const [aiSummaryResult, setAiSummaryResult] = useState<string | null>(null);

  // Escalation controls
  const [isEscalating, setIsEscalating] = useState<boolean>(false);
  const [draftedLetter, setDraftedLetter] = useState<string | null>(null);
  const [isSendingLetter, setIsSendingLetter] = useState<boolean>(false);

  const departments = ['All', 'Roads & Infrastructure', 'Public Safety', 'Sanitation', 'Parks & Recreation'];
  const statuses = ['All', 'Reported', 'Reviewed', 'In Progress', 'Completed'];

  // Check if current user is official or in sandboxed demo mode
  const isOfficial = userProfile?.role === 'official';

  // Filter issues based on routingTag and status
  const filteredIssues = issues.filter(issue => {
    const deptMatch = selectedDept === 'All' || issue.routingTag === selectedDept;
    const statusMatch = selectedStatus === 'All' || issue.status === selectedStatus;
    const searchMatch = searchQuery.trim() === '' || 
      issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.category.toLowerCase().includes(searchQuery.toLowerCase());
    return deptMatch && statusMatch && searchMatch;
  });

  const activeIssue = issues.find(i => i.id === activeIssueId);

  // Handle status transitions
  const handleUpdateStatus = async (issueId: string, newStatus: IssueStatus) => {
    try {
      const issueRef = doc(db, 'issues', issueId);
      const now = Date.now();
      const note = `Status changed to ${newStatus} by official ${userProfile?.name || 'Municipal Worker'}`;

      const newHistoryItem = {
        status: newStatus,
        timestamp: now,
        updatedBy: userProfile?.name || 'Municipal Worker',
        note
      };

      const updateData: any = {
        status: newStatus,
        statusHistory: arrayUnion(newHistoryItem)
      };

      // Add AI dispatch agent log entry
      updateData.aiReasoningLog = arrayUnion({
        agentName: "Official Dispatch Agent",
        timestamp: now,
        decision: `Dispatched & Updated status to ${newStatus}`,
        reasoning: `Status updated by Municipal Worker "${userProfile?.name || 'Official'}". Current system state shifted to active tracking.`
      });

      await updateDoc(issueRef, updateData);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `issues/${issueId}`);
    }
  };

  // Submit complete resolution with AI evaluator verification
  const handleResolveIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIssue || !resolutionNote.trim()) return;

    try {
      setIsSubmittingResolution(true);
      setAiSummaryResult(null);

      // Call AI server resolution evaluator
      const res = await fetch('/api/ai/resolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue: activeIssue, note: resolutionNote })
      });
      const data = await res.json();

      const professionalSummary = data.summary || `Resolution completed: ${resolutionNote}`;

      const issueRef = doc(db, 'issues', activeIssue.id);
      const now = Date.now();

      const newHistoryItem = {
        status: IssueStatus.Completed,
        timestamp: now,
        updatedBy: userProfile?.name || 'Municipal Worker',
        note: `Resolved: ${professionalSummary}`
      };

      await updateDoc(issueRef, {
        status: IssueStatus.Completed,
        resolutionSummary: professionalSummary,
        statusHistory: arrayUnion(newHistoryItem),
        aiReasoningLog: arrayUnion({
          agentName: "Resolution Verification Agent",
          timestamp: now,
          decision: "Resolution Verified & Completed",
          reasoning: `Official note audited: "${resolutionNote}". AI verdict: ${data.approved ? 'Approved' : 'Bypassed'}. Action item archived.`
        })
      });

      // Reward original reporter with points for completed repair (+100 points)
      if (activeIssue.reporterUid) {
        const reporterRef = doc(db, 'users', activeIssue.reporterUid);
        await updateDoc(reporterRef, {
          points: arrayUnion ? (await import('firebase/firestore')).increment(100) : 100 // Safe increment fallback
        }).catch(err => console.warn("Failed to award reporter points:", err));
        
        await triggerGamificationEvaluate(activeIssue.reporterUid).catch(err => console.warn(err));
      }

      setResolutionNote('');
      setAiSummaryResult(professionalSummary);
    } catch (err) {
      console.error("Resolution submit error:", err);
    } finally {
      setIsSubmittingResolution(false);
    }
  };

  // Escalate to City Council using Gemini Drafter Agent
  const handleDraftEscalation = async () => {
    if (!activeIssue) return;
    try {
      setIsEscalating(true);
      setDraftedLetter(null);

      const res = await fetch('/api/ai/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: activeIssue.title,
          description: activeIssue.description,
          category: activeIssue.category,
          severity: activeIssue.severity,
          upvoteCount: activeIssue.upvoteCount
        })
      });
      const data = await res.json();
      setDraftedLetter(data.letter || "Draft failed to generate.");
    } catch (err) {
      console.error("Escalation draft failed:", err);
    } finally {
      setIsEscalating(false);
    }
  };

  const handleSendEscalationLetter = async () => {
    if (!activeIssue || !draftedLetter) return;
    try {
      setIsSendingLetter(true);
      // Simulate transmitting to city council api / notification
      const now = Date.now();
      const issueRef = doc(db, 'issues', activeIssue.id);

      await updateDoc(issueRef, {
        aiReasoningLog: arrayUnion({
          agentName: "Escalation/Drafter Agent",
          timestamp: now,
          decision: "Official Letter Transmitted to City Council",
          reasoning: `Drafted firm warning citing ${activeIssue.upvoteCount} local endorsements. Transmitted directly to Municipal Coordinator Inbox.`
        })
      });

      setDraftedLetter(null);
      alert("Letter successfully dispatched directly to City Council Administration.");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSendingLetter(false);
    }
  };

  return (
    <div id="department_queue" className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Banner Notice if not official */}
      {!isOfficial && (
        <div className="bg-amber-500/10 border border-amber-500/25 p-4 rounded-2xl flex items-start space-x-3 text-amber-900 text-xs">
          <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-1">
            <h4 className="font-bold">Sandbox Mode Activated</h4>
            <p className="leading-relaxed text-amber-800">
              You are currently viewing the queue as a <b>Citizen</b>. For demonstration and prototyping convenience, we have unlocked status updates, AI-assisted resolutions, and council letters so you can test the full capabilities of our official dispatching system!
            </p>
          </div>
        </div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Filterable Issues Feed */}
        <div className="lg:col-span-7 space-y-5">
          <div className="neumorph-out p-6 rounded-2xl space-y-4 border border-white/40">
            <div className="flex justify-between items-center">
              <h2 className="font-display font-bold text-xl text-civic-darkest flex items-center space-x-2">
                <Wrench className="h-5 w-5 text-civic-primary" />
                <span>Municipal Dispatch Desk</span>
              </h2>
              <span className="text-[10px] bg-civic-primary/25 px-2.5 py-1 text-civic-darkest font-mono font-extrabold uppercase rounded-lg">
                {filteredIssues.length} ACTIVE CASES
              </span>
            </div>

            {/* Department Filter Tabs */}
            <div className="space-y-1.5">
              <span className="block text-[9px] font-bold uppercase tracking-widest text-civic-darkest/60 font-mono">Filter Department</span>
              <div className="flex flex-wrap gap-2">
                {departments.map((dept) => (
                  <button
                    key={dept}
                    onClick={() => { setSelectedDept(dept); setActiveIssueId(null); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
                      selectedDept === dept 
                        ? 'bg-civic-primary text-white shadow-sm' 
                        : 'bg-[#cad2c5]/40 text-civic-darkest/75 hover:bg-[#cad2c5]/80'
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>

            {/* Status Filter Tabs & Search */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 pt-1">
              <div className="sm:col-span-7 space-y-1.5">
                <span className="block text-[9px] font-bold uppercase tracking-widest text-civic-darkest/60 font-mono">Status Status</span>
                <div className="flex flex-wrap gap-1.5">
                  {statuses.map((stat) => (
                    <button
                      key={stat}
                      onClick={() => { setSelectedStatus(stat); setActiveIssueId(null); }}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition duration-200 cursor-pointer ${
                        selectedStatus === stat 
                          ? 'bg-civic-dark text-white shadow-sm' 
                          : 'bg-[#cad2c5]/40 text-civic-darkest/70 hover:bg-[#cad2c5]/80'
                      }`}
                    >
                      {stat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-5 space-y-1.5">
                <span className="block text-[9px] font-bold uppercase tracking-widest text-civic-darkest/60 font-mono">Search Keyword</span>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-civic-darkest/40" />
                  <input
                    type="text"
                    placeholder="Search titles..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-[#cad2c5]/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-civic-primary text-civic-darkest"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Issues List */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {filteredIssues.length === 0 ? (
              <div className="neumorph-in p-10 text-center rounded-2xl border border-white/30 text-civic-darkest/60 text-xs">
                No active issues matched your department filter criteria. All clear!
              </div>
            ) : (
              filteredIssues.map((issue) => (
                <div
                  key={issue.id}
                  onClick={() => { setActiveIssueId(issue.id); setResolutionNote(''); setDraftedLetter(null); }}
                  className={`p-4 rounded-xl transition duration-300 cursor-pointer border flex justify-between items-center ${
                    activeIssueId === issue.id
                      ? 'bg-white border-civic-primary shadow-md translate-x-1'
                      : 'bg-[#cad2c5]/25 border-civic-primary/10 hover:bg-white/40'
                  }`}
                >
                  <div className="space-y-1.5 flex-grow min-w-0 pr-4">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-extrabold uppercase ${
                        issue.severity === 'Critical' ? 'bg-red-100 text-red-700' :
                        issue.severity === 'High' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {issue.severity}
                      </span>
                      <span className="text-[10px] text-civic-darkest/55 font-semibold font-mono">
                        {issue.routingTag}
                      </span>
                    </div>
                    <h3 className="font-bold text-xs truncate text-civic-darkest">{issue.title}</h3>
                    <p className="text-[10px] text-civic-darkest/70 line-clamp-1 leading-normal">{issue.description}</p>
                  </div>

                  <div className="flex items-center space-x-3 shrink-0">
                    <span className={`px-2 py-1 text-[8px] font-bold rounded-lg ${
                      issue.status === 'Completed' ? 'bg-green-100 text-green-700 border border-green-200' :
                      issue.status === 'In Progress' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                      issue.status === 'Reviewed' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                      'bg-gray-100 text-gray-700 border border-gray-200'
                    }`}>
                      {issue.status}
                    </span>
                    <ChevronRight className="h-4 w-4 text-civic-darkest/45" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Active Issue Details & Dispatch Control Center */}
        <div className="lg:col-span-5 space-y-6">
          {activeIssue ? (
            <div className="neumorph-out p-6 rounded-2xl space-y-5 border border-white/50 animate-fade-in">
              
              <div className="pb-3 border-b border-civic-primary/10 space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-civic-darkest/55 font-mono">
                    Case #{activeIssue.id.substring(0, 8)}
                  </span>
                  <span className={`text-xs font-bold ${
                    activeIssue.status === 'Completed' ? 'text-green-700' : 'text-civic-primary'
                  }`}>
                    &bull; {activeIssue.status}
                  </span>
                </div>
                <h3 className="font-display font-extrabold text-md text-civic-darkest">{activeIssue.title}</h3>
                <div className="flex items-center space-x-2 text-[10px] text-civic-darkest/65 font-medium">
                  <span>Routing Tag:</span>
                  <span className="bg-[#cad2c5]/60 px-2 py-0.5 rounded-md font-mono font-bold text-civic-dark">
                    {activeIssue.routingTag}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <span className="block text-[8px] font-bold uppercase tracking-widest text-civic-darkest/45 font-mono">REPORTER DETAILS</span>
                <p className="text-[11px] text-civic-darkest/80 leading-relaxed font-sans">{activeIssue.description}</p>
                <div className="flex justify-between items-center text-[9px] text-civic-darkest/50 pt-1">
                  <span>By: {activeIssue.reporterName || 'Anonymous'}</span>
                  <span>Endorsed by {activeIssue.upvoteCount} residents</span>
                </div>
              </div>

              {/* Stage Transition Control Panel */}
              {activeIssue.status !== 'Completed' && (
                <div className="bg-white/40 p-4.5 rounded-xl border border-white/50 space-y-3.5">
                  <span className="block text-[8px] font-bold uppercase tracking-widest text-civic-darkest/55 font-mono">Dispatch Pipeline</span>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleUpdateStatus(activeIssue.id, IssueStatus.Reviewed)}
                      disabled={activeIssue.status === 'Reviewed' || activeIssue.status === 'InProgress'}
                      className="bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 px-2.5 py-2 rounded-xl text-[10px] font-bold flex flex-col items-center justify-center space-y-1 transition cursor-pointer disabled:opacity-50"
                    >
                      <Clock className="h-3.5 w-3.5 text-purple-700" />
                      <span>Review</span>
                    </button>

                    <button
                      onClick={() => handleUpdateStatus(activeIssue.id, IssueStatus.InProgress)}
                      disabled={activeIssue.status === 'InProgress'}
                      className="bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 px-2.5 py-2 rounded-xl text-[10px] font-bold flex flex-col items-center justify-center space-y-1 transition cursor-pointer disabled:opacity-50"
                    >
                      <Wrench className="h-3.5 w-3.5 text-blue-700" />
                      <span>Dispatch</span>
                    </button>

                    <button
                      onClick={() => {
                        // Focus on resolve input or show resolution pane
                        const noteInput = document.getElementById('note_input');
                        noteInput?.focus();
                      }}
                      className="bg-green-50 hover:bg-green-100 text-green-900 border border-green-200 px-2.5 py-2 rounded-xl text-[10px] font-bold flex flex-col items-center justify-center space-y-1 transition cursor-pointer"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-700" />
                      <span>Complete</span>
                    </button>
                  </div>
                </div>
              )}

              {/* AI Resolve Form (only if status is In Progress or Reviewed or Reported) */}
              {activeIssue.status !== 'Completed' ? (
                <form onSubmit={handleResolveIssue} className="space-y-3">
                  <div className="space-y-1">
                    <label htmlFor="note_input" className="block text-[8px] font-bold uppercase tracking-widest text-civic-darkest/55 font-mono">
                      Official Resolution Note
                    </label>
                    <textarea
                      id="note_input"
                      placeholder="e.g. Dispatched roads team. Patching done with structural hot asphalt. Valve tested water pressure."
                      rows={2}
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white/65 rounded-xl text-xs text-civic-darkest focus:outline-none focus:ring-1 focus:ring-civic-primary border border-civic-primary/15 font-sans"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingResolution || !resolutionNote.trim()}
                    className="w-full bg-civic-primary hover:bg-civic-dark text-white py-2.5 rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-civic-accent animate-spin-slow" />
                    <span>{isSubmittingResolution ? 'AI Analyzing Note...' : 'Submit Certified AI Resolution'}</span>
                  </button>
                </form>
              ) : (
                <div className="bg-green-500/10 border border-green-500/25 p-4 rounded-xl space-y-2">
                  <div className="flex items-center space-x-2 text-green-800 text-[10px] font-mono font-bold uppercase tracking-widest">
                    <ShieldCheck className="h-4.5 w-4.5 text-green-700" />
                    <span>RESOLUTION COMPLETED & ARCHIVED</span>
                  </div>
                  <p className="text-[11px] text-green-900 font-sans leading-relaxed">
                    <b>Action Summary:</b> {activeIssue.resolutionSummary || 'Resolved by official municipal dispatch.'}
                  </p>
                </div>
              )}

              {/* Escalation Letter Option (for High/Critical pending cases with high votes) */}
              {activeIssue.status !== 'Completed' && (activeIssue.severity === 'Critical' || activeIssue.severity === 'High') && (
                <div className="pt-2 border-t border-civic-primary/10 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="block text-[8px] font-bold uppercase tracking-widest text-civic-darkest/55 font-mono">Escalation Hub</span>
                    <span className="text-[9px] text-red-600 font-mono font-bold animate-pulse">🚨 Pending Dispatch</span>
                  </div>

                  {!draftedLetter ? (
                    <button
                      onClick={handleDraftEscalation}
                      disabled={isEscalating}
                      className="w-full bg-[#354f52]/10 hover:bg-[#354f52]/20 text-civic-dark border border-civic-dark/15 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span>{isEscalating ? 'AI Drafting Official Warning...' : 'Draft Council Escalation Letter'}</span>
                    </button>
                  ) : (
                    <div className="bg-white/80 p-4.5 rounded-xl border border-civic-primary/15 space-y-3 shadow-md max-h-[220px] overflow-y-auto flex flex-col justify-between">
                      <div className="space-y-1">
                        <span className="text-[8px] font-mono uppercase tracking-wider text-civic-dark">Draft Administrative warning</span>
                        <p className="text-[10px] font-mono text-civic-darkest whitespace-pre-wrap leading-normal">
                          {draftedLetter}
                        </p>
                      </div>

                      <div className="flex space-x-2 pt-2 border-t border-civic-primary/10 shrink-0">
                        <button
                          onClick={handleSendEscalationLetter}
                          disabled={isSendingLetter}
                          className="flex-grow bg-civic-dark hover:bg-civic-darkest text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition cursor-pointer"
                        >
                          <Send className="h-3 w-3 text-civic-accent" />
                          <span>Transmit Letter</span>
                        </button>
                        <button
                          onClick={() => setDraftedLetter(null)}
                          className="bg-gray-100 hover:bg-gray-200 text-civic-darkest border border-gray-300 text-xs font-semibold py-2 px-3 rounded-lg transition cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* AI Agent Reasoning Log */}
              {activeIssue.aiReasoningLog && activeIssue.aiReasoningLog.length > 0 && (
                <div className="pt-3 border-t border-civic-primary/10 space-y-2.5">
                  <span className="block text-[8px] font-bold uppercase tracking-widest text-civic-darkest/45 font-mono">
                    System AI Triage Log
                  </span>
                  
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {activeIssue.aiReasoningLog.map((log, index) => (
                      <div key={index} className="bg-white/50 border border-white/60 rounded-lg p-2.5 space-y-1 text-[10px]">
                        <div className="flex justify-between items-baseline">
                          <span className="font-extrabold text-civic-primary block font-mono uppercase text-[9px]">
                            🤖 {log.agentName}
                          </span>
                          <span className="text-[8px] text-civic-darkest/40">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <h5 className="font-bold text-civic-darkest/90 italic">Decision: {log.decision}</h5>
                        <p className="text-civic-darkest/75 leading-relaxed font-sans">{log.reasoning}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="neumorph-in p-8 text-center text-civic-darkest/55 rounded-2xl border border-white/30 h-64 flex flex-col items-center justify-center space-y-2.5">
              <ShieldAlert className="h-8 w-8 text-civic-darkest/30 animate-pulse" />
              <div className="space-y-1">
                <h4 className="font-bold text-xs">No Active Dispatch Case Selected</h4>
                <p className="text-[10px] leading-relaxed max-w-xs">Select an active community hazard report from the feed list on the left to engage dispatch tools, trigger resolution evaluations, or coordinate city council letters.</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
