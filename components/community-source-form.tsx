"use client";

import { useState, type FormEvent } from "react";
import type { CommunitySource, Point } from "@/lib/types";
import styles from "./community-source.module.css";

type CommunitySourceFormProps = {
  initialPoint?: Point | null;
  /** Parent map can store the callback and call it when the user picks a point. */
  onPickCoordinates?: (acceptPoint: (point: Point) => void) => void;
  onSubmitted?: (source: CommunitySource) => void;
  onCancel?: () => void;
};

export function CommunitySourceForm({ initialPoint, onPickCoordinates, onSubmitted, onCancel }: CommunitySourceFormProps) {
  const [lat, setLat] = useState(initialPoint ? String(initialPoint.lat) : "");
  const [lon, setLon] = useState(initialPoint ? String(initialPoint.lon) : "");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const acceptPoint = (point: Point) => { setLat(String(point.lat)); setLon(String(point.lon)); setError(""); };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setNotice(""); setBusy(true);
    if (!name.trim() && !location.trim() && !description.trim()) {
      setError("Añade al menos un nombre, una referencia de ubicación o una descripción."); setBusy(false); return;
    }
    try {
      const response = await fetch("/api/community-sources", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: Number(lat), lon: Number(lon), name, location, description, consent }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo enviar la propuesta.");
      setNotice(data.duplicateNearby
        ? "Propuesta recibida y pendiente de revisión. Hay otra propuesta o fuente comunitaria a menos de 100 m; la revisaremos para evitar duplicados."
        : "Propuesta recibida. Se publicará en el mapa solo si se aprueba.");
      setName(""); setLocation(""); setDescription(""); setConsent(false);
      onSubmitted?.(data.source as CommunitySource);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo enviar la propuesta."); }
    finally { setBusy(false); }
  };

  return <form className={styles.form} onSubmit={submit}>
    <p>Indica el punto exacto de una fuente de agua potable que no aparece en los datos oficiales ni en el mapa comunitario. Las propuestas se revisan antes de publicarse.</p>
    <fieldset className={styles.coordinates}><legend>Coordenadas exactas <span aria-hidden="true">*</span></legend>
      <label>Latitud<input required type="number" step="any" min="-90" max="90" value={lat} onChange={(event) => setLat(event.target.value)} placeholder="41.6488"/></label>
      <label>Longitud<input required type="number" step="any" min="-180" max="180" value={lon} onChange={(event) => setLon(event.target.value)} placeholder="-0.8891"/></label>
      {onPickCoordinates && <button className={styles.secondary} type="button" onClick={() => onPickCoordinates(acceptPoint)}>Elegir coordenadas en el mapa</button>}
    </fieldset>
    <label>Nombre (opcional)<input maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Por ejemplo, fuente del parque"/></label>
    <label>Ubicación o referencia (opcional)<input maxLength={160} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Parque, calle o punto de referencia"/></label>
    <label>Descripción (opcional)<textarea maxLength={500} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Detalles que ayuden a localizarla o revisarla"/></label>
    <label className={styles.consent}><input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)}/> Acepto que las coordenadas y los datos enviados se publiquen si la propuesta se aprueba.</label>
    <p className={styles.privacy}>No pedimos correo ni datos personales. La coordenada precisa será pública si se aprueba.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    <div className={styles.actions}><button type="submit" disabled={busy || !consent}>{busy ? "Enviando…" : "Enviar para revisión"}</button>{onCancel && <button type="button" className={styles.secondary} onClick={onCancel}>Cancelar</button>}</div>
  </form>;
}
