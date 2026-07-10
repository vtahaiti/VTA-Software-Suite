"use client";

import { ProtectedShell } from "@/components/protected-shell";
import type { AuthUser } from "@/lib/auth";

export default function ProfilePage() {
  return <ProtectedShell>{(user) => <ProfileContent user={user} />}</ProtectedShell>;
}

function ProfileContent({ user }: { user: AuthUser }) {
  return (
    <div className="max-w-4xl">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-100 text-3xl font-bold text-brand-700 dark:bg-slate-800">
            {user.name.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-medium text-brand-600">Profil utilisateur</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-950 dark:text-white">{user.name}</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Avatar vide prepare pour les prochaines versions.</p>
          </div>
        </div>

        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          <ProfileItem label="Nom" value={user.name} />
          <ProfileItem label="Email" value={user.email} />
          <ProfileItem label="Rôle" value={user.role} />
          <ProfileItem label="Tenant" value={user.tenant} />
          <ProfileItem label="Date creation" value={new Date(user.createdAt).toLocaleDateString("fr-FR")} />
        </dl>
      </div>
    </div>
  );
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-1 text-base font-semibold text-slate-950 dark:text-white">{value}</dd>
    </div>
  );
}
