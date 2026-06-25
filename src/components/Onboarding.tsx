import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { MapPin, Plus, Compass, ArrowRight, ShieldCheck, MapIcon, Info, HelpCircle } from 'lucide-react';
import L from 'leaflet';

// Fix Leaflet marker icon issues in production
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  shadowSize: [41, 41]
});

// Haversine Distance Formula (km)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
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
}

interface OnboardingProps {
  initialTab?: 'join' | 'create';
  hideJoinTab?: boolean;
}

export default function Onboarding({ initialTab, hideJoinTab = false }: OnboardingProps) {
  const { communities, joinCommunity, createCommunity } = useApp();

  // Selected home/current location
  const [userLat, setUserLat] = useState<number>(0);
  const [userLng, setUserLng] = useState<number>(0);
  
  // Tab states: 'join' or 'create'
  const [activeTab, setActiveTab] = useState<'join' | 'create'>(initialTab || 'join');
  
  // Creation state
  const [newCommName, setNewCommName] = useState('');
  const [newRadius, setNewRadius] = useState<number>(1.2); // Default 1.2 km
  const [createLat, setCreateLat] = useState<number>(0);
  const [createLng, setCreateLng] = useState<number>(0);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Refs for Leaflet Maps
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const currentCirclesRef = useRef<L.Circle[]>([]);
  const newCommCircleRef = useRef<L.Circle | null>(null);
  const newCommMarkerRef = useRef<L.Marker | null>(null);

  // Real Geolocation Detection
  const detectLocation = (mapInstance?: L.Map, markerInstance?: L.Marker) => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser. Drag the map pin to set your location manually.");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setUserLat(lat);
        setUserLng(lng);
        setCreateLat(lat);
        setCreateLng(lng);
        setLoading(false);
        setSuccess("Your real location detected. Drag the pin to fine-tune if needed.");
        const activeMap = mapInstance || mapRef.current;
        const activeMarker = markerInstance || userMarkerRef.current;
        if (activeMap && activeMarker) {
          activeMap.setView([lat, lng], 14);
          activeMarker.setLatLng([lat, lng]);
        }
      },
      (err) => {
        setLoading(false);
        setError("Location access denied or unavailable. Drag the map pin to set your location manually.");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Create Map - Neutral world-center default at zoom 2
    const map = L.map(mapContainerRef.current, {
      center: [20.0, 0.0],
      zoom: 2,
      layers: [
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        })
      ]
    });
    mapRef.current = map;

    // Add Simulated Home Pin
    const userMarker = L.marker([0, 0], {
      draggable: true,
      icon: L.icon({
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        shadowSize: [41, 41]
      })
    }).addTo(map);
    userMarker.bindPopup("<b>Your Home Location</b><br/>Drag me to check catchment radius.").openPopup();
    userMarkerRef.current = userMarker;

    // Trigger immediate geolocation on mount
    detectLocation(map, userMarker);

    // Marker Drag listener
    userMarker.on('dragend', () => {
      const position = userMarker.getLatLng();
      setUserLat(position.lat);
      setUserLng(position.lng);
      // Synchronize creation coordinates as well if tab is active
      setCreateLat(position.lat);
      setCreateLng(position.lng);
    });

    // Handle Map click to set Creation point
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      if (activeTab === 'create') {
        setCreateLat(lat);
        setCreateLng(lng);
        if (newCommMarkerRef.current) {
          newCommMarkerRef.current.setLatLng([lat, lng]);
        }
      } else {
        setUserLat(lat);
        setUserLng(lng);
        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng([lat, lng]);
        }
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync active tab modifications (Add markers or circles)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // 1. Clear previous communities circles
    currentCirclesRef.current.forEach(c => map.removeLayer(c));
    currentCirclesRef.current = [];

    // 2. Draw existing communities circles
    communities.forEach(c => {
      const isUserContained = calculateDistance(userLat, userLng, c.centerLat, c.centerLng) <= c.radiusKm;
      
      const circle = L.circle([c.centerLat, c.centerLng], {
        radius: c.radiusKm * 1000,
        color: isUserContained ? '#52796f' : '#2f3e46',
        fillColor: isUserContained ? '#84a98c' : '#354f52',
        fillOpacity: 0.15,
        weight: 2
      }).addTo(map);

      circle.bindTooltip(`<b>${c.name}</b><br/>Radius: ${c.radiusKm}km`, { permanent: false, direction: 'top' });
      currentCirclesRef.current.push(circle);
    });

    // 3. Draw/Modify "Proposed Create" circle if creating
    if (newCommCircleRef.current) {
      map.removeLayer(newCommCircleRef.current);
      newCommCircleRef.current = null;
    }
    if (newCommMarkerRef.current) {
      map.removeLayer(newCommMarkerRef.current);
      newCommMarkerRef.current = null;
    }

    if (activeTab === 'create') {
      // Draw proposed circle
      const createCircle = L.circle([createLat, createLng], {
        radius: newRadius * 1000,
        color: '#3b82f6',
        fillColor: '#60a5fa',
        fillOpacity: 0.25,
        dashArray: '5, 5',
        weight: 3
      }).addTo(map);
      newCommCircleRef.current = createCircle;

      // Draw proposed marker
      const createMarker = L.marker([createLat, createLng], {
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          shadowSize: [41, 41]
        })
      }).addTo(map);
      createMarker.bindPopup("<b>New Community Center</b>").openPopup();
      newCommMarkerRef.current = createMarker;
    }
  }, [communities, userLat, userLng, activeTab, createLat, createLng, newRadius]);

  // Sort communities by proximity to simulated home
  const communitiesWithProximity = communities.map(c => {
    const dist = calculateDistance(userLat, userLng, c.centerLat, c.centerLng);
    const inRadius = dist <= c.radiusKm;
    return {
      ...c,
      distanceKm: dist,
      inRadius
    };
  }).sort((a, b) => a.distanceKm - b.distanceKm);

  // Handle Joining
  const handleJoin = async (commId: string, name: string, inRadius: boolean) => {
    setError(null);
    if (!inRadius) {
      setError(`Cannot join ${name}. Your simulated location falls outside its boundary zone. Drag your home pin inside the circle first.`);
      return;
    }

    try {
      setLoading(true);
      await joinCommunity(commId);
      setSuccess(`Welcome to ${name}! Synchronizing neighborhood catchment...`);
    } catch (err: any) {
      setError(err.message || "Failed to join community");
    } finally {
      setLoading(false);
    }
  };

  // Handle Creation
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!newCommName.trim()) {
      setError("Please specify a community name.");
      return;
    }
    if (newRadius < 0.5 || newRadius > 5.0) {
      setError("Radius must be between 0.5km and 5.0km.");
      return;
    }

    try {
      setLoading(true);
      const commId = await createCommunity(newCommName, createLat, createLng, newRadius);
      setSuccess(`Successfully established boundary zone "${newCommName}"! Synchronizing...`);
    } catch (err: any) {
      setError(err.message || "Overlap check failed or creation rejected.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="onboarding_view" className="min-h-screen bg-civic-light p-4 md:p-8 flex flex-col justify-between selection:bg-civic-accent selection:text-civic-darkest">
      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch flex-grow">
        
        {/* Map Container Left - Glassmorphic design */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="glass-light p-5 rounded-3xl border border-white flex flex-col flex-grow min-h-[480px] shadow-md relative">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="bg-civic-primary/10 p-2 rounded-xl text-civic-primary border border-civic-primary/15">
                  <MapIcon className="h-5 w-5" />
                </div>
                <h2 className="font-display font-bold text-xl text-civic-darkest">Interactive Catchment Boundary</h2>
              </div>
              <button 
                onClick={() => detectLocation()}
                className="neumorph-out-sm px-4 py-2 rounded-xl text-xs font-bold text-civic-primary border border-white/50 flex items-center space-x-1.5 cursor-pointer"
              >
                <Compass className="h-4.5 w-4.5 animate-spin" />
                <span>Use My Location</span>
              </button>
            </div>

            <div 
              ref={mapContainerRef} 
              className="flex-grow rounded-2xl border border-civic-primary/15 overflow-hidden shadow-inner bg-slate-100"
              style={{ height: '100%', minHeight: '380px', zIndex: 1 }}
            ></div>

            <div className="mt-4 flex items-start space-x-3 bg-white/40 p-3 rounded-xl text-xs text-civic-darkest/80 border border-white/50">
              <Info className="h-4.5 w-4.5 text-civic-primary shrink-0 mt-0.5 animate-bounce" />
              <p className="leading-relaxed">
                <b>Interactive Help:</b> Drag the green home icon around the map to test your proximity. Solid circles represent active neighborhood zones. <b>Green inside highlight</b> means you can register!
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls Right */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          
          {/* Header Description - Dark Premium Glass */}
          <div className="glass-dark text-white p-6 rounded-3xl shadow-lg space-y-3 border border-white/10">
            <h1 className="font-display font-bold text-2xl tracking-tight">Onboarding Gateway</h1>
            <p className="text-xs text-white/80 leading-relaxed">
              Every citizen belongs to exactly <b>one community catchment zone</b>. Join a neighborhood to write reports, verify hazards, and coordinate live with neighbors.
            </p>
          </div>

          {/* Navigation Tab - Neumorphic tab switcher */}
          <div className="bg-[#b9c3b4] p-1.5 rounded-2xl border border-white/30 flex space-x-1.5 shadow-inner">
            <button
              onClick={() => { setActiveTab('join'); setError(null); }}
              className={`flex-1 py-3 text-center text-xs font-bold rounded-xl transition-all duration-300 cursor-pointer ${
                activeTab === 'join' 
                  ? 'bg-civic-primary text-white shadow-md' 
                  : 'text-civic-darkest hover:text-civic-primary'
              }`}
            >
              Join Proximity Neighborhood
            </button>
            <button
              onClick={() => { setActiveTab('create'); setError(null); }}
              className={`flex-1 py-3 text-center text-xs font-bold rounded-xl transition-all duration-300 cursor-pointer ${
                activeTab === 'create' 
                  ? 'bg-civic-primary text-white shadow-md' 
                  : 'text-civic-darkest hover:text-civic-primary'
              }`}
            >
              Establish New Area
            </button>
          </div>

          {/* Dynamic Forms Container - Glassmorphic card */}
          <div className="glass-light p-6 rounded-3xl border border-white flex-grow shadow-md flex flex-col justify-between space-y-4">
            
            {/* Top Notifications */}
            <div className="w-full">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-900 rounded-2xl p-4 text-xs mb-4 animate-slide-down">
                  <b>Validation Check:</b> {error}
                </div>
              )}
              {success && (
                <div className="bg-green-50 border border-green-200 text-green-950 rounded-2xl p-4 text-xs mb-4 animate-slide-down">
                  🎉 {success}
                </div>
              )}

              {/* JOIN NEIGHBORHOOD TAB */}
              {activeTab === 'join' && (
                <div className="space-y-4">
                  <div className="bg-[#e2ebd9] border border-civic-primary/25 text-civic-darkest p-3.5 rounded-2xl text-xs flex items-start space-x-2.5 shadow-inner mb-2.5">
                    <Info className="h-4.5 w-4.5 text-civic-primary shrink-0 mt-0.5 animate-pulse" />
                    <span>Click 'Use My Location' or drag the map pin to set your position and see nearby communities.</span>
                  </div>

                  <div className="flex justify-between items-center pb-2.5 border-b border-civic-primary/10">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-civic-dark font-mono">Proximity Catchments</span>
                    <span className="text-[10px] font-mono text-civic-primary font-bold">Sorted by Proximity</span>
                  </div>

                  {communitiesWithProximity.length === 0 ? (
                    <div className="text-center py-16 text-civic-darkest/50 space-y-3">
                      <HelpCircle className="h-10 w-10 mx-auto text-civic-primary/30" />
                      <p className="text-sm font-bold">No communities recorded in database yet.</p>
                      <p className="text-xs max-w-xs mx-auto leading-relaxed">Establish the very first catchment zone in your city using the tab above!</p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                      {communitiesWithProximity.map((c) => (
                        <div 
                          key={c.id} 
                          className={`p-4 rounded-2xl border transition-all duration-300 ${
                            c.inRadius 
                              ? 'neumorph-out border-white hover:border-civic-accent/60' 
                              : 'bg-white/20 border-white/40 grayscale-[25%] opacity-70'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-display font-bold text-md text-civic-darkest">{c.name}</h3>
                              <div className="flex space-x-3 mt-1.5 text-[10px] text-civic-darkest/60 font-mono">
                                <span>Dist: <b>{c.distanceKm.toFixed(2)} km</b></span>
                                <span>Radius: <b>{c.radiusKm} km</b></span>
                                <span>Members: <b>{c.memberUids?.length || 1}</b></span>
                              </div>
                            </div>

                            {c.inRadius ? (
                              <span className="bg-green-100 text-green-800 text-[8px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border border-green-200 shadow-sm">
                                INSIDE BOUNDARY
                              </span>
                            ) : (
                              <span className="bg-gray-100 text-gray-600 text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-gray-200">
                                OUTSIDE ({(c.distanceKm - c.radiusKm).toFixed(2)}km)
                              </span>
                            )}
                          </div>

                          <div className="mt-4 flex justify-end">
                            <button
                              disabled={loading}
                              onClick={() => handleJoin(c.id, c.name, c.inRadius)}
                              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all duration-300 cursor-pointer ${
                                c.inRadius
                                  ? 'bg-civic-primary hover:bg-civic-dark text-white shadow-md'
                                  : 'bg-gray-100 text-gray-400 cursor-not-allowed border-0'
                              }`}
                            >
                              <span>Register Zone</span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* CREATE NEIGHBORHOOD TAB */}
              {activeTab === 'create' && (
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="flex justify-between items-center pb-2.5 border-b border-civic-primary/10">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-civic-dark font-mono font-bold">Catchment Parameters</span>
                    <span className="text-[10px] font-mono text-red-700 font-bold uppercase">Strict Anti-Overlap Checks</span>
                  </div>

                  <div className="space-y-4.5">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-civic-darkest/70 mb-1.5">Neighborhood Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Mission Valley, Castro Civic Hub"
                        value={newCommName}
                        onChange={(e) => setNewCommName(e.target.value)}
                        className="w-full px-4.5 py-3.5 bg-[#c2cbbe] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-civic-primary text-civic-darkest neumorph-in border-0"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-civic-darkest/70">Catchment Radius (Km)</label>
                        <span className="font-mono text-xs font-bold text-civic-primary">{newRadius.toFixed(1)} km</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="5.0"
                        step="0.1"
                        value={newRadius}
                        onChange={(e) => setNewRadius(parseFloat(e.target.value))}
                        className="w-full accent-civic-primary cursor-pointer h-1 bg-white/50 rounded-lg appearance-none shadow-inner"
                      />
                      <div className="flex justify-between text-[9px] text-civic-darkest/55 font-mono mt-1">
                        <span>Min (0.5km)</span>
                        <span>Max (5.0km)</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-white/40 p-3 rounded-2xl border border-white/50 shadow-sm text-center">
                      <div>
                        <span className="block text-[8px] uppercase tracking-wider text-civic-darkest/55 font-mono mb-0.5">Proposed Lat</span>
                        <span className="font-mono text-xs font-bold text-civic-darkest">{createLat.toFixed(5)}</span>
                      </div>
                      <div>
                        <span className="block text-[8px] uppercase tracking-wider text-civic-darkest/55 font-mono mb-0.5">Proposed Lng</span>
                        <span className="font-mono text-xs font-bold text-civic-darkest">{createLng.toFixed(5)}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !newCommName}
                    className="w-full bg-civic-primary hover:bg-civic-dark disabled:bg-[#cad2c5]/50 disabled:text-civic-darkest/30 text-white py-3.5 rounded-xl font-bold transition duration-300 flex items-center justify-center space-x-1.5 text-xs shadow-md hover:shadow-lg cursor-pointer border border-white/10"
                  >
                    <Plus className="h-4 w-4 text-civic-accent" />
                    <span>Establish New Boundary Zone</span>
                  </button>
                </form>
              )}
            </div>

            {/* Verification Footer Indicator */}
            <div className="pt-4 border-t border-civic-primary/10 flex items-center space-x-2 text-[11px] text-civic-darkest/65 justify-center font-mono">
              <ShieldCheck className="h-4 w-4 text-civic-primary" />
              <span>Civic Boundary Geo-Validation active (Haversine formula check).</span>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
