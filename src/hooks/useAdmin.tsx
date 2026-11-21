import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";

const ADMIN_ROLE_STALE_TIME = 5 * 60 * 1000;

export function useAdmin() {
  const { user } = useAuth();
  const userId = user?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-role", userId],
    enabled: Boolean(userId),
    staleTime: ADMIN_ROLE_STALE_TIME,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (error) throw error;
      return Boolean(data);
    },
  });

  return {
    isAdmin: userId ? data === true : false,
    isLoading: userId ? isLoading : false,
  };
}
