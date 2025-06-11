import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SettingsIcon, CheckIcon, UsersIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { formatTime, formatDate } from "@/lib/timeUtils";
import { useTicketHolderProfile } from "@/hooks/useTicketHolderProfile";
import EditGameModal from "@/components/edit-game-modal";
import type { Game, Season, Team, GamePricing, GameAttendance, SeatOwnership } from "@shared/schema";

interface GamesTableProps {
  seasonId: number | null;
}

export default function GamesTable({ seasonId }: GamesTableProps) {
  const [managingGame, setManagingGame] = useState<Game | null>(null);
  const [listedGames, setListedGames] = useState<Set<number>>(new Set());
  const { toast } = useToast();
  const { ticketHolder } = useTicketHolderProfile();

  // Delete game mutation
  const deleteGameMutation = useMutation({
    mutationFn: async (gameId: number) => {
      return apiRequest("DELETE", `/api/games/${gameId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/game-pricing"] });
      toast({
        title: "Success",
        description: "Game deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete game: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Attendance mutation
  const attendGameMutation = useMutation({
    mutationFn: async ({ gameId, seatId, isRemoving }: { gameId: number; seatId: number; isRemoving?: boolean }) => {
      if (isRemoving) {
        // Find the attendance record and delete it
        const attendanceRecord = gameAttendance?.find(att => 
          att.gameId === gameId && 
          att.seatId === seatId && 
          att.ticketHolderId === ticketHolder?.id
        );
        if (attendanceRecord) {
          return apiRequest("DELETE", `/api/game-attendance/${attendanceRecord.id}`);
        }
        return Promise.resolve();
      } else {
        return apiRequest("POST", "/api/game-attendance", {
          ticketHolderId: ticketHolder?.id,
          seatId,
          gameId,
        });
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/game-attendance"] });
      toast({
        title: "Success",
        description: variables.isRemoving ? "Attendance removed successfully" : "Attendance marked successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update attendance: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Handle list for sale functionality
  const handleListForSale = (gameId: number) => {
    setListedGames(prev => new Set(prev).add(gameId));
    toast({
      title: "Success",
      description: "Game listed for sale successfully",
    });
  };

  const handleDeleteGame = (game: Game) => {
    if (window.confirm(`Are you sure you want to delete the game against ${game.opponent} on ${formatDate(game.date)}? This will also delete all pricing data for this game.`)) {
      deleteGameMutation.mutate(game.id);
    }
  };

  // Helper functions for attendance
  const getOwnedSeatsForSeason = () => {
    if (!ticketHolder || !seasonId) return [];
    return seatOwnerships?.filter(ownership => 
      ownership.ticketHolderId === ticketHolder.id && 
      ownership.seasonId === seasonId
    ) || [];
  };

  const isAlreadyAttending = (gameId: number) => {
    if (!ticketHolder) return false;
    return gameAttendance?.some(attendance => 
      attendance.gameId === gameId && 
      attendance.ticketHolderId === ticketHolder.id
    ) || false;
  };

  const handleAttendGame = (game: Game) => {
    const ownedSeats = getOwnedSeatsForSeason();
    if (ownedSeats.length === 0) {
      toast({
        title: "No Seats Owned",
        description: "You don't own any seats for this season",
        variant: "destructive",
      });
      return;
    }

    const seatId = ownedSeats[0].seatId;
    const isCurrentlyAttending = isAlreadyAttending(game.id);
    
    // Toggle attendance - if already attending, remove it; otherwise add it
    attendGameMutation.mutate({ 
      gameId: game.id, 
      seatId, 
      isRemoving: isCurrentlyAttending 
    });
  };
  
  const { data: games, isLoading } = useQuery<Game[]>({
    queryKey: ["/api/games"],
    enabled: !!seasonId,
  });

  const { data: season } = useQuery<Season>({
    queryKey: ["/api/seasons", seasonId],
    enabled: !!seasonId,
  });

  const { data: team } = useQuery<Team>({
    queryKey: ["/api/teams", season?.teamId],
    enabled: !!season?.teamId,
  });

  const { data: allGamePricing } = useQuery<GamePricing[]>({
    queryKey: ["/api/game-pricing"],
  });

  const { data: seatOwnerships } = useQuery<SeatOwnership[]>({
    queryKey: ["/api/seat-ownership"],
    enabled: !!seasonId && !!ticketHolder,
  });

  const { data: gameAttendance } = useQuery<GameAttendance[]>({
    queryKey: ["/api/game-attendance"],
    enabled: !!ticketHolder,
  });

  const { data: ticketHolders } = useQuery<any[]>({
    queryKey: ["/api/ticket-holders"],
  });

  const filteredGames = games?.filter(game => game.seasonId === seasonId) || [];

  const getGameFinancials = (gameId: number) => {
    const gamePricing = allGamePricing?.filter(gp => gp.gameId === gameId) || [];
    const totalCost = gamePricing.reduce((sum, gp) => sum + parseFloat(gp.cost || "0"), 0);
    const totalSold = gamePricing.reduce((sum, gp) => sum + parseFloat(gp.soldPrice || "0"), 0);
    const profit = totalSold - totalCost;
    const seatsWithPricing = gamePricing.filter(gp => gp.cost || gp.soldPrice).length;
    
    return {
      totalCost,
      totalSold,
      profit,
      seatsWithPricing,
    };
  };

  // Calculate season totals
  const getSeasonTotals = () => {
    const seasonGameIds = filteredGames.map(game => game.id);
    const seasonPricing = allGamePricing?.filter(gp => seasonGameIds.includes(gp.gameId)) || [];
    
    const totalCost = seasonPricing.reduce((sum, gp) => sum + parseFloat(gp.cost || "0"), 0);
    const totalRevenue = seasonPricing.reduce((sum, gp) => sum + parseFloat(gp.soldPrice || "0"), 0);
    const totalProfit = totalRevenue - totalCost;
    
    return {
      totalCost,
      totalRevenue,
      totalProfit,
    };
  };

  // Calculate profit by seat owner for the season
  const getSeasonProfitByOwner = () => {
    if (!seasonId) return [];
    
    const seasonGameIds = filteredGames.map(game => game.id);
    const seasonPricing = allGamePricing?.filter(gp => seasonGameIds.includes(gp.gameId)) || [];
    const seasonOwnerships = seatOwnerships?.filter(so => so.seasonId === seasonId) || [];
    
    // Group by ticket holder
    const ownerProfits: { [key: number]: { name: string; cost: number; revenue: number; profit: number } } = {};
    
    seasonPricing.forEach(pricing => {
      const ownership = seasonOwnerships.find(so => so.seatId === pricing.seatId);
      if (ownership) {
        const holderId = ownership.ticketHolderId;
        const holder = ticketHolders?.find((th: any) => th.id === holderId);
        
        if (holder) {
          if (!ownerProfits[holderId]) {
            ownerProfits[holderId] = {
              name: holder.name,
              cost: 0,
              revenue: 0,
              profit: 0
            };
          }
          
          const cost = parseFloat(pricing.cost || "0");
          const revenue = parseFloat(pricing.soldPrice || "0");
          
          ownerProfits[holderId].cost += cost;
          ownerProfits[holderId].revenue += revenue;
          ownerProfits[holderId].profit += (revenue - cost);
        }
      }
    });
    
    return Object.values(ownerProfits).sort((a, b) => b.profit - a.profit);
  };

  const seasonTotals = getSeasonTotals();
  const ownerProfits = getSeasonProfitByOwner();

  const getGameAttendanceCount = (gameId: number) => {
    return gameAttendance?.filter(attendance => attendance.gameId === gameId).length || 0;
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center text-slate-500">Loading games...</div>
      </div>
    );
  }

  if (!games || games.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center text-slate-500">
          No games found for this season. Add a game to get started.
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {/* Season Totals */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-slate-700">Season Totals</h4>
          <div className="flex items-center space-x-6">
            <div className="text-center">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Total Cost</div>
              <div className="text-sm font-semibold text-slate-900">${seasonTotals.totalCost.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Total Revenue</div>
              <div className="text-sm font-semibold text-slate-900">${seasonTotals.totalRevenue.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Total Profit</div>
              <div className={`text-sm font-semibold ${
                seasonTotals.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                ${seasonTotals.totalProfit.toFixed(2)}
              </div>
            </div>
            
            {/* Owner Profits inline */}
            {ownerProfits.length > 0 && (
              <>
                <div className="w-px h-8 bg-slate-300"></div>
                {ownerProfits.map((owner, index) => (
                  <div key={index} className="text-center">
                    <div className="text-xs text-slate-500 uppercase tracking-wider">{owner.name}</div>
                    <div className={`text-sm font-semibold ${
                      owner.profit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${owner.profit.toFixed(2)}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
      
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Date
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Opponent
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
              Cost
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
              Revenue
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
              Profit
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
              Attending
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
              Sale Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {filteredGames.map((game) => {
            const financials = getGameFinancials(game.id);
            const attendanceCount = getGameAttendanceCount(game.id);
            const isAttending = isAlreadyAttending(game.id);
            
            return (
              <tr key={game.id} className={`hover:bg-slate-50 ${isAttending ? 'bg-green-50' : ''}`}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-slate-900">
                    {formatDate(game.date)}
                  </div>
                  {game.time && (
                    <div className="text-sm text-slate-500">
                      {formatTime(game.time)}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {game.opponentLogo && (
                      <img 
                        src={game.opponentLogo} 
                        alt={`${game.opponent} logo`}
                        className="w-8 h-8 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        vs {game.opponent}
                      </div>
                      {team && (
                        <div className="text-xs text-slate-500">
                          {team.name} {season?.year}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge 
                    variant={game.seasonType === "Regular Season" ? "default" : "secondary"}
                    className={
                      game.seasonType === "Regular Season" 
                        ? "bg-blue-100 text-blue-800" 
                        : game.seasonType === "Preseason"
                        ? "bg-green-100 text-green-800"
                        : "bg-purple-100 text-purple-800"
                    }
                  >
                    {game.seasonType}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm font-medium text-slate-900">
                    ${financials.totalCost.toFixed(2)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm font-medium text-slate-900">
                    ${financials.totalSold.toFixed(2)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className={`text-sm font-medium ${
                    financials.profit >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    ${financials.profit.toFixed(2)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-sm font-medium text-slate-700">
                      {attendanceCount}
                    </span>
                    {ticketHolder && getOwnedSeatsForSeason().length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAttendGame(game)}
                        disabled={attendGameMutation.isPending}
                        className={`h-6 w-6 p-0 ${isAttending ? 'text-green-600 hover:text-green-700' : 'text-blue-600 hover:text-blue-700'}`}
                      >
                        <CheckIcon className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  {(() => {
                    const isAttending = isAlreadyAttending(game.id);
                    const gameDate = new Date(game.date);
                    const today = new Date();
                    const isPastGame = gameDate < today;

                    if (isAttending) {
                      return (
                        <Badge variant="default" className={isPastGame ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}>
                          {isPastGame ? "Attended" : "Attending"}
                        </Badge>
                      );
                    } else if (financials.totalSold > 0) {
                      return (
                        <Badge variant="default" className="bg-purple-100 text-purple-700">
                          Sold
                        </Badge>
                      );
                    } else if (listedGames.has(game.id)) {
                      return (
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                          Listed for Sale
                        </Badge>
                      );
                    } else {
                      return (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => handleListForSale(game.id)}
                        >
                          List for Sale
                        </Button>
                      );
                    }
                  })()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setManagingGame(game)}
                    className="inline-flex items-center gap-1"
                  >
                    <SettingsIcon className="h-4 w-4" />
                    Manage
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Game Management Modal */}
      <EditGameModal
        isOpen={!!managingGame}
        onClose={() => setManagingGame(null)}
        game={managingGame}
      />
    </div>
  );
}