"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { IosSheet } from "./ios-sheet";
import { prepareProfilePhoto, saveProfilePhoto } from "@/lib/profile-photo";
import { publicApiErrorMessage } from "@/lib/api-url";

export function IosProfilePhoto({ photo, initials, onSaved }: { photo: string | null; initials: string; onSaved: (url: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const active = useRef(true);
  const pending = useRef(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [failedImage, setFailedImage] = useState(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { setFailedImage(false); }, [photo]);
  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || pending.current) return;
    pending.current = true; setPreparing(true); setError(""); setMessage("");
    try {
      const image = await prepareProfilePhoto(file);
      if (active.current) setPreview(image);
    } catch (caught) { if (active.current) setError(publicApiErrorMessage(caught)); }
    finally { pending.current = false; if (active.current) setPreparing(false); }
  }
  async function save() {
    if (!preview || pending.current) return;
    pending.current = true; setSaving(true); setError("");
    try {
      const url = await saveProfilePhoto(preview);
      if (!active.current) return;
      onSaved(url); setPreview(null); setMessage("Photo de profil mise à jour.");
      window.dispatchEvent(new CustomEvent("vta:branding-updated"));
    } catch (caught) { if (active.current) setError(publicApiErrorMessage(caught)); }
    finally { pending.current = false; if (active.current) setSaving(false); }
  }
  const choosePhoto = () => { if (!pending.current) input.current?.click(); };
  return <div className="vm-profile-photo"><input ref={input} type="file" accept="image/*" aria-label="Choisir une photo de profil" className="sr-only" tabIndex={-1} disabled={preparing || saving} onChange={choose}/><button type="button" className="vm-avatar-edit" onClick={choosePhoto} disabled={preparing || saving} aria-label="Modifier la photo de profil">{photo && !failedImage ? <img src={photo} alt="Votre photo de profil" className="vm-avatar" onError={() => setFailedImage(true)}/> : <span className="vm-avatar">{initials}</span>}<span className="vm-avatar-camera"><Camera size={15}/></span></button><button type="button" className="vm-photo-link" disabled={preparing || saving} onClick={choosePhoto}>{preparing ? "Préparation…" : "Modifier la photo"}</button>{!preview && error && <p className="vm-field-error" role="alert">{error}</p>}{message && <p className="vm-photo-success" role="status">{message}</p>}{preview && <IosSheet title="Photo de profil" subtitle="Vérifiez votre photo avant de l’enregistrer." onClose={() => { if (!pending.current) { setPreview(null); setError(""); } }}><div className="vm-photo-preview"><img src={preview} alt="Aperçu de votre nouvelle photo"/><p className="vm-form-help">La photo sera affichée en cercle dans votre profil. Une connexion Internet est nécessaire pour l’enregistrer.</p>{error && <p role="alert" className="vm-field-error">{error}</p>}<button type="button" className="vm-primary-button" disabled={saving || preparing} onClick={() => void save()}>{saving ? "Enregistrement…" : "Enregistrer la photo"}</button><button type="button" className="vm-photo-other" disabled={saving || preparing} onClick={choosePhoto}><ImagePlus size={17}/>Choisir une autre photo</button><button type="button" className="vm-photo-cancel" disabled={saving || preparing} onClick={() => { setPreview(null); setError(""); }}>Annuler</button></div></IosSheet>}</div>;
}
