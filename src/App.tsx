import React, { Suspense, lazy, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import UserAvatar from './components/UserAvatar';
import { 
  Zap, LogOut, Award, MapPin, MessageSquare, BarChart2, 
  Trophy, ShieldAlert, Sparkles, HelpCircle, LogIn, Bell, BellRing, ExternalLink, Navigation
} from 'lucide-react';

const LandingPage = lazy(() => import('./components/LandingPage'));
const Onboarding = lazy(() => import('./components/Onboarding'));
const FirstRunWelcome = lazy(() => import('./components/FirstRunWelcome'));
const MapAndFeed = lazy(() => import('./components/MapAndFeed'));
const ReportIssue = lazy(() => import('./components/ReportIssue'));
const IssueDetail = lazy(() => import('./components/IssueDetail'));
const CommunityChat = lazy(() => import('./components/CommunityChat'));
const ImpactDashboard = lazy(() => import('./components/ImpactDashboard'));
const LeaderboardProfile = lazy(() => import('./components/LeaderboardProfile'));
const DepartmentQueue = lazy(() => import('./components/DepartmentQueue'));
const HowItWorks = lazy(() => import('./components/HowItWorks'));

type ActiveTab = 'feed' | 'chat' | 'impact' | 'leaderboard' | 'queue' | 'blueprint';

function ViewFallback() {
  return (
    <div className="min-h-[420px] flex flex-col items-center justify-center space-y-3 text-civic-darkest/70">
      <Sparkles className="h-7 w-7 text-civic-primary animate-spin" />
      <span className="text-[10px] font-bold uppercase tracking-widest font-mono">Loading workspace...</span>
    </div>
  );
}

function MainAppContent() {
  const { 
    currentUser, 
    userProfile, 
    currentCommunity, 
    signOutUser, 
    signInWithGoogle, 
    signInAsDemoUser,
    authLoading,
    notifications,
    activeToast,
    setActiveToast,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    isFirstRun,
    communitiesLoaded
  } = useApp();

  // Navigation states
  const [showLanding, setShowLanding] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('feed');
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const [forceOnboardingTab, setForceOnboardingTab] = useState<'join' | 'create' | null>(null);
  const [hideJoinTab, setHideJoinTab] = useState(false);
  const [dismissFirstRun, setDismissFirstRun] = useState(false);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Background Geolocation Monitoring States & Effects
  const [locationStatus, setLocationStatus] = useState<'checking' | 'granted' | 'denied' | 'unsupported'>('checking');
  const [simulatedLocation, setSimulatedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [realLocation, setRealLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  const [nearbyCriticalIssue, setNearbyCriticalIssue] = useState<{ issue: any; distance: number } | null>(null);

  const { issues } = useApp();

  const handleRequestLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('unsupported');
      return;
    }
    setLocationStatus('checking');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRealLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocationStatus('granted');
      },
      (err) => {
        console.warn("Location error:", err);
        setLocationStatus('denied');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // 1. Subscribe to real device GPS and monitor permission status
  React.useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('unsupported');
      return;
    }

    setLocationStatus('checking');

    // Attempt to get position immediately to trigger prompt
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRealLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocationStatus('granted');
      },
      (err) => {
        console.warn("Location error:", err);
        setLocationStatus('denied');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );

    // Watch position
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setRealLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocationStatus('granted');
      },
      (err) => {
        console.warn("Location watch error:", err);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // 2. Haversine Formula (Calculates distance between coordinates in km)
  const getHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // 3. Proximity check loop comparing user location to active Critical hazards
  React.useEffect(() => {
    const activeLat = simulatedLocation ? simulatedLocation.lat : realLocation?.lat;
    const activeLng = simulatedLocation ? simulatedLocation.lng : realLocation?.lng;

    if (!activeLat || !activeLng || !issues || issues.length === 0) {
      setNearbyCriticalIssue(null);
      return;
    }

    // Filter active critical issues
    const criticalHazards = issues.filter(
      (i: any) => i.severity === 'Critical' && i.status !== 'Completed'
    );

    let closest: { issue: any; distance: number } | null = null;

    for (const h of criticalHazards) {
      if (!h.lat || !h.lng || dismissedAlerts.includes(h.id)) continue;
      const d = getHaversineDistance(activeLat, activeLng, h.lat, h.lng);
      if (d <= 0.2) { // 200 meters proximity
        if (!closest || d < closest.distance) {
          closest = { issue: h, distance: Math.round(d * 1000) }; // round to meters
        }
      }
    }

    if (closest) {
      setNearbyCriticalIssue({
        issue: closest.issue,
        distance: closest.distance
      });
    } else {
      setNearbyCriticalIssue(null);
    }
  }, [simulatedLocation, realLocation, issues, dismissedAlerts]);

  // Read issueId from query params on mount to support copied direct links
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paramIssueId = params.get('issueId');
    if (paramIssueId) {
      setSelectedIssueId(paramIssueId);
      setIsReporting(false);
      setShowLanding(false); // Dismiss landing
    }
  }, []);

  // Demo Sign-in variables
  const [demoName, setDemoName] = useState('');
  const [demoRole, setDemoRole] = useState<'citizen' | 'official'>('citizen');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState<'google' | 'demo' | null>(null);

  const handleDemoLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginLoading) return;
    setLoginError(null);
    if (!demoName.trim()) {
      setLoginError("Please specify a display name.");
      return;
    }
    try {
      setLoginLoading('demo');
      await signInAsDemoUser(demoName, demoRole);
      setShowLanding(false);
    } catch (err) {
      setLoginError("Demo sign-in failed.");
    } finally {
      setLoginLoading(null);
    }
  };

  const handleGoogleLogin = async () => {
    if (loginLoading) return;
    setLoginError(null);
    try {
      setLoginLoading('google');
      await signInWithGoogle();
      setShowLanding(false);
    } catch (err: any) {
      setLoginError(err?.message || "Google sign-in failed. Please use the instant Demo Sign-in fallback below.");
    } finally {
      setLoginLoading(null);
    }
  };

  // Location Gating Barriers
  if (locationStatus === 'unsupported' || locationStatus === 'denied') {
    return (
      <div className="min-h-screen bg-[#1b262c] text-[#bbe1fa] flex flex-col items-center justify-center p-6 selection:bg-[#3282b8] selection:text-white">
        <div className="max-w-md w-full bg-[#222831]/80 backdrop-blur-md rounded-3xl p-8 border border-white/10 shadow-2xl text-center space-y-6">
          <div className="bg-red-500/10 border border-red-500/25 p-5 rounded-2xl inline-block text-red-400">
            <MapPin className="h-10 w-10 animate-bounce" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display font-bold text-2xl text-white tracking-tight">Location Access Required</h1>
            <p className="text-sm text-gray-400 leading-relaxed">
              CivicPulse operates on localized neighborhood catchment networks. To verify hazard reports, match geo-duplicates, and sync local chat channels, active GPS/location permission is strictly mandatory.
            </p>
          </div>
          
          <div className="bg-[#393e46]/40 rounded-2xl p-4 text-left space-y-2.5 text-xs text-gray-300 border border-white/5">
            <span className="font-bold text-white block uppercase tracking-wider text-[10px] font-mono">How to enable permission:</span>
            <div className="space-y-1.5 leading-relaxed">
              <p><b>1. Chrome/Firefox:</b> Click the lock icon in the address bar next to the URL and toggle Geolocation/Location to "Allow".</p>
              <p><b>2. Safari:</b> Go to settings &gt; Websites &gt; Location and choose "Allow" for this site.</p>
              <p><b>3. Mobile:</b> Ensure your device's System Location Services are enabled and browser has permission.</p>
            </div>
          </div>

          <button
            onClick={handleRequestLocation}
            className="w-full bg-[#0f4c81] hover:bg-[#1f6cb0] text-white py-3.5 rounded-2xl text-xs font-bold font-mono transition-all duration-300 shadow-lg flex items-center justify-center space-x-2 border border-white/10 cursor-pointer"
          >
            <Navigation className="h-4 w-4" />
            <span>Enable Geolocation Services</span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <span className="relative px-3 text-[10px] uppercase tracking-wider font-mono text-gray-500 bg-[#222831]">Or</span>
          </div>

          <button
            onClick={() => {
              setSimulatedLocation({ lat: 37.7749, lng: -122.4194 });
              setLocationStatus("granted");
            }}
            className="w-full bg-[#393e46] hover:bg-gray-700 text-gray-200 py-3 rounded-2xl text-xs font-mono font-bold transition-all duration-300 flex items-center justify-center space-x-2 border border-white/5 cursor-pointer"
          >
            <span>Use Demo Simulation Location</span>
          </button>
        </div>
      </div>
    );
  }

  if (locationStatus === 'checking') {
    return (
      <div className="min-h-screen bg-civic-light/40 flex flex-col items-center justify-center space-y-4">
        <div className="relative">
          <div className="absolute inset-0 bg-civic-primary/20 rounded-full blur-xl animate-pulse"></div>
          <Navigation className="h-10 w-10 text-civic-primary animate-spin relative" />
        </div>
        <span className="text-xs text-civic-darkest font-mono font-bold uppercase tracking-widest animate-pulse">Checking GPS Coordinates...</span>
      </div>
    );
  }

  // Auth loading barrier
  if (authLoading) {
    return (
      <div className="min-h-screen bg-civic-light/40 flex flex-col items-center justify-center space-y-4">
        <Sparkles className="h-10 w-10 text-civic-primary animate-spin" />
        <span className="text-sm text-civic-darkest font-semibold uppercase tracking-wider">Syncing CivicPulse...</span>
      </div>
    );
  }

  // 1. SIGN-OUT / LANDING VIEW
  if (showLanding && !currentUser) {
    return (
      <Suspense fallback={<ViewFallback />}>
        <LandingPage onStart={() => setShowLanding(false)} />
      </Suspense>
    );
  }

  // 2. SIGN-IN SCREEN GATEWAY (IF SIGNED OUT)
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-civic-light flex flex-col justify-center items-center p-4 selection:bg-civic-accent selection:text-civic-darkest">
        <div className="neumorph-out p-8 sm:p-10 rounded-[2rem] border border-white/60 shadow-xl max-w-md w-full space-y-7 transition-all duration-300">
          
          {/* Logo with neumorphic accent */}
          <div className="text-center space-y-3">
            <div className="bg-civic-darkest p-4.5 rounded-2xl inline-block text-white shadow-lg border border-civic-accent/10">
              <Zap className="h-8 w-8 text-civic-accent animate-pulse" />
            </div>
            <h1 className="font-display font-bold text-3xl text-civic-darkest tracking-tight">Access CivicPulse</h1>
            <p className="text-xs text-civic-darkest/75 leading-relaxed px-2">
              Real-time geolocated reporting, verified community circles, and Gemini-powered analytics.
            </p>
          </div>

          {loginError && (
            <div className="bg-red-50 border border-red-200 text-red-900 rounded-2xl p-4 text-xs leading-relaxed shadow-inner">
              <b>Authentication Warning:</b> {loginError}
            </div>
          )}

          {/* Real Google Sign in */}
          <button
            onClick={handleGoogleLogin}
            disabled={loginLoading !== null}
            className="w-full bg-civic-darkest text-white hover:bg-civic-dark py-4 px-5 rounded-2xl text-xs font-bold transition duration-300 flex items-center justify-center space-x-2.5 border border-white/5 shadow-md hover:shadow-lg active:scale-[0.99] cursor-pointer"
          >
            <LogIn className="h-4 w-4 text-civic-accent" />
            <span>{loginLoading === 'google' ? 'Opening Google Sign-In...' : 'Sign In with Google Account'}</span>
          </button>

          {/* Sandbox friendly Demo credentials divider */}
          <div className="flex items-center space-x-2 my-1 text-civic-darkest/45">
            <div className="flex-grow h-px bg-civic-primary/20"></div>
            <span className="text-[9px] font-bold uppercase tracking-wider">Instant Demo Access</span>
            <div className="flex-grow h-px bg-civic-primary/20"></div>
          </div>

          {/* Quick Demo setup */}
          <form onSubmit={handleDemoLogin} className="space-y-5">
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-civic-darkest/75 mb-1.5 tracking-wider">Citizen Name</label>
                <input
                  type="text"
                  placeholder="e.g. Elena Rostova"
                  value={demoName}
                  onChange={(e) => setDemoName(e.target.value)}
                  className="w-full px-4 py-3 bg-[#c2cbbe] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-civic-primary text-civic-darkest neumorph-in border-0"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-civic-darkest/75 mb-1.5 tracking-wider">Simulated Role Profile</label>
                <select
                  value={demoRole}
                  onChange={(e) => setDemoRole(e.target.value as any)}
                  className="w-full px-4 py-3 bg-[#c2cbbe] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-civic-primary text-civic-darkest cursor-pointer neumorph-in border-0"
                >
                  <option value="citizen">Neighborhood Citizen (Report & Verify)</option>
                  <option value="official">Municipal Worker (Resolve Queue, Gatecode CIVIC2026)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading !== null}
              className="w-full bg-civic-primary hover:bg-civic-dark text-white py-4 rounded-2xl text-xs font-bold shadow-md hover:shadow-lg transition duration-300 active:scale-[0.99] cursor-pointer"
            >
              {loginLoading === 'demo' ? 'Creating Demo Session...' : 'One-Tap Demo Access'}
            </button>
          </form>

          {/* Security policy footnote */}
          <div className="text-[10px] text-civic-darkest/50 text-center leading-normal pt-3 border-t border-civic-primary/15 font-mono">
            Secure, community-scoped Firestore persistence.
          </div>

        </div>
      </div>
    );
  }

  // 3. ONBOARDING (IF SIGNED IN BUT NO NEIGHBORHOOD ESTABLISHED)
  if (!userProfile?.communityId) {
    return (
      <div className="min-h-screen bg-civic-light flex flex-col justify-between selection:bg-civic-accent selection:text-civic-darkest">
        {/* Onboarding Header */}
        <header className="bg-civic-darkest text-white px-6 py-4.5 flex justify-between items-center shadow-md">
          <div className="flex items-center space-x-2">
            <Zap className="h-6 w-6 text-civic-accent" />
            <span className="font-display font-bold text-lg tracking-tight">CivicPulse Onboarding</span>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-xs text-white/70 font-semibold">{userProfile.name}</span>
            <button 
              onClick={signOutUser}
              className="text-xs text-civic-accent hover:underline flex items-center space-x-1"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        <div className="flex-grow flex flex-col justify-center">
          {communitiesLoaded && isFirstRun && !dismissFirstRun ? (
            <Suspense fallback={<ViewFallback />}>
              <FirstRunWelcome 
                onCreateFirst={() => {
                  setForceOnboardingTab('create');
                  setHideJoinTab(true);
                  setDismissFirstRun(true);
                }}
                onJoinInvited={() => {
                  setForceOnboardingTab('join');
                  setHideJoinTab(false);
                  setDismissFirstRun(true);
                }}
              />
            </Suspense>
          ) : (
            <Suspense fallback={<ViewFallback />}>
              <Onboarding initialTab={forceOnboardingTab || undefined} hideJoinTab={hideJoinTab} />
            </Suspense>
          )}
        </div>
      </div>
    );
  }

  // 4. MAIN COMMUNITY DASHBOARD
  return (
    <div className="min-h-screen bg-civic-light flex flex-col justify-between selection:bg-civic-accent selection:text-civic-darkest">
      
      {/* Header Board with Dark Glassmorphism */}
      <header className="glass-dark sticky top-0 text-white px-8 py-4.5 flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-lg space-y-3 sm:space-y-0 shrink-0 z-50">
        
        {/* Left Side branding */}
        <div className="flex items-center space-x-3.5">
          <div className="bg-civic-primary/20 p-2.5 rounded-xl border border-civic-accent/15">
            <Zap className="h-5 w-5 text-civic-accent animate-pulse" />
          </div>
          <div>
            <span className="font-display font-bold text-xl tracking-tight block">CivicPulse</span>
            <span className="text-[9px] text-civic-accent font-mono block tracking-widest uppercase font-bold">
              neighborhood community engine
            </span>
          </div>
        </div>

        {/* Right Side profile audit */}
        <div className="flex items-center space-x-4.5">
          
          {/* Notification Bell Dropdown with neumorphic/glass look */}
          <div className="relative">
            <button
              onClick={() => setShowNotificationsMenu(!showNotificationsMenu)}
              className="relative p-3 text-white/80 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition duration-300 flex items-center justify-center cursor-pointer shadow-inner hover:scale-[1.02]"
            >
              {unreadCount > 0 ? (
                <BellRing className="h-4.5 w-4.5 text-civic-accent animate-bounce" />
              ) : (
                <Bell className="h-4.5 w-4.5" />
              )}
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-[8px] font-bold text-white h-4.5 w-4.5 rounded-full flex items-center justify-center border border-civic-darkest">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotificationsMenu && (
              <div className="absolute right-0 mt-3.5 w-80 bg-white border border-civic-primary/15 rounded-2xl shadow-2xl py-3 z-50 text-civic-darkest max-h-[380px] overflow-y-auto flex flex-col glass-light">
                <div className="px-4 pb-2 border-b border-civic-primary/10 flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-civic-dark">Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllNotificationsAsRead()}
                      className="text-[10px] text-civic-primary hover:underline font-bold cursor-pointer"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="flex-grow overflow-y-auto divide-y divide-civic-primary/5">
                  {notifications.length === 0 ? (
                    <div className="py-8 px-4 text-center text-xs text-civic-darkest/45 leading-relaxed font-medium">
                      No notifications yet. You will get alerted when community issues are updated or escalated!
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => {
                          if (notif.linkedIssueId) {
                            setSelectedIssueId(notif.linkedIssueId);
                            setIsReporting(false);
                          }
                          markNotificationAsRead(notif.id);
                          setShowNotificationsMenu(false);
                        }}
                        className={`p-3.5 text-left transition relative cursor-pointer ${
                          notif.linkedIssueId ? 'hover:bg-white/40' : ''
                        } ${!notif.isRead ? 'bg-civic-primary/5 font-semibold border-l-2 border-civic-primary' : ''}`}
                      >
                        <div className="flex items-start space-x-2.5">
                          <div className={`p-1.5 rounded-lg mt-0.5 shrink-0 ${
                            notif.type === 'issue_escalation' ? 'bg-red-50 text-red-600' :
                            notif.type === 'chat_message' ? 'bg-blue-50 text-blue-600' :
                            'bg-green-50 text-green-600'
                          }`}>
                            {notif.type === 'issue_escalation' ? (
                              <ShieldAlert className="h-3.5 w-3.5" />
                            ) : notif.type === 'chat_message' ? (
                              <MessageSquare className="h-3.5 w-3.5" />
                            ) : (
                              <Sparkles className="h-3.5 w-3.5" />
                            )}
                          </div>
                          <div className="flex-grow space-y-0.5 min-w-0">
                            <div className="flex justify-between items-baseline">
                              <span className="text-[11px] font-bold text-civic-darkest truncate block pr-2">
                                {notif.title}
                              </span>
                              <span className="text-[9px] text-civic-darkest/40 shrink-0">
                                {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-[10px] text-civic-darkest/75 leading-normal line-clamp-2">
                              {notif.message}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Scorecard - Neumorphic dark styling */}
          <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl flex items-center space-x-3 text-xs shadow-inner">
            <UserAvatar src={userProfile.photoURL} name={userProfile.name} className="w-7 h-7" />
            <div>
              <span className="block font-bold text-white leading-none">{userProfile.name}</span>
              <span className="block text-[10px] text-civic-accent font-mono font-bold mt-0.5 tracking-wider uppercase">
                🏆 {userProfile.points} PTS
              </span>
            </div>
          </div>

          {/* Sign Out CTA */}
          <button 
            onClick={signOutUser}
            className="text-white/60 hover:text-white hover:scale-105 transition cursor-pointer"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>

      </header>

      {/* Primary Workspace container */}
      <div className="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-0 items-stretch">
        
        {/* Left Sidebar Nav Columns with glassmorphism styling */}
        <nav className="lg:col-span-2 glass-light border-r border-civic-primary/10 py-8 flex flex-col justify-between shadow-md shrink-0">
          
          <div className="space-y-7">
            <span className="block px-6 text-[10px] font-bold uppercase tracking-widest text-civic-darkest/55 font-mono">
              Workspace Scope
            </span>

            <div className="space-y-1.5 px-3">
              <button
                onClick={() => { setActiveTab('feed'); setSelectedIssueId(null); setIsReporting(false); }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                  activeTab === 'feed' && !isReporting && !selectedIssueId
                    ? 'bg-civic-primary text-white shadow-md border-b-2 border-civic-primary/40' 
                    : 'text-civic-darkest hover:bg-[#c2cbbe] hover:translate-x-1'
                }`}
              >
                <MapPin className="h-4.5 w-4.5 shrink-0" />
                <span>Hazard Maps</span>
              </button>

              <button
                onClick={() => { setActiveTab('chat'); setSelectedIssueId(null); setIsReporting(false); }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                  activeTab === 'chat' 
                    ? 'bg-civic-primary text-white shadow-md border-b-2 border-civic-primary/40' 
                    : 'text-civic-darkest hover:bg-[#c2cbbe] hover:translate-x-1'
                }`}
              >
                <MessageSquare className="h-4.5 w-4.5 shrink-0" />
                <span>Community Chat</span>
              </button>

              <button
                onClick={() => { setActiveTab('impact'); setSelectedIssueId(null); setIsReporting(false); }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                  activeTab === 'impact' 
                    ? 'bg-civic-primary text-white shadow-md border-b-2 border-civic-primary/40' 
                    : 'text-civic-darkest hover:bg-[#c2cbbe] hover:translate-x-1'
                }`}
              >
                <BarChart2 className="h-4.5 w-4.5 shrink-0" />
                <span>Transparency Hub</span>
              </button>

              <button
                onClick={() => { setActiveTab('leaderboard'); setSelectedIssueId(null); setIsReporting(false); }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                  activeTab === 'leaderboard' 
                    ? 'bg-civic-primary text-white shadow-md border-b-2 border-civic-primary/40' 
                    : 'text-civic-darkest hover:bg-[#c2cbbe] hover:translate-x-1'
                }`}
              >
                <Trophy className="h-4.5 w-4.5 shrink-0" />
                <span>Leaderboard</span>
              </button>
            </div>

            <span className="block px-6 text-[10px] font-bold uppercase tracking-widest text-civic-darkest/55 pt-5 border-t border-civic-primary/10 font-mono">
              Technical Gateways
            </span>

            <div className="space-y-1.5 px-3">
              {/* official repair workspace */}
              <button
                onClick={() => { setActiveTab('queue'); setSelectedIssueId(null); setIsReporting(false); }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                  activeTab === 'queue' 
                    ? 'bg-civic-primary text-white shadow-md border-b-2 border-civic-primary/40' 
                    : 'text-civic-darkest hover:bg-[#c2cbbe] hover:translate-x-1'
                }`}
              >
                <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
                <span>Official Queue</span>
              </button>

              {/* technical diagram */}
              <button
                onClick={() => { setActiveTab('blueprint'); setSelectedIssueId(null); setIsReporting(false); }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                  activeTab === 'blueprint' 
                    ? 'bg-civic-primary text-white shadow-md border-b-2 border-civic-primary/40' 
                    : 'text-civic-darkest hover:bg-[#c2cbbe] hover:translate-x-1'
                }`}
              >
                <HelpCircle className="h-4.5 w-4.5 shrink-0" />
                <span>9 Agent Blueprint</span>
              </button>
            </div>
          </div>

          {/* Sidebar footer community display */}
          <div className="px-6 py-4.5 bg-civic-primary/5 border-t border-civic-primary/10 space-y-1.5">
            <span className="block text-[8px] uppercase tracking-widest font-bold text-civic-darkest/45 font-mono">scoped catchment</span>
            <span className="block text-xs font-bold text-civic-darkest leading-tight truncate">{currentCommunity?.name}</span>
          </div>

          {/* GPS Simulation Panel */}
          <div className="px-6 py-4 bg-[#cad2c5]/25 border-t border-civic-primary/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="block text-[8px] uppercase tracking-widest font-bold text-civic-darkest/60 font-mono">GPS Simulator</span>
              <span className={`h-2 w-2 rounded-full ${simulatedLocation ? 'bg-civic-primary animate-pulse' : 'bg-gray-400'}`}></span>
            </div>
            
            <div className="space-y-1.5">
              {issues && issues.filter((i: any) => i.severity === 'Critical' && i.status !== 'Completed').slice(0, 2).map((critIssue) => (
                <button
                  key={critIssue.id}
                  onClick={() => {
                    // Teleport 40 meters away from the critical issue to trigger proximity alarm
                    setSimulatedLocation({
                      lat: critIssue.lat + 0.0002,
                      lng: critIssue.lng - 0.0002
                    });
                    // Reset dismissed so proximity alert triggers instantly
                    setDismissedAlerts(prev => prev.filter(id => id !== critIssue.id));
                  }}
                  className="w-full text-left text-[9px] bg-red-50 hover:bg-red-100 border border-red-200 text-red-900 rounded px-2.5 py-1.5 font-bold cursor-pointer leading-tight flex items-center justify-between transition-colors"
                  title={`Teleport near ${critIssue.title}`}
                >
                  <span className="truncate pr-1">Walk near: {critIssue.title}</span>
                  <span className="shrink-0 text-red-700 font-extrabold text-[8px]">🚨 GO</span>
                </button>
              ))}
              
              {simulatedLocation ? (
                <button
                  onClick={() => setSimulatedLocation(null)}
                  className="w-full text-center text-[9px] bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded py-1.5 font-bold cursor-pointer font-mono"
                >
                  Disable Sim (Use Real GPS)
                </button>
              ) : (
                <span className="block text-[8px] text-civic-darkest/50 font-mono leading-normal">
                  {realLocation ? `Real: ${realLocation.lat.toFixed(4)}, ${realLocation.lng.toFixed(4)}` : 'Waiting for Device GPS...'}
                </span>
              )}
            </div>
          </div>

        </nav>

        {/* Dynamic Inner views column right */}
        <main className="lg:col-span-10 flex flex-col justify-between overflow-y-auto min-h-[500px]">
          
          <div className="flex-grow">
            <Suspense fallback={<ViewFallback />}>
              {isReporting ? (
                <ReportIssue 
                  onBack={() => setIsReporting(false)}
                  onNavigateToIssue={(id) => { setIsReporting(false); setSelectedIssueId(id); }}
                />
              ) : selectedIssueId ? (
                <IssueDetail 
                  issueId={selectedIssueId} 
                  onBack={() => setSelectedIssueId(null)}
                />
              ) : (
                <>
                  {activeTab === 'feed' && (
                    <MapAndFeed 
                      onSelectIssue={(id) => setSelectedIssueId(id)}
                      onNavigateToReport={() => setIsReporting(true)}
                    />
                  )}
                  {activeTab === 'chat' && (
                    <CommunityChat 
                      onNavigateToIssue={(id) => setSelectedIssueId(id)}
                    />
                  )}
                  {activeTab === 'impact' && <ImpactDashboard />}
                  {activeTab === 'leaderboard' && <LeaderboardProfile />}
                  {activeTab === 'queue' && <DepartmentQueue />}
                  {activeTab === 'blueprint' && <HowItWorks />}
                </>
              )}
            </Suspense>
          </div>

          {/* Humble, literal footer conforming to guidelines */}
          <footer className="bg-white/80 py-4.5 px-6 text-center text-[10px] text-civic-darkest/50 border-t border-civic-primary/10 shrink-0">
            <p>&copy; 2026 CivicPulse Hyperlocal Workspace. All processes secured by Community Catchment Rules.</p>
          </footer>

        </main>

      </div>

      {/* Geolocation Proximity Alert Banner */}
      {nearbyCriticalIssue && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] max-w-md w-full px-4">
          <div className="bg-red-600 text-white p-4.5 rounded-2xl border border-red-500 shadow-2xl flex items-start space-x-3.5 animate-bounce">
            <div className="bg-white/10 p-2 rounded-xl border border-white/20 shrink-0">
              <ShieldAlert className="h-5 w-5 text-white animate-pulse" />
            </div>
            
            <div className="flex-grow min-w-0 space-y-1">
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] font-mono uppercase tracking-widest font-extrabold text-white">
                  🚨 PROXIMITY ALERT &bull; {nearbyCriticalIssue.distance}m
                </span>
              </div>
              <h4 className="font-bold text-xs truncate leading-tight">{nearbyCriticalIssue.issue.title}</h4>
              <p className="text-[10px] text-white/90 leading-relaxed font-sans line-clamp-1">
                You entered the active hazard radius! Verify or report status updates.
              </p>
              
              <div className="pt-2 flex space-x-2">
                <button
                  onClick={() => {
                    setSelectedIssueId(nearbyCriticalIssue.issue.id);
                    setIsReporting(false);
                    // Automatically dismiss from immediate banner so they don't get trapped in a loop
                    setDismissedAlerts(prev => [...prev, nearbyCriticalIssue.issue.id]);
                  }}
                  className="bg-white text-red-900 hover:bg-red-50 px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition cursor-pointer"
                >
                  View Details
                </button>
                <button
                  onClick={() => setDismissedAlerts(prev => [...prev, nearbyCriticalIssue.issue.id])}
                  className="bg-red-700 hover:bg-red-800 text-white border border-red-500/30 px-3 py-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Active Toast Notification */}
      {activeToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-civic-darkest text-white p-4 rounded-2xl border border-civic-accent/30 shadow-2xl flex items-start space-x-3 transition-all duration-300 transform translate-y-0 opacity-100">
          <div className="bg-civic-primary/20 p-2 rounded-xl text-civic-accent shrink-0">
            {activeToast.type === 'issue_escalation' ? (
              <ShieldAlert className="h-5 w-5 text-red-400 animate-pulse" />
            ) : activeToast.type === 'chat_message' ? (
              <MessageSquare className="h-5 w-5 text-blue-400" />
            ) : (
              <Sparkles className="h-5 w-5 text-green-400 animate-pulse" />
            )}
          </div>
          <div className="flex-grow space-y-1">
            <div className="flex justify-between items-start">
              <span className="font-bold text-xs tracking-tight">{activeToast.title}</span>
              <button
                onClick={() => setActiveToast(null)}
                className="text-white/40 hover:text-white text-xs font-bold leading-none cursor-pointer"
              >
                ×
              </button>
            </div>
            <p className="text-[11px] text-white/75 leading-relaxed">{activeToast.message}</p>
            {activeToast.linkedIssueId && (
              <button
                onClick={() => {
                  setSelectedIssueId(activeToast.linkedIssueId!);
                  setIsReporting(false);
                  markNotificationAsRead(activeToast.id);
                  setActiveToast(null);
                }}
                className="text-[10px] text-civic-accent hover:underline flex items-center space-x-1 font-semibold mt-1 cursor-pointer"
              >
                <span>View Issue</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}
