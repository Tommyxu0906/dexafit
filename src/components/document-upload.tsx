"use client";

import { useRef, useState } from "react";
import type { DocumentType } from "@/lib/domain/enums";

export type UploadedDocument = {
  id: string;
  original_filename: string;
};

/**
 * Uploads to the private document bucket and reports the stored document back to
 * the form that owns it.
 *
 * The uploaded id is deliberately held by the parent rather than inside this
 * component. When it lived here, anything that remounted the component — a
 * sibling list re-rendering, a form collapsing and reopening — silently reset it
 * to null while the form still submitted happily, so the file landed in storage
 * with nothing pointing at it.
 */
export function DocumentUpload({
  name,
  documentType,
  required,
  value,
  onChange,
  label = "Upload file",
}: {
  name: string;
  documentType: DocumentType;
  required?: boolean;
  value: UploadedDocument | null;
  onChange: (document: UploadedDocument | null) => void;
  label?: string;
}) {
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus("uploading");
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentType", documentType);

    const response = await fetch("/api/documents", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Upload failed");
      setStatus("error");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    onChange(payload.document as UploadedDocument);
    setStatus("idle");
  }

  async function handleView() {
    if (!value) return;
    const response = await fetch(`/api/documents/${value.id}`);
    const payload = await response.json();
    if (response.ok) window.open(payload.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={value?.id ?? ""} readOnly />
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-semibold text-ink hover:bg-slate-50">
          {status === "uploading" ? "Uploading…" : value ? "Replace file" : label}
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={handleChange}
            required={required && !value}
          />
        </label>
        {value ? (
          <button
            type="button"
            onClick={handleView}
            className="text-sm font-medium text-emerald-700 underline underline-offset-2"
          >
            {value.original_filename}
          </button>
        ) : (
          <span className="text-xs text-muted">PDF, JPG, PNG or WebP · max 10 MB</span>
        )}
      </div>
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}
