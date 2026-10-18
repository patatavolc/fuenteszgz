"use client";

import { useEffect, useState } from "react";
import type { CommunitySource } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./community-source.module.css";

export function CommunityModerationPanel() {
  const supabase = getSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [sources, setSources] = useState<CommunitySource[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? ""));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setToken(session?.access_token ?? ""));
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!token) { setSources([]); return; }
    let cancelled = false;
    void fetch("/api/moderation/suggestions", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "No autorizado."); return data as CommunitySource[]; })
      .then((data) => { if (!cancelled) { setSources(data); setMessage(""); } })
      .catch((cause: unknown) => { if (!cancelled) { setMessage(cause instanceof Error ? cause.message : "No se pudieron cargar las propuestas."); setSources([]); } });
    return () => { cancelled = true; };
  }, [token]);

  const signIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!supabase) return;
    setBusy(true); setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage("No se pudo iniciar sesión. Comprueba la cuenta de moderación.");
    setPassword(""); setBusy(false);
  };

  const decide = async (source: CommunitySource, decision: "approved" | "rejected") => {
    if (!token) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/moderation/suggestions", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: source.id, decision }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo revisar la propuesta.");
      setSources((current) => current.filter((item) => item.id !== source.id));
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "No se pudo revisar la propuesta."); }
    finally { setBusy(false); }
  };

  if (!supabase) return <p role="status">La moderación no está configurada. Añade las variables públicas de Supabase para iniciar sesión.</p>;
  return <section className={styles.moderation}>
    {!token ? <form className={styles.form} onSubmit={signIn}><p>Inicia sesión con una cuenta de moderación autorizada.</p><label>Correo<input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)}/></label><label>Contraseña<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)}/></label><button type="submit" disabled={busy}>{busy ? "Conectando…" : "Iniciar sesión"}</button></form> : <>
      <header><h2>Propuestas pendientes</h2><button className={styles.secondary} onClick={() => void supabase.auth.signOut()}>Cerrar sesión</button></header>
      {message && <p role="alert" className={styles.error}>{message}</p>}
      {!message && sources.length === 0 && <p>No hay propuestas pendientes.</p>}
      <ul className={styles.queue}>{sources.map((source) => <li key={source.id}><h3>{source.name || source.location || "Fuente comunitaria"}</h3><p>{source.location || "Sin referencia de ubicación"}</p><p>{source.description || "Sin descripción"}</p><p>Coordenadas: {source.lat}, {source.lon}</p><a href={`https://www.openstreetmap.org/?mlat=${source.lat}&mlon=${source.lon}#map=19/${source.lat}/${source.lon}`} target="_blank" rel="noreferrer">Revisar en el mapa ↗</a><div className={styles.actions}><button disabled={busy} onClick={() => void decide(source, "approved")}>Aprobar y publicar</button><button disabled={busy} className={styles.secondary} onClick={() => void decide(source, "rejected")}>Rechazar</button></div></li>)}</ul>
    </>}
    {message && !token && <p role="alert" className={styles.error}>{message}</p>}
  </section>;
}
