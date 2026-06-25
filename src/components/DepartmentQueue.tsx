import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Issue, IssueStatus, IssueSeverity } from '../types';
import { doc, updateDoc, arrayUnion, increment, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Shield, Sparkles, Key, Check } from 'lucide-react';

export default function DepartmentQueue() {
  const { currentCommunity, issues, createNotification, triggerGamificationEvaluate } = useApp();

  // Gate state
  const [passcode, setPasscode] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Workflow states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [completingIssue, setCompletingIssue] = useState<Issue | null>(null);
  const [completionActionText, setCompletionActionText] = useState('');

  // Handle Passcode Unlock
  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (passcode === 'CIVIC2026') {
      setIsAuthorized(true);
    } else {
      setAuthError("Incorrect official passcode. Try 'CIVIC2026' to proceed.");
    }
  };

  // Move status to Reviewed or In Progress
  const handleMoveStatus = async (issue: Issue, nextStatus: IssueStatus) => {
    setActionLoading(issue.id);
    try {
      const issueRef = doc(db, 'issues', issue.id);
      
      const updateData = {
        status: nextStatus,
        statusHistory: arrayUnion({
          status: nextStatus,
          timestamp: Date.now(),
          updatedBy: "Municipal Department Coordinator"
        }),
        aiReasoningLog: arrayUnion({
          agentName: "Official Pipeline Agent",
          timestamp: Date.now(),
          decision: `Advanced status to ${nextStatus}`,
          reasoning: `Status officially updated by authorized department worker.`
        })
      };

      await updateDoc(issueRef, updateData);

      // Notify original reporter
      await createNotification(
        issue.reporterUid,
        issue.communityId,
        "Issue Status Update",
        `Your reported issue "${issue.title}" is now "${nextStatus}"!`,
        "issue_update",
        issue.id
      );

      // Notify all upvoters
      if (issue.upvoterUids && issue.upvoterUids.length > 0) {
        for (const uid of issue.upvoterUids) {
          await createNotification(
            uid,
            issue.communityId,
            "Watched Issue Updated",
            `An issue you verified ("${issue.title}") is now "${nextStatus}"!`,
            "issue_update",
            issue.id
          );
        }
      }
    } catch (err) {
      console.error("Status transition failed:", err);
      handleFirestoreError(err, OperationType.UPDATE, `issues/${issue.id}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Submit Completion and Trigger Resolution AI Agent
  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingIssue || !completionActionText.trim()) return;

    const issueId = completingIssue.id;
    setActionLoading(issueId);
    setCompletingIssue(null);

    try {
      // Call Resolution Agent API
      const res = await fetch('/api/ai/resolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: completingIssue.title,
          category: completingIssue.category,
          description: completingIssue.description,
          actionTaken: completionActionText
        })
      });

      const data = await res.json();
      const resolutionSummary = data.summary;

      const issueRef = doc(db, 'issues', issueId);
      
      // Update issue with completion state
      await updateDoc(issueRef, {
        status: IssueStatus.Completed,
        resolutionSummary,
        statusHistory: arrayUnion({
          status: IssueStatus.Completed,
          timestamp: Date.now(),
          updatedBy: "Municipal Repair Crew Leader",
          note: completionActionText
        }),
        aiReasoningLog: arrayUnion({
          agentName: "Resolution Agent",
          timestamp: Date.now(),
          decision: "Filed Citizen Resolution Note",
          reasoning: `AI Agent drafted summary: "${resolutionSummary}"`
        })
      });

      // Award Points to the original reporter (+100 pts on completion)
      const reporterRef = doc(db, 'users', completingIssue.reporterUid);
      const repSnap = await getDoc(reporterRef);
      if (repSnap.exists()) {
        const badgesToAdd: string[] = [];
        const repData = repSnap.data();
        if (repData.badges && !repData.badges.includes('neighborhood_hero')) {
          badgesToAdd.push('neighborhood_hero');
        }

        await updateDoc(reporterRef, {
          points: increment(100), // 100 bonus points on resolve
          ...(badgesToAdd.length > 0 ? { badges: arrayUnion(...badgesToAdd) } : {})
        });
      }

      // Award Points to all upvoters (+20 pts on completion)
      if (completingIssue.upvoterUids && completingIssue.upvoterUids.length > 0) {
        for (const uid of completingIssue.upvoterUids) {
          const voterRef = doc(db, 'users', uid);
          await updateDoc(voterRef, {
            points: increment(20) // 20 pts bonus on resolve
          });
        }
      }

      // Notify original reporter
      await createNotification(
        completingIssue.reporterUid,
        completingIssue.communityId,
        "Issue Resolved! 🎉",
        `Your reported issue "${completingIssue.title}" has been successfully resolved! You earned +100 Points!`,
        "issue_update",
        completingIssue.id
      );

      // Notify all upvoters
      if (completingIssue.upvoterUids && completingIssue.upvoterUids.length > 0) {
        for (const uid of completingIssue.upvoterUids) {
          await createNotification(
            uid,
            completingIssue.communityId,
            "Issue Resolved! 🎉",
            `An issue you verified ("${completingIssue.title}") has been resolved! You earned +20 Points!`,
            "issue_update",
            completingIssue.id
          );
        }
      }

      // Trigger gamification evaluations on the server for all involved users
      await triggerGamificationEvaluate(completingIssue.reporterUid);
      if (completingIssue.upvoterUids && completingIssue.upvoterUids.length > 0) {
        for (const uid of completingIssue.upvoterUids) {
          await triggerGamificationEvaluate(uid);
        }
      }

      setCompletionActionText('');
    } catch (err) {
      console.error("Resolution agent failed:", err);
      handleFirestoreError(err, OperationType.UPDATE, `issues/${issueId}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Sort queue by priority score (Critical > High > Medium > Low) and then by open date
  const getSeverityPriority = (sev: IssueSeverity) => {
    switch (sev) {
      case IssueSeverity.Critical: return 4;
      case IssueSeverity.High: return 3;
      case IssueSeverity.Medium: return 2;
      case IssueSeverity.Low: return 1;
      default: return 1;
    }
  };

  const queueIssues = [...issues].sort((a, b) => {
    const prioA = getSeverityPriority(a.severity);
    const prioB = getSeverityPriority(b.severity);
    if (prioB !== prioA) {
      return prioB - prioA; // higher priority first
    }
    return a.createdAt - b.createdAt; // older first
  });

  // Gated Access Screen
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-civic-light/30 flex items-center justify-center p-4">
        <form onSubmit={handleUnlock} className="glass-light p-8 rounded-3xl border border-white shadow-lg max-w-sm w-full space-y-5 text-center">
          <div className="bg-civic-darkest p-3.5 rounded-full inline-block text-white shadow">
            <Key className="h-6 w-6 text-civic-accent" />
          </div>

          <div className="space-y-1 pt-1">
            <h1 className="font-display font-bold text-xl text-civic-darkest tracking-tight">Staff Administration</h1>
            <p className="text-xs text-civic-darkest/60 leading-relaxed font-medium">
              Access the official municipal priority queue dashboard. Enter the credentials code below.
            </p>
          </div>

          {authError && (
            <div className="bg-red-50 border border-red-200 text-red-900 rounded-xl p-3 text-xs">
              {authError}
            </div>
          )}

          <div className="space-y-3 pt-2">
            <input
              type="password"
              placeholder="Enter passcode (e.g. CIVIC2026)"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="w-full text-center px-4 py-3.5 bg-[#c2cbbe] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-civic-primary text-civic-darkest neumorph-in border-0"
            />
            <button
              type="submit"
              className="w-full bg-civic-primary hover:bg-civic-dark text-white py-3.5 rounded-xl text-xs font-bold transition duration-300 shadow hover:scale-[1.01] cursor-pointer"
            >
              Verify Credentials
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Severity BG color helpers
  const getSeverityStyles = (sev: IssueSeverity): string => {
    switch (sev) {
      case IssueSeverity.Low: return 'bg-[#84a98c]/20 text-[#2f3e46] border-[#84a98c]/30';
      case IssueSeverity.Medium: return 'bg-[#52796f]/20 text-[#2f3e46] border-[#52796f]/30';
      case IssueSeverity.High: return 'bg-amber-100 text-amber-800 border-amber-200';
      case IssueSeverity.Critical: return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div id="department_queue_view" className="p-4 md:p-8 space-y-6 bg-civic-light/30 min-h-screen selection:bg-civic-accent selection:text-civic-darkest">
      
      {/* Title Header with Glassmorphism */}
      <div className="glass-light p-5.5 rounded-3xl border border-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center space-y-3 md:space-y-0">
        <div>
          <div className="flex items-center space-x-2.5">
            <Shield className="h-5 w-5 text-civic-primary" />
            <h1 className="font-display font-bold text-2xl text-civic-darkest tracking-tight">Staff Priority Dispatch Console</h1>
          </div>
          <p className="text-xs text-civic-darkest/65 mt-1 font-medium">
            Active Community: <span className="text-civic-primary font-bold">{currentCommunity?.name}</span> • Unresolved reports queue: <span className="font-bold">{queueIssues.filter(i => i.status !== IssueStatus.Completed).length}</span>
          </p>
        </div>

        <span className="bg-green-100 text-green-800 text-[10px] uppercase font-bold tracking-wider px-3.5 py-1.5 rounded-lg border border-green-200 shadow-sm font-mono">
          Authorized Session
        </span>
      </div>

      {/* Completion Dialog Overlay with high fidelity glass blurring */}
      {completingIssue && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <form onSubmit={handleCompleteSubmit} className="glass-light p-6 rounded-3xl border border-white max-w-md w-full shadow-xl space-y-4">
            <div className="flex justify-between items-center pb-2.5 border-b border-civic-primary/10">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-4.5 w-4.5 text-civic-primary animate-pulse" />
                <h3 className="font-display font-bold text-md text-civic-darkest">Complete Task Resolution</h3>
              </div>
              <button 
                type="button"
                onClick={() => setCompletingIssue(null)}
                className="text-civic-darkest/60 hover:text-civic-darkest text-xs font-bold uppercase tracking-wider cursor-pointer font-mono"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-4 pt-1">
              <div className="text-xs text-civic-darkest/75 leading-relaxed font-medium">
                Reporting issue completion triggers our <b>Resolution Agent</b> to auto-draft public repair summaries and distributes reward points to citizens.
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-civic-darkest/75 mb-1.5 font-mono">Technical Dispatch notes</label>
                <textarea
                  placeholder="e.g. Dispatched roads crew. Filled pothole with 400kg asphalt compound."
                  rows={4}
                  required
                  value={completionActionText}
                  onChange={(e) => setCompletionActionText(e.target.value)}
                  className="w-full p-3.5 bg-[#c2cbbe] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-civic-primary text-civic-darkest leading-relaxed border-0 neumorph-in"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-civic-primary hover:bg-civic-dark text-white py-3.5 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer border border-white/10 hover:scale-[1.01]"
            >
              Confirm Task Resolution
            </button>
          </form>
        </div>
      )}

      {/* Main Queue Workspace */}
      <div className="glass-light rounded-3xl border border-white shadow-md overflow-hidden">
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            
            <thead>
              <tr className="bg-[#c2cbbe]/30 border-b border-civic-primary/10 text-civic-darkest/75 uppercase font-bold text-[9px] tracking-widest font-mono">
                <th className="p-4.5">Report specifications</th>
                <th className="p-4.5">Severity</th>
                <th className="p-4.5">Category</th>
                <th className="p-4.5">Status</th>
                <th className="p-4.5">Verifications</th>
                <th className="p-4.5 text-right">Workflow actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 bg-white/20">
              {queueIssues.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-civic-darkest/50 font-bold font-mono text-xs uppercase tracking-wider">
                    All local reports completed! Clean standing.
                  </td>
                </tr>
              ) : (
                queueIssues.map((issue) => {
                  const isCompleted = issue.status === IssueStatus.Completed;

                  return (
                    <tr key={issue.id} className={`hover:bg-white/45 transition duration-200 ${isCompleted ? 'opacity-60 bg-gray-50/30' : ''}`}>
                      
                      {/* Title description */}
                      <td className="p-4.5 space-y-1 max-w-[250px]">
                        <span className="font-bold text-civic-darkest block text-sm leading-tight">{issue.title}</span>
                        <span className="text-[11px] text-civic-darkest/75 block line-clamp-1 leading-normal font-medium">{issue.description}</span>
                        <span className="text-[9px] text-civic-darkest/50 block font-mono font-bold">FILED: {new Date(issue.createdAt).toLocaleDateString()}</span>
                      </td>

                      {/* Severity indicator */}
                      <td className="p-4.5">
                        <span className={`px-2.5 py-1 rounded-md font-bold text-[9px] uppercase tracking-wider border shadow-sm ${getSeverityStyles(issue.severity)}`}>
                          {issue.severity}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="p-4.5 font-mono font-bold text-civic-primary uppercase tracking-wider">
                        {issue.category}
                      </td>

                      {/* Status */}
                      <td className="p-4.5">
                        <span className="font-mono font-bold uppercase text-[9px] text-civic-darkest/70 bg-white/60 border border-white px-2.5 py-1 rounded shadow-inner">
                          {issue.status}
                        </span>
                      </td>

                      {/* Verifications count */}
                      <td className="p-4.5 font-mono text-xs font-bold text-civic-dark">
                        {issue.upvoteCount} votes
                      </td>

                      {/* Workflow transition actions */}
                      <td className="p-4.5 text-right">
                        <div className="flex justify-end space-x-2">
                          
                          {issue.status === IssueStatus.Reported && (
                            <button
                              disabled={actionLoading === issue.id}
                              onClick={() => handleMoveStatus(issue, IssueStatus.Reviewed)}
                              className="bg-transparent hover:bg-civic-primary/10 text-civic-primary border border-civic-primary/25 px-3 py-1.5 rounded-lg text-[9px] font-bold tracking-wider uppercase font-mono transition cursor-pointer"
                            >
                              Reviewed
                            </button>
                          )}

                          {(issue.status === IssueStatus.Reported || issue.status === IssueStatus.Reviewed) && (
                            <button
                              disabled={actionLoading === issue.id}
                              onClick={() => handleMoveStatus(issue, IssueStatus.InProgress)}
                              className="bg-civic-primary/10 hover:bg-civic-primary/25 text-civic-darkest px-3 py-1.5 rounded-lg text-[9px] font-bold tracking-wider uppercase font-mono transition cursor-pointer"
                            >
                              Dispatch
                            </button>
                          )}

                          {issue.status === IssueStatus.InProgress && (
                            <button
                              disabled={actionLoading === issue.id}
                              onClick={() => setCompletingIssue(issue)}
                              className="bg-civic-primary hover:bg-civic-dark text-white px-3 py-1.5 rounded-lg text-[9px] font-bold tracking-wider uppercase font-mono shadow-sm transition cursor-pointer"
                            >
                              Resolve
                            </button>
                          )}

                          {isCompleted && (
                            <span className="text-[9px] uppercase tracking-wider font-bold text-green-700 flex items-center space-x-1 border border-green-200 bg-green-50 px-2.5 py-1 rounded-lg">
                              <Check className="h-3.5 w-3.5" />
                              <span>Completed</span>
                            </span>
                          )}

                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>

          </table>
        </div>

      </div>

    </div>
  );
}
