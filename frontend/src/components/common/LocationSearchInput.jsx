import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Search, CheckCircle2, Loader2, Navigation, AlertCircle, X, Building2, Landmark, GraduationCap, Train } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { searchLocationSuggestions, reverseGeocodeCoordinates } from '../../services/locationService';

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function MapUpdater({ lat, lon }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lon) {
      map.flyTo([lat, lon], 16, { animate: true, duration: 1.0 });
    }
  }, [lat, lon, map]);
  return null;
}

/**
 * Return an appropriate Lucide icon depending on place category
 */
function getPlaceIcon(type = '') {
  const t = type.toLowerCase();
  if (t.includes('college') || t.includes('university') || t.includes('school')) {
    return <GraduationCap className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />;
  }
  if (t.includes('station') || t.includes('railway') || t.includes('transit')) {
    return <Train className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />;
  }
  if (t.includes('building') || t.includes('hotel') || t.includes('hall') || t.includes('commercial')) {
    return <Building2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />;
  }
  if (t.includes('monument') || t.includes('tourism') || t.includes('attraction') || t.includes('fort')) {
    return <Landmark className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />;
  }
  return <MapPin className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />;
}

export const LocationSearchInput = ({
  location = '',
  latitude = null,
  longitude = null,
  onChange,
  placeholder = '🔍 Search college, venue, landmark, street, city...',
  required = true,
}) => {
  const [query, setQuery] = useState(location || '');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [noResults, setNoResults] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Local state for the Leaflet map preview & marker
  const [localLat, setLocalLat] = useState(latitude || null);
  const [localLon, setLocalLon] = useState(longitude || null);
  const [localAddress, setLocalAddress] = useState(location || '');
  const [isConfirmed, setIsConfirmed] = useState(!!(latitude && longitude));

  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const markerRef = useRef(null);

  // Synchronize when external props change
  useEffect(() => {
    if (location !== undefined && location !== localAddress) {
      setQuery(location || '');
      setLocalAddress(location || '');
    }
    if (latitude !== undefined) setLocalLat(latitude);
    if (longitude !== undefined) setLocalLon(longitude);
    if (latitude && longitude) setIsConfirmed(true);
  }, [location, latitude, longitude]);

  // Click outside listener to close suggestions
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Perform search with debounce and cancellation of stale requests
  const performSearch = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.trim().length < 3) {
      setSuggestions([]);
      setIsSearching(false);
      setNoResults(false);
      setErrorMsg('');
      return;
    }

    // Cancel existing pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsSearching(true);
    setErrorMsg('');
    setNoResults(false);

    try {
      const results = await searchLocationSuggestions(searchQuery, abortControllerRef.current.signal);
      setSuggestions(results);
      setHighlightedIndex(-1);
      if (results.length === 0) {
        setNoResults(true);
      } else {
        setNoResults(false);
      }
      setShowDropdown(true);
    } catch (err) {
      if (err.name === 'AbortError') {
        // Ignored aborted stale request
        return;
      }
      console.error('Location search error:', err);
      setErrorMsg('Live location search temporarily unavailable. You can type manual venue details.');
      setShowDropdown(true);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Handle typing in input
  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setLocalAddress(val);
    setIsConfirmed(false);

    // Keep manual text entry available if provider cannot find or user enters manual venue
    if (onChange) {
      onChange({
        location: val,
        latitude: null,
        longitude: null,
      });
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (val.trim().length >= 3) {
      setIsSearching(true);
      setShowDropdown(true);
      setErrorMsg('');
      setNoResults(false);
      debounceTimerRef.current = setTimeout(() => {
        performSearch(val);
      }, 300);
    } else {
      setSuggestions([]);
      setShowDropdown(false);
      setIsSearching(false);
      setNoResults(false);
      setErrorMsg('');
    }
  };

  // When user selects a suggestion from dropdown
  const handleSelect = (item) => {
    const newLat = parseFloat(item.latitude);
    const newLon = parseFloat(item.longitude);
    const formattedAddress = item.formattedAddress || item.name;

    setQuery(formattedAddress);
    setLocalAddress(formattedAddress);
    setLocalLat(newLat);
    setLocalLon(newLon);
    setIsConfirmed(true);
    setShowDropdown(false);
    setSuggestions([]);
    setErrorMsg('');
    setNoResults(false);

    if (onChange) {
      onChange({
        location: formattedAddress,
        latitude: newLat,
        longitude: newLon,
      });
    }
  };

  // Keyboard navigation inside dropdown
  const handleKeyDown = (e) => {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  // Handle marker drag end on the Leaflet map
  const handleDragEnd = useCallback(async () => {
    const marker = markerRef.current;
    if (marker != null) {
      const { lat, lng } = marker.getLatLng();
      setLocalLat(lat);
      setLocalLon(lng);
      setIsSearching(true);

      const resolvedAddress = await reverseGeocodeCoordinates(lat, lng);
      setIsSearching(false);

      if (resolvedAddress) {
        setLocalAddress(resolvedAddress);
        setQuery(resolvedAddress);
        setIsConfirmed(true);
        if (onChange) {
          onChange({
            location: resolvedAddress,
            latitude: lat,
            longitude: lng,
          });
        }
      } else {
        if (onChange) {
          onChange({
            location: localAddress || query,
            latitude: lat,
            longitude: lng,
          });
        }
      }
    }
  }, [localAddress, query, onChange]);

  // Handle clear input
  const handleClear = () => {
    setQuery('');
    setLocalAddress('');
    setLocalLat(null);
    setLocalLon(null);
    setIsConfirmed(false);
    setSuggestions([]);
    setShowDropdown(false);
    setErrorMsg('');
    setNoResults(false);
    if (onChange) {
      onChange({
        location: '',
        latitude: null,
        longitude: null,
      });
    }
    inputRef.current?.focus();
  };

  const hasMapLocation =
    localLat !== null &&
    localLon !== null &&
    localLat !== undefined &&
    localLon !== undefined &&
    !isNaN(localLat) &&
    !isNaN(localLon);

  return (
    <div className="space-y-4" ref={dropdownRef}>
      {/* Search Input Box */}
      <div className="relative">
        <MapPin className="w-4 h-4 text-purple-400 absolute left-3 top-3.5 z-10 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          required={required}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0 || (query.trim().length >= 3 && (noResults || errorMsg))) {
              setShowDropdown(true);
            }
          }}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-12 py-2.5 text-white placeholder-slate-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/40 outline-none transition-colors"
          placeholder={placeholder}
          autoComplete="off"
        />

        {/* Right Status / Action Icons */}
        <div className="absolute right-3 top-3 flex items-center gap-1.5 z-10">
          {isSearching && (
            <Loader2 className="w-4 h-4 text-brand-400 animate-spin" />
          )}

          {!isSearching && isConfirmed && hasMapLocation && (
            <span title="Location coordinates confirmed">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </span>
          )}

          {query && !isSearching && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              title="Clear location"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Autocomplete Dropdown */}
        {showDropdown && (
          <div className="absolute z-[100] w-full mt-1.5 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md">
            {/* Header / Filter indicator */}
            <div className="px-3.5 py-1.5 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
              <span className="flex items-center gap-1.5 font-medium">
                <Search className="w-3 h-3 text-brand-400" />
                Live Map Search (India)
              </span>
              <span>OSM / Geoapify Compatible</span>
            </div>

            {/* Suggestions list */}
            {suggestions.length > 0 && (
              <ul className="max-h-64 overflow-y-auto overflow-x-hidden divide-y divide-slate-800/60">
                {suggestions.map((item, idx) => {
                  const isHighlighted = idx === highlightedIndex;
                  return (
                    <li
                      key={item.id || idx}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`px-4 py-3 cursor-pointer flex items-start gap-3 transition-colors ${
                        isHighlighted ? 'bg-slate-800/90 text-white' : 'hover:bg-slate-800/60 text-slate-200'
                      }`}
                    >
                      {getPlaceIcon(item.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-100 truncate">
                            {item.name}
                          </p>
                          {item.type && (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700/60 text-purple-300 shrink-0">
                              {item.type.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                        {item.address && (
                          <p className="text-xs text-slate-400 truncate mt-0.5">
                            {item.address}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Loading state indicator */}
            {isSearching && suggestions.length === 0 && (
              <div className="px-4 py-4 flex items-center justify-center gap-2.5 text-xs text-slate-300">
                <Loader2 className="w-4 h-4 text-brand-400 animate-spin" />
                <span>Searching live locations across India...</span>
              </div>
            )}

            {/* No results state */}
            {!isSearching && noResults && (
              <div className="p-4 space-y-1 text-xs">
                <div className="flex items-center gap-2 text-amber-300 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>No matching locations found in India</span>
                </div>
                <p className="text-[11px] text-slate-400 pl-6">
                  You can keep your custom venue name as entered. Manual text entry is supported.
                </p>
              </div>
            )}

            {/* Error state */}
            {!isSearching && errorMsg && (
              <div className="p-4 space-y-1 text-xs">
                <div className="flex items-center gap-2 text-rose-400 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
                <p className="text-[11px] text-slate-400 pl-6">
                  You can proceed with manual text entry.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Map Preview & Pin Dragging Area */}
      {hasMapLocation && (
        <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-4 space-y-4">
          <div className="w-full h-56 rounded-xl overflow-hidden border border-slate-800 relative z-0">
            <MapContainer
              center={[localLat, localLon]}
              zoom={16}
              scrollWheelZoom={true}
              style={{ width: '100%', height: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker
                position={[localLat, localLon]}
                draggable={true}
                eventHandlers={{
                  dragend: handleDragEnd,
                }}
                ref={markerRef}
              />
              <MapUpdater lat={localLat} lon={localLon} />
            </MapContainer>

            {/* Overlay instructions */}
            <div className="absolute top-2 left-2 z-[400] pointer-events-none">
              <span className="bg-slate-950/85 backdrop-blur-sm border border-slate-700 text-slate-200 text-[10px] font-bold px-2.5 py-1 rounded-md shadow-lg flex items-center gap-1.5">
                <Navigation className="w-3 h-3 text-brand-400" />
                Drag marker to adjust exact venue pin
              </span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1.5 flex-1 text-xs">
              <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                Selected Venue Coordinates
              </p>
              <p className="text-slate-200 font-medium leading-snug">{localAddress}</p>
              <div className="flex gap-4 text-[10px] text-slate-500 font-mono mt-1">
                <span>Lat: {localLat.toFixed(6)}</span>
                <span>Lon: {localLon.toFixed(6)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Location Synced
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationSearchInput;
