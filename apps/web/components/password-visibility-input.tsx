"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

type PasswordVisibilityInputProps = {
  id?: string;
  name?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  className?: string;
};

export function PasswordVisibilityInput({
  id,
  name,
  label,
  value,
  onChange,
  autoComplete = "current-password",
  placeholder,
  required = false,
  minLength,
  maxLength,
  className = ""
}: PasswordVisibilityInputProps) {
  const [visible, setVisible] = useState(false);
  const inputId = id ?? name;
  const input = (
    <div className="relative">
      <input
        id={inputId}
        name={name}
        type={visible ? "text" : "password"}
        required={required}
        value={value}
        minLength={minLength}
        maxLength={maxLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 pr-11 text-slate-950 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 ${className}`}
      />
      <button
        type="button"
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        onClick={() => setVisible((current) => !current)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        {visible ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
      </button>
    </div>
  );

  if (!label) return input;

  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor={inputId}>
      {label}
      {input}
    </label>
  );
}
