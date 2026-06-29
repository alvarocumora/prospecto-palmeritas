import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type OnboardingState = "not_started" | "in_progress" | "completed";

export function useOnboardingStatus() {
  const { user } = useAuth();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setState(null);
      setLoading(false);
      return;
    }
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("onboarding_status")
        .select("state")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancel) {
        setState(((data?.state as OnboardingState) ?? "not_started"));
        setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [user]);

  const refresh = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("onboarding_status")
      .select("state")
      .eq("user_id", user.id)
      .maybeSingle();
    setState(((data?.state as OnboardingState) ?? "not_started"));
  };

  return { state, loading, refresh, isComplete: state === "completed" };
}
