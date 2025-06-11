import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Team, Season, TicketHolder } from "@shared/schema";

const paymentSchema = z.object({
  seasonId: z.string().refine((val) => val === "none" || (val.length > 0 && !isNaN(Number(val))), "Please select a season or 'Not applicable'"),
  ticketHolderId: z.string().optional(),
  fromOwnerId: z.string().optional(),
  amount: z.string().min(1, "Amount is required").refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Amount must be a positive number"),
  type: z.enum(["from_owner", "to_owner", "to_team", "from_team"]),
  category: z.string().min(1, "Please select a category"),
  description: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface EnhancedAddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  teams?: Team[];
  seasons?: Season[];
  ticketHolders?: TicketHolder[];
}

export default function EnhancedAddPaymentModal({
  isOpen,
  onClose,
  teams,
  seasons,
  ticketHolders,
}: EnhancedAddPaymentModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      seasonId: "",
      ticketHolderId: "",
      fromOwnerId: "",
      amount: "",
      type: "from_owner",
      category: "",
      description: "",
      date: new Date().toISOString().split('T')[0],
      notes: "",
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async (data: PaymentFormData) => {
      // Auto-determine team from season when payment type is "to_team"
      let teamId = null;
      if (data.type === "to_team" && data.seasonId !== "none") {
        const selectedSeason = seasons?.find(s => s.id === parseInt(data.seasonId));
        teamId = selectedSeason?.teamId || null;
      }

      const paymentData = {
        seasonId: data.seasonId === "none" ? null : parseInt(data.seasonId),
        ticketHolderId: data.fromOwnerId ? parseInt(data.fromOwnerId) : (data.ticketHolderId ? parseInt(data.ticketHolderId) : null),
        teamId: teamId,
        amount: data.amount,
        type: data.type,
        category: data.category,
        description: data.description || null,
        date: data.date,
        notes: data.notes || null,
      };

      return apiRequest("/api/payments", "POST", paymentData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Payment recorded successfully.",
      });
      form.reset();
      onClose();
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
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
        description: "Failed to record payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: PaymentFormData) => {
    paymentMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Financial Transaction</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="seasonId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Season</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select season" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {seasons?.map((season) => {
                          const team = teams?.find(t => t.id === season.teamId);
                          return (
                            <SelectItem key={season.id} value={season.id.toString()}>
                              {team?.name} - {season.year}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="from_owner">From Owner</SelectItem>
                        <SelectItem value="to_owner">To Owner</SelectItem>
                        <SelectItem value="to_team">To Team</SelectItem>
                        <SelectItem value="from_team">From Team</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {(form.watch("type") === "from_owner" || form.watch("type") === "to_owner") && (
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
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {form.watch("type") === "to_team" && (
              <FormField
                control={form.control}
                name="fromOwnerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Owner</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select which owner is making this payment" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ticketHolders?.map((holder) => (
                          <SelectItem key={holder.id} value={holder.id.toString()}>
                            {holder.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {form.watch("type") === "to_team" && form.watch("seasonId") && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Team:</strong> {(() => {
                    const selectedSeason = seasons?.find(s => s.id === parseInt(form.watch("seasonId")));
                    const team = teams?.find(t => t.id === selectedSeason?.teamId);
                    return team?.name || "No team found";
                  })()}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Team is automatically determined by the selected season
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount ($)</FormLabel>
                    <FormControl>
                      <Input placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="seat_license">Seat License</SelectItem>
                      <SelectItem value="season_fee">Season Fee</SelectItem>
                      <SelectItem value="concessions">Concessions</SelectItem>
                      <SelectItem value="parking">Parking</SelectItem>
                      <SelectItem value="merchandise">Merchandise</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Payment description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional notes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={paymentMutation.isPending}>
                {paymentMutation.isPending ? "Adding..." : "Add Payment"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}