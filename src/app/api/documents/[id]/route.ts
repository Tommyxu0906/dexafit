import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { captureServerError } from "@/lib/observability";
import { createClient } from "@/lib/supabase/server";
import { PHOTO_BUCKET, SIGNED_URL_TTL_SECONDS } from "@/lib/storage";

/**
 * Resolves one document to a URL the caller can fetch.
 *
 * Credential documents get a signed URL that expires in a minute, and
 * authorization is enforced twice: RLS restricts the document row to its owner
 * or an admin, and a short expiry means a leaked link is not a durable grant.
 *
 * A profile photo is different in kind — it is meant to be seen by anyone
 * browsing the marketplace — so it lives in the public bucket and resolves to a
 * permanent URL. Nothing else does. The two are kept in separate buckets, with
 * the storage policy refusing anything but a photo in the public one, so this
 * branch cannot be talked into publishing a licence.
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
    .select("id, document_type, bucket, storage_key, original_filename, mime_type")
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

  // The row says where the bytes are. Deriving it from the document type would
  // be wrong for any photo uploaded before the buckets were split — those are
  // still private, and asking the public bucket for them returns a URL that
  // 404s rather than an error anyone would notice.
  if (document.bucket === PHOTO_BUCKET) {
    const { data: publicData } = supabase.storage
      .from(PHOTO_BUCKET)
      .getPublicUrl(document.storage_key);

    return NextResponse.json({
      url: publicData.publicUrl,
      filename: document.original_filename,
      mimeType: document.mime_type,
      // Absent rather than zero: a caller that refreshes on expiry should not
      // be told this one expires immediately.
      expiresInSeconds: null,
    });
  }

  const { data, error } = await supabase.storage
    .from(document.bucket)
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
