import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EditIcon, UserIcon, MailIcon, StickyNoteIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import EditTicketHolderModal from "@/components/edit-ticket-holder-modal";
import type { TicketHolder, SeatOwnership } from "@shared/schema";

export default function TicketHoldersTable() {
  const [editingHolder, setEditingHolder] = useState<TicketHolder | null>(null);
  const { toast } = useToast();

  const { data: ticketHolders, isLoading } = useQuery<TicketHolder[]>({
    queryKey: ["/api/ticket-holders"],
  });

  const { data: seatOwnerships } = useQuery<SeatOwnership[]>({
    queryKey: ["/api/seat-ownership"],
  });

  // Calculate seat ownership counts for each ticket holder
  const getHolderStats = (holderId: number) => {
    const ownerships = seatOwnerships?.filter(so => so.ticketHolderId === holderId) || [];
    const uniqueSeasons = new Set(ownerships.map(so => so.seasonId));
    return {
      totalSeats: ownerships.length,
      seasons: Array.from(uniqueSeasons).length
    };
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center text-slate-500">Loading ticket holders...</div>
      </div>
    );
  }

  if (!ticketHolders || ticketHolders.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center text-slate-500">
          No ticket holders found. Add ticket holders to get started.
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Ticket Holder
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Contact
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Seat Ownership
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Notes
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {ticketHolders.map((holder) => {
            const stats = getHolderStats(holder.id);
            
            return (
              <tr key={holder.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                      <UserIcon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {holder.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        ID: {holder.id}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {holder.email ? (
                    <div className="flex items-center text-sm text-slate-900">
                      <MailIcon className="w-4 h-4 text-slate-400 mr-2" />
                      {holder.email}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-400">No email provided</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      {stats.totalSeats} seats
                    </Badge>
                    {stats.seasons > 0 && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {stats.seasons} seasons
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  {holder.notes ? (
                    <div className="flex items-start text-sm text-slate-900 max-w-xs">
                      <StickyNoteIcon className="w-4 h-4 text-slate-400 mr-2 mt-0.5 flex-shrink-0" />
                      <div className="truncate" title={holder.notes}>
                        {holder.notes}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-400">No notes</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingHolder(holder)}
                    className="inline-flex items-center gap-1"
                  >
                    <EditIcon className="h-4 w-4" />
                    Edit
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Edit Ticket Holder Modal */}
      <EditTicketHolderModal
        isOpen={!!editingHolder}
        onClose={() => setEditingHolder(null)}
        ticketHolder={editingHolder}
      />
    </div>
  );
}