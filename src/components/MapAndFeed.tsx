import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Issue, IssueSeverity } from '../types';
import { MapPin, ListFilter, AlertCircle, Filter, CheckCircle2, Eye, EyeOff, Search, X } from 'lucide-react';
import L from 'leaflet';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  shadowSize: [41, 41]
});

interface MapAndFeedProps {
  onSelectIssue: (issueId: string) => void;
  onNavigateToReport: () => void;
}

export default function MapAndFeed({ onSelectIssue, onNavigateToReport }: MapAndFeedProps) {
  const { currentCommunity, issues, leaveCommunity } = useApp();

  // View state: 'map' or 'feed'
  const [viewType, setViewType] = useState<'map' | 'feed'>('map');

  // Real-time Search state
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Floating map filter state
  const [floatCategory, setFloatCategory] = useState<string>('All');
  const [floatSeverity, setFloatSeverity] = useState<string>('All');
  const [isFloatOpen, setIsFloatOpen] = useState<boolean>(true);

  // Filters state (standard top bar)
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterSeverity, setFilterSeverity] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  // Unique categories list
  const categories = ['All', 'Pothole', 'Streetlight', 'Water Leak', 'Garbage Overflow', 'Damaged Property'];
  const severities = ['All', 'Low', 'Medium', 'High', 'Critical'];
  const statuses = ['All', 'Reported', 'Reviewed', 'In Progress', 'Completed'];

  // Apply filters
  const filteredIssues = issues.filter((i) => {
    // 1. Search query matching
    const matchSearch = searchQuery.trim() === '' || 
      i.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      i.description.toLowerCase().includes(searchQuery.toLowerCase());

    // 2. Standard filters from top bar
    const matchCat = filterCategory === 'All' || i.category === filterCategory;
    const matchSev = filterSeverity === 'All' || i.severity === filterSeverity;
    const matchStat = filterStatus === 'All' || i.status === filterStatus;

    // 3. Floating Filter Category mapping
    let matchFloatCat = true;
    if (floatCategory !== 'All') {
      const catLower = i.category.toLowerCase();
      if (floatCategory === 'Roads') {
        matchFloatCat = catLower.includes('road') || catLower.includes('street') || catLower.includes('pothole') || catLower.includes('light');
      } else if (floatCategory === 'Waste') {
        matchFloatCat = catLower.includes('waste') || catLower.includes('garbage') || catLower.includes('trash') || catLower.includes('overflow');
      } else if (floatCategory === 'Utility') {
        matchFloatCat = catLower.includes('utility') || catLower.includes('water') || catLower.includes('leak') || catLower.includes('electric') || catLower.includes('property') || catLower.includes('damage');
      }
    }

    // 4. Floating Filter Severity mapping
    let matchFloatSev = true;
    if (floatSeverity !== 'All') {
      matchFloatSev = i.severity === floatSeverity;
    }

    return matchSearch && matchCat && matchSev && matchStat && matchFloatCat && matchFloatSev;
  });

  // Severity to color mapping based on palette
  const getSeverityBgColor = (severity: IssueSeverity): string => {
    switch (severity) {
      case IssueSeverity.Low: return '#84a98c';      // Secondary Accent Green
      case IssueSeverity.Medium: return '#52796f';   // Interactive Green
      case IssueSeverity.High: return '#d97706';     // Warm Amber Alert
      case IssueSeverity.Critical: return '#dc2626'; // Red Alert
      default: return '#52796f';
    }
  };

  const getSeverityTextColor = (severity: IssueSeverity): string => {
    return 'text-white';
  };

  // Setup Leaflet Map
  useEffect(() => {
    if (viewType !== 'map' || !mapContainerRef.current) return;

    // Use currentCommunity if defined, else fallback to world-center [20.0, 0.0] zoom 2
    const center: [number, number] = currentCommunity 
      ? [currentCommunity.centerLat, currentCommunity.centerLng] 
      : [20.0, 0.0];
    const zoom = currentCommunity ? 14 : 2;

    const map = L.map(mapContainerRef.current, {
      center,
      zoom,
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

    // Draw community catchment circle bounds
    if (currentCommunity) {
      L.circle([currentCommunity.centerLat, currentCommunity.centerLng], {
        radius: currentCommunity.radiusKm * 1000,
        color: '#52796f',
        fillColor: '#84a98c',
        fillOpacity: 0.05,
        weight: 1.5,
        dashArray: '4, 4'
      }).addTo(map);
    }

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [viewType, currentCommunity]);

  // Synchronize Markers when issues or filters change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || viewType !== 'map') return;

    // Clear previous markers
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    // Draw filtered issues
    filteredIssues.forEach((issue) => {
      if (!Number.isFinite(issue.lat) || !Number.isFinite(issue.lng)) return;

      const bgColor = getSeverityBgColor(issue.severity);
      const symbol = issue.category[0] || '📍';

      // Custom DivIcon mapping
      const customIcon = L.divIcon({
        html: `
          <div class="relative group flex items-center justify-center">
            <div 
              style="background-color: ${bgColor};" 
              class="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-xs font-bold transition-transform duration-200 hover:scale-125 ${
                issue.severity === 'Critical' ? 'animate-pulse' : ''
              }"
            >
              <span class="${getSeverityTextColor(issue.severity)}">${symbol}</span>
            </div>
          </div>
        `,
        className: 'custom-div-pin',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([issue.lat, issue.lng], { icon: customIcon }).addTo(map);
      
      const popupContent = document.createElement('div');
      popupContent.className = "p-3 min-w-[210px] font-sans selection:bg-civic-accent";
      popupContent.innerHTML = `
        <h3 class="font-bold text-sm text-civic-darkest mb-1">${issue.title}</h3>
        <p class="text-xs text-civic-darkest/75 mb-3 leading-relaxed truncate">${issue.description}</p>
        <div class="flex justify-between items-center text-[10px] border-t border-gray-100 pt-2">
          <span style="background-color: ${bgColor}; color: #ffffff;" class="px-2.5 py-0.5 rounded-full font-bold">
            ${issue.severity}
          </span>
          <span class="text-civic-primary font-bold uppercase tracking-wide">${issue.status}</span>
        </div>
        <button id="view-details-${issue.id}" class="w-full mt-3 bg-civic-primary text-white py-2 rounded-lg text-xs font-bold hover:bg-civic-darkest transition duration-200 shadow-sm cursor-pointer">
          View Details
        </button>
      `;

      marker.bindPopup(popupContent);
      markersRef.current.push(marker);

      marker.on('popupopen', () => {
        const button = document.getElementById(`view-details-${issue.id}`);
        if (button) {
          button.onclick = () => {
            onSelectIssue(issue.id);
          };
        }
      });
    });
    if (markersRef.current.length > 0) {
      const group = L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.18), { maxZoom: 16 });
    }

  }, [filteredIssues, viewType]);

  return (
    <div id="map_feed_view" className="flex flex-col h-full bg-civic-light/30">
      
      {/* Top Banner Community Scope - Glassmorphism */}
      <div className="bg-[#cad2c5]/60 backdrop-blur-md px-6 py-5 border-b border-civic-primary/10 flex flex-col md:flex-row justify-between items-start md:items-center shadow-sm space-y-4 md:space-y-0 z-10">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="bg-civic-primary/10 p-2 rounded-xl border border-civic-primary/15 text-civic-primary shadow-inner">
              <MapPin className="h-5 w-5" />
            </div>
            <h1 className="font-display font-bold text-2xl text-civic-darkest tracking-tight">{currentCommunity?.name}</h1>
          </div>
          <p className="text-xs text-civic-darkest/75 mt-0.5">
            Scoped Radius: <b className="text-civic-primary">{currentCommunity?.radiusKm} km</b> • Active local reports: <b className="text-civic-primary">{issues.length}</b>
          </p>
        </div>

        {/* Real-time search bar */}
        <div className="relative w-full md:w-80 flex-grow md:flex-grow-0 md:mx-6">
          <input
            type="text"
            placeholder="Search hazard reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 bg-white/70 border border-civic-primary/20 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-civic-primary text-civic-darkest shadow-inner pl-9 pr-8"
          />
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-civic-darkest/40" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-base font-bold text-civic-darkest/45 hover:text-civic-darkest cursor-pointer"
            >
              ×
            </button>
          )}
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          {/* Toggle View Type - Neumorphic pill slider */}
          <div className="bg-[#b9c3b4] p-1.5 rounded-2xl flex space-x-1 border border-white/35 shrink-0 shadow-inner">
            <button
              onClick={() => setViewType('map')}
              className={`px-4.5 py-2 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                viewType === 'map' 
                  ? 'bg-civic-primary text-white shadow-md' 
                  : 'text-civic-darkest hover:text-civic-primary'
              }`}
            >
              District Map
            </button>
            <button
              onClick={() => setViewType('feed')}
              className={`px-4.5 py-2 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                viewType === 'feed' 
                  ? 'bg-civic-primary text-white shadow-md' 
                  : 'text-civic-darkest hover:text-civic-primary'
              }`}
            >
              List Feed
            </button>
          </div>

          <button
            onClick={onNavigateToReport}
            className="flex-grow md:flex-grow-0 bg-civic-primary hover:bg-civic-dark text-white px-5 py-3 rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition duration-200 flex items-center justify-center space-x-2 cursor-pointer border border-white/10"
          >
            <span className="text-sm leading-none">+</span>
            <span>Report Hazard</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar - Glassmorphic row */}
      <div className="bg-white/40 px-6 py-4.5 border-b border-civic-primary/10 grid grid-cols-1 md:grid-cols-4 gap-4 items-center backdrop-blur-md">
        
        {/* Category Selection with Neumorphic details */}
        <div className="flex items-center space-x-3 bg-white/45 px-3 py-2 rounded-xl border border-white/50 shadow-sm">
          <Filter className="h-4 w-4 text-civic-primary shrink-0" />
          <select 
            value={filterCategory} 
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full bg-transparent text-xs text-civic-darkest font-bold focus:outline-none focus:ring-0 cursor-pointer py-0.5"
          >
            {categories.map(c => (
              <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>
            ))}
          </select>
        </div>

        {/* Severity selection */}
        <div className="flex items-center space-x-3 bg-white/45 px-3 py-2 rounded-xl border border-white/50 shadow-sm">
          <AlertCircle className="h-4 w-4 text-civic-primary shrink-0" />
          <select 
            value={filterSeverity} 
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="w-full bg-transparent text-xs text-civic-darkest font-bold focus:outline-none focus:ring-0 cursor-pointer py-0.5"
          >
            {severities.map(s => (
              <option key={s} value={s}>{s === 'All' ? 'All Severities' : `Severity: ${s}`}</option>
            ))}
          </select>
        </div>

        {/* Status Selection */}
        <div className="flex items-center space-x-3 bg-white/45 px-3 py-2 rounded-xl border border-white/50 shadow-sm">
          <CheckCircle2 className="h-4 w-4 text-civic-primary shrink-0" />
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full bg-transparent text-xs text-civic-darkest font-bold focus:outline-none focus:ring-0 cursor-pointer py-0.5"
          >
            {statuses.map(st => (
              <option key={st} value={st}>{st === 'All' ? 'All Statuses' : `Status: ${st}`}</option>
            ))}
          </select>
        </div>

        {/* Proximity / Leave Circle Zone */}
        <div className="flex justify-end pr-1">
          <button 
            onClick={leaveCommunity}
            className="text-[11px] font-bold text-red-700 hover:text-red-950 transition-colors flex items-center space-x-1 cursor-pointer bg-red-50/50 hover:bg-red-50 px-3 py-2 rounded-xl border border-red-100/30"
          >
            <span>Leave Neighborhood Circle</span>
          </button>
        </div>
      </div>

      {/* Dynamic View Panel */}
      <div className="flex-grow relative h-full min-h-[480px]">
        {viewType === 'map' ? (
          <>
            <div 
              ref={mapContainerRef} 
              className="absolute inset-0 w-full h-full"
              style={{ zIndex: 1 }}
            ></div>

            {/* Floating Filter Panel */}
            <div className="absolute bottom-6 right-6 z-[400] max-w-[300px] w-full animate-fade-in font-sans">
              {isFloatOpen ? (
                <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-civic-primary/20 shadow-2xl p-4.5 space-y-4">
                  {/* Panel Header */}
                  <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                    <div className="flex items-center space-x-2">
                      <Filter className="h-4 w-4 text-civic-primary" />
                      <span className="text-xs font-bold uppercase tracking-wider text-civic-darkest">Live Map Filters</span>
                    </div>
                    <button 
                      onClick={() => setIsFloatOpen(false)}
                      className="text-civic-darkest/40 hover:text-civic-darkest p-1 hover:bg-gray-100 rounded-lg transition"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Category Section */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-civic-darkest/60">Category Focus</label>
                    <div className="flex flex-wrap gap-1.5">
                      {['All', 'Roads', 'Waste', 'Utility'].map((cat) => {
                        const isActive = floatCategory === cat;
                        return (
                          <button
                            key={cat}
                            onClick={() => setFloatCategory(cat)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                              isActive 
                                ? 'bg-civic-primary text-white shadow-md' 
                                : 'bg-[#cad2c5]/35 text-civic-darkest hover:bg-[#cad2c5]/60'
                            }`}
                          >
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Severity Section */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-civic-darkest/60">Severity Level</label>
                    <div className="flex flex-wrap gap-1.5">
                      {['All', 'Low', 'Medium', 'High', 'Critical'].map((sev) => {
                        const isActive = floatSeverity === sev;
                        return (
                          <button
                            key={sev}
                            onClick={() => setFloatSeverity(sev)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                              isActive 
                                ? 'bg-civic-primary text-white shadow-md' 
                                : 'bg-[#cad2c5]/35 text-civic-darkest hover:bg-[#cad2c5]/60'
                            }`}
                          >
                            {sev}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active Markers Summary Count */}
                  <div className="pt-2 text-[9px] font-mono font-medium text-civic-darkest/50 text-center border-t border-gray-100">
                    Showing <span className="font-bold text-civic-primary">{filteredIssues.length}</span> matching markers
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsFloatOpen(true)}
                  className="bg-civic-primary text-white p-3.5 rounded-2xl shadow-2xl hover:scale-105 transition-all flex items-center space-x-2 cursor-pointer border border-white/10 float-right animate-pulse"
                >
                  <Filter className="h-4 w-4" />
                  <span className="text-xs font-bold">Map Filters</span>
                  {(floatCategory !== 'All' || floatSeverity !== 'All') && (
                    <span className="h-2 w-2 rounded-full bg-civic-accent animate-ping"></span>
                  )}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 overflow-y-auto p-6 space-y-4 max-w-5xl mx-auto w-full custom-scrollbar">
            
            {filteredIssues.length === 0 ? (
              <div className="neumorph-out border border-white/60 rounded-3xl p-16 text-center text-civic-darkest/60 space-y-4">
                <ListFilter className="h-12 w-12 mx-auto text-civic-primary/50" />
                <h3 className="font-display font-bold text-xl text-civic-darkest">No Matching Hazard Reports</h3>
                <p className="text-xs max-w-md mx-auto leading-relaxed">
                  No community issues match your active filter criteria. Clear your filters or file a fresh neighborhood report.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6.5">
                {filteredIssues.map((issue) => {
                  const bgColor = getSeverityBgColor(issue.severity);
                  const textColor = getSeverityTextColor(issue.severity);

                  return (
                    <div 
                      key={issue.id}
                      onClick={() => onSelectIssue(issue.id)}
                      className="neumorph-out border border-white/60 hover:border-civic-accent/50 rounded-2xl overflow-hidden hover:shadow-md transition duration-300 flex flex-col justify-between cursor-pointer group"
                    >
                      <div>
                        {/* Header Image or Colored Bar */}
                        {issue.mediaUrls && issue.mediaUrls[0] ? (
                          <div className="h-44 overflow-hidden relative bg-civic-light/20 border-b border-white/40">
                            <img 
                              src={issue.mediaUrls[0]} 
                              alt={issue.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                            />
                            <div className="absolute top-3 right-3">
                              {issue.isAnonymous ? (
                                <span className="bg-civic-darkest/85 text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg flex items-center space-x-1 backdrop-blur-sm border border-white/10">
                                  <EyeOff className="h-3 w-3 text-civic-accent" />
                                  <span>Anonymous</span>
                                </span>
                              ) : (
                                <span className="bg-civic-primary/90 text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg flex items-center space-x-1 backdrop-blur-sm border border-white/10">
                                  <Eye className="h-3 w-3 text-civic-accent" />
                                  <span>Public</span>
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div style={{ height: '8px', backgroundColor: bgColor }} className="border-b border-white/20" />
                        )}

                        <div className="p-5.5 space-y-2">
                          {/* Metadata labels */}
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="font-mono text-civic-primary font-bold uppercase tracking-widest">{issue.category}</span>
                            <span className="text-civic-darkest/55 font-semibold">{new Date(issue.createdAt).toLocaleDateString()}</span>
                          </div>

                          <h3 className="font-display font-bold text-lg text-civic-darkest line-clamp-1 group-hover:text-civic-primary transition-colors leading-tight">
                            {issue.title}
                          </h3>

                          <p className="text-xs text-civic-darkest/75 line-clamp-3 leading-relaxed">
                            {issue.description}
                          </p>
                        </div>
                      </div>

                      {/* Footer Info segment */}
                      <div className="px-5.5 pb-5.5 pt-3 border-t border-white/35 bg-white/20 flex justify-between items-center">
                        <div className="flex space-x-2">
                          {/* Severity Badge */}
                          <span 
                            style={{ backgroundColor: bgColor }} 
                            className={`text-[9px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider ${textColor} shadow-sm`}
                          >
                            {issue.severity}
                          </span>

                          {/* Status Badge */}
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-civic-accent/35 text-civic-darkest border border-white/45 uppercase tracking-wider">
                            {issue.status}
                          </span>
                        </div>

                        <span className="text-xs font-mono font-bold text-civic-primary">
                          {issue.upvoteCount} votes
                        </span>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}
      </div>

    </div>
  );
}
