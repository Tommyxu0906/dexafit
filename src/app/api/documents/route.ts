import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { captureServerError } from "@/lib/observability";
import { getOrCreateProfessional } from "@/lib/data/professional";
import { DOCUMENT_TYPES, type DocumentType } from "@/lib/domain/enums";
import { createClient } from "@/lib/supabase/server";
import {
  bucketForDocumentType,
  buildStorageKey,
  isAllowedForDocumentType,
  validateUpload,
} from "@/lib/storage";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const documentType = formData.get("documentType");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (
    typeof documentType !== "string" ||
    !(DOCUMENT_TYPES as readonly string[]).includes(documentType)
  ) {
    return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const validation = validateUpload(bytes, file.size);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // A profile photo is shown on a public page, so a PDF is refused here even
  // though it is a fine credential document. Checked against the sniffed type,
  // never the browser-supplied one.
  if (!isAllowedForDocumentType(documentType, validation.mimeType)) {
    return NextResponse.json(
      { error: "A profile photo must be a JPG, PNG or WebP image." },
      { status: 400 },
    );
  }

  // Ownership comes from the session, not from the request body.
  const { profile } = await getOrCreateProfessional(user.id);
  const storageKey = buildStorageKey(profile.id, documentType, validation.extension);
  // Photos go to the public bucket; everything else stays private. The storage
  // policy enforces this independently, so a mistake here fails the upload.
  const bucket = bucketForDocumentType(documentType);

  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storageKey, bytes, {
      contentType: validation.mimeType,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `Upload failed: ${uploadError.message}` },
      { status: 500 },
    );
  }

  const { data, error } = await supabase
    .from("professional_documents")
    .insert({
      professional_id: profile.id,
      document_type: documentType as DocumentType,
      bucket,
      storage_key: storageKey,
      original_filename: file.name.slice(0, 255),
      mime_type: validation.mimeType,
      file_size: file.size,
    })
    .select("id, original_filename, mime_type, file_size")
    .single();

  if (error) {
    // Best effort: the caller already has their error. If the rollback itself
    // fails the object is orphaned in storage, which is worth knowing about.
    const { error: rollbackError } = await supabase.storage
      .from(bucket)
      .remove([storageKey]);
    if (rollbackError) {
      captureServerError(rollbackError, {
        operation: "documents.rollbackUpload",
        userId: user.id,
        detail: "orphaned object left in storage",
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // The storage key stays server-side; callers reference documents by id.
  return NextResponse.json({ document: data });
}
