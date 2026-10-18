/**
 * Location Autocomplete & Geocoding Service
 * 
 * Supports:
 * 1. Geoapify Address Autocomplete API (if VITE_GEOAPIFY_API_KEY is configured)
 * 2. Photon (Komoot OSM Autocomplete API) as open, API-key-free fallback
 * 3. Reverse geocoding for pin drag adjustments
 * 
 * Restricts queries to India by default.
 */

const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY || '';

// Bounding box for India: [minLon, minLat, maxLon, maxLat]
const INDIA_BBOX = '68.0,6.5,97.5,37.5';

/**
 * Format Photon address properties into a clean secondary address string
 */
function formatPhotonAddressParts(props) {
  const p = props || {};
  const parts = [
    p.street,
    p.locality || p.district,
    p.city || p.county,
    p.state,
    p.postcode,
    'India'
  ].filter(Boolean);
  return parts.join(', ');
}

/**
 * Autocomplete search using Geoapify
 */
async function searchGeoapify(query, signal) {
  if (!GEOAPIFY_API_KEY) return null;

  const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(
    query
  )}&filter=countrycode:in&limit=6&apiKey=${GEOAPIFY_API_KEY}`;

  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Geoapify autocomplete returned status ${res.status}`);
  }
  const data = await res.json();
  const features = data.features || [];

  return features.map((f) => {
    const p = f.properties || {};
    const name = p.name || p.address_line1 || p.formatted || 'Location';
    const address = p.address_line2 || [p.city, p.state, p.country].filter(Boolean).join(', ');
    const formattedAddress = p.formatted || (address ? `${name}, ${address}` : name);

    return {
      id: p.place_id || `${p.lat}_${p.lon}`,
      name,
      address,
      formattedAddress,
      latitude: p.lat,
      longitude: p.lon,
      type: p.category || p.result_type || 'place',
      provider: 'geoapify'
    };
  });
}

/**
 * Autocomplete search using Photon (Komoot OpenStreetMap search engine)
 * Includes smart query expansion for multi-word landmark / college names.
 */
async function searchPhoton(query, signal) {
  const cleanQ = query.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  const words = cleanQ.split(' ');

  const queryPhotonEndpoint = async (q) => {
    try {
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
        q
      )}&bbox=${INDIA_BBOX}&limit=6&lang=en`;
      const res = await fetch(url, { signal });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.features || []).filter((f) => {
        const cc = (f.properties?.countrycode || '').toUpperCase();
        const country = (f.properties?.country || '').toLowerCase();
        return cc === 'IN' || country === 'india';
      });
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      return [];
    }
  };

  // Build smart queries to find colleges / venues where OSM object name is concise
  const fetches = [queryPhotonEndpoint(cleanQ)];

  if (words.length > 2) {
    const noiseWords = new Set(['of', 'and', 'the', 'in', 'near', 'at']);
    const filtered = words.filter((w) => !noiseWords.has(w.toLowerCase()));
    if (filtered.length < words.length && filtered.length >= 2) {
      fetches.push(queryPhotonEndpoint(filtered.join(' ')));
    }
    const shortPhrase = [words[0], words[1], words[words.length - 1]].join(' ');
    if (shortPhrase !== cleanQ) {
      fetches.push(queryPhotonEndpoint(shortPhrase));
    }
  }

  const resultsLists = await Promise.all(fetches);
  const firstWord = words[0].toLowerCase();
  const allResults = resultsLists.flat();

  // Boost results where name starts with query's first word
  allResults.sort((a, b) => {
    const aName = (a.properties?.name || '').toLowerCase();
    const bName = (b.properties?.name || '').toLowerCase();
    const aStarts = aName.startsWith(firstWord);
    const bStarts = bName.startsWith(firstWord);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    return 0;
  });

  const seen = new Set();
  const formattedResults = [];

  for (const item of allResults) {
    const p = item.properties || {};
    const coords = item.geometry?.coordinates || [];
    if (coords.length < 2) continue;

    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    const name = p.name || p.street || p.city || 'Location';
    const subAddress = formatPhotonAddressParts(p);
    const formattedAddress = subAddress ? `${name}, ${subAddress}` : name;

    const key = `${name.toLowerCase()}_${lat.toFixed(3)}_${lon.toFixed(3)}`;
    if (!seen.has(key)) {
      seen.add(key);
      formattedResults.push({
        id: p.osm_id ? `osm_${p.osm_id}` : key,
        name,
        address: subAddress,
        formattedAddress,
        latitude: lat,
        longitude: lon,
        type: p.osm_value || p.type || 'place',
        provider: 'photon-osm'
      });
    }
  }

  return formattedResults.slice(0, 6);
}

/**
 * Main autocomplete function
 * @param {string} query
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>} Array of suggestion objects
 */
export async function searchLocationSuggestions(query, signal) {
  if (!query || query.trim().length < 3) {
    return [];
  }

  // 1. Try Geoapify if an API key is configured
  if (GEOAPIFY_API_KEY) {
    try {
      const geoapifyResults = await searchGeoapify(query, signal);
      if (geoapifyResults && geoapifyResults.length > 0) {
        return geoapifyResults;
      }
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn('Geoapify autocomplete search failed, falling back to OpenStreetMap Photon:', err);
    }
  }

  // 2. OpenStreetMap Photon autocomplete
  return await searchPhoton(query, signal);
}

/**
 * Reverse geocode coordinates to readable address (used when user drags the map marker)
 * @param {number} lat
 * @param {number} lon
 * @param {AbortSignal} [signal]
 * @returns {Promise<string|null>} Formatted address or null
 */
export async function reverseGeocodeCoordinates(lat, lon, signal) {
  // 1. Try Geoapify reverse if key exists
  if (GEOAPIFY_API_KEY) {
    try {
      const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=${GEOAPIFY_API_KEY}`;
      const res = await fetch(url, { signal });
      if (res.ok) {
        const data = await res.json();
        const first = data.features?.[0];
        if (first?.properties?.formatted) {
          return first.properties.formatted;
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn('Geoapify reverse geocode failed, falling back:', err);
    }
  }

  // 2. Photon reverse
  try {
    const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`;
    const res = await fetch(url, { signal });
    if (res.ok) {
      const data = await res.json();
      const first = data.features?.[0];
      if (first?.properties) {
        const p = first.properties;
        const name = p.name || p.street || p.city;
        const sub = formatPhotonAddressParts(p);
        return sub ? (name ? `${name}, ${sub}` : sub) : (name || null);
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    console.error('Reverse geocode failed:', err);
  }

  return null;
}
