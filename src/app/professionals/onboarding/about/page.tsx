import { requireUser } from "@/lib/auth";
import { getApplicationBundle, getOrCreateProfessional } from "@/lib/data/professional";
import { AboutForm } from "./about-form";

export default async function AboutStep() {
  const user = await requireUser();
  const { profile } = await getOrCreateProfessional(user.id);
  const bundle = await getApplicationBundle(profile.id);

  const photo =
    bundle?.documents.find((d) => d.id === profile.profile_photo_document_id) ?? null;

  return (
    <AboutForm
      profile={profile}
      defaultEmail={profile.email ?? user.email}
      photo={photo ? { id: photo.id, original_filename: photo.original_filename } : null}
    />
  );
}
