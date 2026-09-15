"use client";

import { useState } from "react";

/**
 * Opens a credential document through a freshly minted short-lived signed URL,
 * so no durable document link is ever rendered into the page.
 */
export function DocumentLink({
  documentId,
  filename,
}: {
  documentId: string;
  filename: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function open() {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/documents/${documentId}`);
    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "Could not open document");
      return;
    }
    window.open(payload.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div>
      <button
        type="button"
        onClick={open}
        disabled={loading}
        className="text-sm font-semibold text-emerald-700 underline underline-offset-2 disabled:opacity-60"
      >
        {loading ? "Opening…" : filename}
      </button>
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
