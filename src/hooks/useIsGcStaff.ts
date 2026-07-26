// Hook simple: es staff Geocapitals si `is_gc_staff` RPC devuelve true.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useIsGcStaff() {
  const { user } = useAuth();
  const [isStaff, setIsStaff] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsStaff(false);
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase.rpc("is_gc_staff", { _user_id: user.id });
      setIsStaff(!!data);
      setLoading(false);
    })();
  }, [user]);

  return { isStaff, loading };
}
