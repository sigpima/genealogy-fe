'use client';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { hasCoordinates, PLACE_KIND_COLORS, PLACE_KIND_LABELS, type Place } from '@/lib/places/places';

export type PlaceMapProps = {
  places: Place[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** While true a click on the map reports a point instead of selecting (used when an admin sets a place's GPS). */
  picking: boolean;
  picked: { latitude: number; longitude: number } | null;
  onPick: (latitude: number, longitude: number) => void;
};

const VIETNAM_CENTER: L.LatLngTuple = [16.0, 106.0];

function markerIcon(color: string, selected: boolean): L.DivIcon {
  const size = selected ? 28 : 20;
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)${selected ? ';outline:3px solid ' + color : ''}"></span>`,
  });
}

/** An OpenStreetMap map (Leaflet, no API key) with one marker per place that has GPS. */
export default function PlaceMap({ places, selectedId, onSelect, picking, picked, onPick }: PlaceMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const pickMarker = useRef<L.Marker | null>(null);
  const callbacks = useRef({ onSelect, onPick, picking });
  callbacks.current = { onSelect, onPick, picking };
  const fitted = useRef(false);

  useEffect(() => {
    if (!container.current || map.current) return;
    // No zoom/fade animation: Leaflet finishes a zoom animation with a timer that still fires after map.remove(), which throws
    // when the user leaves the page mid-animation. A map that just jumps is the cheaper way to be safe.
    const instance = L.map(container.current, { center: VIETNAM_CENTER, zoom: 5, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(instance);
    markers.current = L.layerGroup().addTo(instance);
    instance.on('click', (event: L.LeafletMouseEvent) => {
      if (callbacks.current.picking) callbacks.current.onPick(event.latlng.lat, event.latlng.lng);
    });
    map.current = instance;
    return () => {
      instance.stop(); // a fly-to animation still running while we leave the page would touch a removed map
      instance.off();
      instance.remove();
      map.current = null;
      markers.current = null;
      pickMarker.current = null;
      fitted.current = false;
    };
  }, []);

  useEffect(() => {
    const layer = markers.current;
    if (!layer || !map.current) return;
    layer.clearLayers();
    const located = places.filter(hasCoordinates);
    for (const place of located) {
      const marker = L.marker([place.latitude!, place.longitude!], {
        icon: markerIcon(PLACE_KIND_COLORS[place.kind], place.id === selectedId),
        title: `${place.name} — ${PLACE_KIND_LABELS[place.kind]}`,
        keyboard: true,
      });
      marker.on('click', () => callbacks.current.onSelect(place.id));
      marker.addTo(layer);
    }
    if (!fitted.current && located.length > 0) {
      fitted.current = true;
      map.current.fitBounds(L.latLngBounds(located.map((p) => [p.latitude!, p.longitude!] as L.LatLngTuple)), { padding: [40, 40], maxZoom: 14 });
    }
  }, [places, selectedId]);

  useEffect(() => {
    const selected = places.find((p) => p.id === selectedId);
    if (selected && hasCoordinates(selected) && map.current && container.current?.isConnected) {
      map.current.flyTo([selected.latitude!, selected.longitude!], Math.max(map.current.getZoom(), 13), { duration: 0.6 });
    }
    // only a change of selection moves the view; editing the list must not
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    if (!map.current) return;
    if (pickMarker.current) {
      pickMarker.current.remove();
      pickMarker.current = null;
    }
    if (picked) {
      pickMarker.current = L.marker([picked.latitude, picked.longitude], { icon: markerIcon('#e65100', true), keyboard: false }).addTo(map.current);
    }
  }, [picked]);

  useEffect(() => {
    if (container.current) container.current.style.cursor = picking ? 'crosshair' : '';
  }, [picking]);

  return <div ref={container} role="application" aria-label="Bản đồ địa điểm" className="size-full min-h-[320px] rounded-xl border-default border" />;
}
