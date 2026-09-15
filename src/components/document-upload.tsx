"use client";

import { useRef, useState } from "react";
import type { DocumentType } from "@/lib/domain/enums";

type UploadedDocument = {
  id: string;
  original_filename: string;
};

/**
 * Uploads to the private document bucket and writes the resulting document id
 * into a hidden input, so the enclosing form submits an id rather than a file.
 */
export function DocumentUpload({
  name,
  documentType,
  required,
  existing,
  label = "Upload file",
}: {
  name: string;
  documentType: DocumentType;
  required?: boolean;
  existing?: UploadedDocument | null;
  label?: string;
}) {
  const [document, setDocument] = useState<UploadedDocument | null>(existing ?? null);
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

    setDocument(payload.document);
    setStatus("idle");
  }

  async function handleView() {
    if (!document) return;
    const response = await fetch(`/api/documents/${document.id}`);
    const payload = await response.json();
    if (response.ok) window.open(payload.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={document?.id ?? ""} />
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-semibold text-ink hover:bg-slate-50">
          {status === "uploading" ? "Uploading…" : document ? "Replace file" : label}
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={handleChange}
            required={required && !document}
          />
        </label>
        {document ? (
          <button
            type="button"
            onClick={handleView}
            className="text-sm font-medium text-emerald-700 underline underline-offset-2"
          >
            {document.original_filename}
          </button>
        ) : (
          <span className="text-xs text-muted">PDF, JPG, PNG or WebP · max 10 MB</span>
        )}
      </div>
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}
