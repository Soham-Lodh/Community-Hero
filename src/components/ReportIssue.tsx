import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { IssueSeverity, IssueStatus } from '../types';
import { Camera, AlertTriangle, EyeOff, MapPin, Sparkles, ArrowLeft } from 'lucide-react';
import L from 'leaflet';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  shadowSize: [41, 41]
});

interface ReportIssueProps {
  onBack: () => void;
  onNavigateToIssue: (id: string) => void;
}

// Preset assets with beautiful Unsplash pictures corresponding to civic issues
const MOCK_PRESETS = [
  {
    id: 'preset_pothole',
    name: 'Roadway Pothole',
    imageUrl: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?w=600&auto=format&fit=crop&q=80',
    description: 'A deep rupture in the asphalt of the community road lane.'
  },
  {
    id: 'preset_leak',
    name: 'Water Leak',
    imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&auto=format&fit=crop&q=80',
    description: 'Fresh water gushing out onto pavement from a rusted valve.'
  },
  {
    id: 'preset_drain',
    name: 'Blocked Storm Drain',
    imageUrl: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=600&auto=format&fit=crop&q=80',
    description: 'Clogged street drain completely piled over with leaves and plastic rubbish.'
  },
  {
    id: 'preset_trash',
    name: 'Garbage Overflow',
    imageUrl: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?w=600&auto=format&fit=crop&q=80',
    description: 'Overflowing public waste receptacles scattering food litter.'
  }
];

const FALLBACK_INTAKE_BY_CATEGORY: Record<string, {
  title: string;
  description: string;
  category: string;
  severity: IssueSeverity;
  routingTag: string;
}> = {
  pothole: {
    title: "Road Surface Hazard Reported",
    description: "A road surface hazard appears to need inspection, repair, or verification by the roads department.",
    category: "Pothole",
    severity: IssueSeverity.Medium,
    routingTag: "Roads Dept"
  },
  leak: {
    title: "Water Leak on Public Path",
    description: "A visible public water leak is wasting water and creating a slip hazard near the walkway or road.",
    category: "Water Leak",
    severity: IssueSeverity.High,
    routingTag: "Water Board"
  },
  drain: {
    title: "Blocked Drain Flooding Street",
    description: "A blocked public drain is causing standing water and should be inspected before the area floods further.",
    category: "Water Leak",
    severity: IssueSeverity.High,
    routingTag: "Water Board"
  },
  trash: {
    title: "Overflowing Public Garbage Area",
    description: "Public waste appears to be overflowing or dumped, creating sanitation concerns and blocking normal community use.",
    category: "Garbage Overflow",
    severity: IssueSeverity.Medium,
    routingTag: "Sanitation"
  },
  light: {
    title: "Broken Streetlight in Public Area",
    description: "A public lighting issue is affecting visibility or safety and should be checked by the electricity board.",
    category: "Streetlight",
    severity: IssueSeverity.Medium,
    routingTag: "Electricity Board"
  },
  damaged: {
    title: "Damaged Public Property Hazard",
    description: "Public property appears damaged and may create a safety or access issue for nearby residents.",
    category: "Damaged Property",
    severity: IssueSeverity.Medium,
    routingTag: "Roads Dept"
  }
};

function fallbackIntakeFromHint(hint: string) {
  const lower = hint.toLowerCase();
  if (lower.includes('water') || lower.includes('pipe') || lower.includes('flood')) return FALLBACK_INTAKE_BY_CATEGORY.leak;
  if (lower.includes('drain')) return FALLBACK_INTAKE_BY_CATEGORY.drain;
  if (lower.includes('trash') || lower.includes('garbage') || lower.includes('waste') || lower.includes('dump')) return FALLBACK_INTAKE_BY_CATEGORY.trash;
  if (lower.includes('light') || lower.includes('lamp') || lower.includes('electric')) return FALLBACK_INTAKE_BY_CATEGORY.light;
  if (lower.includes('bench') || lower.includes('broken') || lower.includes('tree') || lower.includes('damage')) return FALLBACK_INTAKE_BY_CATEGORY.damaged;
  return FALLBACK_INTAKE_BY_CATEGORY.pothole;
}

async function compressImageFile(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read selected image"));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode selected image"));
    img.src = dataUrl;
  });

  const maxEdge = 1280;
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

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

