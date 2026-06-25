import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Issue, IssueStatus, IssueSeverity, Comment } from '../types';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import UserAvatar from './UserAvatar';
import { 
  ArrowLeft, ThumbsUp, MessageSquare, Sparkles, 
  ChevronDown, ChevronUp, Clock, Mail, Copy, Check, HelpCircle, FileText
} from 'lucide-react';

interface IssueDetailProps {
  issueId: string;
  onBack: () => void;
}

export default function IssueDetail({ issueId, onBack }: IssueDetailProps) {
  const { userProfile, upvoteIssue, addComment, createNotification } = useApp();

  const [issue, setIssue] = useState<Issue | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  
  // UI States
  const [isAiReasoningOpen, setIsAiReasoningOpen] = useState(true);
  const [commentLoading, setCommentLoading] = useState(false);
  const [upvoteLoading, setUpvoteLoading] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Escalation State
  const [escalationLetter, setEscalationLetter] = useState<string | null>(null);
  const [escalateLoading, setEscalateLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // UX Enhancements States
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [showCopyToast, setShowCopyToast] = useState(false);

  // Sync issue and comments from Firestore
  useEffect(() => {
    // 1. Listen to issue details
    const issueRef = doc(db, 'issues', issueId);
    const unsubIssue = onSnapshot(issueRef, (snap) => {
      if (snap.exists()) {
        setIssue({ id: snap.id, ...snap.data() } as Issue);
      }
    });

    // 2. Listen to comments
    const commentsRef = collection(db, 'comments');
    const qComments = query(
      commentsRef,
      where('issueId', '==', issueId),
      orderBy('createdAt', 'desc')
    );
    const unsubComments = onSnapshot(qComments, (snap) => {
      const commList: Comment[] = [];
      snap.forEach((d) => {
        commList.push({ id: d.id, ...d.data() } as Comment);
      });
      setComments(commList);
    });

    return () => {
      unsubIssue();
      unsubComments();
    };
  }, [issueId]);

  if (!issue) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center space-y-3.5">
          <Sparkles className="h-8 w-8 text-civic-primary animate-spin mx-auto" />
          <p className="text-xs text-civic-darkest/70 font-bold font-mono uppercase tracking-widest">Loading report details...</p>
        </div>
      </div>
    );
  }

  // Handle Upvoting
  const handleUpvote = async () => {
    setError(null);
    setSuccess(null);
    if (!userProfile) return;

    setUpvoteLoading(true);
    try {
      await upvoteIssue(issue.id);
      setSuccess("Your verification has been recorded! +10 Points Earned.");
    } catch (err: any) {
      setError(err.message || "Could not complete upvote");
    } finally {
      setUpvoteLoading(false);
    }
  };

  // Submit Comment
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !userProfile) return;

    setCommentLoading(true);
    try {
      await addComment(issue.id, newCommentText);
      setNewCommentText('');
    } catch (err) {
      console.error("Failed to post comment:", err);
    } finally {
      setCommentLoading(false);
    }
  };

  // Trigger Escalation Letter Generation
  const handleGenerateEscalation = async () => {
    setError(null);
    setEscalationLetter(null);
    setEscalateLoading(true);

    try {
      const response = await fetch('/api/ai/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: issue.title,
          category: issue.category,
          severity: issue.severity,
          upvoteCount: issue.upvoteCount,
          daysOpen: Math.ceil((Date.now() - issue.createdAt) / (1000 * 60 * 60 * 24)),
          reasoning: issue.aiReasoningLog[0]?.reasoning || ''
        })
      });

      const data = await response.json();
      setEscalationLetter(data.letter);

      // Notify original reporter and upvoters of escalation
      await createNotification(
        issue.reporterUid,
        issue.communityId,
        "Issue Escalated 🚨",
        `Your reported issue "${issue.title}" has been escalated to city authorities with an AI-drafted letter.`,
        "issue_escalation",
        issue.id
      );

      if (issue.upvoterUids && issue.upvoterUids.length > 0) {
        for (const uid of issue.upvoterUids) {
          await createNotification(
            uid,
            issue.communityId,
            "Watched Issue Escalated 🚨",
            `An issue you verified ("${issue.title}") has been escalated to city authorities!`,
            "issue_escalation",
            issue.id
          );
        }
      }
    } catch (err) {
      setError("AI Escalation generation failed. Please try again.");
    } finally {
      setEscalateLoading(false);
    }
  };

  const handleCopyLetter = () => {
    if (!escalationLetter) return;
    navigator.clipboard.writeText(escalationLetter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?issueId=${issue.id}`;
    navigator.clipboard.writeText(shareUrl);
    setShowCopyToast(true);
    setTimeout(() => setShowCopyToast(false), 3000);
  };

  const handleExportPDF = () => {
    if (!issue) return;

    // Create a new window for printing the styled PDF
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to export the PDF report.");
      return;
    }

    // Build the events chronological timeline HTML
    const events = getTimelineEvents();
    const timelineHtml = events.map(evt => {
      const dateStr = new Date(evt.timestamp).toLocaleString();
      return `
        <div style="margin-bottom: 12px; padding: 12px; border-left: 4px solid #52796f; background-color: #fcfdfd; border-radius: 0 6px 6px 0; border-bottom: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; border-top: 1px solid #f1f5f9;">
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 11px; color: #1e293b; margin-bottom: 4px;">
            <span>${evt.title}</span>
            <span style="font-family: monospace; color: #64748b; font-size: 10px;">${dateStr}</span>
          </div>
          <p style="margin: 4px 0; font-size: 11px; color: #475569; line-height: 1.4;">${evt.description}</p>
          <div style="font-size: 9px; color: #94a3b8; margin-top: 6px; font-weight: 500; font-family: monospace;">BY: ${evt.by.toUpperCase()}</div>
        </div>
      `;
    }).join('');

    // Build status history details
    const statusHistoryHtml = (issue.statusHistory || []).map(sh => {
      return `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #334155;">${sh.status}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-family: monospace; color: #475569;">${new Date(sh.timestamp).toLocaleString()}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #475569;">${sh.updatedBy || 'Municipal Agent'}</td>
        </tr>
      `;
    }).join('') || `<tr><td colspan="3" style="padding: 12px; text-align: center; color: #64748b; font-size: 11px;">No manual status transitions logged. Initial report status: ${issue.status}.</td></tr>`;

    // Build comments/community interaction list
    const commentsHtml = comments.map(c => {
      return `
        <div style="padding: 10px; border-bottom: 1px solid #e2e8f0; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; font-size: 10px; color: #64748b; font-weight: bold; margin-bottom: 4px;">
            <span>${c.userName} ${c.isStaff ? '⭐ (Staff)' : ''}</span>
            <span style="font-family: monospace; font-weight: normal;">${new Date(c.createdAt).toLocaleString()}</span>
          </div>
          <p style="margin: 0; font-size: 11px; color: #334155; line-height: 1.4;">${c.text}</p>
        </div>
      `;
    }).join('') || '<p style="color: #64748b; font-size: 11px; margin: 0; padding: 10px; text-align: center;">No community comments posted on this report yet.</p>';

    // Evidence images (safely with no-referrer for preview images)
    const imagesHtml = (issue.mediaUrls || []).map(url => {
      return `<img src="${url}" style="max-width: 240px; max-height: 180px; border-radius: 8px; border: 1px solid #cbd5e1; margin-right: 12px; margin-bottom: 12px; object-fit: cover;" referrerPolicy="no-referrer" />`;
    }).join('');

    // Write beautiful styled print HTML
    printWindow.document.write(`
      <html>
        <head>
          <title>CivicPulse Audit Report - #${issue.id}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
            
            body {
              font-family: 'Inter', -apple-system, sans-serif;
              color: #0f172a;
              line-height: 1.5;
              padding: 40px;
              max-width: 820px;
              margin: 0 auto;
              background-color: #ffffff;
            }
            .header-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 25px;
            }
            .title-badge {
              font-size: 11px;
              font-family: 'JetBrains Mono', monospace;
              text-transform: uppercase;
              font-weight: 700;
              background-color: #f1f5f9;
              padding: 6px 12px;
              border-radius: 6px;
              color: #475569;
              border: 1px solid #e2e8f0;
            }
            .meta-grid {
              display: grid;
              grid-template-cols: 1fr 1fr;
              gap: 16px;
              margin-bottom: 25px;
              background-color: #f8fafc;
              padding: 18px;
              border-radius: 12px;
              border: 1px solid #e2e8f0;
            }
            .meta-item {
              font-size: 11px;
            }
            .meta-label {
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
              font-size: 9px;
              letter-spacing: 0.05em;
              display: block;
              margin-bottom: 4px;
            }
            .section-title {
              font-size: 12px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.04em;
              color: #52796f;
              border-bottom: 2px solid #52796f;
              padding-bottom: 6px;
              margin-top: 30px;
              margin-bottom: 14px;
              page-break-after: avoid;
            }
            table.status-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
              text-align: left;
              margin-top: 8px;
            }
            table.status-table th {
              background-color: #f8fafc;
              padding: 10px;
              font-weight: 700;
              color: #475569;
              border-bottom: 2px solid #cbd5e1;
              text-transform: uppercase;
              font-size: 9px;
              letter-spacing: 0.02em;
            }
            .page-break-prevent {
              page-break-inside: avoid;
            }
            @media print {
              body {
                padding: 0;
                font-size: 11px;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <!-- Print Toolbar / Prompter -->
          <div class="no-print" style="background-color: #f8fafc; padding: 14px; border-radius: 10px; text-align: center; margin-bottom: 30px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; items-center;">
            <div style="text-align: left;">
              <p style="margin: 0 0 2px 0; font-size: 13px; font-weight: 700; color: #1e293b;">Official Document Pipeline Ready</p>
              <p style="margin: 0; font-size: 11px; color: #64748b;">Save as a vector PDF or print directly from your browser.</p>
            </div>
            <button onclick="window.print();" style="background-color: #52796f; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer; transition: background-color 0.2s;">
              Print / Save PDF
            </button>
          </div>

          <!-- Document Letterhead -->
          <table class="header-table">
            <tr>
              <td>
                <div style="font-size: 22px; font-weight: 800; color: #52796f; letter-spacing: -0.02em;">CIVICPULSE PUBLIC RECORD</div>
                <div style="font-size: 10px; color: #64748b; font-weight: 600; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; margin-top: 3px; letter-spacing: 0.05em;">AI-Authorized Municipal Audit & Resolution Log</div>
              </td>
              <td style="text-align: right; vertical-align: top;">
                <span class="title-badge">Report #${issue.id.substring(0, 8).toUpperCase()}</span>
              </td>
            </tr>
          </table>

          <div style="border-top: 1px solid #e2e8f0; margin-bottom: 24px;"></div>

          <!-- Issue Narrative Header -->
          <h1 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 10px 0; letter-spacing: -0.01em;">${issue.title}</h1>
          <p style="font-size: 12px; color: #334155; margin: 0 0 24px 0; line-height: 1.6;">${issue.description}</p>

          <!-- Report Metadata Grid -->
          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Category Group</span>
              <span style="font-weight: 700; color: #0f172a; font-size: 12px;">${issue.category}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Assigned Priority / Severity</span>
              <span style="font-weight: 700; color: ${getSeverityBgColor(issue.severity)}; font-size: 12px;">${issue.severity.toUpperCase()} PRIORITY</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Submission Date & Time</span>
              <span style="font-family: 'JetBrains Mono', monospace; font-weight: 500;">${new Date(issue.createdAt).toLocaleString()}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Direct Routing Tag</span>
              <span style="font-weight: 700; font-family: 'JetBrains Mono', monospace; color: #52796f;">${issue.routingTag || 'GENERAL_WORKS'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Resolution Status</span>
              <span style="font-weight: 700; text-transform: uppercase; color: #52796f; font-size: 12px;">${issue.status}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Endorsements & Upvotes</span>
              <span style="font-weight: 600;">${issue.upvoteCount} Active Resident Endorsements</span>
            </div>
            <div class="meta-item" style="grid-column: span 2;">
              <span class="meta-label">Geographic Footprint Coordinates</span>
              <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px;">LATITUDE: ${issue.lat.toFixed(6)} &nbsp;&bull;&nbsp; LONGITUDE: ${issue.lng.toFixed(6)}</span>
            </div>
          </div>

          <!-- Chronological Timeline Section -->
          <div class="section-title">Chronological Activity History</div>
          <div style="margin-top: 10px;">
            ${timelineHtml}
          </div>

          <!-- Status Logs Section -->
          <div class="page-break-prevent">
            <div class="section-title">Status Transition Audit Log</div>
            <table class="status-table">
              <thead>
                <tr>
                  <th style="width: 33%;">Target Status</th>
                  <th style="width: 37%;">Transition Timestamp</th>
                  <th style="width: 30%;">Authorized Operator</th>
                </tr>
              </thead>
              <tbody>
                ${statusHistoryHtml}
              </tbody>
            </table>
          </div>

          <!-- Evidence Gallery -->
          ${imagesHtml ? `
            <div class="page-break-prevent">
              <div class="section-title">Attached Incident Evidence</div>
              <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px;">
                ${imagesHtml}
              </div>
            </div>
          ` : ''}

          <!-- Community Discussions -->
          <div class="page-break-prevent" style="margin-top: 25px;">
            <div class="section-title">Community Dialogue & Feedback</div>
            <div style="background-color: #fafbfc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 15px; margin-top: 10px;">
              ${commentsHtml}
            </div>
          </div>

          <!-- Official Stamp Footer -->
          <div style="margin-top: 60px; border-top: 2px solid #52796f; padding-top: 20px; text-align: center; font-size: 9px; color: #64748b; font-family: 'JetBrains Mono', monospace; line-height: 1.5;">
            AUDIT DOCUMENT SECURED AND PUBLISHED VIA CIVICPULSE SOCIAL COGNITION PIPELINE.<br/>
            VERIFIABLE DATA DEPOSITED ON PUBLIC FIRESTORE REPLICA ON ${new Date().toLocaleString().toUpperCase()}.<br/>
            ALL GEOGRAPHIC STAMPS ARE CRYPTOGRAPHICALLY ASSIGNED BY HOST NODE SERVICES.
          </div>

          <script>
            // Automatically prompt the print dialogue after loading assets
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getTimelineEvents = () => {
    const events: any[] = [];

    // 1. Creation event
    events.push({
      id: 'creation',
      timestamp: issue.createdAt,
      type: 'creation',
      title: 'Report Filed',
      description: `Hazard reported in catchment circle. Severity set to ${issue.severity}.`,
      by: issue.isAnonymous ? 'Anonymous Citizen' : (issue.reporterName || 'Citizen'),
      badgeColor: 'bg-civic-primary/10 text-civic-primary',
    });

    // 2. Status changes
    if (issue.statusHistory && issue.statusHistory.length > 0) {
      issue.statusHistory.forEach((sh, idx) => {
        events.push({
          id: `status-${idx}-${sh.timestamp}`,
          timestamp: sh.timestamp,
          type: 'status',
          title: `Status: ${sh.status}`,
          description: sh.status === IssueStatus.Completed && issue.resolutionSummary 
            ? `Resolution Milestone: ${issue.resolutionSummary}`
            : `Issue transitioned to ${sh.status}.`,
          by: sh.updatedBy || 'Municipal Agent',
          badgeColor: 'bg-blue-100 text-blue-800',
        });
      });
    }

    // 3. AI decisions / milestones
    if (issue.aiReasoningLog && issue.aiReasoningLog.length > 0) {
      issue.aiReasoningLog.forEach((ar, idx) => {
        events.push({
          id: `ai-${idx}-${ar.timestamp}`,
          timestamp: ar.timestamp,
          type: 'ai_decision',
          title: ar.decision,
          description: ar.reasoning,
          by: `${ar.agentName} (AI)`,
          badgeColor: 'bg-purple-100 text-purple-800',
        });
      });
    }

    // Sort descending (newest first)
    return events.sort((a, b) => b.timestamp - a.timestamp);
  };

  // Status index helper
  const statusSteps = [IssueStatus.Reported, IssueStatus.Reviewed, IssueStatus.InProgress, IssueStatus.Completed];
  const activeStepIndex = statusSteps.indexOf(issue.status);

  // Severity BG color helpers
  const getSeverityBgColor = (sev: IssueSeverity): string => {
    switch (sev) {
      case IssueSeverity.Low: return '#84a98c';
      case IssueSeverity.Medium: return '#52796f';
      case IssueSeverity.High: return '#d97706';
      case IssueSeverity.Critical: return '#dc2626';
      default: return '#52796f';
    }
  };

  return (
    <div id="issue_detail_view" className="bg-civic-light/30 p-4 md:p-8 min-h-screen selection:bg-civic-accent selection:text-civic-darkest">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Top Header Controls with Glassmorphism */}
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center space-x-3">
            <button 
              onClick={onBack}
              className="neumorph-out-sm hover:scale-105 px-4.5 py-2.5 rounded-xl border border-white/50 transition duration-300 text-civic-darkest flex items-center space-x-2 text-xs font-bold cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4 text-civic-primary" />
              <span>Return to Map Feed</span>
            </button>

            <button 
              onClick={handleCopyLink}
              className="neumorph-out-sm hover:scale-105 px-4.5 py-2.5 rounded-xl border border-white/50 transition duration-300 text-civic-darkest flex items-center space-x-2 text-xs font-bold cursor-pointer bg-white/50"
            >
              <Copy className="h-4 w-4 text-civic-primary" />
              <span>Copy Link</span>
            </button>

            <button 
              onClick={handleExportPDF}
              className="neumorph-out-sm hover:scale-105 px-4.5 py-2.5 rounded-xl border border-white/50 transition duration-300 text-civic-darkest flex items-center space-x-2 text-xs font-bold cursor-pointer bg-white/50"
            >
              <FileText className="h-4 w-4 text-civic-primary" />
              <span>Export PDF</span>
            </button>
          </div>
          
          <div className="flex space-x-2">
            {issue.isAnonymous && (
              <span className="bg-civic-darkest/90 text-white text-[10px] uppercase font-bold tracking-wider px-3.5 py-1.5 rounded-lg border border-white/10 shadow-sm">
                Anonymous Report
              </span>
            )}
          </div>
        </div>

        {/* Status Timeline Progress Card */}
        <div className="glass-light p-6.5 rounded-3xl border border-white shadow-sm space-y-6">
          <div className="flex justify-between items-center pb-2.5 border-b border-civic-primary/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-civic-dark font-mono">Resolution Progress Gauge</span>
            <span className="text-xs font-mono font-bold text-civic-primary uppercase tracking-wide bg-white/60 px-3 py-1 rounded-lg border border-white shadow-inner">{issue.status}</span>
          </div>

          <div className="relative flex justify-between items-center w-full max-w-xl mx-auto pt-3.5">
            {/* Horizontal timeline track */}
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-white -translate-y-1/2 z-0 rounded-full shadow-inner"></div>
            {/* Colored horizontal progress indicator */}
            <div 
              style={{ width: `${(activeStepIndex / (statusSteps.length - 1)) * 100}%` }} 
              className="absolute top-1/2 left-0 h-1 bg-civic-primary -translate-y-1/2 z-0 rounded-full transition-all duration-500 shadow-md"
            ></div>

            {statusSteps.map((step, idx) => {
              const isPassed = idx <= activeStepIndex;
              const isActive = idx === activeStepIndex;

              return (
                <div key={step} className="flex flex-col items-center relative z-10">
                  <div 
                    className={`w-8.5 h-8.5 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-350 ${
                      isPassed 
                        ? 'bg-civic-primary text-white border-white scale-110 shadow-md' 
                        : 'bg-white text-gray-400 border-gray-200 shadow-sm'
                    } ${isActive ? 'ring-4 ring-civic-primary/20 animate-pulse' : ''}`}
                  >
                    {idx + 1}
                  </div>
                  <span className={`text-[9px] font-bold mt-2.5 tracking-wider uppercase ${isPassed ? 'text-civic-darkest' : 'text-gray-400 font-mono'}`}>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Notifications / Feedback */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-900 rounded-2xl p-4 text-xs">
            <b>System Notice:</b> {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-950 rounded-2xl p-4 text-xs">
            🎉 {success}
          </div>
        )}

        {/* Escalation Letter Drafting Board */}
        {escalationLetter && (
          <div className="glass-dark text-white rounded-3xl p-6.5 border border-white/10 shadow-xl space-y-4 animate-slide-down z-10">
            <div className="flex justify-between items-start">
              <div className="flex items-center space-x-2.5">
                <Mail className="h-5 w-5 text-civic-accent" />
                <h3 className="font-display font-bold text-lg text-civic-accent">Official Escalation Draft</h3>
              </div>
              <button
                onClick={() => setEscalationLetter(null)}
                className="text-white/60 hover:text-white text-xs font-bold uppercase tracking-wider cursor-pointer font-mono"
              >
                Close
              </button>
            </div>
            
            <textarea
              readOnly
              rows={12}
              value={escalationLetter}
              className="w-full p-4 bg-white/5 border border-white/15 rounded-xl font-mono text-[11px] leading-relaxed text-white/90 focus:outline-none custom-scrollbar"
            />

            <div className="flex justify-end space-x-3 pt-1">
              <button
                onClick={handleCopyLetter}
                className="bg-civic-primary hover:bg-civic-dark text-white px-5 py-3 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md hover:scale-[1.01] transition-transform cursor-pointer"
              >
                {copied ? <Check className="h-4.5 w-4.5 text-civic-accent" /> : <Copy className="h-4.5 w-4.5" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Letter Draft'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Primary Main Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6.5 items-stretch">
          
          {/* Left Details Panel */}
          <div className="md:col-span-7 space-y-6">
            
            <div className="bg-white rounded-3xl border border-white overflow-hidden shadow-md flex flex-col justify-between hover:shadow-lg transition-shadow duration-300">
              
              <div>
                {/* Media Image with border overlay - Click-to-Zoom enabled */}
                {issue.mediaUrls && issue.mediaUrls[0] && (
                  <div 
                    onClick={() => setZoomImage(issue.mediaUrls[0])}
                    className="h-72 bg-civic-light/20 relative border-b border-gray-100 cursor-zoom-in group"
                  >
                    <img 
                      src={issue.mediaUrls[0]} 
                      alt={issue.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:opacity-95 transition-opacity"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                      <span className="bg-black/60 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        Click to Zoom
                      </span>
                    </div>
                  </div>
                )}

                <div className="p-6.5 space-y-4.5">
                  
                  {/* Category, Date & Severity Indicator */}
                  <div className="flex justify-between items-center text-xs border-b border-gray-100 pb-3.5">
                    <div className="flex items-center space-x-2.5 font-semibold">
                      <span className="font-mono text-civic-primary font-bold uppercase tracking-widest">{issue.category}</span>
                      <span className="text-civic-darkest/45">•</span>
                      <span className="text-civic-darkest/60 font-mono">{new Date(issue.createdAt).toLocaleDateString()}</span>
                    </div>

                    <span 
                      style={{ backgroundColor: getSeverityBgColor(issue.severity) }}
                      className="text-white px-3 py-1 rounded-md font-bold text-[9px] uppercase tracking-wider shadow-sm"
                    >
                      {issue.severity}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-3">
                    <h1 className="font-display font-bold text-2xl text-civic-darkest tracking-tight leading-tight">
                      {issue.title}
                    </h1>
                    <p className="text-sm text-civic-darkest/80 leading-relaxed font-medium">
                      {issue.description}
                    </p>
                  </div>

                  {/* Resolution Summary */}
                  {issue.status === IssueStatus.Completed && issue.resolutionSummary && (
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-4.5 space-y-2">
                      <span className="block text-[10px] font-bold text-green-800 uppercase tracking-wider font-mono">Official Resolution Docket</span>
                      <p className="text-xs text-green-950 leading-relaxed font-medium">
                        {issue.resolutionSummary}
                      </p>
                    </div>
                  )}

                  {/* Reporter block */}
                  <div className="pt-3.5 flex items-center space-x-3 border-t border-gray-50">
                    <UserAvatar
                      src={issue.isAnonymous ? null : issue.reporterPhoto}
                      name={issue.isAnonymous ? 'Anonymous Citizen' : (issue.reporterName || 'Local Neighbor')}
                      className="w-8.5 h-8.5"
                      alt="Reporter avatar"
                    />
                    <div>
                      <span className="block text-xs font-bold text-civic-darkest">
                        {issue.isAnonymous ? 'Anonymous Citizen' : (issue.reporterName || 'Local Neighbor')}
                      </span>
                      <span className="block text-[9px] text-civic-darkest/50 font-mono uppercase font-bold tracking-wider">Original Reporter</span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Action bar with Upvote/Verify buttons */}
              <div className="px-6.5 py-4.5 border-t border-gray-100 bg-[#cad2c5]/15 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-xl font-mono font-bold text-civic-darkest leading-none mb-1">{issue.upvoteCount}</span>
                  <span className="text-[9px] text-civic-darkest/65 uppercase font-bold tracking-wider font-mono">citizen verifications</span>
                </div>

                <div className="flex space-x-2">
                  {/* Manual Escalate Button */}
                  {(issue.status === IssueStatus.Reported || issue.status === IssueStatus.Reviewed) && (
                    <button
                      disabled={escalateLoading}
                      onClick={handleGenerateEscalation}
                      className="bg-transparent hover:bg-civic-primary/10 border border-civic-primary text-civic-primary px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer hover:scale-[1.01]"
                    >
                      <Mail className="h-4 w-4" />
                      <span>{escalateLoading ? 'Drafting...' : 'Force Escalate'}</span>
                    </button>
                  )}

                  {/* Upvote verifying button */}
                  {userProfile?.uid !== issue.reporterUid && !issue.upvoterUids?.includes(userProfile?.uid || '') && (
                    <button
                      disabled={upvoteLoading}
                      onClick={handleUpvote}
                      className="bg-civic-primary hover:bg-civic-dark text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-2 shadow-md transition hover:scale-[1.01] cursor-pointer"
                    >
                      <ThumbsUp className="h-4 w-4 text-civic-accent" />
                      <span>Verify Hazard</span>
                    </button>
                  )}

                  {issue.upvoterUids?.includes(userProfile?.uid || '') && (
                    <span className="bg-green-100 text-green-800 text-[10px] uppercase tracking-wider font-bold px-4 py-2 rounded-xl flex items-center space-x-1.5 border border-green-200 shadow-sm">
                      <Check className="h-4 w-4 text-green-700" />
                      <span>Verified</span>
                    </span>
                  )}
                </div>
              </div>

            </div>

            {/* Activity History Timeline Card */}
            <div className="bg-white rounded-3xl border border-white p-6.5 shadow-md hover:shadow-lg transition-shadow duration-300 space-y-4">
              <div className="flex items-center space-x-2 pb-3.5 border-b border-gray-100">
                <Clock className="h-5 w-5 text-civic-primary" />
                <h3 className="font-display font-bold text-sm text-civic-darkest">Activity & Resolution History</h3>
              </div>

              <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
                {getTimelineEvents().map((event) => (
                  <div key={event.id} className="relative group">
                    {/* Timeline node */}
                    <div className="absolute -left-[20px] top-1.5 w-3 h-3 rounded-full bg-white border-2 border-civic-primary group-hover:scale-125 transition-transform"></div>
                    
                    <div className="space-y-1.5">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                        <div className="flex items-center space-x-2">
                          <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded uppercase tracking-wider ${event.badgeColor}`}>
                            {event.by}
                          </span>
                          <h4 className="font-bold text-xs text-civic-darkest">{event.title}</h4>
                        </div>
                        <span className="text-[10px] font-mono text-civic-darkest/45">
                          {new Date(event.timestamp).toLocaleString()}
                        </span>
                      </div>
                      {event.description && (
                        <p className="text-xs text-civic-darkest/70 leading-relaxed font-mono whitespace-pre-wrap pl-1 bg-gray-50/50 p-2 rounded-lg border border-gray-100/50">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right side AI Reasoning panel & Comment Board */}
          <div className="md:col-span-5 flex flex-col space-y-4">
            
            {/* AI Reasoning collapsible board - Frosted glass-dark */}
            <div className="bg-white border border-white rounded-2xl shadow-sm overflow-hidden hover:shadow transition-shadow duration-300">
              <button 
                onClick={() => setIsAiReasoningOpen(!isAiReasoningOpen)}
                className="w-full px-5 py-4 bg-civic-darkest text-white flex justify-between items-center"
              >
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-4.5 w-4.5 text-civic-accent animate-pulse" />
                  <span className="font-display font-bold text-[10px] uppercase tracking-widest text-civic-accent font-mono">Agent Reasoning Logs</span>
                </div>
                {isAiReasoningOpen ? <ChevronUp className="h-4 w-4 text-civic-accent" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {isAiReasoningOpen && (
                <div className="p-4.5 space-y-4 bg-[#354f52] text-white/95 max-h-[250px] overflow-y-auto custom-scrollbar border-t border-white/5">
                  {issue.aiReasoningLog && issue.aiReasoningLog.length > 0 ? (
                    issue.aiReasoningLog.map((log, idx) => (
                      <div key={idx} className="border-l-2 border-civic-accent pl-3.5 py-1 space-y-1">
                        <div className="flex justify-between items-center text-[9px] font-mono">
                          <span className="font-bold text-civic-accent">{log.agentName}</span>
                          <span className="text-white/45">{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <h5 className="text-[11px] font-bold text-white leading-tight">{log.decision}</h5>
                        <p className="text-[10px] text-white/70 leading-relaxed font-mono whitespace-pre-wrap">{log.reasoning}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-white/40 text-xs">
                      No AI diagnostics logs recorded.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Comment Thread with beautiful Glass Card layout */}
            <div className="glass-light p-5.5 rounded-3xl border border-white shadow-sm flex flex-col flex-grow h-[350px]">
              <div className="flex items-center space-x-2 border-b border-civic-primary/15 pb-3 mb-3.5 shrink-0">
                <MessageSquare className="h-4 w-4 text-civic-primary" />
                <h4 className="font-display font-bold text-sm text-civic-darkest">Citizen Discussion ({comments.length})</h4>
              </div>

              {/* Thread list */}
              <div className="flex-grow overflow-y-auto space-y-3.5 pr-1 custom-scrollbar">
                {comments.length === 0 ? (
                  <div className="text-center py-16 text-civic-darkest/45 text-xs space-y-1.5 font-medium">
                    <HelpCircle className="h-7 w-7 mx-auto text-civic-primary/30" />
                    <p>No comments posted yet.</p>
                    <p className="text-[10px] text-civic-darkest/60 leading-normal">Post a verification message or coordination query!</p>
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="p-3.5 bg-white/45 border border-white rounded-2xl space-y-1.5 shadow-sm">
                      <div className="flex items-center space-x-2">
                        <UserAvatar src={comment.userPhotoURL} name={comment.userName} className="w-5.5 h-5.5" />
                        <span className="text-[10px] font-bold text-civic-darkest">{comment.userName}</span>
                        <span className="text-[9px] text-civic-darkest/40 font-mono font-medium">{new Date(comment.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-civic-darkest/85 leading-relaxed pl-1.5">
                        {comment.text}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Input Form with Neumorphic Inset */}
              <form onSubmit={handleCommentSubmit} className="pt-3.5 border-t border-civic-primary/10 flex space-x-2 shrink-0 z-10">
                <input
                  type="text"
                  placeholder={userProfile ? "Write a coordination comment..." : "Sign in to join discussion"}
                  disabled={commentLoading || !userProfile}
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  className="flex-1 px-4.5 py-3 bg-[#c2cbbe] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-civic-primary text-civic-darkest neumorph-in border-0"
                />
                <button
                  type="submit"
                  disabled={commentLoading || !newCommentText.trim() || !userProfile}
                  className="bg-civic-primary hover:bg-civic-dark text-white px-4.5 rounded-xl text-xs font-bold transition duration-300 shadow-md cursor-pointer border border-white/10"
                >
                  Post
                </button>
              </form>
            </div>

          </div>

        </div>

        {/* Click-to-zoom image modal overlay */}
        {zoomImage && (
          <div 
            className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setZoomImage(null)}
          >
            <div className="relative max-w-4xl w-full max-h-[90vh] flex items-center justify-center">
              <img 
                src={zoomImage} 
                alt="High-resolution evidence" 
                referrerPolicy="no-referrer"
                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/10"
              />
              <button 
                onClick={() => setZoomImage(null)}
                className="absolute top-4 right-4 text-white hover:text-civic-accent bg-black/50 p-2.5 rounded-full border border-white/25 transition cursor-pointer"
              >
                <span className="font-bold text-lg leading-none">×</span>
              </button>
            </div>
          </div>
        )}

        {/* Copy Link Success Toast */}
        {showCopyToast && (
          <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-civic-darkest text-white px-5 py-3.5 rounded-xl border border-civic-accent/30 shadow-2xl flex items-center space-x-2">
            <Check className="h-4.5 w-4.5 text-civic-accent font-bold" />
            <span className="text-xs font-bold font-mono">Link copied to clipboard!</span>
          </div>
        )}

      </div>
    </div>
  );
}
