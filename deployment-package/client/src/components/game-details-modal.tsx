import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  CalendarIcon, 
  ClockIcon, 
  UsersIcon,
  DollarSignIcon,
  EditIcon,
  CheckIcon,
  XIcon
} from "lucide-react";
import type { Game, Seat, TicketHolder, SeatOwnership, GamePricing, Season } from "@shared/schema";

interface GameDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: Game | null;
}

interface SeatDetails extends Seat {
  owner?: TicketHolder;
  pricing?: GamePricing;
}

export default function GameDetailsModal({ isOpen, onClose, game }: GameDetailsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingPricing, setEditingPricing] = useState<{ [key: number]: boolean }>({});
  const [pricingValues, setPricingValues] = useState<{ [key: number]: { cost: string; soldPrice: string } }>({});

  // Mutation for saving pricing data
  const savePricingMutation = useMutation({
    mutationFn: async ({ gameId, seatId, cost, soldPrice }: {
      gameId: number;
      seatId: number;
      cost: string;
      soldPrice: string;
    }) => {
      return apiRequest("POST", "/api/game-pricing", {
        gameId,
        seatId,
        cost: cost || null,
        soldPrice: soldPrice || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game-pricing", game?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/game-pricing"] });
      toast({
        title: "Success",
        description: "Seat pricing updated successfully",
      });
    },
    onError: (error) => {
      console.error("Pricing update error:", error);
      toast({
        title: "Error",
        description: `Failed to update seat pricing: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Get the season to get the team ID
  const { data: season, isLoading: loadingSeason } = useQuery<Season>({
    queryKey: [`/api/seasons/${game?.seasonId}`],
    enabled: isOpen && !!game,
  });

  // Get seat ownership data for the game's season
  const { data: seatOwnerships, isLoading: loadingOwnerships, error: errorOwnerships } = useQuery<SeatOwnership[]>({
    queryKey: ["/api/seat-ownership", game?.seasonId],
    enabled: isOpen && !!game,
  });

  // Get seats for the specific team only
  const { data: allSeats, isLoading: loadingSeats, error: errorSeats } = useQuery<Seat[]>({
    queryKey: ["/api/seats"],
    enabled: isOpen && !!game,
  });

  // Filter seats to only show those belonging to the game's team
  const seats = allSeats?.filter(seat => seat.teamId === season?.teamId) || [];

  // Get all ticket holders
  const { data: ticketHolders, isLoading: loadingHolders, error: errorHolders } = useQuery<TicketHolder[]>({
    queryKey: ["/api/ticket-holders"],
    enabled: isOpen && !!game,
  });

  // Get game pricing data
  const { data: gamePricing, isLoading: loadingPricing, error: errorPricing } = useQuery<GamePricing[]>({
    queryKey: ["/api/game-pricing", game?.id],
    queryFn: async () => {
      const res = await fetch(`/api/game-pricing?gameId=${game?.id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: isOpen && !!game,
  });

  if (!game) return null;

  const isLoading = loadingSeason || loadingOwnerships || loadingSeats || loadingHolders || loadingPricing;
  const hasError = errorOwnerships || errorSeats || errorHolders || errorPricing;

  // Create detailed seat information with ownership and pricing
  const seatDetails: SeatDetails[] = seats?.map(seat => {
    const ownership = seatOwnerships?.find(so => so.seatId === seat.id);
    const owner = ownership ? ticketHolders?.find(th => th.id === ownership.ticketHolderId) : undefined;
    const pricing = gamePricing?.find(gp => gp.seatId === seat.id);
    
    return {
      ...seat,
      owner,
      pricing,
    };
  }) || [];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const totalSeats = seatDetails.length;
  const assignedSeats = seatDetails.filter(s => s.owner).length;
  const totalCost = seatDetails.reduce((sum, seat) => 
    sum + parseFloat(seat.pricing?.cost || '0'), 0
  );
  const totalSold = seatDetails.reduce((sum, seat) => 
    sum + parseFloat(seat.pricing?.soldPrice || '0'), 0
  );

  const handleEditPricing = (seatId: number) => {
    setEditingPricing(prev => ({ ...prev, [seatId]: true }));
    const seat = seatDetails.find(s => s.id === seatId);
    setPricingValues(prev => ({
      ...prev,
      [seatId]: {
        cost: seat?.pricing?.cost || '',
        soldPrice: seat?.pricing?.soldPrice || '',
      }
    }));
  };

  const handleSavePricing = async (seatId: number) => {
    if (!game) return;
    
    const values = pricingValues[seatId];
    if (!values) return;

    savePricingMutation.mutate({
      gameId: game.id,
      seatId,
      cost: values.cost,
      soldPrice: values.soldPrice,
    });

    setEditingPricing(prev => ({ ...prev, [seatId]: false }));
  };

  const handleCancelPricing = (seatId: number) => {
    setEditingPricing(prev => ({ ...prev, [seatId]: false }));
    setPricingValues(prev => {
      const newValues = { ...prev };
      delete newValues[seatId];
      return newValues;
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-3">
            {game.opponentLogo && (
              <img 
                src={game.opponentLogo} 
                alt={`${game.opponent} logo`}
                className="w-10 h-10 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            vs {game.opponent}
          </DialogTitle>
          <div className="flex items-center space-x-4 text-sm text-slate-600">
            <div className="flex items-center">
              <CalendarIcon className="w-4 h-4 mr-1" />
              {formatDate(game.date)}
            </div>
            {game.time && (
              <div className="flex items-center">
                <ClockIcon className="w-4 h-4 mr-1" />
                {formatTime(game.time)}
              </div>
            )}
            <Badge variant={game.seasonType === "Regular Season" ? "default" : "secondary"}
              className={
                game.seasonType === "Regular Season" 
                  ? "bg-blue-100 text-blue-800" 
                  : game.seasonType === "Pre Season"
                  ? "bg-green-100 text-green-800"
                  : "bg-purple-100 text-purple-800"
              }>
              {game.seasonType}
            </Badge>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-slate-600">Loading seat details...</div>
          </div>
        ) : hasError ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-red-600">
              Error loading seat details. Please check your login status.
            </div>
          </div>
        ) : (
          <>
            {/* Game Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Total Seats</p>
                      <p className="text-2xl font-bold">{totalSeats}</p>
                    </div>
                    <UsersIcon className="w-8 h-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Assigned</p>
                      <p className="text-2xl font-bold">{assignedSeats}</p>
                      <p className="text-xs text-slate-500">{totalSeats > 0 ? Math.round((assignedSeats / totalSeats) * 100) : 0}%</p>
                    </div>
                    <CheckIcon className="w-8 h-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Total Cost</p>
                      <p className="text-2xl font-bold">${totalCost.toFixed(2)}</p>
                    </div>
                    <DollarSignIcon className="w-8 h-8 text-orange-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Total Sold</p>
                      <p className="text-2xl font-bold">${totalSold.toFixed(2)}</p>
                      <p className="text-xs text-slate-500">
                        {totalCost > 0 ? `${Math.round((totalSold / totalCost) * 100)}% of cost` : 'No cost set'}
                      </p>
                    </div>
                    <DollarSignIcon className="w-8 h-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Seat Details Table */}
            <Card>
              <CardHeader>
                <CardTitle>Seat Details & Pricing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Seat
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Owner
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Cost per Game
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Sold Price
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Profit/Loss
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {seatDetails.map((seat) => {
                        const isEditing = editingPricing[seat.id];
                        const cost = parseFloat(seat.pricing?.cost || '0');
                        const soldPrice = parseFloat(seat.pricing?.soldPrice || '0');
                        const profit = soldPrice - cost;
                        
                        return (
                          <tr key={seat.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-slate-900">
                                Section {seat.section}
                              </div>
                              <div className="text-sm text-slate-500">
                                Row {seat.row}, Seat {seat.number}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {seat.owner ? (
                                <div className="text-sm text-slate-900">{seat.owner.name}</div>
                              ) : (
                                <span className="text-sm text-slate-500">Unassigned</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {isEditing ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  className="w-20 h-8"
                                  value={pricingValues[seat.id]?.cost || ''}
                                  onChange={(e) => setPricingValues(prev => ({
                                    ...prev,
                                    [seat.id]: {
                                      ...prev[seat.id],
                                      cost: e.target.value
                                    }
                                  }))}
                                />
                              ) : (
                                <div className="text-sm text-slate-900">
                                  {cost > 0 ? `$${cost.toFixed(2)}` : '-'}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {isEditing ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  className="w-20 h-8"
                                  value={pricingValues[seat.id]?.soldPrice || ''}
                                  onChange={(e) => setPricingValues(prev => ({
                                    ...prev,
                                    [seat.id]: {
                                      ...prev[seat.id],
                                      soldPrice: e.target.value
                                    }
                                  }))}
                                />
                              ) : (
                                <div className="text-sm text-slate-900">
                                  {soldPrice > 0 ? `$${soldPrice.toFixed(2)}` : '-'}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {cost > 0 || soldPrice > 0 ? (
                                <div className={`text-sm font-medium ${
                                  profit > 0 ? 'text-green-600' : profit < 0 ? 'text-red-600' : 'text-slate-500'
                                }`}>
                                  {profit !== 0 ? `$${profit.toFixed(2)}` : '-'}
                                </div>
                              ) : (
                                <span className="text-sm text-slate-500">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {isEditing ? (
                                <div className="flex space-x-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleSavePricing(seat.id)}
                                  >
                                    <CheckIcon className="w-4 h-4 text-green-600" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleCancelPricing(seat.id)}
                                  >
                                    <XIcon className="w-4 h-4 text-red-600" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditPricing(seat.id)}
                                >
                                  <EditIcon className="w-4 h-4" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {game.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700">{game.notes}</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}