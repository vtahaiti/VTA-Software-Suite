"use client";

import { IosBackNavigation } from "@/components/ios-back-navigation";
import Link from "next/link";
import { ReactNode, useContext, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, CircleUserRound, Building2, LockKeyhole, RefreshCw, HelpCircle, ShieldCheck, LogOut, Trash2 } from "lucide-react";

type Props = { name: string; email: string; role: string; company: string; photo: string | null; initials: string; photoEditor?: ReactNode; identity: ReactNode; password: ReactNode; deletion: ReactNode; onLogout: () => void; canManageCompany: boolean };
export function IosProfile(props: Props) {
  const [screen, setScreen] = useState<"overview" | "identity" | "password" | "deletion">("overview");
  const setBackAction = useContext(IosBackNavigation);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    setBackAction(screen === "overview" ? null : () => setScreen("overview"));
    return () => setBackAction(null);
  }, [screen, setBackAction]);
  const title = screen === "identity" ? "Mes informations" : screen === "password" ? "Mot de passe" : "Supprimer mon compte";
  if (screen !== "overview") return <div className="vm-screen vm-profile-panel"><h1>{title}</h1>{screen === "identity" ? props.identity : screen === "password" ? props.password : props.deletion}</div>;
  return <div className="vm-screen vm-profile">
    <div className="vm-title"><h1>Mon profil</h1></div>
    <section className="vm-profile-identity">{props.photoEditor ?? (props.photo ? <img src={props.photo} alt="" className="vm-avatar"/> : <div className="vm-avatar">{props.initials}</div>)}<h2>{props.name}</h2><p>{props.email}</p><span className="vm-role">{props.role}</span></section>
    <div className="vm-company-card"><span><Building2 size={22}/></span><div><small>Mon entreprise</small><strong>{props.company}</strong></div></div>
    <section className="vm-menu-section"><h2>Mon compte</h2><div className="vm-menu-group"><button className="vm-menu-row" onClick={() => setScreen("identity")}><span><CircleUserRound size={20}/></span><div><strong>Informations personnelles</strong><small>Nom, téléphone et langue</small></div><ChevronRight size={17}/></button><button className="vm-menu-row" onClick={() => setScreen("password")}><span><LockKeyhole size={20}/></span><div><strong>Mot de passe</strong><small>Sécuriser mon compte</small></div><ChevronRight size={17}/></button>{props.canManageCompany && <Link className="vm-menu-row" href="/dashboard/settings/company"><span><Building2 size={20}/></span><div><strong>Mon entreprise</strong><small>Coordonnées et logo</small></div><ChevronRight size={17}/></Link>}<Link className="vm-menu-row" href="/offline"><span><RefreshCw size={20}/></span><div><strong>Synchronisation</strong><small>Ventes enregistrées sur cet iPhone</small></div><ChevronRight size={17}/></Link></div></section>
    <section className="vm-menu-section"><h2>Aide et confidentialité</h2><div className="vm-menu-group"><Link className="vm-menu-row" href="/support"><span><HelpCircle size={20}/></span><div><strong>Contacter l’assistance</strong></div><ChevronRight size={17}/></Link><Link className="vm-menu-row" href="/privacy"><span><ShieldCheck size={20}/></span><div><strong>Confidentialité</strong></div><ChevronRight size={17}/></Link></div></section>
    <button type="button" onClick={props.onLogout} className="vm-logout"><LogOut size={19}/>Se déconnecter</button>
    <button type="button" className="vm-delete-link" onClick={() => setScreen("deletion")}><Trash2 size={14}/>Supprimer mon compte</button>
  </div>;
}
