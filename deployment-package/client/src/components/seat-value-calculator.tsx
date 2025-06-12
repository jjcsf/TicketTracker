import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Calculator, 
  TrendingUp, 
  Target, 
  BarChart3, 
  RefreshCw,
  DollarSign,
  Users,
  Trophy,
  Activity
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Season, TeamPerformance, SeatValuePrediction, Seat } from "@shared/schema";

interface SeatValueCalculatorProps {
  seasonId: number | null;
}

export default function SeatValueCalculator({ seasonId }: SeatValueCalculatorProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedSeatForPrices, setSelectedSeatForPrices] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: seasons } = useQuery<Season[]>({
    queryKey: ["/api/seasons"],
    enabled: !!seasonId,
  });

  const season = seasons?.find(s => s.id === seasonId);

  const { data: teamPerformance, isLoading: isLoadingPerformance } = useQuery<TeamPerformance[]>({
    queryKey: ["/api/team-performance", { teamId: season?.teamId, seasonId }],
    queryFn: async () => {
      const response = await fetch(`/api/team-performance?teamId=${season?.teamId}&seasonId=${seasonId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch team performance');
      return response.json();
    },
    enabled: !!season && !!seasonId,
  });

  const { data: seatPredictions, isLoading: isLoadingPredictions } = useQuery<SeatValuePrediction[]>({
    queryKey: ["/api/seat-predictions", { seasonId }],
    queryFn: async () => {
      const response = await fetch(`/api/seat-predictions?seasonId=${seasonId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch seat predictions');
      return response.json();
    },
    enabled: !!seasonId,
  });

  const { data: seats } = useQuery<Seat[]>({
    queryKey: ["/api/seats"],
    enabled: !!season,
  });

  // External API status
  const { data: apiStatus } = useQuery<{
    seatgeek: boolean;
    stubhub: boolean;
    anyConfigured: boolean;
  }>({
    queryKey: ["/api/external-api/status"],
  });

  const { data: similarTicketPrices } = useQuery<{
    gameId: number;
    gameDate: string;
    opponent: string;
    similarSeats: {
      seatId: number;
      section: string;
      row: string;
      number: string;
      currentPrice: string;
      sold: boolean;
      marketplace?: string;
      seller?: string;
      url?: string;
    }[];
  }[]>({
    queryKey: ["/api/seat-predictions", selectedSeatForPrices, seasonId, "similar-prices"],
    queryFn: async () => {
      const response = await fetch(`/api/seat-predictions/${selectedSeatForPrices}/${seasonId}/similar-prices`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch similar ticket prices');
      return response.json();
    },
    enabled: !!selectedSeatForPrices && !!seasonId,
  });

  const calculatePerformanceMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/team-performance/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ teamId: season?.teamId, seasonId }),
      });
      if (!response.ok) throw new Error('Failed to calculate performance');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-performance"] });
    },
  });

  const calculatePredictionsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/seat-predictions/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ seasonId }),
      });
      if (!response.ok) throw new Error('Failed to calculate predictions');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seat-predictions"] });
    },
  });

  const handleCalculatePerformance = () => {
    if (season?.teamId && seasonId) {
      calculatePerformanceMutation.mutate();
    }
  };

  const handleCalculatePredictions = () => {
    if (seasonId) {
      calculatePredictionsMutation.mutate();
    }
  };

  const performance = teamPerformance?.[0];
  const teamSeats = seats?.filter(seat => seat.teamId === season?.teamId) || [];
  const seatPredictionsForTeam = seatPredictions?.filter(pred => 
    teamSeats.some(seat => seat.id === pred.seatId)
  ) || [];

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(num || 0);
  };

  const formatPercentage = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return `${(num || 0).toFixed(1)}%`;
  };

  const getConfidenceColor = (confidence: string | number) => {
    const num = typeof confidence === 'string' ? parseFloat(confidence) : confidence;
    if (num >= 80) return "text-green-600";
    if (num >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getPerformanceGrade = (winPercentage: string | number) => {
    const num = typeof winPercentage === 'string' ? parseFloat(winPercentage) : winPercentage;
    if (num >= 0.8) return "A";
    if (num >= 0.6) return "B";
    if (num >= 0.4) return "C";
    if (num >= 0.2) return "D";
    return "F";
  };

  if (!seasonId) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-slate-500">
            <Calculator className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>Please select a season to view seat value predictions.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Seat Value Calculator</h2>
          <p className="text-slate-600">
            Predictive analytics based on team performance and market trends
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleCalculatePerformance}
            disabled={calculatePerformanceMutation.isPending}
            variant="outline"
            size="sm"
          >
            {calculatePerformanceMutation.isPending ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <BarChart3 className="w-4 h-4 mr-2" />
            )}
            Update Performance
          </Button>
          <Button 
            onClick={handleCalculatePredictions}
            disabled={calculatePredictionsMutation.isPending}
            size="sm"
          >
            {calculatePredictionsMutation.isPending ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Calculator className="w-4 h-4 mr-2" />
            )}
            Calculate Predictions
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Team Performance</TabsTrigger>
          <TabsTrigger value="predictions">Seat Predictions</TabsTrigger>
          <TabsTrigger value="similar-prices">Similar Prices</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Win Rate</p>
                    <p className="text-2xl font-bold">
                      {performance ? formatPercentage(parseFloat(performance.winPercentage || "0") * 100) : "N/A"}
                    </p>
                  </div>
                  <Trophy className="w-8 h-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Market Demand</p>
                    <p className="text-2xl font-bold">
                      {performance ? `${parseFloat(performance.marketDemand || "0").toFixed(1)}/10` : "N/A"}
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Avg Attendance</p>
                    <p className="text-2xl font-bold">
                      {performance?.averageAttendance || "N/A"}
                    </p>
                  </div>
                  <Users className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Playoff Odds</p>
                    <p className="text-2xl font-bold">
                      {performance ? formatPercentage(performance.playoffProbability || "0") : "N/A"}
                    </p>
                  </div>
                  <Target className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Value Overview */}
          {seatPredictionsForTeam.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="w-5 h-5 mr-2" />
                  Predicted Seat Values
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-sm text-slate-600">Average Predicted Value</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(
                        seatPredictionsForTeam.reduce((sum, pred) => sum + parseFloat(pred.predictedValue || "0"), 0) / 
                        seatPredictionsForTeam.length
                      )}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-slate-600">Highest Value</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(
                        Math.max(...seatPredictionsForTeam.map(pred => parseFloat(pred.predictedValue || "0")))
                      )}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-slate-600">Average Confidence</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {formatPercentage(
                        seatPredictionsForTeam.reduce((sum, pred) => sum + parseFloat(pred.confidenceScore || "0"), 0) / 
                        seatPredictionsForTeam.length
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          {performance ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Season Record</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Wins</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      {performance.wins}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Losses</span>
                    <Badge variant="secondary" className="bg-red-100 text-red-700">
                      {performance.losses}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Win Percentage</span>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                      {formatPercentage(parseFloat(performance.winPercentage || "0") * 100)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Grade</span>
                    <Badge variant="secondary" className={`text-white ${
                      getPerformanceGrade(performance.winPercentage || "0") === "A" ? "bg-green-500" :
                      getPerformanceGrade(performance.winPercentage || "0") === "B" ? "bg-blue-500" :
                      getPerformanceGrade(performance.winPercentage || "0") === "C" ? "bg-yellow-500" :
                      getPerformanceGrade(performance.winPercentage || "0") === "D" ? "bg-orange-500" : "bg-red-500"
                    }`}>
                      {getPerformanceGrade(performance.winPercentage || "0")}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Market Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span>Market Demand</span>
                      <span>{parseFloat(performance.marketDemand || "0").toFixed(1)}/10</span>
                    </div>
                    <Progress value={parseFloat(performance.marketDemand || "0") * 10} className="h-2" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span>Playoff Probability</span>
                      <span>{formatPercentage(performance.playoffProbability || "0")}</span>
                    </div>
                    <Progress value={parseFloat(performance.playoffProbability || "0")} className="h-2" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Average Attendance</span>
                    <Badge variant="outline">
                      {performance.averageAttendance || 0} per game
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <Activity className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p className="text-slate-500 mb-4">No performance data available</p>
                  <Button onClick={handleCalculatePerformance} disabled={calculatePerformanceMutation.isPending}>
                    {calculatePerformanceMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <BarChart3 className="w-4 h-4 mr-2" />
                    )}
                    Calculate Team Performance
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="predictions" className="space-y-6">
          {seatPredictionsForTeam.length > 0 ? (
            <div className="space-y-4">
              {seatPredictionsForTeam.map((prediction) => {
                const seat = teamSeats.find(s => s.id === prediction.seatId);
                return (
                  <Card key={prediction.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-4">
                            <div>
                              <h4 className="font-medium">
                                Section {seat?.section}, Row {seat?.row}, Seat {seat?.number}
                              </h4>
                              <p className="text-sm text-slate-600">
                                Baseline: {formatCurrency(prediction.baselineValue || "0")} •
                                Performance: {parseFloat(prediction.performanceMultiplier || "1").toFixed(2)}x •
                                Demand: {parseFloat(prediction.demandMultiplier || "1").toFixed(2)}x
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-600">
                            {formatCurrency(prediction.predictedValue || "0")}
                          </p>
                          <p className={`text-sm ${getConfidenceColor(prediction.confidenceScore || "0")}`}>
                            {formatPercentage(prediction.confidenceScore || "0")} confidence
                          </p>
                        </div>
                      </div>
                      
                      {prediction.factorsConsidered && prediction.factorsConsidered.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs text-slate-500 mb-2">Factors considered:</p>
                          <div className="flex flex-wrap gap-1">
                            {prediction.factorsConsidered.map((factor) => (
                              <Badge key={factor} variant="outline" className="text-xs">
                                {factor.replace(/_/g, ' ')}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <Calculator className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p className="text-slate-500 mb-4">No seat predictions available</p>
                  <Button onClick={handleCalculatePredictions} disabled={calculatePredictionsMutation.isPending}>
                    {calculatePredictionsMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Calculator className="w-4 h-4 mr-2" />
                    )}
                    Generate Predictions
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="similar-prices" className="space-y-6">
          {/* Seat Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <DollarSign className="w-5 h-5 mr-2" />
                  Current Market Prices for Similar Seats
                </div>
                {apiStatus && (
                  <div className="flex items-center space-x-2">
                    {apiStatus.seatgeek && (
                      <Badge variant="secondary" className="text-xs">
                        SeatGeek
                      </Badge>
                    )}
                    {apiStatus.stubhub && (
                      <Badge variant="secondary" className="text-xs">
                        StubHub
                      </Badge>
                    )}
                    {!apiStatus.anyConfigured && (
                      <Badge variant="outline" className="text-xs">
                        Internal Data Only
                      </Badge>
                    )}
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Select a seat to view similar prices:</label>
                <select 
                  value={selectedSeatForPrices || ""} 
                  onChange={(e) => setSelectedSeatForPrices(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full p-2 border border-slate-300 rounded-md"
                >
                  <option value="">Choose a seat...</option>
                  {teamSeats.map((seat) => (
                    <option key={seat.id} value={seat.id}>
                      Section {seat.section}, Row {seat.row}, Seat {seat.number}
                    </option>
                  ))}
                </select>
              </div>

              {selectedSeatForPrices && similarTicketPrices && similarTicketPrices.length > 0 ? (
                <div className="space-y-4">
                  {similarTicketPrices.map((gameData) => (
                    <Card key={gameData.gameId}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="font-medium">{gameData.opponent}</h4>
                            <p className="text-sm text-slate-600">{new Date(gameData.gameDate).toLocaleDateString()}</p>
                          </div>
                          <Badge variant="outline">
                            {gameData.similarSeats.length} similar seats
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {gameData.similarSeats.map((seat, index) => {
                            const isExternalListing = seat.seatId === -1;
                            const SeatDisplay = seat.url ? 'a' : 'div';
                            
                            return (
                              <SeatDisplay
                                key={seat.seatId === -1 ? `external-${index}` : seat.seatId}
                                href={seat.url}
                                target={seat.url ? "_blank" : undefined}
                                rel={seat.url ? "noopener noreferrer" : undefined}
                                className={`p-3 rounded border transition-colors ${
                                  seat.sold ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                                } ${seat.url ? 'hover:bg-blue-50 hover:border-blue-300 cursor-pointer' : ''}`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div>
                                    <p className="text-sm font-medium">
                                      Sec {seat.section}, Row {seat.row}, #{seat.number}
                                    </p>
                                    <p className="text-lg font-bold text-green-600">
                                      {formatCurrency(seat.currentPrice)}
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-end space-y-1">
                                    <Badge variant={seat.sold ? "destructive" : "default"}>
                                      {seat.sold ? "SOLD" : "Available"}
                                    </Badge>
                                    {isExternalListing && seat.marketplace && (
                                      <Badge variant="secondary" className="text-xs">
                                        {seat.marketplace.toUpperCase()}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                {isExternalListing && seat.seller && (
                                  <p className="text-xs text-slate-500">
                                    Listed by: {seat.seller}
                                  </p>
                                )}
                                {seat.url && (
                                  <p className="text-xs text-blue-600 mt-1">
                                    Click to view on marketplace →
                                  </p>
                                )}
                              </SeatDisplay>
                            );
                          })}
                        </div>

                        {gameData.similarSeats.length > 0 && (
                          <div className="mt-4 pt-4 border-t">
                            <div className="grid grid-cols-3 gap-4 text-center">
                              <div>
                                <p className="text-sm text-slate-600">Average Price</p>
                                <p className="text-lg font-bold">
                                  {formatCurrency(
                                    gameData.similarSeats.reduce((sum, s) => sum + parseFloat(s.currentPrice), 0) / gameData.similarSeats.length
                                  )}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-slate-600">Available</p>
                                <p className="text-lg font-bold text-green-600">
                                  {gameData.similarSeats.filter(s => !s.sold).length}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-slate-600">Sold</p>
                                <p className="text-lg font-bold text-red-600">
                                  {gameData.similarSeats.filter(s => s.sold).length}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : selectedSeatForPrices ? (
                <Card>
                  <CardContent className="py-8">
                    <div className="text-center">
                      <DollarSign className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      <p className="text-slate-500">No similar seat pricing data available for this seat</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-8">
                    <div className="text-center">
                      <DollarSign className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      <p className="text-slate-500">Select a seat to view current prices for similar seats</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Data Quality Alert */}
      {(seatPredictionsForTeam.length > 0 && seatPredictionsForTeam.some(p => parseFloat(p.confidenceScore || "0") < 70)) && (
        <Alert>
          <AlertDescription>
            Some predictions have low confidence scores. Consider adding more attendance data and game pricing information to improve accuracy.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}