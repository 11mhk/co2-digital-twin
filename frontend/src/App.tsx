/*
Pune Grid Map - React + TypeScript + Vite
Single-file starter app (default export React component).

Features:
- React + TypeScript
- Leaflet map centered on Pune
- Grid overlay (configurable rows/cols) rendered as Leaflet rectangular cells
- Select a cell and change parameters in the right-side panel
- Sends updated parameter set to backend (/predict) and updates cell color/score in real-time
- Uses Tailwind-style utility classes (no import necessary in this code preview)

Backend contract (app.py):
POST /predict
  Request JSON: { cellId: string, params: { temperature:number, rainfall:number, wind:number, pollution:number, soil:number }}
  Response JSON: { cellId: string, score:number, color: string }

GET /grid-state (optional)
  Response JSON: { cells: [{ cellId, bbox:[swlat,swlng,nelat,nelng], score, color, params }] }

Websocket (optional): ws://.../ws-updates - pushes updates when backend recalculates

How to use:
1. Create a Vite React + TS project (pnpm create vite@latest my-app --template react-ts)
2. Install deps: npm i react-leaflet leaflet axios clsx
3. Add Leaflet CSS import in index.css: @import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
4. Copy this component into src/App.tsx and run dev server.

This is a single-file component for clarity. In production split into smaller modules.
*/

import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Rectangle, useMapEvents, Popup } from "react-leaflet";
import L, { LatLngBoundsExpression } from "leaflet";
import axios from "axios";

// --- Types ---
type Params = {
  temperature: number;
  rainfall: number;
  wind: number;
  pollution: number;
  soil: number;
};

type CellState = {
  id: string;
  row: number;
  col: number;
  bounds: LatLngBoundsExpression; // [[swlat, swlng],[nelat, nelng]]
  score: number;
  color: string;
  params: Params;
};

// --- Helpers ---
const DEFAULT_PARAMS: Params = { temperature: 30, rainfall: 10, wind: 5, pollution: 40, soil: 20 };

function scoreToColor(score: number) {
  // simple scale: 0-20 blue, 21-40 green, 41-60 yellow, 61-80 orange, 81-100 red
  if (score <= 20) return "#3b82f6"; // blue
  if (score <= 40) return "#10b981"; // green
  if (score <= 60) return "#f59e0b"; // amber
  if (score <= 80) return "#f97316"; // orange
  return "#ef4444"; // red
}

// Pune bbox center and approximate bounding box (lat,lng)
const PUNE_CENTER = { lat: 18.5204, lng: 73.8567 };
const PUNE_BBOX = {
  // small bounding box around Pune city
  north: 18.66,
  south: 18.36,
  west: 73.65,
  east: 74.05,
};

// Create a grid of row x col over Pune bbox
function buildGrid(rows: number, cols: number): CellState[] {
  const latStep = (PUNE_BBOX.north - PUNE_BBOX.south) / rows;
  const lngStep = (PUNE_BBOX.east - PUNE_BBOX.west) / cols;
  const cells: CellState[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const south = PUNE_BBOX.south + r * latStep;
      const north = south + latStep;
      const west = PUNE_BBOX.west + c * lngStep;
      const east = west + lngStep;
      const id = `cell_${r}_${c}`;
      const baseScore = Math.round(Math.random() * 80 + 10); // random initial score
      const color = scoreToColor(baseScore);
      const params = { ...DEFAULT_PARAMS };
      cells.push({ id, row: r, col: c, bounds: [[south, west], [north, east]] as LatLngBoundsExpression, score: baseScore, color, params });
    }
  }
  return cells;
}

