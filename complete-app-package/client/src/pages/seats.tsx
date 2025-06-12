import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { PlusIcon, RockingChair, EditIcon, TrashIcon, UsersIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Team, Season, TicketHolder, Seat, SeatOwnership } from "@shared/schema";

const seatSchema = z.object({
  teamId: z.string().min(1, "Please select a team"),
  section: z.string().min(1, "Section is required"),
  row: z.string().min(1, "Row is required"),
  number: z.string().min(1, "Seat number is required"),
  licenseCost: z.string().optional(),
});

const seatOwnershipSchema = z.object({
  seatId: z.string().min(1, "Please select a seat"),
  seasonId: z.string().min(1, "Please select a season"),
  ticketHolderId: z.string().min(1, "Please select a ticket holder"),
});

type SeatFormData = z.infer<typeof seatSchema>;
type SeatOwnershipFormData = z.infer<typeof seatOwnershipSchema>;

interface SeatWithOwnership extends Seat {
  teamName?: string;
  ownershipDetails?: {
    seasonId: number;
    seasonYear: number;
    ticketHolderName: string;
  }[];
}

export default function Seats() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [showAddSeatModal, setShowAddSeatModal] = useState(false);
  const [showAddOwnershipModal, setShowAddOwnershipModal] = useState(false);
  const [editingSeat, setEditingSeat] = useState<Seat | null>(null);
  const [showEditSeatModal, setShowEditSeatModal] = useState(false);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast]);

  const { data: teams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    enabled: isAuthenticated,
  });

  const { data: seasons } = useQuery<Season[]>({
    queryKey: ["/api/seasons"],
    enabled: isAuthenticated,
  });

  const { data: ticketHolders } = useQuery<TicketHolder[]>({
    queryKey: ["/api/ticket-holders"],
    enabled: isAuthenticated,
  });

  const { data: seats } = useQuery<Seat[]>({
    queryKey: ["/api/seats", selectedTeamId],
    queryFn: async () => {
      const res = await fetch(`/api/seats${selectedTeamId ? `?teamId=${selectedTeamId}` : ''}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const { data: seatOwnerships } = useQuery<SeatOwnership[]>({
    queryKey: ["/api/seat-ownership"],
    enabled: isAuthenticated,
  });

  // Create seats with ownership details
  const seatsWithOwnership: SeatWithOwnership[] = seats?.map(seat => {
    const team = teams?.find(t => t.id === seat.teamId);
    const ownerships = seatOwnerships?.filter(so => so.seatId === seat.id) || [];
    
    const ownershipDetails = ownerships.map(ownership => {
      const season = seasons?.find(s => s.id === ownership.seasonId);
      const ticketHolder = ticketHolders?.find(th => th.id === ownership.ticketHolderId);
      
      return {
        seasonId: ownership.seasonId,
        seasonYear: season?.year || 0,
        ticketHolderName: ticketHolder?.name || 'Unknown',
      };
    });

    return {
      ...seat,
      teamName: team?.name,
      ownershipDetails,
    };
  }) || [];

  const seatForm = useForm<SeatFormData>({
    resolver: zodResolver(seatSchema),
    defaultValues: {
      teamId: "",
      section: "",
      row: "",
      number: "",
      licenseCost: "",
    },
  });

  const ownershipForm = useForm<SeatOwnershipFormData>({
    resolver: zodResolver(seatOwnershipSchema),
    defaultValues: {
      seatId: "",
      seasonId: "",
      ticketHolderId: "",
    },
  });

  const createSeatMutation = useMutation({
    mutationFn: async (data: SeatFormData) => {
      return apiRequest(`/api/seats`, "POST", {
        teamId: parseInt(data.teamId),
        section: data.section,
        row: data.row,
        number: data.number,
        licenseCost: data.licenseCost ? parseFloat(data.licenseCost) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seats"] });
      setShowAddSeatModal(false);
      seatForm.reset();
      toast({
        title: "Success",
        description: "Seat created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create seat",
        variant: "destructive",
      });
    },
  });

  const updateSeatMutation = useMutation({
    mutationFn: async (data: SeatFormData) => {
      if (!editingSeat) throw new Error("No seat selected");
      
      const payload = {
        teamId: parseInt(data.teamId),
        section: data.section,
        row: data.row,
        number: data.number,
        licenseCost: data.licenseCost ? parseFloat(data.licenseCost) : null,
      };
      
      console.log("Updating seat with payload:", payload);
      console.log("Editing seat ID:", editingSeat.id);
      
      return apiRequest(`/api/seats/${editingSeat.id}`, "PATCH", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seats"] });
      setShowEditSeatModal(false);
      setEditingSeat(null);
      seatForm.reset();
      toast({
        title: "Success",
        description: "Seat updated successfully",
      });
    },
    onError: (error: any) => {
      console.error("Seat update error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update seat",
        variant: "destructive",
      });
    },
  });

  const createOwnershipMutation = useMutation({
    mutationFn: async (data: SeatOwnershipFormData) => {
      return apiRequest(`/api/seat-ownership`, "POST", {
        seatId: parseInt(data.seatId),
        seasonId: parseInt(data.seasonId),
        ticketHolderId: parseInt(data.ticketHolderId),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seat-ownership"] });
      setShowAddOwnershipModal(false);
      ownershipForm.reset();
      toast({
        title: "Success",
        description: "Seat ownership assigned successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign seat ownership",
        variant: "destructive",
      });
    },
  });

  const handleSeatSubmit = (data: SeatFormData) => {
    createSeatMutation.mutate(data);
  };

  const handleSeatUpdate = (data: SeatFormData) => {
    console.log("Form data before submission:", data);
    console.log("Form validation errors:", seatForm.formState.errors);
    updateSeatMutation.mutate(data);
  };

  const handleOwnershipSubmit = (data: SeatOwnershipFormData) => {
    createOwnershipMutation.mutate(data);
  };

  const handleEditSeat = (seat: Seat) => {
    setEditingSeat(seat);
    seatForm.reset({
      teamId: seat.teamId.toString(),
      section: seat.section,
      row: seat.row,
      number: seat.number,
      licenseCost: seat.licenseCost ? seat.licenseCost.toString() : "",
    });
    setShowEditSeatModal(true);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 lg:ml-64">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Seats & Ownership</h1>
              <p className="text-slate-600">Manage seat inventory and ownership assignments</p>
            </div>

            {/* Filters */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RockingChair className="h-5 w-5" />
                  Seat Filters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="block text-sm font-medium text-slate-700 mb-2">Team</Label>
                    <Select value={selectedTeamId?.toString() || "all"} onValueChange={(value) => setSelectedTeamId(value === "all" ? null : parseInt(value))}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Teams" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Teams</SelectItem>
                        {teams?.map((team) => (
                          <SelectItem key={team.id} value={team.id.toString()}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-4 mb-6">
              <Dialog open={showAddSeatModal} onOpenChange={setShowAddSeatModal}>
                <DialogTrigger asChild>
                  <Button>
                    <PlusIcon className="w-4 h-4 mr-2" />
                    Add Seat
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Seat</DialogTitle>
                  </DialogHeader>
                  <Form {...seatForm}>
                    <form onSubmit={seatForm.handleSubmit(handleSeatSubmit)} className="space-y-4">
                      <FormField
                        control={seatForm.control}
                        name="teamId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Team</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select team" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {teams?.map((team) => (
                                  <SelectItem key={team.id} value={team.id.toString()}>
                                    {team.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                          control={seatForm.control}
                          name="section"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Section</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., 119" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={seatForm.control}
                          name="row"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Row</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., 1" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={seatForm.control}
                          name="number"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Seat Number</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., 15" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={seatForm.control}
                        name="licenseCost"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>License Cost (Optional)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                placeholder="e.g., 5000.00" 
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end gap-3">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => {
                            setShowAddSeatModal(false);
                            seatForm.reset();
                          }}
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={createSeatMutation.isPending}
                        >
                          {createSeatMutation.isPending ? "Creating..." : "Create Seat"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              <Dialog open={showAddOwnershipModal} onOpenChange={setShowAddOwnershipModal}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <UsersIcon className="w-4 h-4 mr-2" />
                    Assign Ownership
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Assign Seat Ownership</DialogTitle>
                  </DialogHeader>
                  <Form {...ownershipForm}>
                    <form onSubmit={ownershipForm.handleSubmit(handleOwnershipSubmit)} className="space-y-4">
                      <FormField
                        control={ownershipForm.control}
                        name="seatId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Seat</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select seat" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {seats?.map((seat) => {
                                  const team = teams?.find(t => t.id === seat.teamId);
                                  return (
                                    <SelectItem key={seat.id} value={seat.id.toString()}>
                                      {team?.name} - Section {seat.section}, Row {seat.row}, Seat {seat.number}
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
                        control={ownershipForm.control}
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
                                      {team?.name} {season.year}
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
                        control={ownershipForm.control}
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

                      <div className="flex justify-end gap-3">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => {
                            setShowAddOwnershipModal(false);
                            ownershipForm.reset();
                          }}
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={createOwnershipMutation.isPending}
                        >
                          {createOwnershipMutation.isPending ? "Assigning..." : "Assign Ownership"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Edit Seat Modal */}
            <Dialog open={showEditSeatModal} onOpenChange={setShowEditSeatModal}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Seat</DialogTitle>
                </DialogHeader>
                <Form {...seatForm}>
                  <form onSubmit={seatForm.handleSubmit(handleSeatUpdate)} className="space-y-4">
                    <FormField
                      control={seatForm.control}
                      name="teamId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Team</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select team" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {teams?.map((team) => (
                                <SelectItem key={team.id} value={team.id.toString()}>
                                  {team.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={seatForm.control}
                        name="section"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Section</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 119" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={seatForm.control}
                        name="row"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Row</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 1" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={seatForm.control}
                        name="number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Seat Number</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 15" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={seatForm.control}
                      name="licenseCost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>License Cost (Optional)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01" 
                              placeholder="e.g., 5000.00" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-3">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          setShowEditSeatModal(false);
                          setEditingSeat(null);
                          seatForm.reset();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={updateSeatMutation.isPending}
                      >
                        {updateSeatMutation.isPending ? "Updating..." : "Update Seat"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            {/* Seats Table */}
            <Card>
              <CardHeader>
                <CardTitle>Seat Inventory</CardTitle>
              </CardHeader>
              <CardContent>
                {seatsWithOwnership && seatsWithOwnership.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 font-medium text-slate-600">Team</th>
                          <th className="text-left py-3 px-4 font-medium text-slate-600">Section</th>
                          <th className="text-left py-3 px-4 font-medium text-slate-600">Row</th>
                          <th className="text-left py-3 px-4 font-medium text-slate-600">Seat #</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-600">License Cost</th>
                          <th className="text-left py-3 px-4 font-medium text-slate-600">Ownership</th>
                          <th className="text-center py-3 px-4 font-medium text-slate-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {seatsWithOwnership.map((seat) => (
                          <tr key={seat.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-3 px-4 text-slate-900 font-medium">
                              {seat.teamName}
                            </td>
                            <td className="py-3 px-4 text-slate-900">
                              {seat.section}
                            </td>
                            <td className="py-3 px-4 text-slate-900">
                              {seat.row}
                            </td>
                            <td className="py-3 px-4 text-slate-900">
                              {seat.number}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {seat.licenseCost ? (
                                <span className="font-medium text-green-600">
                                  ${parseFloat(seat.licenseCost).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-sm">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {seat.ownershipDetails && seat.ownershipDetails.length > 0 ? (
                                <div className="space-y-1">
                                  {seat.ownershipDetails.map((ownership, index) => (
                                    <Badge key={index} variant="outline" className="mr-1">
                                      {ownership.ticketHolderName} ({ownership.seasonYear})
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-sm">Unassigned</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditSeat(seat)}
                                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                                title="Edit seat"
                              >
                                <EditIcon className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-slate-500">No seats found.</p>
                    <p className="text-sm text-slate-400 mt-1">Click "Add Seat" to create your first seat.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}