"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Component, ReactNode } from "react";
import { IosPageContent } from "@/components/ios-page-content";
import { ProtectedShell } from "@/components/protected-shell";

class IosScreenBoundary extends Component<{ children: ReactNode; route: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidUpdate(previous: { route: string }) {
    if (previous.route !== this.props.route && this.state.failed) this.setState({ failed: false });
  }
  render() {
    if (this.state.failed) return <div className="ios-app-shell"><IosPageContent><h1>Page indisponible</h1><p className="my-4">La page n’a pas pu être affichée. Vos données enregistrées restent disponibles.</p><button className="rounded-xl bg-brand-600 px-4 py-3 text-white" onClick={() => window.location.reload()}>Réessayer</button><Link className="ml-4 underline" href="/dashboard">Accueil</Link></IosPageContent></div>;
    return this.props.children;
  }
}

export function IosRouteFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (process.env.NEXT_PUBLIC_IOS_EMBEDDED !== "1") return children;
  let content = children;
  if (pathname.replace(/\/$/, "") === "/offline") content = <ProtectedShell>{children}</ProtectedShell>;
  else if (pathname !== "/" && !pathname.startsWith("/dashboard") && !pathname.startsWith("/profile") && (!pathname.startsWith("/admin") || pathname.startsWith("/admin/login"))) {
    content = <div className="ios-app-shell ios-public-shell min-h-screen bg-[#f5f7fb]"><header className="ios-app-header"><div><Link className="ios-back" aria-label="Retour au point de vente" href="/">‹</Link><Link href="/" className="ios-wordmark"><span>VTA</span> POS</Link></div></header><IosPageContent>{children}</IosPageContent></div>;
  }
  return <IosScreenBoundary route={pathname}>{content}</IosScreenBoundary>;
}
