import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getTeamLogo } from "@/lib/teamLogos";
import Sidebar from "@/components/sidebar";
import SeatValueCalculator from "@/components/seat-value-calculator";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calculator } from "lucide-react";
import type { Team, Season } from "@shared/schema";

export default function SeatPredictions() {
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: teams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    enabled: true,
  });

  const { data: seasons } = useQuery<Season[]>({
    queryKey: ["/api/seasons"],
    enabled: true,
  });

  const selectedSeason = seasons?.find(s => s.id === selectedSeasonId);
  const selectedTeam = teams?.find(t => t.id === selectedSeason?.teamId);

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <div className="pl-64">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Calculator className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-slate-900">Seat Value Predictions</h1>
            </div>
            <p className="text-slate-600">
              AI-powered seat value predictions based on team performance and market analysis
            </p>
          </div>

          {/* Season Selection */}
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Select Season
                  </label>
                  <Select 
                    value={selectedSeasonId?.toString() || ""} 
                    onValueChange={(value) => setSelectedSeasonId(parseInt(value))}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Choose a season..." />
                    </SelectTrigger>
                    <SelectContent>
                      {seasons?.map((season) => {
                        const team = teams?.find(t => t.id === season.teamId);
                        return (
                          <SelectItem key={season.id} value={season.id.toString()}>
                            <div className="flex items-center gap-2">
                              {team && (
                                <img 
                                  src={getTeamLogo(team.name) || ""} 
                                  alt={team.name}
                                  className="w-5 h-5 rounded"
                                />
                              )}
                              <span>{team?.name} {season.year}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedTeam && (
                  <div className="flex items-center gap-3">
                    <img 
                      src={getTeamLogo(selectedTeam.name) || ""} 
                      alt={selectedTeam.name}
                      className="w-12 h-12 rounded-lg"
                    />
                    <div>
                      <p className="font-medium text-slate-900">{selectedTeam.name}</p>
                      <Badge variant="secondary">{selectedSeason?.year} Season</Badge>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Seat Value Calculator */}
          <SeatValueCalculator seasonId={selectedSeasonId} />
        </div>
      </div>
    </div>
  );
}