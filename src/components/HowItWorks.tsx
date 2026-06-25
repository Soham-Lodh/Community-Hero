import React, { useState } from 'react';
import { 
  Zap, Compass, Eye, ShieldAlert, MessageSquare, Trophy, 
  MapPin, Bell, Activity, Mail, Sparkles, Send, CheckCircle2, ChevronRight 
} from 'lucide-react';

interface AgentInfo {
  id: string;
  name: string;
  icon: React.ReactNode;
  category: 'Citizen Intake' | 'Community Safety' | 'Municipal Dispatch' | 'System Insights';
  responsibility: string;
  techStack: string;
  input: string;
  output: string;
}

export default function HowItWorks() {
  const [activeAgentId, setActiveAgentId] = useState<string>('intake');

  // Interactive sandbox states
  const [testIntakeText, setTestIntakeText] = useState<string>('Huge pothole filled with water in the middle of 24th street. Cars are swerving to avoid it!');
  const [isTestingIntake, setIsTestingIntake] = useState<boolean>(false);
  const [intakeOutput, setIntakeOutput] = useState<any>(null);

  const [testChatText, setTestChatText] = useState<string>('This is awesome, lets meet at the library to clean up the park tomorrow!');
  const [isTestingChat, setIsTestingChat] = useState<boolean>(false);
  const [chatOutput, setChatOutput] = useState<any>(null);

  const agents: AgentInfo[] = [
    {
      id: 'intake',
      name: 'Intake Agent',
      icon: <Zap className="h-5 w-5 text-yellow-500" />,
      category: 'Citizen Intake',
      responsibility: 'Automatically triages incoming community reports, assigning the severity level, clean category, and a refined professional title.',
      techStack: 'Gemini 3.5 Flash Model + structured JSON schema parsing',
      input: 'Raw text of issue + optional image attachment',
      output: 'Triage JSON containing { severity, title, category, routingTag }'
    },
    {
      id: 'vision',
      name: 'Vision Verification Agent',
      icon: <Eye className="h-5 w-5 text-blue-500" />,
      category: 'Citizen Intake',
      responsibility: 'Inspects submitted photo attachments to authenticate that the image contains a real municipal/public safety hazard and is not spam.',
      techStack: 'Multimodal Gemini 3.5 Flash vision classification',
      input: 'Base64 image stream',
      output: 'Binary validation flag + description logs of the hazard elements'
    },
    {
      id: 'duplicate',
      name: 'Duplicate Mitigation Agent',
      icon: <Compass className="h-5 w-5 text-teal-500" />,
      category: 'Citizen Intake',
      responsibility: 'Calculates coordinates of incoming reports using Haversine formula to find nearby reports, preventing multiple distinct crew dispatches.',
      techStack: 'Geospatial indexing + proximity grouping rules',
      input: 'New GPS coordinate pair + list of active issues',
      output: 'Auto-link to parent issue if under 50m threshold'
    },
    {
      id: 'moderation',
      name: 'Safety Moderation Agent',
      icon: <MessageSquare className="h-5 w-5 text-red-500" />,
      category: 'Community Safety',
      responsibility: 'Filters community chat logs in real-time to intercept slurs, hostility, or unrelated commercial spam, maintaining civil neighborhood coordination.',
      techStack: 'Gemini 3.5 Flash moderation instruction tuning',
      input: 'Raw chat message string',
      output: 'Moderation verdict { approved: boolean, reason: string }'
    },
    {
      id: 'endorsement',
      name: 'Endorsement / Gamification Agent',
      icon: <Trophy className="h-5 w-5 text-amber-500" />,
      category: 'Community Safety',
      responsibility: 'Monitors resident upvotes, logs citizen verifications, awards activity points, and unlocks milestone badges in real-time.',
      techStack: 'Gamification ruleset + Firestore atomicity batches',
      input: 'Upvote/evidence action registered',
      output: 'Updated profile points, badges array, and verification counts'
    },
    {
      id: 'alert',
      name: 'Notification & Proximity Agent',
      icon: <Bell className="h-5 w-5 text-indigo-500" />,
      category: 'Community Safety',
      responsibility: 'Computes real-time proximity alerts for residents whose active device GPS coordinates come within 200m of a critical unresolved hazard.',
      techStack: 'HTML5 Geolocation watch + local proximity loops',
      input: 'Live user coordinate updates',
      output: 'Reactive visual alarm card + audio/vibration triggers'
    },
    {
      id: 'dispatch',
      name: 'Official Dispatch Agent',
      icon: <ShieldAlert className="h-5 w-5 text-purple-500" />,
      category: 'Municipal Dispatch',
      responsibility: 'Filters cases into four designated municipal department backlogs, routing dispatches, and managing work orders.',
      techStack: 'Role gating + dynamic query indexing',
      input: 'Status action triggered by municipal official',
      output: 'History log entries + state sync updates to Firestore'
    },
    {
      id: 'escalation',
      name: 'Council Escalation Agent',
      icon: <Mail className="h-5 w-5 text-pink-500" />,
      category: 'Municipal Dispatch',
      responsibility: 'Identifies high-severity cases with excessive endorsements that remain unresolved, automatically drafting warning letters to city council.',
      techStack: 'Gemini 3.5 Flash prompt drafting engine',
      input: 'Aged unresolved critical hazard reports + vote tally',
      output: 'Urgent formal letter drafted with resident endorsements'
    },
    {
      id: 'predictive',
      name: 'Systemic Analytics Agent',
      icon: <Activity className="h-5 w-5 text-green-500" />,
      category: 'System Insights',
      responsibility: 'Clusters citywide database logs to discover infrastructure failure hotspots, and parses chat logs to map general community sentiment trends.',
      techStack: 'Gemini 3.5 Flash pattern categorization',
      input: 'Batch datasets of community logs + chat histories',
      output: 'Hotspot recommendations + overall sentiment score (0-100)'
    }
  ];

  const handleTestIntake = async () => {
    try {
      setIsTestingIntake(true);
      setIntakeOutput(null);

      const res = await fetch('/api/ai/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: "Citizen Report", description: testIntakeText })
      });
      const data = await res.json();
      setIntakeOutput(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTestingIntake(false);
    }
  };

  const handleTestChat = async () => {
    try {
      setIsTestingChat(true);
      setChatOutput(null);

      const res = await fetch('/api/chat/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testChatText })
      });
      const data = await res.json();
      setChatOutput(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTestingChat(false);
    }
  };

  const selectedAgent = agents.find(a => a.id === activeAgentId);

  return (
    <div id="how_it_works" className="p-6 max-w-7xl mx-auto space-y-8">
      
      {/* Visual Header */}
      <div className="text-center space-y-2 max-w-2xl mx-auto">
        <h1 className="font-display font-extrabold text-3xl text-civic-darkest tracking-tight">
          The 9 Agent Civic Intelligence Blueprint
        </h1>
        <p className="text-sm text-civic-darkest/75 leading-relaxed">
          Explore how our suite of automated, server-side agents cooperates in real-time to translate unstructured street-level citizen logs into verified municipal work orders.
        </p>
      </div>

      {/* Visual Flowchart Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-9 gap-4 text-center">
        {agents.map((agent, idx) => (
          <div
            key={agent.id}
            onClick={() => setActiveAgentId(agent.id)}
            className={`p-4 rounded-2xl cursor-pointer transition-all duration-300 relative border flex flex-col items-center justify-center space-y-2.5 ${
              activeAgentId === agent.id
                ? 'bg-white border-civic-primary shadow-lg scale-105 z-10'
                : 'bg-[#cad2c5]/35 border-civic-primary/10 hover:bg-white/40 hover:scale-[1.02]'
            }`}
          >
            {/* Step index circle */}
            <span className="absolute top-2 left-2 text-[8px] font-mono font-bold text-civic-darkest/40 bg-civic-primary/10 h-4 w-4 rounded-full flex items-center justify-center">
              {idx + 1}
            </span>
            <div className="p-2.5 rounded-xl bg-[#cad2c5]/40 text-civic-dark">
              {agent.icon}
            </div>
            <div className="space-y-0.5">
              <h4 className="font-bold text-[10px] text-civic-darkest leading-snug truncate w-24">
                {agent.name}
              </h4>
              <span className="text-[7px] block font-mono font-bold text-civic-primary/80 uppercase tracking-wider">
                {agent.category}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Details Box and Agent Sandbox Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        
        {/* Left Side: Selected Agent Deep-Dive */}
        <div className="lg:col-span-6 neumorph-out p-6 rounded-3xl border border-white/50 space-y-6 flex flex-col justify-between">
          {selectedAgent && (
            <>
              <div className="space-y-4">
                <div className="flex items-center space-x-3 pb-3 border-b border-civic-primary/10">
                  <div className="p-3 rounded-2xl bg-white/60 text-civic-dark">
                    {selectedAgent.icon}
                  </div>
                  <div>
                    <span className="text-[8px] font-bold font-mono text-civic-primary uppercase tracking-widest block">
                      AGENT SPECIFICATION &bull; {selectedAgent.category}
                    </span>
                    <h3 className="font-display font-extrabold text-lg text-civic-darkest">
                      {selectedAgent.name}
                    </h3>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <span className="text-[8px] font-bold font-mono uppercase tracking-wider text-civic-darkest/50 block">Core Responsibility</span>
                    <p className="text-xs text-civic-darkest/85 leading-relaxed font-sans">{selectedAgent.responsibility}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[8px] font-bold font-mono uppercase tracking-wider text-civic-darkest/50 block">Tech Pipeline Stack</span>
                    <p className="text-xs text-civic-dark leading-relaxed font-mono font-bold">{selectedAgent.techStack}</p>
                  </div>
                </div>
              </div>

              {/* Input-Output Diagram */}
              <div className="bg-white/40 p-4 rounded-xl border border-white/50 space-y-3">
                <span className="block text-[8px] font-bold uppercase tracking-widest text-civic-darkest/50 font-mono">Agent Data Interface</span>
                
                <div className="grid grid-cols-5 gap-2 items-center text-center">
                  <div className="col-span-2 bg-[#cad2c5]/40 rounded p-2 text-[9px] font-mono leading-tight truncate" title={selectedAgent.input}>
                    <b>Inputs:</b><br />{selectedAgent.input}
                  </div>
                  <div className="flex justify-center text-civic-primary">
                    <ChevronRight className="h-5 w-5 animate-pulse" />
                  </div>
                  <div className="col-span-2 bg-civic-primary text-white rounded p-2 text-[9px] font-mono leading-tight truncate" title={selectedAgent.output}>
                    <b>Outputs:</b><br />{selectedAgent.output}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Side: Interactive AI Sandboxes */}
        <div className="lg:col-span-6 space-y-6 flex flex-col justify-between">
          
          {/* Sandbox 1: Intake Agent Sandbox */}
          <div className="neumorph-out p-6 rounded-3xl border border-white/50 space-y-4">
            <h3 className="font-display font-extrabold text-xs text-civic-darkest flex items-center space-x-1.5 uppercase tracking-wider">
              <Sparkles className="h-4 w-4 text-yellow-500 animate-spin-slow" />
              <span>Intake Agent Sandbox</span>
            </h3>

            <div className="space-y-3">
              <textarea
                placeholder="Type neighborhood report..."
                rows={2}
                value={testIntakeText}
                onChange={(e) => setTestIntakeText(e.target.value)}
                className="w-full px-3 py-2 bg-white/60 rounded-xl text-xs text-civic-darkest focus:outline-none focus:ring-1 focus:ring-civic-primary border border-civic-primary/10 font-sans"
              />

              <button
                onClick={handleTestIntake}
                disabled={isTestingIntake || !testIntakeText.trim()}
                className="w-full bg-civic-primary hover:bg-civic-dark text-white py-2 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>{isTestingIntake ? 'Intake AI processing...' : 'Trigger Intake Agent'}</span>
                <Send className="h-3 w-3" />
              </button>
            </div>

            {intakeOutput && (
              <div className="bg-white/80 p-3.5 rounded-xl border border-civic-primary/15 space-y-2 max-h-[140px] overflow-y-auto">
                <span className="block text-[8px] font-mono uppercase text-civic-darkest/50">Triage Result Output:</span>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-civic-darkest">
                  <p><b>Severity:</b> {intakeOutput.severity}</p>
                  <p><b>Routing Tag:</b> {intakeOutput.routingTag}</p>
                  <p className="col-span-2"><b>Refined Title:</b> {intakeOutput.suggestedTitle}</p>
                  <p className="col-span-2 text-[9px] bg-gray-50 p-1.5 rounded text-gray-600 leading-normal font-sans italic">
                    <b>Reasoning:</b> {intakeOutput.aiReasoningLog?.reasoning || intakeOutput.reasoning}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Sandbox 2: Moderation Agent Sandbox */}
          <div className="neumorph-out p-6 rounded-3xl border border-white/50 space-y-4">
            <h3 className="font-display font-extrabold text-xs text-civic-darkest flex items-center space-x-1.5 uppercase tracking-wider">
              <MessageSquare className="h-4 w-4 text-red-500" />
              <span>Moderation Agent Sandbox</span>
            </h3>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Type coordinate message..."
                value={testChatText}
                onChange={(e) => setTestChatText(e.target.value)}
                className="w-full px-3 py-2 bg-white/60 rounded-xl text-xs text-civic-darkest focus:outline-none focus:ring-1 focus:ring-civic-primary border border-civic-primary/10 font-sans"
              />

              <button
                onClick={handleTestChat}
                disabled={isTestingChat || !testChatText.trim()}
                className="w-full bg-civic-dark hover:bg-civic-darkest text-white py-2 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>{isTestingChat ? 'Moderating text...' : 'Trigger Moderation Agent'}</span>
                <Send className="h-3 w-3" />
              </button>
            </div>

            {chatOutput && (
              <div className="bg-white/80 p-3 rounded-xl border border-civic-primary/15 space-y-1 text-[10px] font-mono text-civic-darkest">
                <span className="block text-[8px] font-mono uppercase text-civic-darkest/50">Moderation Verdict:</span>
                <div className="flex items-center space-x-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${chatOutput.approved ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span className="font-bold">{chatOutput.approved ? 'APPROVED' : 'BLOCKED'}</span>
                </div>
                {!chatOutput.approved && (
                  <p className="text-[9px] text-red-700 mt-1"><b>Reason:</b> {chatOutput.reason}</p>
                )}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
