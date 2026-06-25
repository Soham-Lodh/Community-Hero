import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { STATIC_BADGES, UserProfile } from '../types';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Award, Trophy, Star, HelpCircle, MapPin, Activity, CheckCircle, Heart, Map, Calendar, Users } from 'lucide-react';
import L from 'leaflet';
import UserAvatar from './UserAvatar';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  shadowSize: [41, 41]
});

export default function LeaderboardProfile() {
  const { userProfile, currentCommunity, issues } = useApp();

  const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  // My Impact State and Map Refs
  const [activeRightTab, setActiveRightTab] = useState<'leaderboard' | 'impact'>('leaderboard');
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Load community leaderboard
  useEffect(() => {
    if (!currentCommunity) return;

    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const usersRef = collection(db, 'users');
        const q = query(
          usersRef,
          where('communityId', '==', currentCommunity.id),
          orderBy('points', 'desc')
        );

        const snapshot = await getDocs(q);
        const list: UserProfile[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ uid: docSnap.id, ...docSnap.data() } as UserProfile);
        });
        setLeaderboard(list);
      } catch (err) {
        console.error("Leaderboard loading failed:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [currentCommunity, userProfile?.points]);

  // Personal Impact Map rendering effect
  useEffect(() => {
    if (activeRightTab !== 'impact' || !mapContainerRef.current || !currentCommunity || !issues) return;

    // Initialize Leaflet map centered on community center
    const map = L.map(mapContainerRef.current, {
      center: [currentCommunity.centerLat, currentCommunity.centerLng],
      zoom: 14,
      layers: [
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        })
      ]
    });
    mapRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    // Draw community boundaries circle
    L.circle([currentCommunity.centerLat, currentCommunity.centerLng], {
      radius: currentCommunity.radiusKm * 1000,
      color: '#52796f',
      fillColor: '#84a98c',
      fillOpacity: 0.03,
      weight: 1.5,
      dashArray: '3, 6'
    }).addTo(map);

    // Filter personal issues (reported or upvoted)
    const personalIssues = issues.filter(
      (i: any) => i.reporterUid === userProfile?.uid || i.upvoterUids?.includes(userProfile?.uid)
    ).sort((a: any, b: any) => a.createdAt - b.createdAt); // Sort chronologically

    // Collect coordinates for chronological trails
    const trailCoordinates: L.LatLngExpression[] = [];

    personalIssues.forEach((issue: any) => {
      if (!Number.isFinite(issue.lat) || !Number.isFinite(issue.lng)) return;

      const isReportedByMe = issue.reporterUid === userProfile?.uid;
      const symbol = isReportedByMe ? '📢' : '▲';
      const markerColor = isReportedByMe ? '#52796f' : '#84a98c';

      const customIcon = L.divIcon({
        html: `
          <div class="relative flex items-center justify-center">
            <div 
              style="background-color: ${markerColor}; border-color: #ffffff;" 
              class="w-7 h-7 rounded-full border-2 shadow-md flex items-center justify-center text-[10px] font-bold text-white"
            >
              <span>${symbol}</span>
            </div>
          </div>
        `,
        className: 'personal-div-pin',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([issue.lat, issue.lng], { icon: customIcon }).addTo(map);

      const popupHtml = `
        <div style="font-family: sans-serif; padding: 6px; min-w: 160px;">
          <h4 style="margin: 0 0 4px 0; font-size: 11px; font-weight: bold; color: #1e293b;">${issue.title}</h4>
          <p style="margin: 0 0 6px 0; font-size: 10px; color: #64748b; font-weight: 500;">
            ${isReportedByMe ? '📢 You reported this hazard' : '▲ You verified & upvoted this'}
          </p>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 9px; border-top: 1px solid #f1f5f9; padding-top: 5px;">
            <span style="font-weight: bold; text-transform: uppercase; color: #52796f;">${issue.status}</span>
            <span style="color: #94a3b8;">${new Date(issue.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      `;
      marker.bindPopup(popupHtml);

      // Add to chronological trail
      trailCoordinates.push([issue.lat, issue.lng]);

      // Draw connection line from community center to highlight geographic outreach footprint
      L.polyline([[currentCommunity.centerLat, currentCommunity.centerLng], [issue.lat, issue.lng]], {
        color: '#52796f',
        weight: 1.2,
        opacity: 0.35,
        dashArray: '3, 6'
      }).addTo(map);
    });

    // Draw chronological footprint trail connecting contributions over time
    if (trailCoordinates.length > 1) {
      L.polyline(trailCoordinates, {
        color: '#d97706', // Amber line for time trail
        weight: 2,
        opacity: 0.6,
        dashArray: '5, 5'
      }).addTo(map);
    }

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [activeRightTab, currentCommunity, issues, userProfile?.uid]);

  return (
    <div id="leaderboard_profile_view" className="p-4 md:p-8 space-y-6 bg-civic-light/30 min-h-screen selection:bg-civic-accent selection:text-civic-darkest">
      
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Column: Personal Profile Badge Stand */}
        <div className="md:col-span-5 flex flex-col space-y-5">
          
          {/* User Profile Info Card - glass dark */}
          <div className="glass-dark text-white p-6.5 rounded-3xl shadow-lg border border-white/10 space-y-4.5 text-center flex flex-col justify-between">
            <div className="relative inline-block mx-auto pt-2">
              <UserAvatar src={userProfile?.photoURL} name={userProfile?.name} className="w-22 h-22 mx-auto border-4" />
              <span className="absolute bottom-0 right-1/2 translate-x-1/2 translate-y-1/2 bg-civic-accent text-civic-darkest text-[9px] font-bold tracking-wider px-3 py-1 rounded-full uppercase border border-civic-darkest shadow-sm">
                {userProfile?.role}
              </span>
            </div>

            <div className="space-y-1 pt-2">
              <h2 className="font-display font-bold text-xl tracking-tight text-white">{userProfile?.name}</h2>
              <p className="text-[11px] text-white/70 font-medium">District Catchment: <span className="text-civic-accent font-bold">{currentCommunity?.name || "None Selected"}</span></p>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-center mt-2.5">
              <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                <span className="block text-[8px] font-mono uppercase tracking-widest text-white/50">My Points</span>
                <span className="font-mono text-2xl font-bold text-civic-accent">{userProfile?.points || 0}</span>
              </div>
              <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                <span className="block text-[8px] font-mono uppercase tracking-widest text-white/50">Badges</span>
                <span className="font-mono text-2xl font-bold text-civic-accent">{userProfile?.badges?.length || 0}/7</span>
              </div>
            </div>
          </div>

          {/* Badges Cabinet with Neumorphic grids */}
          <div className="glass-light p-5 rounded-3xl border border-white shadow-sm flex-grow">
            <div className="flex items-center space-x-2 border-b border-civic-primary/15 pb-3 mb-4 shrink-0">
              <Award className="h-4.5 w-4.5 text-civic-primary" />
              <h3 className="font-display font-bold text-sm text-civic-darkest">Unlocked Medallions</h3>
            </div>

            <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
              {STATIC_BADGES.map((badge) => {
                const isEarned = userProfile?.badges?.includes(badge.id);

                return (
                  <div 
                    key={badge.id}
                    className={`p-3 rounded-2xl border text-center space-y-2.5 flex flex-col justify-between transition-all duration-300 ${
                      isEarned 
                        ? 'bg-white border-white shadow-md hover:scale-[1.02]' 
                        : 'bg-civic-light/20 border-civic-primary/5 opacity-45 shadow-inner'
                    }`}
                  >
                    <div>
                      <img 
                        src={badge.iconUrl} 
                        alt={badge.name} 
                        referrerPolicy="no-referrer"
                        className={`w-9 h-9 rounded-full mx-auto object-cover border border-gray-100 mb-1 shadow-sm ${!isEarned ? 'grayscale' : ''}`}
                      />
                      <h4 className="font-display font-bold text-[10px] text-civic-darkest leading-snug">{badge.name}</h4>
                    </div>
                    
                    <span className={`text-[8px] font-bold block py-1 px-2 rounded-lg uppercase tracking-wider font-mono ${
                      isEarned 
                        ? 'bg-green-100 text-green-800 border border-green-200' 
                        : 'bg-gray-100 text-gray-500 border border-gray-200'
                    }`}>
                      {isEarned ? 'EARNED' : 'LOCKED'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Column: Interactive Standings and My Impact tabs */}
        <div className="md:col-span-7 glass-light p-6 rounded-3xl border border-white shadow-md flex flex-col justify-between space-y-5">
          
          <div className="space-y-4">
            {/* Tab Navigation header */}
            <div className="flex border-b border-civic-primary/10 pb-3 flex-wrap gap-2 justify-between items-center">
              <div className="flex space-x-2">
                <button
                  onClick={() => setActiveRightTab('leaderboard')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                    activeRightTab === 'leaderboard'
                      ? 'bg-civic-primary text-white shadow-md'
                      : 'bg-white hover:bg-civic-light/30 border border-civic-primary/10 text-civic-darkest'
                  }`}
                >
                  <Trophy className="h-4 w-4" />
                  <span>Standings Leaderboard</span>
                </button>

                <button
                  onClick={() => setActiveRightTab('impact')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                    activeRightTab === 'impact'
                      ? 'bg-civic-primary text-white shadow-md'
                      : 'bg-white hover:bg-civic-light/30 border border-civic-primary/10 text-civic-darkest'
                  }`}
                >
                  <Activity className="h-4 w-4" />
                  <span>My Impact Sandbox</span>
                </button>
              </div>
            </div>

            {activeRightTab === 'leaderboard' ? (
              <>
                <div className="flex items-center space-x-2 pb-1.5">
                  <Trophy className="h-4 w-4 text-civic-primary animate-pulse" />
                  <h4 className="font-display font-bold text-xs uppercase tracking-wider text-civic-darkest font-mono">District Standings</h4>
                </div>

                {loading ? (
                  <div className="text-center py-16 text-xs text-civic-darkest/55 font-mono uppercase tracking-widest font-bold">
                    Loading standings...
                  </div>
                ) : leaderboard.length === 0 ? (
                  <div className="text-center py-16 text-civic-darkest/45 text-xs space-y-1.5">
                    <HelpCircle className="h-8 w-8 mx-auto text-civic-primary/20" />
                    <p className="font-medium">No leaderboard history recorded.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1.5 custom-scrollbar z-10">
                    {leaderboard.map((user, idx) => {
                      const isCurrent = user.uid === userProfile?.uid;
                      const rank = idx + 1;

                      return (
                        <div 
                          key={user.uid}
                          className={`p-3.5 rounded-2xl border flex justify-between items-center transition-all duration-300 ${
                            isCurrent 
                              ? 'bg-civic-primary/20 border-civic-primary/30 shadow-md scale-[1.01] font-semibold' 
                              : 'bg-white/50 border-white hover:bg-white/80 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-center space-x-3.5">
                            {/* Rank Circle with custom styling */}
                            <div className={`w-6.5 h-6.5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono shadow-sm ${
                              rank === 1 ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                              rank === 2 ? 'bg-gray-100 text-gray-800 border border-gray-300' :
                              rank === 3 ? 'bg-orange-100 text-orange-800 border border-orange-300' :
                              'bg-[#c2cbbe]/40 text-civic-darkest'
                            }`}>
                              {rank}
                            </div>

                            {/* Avatar */}
                            <UserAvatar src={user.photoURL} name={user.name} className="w-7.5 h-7.5" />

                            {/* Name */}
                            <span className="text-xs text-civic-darkest font-semibold truncate max-w-[140px] md:max-w-[180px]">{user.name}</span>
                          </div>

                          {/* Points / Badges summary */}
                          <div className="flex items-center space-x-3.5">
                            <div className="flex -space-x-1 hover:space-x-0.5 transition-all duration-200">
                              {user.badges?.map(badgeId => {
                                const b = STATIC_BADGES.find(item => item.id === badgeId);
                                if (!b) return null;
                                return (
                                  <img 
                                    key={badgeId}
                                    src={b.iconUrl} 
                                    alt={b.name}
                                    className="w-4 h-4 rounded-full border border-white shadow-sm"
                                  />
                                );
                              })}
                            </div>
                            <span className="font-mono text-xs font-bold text-civic-primary bg-white/70 px-2.5 py-1 rounded-lg shadow-inner border border-white/50 shrink-0">{user.points} pts</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              // Personal My Impact Sub-Dashboard
              <div className="space-y-4 animate-fade-in">
                {/* 1. Map container representing Footprint */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-baseline">
                    <span className="block text-[10px] font-mono uppercase tracking-widest font-extrabold text-civic-primary">Geo-Footprint Map</span>
                    <span className="text-[8px] font-mono text-amber-600 font-extrabold uppercase bg-amber-50 px-2 py-0.5 border border-amber-200 rounded">Amber Trail = Chronology</span>
                  </div>
                  <div 
                    ref={mapContainerRef} 
                    id="my_impact_leaflet_map" 
                    className="h-56 rounded-2xl border border-civic-primary/15 shadow-inner overflow-hidden relative z-10"
                  ></div>
                </div>

                {/* 2. Key contribution stats */}
                {(() => {
                  const reportedCount = issues ? issues.filter((i: any) => i.reporterUid === userProfile?.uid).length : 0;
                  const upvotedCount = issues ? issues.filter((i: any) => i.upvoterUids?.includes(userProfile?.uid)).length : 0;
                  const personalIssuesList = issues ? issues.filter((i: any) => i.reporterUid === userProfile?.uid || i.upvoterUids?.includes(userProfile?.uid)) : [];
                  const resolvedCount = personalIssuesList.filter((i: any) => i.status === 'Completed').length;
                  const computedImpactScore = (reportedCount * 50) + (upvotedCount * 10) + (resolvedCount * 100);

                  return (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                        <div className="bg-white p-2.5 rounded-xl border border-civic-primary/5 shadow-sm">
                          <span className="block text-[8px] uppercase tracking-wider font-mono font-bold text-civic-darkest/50">Reports</span>
                          <span className="block text-lg font-mono font-bold text-civic-primary">{reportedCount}</span>
                        </div>

                        <div className="bg-white p-2.5 rounded-xl border border-civic-primary/5 shadow-sm">
                          <span className="block text-[8px] uppercase tracking-wider font-mono font-bold text-civic-darkest/50">Endorsed</span>
                          <span className="block text-lg font-mono font-bold text-civic-primary">{upvotedCount}</span>
                        </div>

                        <div className="bg-white p-2.5 rounded-xl border border-civic-primary/5 shadow-sm">
                          <span className="block text-[8px] uppercase tracking-wider font-mono font-bold text-civic-darkest/50">Resolved</span>
                          <span className="block text-lg font-mono font-bold text-green-700">{resolvedCount}</span>
                        </div>

                        <div className="bg-white p-2.5 rounded-xl border border-civic-primary/5 shadow-sm">
                          <span className="block text-[8px] uppercase tracking-wider font-mono font-bold text-civic-darkest/50 font-mono">Impact Score</span>
                          <span className="block text-lg font-mono font-bold text-amber-600">+{computedImpactScore}</span>
                        </div>
                      </div>

                      {/* 3. Horizontal layout showing list of personal contributions */}
                      <div className="space-y-2 pt-1">
                        <span className="block text-[10px] font-mono uppercase tracking-widest font-extrabold text-civic-primary">Personal Active Engagements</span>
                        {personalIssuesList.length === 0 ? (
                          <div className="bg-white/40 border border-dashed border-civic-primary/10 rounded-2xl p-6 text-center text-xs text-civic-darkest/50 leading-relaxed font-medium">
                            No reporting or verification history recorded. Try reporting an issue to see your dynamic timeline footprint!
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-[135px] overflow-y-auto pr-1 custom-scrollbar">
                            {personalIssuesList.map((issue) => {
                              const isReportedByMe = issue.reporterUid === userProfile?.uid;
                              return (
                                <div key={issue.id} className="bg-white/50 hover:bg-white border border-civic-primary/5 p-2.5 rounded-xl flex justify-between items-center shadow-sm transition">
                                  <div className="flex items-center space-x-2 min-w-0 pr-2">
                                    <span className="text-xs shrink-0">{isReportedByMe ? '📢' : '▲'}</span>
                                    <div className="min-w-0">
                                      <h5 className="text-[11px] font-bold text-civic-darkest truncate">{issue.title}</h5>
                                      <p className="text-[8px] text-civic-darkest/45 font-mono">
                                        Joined: {new Date(issue.createdAt).toLocaleDateString()} &bull; {isReportedByMe ? 'Reporter' : 'Endorser'}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  <span className={`text-[8px] font-mono font-bold px-2 py-0.5 rounded-lg border uppercase tracking-wider shrink-0 ${
                                    issue.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-200' :
                                    issue.status === 'In Progress' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    'bg-blue-50 text-blue-700 border-blue-200'
                                  }`}>
                                    {issue.status}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}

              </div>
            )}
          </div>

          <div className="pt-4.5 border-t border-civic-primary/10 text-center flex items-center justify-center space-x-2 text-[10px] text-civic-darkest/60 font-medium font-sans">
            <Star className="h-4 w-4 text-civic-primary" />
            <span>Filing issue reports grants 50pts. Verifying and upvoting grants 10pts.</span>
          </div>

        </div>

      </div>

    </div>
  );
}
