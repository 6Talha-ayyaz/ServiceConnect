import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { searchAddress, reverseGeocode, type GeocodeResult } from "../../api/geocoding";

const pinIcon = L.divIcon({
  className: "",
  html: `<svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.7 23.3 0 15 0z" fill="#f97316"/>
    <circle cx="15" cy="15" r="6" fill="white"/>
  </svg>`,
  iconSize: [30, 42],
  iconAnchor: [15, 42],
});

function ClickToMove({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMove(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RecenterOnSignal({ lat, lng, signal }: { lat: number; lng: number; signal: number }) {
  const map = useMap();
  const prevSignal = useRef(signal);
  useEffect(() => {
    if (signal !== prevSignal.current) {
      map.setView([lat, lng], Math.max(map.getZoom(), 14));
      prevSignal.current = signal;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal]);
  return null;
}

interface MapPickerProps {
  lat: number;
  lng: number;
  onLocationChange: (lat: number, lng: number, address?: string) => void;
  radiusKm?: number;
  height?: number;
  recenterSignal?: number;
}

export function MapPicker({ lat, lng, onLocationChange, radiusKm, height = 320, recenterSignal = 0 }: MapPickerProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleMove(newLat: number, newLng: number) {
    onLocationChange(newLat, newLng);
    const address = await reverseGeocode(newLat, newLng);
    if (address) onLocationChange(newLat, newLng, address);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const results = await searchAddress(value);
      setSuggestions(results);
      setSearching(false);
    }, 500);
  }

  function handleSelectSuggestion(result: GeocodeResult) {
    onLocationChange(result.lat, result.lng, result.displayName);
    setQuery(result.displayName);
    setSuggestions([]);
  }

  return (
    <div>
      <div style={{ position: "relative", marginBottom: 10 }}>
        <input
          className="input"
          placeholder="Search for an address..."
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
        />
        {searching && (
          <span className="muted" style={{ position: "absolute", right: 12, top: 12, fontSize: 12 }}>
            Searching...
          </span>
        )}
        {suggestions.length > 0 && (
          <div
            className="glass-card"
            style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 400, padding: 6 }}
          >
            {suggestions.map((s, i) => (
              <div
                key={i}
                onClick={() => handleSelectSuggestion(s)}
                style={{ padding: 8, borderRadius: 8, cursor: "pointer", fontSize: 13 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {s.displayName}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ height, borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border)" }}>
        <MapContainer center={[lat, lng]} zoom={13} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker
            position={[lat, lng]}
            icon={pinIcon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const marker = e.target as L.Marker;
                const pos = marker.getLatLng();
                handleMove(pos.lat, pos.lng);
              },
            }}
          />
          {radiusKm !== undefined && <Circle center={[lat, lng]} radius={radiusKm * 1000} pathOptions={{ color: "#f97316", fillOpacity: 0.08 }} />}
          <ClickToMove onMove={handleMove} />
          <RecenterOnSignal lat={lat} lng={lng} signal={recenterSignal} />
        </MapContainer>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
        Click the map or drag the pin to set the exact location.
      </p>
    </div>
  );
}
