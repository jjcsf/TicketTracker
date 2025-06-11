import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSeason } from "@/contexts/SeasonContext";
import { isUnauthorizedError } from "@/lib/authUtils";
import { getTeamLogo, getTeamSport } from "@/lib/teamLogos";
import Sidebar from "@/components/sidebar";
import GamesTable from "@/components/games-table";
import FinancialSummary from "@/components/financial-summary";
import RecentTransfers from "@/components/recent-transfers";
import TransferModal from "@/components/transfer-modal";
import AddGameModal from "@/components/add-game-modal";
import SetupWizard from "@/components/setup-wizard";
import SeatOwnershipModal from "@/components/seat-ownership-modal";
import PersonalProfileCard from "@/components/personal-profile-card";
import EditTicketHolderModal from "@/components/edit-ticket-holder-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PlusIcon, DollarSignIcon, CalendarCheckIcon, RockingChair, UsersIcon, SettingsIcon, BarChart3Icon } from "lucide-react";
import { useTicketHolderProfile } from "@/hooks/useTicketHolderProfile";
import type { Team, Season } from "@shared/schema";



interface SeatOwnershipSummaryProps {
  seasonId: number | null;
}

function SeatOwnershipSummary({ seasonId }: SeatOwnershipSummaryProps) {
  const [ownerships, setOwnerships] = useState<{
    ticketHolderId: number;
    ticketHolderName: string;
    seatId: number;
    section: string;
    row: string;
    number: string;
  }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!seasonId) {
      setOwnerships([]);
      return;
    }

    const fetchOwnerships = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/seat-ownership?seasonId=${seasonId}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
        const ownershipData = await res.json();

        // Fetch seat details for each ownership
        const seatsRes = await fetch(`/api/seats`, {
          credentials: "include",
        });
        if (!seatsRes.ok) throw new Error(`${seatsRes.status}: ${seatsRes.statusText}`);
        const seatsData = await seatsRes.json();

        // Fetch ticket holder details
        const holdersRes = await fetch(`/api/ticket-holders`, {
          credentials: "include",
        });
        if (!holdersRes.ok) throw new Error(`${holdersRes.status}: ${holdersRes.statusText}`);
        const holdersData = await holdersRes.json();

        // Combine the data
        const enrichedOwnerships = ownershipData.map((ownership: any) => {
          const seat = seatsData.find((s: any) => s.id === ownership.seatId);
          const holder = holdersData.find((h: any) => h.id === ownership.ticketHolderId);
          return {
            ticketHolderId: ownership.ticketHolderId,
            ticketHolderName: holder?.name || 'Unknown',
            seatId: ownership.seatId,
            section: seat?.section || '',
            row: seat?.row || '',
            number: seat?.number || '',
          };
        });

        setOwnerships(enrichedOwnerships);
      } catch (error) {
        console.error('Error fetching seat ownerships:', error);
        setOwnerships([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOwnerships();
  }, [seasonId]);

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-500">Loading seat ownership data...</p>
      </div>
    );
  }

  if (!ownerships || ownerships.length === 0) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-500">
          No seat ownership assigned for this season. Click "Manage Ownership" to assign seats to ticket holders.
        </p>
      </div>
    );
  }

  // Group ownerships by ticket holder
  const groupedOwnerships = ownerships.reduce((acc, ownership) => {
    const holderId = ownership.ticketHolderId;
    if (!acc[holderId]) {
      acc[holderId] = {
        name: ownership.ticketHolderName,
        seats: [],
      };
    }
    acc[holderId].seats.push({
      seatId: ownership.seatId,
      section: ownership.section,
      row: ownership.row,
      number: ownership.number,
    });
    return acc;
  }, {} as Record<number, { name: string; seats: any[] }>);

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(groupedOwnerships).map(([holderId, data]) => (
          <div key={holderId} className="bg-slate-50 rounded-lg p-4">
            <h4 className="font-medium text-slate-900 mb-2">{data.name}</h4>
            <div className="space-y-1">
              {data.seats.map((seat) => (
                <div key={seat.seatId} className="text-sm text-slate-600">
                  Section {seat.section} • Row {seat.row} • Seat {seat.number}
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {data.seats.length} seat{data.seats.length !== 1 ? 's' : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SoldUnsoldGamesCard({ seasonId }: { seasonId: number | null }) {
  const [gameStats, setGameStats] = useState<{
    totalSoldRevenue: number;
    totalSoldCosts: number;
    totalUnsoldCosts: number;
    soldGamesCount: number;
    unsoldGamesCount: number;
  }>({
    totalSoldRevenue: 0,
    totalSoldCosts: 0,
    totalUnsoldCosts: 0,
    soldGamesCount: 0,
    unsoldGamesCount: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  
  // Get season and team data for display
  const { data: seasons } = useQuery<Season[]>({
    queryKey: ["/api/seasons"],
    enabled: !!seasonId,
  });
  
  const { data: teams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    enabled: !!seasonId,
  });
  
  const selectedSeason = seasons?.find(s => s.id === seasonId);
  const selectedTeam = teams?.find(t => t.id === selectedSeason?.teamId);
  const seasonDisplay = selectedTeam && selectedSeason 
    ? `${selectedTeam.name} ${selectedSeason.year}`
    : seasonId ? `Season ${seasonId}` : '';

  useEffect(() => {
    if (!seasonId) {
      setGameStats({
        totalSoldRevenue: 0,
        totalSoldCosts: 0,
        totalUnsoldCosts: 0,
        soldGamesCount: 0,
        unsoldGamesCount: 0,
      });
      return;
    }

    const fetchGameStats = async () => {
      setIsLoading(true);
      try {
        // Fetch games for the season
        const gamesRes = await fetch(`/api/games?seasonId=${seasonId}`, {
          credentials: "include",
        });
        if (!gamesRes.ok) throw new Error(`${gamesRes.status}: ${gamesRes.statusText}`);
        const games = await gamesRes.json();

        // Fetch game pricing data
        const pricingRes = await fetch(`/api/game-pricing`, {
          credentials: "include",
        });
        if (!pricingRes.ok) throw new Error(`${pricingRes.status}: ${pricingRes.statusText}`);
        const allPricing = await pricingRes.json();

        // Filter pricing for games in this season
        const seasonGameIds = games.map((g: any) => g.id);
        const seasonPricing = allPricing.filter((p: any) => seasonGameIds.includes(p.gameId));

        // Calculate statistics
        let totalSoldRevenue = 0;
        let totalSoldCosts = 0;
        let totalUnsoldCosts = 0;
        const gamesWithSales = new Set();
        const gamesWithoutSales = new Set(seasonGameIds);

        seasonPricing.forEach((pricing: any) => {
          if (pricing.soldPrice && parseFloat(pricing.soldPrice) > 0) {
            totalSoldRevenue += parseFloat(pricing.soldPrice);
            totalSoldCosts += parseFloat(pricing.cost || "0");
            gamesWithSales.add(pricing.gameId);
            gamesWithoutSales.delete(pricing.gameId);
          } else {
            // Game has pricing but no sale - count as unsold cost
            totalUnsoldCosts += parseFloat(pricing.cost || "0");
          }
        });

        setGameStats({
          totalSoldRevenue,
          totalSoldCosts,
          totalUnsoldCosts,
          soldGamesCount: gamesWithSales.size,
          unsoldGamesCount: gamesWithoutSales.size,
        });
      } catch (error) {
        console.error('Error fetching game stats:', error);
        setGameStats({
          totalSoldRevenue: 0,
          totalSoldCosts: 0,
          totalUnsoldCosts: 0,
          soldGamesCount: 0,
          unsoldGamesCount: 0,
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchGameStats();
  }, [seasonId]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-600">Game Sales Summary</p>
              <p className="text-sm text-slate-500 mt-2">Loading...</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center ml-4">
              <BarChart3Icon className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-600">
              Game Sales Summary {seasonDisplay && `(${seasonDisplay})`}
            </p>
            {seasonId ? (
              <div className="space-y-2 mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-700">Revenue from sold games:</span>
                  <span className="text-sm font-semibold text-green-600">
                    {formatCurrency(gameStats.totalSoldRevenue)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-700">Costs from sold games:</span>
                  <span className="text-sm font-semibold text-red-600">
                    {formatCurrency(gameStats.totalSoldCosts)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-700">Costs from unsold games:</span>
                  <span className="text-sm font-semibold text-red-600">
                    {formatCurrency(gameStats.totalUnsoldCosts)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span className="text-sm text-slate-700">Sold games:</span>
                  <span className="text-sm font-semibold text-blue-600">
                    {gameStats.soldGamesCount}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-700">Unsold games:</span>
                  <span className="text-sm font-semibold text-orange-600">
                    {gameStats.unsoldGamesCount}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 mt-2">Select a season to view game sales data</p>
            )}
          </div>
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center ml-4">
            <BarChart3Icon className="w-6 h-6 text-blue-600" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const { ticketHolder } = useTicketHolderProfile();
  const { selectedSeasonId, setSelectedSeasonId } = useSeason();
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showAddGameModal, setShowAddGameModal] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showSeatOwnership, setShowSeatOwnership] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);

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

  const { data: dashboardStats } = useQuery<{
    totalRevenue: string;
    totalCosts: string;
    totalProfit: string;
    gamesPlayed: number;
    totalGames: number;
    activeSeats: number;
    ticketHolders: number;
  }>({
    queryKey: ["/api/dashboard/stats", selectedSeasonId],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/stats/${selectedSeasonId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: isAuthenticated && !!selectedSeasonId,
  });

  // Set default season when data loads
  useEffect(() => {
    if (seasons && seasons.length > 0 && !selectedSeasonId) {
      setSelectedSeasonId(seasons[0].id);
    }
  }, [seasons, selectedSeasonId, setSelectedSeasonId]);

  if (isLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  const selectedSeason = seasons?.find(s => s.id === selectedSeasonId);
  const selectedTeam = teams?.find(t => t.id === selectedSeason?.teamId);

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(num);
  };

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    return num >= 0 ? `+${formatCurrency(balance)}` : formatCurrency(balance);
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 lg:pl-64">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-slate-200">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Season Dashboard</h1>
                <nav className="flex mt-2" aria-label="Breadcrumb">
                  <ol className="flex items-center space-x-2 text-sm text-slate-500">
                    <li><span>Teams</span></li>
                    <li><i className="fas fa-chevron-right text-xs"></i></li>
                    <li className="flex items-center space-x-2">
                      {selectedTeam && getTeamLogo(selectedTeam.name) && (
                        <img 
                          src={getTeamLogo(selectedTeam.name)!} 
                          alt={`${selectedTeam.name} logo`}
                          className="w-4 h-4 object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <span>{selectedTeam?.name || "Select Team"}</span>
                      {selectedTeam && getTeamSport(selectedTeam.name) && (
                        <Badge variant="outline" className={`text-xs px-1 py-0 h-4 ${
                          getTeamSport(selectedTeam.name) === 'NFL' ? 'border-green-500 text-green-600' : 'border-blue-500 text-blue-600'
                        }`}>
                          {getTeamSport(selectedTeam.name)}
                        </Badge>
                      )}
                    </li>
                    <li><i className="fas fa-chevron-right text-xs"></i></li>
                    <li><span>{selectedSeason ? `${selectedSeason.year} Season` : "Select Season"}</span></li>
                  </ol>
                </nav>
              </div>
              <div className="flex items-center space-x-4">
                <Button
                  variant="outline"
                  onClick={() => setShowSetupWizard(true)}
                  className="mr-2"
                >
                  <SettingsIcon className="w-4 h-4 mr-2" />
                  Setup
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowSeatOwnership(true)}
                  disabled={!selectedSeasonId}
                  className="mr-3"
                >
                  <RockingChair className="w-4 h-4 mr-2" />
                  Assign Seats
                </Button>
                <div className="flex items-center space-x-3">
                  <div className="text-sm text-slate-600 font-medium">Managing:</div>
                  <Select
                    value={selectedSeasonId?.toString() || ""}
                    onValueChange={(value) => setSelectedSeasonId(parseInt(value))}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select Season" />
                    </SelectTrigger>
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
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-6">
          {/* Personal Profile Card */}
          <div className="mb-8">
            <PersonalProfileCard onEditProfile={() => setShowEditProfile(true)} />
          </div>

          {/* Dashboard Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-600">Financial Summary</p>
                    <div className="space-y-1 mt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">Revenue:</span>
                        <span className="font-semibold text-emerald-600">
                          {dashboardStats?.totalRevenue ? formatCurrency(dashboardStats.totalRevenue) : "$0"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">Costs:</span>
                        <span className="font-semibold text-red-600">
                          {dashboardStats?.totalCosts ? formatCurrency(dashboardStats.totalCosts) : "$0"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                        <span className="text-sm font-medium text-slate-700">Profit/Loss:</span>
                        <span className={`font-bold ${
                          dashboardStats?.totalProfit && parseFloat(dashboardStats.totalProfit) >= 0 
                            ? 'text-emerald-600' 
                            : 'text-red-600'
                        }`}>
                          {dashboardStats?.totalProfit ? formatBalance(dashboardStats.totalProfit) : "$0"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center ml-4">
                    <DollarSignIcon className="w-6 h-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Games Played</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {dashboardStats ? `${dashboardStats.gamesPlayed} / ${dashboardStats.totalGames}` : "0 / 0"}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      {dashboardStats ? `${dashboardStats.totalGames - dashboardStats.gamesPlayed} remaining` : "No games"}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <CalendarCheckIcon className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <SoldUnsoldGamesCard key={selectedSeasonId} seasonId={selectedSeasonId} />
          </div>

          {/* Games Schedule & Management */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-8">
            <div className="px-6 py-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Games Schedule</h2>
                  {selectedTeam && selectedSeason && (
                    <p className="text-sm text-slate-600 mt-1">
                      {selectedTeam.name} • {selectedSeason.year} Season
                    </p>
                  )}
                  {!selectedSeasonId && (
                    <p className="text-sm text-slate-500 mt-1">
                      Select a team and season above to manage games
                    </p>
                  )}
                </div>
                <Button 
                  onClick={() => setShowAddGameModal(true)}
                >
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Add Game
                </Button>
              </div>
            </div>
            <GamesTable seasonId={selectedSeasonId} />
          </div>

          {/* Seat Ownership Management */}
          {selectedSeasonId && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-8">
              <div className="px-6 py-4 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Seat Ownership</h2>
                    <p className="text-sm text-slate-600 mt-1">
                      Manage which ticket holders own seats for this season
                    </p>
                  </div>
                  <Button 
                    onClick={() => setShowSeatOwnership(true)}
                    variant="outline"
                  >
                    <SettingsIcon className="w-4 h-4 mr-2" />
                    Manage Ownership
                  </Button>
                </div>
              </div>
              <SeatOwnershipSummary seasonId={selectedSeasonId} />
            </div>
          )}

          {/* Recent Transfers */}
          <div className="grid grid-cols-1 gap-6">
            <RecentTransfers 
              seasonId={selectedSeasonId} 
              onNewTransfer={() => setShowTransferModal(true)} 
            />
          </div>
        </main>
      </div>

      {/* Modals */}
      <TransferModal 
        isOpen={showTransferModal} 
        onClose={() => setShowTransferModal(false)}
        seasonId={selectedSeasonId}
      />
      <AddGameModal 
        isOpen={showAddGameModal} 
        onClose={() => setShowAddGameModal(false)}
        seasonId={selectedSeasonId}
      />
      <SetupWizard 
        isOpen={showSetupWizard} 
        onClose={() => setShowSetupWizard(false)}
      />
      <SeatOwnershipModal 
        isOpen={showSeatOwnership} 
        onClose={() => setShowSeatOwnership(false)}
        seasonId={selectedSeasonId}
      />
      <EditTicketHolderModal 
        isOpen={showEditProfile} 
        onClose={() => setShowEditProfile(false)}
        ticketHolder={ticketHolder}
      />
    </div>
  );
}
