// Map view: birth places and current locations on an OpenStreetMap
// (Leaflet) map, with a line from birth place to current location
// for everyone who has both — the family's migration story in one
// picture. Places are geocoded via Nominatim once and cached in
// localStorage; places that can't be found are listed honestly.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Person } from "@/lib/types";
import { displayName } from "./MemberCard";
import "leaflet/dist/leaflet.css";

type LatLng = [number, number];
interface PlacePin {
  place: string;
  at: LatLng;
  births: Person[];
  residents: Person[];
}

const CACHE_KEY = "vv-geocode-v1";

function readCache(): Record<string, LatLng | null> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

async function geocode(place: string): Promise<LatLng | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(place)}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const rows = (await res.json()) as { lat: string; lon: string }[];
    if (!rows.length) return null;
    return [parseFloat(rows[0].lat), parseFloat(rows[0].lon)];
  } catch {
    return null;
  }
}

export default function MapView({
  persons,
  highlightId,
}: {
  persons: Person[];
  highlightId?: string | null;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const markersRef = useRef<Map<string, unknown>>(new Map());
  const [status, setStatus] = useState("Locating places…");
  const [unlocated, setUnlocated] = useState<string[]>([]);

  const places = useMemo(() => {
    const set = new Set<string>();
    for (const p of persons) {
      if (p.birth_place?.trim()) set.add(p.birth_place.trim());
      if (p.current_location?.trim()) set.add(p.current_location.trim());
    }
    return Array.from(set).sort();
  }, [persons]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !divRef.current || mapRef.current) return;
      const map = L.map(divRef.current).setView([22, 40], 2);
      mapRef.current = map;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 18,
      }).addTo(map);

      const cache = readCache();
      const coords = new Map<string, LatLng>();
      const missing: string[] = [];
      for (const place of places) {
        if (cancelled) return;
        if (place in cache) {
          if (cache[place]) coords.set(place, cache[place]!);
          else missing.push(place);
          continue;
        }
        const at = await geocode(place);
        cache[place] = at;
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        } catch {
          /* cache is best-effort */
        }
        if (at) coords.set(place, at);
        else missing.push(place);
        // Be polite to the geocoder.
        await new Promise((r) => setTimeout(r, 350));
      }
      if (cancelled) return;
      setUnlocated(missing);

      // Group people by place.
      const pins = new Map<string, PlacePin>();
      const pinFor = (place: string): PlacePin | null => {
        const at = coords.get(place);
        if (!at) return null;
        if (!pins.has(place))
          pins.set(place, { place, at, births: [], residents: [] });
        return pins.get(place)!;
      };
      for (const p of persons) {
        if (p.birth_place?.trim()) pinFor(p.birth_place.trim())?.births.push(p);
        if (p.current_location?.trim())
          pinFor(p.current_location.trim())?.residents.push(p);
      }

      const pinIcon = (color: string) =>
        L.divIcon({
          className: "",
          html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 20],
        });

      const bounds: LatLng[] = [];
      pins.forEach((pin) => {
        bounds.push(pin.at);
        const both = pin.births.length > 0 && pin.residents.length > 0;
        const marker = L.marker(pin.at, {
          icon: pinIcon(both ? "#7c3aed" : pin.births.length ? "#2f6db3" : "#059669"),
        }).addTo(map);
        const lines = [
          `<b>${pin.place}</b>`,
          ...pin.births.map(
            (p) => `🎂 ${displayName(p)}${p.dob ? ` (b. ${p.dob.slice(0, 4)})` : ""}`
          ),
          ...pin.residents.map((p) => `🏠 ${displayName(p)}`),
        ];
        marker.bindPopup(lines.join("<br/>"));
        for (const p of [...pin.births, ...pin.residents])
          markersRef.current.set(`${p.id}:${pin.place}`, marker);
      });

      // Migration lines: birth place -> current location.
      for (const p of persons) {
        const b = p.birth_place?.trim();
        const c = p.current_location?.trim();
        if (!b || !c || b === c) continue;
        const from = coords.get(b);
        const to = coords.get(c);
        if (!from || !to) continue;
        L.polyline([from, to], {
          color: "#7c3aed",
          weight: 1.5,
          opacity: 0.45,
          dashArray: "4 5",
        }).addTo(map);
      }

      if (bounds.length === 1) map.setView(bounds[0], 6);
      else if (bounds.length > 1) map.fitBounds(bounds, { padding: [36, 36] });
      setStatus(
        bounds.length
          ? ""
          : "No places could be located yet — add a birth place or current location to a member card."
      );
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, persons]);

  // Header search highlight: open the person's first marker popup.
  useEffect(() => {
    if (!highlightId) return;
    for (const [key, marker] of Array.from(markersRef.current.entries())) {
      if (key.startsWith(`${highlightId}:`)) {
        (marker as { openPopup: () => void }).openPopup();
        break;
      }
    }
  }, [highlightId]);

  return (
    <div className="self-start w-full p-3">
      <div
        ref={divRef}
        className="w-full rounded-xl border border-stone-200 overflow-hidden z-0"
        style={{ height: "calc(100dvh - 13.5rem)" }}
      />
      {status && <p className="text-sm text-stone-500 mt-2">{status}</p>}
      <p className="text-xs text-stone-400 mt-2">
        <span className="text-[#2f6db3] font-semibold">Blue pin</span> birth
        place · <span className="text-emerald-600 font-semibold">green pin</span>{" "}
        current location · <span className="text-violet-600 font-semibold">purple</span>{" "}
        both — dashed line = moved from birth place to current home.
      </p>
      {unlocated.length > 0 && (
        <p className="text-xs text-stone-500 mt-1">
          Couldn't locate: {unlocated.join(", ")} — check the spelling on the
          member cards (adding a state or country usually helps).
        </p>
      )}
    </div>
  );
}