export default function ReportIssue({ onBack, onNavigateToIssue }: ReportIssueProps) {
  const { currentCommunity, userProfile, issues, reportIssue, upvoteIssue } = useApp();

  // Selected Image
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState<boolean>(false);

  // Form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Pothole');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<IssueSeverity>(IssueSeverity.Medium);
  const [routingTag, setRoutingTag] = useState('Roads Dept');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string>('');
  const [aiStatus, setAiStatus] = useState<string>('');

  // Location selection coords
  const [issueLat, setIssueLat] = useState<number>(37.7749);
  const [issueLng, setIssueLng] = useState<number>(-122.4194);
  const [locationSource, setLocationSource] = useState<'community' | 'gps' | 'manual'>('community');
  const [locationLoading, setLocationLoading] = useState(false);

  // Status indicators
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Geo duplicate warning state
  const [duplicateWarning, setDuplicateWarning] = useState<any | null>(null);

  // Leaflet map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pinRef = useRef<L.Marker | null>(null);

  // Initialize coordinates to active community center
  useEffect(() => {
    if (currentCommunity) {
      setIssueLat(currentCommunity.centerLat);
      setIssueLng(currentCommunity.centerLng);
      setLocationSource('community');
    }
  }, [currentCommunity]);

  const movePin = (lat: number, lng: number, source: 'gps' | 'manual' | 'community') => {
    setIssueLat(lat);
    setIssueLng(lng);
    setLocationSource(source);
    if (pinRef.current) {
      pinRef.current.setLatLng([lat, lng]);
    }
    if (mapRef.current) {
      mapRef.current.setView([lat, lng], Math.max(mapRef.current.getZoom(), 15));
    }
  };

  const detectIncidentLocation = () => {
    setError(null);
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser. Drag or click the map pin to set the incident location.");
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        movePin(position.coords.latitude, position.coords.longitude, 'gps');
        setSuccess("GPS location captured. You can still drag the pin to fine-tune the incident spot.");
        setLocationLoading(false);
      },
      () => {
        setError("Location permission was denied or unavailable. Drag or click the map pin to set the incident location.");
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (currentCommunity && locationSource === 'community') {
      detectIncidentLocation();
    }
  }, [currentCommunity?.id]);

  // Handle preset card click
  const handlePresetSelect = async (preset: typeof MOCK_PRESETS[0]) => {
    setError(null);
    setSelectedImage(preset.imageUrl);
    setImageLoading(true);

    try {
      // Call Intake Vision Agent via server API
      const response = await fetch('/api/ai/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetText: preset.description })
      });

      const data = await response.json();
      const fallback = fallbackIntakeFromHint(preset.description);
      
      setTitle(data.title || fallback.title || preset.name);
      setCategory(data.category || fallback.category);
      setDescription(data.description || fallback.description || preset.description);
      setSeverity(data.severity || fallback.severity);
      setRoutingTag(data.routingTag || fallback.routingTag);
      setAiReasoning(data.reasoning || 'Intake model complete.');
      setAiStatus(data.reasoning?.toLowerCase().includes('no ') || data.reasoning?.toLowerCase().includes('failed') ? 'Fallback autofill used.' : 'AI autofill complete.');
      setSuccess("Gemini intake agent analyzed the sample description and auto-filled report variables!");
    } catch (err: any) {
      setError("AI parsing failed, variables set to fallback.");
      setTitle(preset.name);
      setDescription(preset.description);
    } finally {
      setImageLoading(false);
    }
  };

  // Handle file/image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[files.length - 1];

    setImageLoading(true);
    (async () => {
      const base64String = await compressImageFile(file);
      setSelectedImage(base64String);
      const fallback = fallbackIntakeFromHint(file.name);

      try {
        // Call AI Intake
        const response = await fetch('/api/ai/intake', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64String, fileName: file.name })
        });

        if (!response.ok) {
          throw new Error(`AI intake HTTP ${response.status}`);
        }
        const data = await response.json();

        if (data.isValidCivicIssue === false) {
          setError("Warning: Gemini intake flagged this image as not depicting a valid public infrastructure or civic issue.");
        }

        setTitle(data.title || fallback.title);
        setCategory(data.category || fallback.category);
        setDescription(data.description || fallback.description);
        setSeverity(data.severity || fallback.severity);
        setRoutingTag(data.routingTag || fallback.routingTag);
        setAiReasoning(data.reasoning || "Vision intake analyzed successfully.");
        setAiStatus(data.reasoning?.toLowerCase().includes('no ') || data.reasoning?.toLowerCase().includes('failed') ? 'Fallback autofill used.' : 'AI autofill complete.');
        setSuccess("Gemini multimodal intake has analyzed your image and auto-filled report variables!");
      } catch (err) {
        setTitle(fallback.title);
        setCategory(fallback.category);
        setDescription(fallback.description);
        setSeverity(fallback.severity);
        setRoutingTag(fallback.routingTag);
        setAiReasoning(`Local fallback autofill used because AI intake failed for "${file.name}".`);
        setAiStatus("Local fallback autofill used.");
        setError("AI intake was unavailable, so CivicPulse used local fallback autofill from the file name. You can edit the fields before submitting.");
      } finally {
        setImageLoading(false);
      }
    })().catch((err) => {
      setError(err.message || "Unable to read photo.");
      setImageLoading(false);
    });
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || !currentCommunity) return;

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
    setTimeout(() => map.invalidateSize(), 0);

    // Draw community radius bounds
    L.circle([currentCommunity.centerLat, currentCommunity.centerLng], {
      radius: currentCommunity.radiusKm * 1000,
      color: '#52796f',
      fillColor: '#84a98c',
      fillOpacity: 0.05,
      weight: 1.5,
      dashArray: '4, 4'
    }).addTo(map);

    // Place draggable reporting pin
    const pin = L.marker([currentCommunity.centerLat, currentCommunity.centerLng], {
      draggable: true
    }).addTo(map);
    pinRef.current = pin;

    pin.on('dragend', () => {
      const pos = pin.getLatLng();
      movePin(pos.lat, pos.lng, 'manual');
    });

    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      movePin(lat, lng, 'manual');
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [currentCommunity]);

  // Submit report
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedImage) {
      setError("An image or photo is strictly required to file a report.");
      return;
    }
    if (!Number.isFinite(issueLat) || !Number.isFinite(issueLng)) {
      setError("Incident coordinates are missing. Use GPS or click the map to place the reporting pin.");
      return;
    }
    if (!title.trim() || !description.trim()) {
      setError("Please fill in both the Title and Description fields.");
      return;
    }

    // Boundary validation: Is pin within community catchment circle?
    const dist = calculateDistance(issueLat, issueLng, currentCommunity!.centerLat, currentCommunity!.centerLng);
    if (dist > currentCommunity!.radiusKm) {
      setError(`Cannot report issue here. Selected pin is ${(dist - currentCommunity!.radiusKm).toFixed(2)} km outside ${currentCommunity!.name}'s boundaries.`);
      return;
    }

    setSubmitLoading(true);

    try {
      const duplicateMatches = issues
        .filter((issue) => (
          issue.communityId === currentCommunity!.id &&
          issue.category === category &&
          issue.status !== IssueStatus.Completed &&
          Number.isFinite(issue.lat) &&
          Number.isFinite(issue.lng)
        ))
        .map((issue) => ({
          ...issue,
          distanceMeters: Math.round(calculateDistance(issueLat, issueLng, issue.lat, issue.lng) * 1000)
        }))
        .filter((issue) => issue.distanceMeters <= 150)
        .sort((a, b) => a.distanceMeters - b.distanceMeters);

      if (duplicateMatches.length > 0 && !duplicateWarning) {
        // Show duplicate intercept dialog
        setDuplicateWarning(duplicateMatches[0]);
        setSubmitLoading(false);
        return;
      }

      // Execute create
      const newIssueId = await reportIssue({
        communityId: currentCommunity!.id,
        title,
        description,
        category,
        severity,
        status: IssueStatus.Reported,
        isAnonymous,
        lat: issueLat,
        lng: issueLng,
        mediaUrls: [selectedImage],
        reporterUid: userProfile!.uid,
        reporterName: userProfile!.name,
        reporterPhoto: userProfile!.photoURL,
        aiReasoningLog: [
          {
            agentName: "Intake Agent",
            timestamp: Date.now(),
            decision: `Report Categorized under ${category}`,
            reasoning: aiReasoning || `Flipped with visual validation.`
          }
        ],
        routingTag
      });

      setSuccess(`Issue successfully reported and stored in Firestore as ${newIssueId}. +50 Community Points Earned.`);
      setTimeout(() => {
        onNavigateToIssue(newIssueId);
      }, 1500);

    } catch (err: any) {
      setError(err.message || "Failed to submit report");
    } finally {
      setSubmitLoading(false);
    }
  };

  // Intercept Duplicate and Upvote that instead
  const handleResolveAsDuplicate = async () => {
    if (!duplicateWarning || !userProfile) return;
    setError(null);
    setSubmitLoading(true);

    try {
      await upvoteIssue(duplicateWarning.id, selectedImage || undefined);
      setSuccess("Successfully verified existing issue instead of creating duplicate! +10 Points Earned.");
      setTimeout(() => {
        onBack();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to upvote matching issue.");
      setDuplicateWarning(null);
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div id="report_issue_view" className="bg-civic-light/30 p-4 md:p-8 min-h-screen selection:bg-civic-accent selection:text-civic-darkest">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header with Glassmorphism */}
        <div className="flex items-center space-x-4">
          <button 
            onClick={onBack}
            className="neumorph-out-sm hover:scale-105 p-3 rounded-xl border border-white/50 transition duration-300 text-civic-darkest cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-display font-bold text-2xl text-civic-darkest tracking-tight">File District Hazard</h1>
            <p className="text-xs text-civic-darkest/60 font-medium">Catchment Scope: <span className="text-civic-primary font-bold">{currentCommunity?.name}</span></p>
          </div>
        </div>

        {/* Duplicate Intercept Modal/Card */}
        {duplicateWarning && (
          <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-6.5 shadow-xl space-y-4.5 animate-scale-in">
            <div className="flex items-start space-x-3.5">
              <div className="bg-amber-100 p-3 rounded-2xl text-amber-900 border border-amber-200">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h2 className="font-display font-bold text-lg text-amber-950">Potential Duplicate Warning!</h2>
                <p className="text-xs text-amber-950/80 leading-relaxed mt-1">
                  Our Geo-Duplicate Inspector found a highly matching open report registered within <b>{duplicateWarning.distanceMeters}m</b>:
                </p>
                
                <div className="bg-white/70 p-4 rounded-xl border border-amber-100 mt-3 space-y-1">
                  <h4 className="font-bold text-sm text-civic-darkest">{duplicateWarning.title}</h4>
                  <p className="text-xs text-civic-darkest/75 line-clamp-2 leading-relaxed">{duplicateWarning.description}</p>
                  <div className="flex justify-between items-center text-[9px] pt-1.5 text-civic-primary font-bold uppercase tracking-wider">
                    <span>Severity: {duplicateWarning.severity}</span>
                    <span>Status: {duplicateWarning.status}</span>
                  </div>
                </div>

                <p className="text-xs text-amber-950/70 mt-3.5 leading-relaxed">
                  Would you like to upvote this existing neighborhood report and bind your uploaded image as corroborating citizen evidence instead? You will still earn points!
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-1">
              <button
                type="button"
                onClick={() => setDuplicateWarning(null)}
                className="px-4 py-2 bg-transparent text-xs font-bold text-amber-900 hover:underline cursor-pointer"
              >
                No, File Duplicate Anyway
              </button>
              <button
                type="button"
                onClick={handleResolveAsDuplicate}
                className="px-5 py-2.5 bg-civic-primary hover:bg-civic-dark text-white rounded-xl text-xs font-bold shadow-md hover:scale-[1.01] transition-all cursor-pointer border border-white/10"
              >
                Yes, Upvote & Attach Photo
              </button>
            </div>
          </div>
        )}

        {/* Form Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          
          {/* Form Fields Left - Frosted Glass panel */}
          <form onSubmit={handleSubmit} className="md:col-span-7 glass-light p-6.5 rounded-3xl border border-white space-y-5.5 shadow-md flex flex-col justify-between">
            
            <div className="space-y-5.5">
                {error && (
                <div className="bg-red-50 border border-red-200 text-red-900 rounded-xl p-4 text-xs">
                  <b>Submission Issue:</b> {error}
                </div>
              )}
              {success && (
                <div className="bg-green-50 border border-green-200 text-green-950 rounded-xl p-4 text-xs">
                  🎉 {success}
                </div>
              )}

              {/* Media/Photo selector */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-civic-darkest/75">
                  1. Evidence Documentation <span className="text-civic-primary font-bold">*</span>
                </label>

                {selectedImage ? (
                  <div className="relative h-52 rounded-2xl overflow-hidden border border-white/80 bg-[#c2cbbe]/20 flex items-center justify-center shadow-inner">
                    <img src={selectedImage} alt="Uploaded evidence" className="w-full h-full object-cover" />
                    
                    {imageLoading && (
                      <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center space-y-2 backdrop-blur-sm">
                        <Sparkles className="h-6 w-6 text-civic-primary animate-spin" />
                        <span className="text-xs font-bold text-civic-darkest font-mono">Gemini Auditing Vision...</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => { setSelectedImage(null); setTitle(''); setDescription(''); }}
                      className="absolute top-3.5 right-3.5 bg-red-100 hover:bg-red-200 text-red-800 text-[10px] uppercase px-3 py-1.5 rounded-lg font-bold border border-red-200 shadow cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    {/* File input click area styled like a Neumorphic Pocket */}
                    <div className="border-2 border-dashed border-[#84a98c]/50 hover:border-civic-primary/50 rounded-2xl p-7 text-center bg-[#c2cbbe]/20 hover:bg-[#c2cbbe]/35 transition-all duration-300 cursor-pointer relative group flex flex-col items-center justify-center space-y-2 shadow-inner">
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <Camera className="h-8 w-8 text-[#52796f]/80 group-hover:scale-110 transition-transform duration-300" />
                      <span className="text-xs font-bold text-civic-darkest leading-none">Drag Photo or Click to Upload</span>
                      <span className="text-[9px] text-civic-darkest/50 font-mono">Starts Autocomplete Vision Scanner</span>
                    </div>

                    {/* Preset helpers */}
                    <div className="mt-4.5 bg-white/20 p-3 rounded-2xl border border-white/50 shadow-inner">
                      <span className="block text-[9px] font-bold text-civic-primary uppercase tracking-widest mb-2 font-mono">
                        Instant presets (Bypass file selection)
                      </span>
                      <div className="grid grid-cols-4 gap-2">
                        {MOCK_PRESETS.map(preset => (
                          <div 
                            key={preset.id}
                            onClick={() => handlePresetSelect(preset)}
                            className="border border-white bg-white/40 rounded-xl overflow-hidden cursor-pointer hover:border-civic-primary hover:scale-[1.02] transition-transform duration-200"
                          >
                            <img src={preset.imageUrl} alt={preset.name} className="h-12 w-full object-cover" />
                            <div className="p-1 bg-[#c2cbbe]/30 text-center">
                              <span className="text-[8px] font-bold text-civic-darkest truncate block">{preset.name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              {aiStatus && (
                <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-xl p-3 text-xs font-semibold">
                  {aiStatus}
                </div>
              )}
              </div>

              {/* Title and category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-civic-darkest/75 mb-1.5">Auto-Generated Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Deep Pothole on 24th St"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4.5 py-3.5 bg-[#c2cbbe] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-civic-primary text-civic-darkest neumorph-in border-0"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-civic-darkest/75 mb-1.5">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4.5 py-3 bg-[#c2cbbe] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-civic-primary text-civic-darkest cursor-pointer neumorph-in border-0"
                  >
                    <option value="Pothole">Pothole</option>
                    <option value="Streetlight">Streetlight</option>
                    <option value="Water Leak">Water Leak</option>
                    <option value="Garbage Overflow">Garbage Overflow</option>
                    <option value="Damaged Property">Damaged Property</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-civic-darkest/75 mb-1.5">Detailed Description</label>
                <textarea
                  placeholder="What hazard is seen? What needs fixing?"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4.5 py-3.5 bg-[#c2cbbe] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-civic-primary text-civic-darkest leading-relaxed neumorph-in border-0"
                />
              </div>

              {/* Severity and Routing Tag */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-civic-darkest/75 mb-1.5">Severity Rating</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as IssueSeverity)}
                    className="w-full px-4.5 py-3 bg-[#c2cbbe] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-civic-primary text-civic-darkest cursor-pointer font-semibold neumorph-in border-0"
                  >
                    <option value="Low">Low Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="High">High Priority</option>
                    <option value="Critical">Critical Priority</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-civic-darkest/75 mb-1.5">Assigned Department</label>
                  <select
                    value={routingTag}
                    onChange={(e) => setRoutingTag(e.target.value)}
                    className="w-full px-4.5 py-3 bg-[#c2cbbe] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-civic-primary text-civic-darkest cursor-pointer neumorph-in border-0"
                  >
                    <option value="Roads Dept">Roads Dept</option>
                    <option value="Water Board">Water Board</option>
                    <option value="Sanitation">Sanitation</option>
                    <option value="Electricity Board">Electricity Board</option>
                  </select>
                </div>
              </div>

              {/* Anonymity Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-white/20 border border-white/60 rounded-xl shadow-sm">
                <div className="flex items-start space-x-2.5">
                  <EyeOff className="h-4.5 w-4.5 text-[#52796f] shrink-0 mt-0.5" />
                  <div>
                    <span className="block text-xs font-bold text-civic-darkest leading-none">Post Anonymously</span>
                    <span className="block text-[9px] text-civic-darkest/60 leading-normal mt-1">
                      Hides your avatar and name in the public list. Safe and secure.
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="h-4.5 w-4.5 accent-civic-primary cursor-pointer shadow-sm"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitLoading || imageLoading}
              className="w-full bg-civic-primary hover:bg-civic-dark text-white py-3.5 mt-5 rounded-xl font-bold transition duration-300 flex items-center justify-center space-x-2 text-xs shadow-md hover:scale-[1.01] cursor-pointer"
            >
              <span>{submitLoading ? 'Registering report with database...' : 'File Civic Report'}</span>
            </button>

          </form>

          {/* Location picker Map Right */}
          <div className="md:col-span-5 flex flex-col space-y-4">
            <div className="glass-light p-5 rounded-3xl border border-white flex-grow min-h-[350px] shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2.5 mb-2.5">
                  <div className="bg-civic-primary/10 p-1.5 rounded-xl text-civic-primary">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <h3 className="font-display font-bold text-md text-civic-darkest">2. Incident Coordinates</h3>
                </div>
                <p className="text-[10px] text-civic-darkest/70 leading-relaxed mb-4 font-medium">
                  Map boundary rules are strictly enforced. Use GPS or place the pin inside your community radius boundary.
                </p>
                <button
                  type="button"
                  onClick={detectIncidentLocation}
                  disabled={locationLoading}
                  className="mb-4 w-full bg-white/60 hover:bg-white border border-civic-primary/20 text-civic-primary py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  {locationLoading ? 'Capturing device GPS...' : 'Use Current GPS for Incident'}
                </button>
              </div>

              <div 
                ref={mapContainerRef} 
                className="flex-grow rounded-2xl border border-civic-primary/10 overflow-hidden shadow-inner bg-slate-100 min-h-[220px]"
                style={{ zIndex: 1 }}
              ></div>

              <div className="mt-4 grid grid-cols-2 gap-3 bg-white/40 p-3 rounded-xl text-xs border border-white/50 text-center">
                <div>
                  <span className="block text-[8px] uppercase tracking-wider text-civic-darkest/55 font-mono mb-0.5">Incident Lat</span>
                  <span className="font-mono font-bold text-civic-darkest">{issueLat.toFixed(5)}</span>
                </div>
                <div>
                  <span className="block text-[8px] uppercase tracking-wider text-civic-darkest/55 font-mono mb-0.5">Incident Lng</span>
                  <span className="font-mono font-bold text-civic-darkest">{issueLng.toFixed(5)}</span>
                </div>
                <div className="col-span-2">
                  <span className="block text-[8px] uppercase tracking-wider text-civic-darkest/55 font-mono mb-0.5">Source</span>
                  <span className="font-mono font-bold text-civic-primary uppercase">{locationSource}</span>
                </div>
              </div>
            </div>

            {/* AI Diagnostics panel - glass dark */}
            <div className="glass-dark text-white p-5.5 rounded-3xl shadow-md border border-white/10 space-y-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-civic-accent animate-pulse" />
                <h4 className="font-display font-bold text-[10px] uppercase tracking-wider text-civic-accent font-mono">AI DIAGNOSTICS DEEP LOG</h4>
              </div>
              <p className="text-xs text-white/70 leading-relaxed italic">
                {aiReasoning || "Please select a visual preset or upload an image to trigger real-time AI multimodal vision parsing."}
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
