import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Game, Seat, TicketHolder } from "@shared/schema";

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  seasonId: number | null;
}

const transferSchema = z.object({
  gameId: z.string().min(1, "Please select a game"),
  seatId: z.string().min(1, "Please select a seat"),
  toTicketHolderId: z.string().min(1, "Please select a recipient"),
  amount: z.string().min(1, "Please enter an amount"),
});

type TransferFormData = z.infer<typeof transferSchema>;

export default function TransferModal({ isOpen, onClose, seasonId }: TransferModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      gameId: "",
      seatId: "",
      toTicketHolderId: "",
      amount: "",
    },
  });

  const { data: games } = useQuery<Game[]>({
    queryKey: ["/api/games", seasonId],
    enabled: !!seasonId && isOpen,
  });

  const { data: seats } = useQuery<Seat[]>({
    queryKey: ["/api/seats"],
    enabled: isOpen,
  });

  const { data: ticketHolders } = useQuery<TicketHolder[]>({
    queryKey: ["/api/ticket-holders"],
    enabled: isOpen,
  });

  const transferMutation = useMutation({
    mutationFn: async (data: TransferFormData) => {
      const transferData = {
        gameId: parseInt(data.gameId),
        seatId: parseInt(data.seatId),
        fromTicketHolderId: 1, // TODO: Get from current user/seat ownership
        toTicketHolderId: parseInt(data.toTicketHolderId),
        amount: data.amount,
        date: new Date().toISOString().split('T')[0],
        status: "pending",
      };
      
      return apiRequest("POST", "/api/transfers", transferData);
    },
    onSuccess: () => {
      toast({
        title: "Transfer Created",
        description: "Seat transfer has been created successfully.",
      });
      form.reset();
      onClose();
      queryClient.invalidateQueries({ queryKey: ["/api/transfers"] });
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
        description: "Failed to create transfer. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: TransferFormData) => {
    transferMutation.mutate(data);
  };

  const formatGameOption = (game: Game) => {
    const date = new Date(game.date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
    return `${date} ${game.homeGame ? 'vs' : '@'} ${game.opponent}`;
  };

  const formatSeatOption = (seat: Seat) => {
    return `Section ${seat.section}, Row ${seat.row}, Seat ${seat.number}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer Seat</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="gameId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Game</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a game" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {games?.map((game) => (
                        <SelectItem key={game.id} value={game.id.toString()}>
                          {formatGameOption(game)}
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
              name="seatId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Seat</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a seat" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {seats?.map((seat) => (
                        <SelectItem key={seat.id} value={seat.id.toString()}>
                          {formatSeatOption(seat)}
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
              name="toTicketHolderId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transfer To</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select recipient" />
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

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transfer Amount ($)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="200.00"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={transferMutation.isPending}>
                {transferMutation.isPending ? "Creating..." : "Create Transfer"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
