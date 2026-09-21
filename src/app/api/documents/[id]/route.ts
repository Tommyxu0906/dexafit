import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { captureServerError } from "@/lib/observability";
import { createClient } from "@/lib/supabase/server";
import { DOCUMENT_BUCKET, SIGNED_URL_TTL_SECONDS } from "@/lib/storage";

/**
 * Mints a short-lived signed URL for one document.
 *
 * Authorization is enforced twice: RLS restricts the document row to its owner
 * or an admin, and the signed URL expires in a minute so a leaked link is not a
 * durable grant. Credential documents are never served from a public bucket.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data: document, error: lookupError } = await supabase
    .from("professional_documents")
    .select("id, storage_key, original_filename, mime_type")
    .eq("id", id)
    .maybeSingle();

  // A failed lookup is not a missing document. Reporting it as 404 sends the
  // reviewer hunting for a file that is sitting there intact.
  if (lookupError) {
    const { eventId } = captureServerError(lookupError, {
      operation: "documents.lookup",
      userId: user.id,
      documentId: id,
    });
    return NextResponse.json(
      { error: "Could not look up this document", eventId },
      { status: 500 },
    );
  }

  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(document.storage_key, SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    const { eventId } = captureServerError(error ?? "No signed URL returned", {
      operation: "documents.sign",
      userId: user.id,
      documentId: id,
    });
    return NextResponse.json(
      { error: "Could not sign document", eventId },
      { status: 500 },
    );
  }

  return NextResponse.json({
    url: data.signedUrl,
    filename: document.original_filename,
    mimeType: document.mime_type,
    expiresInSeconds: SIGNED_URL_TTL_SECONDS,
  });
}
