import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSeason } from "@/contexts/SeasonContext";
import { isUnauthorizedError } from "@/lib/authUtils";
import { getTeamLogo, getTeamSport } from "@/lib/teamLogos";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/sidebar";
import GamesTable from "@/components/games-table";
import AddGameModal from "@/components/add-game-modal";
import ImportScheduleModal from "@/components/import-schedule-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  PlusIcon, 
  CalendarIcon, 
  MapPinIcon, 
  ClockIcon,
  TrophyIcon,
  HomeIcon,
  PlaneIcon,
  DownloadIcon,
  UploadIcon
} from "lucide-react";
import type { Team, Season, Game } from "@shared/schema";

export default function Games() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const { selectedSeasonId, setSelectedSeasonId } = useSeason();
  const [showAddGameModal, setShowAddGameModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const { data: games } = useQuery<Game[]>({
    queryKey: ["/api/games", selectedSeasonId],
    queryFn: () => fetch(`/api/games${selectedSeasonId ? `?seasonId=${selectedSeasonId}` : ''}`).then(res => res.json()),
    enabled: isAuthenticated && !!selectedSeasonId,
  });

  // Set default season when data loads
  useEffect(() => {
    if (seasons && seasons.length > 0 && !selectedSeasonId) {
      setSelectedSeasonId(seasons[0].id);
    }
  }, [seasons, selectedSeasonId, setSelectedSeasonId]);

  if (!isAuthenticated || isLoading) {
    return <div>Loading...</div>;
  }

  const selectedSeason = seasons?.find(s => s.id === selectedSeasonId);
  const selectedTeam = teams?.find(t => t.id === selectedSeason?.teamId);

  // Calculate game statistics
  const totalGames = games?.length || 0;
  const preSeasonGames = games?.filter(g => g.seasonType === "Pre Season").length || 0;
  const regularSeasonGames = games?.filter(g => g.seasonType === "Regular Season").length || 0;
  const postSeasonGames = games?.filter(g => g.seasonType === "Post Season").length || 0;
  const upcomingGames = games?.filter(g => new Date(g.date) > new Date()).length || 0;
  const completedGames = totalGames - upcomingGames;

  // Fetch additional data for export
  const { data: gamePricing } = useQuery<any[]>({
    queryKey: ["/api/game-pricing"],
    enabled: !!selectedSeasonId,
  });

  const { data: seats } = useQuery<any[]>({
    queryKey: ["/api/seats"],
    enabled: !!selectedSeasonId,
  });

  const { data: seatOwnerships } = useQuery<any[]>({
    queryKey: ["/api/seat-ownership"],
    enabled: !!selectedSeasonId,
  });

  const { data: ticketHolders } = useQuery<any[]>({
    queryKey: ["/api/ticket-holders"],
    enabled: !!selectedSeasonId,
  });

  // Import mutation for season data
  const importSeasonMutation = useMutation({
    mutationFn: async (csvData: string) => {
      return apiRequest("POST", "/api/seasons/import", { 
        seasonId: selectedSeasonId,
        csvData 
      });
    },
    onSuccess: () => {
      toast({
        title: "Import Successful",
        description: "Season data has been imported successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/game-pricing"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
    onError: (error) => {
      toast({
        title: "Import Failed",
        description: `Failed to import season data: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Export season data to CSV
  const handleExportSeason = async () => {
    if (!selectedSeasonId || !selectedTeam || !selectedSeason) {
      toast({
        title: "No Season Selected",
        description: "Please select a season to export.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get season games
      const seasonGames = games?.filter(g => g.seasonId === selectedSeasonId) || [];
      
      if (seasonGames.length === 0) {
        toast({
          title: "No Games Found",
          description: "This season has no games to export.",
          variant: "destructive",
        });
        return;
      }

      // Get unique owners for column headers
      const seasonSeats = (seatOwnerships || []).filter((so: any) => so.seasonId === selectedSeasonId);
      const ownerNames = seasonSeats.map((so: any) => {
        const owner = (ticketHolders || []).find((th: any) => th.id === so.ticketHolderId);
        return owner?.name || 'Unknown';
      });
      
      // Create unique owners list without Set spread
      const uniqueOwners: string[] = [];
      ownerNames.forEach(name => {
        if (!uniqueOwners.includes(name)) {
          uniqueOwners.push(name);
        }
      });
      uniqueOwners.sort();

      // Create CSV data with dynamic columns for each owner
      const csvRows = [];
      
      // Build header with owner-specific columns
      const baseHeaders = [
        "Game ID",
        "Date", 
        "Time",
        "Opponent",
        "Season Type",
        "Is Home",
        "Venue"
      ];
      
      const ownerHeaders: string[] = [];
      uniqueOwners.forEach(ownerName => {
        ownerHeaders.push(`${ownerName} - Cost`);
        ownerHeaders.push(`${ownerName} - Sold Price`);
      });
      
      csvRows.push([...baseHeaders, ...ownerHeaders]);

      // Data rows - one per game
      for (const game of seasonGames) {
        const gameRow = [
          game.id,
          game.date,
          game.time || "",
          game.opponent,
          game.seasonType,
          game.isHome ? "Yes" : "No",
          game.venue || ""
        ];

        // Add cost and sold price for each owner
        uniqueOwners.forEach(ownerName => {
          // Find all seats owned by this owner for this game
          const ownerSeats = seasonSeats.filter((so: any) => {
            const owner = (ticketHolders || []).find((th: any) => th.id === so.ticketHolderId);
            return owner?.name === ownerName;
          });

          let totalCost = 0;
          let totalSoldPrice = 0;
          let hasData = false;

          ownerSeats.forEach((seatOwnership: any) => {
            const pricing = (gamePricing || []).find((gp: any) => 
              gp.gameId === game.id && gp.seatId === seatOwnership.seatId
            );
            
            if (pricing) {
              if (pricing.cost) {
                totalCost += parseFloat(pricing.cost) || 0;
                hasData = true;
              }
              if (pricing.soldPrice) {
                totalSoldPrice += parseFloat(pricing.soldPrice) || 0;
                hasData = true;
              }
            }
          });

          // Add cost and sold price columns for this owner
          gameRow.push(hasData && totalCost > 0 ? totalCost.toString() : "");
          gameRow.push(hasData && totalSoldPrice > 0 ? totalSoldPrice.toString() : "");
        });

        csvRows.push(gameRow);
      }

      // Convert to CSV string
      const csvContent = csvRows.map(row => 
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ).join("\n");

      // Download CSV
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      
      link.setAttribute("href", url);
      link.setAttribute("download", `${selectedTeam.name}_${selectedSeason.year}_season_data.csv`);
      link.style.visibility = "hidden";
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Export Successful",
        description: `Season data exported to ${selectedTeam.name}_${selectedSeason.year}_season_data.csv`,
      });
      
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export Failed",
        description: "Failed to export season data. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Import season data from CSV
  const handleImportSeason = () => {
    if (!selectedSeasonId) {
      toast({
        title: "No Season Selected",
        description: "Please select a season to import data into.",
        variant: "destructive",
      });
      return;
    }
    
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Invalid File Type",
        description: "Please select a CSV file.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const csvData = e.target?.result as string;
      if (csvData) {
        importSeasonMutation.mutate(csvData);
      }
    };
    reader.readAsText(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-64">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-slate-200">
          <div className="max-w-7xl mx-auto">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Games Management</h1>
                  <p className="text-slate-600 mt-1">Schedule and manage games for your teams</p>
                </div>
                <div className="flex items-center space-x-4">
                  <Button 
                    onClick={() => setShowAddGameModal(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <PlusIcon className="w-4 h-4 mr-2" />
                    Add Game
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
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-6">
          {/* Season Summary Cards */}
          {selectedTeam && selectedSeason && (
            <>
              <div className="mb-6">
                <div className="flex items-center space-x-3 mb-4">
                  {getTeamLogo(selectedTeam.name) && (
                    <img 
                      src={getTeamLogo(selectedTeam.name)!} 
                      alt={`${selectedTeam.name} logo`}
                      className="w-8 h-8 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <TrophyIcon className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-slate-900">
                    {selectedTeam.name} {selectedSeason.year} Season
                  </h2>
                  {getTeamSport(selectedTeam.name) && (
                    <Badge variant="outline" className={`text-xs ${
                      getTeamSport(selectedTeam.name) === 'NFL' ? 'border-green-500 text-green-600' : 'border-blue-500 text-blue-600'
                    }`}>
                      {getTeamSport(selectedTeam.name)}
                    </Badge>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-slate-900">Games</h3>
                        <CalendarIcon className="w-8 h-8 text-blue-600" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600">Regular Season</span>
                          <span className="font-medium text-slate-900">{regularSeasonGames}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600">Preseason</span>
                          <span className="font-medium text-slate-900">{preSeasonGames}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600">Postseason</span>
                          <span className="font-medium text-slate-900">{postSeasonGames}</span>
                        </div>
                        <div className="border-t pt-2 mt-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-slate-700">Total</span>
                            <span className="text-lg font-bold text-slate-900">{totalGames}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-600">Upcoming</p>
                          <p className="text-2xl font-bold text-slate-900">{upcomingGames}</p>
                          <p className="text-xs text-slate-500">{completedGames} completed</p>
                        </div>
                        <ClockIcon className="w-8 h-8 text-purple-600" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Games Table */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="px-6 py-4 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {selectedTeam.name} {selectedSeason.year} Schedule
                      </h3>
                      <p className="text-sm text-slate-600 mt-1">
                        Manage and track all games for this season
                      </p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          {totalGames} Games
                        </Badge>
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          {preSeasonGames} Pre Season
                        </Badge>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          {regularSeasonGames} Regular
                        </Badge>
                        <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                          {postSeasonGames} Post Season
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowImportModal(true)}
                          className="flex items-center gap-2"
                        >
                          <DownloadIcon className="h-4 w-4" />
                          Import Schedule
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleExportSeason}
                          className="flex items-center gap-2"
                        >
                          <DownloadIcon className="h-4 w-4" />
                          Export Season
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleImportSeason}
                          className="flex items-center gap-2"
                        >
                          <UploadIcon className="h-4 w-4" />
                          Import Season
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setShowAddGameModal(true)}
                          className="flex items-center gap-2"
                        >
                          <PlusIcon className="h-4 w-4" />
                          Add Game
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <GamesTable seasonId={selectedSeasonId} />
              </div>
            </>
          )}

          {/* Empty State */}
          {!selectedTeam && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <CalendarIcon className="w-12 h-12 text-slate-400 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Team Selected</h3>
              <p className="text-slate-600 mb-4">Select a team above to start managing games</p>
            </div>
          )}

          {selectedTeam && !selectedSeason && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <TrophyIcon className="w-12 h-12 text-slate-400 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Season Available</h3>
              <p className="text-slate-600 mb-4">Create a season for {selectedTeam.name} to start adding games</p>
            </div>
          )}
        </main>
      </div>

      {/* Add Game Modal */}
      <AddGameModal 
        isOpen={showAddGameModal}
        onClose={() => setShowAddGameModal(false)}
        seasonId={selectedSeasonId}
      />

      {/* Import Schedule Modal */}
      <ImportScheduleModal 
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />

      {/* Hidden file input for season import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".csv"
        style={{ display: 'none' }}
      />
    </div>
  );
}