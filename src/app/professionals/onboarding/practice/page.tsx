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
    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", profile.organization_id)
      .maybeSingle();
    if (error) {
      throw new Error(`Could not load your organization details: ${error.message}`);
    }
    organization = data;
  }

  return <PracticeForm profile={profile} organization={organization} />;
}
