import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { formatTime, formatDate } from "@/lib/timeUtils";
import type { Season, Team, Game, GamePricing, GameAttendance, Seat, TicketHolder, SeatOwnership } from "@shared/schema";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EyeIcon, EditIcon, DollarSignIcon, UsersIcon, TrashIcon, SaveIcon } from "lucide-react";
import { Label } from "@/components/ui/label";

interface EditGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: Game | null;
}

const gameSchema = z.object({
  seasonId: z.string().min(1, "Please select a season"),
  date: z.string().min(1, "Please select a date"),
  time: z.string().optional(),
  opponent: z.string().min(1, "Please enter opponent name"),
  seasonType: z.string().min(1, "Please select season type"),
  notes: z.string().optional(),
});

type GameFormData = z.infer<typeof gameSchema>;

// Component for editing individual seat pricing
interface SeatPricingRowProps {
  seatOwnership: {
    id: number;
    seatId: number;
    seat?: Seat;
    pricing?: GamePricing;
    owner?: TicketHolder;
  };
  cost: string;
  soldPrice: string;
  onCostChange: (seatId: number, value: string) => void;
  onSoldPriceChange: (seatId: number, value: string) => void;
}

const SeatPricingRow = ({ seatOwnership, cost, soldPrice, onCostChange, onSoldPriceChange }: SeatPricingRowProps) => {
  const formatSeatName = (seat?: Seat) => {
    if (!seat) return "Unknown Seat";
    return `Section ${seat.section}, Row ${seat.row}, Seat ${seat.number}`;
  };

  return (
    <div className="flex items-center gap-4 p-4 border rounded-lg bg-slate-50">
      <div className="flex-1">
        <div className="font-medium">{formatSeatName(seatOwnership.seat)}</div>
        <div className="text-sm text-slate-600">
          Owner: {seatOwnership.owner?.name || "Unknown"}
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="space-y-1">
          <Label htmlFor={`cost-${seatOwnership.id}`} className="text-xs text-slate-600">
            Cost
          </Label>
          <div className="relative">
            <DollarSignIcon className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              id={`cost-${seatOwnership.id}`}
              type="number"
              step="0.01"
              placeholder="0.00"
              value={cost}
              onChange={(e) => onCostChange(seatOwnership.seatId, e.target.value)}
              className="pl-8 w-24"
            />
          </div>
        </div>
        
        <div className="space-y-1">
          <Label htmlFor={`sold-${seatOwnership.id}`} className="text-xs text-slate-600">
            Sold
          </Label>
          <div className="relative">
            <DollarSignIcon className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              id={`sold-${seatOwnership.id}`}
              type="number"
              step="0.01"
              placeholder="0.00"
              value={soldPrice}
              onChange={(e) => onSoldPriceChange(seatOwnership.seatId, e.target.value)}
              className="pl-8 w-24"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default function EditGameModal({ isOpen, onClose, game }: EditGameModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [pricingData, setPricingData] = useState<Record<number, { cost: string; soldPrice: string }>>({});

  const form = useForm<GameFormData>({
    resolver: zodResolver(gameSchema),
    defaultValues: {
      seasonId: "",
      date: "",
      time: "",
      opponent: "",
      seasonType: "Regular Season",
      notes: "",
    },
  });

  // Get all seasons and teams for the selector
  const { data: seasons } = useQuery<Season[]>({
    queryKey: ["/api/seasons"],
    enabled: isOpen,
  });

  const { data: teams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    enabled: isOpen,
  });

  // Get game-specific data
  const { data: gamePricing } = useQuery<GamePricing[]>({
    queryKey: ["/api/game-pricing", game?.id],
    queryFn: () => fetch(`/api/game-pricing?gameId=${game?.id}`).then(res => res.json()),
    enabled: isOpen && !!game?.id,
  });

  const { data: gameAttendance } = useQuery<GameAttendance[]>({
    queryKey: ["/api/game-attendance", game?.id],
    queryFn: () => fetch(`/api/game-attendance?gameId=${game?.id}`).then(res => res.json()),
    enabled: isOpen && !!game?.id,
  });

  const { data: seats } = useQuery<Seat[]>({
    queryKey: ["/api/seats"],
    enabled: isOpen,
  });

  const { data: ticketHolders } = useQuery<TicketHolder[]>({
    queryKey: ["/api/ticket-holders"],
    enabled: isOpen,
  });

  const { data: seatOwnerships } = useQuery<SeatOwnership[]>({
    queryKey: ["/api/seat-ownership"],
    enabled: isOpen,
  });

  // Get selected season details
  const selectedSeasonId = parseInt(form.watch("seasonId")) || game?.seasonId;
  const selectedSeason = seasons?.find(s => s.id === selectedSeasonId);
  const selectedTeam = teams?.find(t => t.id === selectedSeason?.teamId);

  // Helper functions
  const getGameFinancials = () => {
    if (!gamePricing) return { totalCost: 0, totalSold: 0, profit: 0, seatsWithPricing: 0 };
    const totalCost = gamePricing.reduce((sum, gp) => sum + parseFloat(gp.cost || "0"), 0);
    const totalSold = gamePricing.reduce((sum, gp) => sum + parseFloat(gp.soldPrice || "0"), 0);
    const profit = totalSold - totalCost;
    const seatsWithPricing = gamePricing.filter(gp => gp.cost || gp.soldPrice).length;
    return { totalCost, totalSold, profit, seatsWithPricing };
  };

  const getAttendanceDetails = () => {
    if (!gameAttendance || !seats || !ticketHolders) return [];
    return gameAttendance.map(attendance => {
      const seat = seats.find(s => s.id === attendance.seatId);
      const holder = ticketHolders.find(h => h.id === attendance.ticketHolderId);
      return { attendance, seat, holder };
    });
  };

  const deleteGameMutation = useMutation({
    mutationFn: async () => {
      if (!game?.id) throw new Error("No game to delete");
      return apiRequest("DELETE", `/api/games/${game.id}`);
    },
    onSuccess: () => {
      toast({
        title: "Game Deleted",
        description: "Game has been deleted successfully.",
      });
      onClose();
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/game-pricing"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
    onError: (error) => {
      console.error("Error deleting game:", error);
      toast({
        title: "Error",
        description: "Failed to delete game. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateGameMutation = useMutation({
    mutationFn: async (data: GameFormData) => {
      if (!game?.id) throw new Error("No game to update");
      const selectedSeasonId = parseInt(data.seasonId);
      if (!selectedSeasonId) throw new Error("No season selected");
      
      const gameData = {
        seasonId: selectedSeasonId,
        date: data.date,
        time: data.time || null,
        opponent: data.opponent,
        seasonType: data.seasonType,
        notes: data.notes || null,
      };
      
      return apiRequest("PATCH", `/api/games/${game.id}`, gameData);
    },
    onSuccess: () => {
      const teamName = selectedTeam?.name || "Team";
      const seasonYear = selectedSeason?.year || "Season";
      toast({
        title: "Game Updated Successfully",
        description: `Game has been updated in ${teamName} ${seasonYear} season.`,
      });
      onClose();
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
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
      console.error("Error updating game:", error);
      toast({
        title: "Error",
        description: "Failed to update game. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateAllPricingMutation = useMutation({
    mutationFn: async (pricingUpdates: Array<{ seatId: number; cost: string; soldPrice: string }>) => {
      if (!game?.id) throw new Error("No game selected");
      
      // Send all pricing updates in parallel
      const promises = pricingUpdates.map(({ seatId, cost, soldPrice }) =>
        apiRequest("POST", "/api/game-pricing", {
          gameId: game.id,
          seatId,
          cost: cost || null,
          soldPrice: soldPrice || null,
        })
      );
      
      return Promise.all(promises);
    },
    onSuccess: () => {
      toast({
        title: "All Pricing Updated",
        description: "All seat pricing has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/game-pricing", game?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/game-pricing"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
    onError: (error) => {
      console.error("Error updating pricing:", error);
      toast({
        title: "Error",
        description: "Failed to update pricing. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: GameFormData) => {
    updateGameMutation.mutate(data);
  };

  // Helper function to get seats owned in the current season
  const getSeatsOwnedInSeason = () => {
    if (!selectedSeasonId || !seatOwnerships || !seats) return [];
    
    const seasonOwnerships = seatOwnerships.filter(ownership => ownership.seasonId === selectedSeasonId);
    return seasonOwnerships.map(ownership => {
      const seat = seats.find(s => s.id === ownership.seatId);
      const existingPricing = gamePricing?.find(gp => gp.seatId === ownership.seatId);
      const owner = ticketHolders?.find(th => th.id === ownership.ticketHolderId);
      
      return {
        ...ownership,
        seat,
        pricing: existingPricing,
        owner,
      };
    }).filter(item => item.seat); // Only include items where seat was found
  };

  const handleCostChange = (seatId: number, value: string) => {
    setPricingData(prev => ({
      ...prev,
      [seatId]: {
        ...prev[seatId],
        cost: value,
        soldPrice: prev[seatId]?.soldPrice || ""
      }
    }));
  };

  const handleSoldPriceChange = (seatId: number, value: string) => {
    setPricingData(prev => ({
      ...prev,
      [seatId]: {
        ...prev[seatId],
        cost: prev[seatId]?.cost || "",
        soldPrice: value
      }
    }));
  };

  const handleSaveAllPricing = () => {
    const seatsOwned = getSeatsOwnedInSeason();
    const pricingUpdates = seatsOwned.map(seatOwnership => {
      const seatId = seatOwnership.seatId;
      const pricing = pricingData[seatId];
      return {
        seatId,
        cost: pricing?.cost || seatOwnership.pricing?.cost || "",
        soldPrice: pricing?.soldPrice || seatOwnership.pricing?.soldPrice || ""
      };
    });
    
    updateAllPricingMutation.mutate(pricingUpdates);
  };

  const getPricingValue = (seatId: number, field: 'cost' | 'soldPrice', fallback: string = "") => {
    return pricingData[seatId]?.[field] ?? fallback;
  };

  // Initialize form and pricing data when game changes
  React.useEffect(() => {
    if (game && isOpen) {
      // Convert timestamp to time format (HH:MM) for the time input
      const timeValue = game.time ? new Date(game.time).toTimeString().slice(0, 5) : "";
      
      const formData = {
        seasonId: game.seasonId?.toString() || "",
        date: game.date || "",
        time: timeValue,
        opponent: game.opponent || "",
        seasonType: game.seasonType || "Regular Season",
        notes: game.notes || "",
      };
      
      // Reset form data with proper values
      form.reset(formData);
    }
  }, [game, form, isOpen]);

  // Initialize pricing data when game pricing or seat ownership changes
  React.useEffect(() => {
    if (game && isOpen && gamePricing && seatOwnerships) {
      const seatsOwned = getSeatsOwnedInSeason();
      const initialPricingData: Record<number, { cost: string; soldPrice: string }> = {};
      
      seatsOwned.forEach(seatOwnership => {
        initialPricingData[seatOwnership.seatId] = {
          cost: seatOwnership.pricing?.cost || "",
          soldPrice: seatOwnership.pricing?.soldPrice || ""
        };
      });
      
      setPricingData(initialPricingData);
    }
  }, [game, isOpen, gamePricing, seatOwnerships]);

  const financials = getGameFinancials();
  const attendanceDetails = getAttendanceDetails();

  if (!game) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Game Details</span>
            {game.opponentLogo && (
              <img 
                src={game.opponentLogo} 
                alt={`${game.opponent} logo`}
                className="w-6 h-6 object-contain"
              />
            )}
            <span>vs {game.opponent}</span>
          </DialogTitle>
          <div className="text-sm text-slate-600">
            {formatDate(game.date)} {game.time && `• ${formatTime(game.time)}`}
            {selectedTeam && selectedSeason && (
              <span> • {selectedTeam.name} {selectedSeason.year}</span>
            )}
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <EyeIcon className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="edit" className="flex items-center gap-2">
              <EditIcon className="h-4 w-4" />
              Edit
            </TabsTrigger>
            <TabsTrigger value="financials" className="flex items-center gap-2">
              <DollarSignIcon className="h-4 w-4" />
              Financials
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4" />
              Attendance ({gameAttendance?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Game Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <span className="font-medium text-slate-700">Date:</span>
                    <span className="ml-2">{formatDate(game.date)}</span>
                  </div>
                  {game.time && (
                    <div>
                      <span className="font-medium text-slate-700">Time:</span>
                      <span className="ml-2">{formatTime(game.time)}</span>
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-slate-700">Type:</span>
                    <Badge className="ml-2" variant={game.seasonType === "Regular Season" ? "default" : "secondary"}>
                      {game.seasonType}
                    </Badge>
                  </div>
                  <div>
                    <span className="font-medium text-slate-700">Location:</span>
                    <Badge className="ml-2" variant={game.isHome ? "default" : "outline"}>
                      {game.isHome ? "Home" : "Away"}
                    </Badge>
                  </div>
                  {game.venue && (
                    <div>
                      <span className="font-medium text-slate-700">Venue:</span>
                      <span className="ml-2">{game.venue}</span>
                    </div>
                  )}
                  {game.notes && (
                    <div>
                      <span className="font-medium text-slate-700">Notes:</span>
                      <p className="ml-2 text-sm text-slate-600 mt-1">{game.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Seats Priced:</span>
                    <span className="font-medium">{financials.seatsWithPricing}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Attending:</span>
                    <span className="font-medium">{gameAttendance?.length || 0} people</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Revenue:</span>
                    <span className="font-medium text-green-600">${financials.totalSold.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Costs:</span>
                    <span className="font-medium text-red-600">${financials.totalCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="font-medium">Net Profit:</span>
                    <span className={`font-bold ${financials.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${financials.profit.toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="edit">
            <Card>
              <CardHeader>
                <CardTitle>Edit Game Details</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="seasonId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Season</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a season" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {seasons
                                ?.sort((a, b) => {
                                  const teamA = teams?.find(t => t.id === a.teamId)?.name || '';
                                  const teamB = teams?.find(t => t.id === b.teamId)?.name || '';
                                  return teamA.localeCompare(teamB) || b.year - a.year;
                                })
                                ?.map((season) => {
                                  const team = teams?.find(t => t.id === season.teamId);
                                  return (
                                    <SelectItem key={season.id} value={season.id.toString()}>
                                      {team?.name} - {season.year}
                                    </SelectItem>
                                  );
                                })
                              }
                            </SelectContent>
                          </Select>
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

                    <FormField
                      control={form.control}
                      name="time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time (Optional)</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="opponent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Opponent</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter opponent name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="seasonType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Season Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select season type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Preseason">Preseason</SelectItem>
                              <SelectItem value="Regular Season">Regular Season</SelectItem>
                              <SelectItem value="Postseason">Postseason</SelectItem>
                            </SelectContent>
                          </Select>
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
                            <Textarea 
                              placeholder="Add any notes about this game..."
                              className="resize-none"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end space-x-2 pt-4">
                      <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={updateGameMutation.isPending}>
                        {updateGameMutation.isPending ? "Updating..." : "Update Game"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financials">
            <Card>
              <CardHeader>
                <CardTitle>Seat Pricing & Financials</CardTitle>
                <p className="text-sm text-slate-600">
                  Edit seat costs and sold amounts for this game
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Financial Summary */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">${financials.totalSold.toFixed(2)}</div>
                      <div className="text-sm text-green-700">Total Revenue</div>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">${financials.totalCost.toFixed(2)}</div>
                      <div className="text-sm text-red-700">Total Costs</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className={`text-2xl font-bold ${financials.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${financials.profit.toFixed(2)}
                      </div>
                      <div className="text-sm text-blue-700">Net Profit</div>
                    </div>
                  </div>

                  {/* Seat Pricing Editor */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Seat Pricing</h3>
                    {getSeatsOwnedInSeason().length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        No seats owned for this season
                      </div>
                    ) : (
                      <>
                        <div className="space-y-3">
                          {getSeatsOwnedInSeason().map((seatOwnership) => (
                            <SeatPricingRow
                              key={seatOwnership.id}
                              seatOwnership={seatOwnership}
                              cost={getPricingValue(seatOwnership.seatId, 'cost', seatOwnership.pricing?.cost || "")}
                              soldPrice={getPricingValue(seatOwnership.seatId, 'soldPrice', seatOwnership.pricing?.soldPrice || "")}
                              onCostChange={handleCostChange}
                              onSoldPriceChange={handleSoldPriceChange}
                            />
                          ))}
                        </div>
                        <div className="pt-4 border-t">
                          <Button
                            onClick={handleSaveAllPricing}
                            disabled={updateAllPricingMutation.isPending}
                            className="w-full"
                          >
                            <SaveIcon className="h-4 w-4 mr-2" />
                            {updateAllPricingMutation.isPending ? "Saving All..." : "Save All Pricing"}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendance">
            <Card>
              <CardHeader>
                <CardTitle>Attendance Details</CardTitle>
              </CardHeader>
              <CardContent>
                {attendanceDetails.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No one is currently marked as attending this game
                  </div>
                ) : (
                  <div className="space-y-3">
                    {attendanceDetails.map(({ attendance, seat, holder }) => (
                      <div key={attendance.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                        <div>
                          <div className="font-medium">{holder?.name || "Unknown Holder"}</div>
                          <div className="text-sm text-slate-600">
                            {seat ? `Section ${seat.section}, Row ${seat.row}, Seat ${seat.number}` : "Unknown Seat"}
                          </div>
                        </div>
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          Attending
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between items-center pt-4 border-t">
          <Button
            variant="destructive"
            onClick={() => {
              if (window.confirm(`Are you sure you want to delete this game? This action cannot be undone.`)) {
                deleteGameMutation.mutate();
              }
            }}
            disabled={deleteGameMutation.isPending}
            className="flex items-center gap-2"
          >
            <TrashIcon className="h-4 w-4" />
            {deleteGameMutation.isPending ? "Deleting..." : "Delete Game"}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}