// --- Main Component ---
export default function PuneGridMap() {
  const ROWS = 8; // configurable rows
  const COLS = 10;
  const [cells, setCells] = useState<CellState[]>(() => buildGrid(ROWS, COLS));
  const [selectedCellId, setSelectedCellId] = useState<string | null>(cells[0]?.id ?? null);
  const [isPlacing, setIsPlacing] = useState(false); // if using 'place interventions' etc
  const selectedCell = useMemo(() => cells.find((c) => c.id === selectedCellId) ?? null, [cells, selectedCellId]);

  // debounce ref to avoid too many requests when sliders move quickly
  const lastRequestRef = useRef<number | null>(null);

  // update cell after backend returns
  async function sendParamsToBackend(cellId: string, params: Params) {
    try {
      // optimistic update: set params locally immediately (UI responsiveness)
      setCells((prev) => prev.map((c) => (c.id === cellId ? { ...c, params } : c)));

      // post
      const resp = await axios.post("http://localhost:8000/predict", { cellId, params });
      const data = resp.data as { cellId: string; score: number; color: string };
      setCells((prev) => prev.map((c) => (c.id === data.cellId ? { ...c, score: data.score, color: data.color } : c)));
    } catch (err) {
      console.error("API error", err);
    }
  }

  // when user updates sliders, call backend (debounced)
  function onParamsChange(cellId: string, newParams: Params) {
    // cancel previous timer
    if (lastRequestRef.current) window.clearTimeout(lastRequestRef.current);
    lastRequestRef.current = window.setTimeout(() => {
      sendParamsToBackend(cellId, newParams);
    }, 300); // 300ms debounce
    // optimistic local param update
    setCells((prev) => prev.map((c) => (c.id === cellId ? { ...c, params: newParams } : c)));
  }

  // support clicking map to select cell
  function onCellClick(cellId: string) {
    setSelectedCellId(cellId);
  }

  // Optional: periodically fetch grid-state from backend
  useEffect(() => {
    let mounted = true;
    // function fetchGrid() { axios.get('/grid-state').then(resp=> setCells(resp.data.cells)) }
    // Uncomment and implement if backend provides aggregated grid state
    return () => { mounted = false; };
  }, []);

  // render
  return (
    <div className="h-screen flex bg-gray-50">
      <div className="flex-1 p-4">
        <header className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold">CO₂ Capture Digital Twin — Pune</h1>
            <p className="text-sm text-gray-600">Interactive grid over Pune. Select a cell, change parameters and see live results.</p>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 rounded-xl bg-white shadow">Default Scenario</button>
            <button className="px-4 py-2 rounded-xl bg-white shadow">Hide Interventions</button>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-4 h-[calc(100vh-120px)]">
          <div className="col-span-8 bg-white rounded-xl shadow p-3">
            <h3 className="font-medium mb-2">Neighborhood CO₂ Emissions Map</h3>
            <div className="h-full rounded-md overflow-hidden border">
              <MapContainer center={[PUNE_CENTER.lat, PUNE_CENTER.lng]} zoom={12} style={{ height: "100%", width: "100%" }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Render grid cells as rectangles */}
                {cells.map((cell) => (
                  <Rectangle
                    key={cell.id}
                    bounds={cell.bounds}
                    pathOptions={{
                      color: "#ddd",
                      weight: selectedCellId === cell.id ? 3 : 1,
                      fillColor: cell.color,
                      fillOpacity: 0.9,
                      dashArray: selectedCellId === cell.id ? undefined : "",
                    }}
                    eventHandlers={{
                      click: () => onCellClick(cell.id),
                    }}
                  >
                    <Popup>
                      <div style={{ minWidth: 160 }}>
                        <div className="font-bold">{cell.id}</div>
                        <div>Score: {cell.score}</div>
                        <div className="text-xs text-gray-600">Click to select and edit parameters</div>
                      </div>
                    </Popup>
                  </Rectangle>
                ))}

                {/* simple map click handler to deselect on background click */}
                <MapClickHandler onMapClick={() => setSelectedCellId(null)} />
              </MapContainer>
            </div>
          </div>

          <aside className="col-span-4">
            <div className="bg-white rounded-xl shadow p-4 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">CO₂ Capture Interventions</h3>
                <div className="text-sm text-gray-500">Place / Manage</div>
              </div>

              {!selectedCell ? (
                <div className="text-gray-500">Select a cell on the map to edit parameters.</div>
              ) : (
                <div className="flex-1 flex flex-col gap-3">
                  <div className="p-3 rounded-lg border">
                    <div className="flex items-baseline justify-between">
                      <div className="text-sm text-gray-600">Selected</div>
                      <div className="font-semibold">{selectedCell.id}</div>
                    </div>
                    <div className="mt-2 text-sm">Score: <span className="font-bold">{selectedCell.score}</span></div>
                  </div>

                  <ParameterEditor
                    params={selectedCell.params}
                    onChange={(newParams) => onParamsChange(selectedCell.id, newParams)}
                  />

                  <div className="mt-auto">
                    <button
                      className="w-full py-2 rounded-xl bg-indigo-600 text-white font-medium"
                      onClick={() => {
                        // example intervention: reduce pollution by 20%
                        if (!selectedCell) return;
                        const newParams = { ...selectedCell.params, pollution: Math.max(0, Math.round(selectedCell.params.pollution * 0.8)) };
                        onParamsChange(selectedCell.id, newParams);
                      }}
                    >
                      Apply Compact Capture Intervention (-20% pollution)
                    </button>
                    <div className="text-xs text-gray-500 mt-2">Changes are sent to the backend and the grid updates in real-time.</div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

// ---------- MapClickHandler ----------
function MapClickHandler({ onMapClick }: { onMapClick: () => void }) {
  useMapEvents({ click(e) {
      // if user clicked on map background, deselect
      onMapClick();
    }
  });
  return null;
}

// ---------- ParameterEditor Component ----------
function ParameterEditor({ params, onChange }: { params: Params; onChange: (p: Params) => void }) {
  const [local, setLocal] = useState<Params>(params);

  // keep local synced when selected cell changes
  useEffect(() => setLocal(params), [params]);

  function update<K extends keyof Params>(k: K, v: number) {
    const next = { ...local, [k]: v } as Params;
    setLocal(next);
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <Slider label="Temperature (°C)" value={local.temperature} min={0} max={50} onChange={(v) => update('temperature', v)} />
      <Slider label="Rainfall (mm)" value={local.rainfall} min={0} max={200} onChange={(v) => update('rainfall', v)} />
      <Slider label="Wind (m/s)" value={local.wind} min={0} max={30} onChange={(v) => update('wind', v)} />
      <Slider label="Pollution (AQI)" value={local.pollution} min={0} max={500} onChange={(v) => update('pollution', v)} />
      <Slider label="Soil Moisture (%)" value={local.soil} min={0} max={100} onChange={(v) => update('soil', v)} />
    </div>
  );
}

function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <div className="text-gray-600">{label}</div>
        <div className="font-medium">{value}</div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}
