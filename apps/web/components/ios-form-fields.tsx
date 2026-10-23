import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function IosLabeledInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const input = <input {...props} />;
  if (process.env.NEXT_PUBLIC_IOS_EMBEDDED !== "1" || !props.placeholder) return input;
  return <label className="grid min-w-0 gap-1"><span className="text-xs font-medium text-slate-600">{props.placeholder}</span>{input}</label>;
}

export function IosLabeledSelect({ label, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const select = <select {...props} aria-label={label} />;
  if (process.env.NEXT_PUBLIC_IOS_EMBEDDED !== "1") return select;
  return <label className="grid min-w-0 gap-1"><span className="text-xs font-medium text-slate-600">{label}</span>{select}</label>;
}

export function IosLabeledTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const textarea = <textarea {...props} />;
  if (process.env.NEXT_PUBLIC_IOS_EMBEDDED !== "1" || !props.placeholder) return textarea;
  return <label className={`grid min-w-0 gap-1 ${props.className?.includes("md:col-span-2") ? "md:col-span-2" : ""}`}><span className="text-xs font-medium text-slate-600">{props.placeholder}</span>{textarea}</label>;
}
