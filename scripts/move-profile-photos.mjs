#!/usr/bin/env node
/**
 * One-off: move profile photos uploaded before the buckets were split out of
 * the private document bucket and into the public photo bucket.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/move-profile-photos.mjs --dry-run
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/move-profile-photos.mjs
 *
 * Why this needs the service role key: the objects belong to several different
 * providers, and the storage policies (correctly) only let a provider move
 * their own. There is no session that can do all three. This is the sanctioned
 * use of that key — admin tooling run from a laptop, never in the deployment.
 * Pass it on the command line as above so it does not linger in .env.local.
 *
 * Why it cannot be done in SQL: object storage keys the bytes by bucket, so
 * updating professional_documents.bucket or storage.objects.bucket_id alone
 * would leave the row pointing at bytes that are not there.
 *
 * Safe to re-run. Anything already moved is skipped, and a photo is only moved
 * after its bytes are confirmed present at the destination.
 */

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const DRY_RUN = process.argv.includes("--dry-run");

const PRIVATE_BUCKET = "professional-documents";
const PUBLIC_BUCKET = "professional-photos";

function readEnvFile() {
  // Only the URL is read from the file; the key is deliberately not.
  const fs = require("node:fs");
  const path = require("node:path");
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const { createRequire } = await import("node:module");
const require = createRequire(import.meta.url);

const env = readEnvFile();
const URL_BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "")
  .trim()
  .replace(/\/$/, "");

if (!URL_BASE) {
  console.error("NEXT_PUBLIC_SUPABASE_URL is not set (checked env and .env.local).");
  process.exit(1);
}
if (!SERVICE_KEY) {
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY is not set.\n" +
      "Get it from Supabase → Project Settings → API → service_role, and pass it\n" +
      "on the command line rather than saving it:\n\n" +
      "  SUPABASE_SERVICE_ROLE_KEY=... node scripts/move-profile-photos.mjs --dry-run\n",
  );
  process.exit(1);
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function rest(path, init = {}) {
  const response = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} -> ${response.status} ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function objectExists(bucket, key) {
  // A HEAD on the object endpoint answers without downloading the bytes.
  const response = await fetch(
    `${URL_BASE}/storage/v1/object/${bucket}/${encodeURI(key)}`,
    { method: "HEAD", headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  );
  return response.ok;
}

async function main() {
  const pending = await rest(
    `professional_documents?document_type=eq.PROFILE_PHOTO&bucket=eq.${PRIVATE_BUCKET}` +
      `&select=id,storage_key,professional_id`,
  );

  if (pending.length === 0) {
    console.log("Nothing to move: every profile photo is already in the public bucket.");
    return;
  }

  console.log(`${pending.length} profile photo(s) to move${DRY_RUN ? " (dry run)" : ""}:\n`);

  let moved = 0;
  let failed = 0;

  for (const doc of pending) {
    const key = doc.storage_key;

    // Defence in depth. The key layout is <professional>/<type>/<uuid>, and
    // nothing but a photo may enter the public bucket — if this row's key says
    // otherwise, the data is wrong and moving it would publish a document.
    if (key.split("/")[1] !== "PROFILE_PHOTO") {
      console.error(`  REFUSED  ${key}\n           not a PROFILE_PHOTO key; leaving it alone`);
      failed += 1;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  would move  ${key}`);
      continue;
    }

    try {
      const response = await fetch(`${URL_BASE}/storage/v1/object/move`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          bucketId: PRIVATE_BUCKET,
          sourceKey: key,
          destinationBucket: PUBLIC_BUCKET,
          destinationKey: key,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        // Already moved by an earlier run: treat as success if the bytes are
        // where they should be.
        if (await objectExists(PUBLIC_BUCKET, key)) {
          console.log(`  already there  ${key}`);
        } else {
          throw new Error(`${response.status} ${body}`);
        }
      }

      // Only record the move once the bytes are confirmed at the destination.
      if (!(await objectExists(PUBLIC_BUCKET, key))) {
        throw new Error("move reported success but the object is not at the destination");
      }

      await rest(`professional_documents?id=eq.${doc.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ bucket: PUBLIC_BUCKET }),
      });

      console.log(`  moved  ${key}`);
      moved += 1;
    } catch (error) {
      console.error(`  FAILED  ${key}\n          ${error.message}`);
      failed += 1;
    }
  }

  if (!DRY_RUN) {
    console.log(`\nmoved ${moved}, failed ${failed}`);
    if (failed > 0) process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
