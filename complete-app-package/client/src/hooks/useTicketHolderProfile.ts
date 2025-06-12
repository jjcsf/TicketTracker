import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import type { TicketHolder } from "@shared/schema";

export function useTicketHolderProfile() {
  const { user, isAuthenticated } = useAuth();

  const { data: ticketHolders } = useQuery<TicketHolder[]>({
    queryKey: ["/api/ticket-holders"],
    enabled: isAuthenticated,
  });

  // Find ticket holder that matches the logged-in user's email
  const matchedTicketHolder = ticketHolders?.find(
    holder => holder.email && user?.email && 
    holder.email.toLowerCase() === user.email.toLowerCase()
  );

  return {
    ticketHolder: matchedTicketHolder || null,
    isMatched: !!matchedTicketHolder,
    hasMultipleHolders: (ticketHolders?.length || 0) > 1,
    allTicketHolders: ticketHolders || [],
  };
}