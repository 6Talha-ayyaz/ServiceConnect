// Thin client for OpenStreetMap's Nominatim geocoding service. This stands in for the
// Google Places/Geocoding APIs referenced in the SRS (DC-3: map provider is abstracted
// so it can be swapped) — Nominatim needs no API key, which matters since none is
// configured for this environment. Usage stays low-volume (manual search, on-drop
// reverse lookups), consistent with Nominatim's public-instance usage policy.
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

export interface GeocodeResult {
  displayName: string;
  lat: number;
  lng: number;
}

const reverseCache = new Map<string, string>();

function roundKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

export async function searchAddress(query: string): Promise<GeocodeResult[]> {
  if (query.trim().length < 3) return [];
  const url = `${NOMINATIM_BASE}/search?format=json&limit=5&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  return data.map((d) => ({ displayName: d.display_name, lat: Number(d.lat), lng: Number(d.lon) }));
}

// FR-4.15: cache geocoding results keyed by rounded coordinates to reduce API calls.
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const key = roundKey(lat, lng);
  if (reverseCache.has(key)) return reverseCache.get(key)!;

  const url = `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const data = (await res.json()) as { display_name?: string };
  if (!data.display_name) return null;

  reverseCache.set(key, data.display_name);
  return data.display_name;
}
