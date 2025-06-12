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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusIcon, UsersIcon, CalendarIcon, RockingChair } from "lucide-react";
import type { Team, Season, TicketHolder, Seat } from "@shared/schema";

interface SetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

const teamSchema = z.object({
  name: z.string().min(1, "Team name is required"),
});

const seasonSchema = z.object({
  teamId: z.string().min(1, "Please select a team"),
  year: z.string().min(1, "Year is required").refine((val) => {
    const year = parseInt(val);
    return year >= 2020 && year <= 2030;
  }, "Year must be between 2020 and 2030"),
});

const ticketHolderSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  notes: z.string().optional(),
});

const seatSchema = z.object({
  teamId: z.string().min(1, "Please select a team"),
  section: z.string().min(1, "Section is required"),
  row: z.string().min(1, "Row is required"),
  number: z.string().min(1, "Seat number is required"),
  licenseCost: z.string().optional(),
});

type TeamFormData = z.infer<typeof teamSchema>;
type SeasonFormData = z.infer<typeof seasonSchema>;
type TicketHolderFormData = z.infer<typeof ticketHolderSchema>;
type SeatFormData = z.infer<typeof seatSchema>;

export default function SetupWizard({ isOpen, onClose }: SetupWizardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"teams" | "seasons" | "holders" | "seats">("teams");

  // Forms
  const teamForm = useForm<TeamFormData>({
    resolver: zodResolver(teamSchema),
    defaultValues: { name: "" },
  });

  const seasonForm = useForm<SeasonFormData>({
    resolver: zodResolver(seasonSchema),
    defaultValues: { teamId: "", year: new Date().getFullYear().toString() },
  });

  const holderForm = useForm<TicketHolderFormData>({
    resolver: zodResolver(ticketHolderSchema),
    defaultValues: { name: "", email: "", notes: "" },
  });

  const seatForm = useForm<SeatFormData>({
    resolver: zodResolver(seatSchema),
    defaultValues: { teamId: "", section: "", row: "", number: "", licenseCost: "" },
  });

  // Data queries
  const { data: teams, refetch: refetchTeams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    enabled: isOpen,
  });

  const { data: seasons, refetch: refetchSeasons } = useQuery<Season[]>({
    queryKey: ["/api/seasons"],
    enabled: isOpen,
  });

  const { data: ticketHolders, refetch: refetchHolders } = useQuery<TicketHolder[]>({
    queryKey: ["/api/ticket-holders"],
    enabled: isOpen,
  });

  const { data: seats, refetch: refetchSeats } = useQuery<Seat[]>({
    queryKey: ["/api/seats"],
    enabled: isOpen,
  });

  // Mutations
  const teamMutation = useMutation({
    mutationFn: async (data: TeamFormData) => {
      return apiRequest("POST", "/api/teams", data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Team created successfully." });
      teamForm.reset();
      refetchTeams();
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
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
        description: "Failed to create team.",
        variant: "destructive",
      });
    },
  });

  const seasonMutation = useMutation({
    mutationFn: async (data: SeasonFormData) => {
      return apiRequest("POST", "/api/seasons", {
        teamId: parseInt(data.teamId),
        year: parseInt(data.year),
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Season created successfully." });
      seasonForm.reset();
      refetchSeasons();
      queryClient.invalidateQueries({ queryKey: ["/api/seasons"] });
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
        description: "Failed to create season.",
        variant: "destructive",
      });
    },
  });

  const holderMutation = useMutation({
    mutationFn: async (data: TicketHolderFormData) => {
      return apiRequest("POST", "/api/ticket-holders", {
        name: data.name,
        email: data.email || null,
        notes: data.notes || null,
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Ticket holder created successfully." });
      holderForm.reset();
      refetchHolders();
      queryClient.invalidateQueries({ queryKey: ["/api/ticket-holders"] });
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
        description: "Failed to create ticket holder.",
        variant: "destructive",
      });
    },
  });

  const seatMutation = useMutation({
    mutationFn: async (data: SeatFormData) => {
      return apiRequest("POST", "/api/seats", {
        teamId: parseInt(data.teamId),
        section: data.section,
        row: data.row,
        number: data.number,
        licenseCost: data.licenseCost ? data.licenseCost : null,
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Seat created successfully." });
      seatForm.reset();
      refetchSeats();
      queryClient.invalidateQueries({ queryKey: ["/api/seats"] });
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
        description: "Failed to create seat.",
        variant: "destructive",
      });
    },
  });

  const tabs = [
    { id: "teams", label: "Teams", icon: UsersIcon },
    { id: "seasons", label: "Seasons", icon: CalendarIcon },
    { id: "holders", label: "Ticket Holders", icon: UsersIcon },
    { id: "seats", label: "Seats", icon: RockingChair },
  ] as const;

  const getTeamName = (teamId: number) => {
    return teams?.find(t => t.id === teamId)?.name || "Unknown Team";
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
          <DialogTitle>Setup Manager</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form Column */}
          <div>
            {activeTab === "teams" && (
              <Card>
                <CardHeader>
                  <CardTitle>Add New Team</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...teamForm}>
                    <form onSubmit={teamForm.handleSubmit((data) => teamMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={teamForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Team Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Green Bay Packers" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" disabled={teamMutation.isPending} className="w-full">
                        <PlusIcon className="w-4 h-4 mr-2" />
                        {teamMutation.isPending ? "Adding..." : "Add Team"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}

            {activeTab === "seasons" && (
              <Card>
                <CardHeader>
                  <CardTitle>Add New Season</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...seasonForm}>
                    <form onSubmit={seasonForm.handleSubmit((data) => seasonMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={seasonForm.control}
                        name="teamId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Team</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a team" />
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
                      <FormField
                        control={seasonForm.control}
                        name="year"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Year</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="2024" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" disabled={seasonMutation.isPending || !teams?.length} className="w-full">
                        <PlusIcon className="w-4 h-4 mr-2" />
                        {seasonMutation.isPending ? "Adding..." : "Add Season"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}

            {activeTab === "holders" && (
              <Card>
                <CardHeader>
                  <CardTitle>Add Ticket Holder</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...holderForm}>
                    <form onSubmit={holderForm.handleSubmit((data) => holderMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={holderForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={holderForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email (Optional)</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="john@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={holderForm.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes (Optional)</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Additional notes..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" disabled={holderMutation.isPending} className="w-full">
                        <PlusIcon className="w-4 h-4 mr-2" />
                        {holderMutation.isPending ? "Adding..." : "Add Ticket Holder"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}

            {activeTab === "seats" && (
              <Card>
                <CardHeader>
                  <CardTitle>Add New Seat</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...seatForm}>
                    <form onSubmit={seatForm.handleSubmit((data) => seatMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={seatForm.control}
                        name="teamId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Team</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a team" />
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
                      <div className="grid grid-cols-3 gap-3">
                        <FormField
                          control={seatForm.control}
                          name="section"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Section</FormLabel>
                              <FormControl>
                                <Input placeholder="A1" {...field} />
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
                                <Input placeholder="5" {...field} />
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
                              <FormLabel>Seat #</FormLabel>
                              <FormControl>
                                <Input placeholder="12" {...field} />
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
                              <Input type="number" step="0.01" placeholder="1500.00" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" disabled={seatMutation.isPending || !teams?.length} className="w-full">
                        <PlusIcon className="w-4 h-4 mr-2" />
                        {seatMutation.isPending ? "Adding..." : "Add Seat"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}
          </div>

          {/* List Column */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>
                  {activeTab === "teams" && `Teams (${teams?.length || 0})`}
                  {activeTab === "seasons" && `Seasons (${seasons?.length || 0})`}
                  {activeTab === "holders" && `Ticket Holders (${ticketHolders?.length || 0})`}
                  {activeTab === "seats" && `Seats (${seats?.length || 0})`}
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-80 overflow-y-auto">
                {activeTab === "teams" && (
                  <div className="space-y-2">
                    {teams?.length === 0 ? (
                      <p className="text-slate-500 text-sm">No teams added yet.</p>
                    ) : (
                      teams?.map((team) => (
                        <div key={team.id} className="flex items-center justify-between p-2 border border-slate-200 rounded">
                          <span className="font-medium">{team.name}</span>
                          <Badge variant="secondary">ID: {team.id}</Badge>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === "seasons" && (
                  <div className="space-y-2">
                    {seasons?.length === 0 ? (
                      <p className="text-slate-500 text-sm">No seasons added yet.</p>
                    ) : (
                      seasons?.map((season) => (
                        <div key={season.id} className="flex items-center justify-between p-2 border border-slate-200 rounded">
                          <div>
                            <span className="font-medium">{season.year}</span>
                            <p className="text-sm text-slate-500">{getTeamName(season.teamId)}</p>
                          </div>
                          <Badge variant="secondary">ID: {season.id}</Badge>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === "holders" && (
                  <div className="space-y-2">
                    {ticketHolders?.length === 0 ? (
                      <p className="text-slate-500 text-sm">No ticket holders added yet.</p>
                    ) : (
                      ticketHolders?.map((holder) => (
                        <div key={holder.id} className="flex items-center justify-between p-2 border border-slate-200 rounded">
                          <div>
                            <span className="font-medium">{holder.name}</span>
                            {holder.email && <p className="text-sm text-slate-500">{holder.email}</p>}
                          </div>
                          <Badge variant="secondary">ID: {holder.id}</Badge>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === "seats" && (
                  <div className="space-y-2">
                    {seats?.length === 0 ? (
                      <p className="text-slate-500 text-sm">No seats added yet.</p>
                    ) : (
                      seats?.map((seat) => (
                        <div key={seat.id} className="flex items-center justify-between p-2 border border-slate-200 rounded">
                          <div>
                            <span className="font-medium">Sec {seat.section}, Row {seat.row}, Seat {seat.number}</span>
                            <p className="text-sm text-slate-500">
                              {getTeamName(seat.teamId)} • {formatCurrency(seat.licenseCost)}
                            </p>
                          </div>
                          <Badge variant="secondary">ID: {seat.id}</Badge>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}