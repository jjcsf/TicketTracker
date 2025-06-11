import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSeason } from "@/contexts/SeasonContext";
import Sidebar from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BarChart3Icon, TrendingUpIcon, TrendingDownIcon, DollarSignIcon } from "lucide-react";
import type { Team, Season } from "@shared/schema";

interface SeasonReport {
  seasonId: number;
  seasonYear: number;
  teamName: string;
  totalSales: string;
  totalCosts: string;
  totalProfit: string;
  ownerDetails: {
    ticketHolderId: number;
    name: string;
    sales: string;
    costs: string;
    profit: string;
  }[];
}

interface SeatLicenseInvestment {
  ticketHolderId: number;
  name: string;
  totalLicenseCosts: string;
  seatsOwned: number;
}

interface FinancialSummary {
  ticketHolderId: number;
  name: string;
  seatsOwned: number;
  balance: string;
}

interface OwnerBalance {
  ticketHolderId: number;
  name: string;
  seatsOwned: number;
  seatLicenseCosts: string;
  paymentsMade: string;
  paymentsReceived: string;
  balance: string;
}

export default function Reports() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const { selectedSeasonId, setSelectedSeasonId } = useSeason();
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

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

  const { data: seasonReports } = useQuery<SeasonReport[]>({
    queryKey: ["/api/reports/season-summary", selectedTeamId],
    queryFn: async () => {
      const res = await fetch(`/api/reports/season-summary${selectedTeamId ? `?teamId=${selectedTeamId}` : ''}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const { data: seatLicenseInvestments } = useQuery<SeatLicenseInvestment[]>({
    queryKey: ["/api/reports/seat-license-investments", selectedTeamId],
    queryFn: async () => {
      const res = await fetch(`/api/reports/seat-license-investments${selectedTeamId ? `?teamId=${selectedTeamId}` : ''}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const { data: ownerBalances } = useQuery<OwnerBalance[]>({
    queryKey: ["/api/reports/owner-balances"],
    queryFn: async () => {
      const res = await fetch('/api/reports/owner-balances', {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(num);
  };

  const calculateGrandTotals = () => {
    if (!seasonReports) return { sales: 0, costs: 0, profit: 0, licenseCosts: 0, totalCosts: 0 };
    
    const seasonTotals = seasonReports.reduce((totals, season) => ({
      sales: totals.sales + parseFloat(season.totalSales),
      costs: totals.costs + parseFloat(season.totalCosts),
      profit: totals.profit + parseFloat(season.totalProfit)
    }), { sales: 0, costs: 0, profit: 0 });

    // Add license costs from seat investments
    const licenseCosts = seatLicenseInvestments?.reduce((sum, inv) => sum + parseFloat(inv.totalLicenseCosts), 0) || 0;
    const totalCosts = seasonTotals.costs + licenseCosts;
    const totalProfit = seasonTotals.sales - totalCosts;

    return {
      sales: seasonTotals.sales,
      costs: seasonTotals.costs,
      profit: seasonTotals.profit,
      licenseCosts,
      totalCosts,
      totalProfit
    };
  };

  const calculateOwnerTotals = () => {
    if (!seasonReports) return [];
    
    const ownerTotalsMap = new Map();
    
    seasonReports.forEach(season => {
      season.ownerDetails.forEach(owner => {
        const existing = ownerTotalsMap.get(owner.ticketHolderId) || {
          ticketHolderId: owner.ticketHolderId,
          name: owner.name,
          sales: 0,
          costs: 0,
          profit: 0
        };
        
        existing.sales += parseFloat(owner.sales);
        existing.costs += parseFloat(owner.costs);
        existing.profit += parseFloat(owner.profit);
        
        ownerTotalsMap.set(owner.ticketHolderId, existing);
      });
    });
    
    return Array.from(ownerTotalsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  };

  // Get owner balances from reports endpoint
  const { data: ownerBalancesData } = useQuery<OwnerBalance[]>({
    queryKey: ['/api/reports/owner-balances'],
    enabled: isAuthenticated
  });

  // Get payments data for comprehensive summary
  const { data: payments } = useQuery<any[]>({
    queryKey: ['/api/payments'],
    enabled: isAuthenticated
  });

  const calculatePaymentTotals = () => {
    if (!payments || !Array.isArray(payments)) return { paymentsToTeams: 0, seatLicensePayments: 0, totalPayments: 0 };
    
    const paymentsToTeams = payments
      .filter((p: any) => p.type === 'to_team')
      .reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0);
    
    const seatLicensePayments = payments
      .filter((p: any) => p.type === 'from_owner' && p.category === 'seat_license')
      .reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0);
    
    const totalPayments = payments
      .filter((p: any) => ['to_team', 'from_owner'].includes(p.type))
      .reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0);
    
    return { paymentsToTeams, seatLicensePayments, totalPayments };
  };

  const grandTotals = calculateGrandTotals();
  const ownerTotals = calculateOwnerTotals();
  const paymentTotals = calculatePaymentTotals();

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
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Financial Reports</h1>
              <p className="text-slate-600">Season-by-season breakdown of sales, costs, and owner performance</p>
            </div>

            {/* Filters */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3Icon className="h-5 w-5" />
                  Report Filters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Team</label>
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

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Total Sales</p>
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(grandTotals.sales)}</p>
                    </div>
                    <TrendingUpIcon className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Total Costs</p>
                      <p className="text-2xl font-bold text-red-600">{formatCurrency(grandTotals.totalCosts)}</p>
                      <div className="text-xs text-slate-500 mt-1">
                        Operations: {formatCurrency(grandTotals.costs)} + 
                        Licenses: {formatCurrency(grandTotals.licenseCosts)}
                      </div>
                    </div>
                    <TrendingDownIcon className="h-8 w-8 text-red-600" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Total Profit</p>
                      <p className={`text-2xl font-bold ${(grandTotals.totalProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(grandTotals.totalProfit || 0)}
                      </p>
                    </div>
                    <DollarSignIcon className="h-8 w-8 text-slate-600" />
                  </div>
                </CardContent>
              </Card>
            </div>



            {/* Owner Totals Across All Seasons */}
            {ownerTotals.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Owner Performance Summary (All Seasons)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 font-medium text-slate-600">Owner</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-600">Total Sales</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-600">Total Costs</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-600">Seat License</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-600">Total Funds Added</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-600">Payments Dispersed</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-600">Total Profit</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-600">Balance</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-600">Overall Margin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ownerTotals.map((owner) => {
                          const margin = owner.sales > 0 ? ((owner.profit / owner.sales) * 100) : 0;
                          const ownerBalance = ownerBalances?.find((b: OwnerBalance) => b.ticketHolderId === owner.ticketHolderId);
                          const balance = ownerBalance ? parseFloat(ownerBalance.balance) : 0;
                          const seatLicenseCost = ownerBalance ? parseFloat(ownerBalance.seatLicenseCosts) : 0;
                          const paymentsMade = ownerBalance ? parseFloat(ownerBalance.paymentsMade) : 0;
                          const paymentsReceived = ownerBalance ? parseFloat(ownerBalance.paymentsReceived) : 0;
                          
                          return (
                            <tr key={owner.ticketHolderId} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="py-3 px-4 font-medium text-slate-900">{owner.name}</td>
                              <td className="py-3 px-4 text-right text-green-600 font-medium">
                                {formatCurrency(owner.sales)}
                              </td>
                              <td className="py-3 px-4 text-right text-red-600 font-medium">
                                {formatCurrency(owner.costs)}
                              </td>
                              <td className="py-3 px-4 text-right text-orange-600 font-medium">
                                {formatCurrency(seatLicenseCost)}
                              </td>
                              <td className="py-3 px-4 text-right text-blue-600 font-medium">
                                {formatCurrency(paymentsMade)}
                              </td>
                              <td className="py-3 px-4 text-right text-purple-600 font-medium">
                                {formatCurrency(paymentsReceived)}
                              </td>
                              <td className={`py-3 px-4 text-right font-medium ${owner.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(owner.profit)}
                              </td>
                              <td className={`py-3 px-4 text-right font-medium ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(balance)}
                              </td>
                              <td className={`py-3 px-4 text-right font-medium text-sm ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {margin.toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })}
                        
                        {/* Grand Total Row */}
                        <tr className="border-t-2 border-slate-300 bg-slate-100 font-semibold">
                          <td className="py-3 px-4 text-slate-900">Grand Total</td>
                          <td className="py-3 px-4 text-right text-green-600">
                            {formatCurrency(grandTotals.sales)}
                          </td>
                          <td className="py-3 px-4 text-right text-red-600">
                            {formatCurrency(grandTotals.costs)}
                          </td>
                          <td className="py-3 px-4 text-right text-orange-600">
                            {(() => {
                              const totalSeatLicenseCosts = ownerBalances?.reduce((sum: number, b: OwnerBalance) => sum + parseFloat(b.seatLicenseCosts), 0) || 0;
                              return formatCurrency(totalSeatLicenseCosts);
                            })()}
                          </td>
                          <td className="py-3 px-4 text-right text-blue-600">
                            {(() => {
                              const totalPaymentsMade = ownerBalances?.reduce((sum: number, b: OwnerBalance) => sum + parseFloat(b.paymentsMade), 0) || 0;
                              return formatCurrency(totalPaymentsMade);
                            })()}
                          </td>
                          <td className="py-3 px-4 text-right text-purple-600">
                            {(() => {
                              const totalPaymentsReceived = ownerBalances?.reduce((sum: number, b: OwnerBalance) => sum + parseFloat(b.paymentsReceived), 0) || 0;
                              return formatCurrency(totalPaymentsReceived);
                            })()}
                          </td>
                          <td className={`py-3 px-4 text-right ${grandTotals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(grandTotals.profit)}
                          </td>
                          <td className={`py-3 px-4 text-right ${(() => {
                            const totalBalance = ownerBalances?.reduce((sum: number, b: OwnerBalance) => sum + parseFloat(b.balance), 0) || 0;
                            return totalBalance >= 0 ? 'text-green-600' : 'text-red-600';
                          })()} font-semibold`}>
                            {(() => {
                              const totalBalance = ownerBalances?.reduce((sum: number, b: OwnerBalance) => sum + parseFloat(b.balance), 0) || 0;
                              return formatCurrency(totalBalance);
                            })()}
                          </td>
                          <td className={`py-3 px-4 text-right text-sm ${grandTotals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {grandTotals.sales > 0 ? ((grandTotals.profit / grandTotals.sales) * 100).toFixed(1) : 0}%
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Comprehensive Financial Summary */}
            {seasonReports && seasonReports.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3Icon className="h-5 w-5" />
                    Comprehensive Financial Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 font-medium text-slate-600">Metric</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-600">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-100">
                          <td className="py-3 px-4 font-medium text-slate-900">Total Sales</td>
                          <td className="py-3 px-4 text-right text-green-600 font-medium">
                            {formatCurrency(grandTotals.sales)}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="py-3 px-4 font-medium text-slate-900">Total Game Costs</td>
                          <td className="py-3 px-4 text-right text-red-600 font-medium">
                            {formatCurrency(grandTotals.costs)}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="py-3 px-4 font-medium text-slate-900">Total License Costs</td>
                          <td className="py-3 px-4 text-right text-red-600 font-medium">
                            {formatCurrency(grandTotals.licenseCosts)}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="py-3 px-4 font-medium text-slate-900">Total Costs (Game + License)</td>
                          <td className="py-3 px-4 text-right text-red-600 font-medium">
                            {formatCurrency(grandTotals.totalCosts)}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="py-3 px-4 font-medium text-slate-900">Total Payments to Teams</td>
                          <td className="py-3 px-4 text-right text-blue-600 font-medium">
                            {formatCurrency(paymentTotals.paymentsToTeams)}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="py-3 px-4 font-medium text-slate-900">Total Seat License Payments</td>
                          <td className="py-3 px-4 text-right text-blue-600 font-medium">
                            {formatCurrency(paymentTotals.seatLicensePayments)}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="py-3 px-4 font-medium text-slate-900">Total Payments Made</td>
                          <td className="py-3 px-4 text-right text-blue-600 font-medium">
                            {formatCurrency(paymentTotals.totalPayments)}
                          </td>
                        </tr>
                        <tr className="border-t-2 border-slate-300 bg-slate-100 font-semibold">
                          <td className="py-3 px-4 text-slate-900">Net Profit/Loss</td>
                          <td className={`py-3 px-4 text-right font-medium ${(grandTotals.totalProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(grandTotals.totalProfit || 0)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}



            {/* Season Reports */}
            <Card>
              <CardHeader>
                <CardTitle>Season Financial Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {seasonReports && seasonReports.length > 0 ? (
                  <div className="space-y-6">
                    {seasonReports.map((seasonReport) => (
                      <div key={seasonReport.seasonId} className="border border-slate-200 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900">
                              {seasonReport.teamName} - {seasonReport.seasonYear}
                            </h3>
                            <div className="flex items-center gap-4 mt-2">
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                Sales: {formatCurrency(seasonReport.totalSales)}
                              </Badge>
                              <Badge variant="outline" className="text-red-600 border-red-600">
                                Costs: {formatCurrency(seasonReport.totalCosts)}
                              </Badge>
                              <Badge 
                                variant="outline" 
                                className={`${parseFloat(seasonReport.totalProfit) >= 0 ? 'text-green-600 border-green-600' : 'text-red-600 border-red-600'}`}
                              >
                                Profit: {formatCurrency(seasonReport.totalProfit)}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {/* Owner Details Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-200">
                                <th className="text-left py-3 px-4 font-medium text-slate-600">Owner</th>
                                <th className="text-right py-3 px-4 font-medium text-slate-600">Sales</th>
                                <th className="text-right py-3 px-4 font-medium text-slate-600">Costs</th>
                                <th className="text-right py-3 px-4 font-medium text-slate-600">Profit</th>
                                <th className="text-right py-3 px-4 font-medium text-slate-600">Margin</th>
                              </tr>
                            </thead>
                            <tbody>
                              {seasonReport.ownerDetails.map((owner) => {
                                const sales = parseFloat(owner.sales);
                                const costs = parseFloat(owner.costs);
                                const profit = parseFloat(owner.profit);
                                const margin = sales > 0 ? ((profit / sales) * 100) : 0;
                                
                                return (
                                  <tr key={owner.ticketHolderId} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="py-3 px-4 font-medium text-slate-900">{owner.name}</td>
                                    <td className="py-3 px-4 text-right text-green-600 font-medium">
                                      {formatCurrency(sales)}
                                    </td>
                                    <td className="py-3 px-4 text-right text-red-600 font-medium">
                                      {formatCurrency(costs)}
                                    </td>
                                    <td className={`py-3 px-4 text-right font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {formatCurrency(profit)}
                                    </td>
                                    <td className={`py-3 px-4 text-right font-medium text-sm ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {margin.toFixed(1)}%
                                    </td>
                                  </tr>
                                );
                              })}
                              
                              {/* Season Totals Row */}
                              <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                                <td className="py-3 px-4 text-slate-900">Season Total</td>
                                <td className="py-3 px-4 text-right text-green-600">
                                  {formatCurrency(seasonReport.totalSales)}
                                </td>
                                <td className="py-3 px-4 text-right text-red-600">
                                  {formatCurrency(seasonReport.totalCosts)}
                                </td>
                                <td className={`py-3 px-4 text-right ${parseFloat(seasonReport.totalProfit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {formatCurrency(seasonReport.totalProfit)}
                                </td>
                                <td className={`py-3 px-4 text-right text-sm ${parseFloat(seasonReport.totalProfit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {parseFloat(seasonReport.totalSales) > 0 ? 
                                    ((parseFloat(seasonReport.totalProfit) / parseFloat(seasonReport.totalSales)) * 100).toFixed(1) : 0}%
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-slate-500">No financial data available for reporting.</p>
                    <p className="text-sm text-slate-400 mt-1">Add games and pricing to generate reports.</p>
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