"use client";

import Link from "next/link";
import { useState } from "react";

export default function ProponerPage() {
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const useLocation = () => {
    setError("");
    if (!navigator.geolocation) { setError("Este navegador no permite obtener la ubicación."); return; }
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setLat(coords.latitude.toFixed(6)); setLon(coords.longitude.toFixed(6));
    }, () => setError("No se pudo obtener la ubicación. Puedes introducir las coordenadas manualmente."), { enableHighAccuracy: true, timeout: 15000 });
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/fountain-proposals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat: Number(lat), lon: Number(lon), name, note }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo enviar la propuesta.");
      setMessage("Propuesta recibida para revisión. No aparecerá en el mapa hasta que se verifique y se incorpore al inventario.");
      setName(""); setNote("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo enviar la propuesta."); }
    finally { setBusy(false); }
  };

  return <main className="privacy-page"><Link className="back-link" href="/">← Volver al mapa</Link><p className="eyebrow">CONTRIBUYE</p><h1>Proponer una fuente</h1>
    <p>Envía una ubicación para revisión. Las propuestas no se muestran en el mapa ni se consideran fuentes confirmadas.</p>
    <form className="incident-form" onSubmit={submit}>
      <button type="button" className="secondary-action" onClick={useLocation}>Usar mi ubicación actual</button>
      <label>Latitud<input required type="number" step="any" min="41.45" max="41.85" value={lat} onChange={(event) => setLat(event.target.value)} placeholder="41.648800"/></label>
      <label>Longitud<input required type="number" step="any" min="-1.15" max="-0.65" value={lon} onChange={(event) => setLon(event.target.value)} placeholder="-0.889100"/></label>
      <label>Nombre o referencia (opcional)<input maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Parque, plaza o calle cercana"/></label>
      <label>Información adicional (opcional)<textarea maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Describe dónde está la fuente"/></label>
      <button className="primary-action" type="submit" disabled={busy}>{busy ? "Enviando…" : "Enviar para revisión"}</button>
      <small>Se enviarán las coordenadas y el texto que escribas. No incluyas datos personales.</small>
    </form>
    {message && <p role="status">{message}</p>}{error && <p className="inline-error" role="alert">{error}</p>}
  </main>;
}
