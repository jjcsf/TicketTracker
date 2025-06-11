import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { insertTicketHolderSchema, type TicketHolder } from "@shared/schema";
import { z } from "zod";

interface EditTicketHolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketHolder: TicketHolder | null;
}

type TicketHolderFormData = z.infer<typeof insertTicketHolderSchema>;

export default function EditTicketHolderModal({ isOpen, onClose, ticketHolder }: EditTicketHolderModalProps) {
  const { toast } = useToast();

  const form = useForm<TicketHolderFormData>({
    resolver: zodResolver(insertTicketHolderSchema),
    defaultValues: {
      name: ticketHolder?.name || "",
      email: ticketHolder?.email || "",
      notes: ticketHolder?.notes || "",
    },
  });

  // Reset form when ticket holder changes
  React.useEffect(() => {
    if (ticketHolder) {
      form.reset({
        name: ticketHolder.name,
        email: ticketHolder.email || "",
        notes: ticketHolder.notes || "",
      });
    }
  }, [ticketHolder, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: TicketHolderFormData) => {
      if (!ticketHolder) throw new Error("No ticket holder to update");
      
      return apiRequest("PATCH", `/api/ticket-holders/${ticketHolder.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ticket-holders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/seat-ownership"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/financial-summary"] });
      toast({
        title: "Success",
        description: "Ticket holder updated successfully",
      });
      onClose();
      form.reset();
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
        description: `Failed to update ticket holder: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: TicketHolderFormData) => {
    updateMutation.mutate(data);
  };

  const handleClose = () => {
    onClose();
    form.reset();
  };

  if (!ticketHolder) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Ticket Holder</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter ticket holder name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="Enter email address" 
                      {...field}
                      value={field.value || ""}
                    />
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
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter any additional notes" 
                      rows={3}
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Updating..." : "Update Ticket Holder"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}