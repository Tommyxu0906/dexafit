import { requireUser } from "@/lib/auth";
import { getOrCreateProfessional } from "@/lib/data/professional";
import { createClient } from "@/lib/supabase/server";
import { PracticeForm } from "./practice-form";

export default async function PracticeStep() {
  const user = await requireUser();
  const { profile } = await getOrCreateProfessional(user.id);

  let organization = null;
  if (profile.organization_id) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", profile.organization_id)
      .maybeSingle();
    organization = data;
  }

  return <PracticeForm profile={profile} organization={organization} />;
}
