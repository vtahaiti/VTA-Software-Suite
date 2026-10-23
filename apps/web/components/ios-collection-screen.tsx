"use client";
import { ReactNode, useState } from "react";
import { IosSheet } from "@/components/ios-sheet";
export function IosCollectionScreen({ title, action, count, error, form, children }: { title: string; action: string; count: number; error: string; form: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <div className="vm-screen"><div className="vm-title"><h1>{title}</h1><button className="vm-round-action" aria-label={action} onClick={() => setOpen(true)}>+</button></div>{error && <p className="ios-notice" role="alert">{error}</p>}<div className="vm-section-heading"><h2>{title === "Emplacements" ? "Mes emplacements" : "Historique"}</h2><span className="vm-count">{count}</span></div>{count ? <div className="vm-record-list">{children}</div> : <div className="vm-state"><strong>{error ? "Liste indisponible" : "Aucun élément pour le moment"}</strong></div>}{open && <IosSheet title={action} onClose={() => setOpen(false)}>{error && <p className="ios-notice" role="alert">{error}</p>}{form}</IosSheet>}</div>;
}
