import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PlusIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { TicketHolder } from "@shared/schema";

const seatLicensePaymentSchema = z.object({
  ticketHolderId: z.string().min(1, "Please select a ticket holder"),
  amount: z.string().min(1, "Amount is required").refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Amount must be a positive number"),
  description: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
});

type SeatLicensePaymentFormData = z.infer<typeof seatLicensePaymentSchema>;

interface SeatLicensePaymentModalProps {
  ticketHolders: TicketHolder[];
}

export default function SeatLicensePaymentModal({ ticketHolders }: SeatLicensePaymentModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const form = useForm<SeatLicensePaymentFormData>({
    resolver: zodResolver(seatLicensePaymentSchema),
    defaultValues: {
      ticketHolderId: "",
      amount: "",
      description: "",
      date: new Date().toISOString().split('T')[0],
      notes: "",
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async (data: SeatLicensePaymentFormData) => {
      const paymentData = {
        seasonId: null, // Seat license payments are not tied to seasons
        ticketHolderId: parseInt(data.ticketHolderId),
        teamId: null,
        amount: data.amount,
        type: "from_owner",
        category: "seat_license",
        description: data.description || null,
        date: data.date,
        notes: data.notes || null,
      };
      
      return apiRequest("/api/payments", "POST", paymentData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Seat license payment recorded successfully.",
      });
      form.reset();
      setShowModal(false);
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
        description: error instanceof Error ? error.message : "Failed to record payment.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: SeatLicensePaymentFormData) => {
    paymentMutation.mutate(data);
  };

  return (
    <Dialog open={showModal} onOpenChange={setShowModal}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <PlusIcon className="w-4 h-4 mr-2" />
          Add Seat License Payment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Seat License Payment</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
                      {ticketHolders.map((holder) => (
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount ($)</FormLabel>
                    <FormControl>
                      <Input placeholder="9996.39" {...field} />
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Seat license purchase details" {...field} />
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
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
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