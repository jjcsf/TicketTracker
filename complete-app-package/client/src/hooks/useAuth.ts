import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const isForbidden = error && /^403: .*/.test((error as Error).message);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isForbidden,
    error,
  };
}
