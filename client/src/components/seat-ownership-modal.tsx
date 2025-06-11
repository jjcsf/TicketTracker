import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusIcon, UserIcon, RockingChair } from "lucide-react";
import type { Seat, TicketHolder, SeatOwnership, Season } from "@shared/schema";

interface SeatOwnershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  seasonId: number | null;
}

const ownershipSchema = z.object({
  seatId: z.string().min(1, "Please select a seat"),
  ticketHolderId: z.string().min(1, "Please select a ticket holder"),
});

type OwnershipFormData = z.infer<typeof ownershipSchema>;

export default function SeatOwnershipModal({ isOpen, onClose, seasonId }: SeatOwnershipModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<OwnershipFormData>({
    resolver: zodResolver(ownershipSchema),
    defaultValues: {
      seatId: "",
      ticketHolderId: "",
    },
  });

  const { data: seasons } = useQuery<Season[]>({
    queryKey: ["/api/seasons"],
    enabled: isOpen && !!seasonId,
  });

  const season = seasons?.find(s => s.id === seasonId);

  // Fetch all seats and filter client-side to ensure proper filtering
  const { data: allSeatsRaw } = useQuery<Seat[]>({
    queryKey: ["/api/seats"],
    enabled: isOpen,
  });

  // Filter seats by current season's team
  const allSeats = allSeatsRaw?.filter(seat => seat.teamId === season?.teamId) || [];

  const { data: ticketHolders } = useQuery<TicketHolder[]>({
    queryKey: ["/api/ticket-holders"],
    enabled: isOpen,
  });

  const { data: ownerships, refetch: refetchOwnerships } = useQuery<SeatOwnership[]>({
    queryKey: ["/api/seat-ownership", seasonId],
    queryFn: async () => {
      const response = await fetch(`/api/seat-ownership?seasonId=${seasonId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch seat ownership');
      return response.json();
    },
    enabled: isOpen && !!seasonId,
    staleTime: 0, // Always refetch when seasonId changes
  });

  const ownershipMutation = useMutation({
    mutationFn: async (data: OwnershipFormData) => {
      if (!seasonId) throw new Error("No season selected");
      
      const ownershipData = {
        seatId: parseInt(data.seatId),
        seasonId,
        ticketHolderId: parseInt(data.ticketHolderId),
      };
      
      return apiRequest("POST", "/api/seat-ownership", ownershipData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Seat ownership assigned successfully.",
      });
      form.reset();
      refetchOwnerships();
      queryClient.invalidateQueries({ queryKey: ["/api/seat-ownership"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/financial-summary"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to assign seat ownership. This seat may already be owned.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: OwnershipFormData) => {
    ownershipMutation.mutate(data);
  };

  const formatSeatName = (seat: Seat) => {
    return `Section ${seat.section}, Row ${seat.row}, Seat ${seat.number}`;
  };

  const getTicketHolderName = (ownership: any) => {
    return ownership.ticketHolder?.name || ticketHolders?.find(h => h.id === ownership.ticketHolderId)?.name || "Unknown";
  };

  const getSeatName = (ownership: any) => {
    const seat = ownership.seat || allSeats?.find(s => s.id === ownership.seatId);
    return seat ? formatSeatName(seat) : "Unknown Seat";
  };

  const getAvailableSeats = () => {
    if (!allSeats || !season) return [];
    
    // allSeats is already filtered by team
    // Filter out seats that are already owned in the current season
    const ownedSeatIds = ownerships ? ownerships.map(o => o.seatId) : [];
    return allSeats.filter(seat => !ownedSeatIds.includes(seat.id));
  };

  const formatCurrency = (amount: string | null) => {
    if (!amount) return "N/A";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(parseFloat(amount));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Seat Ownership Management
            {season && <span className="text-slate-500 font-normal"> - {season.year} Season</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Assignment Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <PlusIcon className="w-5 h-5 mr-2" />
                Assign Seat Ownership
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="seatId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Available Seat</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select an available seat" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {getAvailableSeats().map((seat) => (
                              <SelectItem key={seat.id} value={seat.id.toString()}>
                                {formatSeatName(seat)} - {formatCurrency(seat.licenseCost)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ticketHolderId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ticket Holder</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select ticket holder" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ticketHolders?.map((holder) => (
                              <SelectItem key={holder.id} value={holder.id.toString()}>
                                {holder.name}
                                {holder.email && <span className="text-slate-500"> ({holder.email})</span>}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    disabled={ownershipMutation.isPending || !seasonId || getAvailableSeats().length === 0}
                    className="w-full"
                  >
                    {ownershipMutation.isPending ? "Assigning..." : "Assign Ownership"}
                  </Button>

                  {getAvailableSeats().length === 0 && allSeats && allSeats.length > 0 && (
                    <p className="text-sm text-slate-500 text-center">
                      All seats have been assigned for this season.
                    </p>
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Current Ownerships */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <RockingChair className="w-5 h-5 mr-2" />
                Current Seat Assignments ({ownerships?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-80 overflow-y-auto">
              {!ownerships || ownerships.length === 0 ? (
                <div className="text-center text-slate-500 py-8">
                  <RockingChair className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No seat assignments for this season yet.</p>
                  <p className="text-sm">Start by assigning seats to ticket holders.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ownerships.map((ownership) => (
                    <div 
                      key={ownership.id} 
                      className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <UserIcon className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {getTicketHolderName(ownership)}
                          </p>
                          <p className="text-sm text-slate-600">
                            {getSeatName(ownership)}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                        Owned
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}