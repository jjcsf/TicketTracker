import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSeason } from "@/contexts/SeasonContext";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/sidebar";
import SeatLicensePaymentModal from "@/components/seat-license-payment-modal";
import EnhancedAddPaymentModal from "@/components/enhanced-add-payment-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { PlusIcon, DollarSignIcon, TrendingUpIcon, TrendingDownIcon, UsersIcon, BuildingIcon, EditIcon, TrashIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Team, Season, TicketHolder, Payment } from "@shared/schema";

const paymentSchema = z.object({
  seasonId: z.string().refine((val) => val === "none" || (val.length > 0 && !isNaN(Number(val))), "Please select a season or 'Not applicable'"),
  ticketHolderId: z.string().optional(),
  teamId: z.string().optional(),
  fromOwnerId: z.string().optional(),
  amount: z.string().min(1, "Amount is required").refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Amount must be a positive number"),
  type: z.enum(["from_owner", "to_owner", "to_team", "from_team"]),
  category: z.string().min(1, "Please select a category"),
  description: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface PaymentWithDetails extends Payment {
  ticketHolderName?: string;
  teamName?: string;
  seasonYear?: number;
}

export default function Finances() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedSeasonId, setSelectedSeasonId } = useSeason();
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentWithDetails | null>(null);
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);

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

  // Start with "All seasons" view (selectedSeasonId = null)

  const { data: ticketHolders } = useQuery<TicketHolder[]>({
    queryKey: ["/api/ticket-holders"],
    enabled: isAuthenticated,
  });

  const { data: seats } = useQuery<any[]>({
    queryKey: ["/api/seats"],
    enabled: isAuthenticated,
  });

  const { data: payments } = useQuery<PaymentWithDetails[]>({
    queryKey: ["/api/payments"],
    queryFn: async () => {
      const res = await fetch(`/api/payments`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
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
    queryKey: ["/api/dashboard/stats", selectedSeasonId, seasons?.map(s => s.id)],
    queryFn: async () => {
      if (!selectedSeasonId) {
        // Calculate aggregate stats across all seasons
        if (!seasons || seasons.length === 0) return null;
        
        const allStats = await Promise.all(
          seasons.map(async (season) => {
            const res = await fetch(`/api/dashboard/stats/${season.id}`, {
              credentials: "include",
            });
            if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
            return res.json();
          })
        );

        // Aggregate the results
        const aggregated = allStats.reduce((acc, stats) => ({
          totalRevenue: (parseFloat(acc.totalRevenue) + parseFloat(stats.totalRevenue)).toString(),
          totalCosts: (parseFloat(acc.totalCosts) + parseFloat(stats.totalCosts)).toString(),
          totalProfit: (parseFloat(acc.totalProfit) + parseFloat(stats.totalProfit)).toString(),
          gamesPlayed: acc.gamesPlayed + stats.gamesPlayed,
          totalGames: acc.totalGames + stats.totalGames,
          activeSeats: acc.activeSeats + stats.activeSeats,
          ticketHolders: Math.max(acc.ticketHolders, stats.ticketHolders), // Max to avoid double counting
        }), {
          totalRevenue: "0",
          totalCosts: "0", 
          totalProfit: "0",
          gamesPlayed: 0,
          totalGames: 0,
          activeSeats: 0,
          ticketHolders: 0,
        });

        return aggregated;
      }
      
      const res = await fetch(`/api/dashboard/stats/${selectedSeasonId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: isAuthenticated && (!!selectedSeasonId || (seasons && seasons.length > 0)),
  });

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      seasonId: "",
      ticketHolderId: "",
      teamId: "",
      fromOwnerId: "",
      amount: "",
      type: "from_owner",
      category: "",
      description: "",
      date: new Date().toISOString().split('T')[0],
      notes: "",
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async (data: PaymentFormData) => {
      // Auto-determine team from season when payment type is "to_team"
      let teamId = data.teamId ? parseInt(data.teamId) : null;
      if (data.type === "to_team" && data.seasonId !== "none") {
        const selectedSeason = seasons?.find(s => s.id === parseInt(data.seasonId));
        teamId = selectedSeason?.teamId || null;
      }
      
      const paymentData = {
        seasonId: data.seasonId === "none" ? null : parseInt(data.seasonId),
        ticketHolderId: data.fromOwnerId ? parseInt(data.fromOwnerId) : (data.ticketHolderId ? parseInt(data.ticketHolderId) : null),
        teamId: teamId,
        amount: data.amount,
        type: data.type,
        category: data.category,
        description: data.description || null,
        date: data.date,
        notes: data.notes || null,
      };
      
      return apiRequest("POST", "/api/payments", paymentData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Payment recorded successfully.",
      });
      form.reset();
      setShowAddPaymentModal(false);
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/financial-summary"] });
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
        description: "Failed to record payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: PaymentFormData }) => {
      const paymentData = {
        seasonId: parseInt(data.seasonId),
        ticketHolderId: data.ticketHolderId ? parseInt(data.ticketHolderId) : null,
        teamId: data.teamId ? parseInt(data.teamId) : null,
        amount: data.amount,
        type: data.type,
        category: data.category || null,
        description: data.description || null,
        date: data.date,
        notes: data.notes || null,
      };
      
      return apiRequest("PUT", `/api/payments/${id}`, paymentData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Payment updated successfully.",
      });
      form.reset();
      setShowEditPaymentModal(false);
      setEditingPayment(null);
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/financial-summary"] });
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
        description: "Failed to update payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/payments/${id}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Payment deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/financial-summary"] });
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
        description: "Failed to delete payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: PaymentFormData) => {
    if (editingPayment) {
      updatePaymentMutation.mutate({ id: editingPayment.id, data });
    } else {
      paymentMutation.mutate(data);
    }
  };

  const handleEditPayment = (payment: PaymentWithDetails) => {
    setEditingPayment(payment);
    form.reset({
      seasonId: payment.seasonId?.toString() || "",
      ticketHolderId: payment.ticketHolderId?.toString() || "",
      teamId: payment.teamId?.toString() || "",
      amount: payment.amount,
      type: payment.type as "from_owner" | "to_owner" | "to_team" | "from_team",
      category: payment.category || "",
      description: payment.description || "",
      date: payment.date,
      notes: payment.notes || "",
    });
    setShowEditPaymentModal(true);
  };

  const handleDeletePayment = (id: number) => {
    if (confirm("Are you sure you want to delete this payment?")) {
      deletePaymentMutation.mutate(id);
    }
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(amount));
  };

  const getPaymentTypeColor = (type: string) => {
    switch (type) {
      case 'from_owner':
        return 'bg-green-100 text-green-800';
      case 'to_owner':
        return 'bg-blue-100 text-blue-800';
      case 'to_team':
        return 'bg-orange-100 text-orange-800';
      case 'from_team':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentTypeLabel = (type: string) => {
    switch (type) {
      case 'from_owner':
        return 'From Owner';
      case 'to_owner':
        return 'To Owner';
      case 'to_team':
        return 'To Team';
      case 'from_team':
        return 'From Team';
      default:
        return type;
    }
  };

  const calculateSummary = () => {
    // Total inflow comes from ticket sales revenue
    const ticketSalesRevenue = dashboardStats ? parseFloat(dashboardStats.totalRevenue) : 0;
    
    // Manual payments represent additional cash flows
    const paymentInflow = payments 
      ? payments.filter(p => ['from_owner', 'from_team'].includes(p.type))
          .reduce((sum, p) => sum + parseFloat(p.amount), 0)
      : 0;

    const paymentOutflow = payments
      ? payments.filter(p => ['to_owner', 'to_team'].includes(p.type))
          .reduce((sum, p) => sum + parseFloat(p.amount), 0)
      : 0;

    // Calculate payments to teams specifically
    const paymentsToTeams = payments
      ? payments.filter(p => p.type === 'to_team')
          .reduce((sum, p) => sum + parseFloat(p.amount), 0)
      : 0;

    // Calculate seat license payments made
    const seatLicensePayments = payments
      ? payments.filter(p => p.category === 'seat_license' && p.type === 'from_owner')
          .reduce((sum, p) => sum + parseFloat(p.amount), 0)
      : 0;

    // Total costs = seat costs + seat license costs
    const seatCosts = dashboardStats ? parseFloat(dashboardStats.totalCosts) : 0;
    // Only 3 seats (seats 2, 3, 4) have license costs of $9,996.39 each
    const totalSeatLicenseCosts = 3 * 9996.39;
    const totalCosts = seatCosts + totalSeatLicenseCosts;
    
    // Total payments made = payments to teams + seat license payments
    const totalPaymentsMade = paymentsToTeams + seatLicensePayments;
    
    // Amount owed = total costs - total payments made
    const amountOwed = totalCosts - totalPaymentsMade;

    // Total inflow = ticket sales + payment inflows
    const totalIn = ticketSalesRevenue + paymentInflow;
    const totalOut = paymentOutflow;

    return {
      totalIn,
      totalOut,
      netFlow: totalIn - totalOut,
      ticketSalesRevenue,
      paymentInflow,
      paymentOutflow,
      amountOwed,
      totalCosts,
      paymentsToTeams,
    };
  };

  const summary = calculateSummary();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      
      <div className="pl-64">
        <main className="p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Financial Management</h1>
            <p className="text-slate-600 mt-2">
              Manage payments to teams, payments to owners, and payments from owners
            </p>
          </div>

          {/* Season Filter */}
          <div className="mb-6">
            <Label htmlFor="season-select">Filter by Season</Label>
            <Select value={selectedSeasonId?.toString() || "all"} onValueChange={(value) => setSelectedSeasonId(value === "all" ? null : parseInt(value))}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="All seasons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All seasons</SelectItem>
                {seasons?.map((season) => {
                  const team = teams?.find(t => t.id === season.teamId);
                  return (
                    <SelectItem key={season.id} value={season.id.toString()}>
                      {team?.name} - {season.year}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Financial Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Ticket Sales Revenue</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.ticketSalesRevenue.toString())}</p>
                    <p className="text-xs text-slate-500 mt-1">Primary income source</p>
                  </div>
                  <TrendingUpIcon className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Additional Inflows</p>
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(summary.paymentInflow.toString())}</p>
                    <p className="text-xs text-slate-500 mt-1">Extra payments received</p>
                  </div>
                  <PlusIcon className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Total Outflows</p>
                    <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalOut.toString())}</p>
                    <p className="text-xs text-slate-500 mt-1">Payments made out</p>
                  </div>
                  <TrendingDownIcon className="w-8 h-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Net Cash Flow</p>
                    <p className={`text-2xl font-bold ${summary.netFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(summary.netFlow.toString())}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Total - Outflows</p>
                  </div>
                  <DollarSignIcon className={`w-8 h-8 ${summary.netFlow >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Amount Owed</p>
                    <p className={`text-2xl font-bold ${summary.amountOwed > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(summary.amountOwed.toString())}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Total costs - All payments made</p>
                  </div>
                  <BuildingIcon className={`w-8 h-8 ${summary.amountOwed > 0 ? 'text-red-600' : 'text-green-600'}`} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payments Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Financial Transactions</CardTitle>
                <div className="flex gap-2">
                  <SeatLicensePaymentModal ticketHolders={ticketHolders || []} />
                  <Button onClick={() => setShowAddPaymentModal(true)}>
                    <PlusIcon className="w-4 h-4 mr-2" />
                    Add Payment
                  </Button>
                  
                  <EnhancedAddPaymentModal
                    isOpen={showAddPaymentModal}
                    onClose={() => setShowAddPaymentModal(false)}
                    teams={teams}
                    seasons={seasons}
                    ticketHolders={ticketHolders}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {payments && payments.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4 font-medium text-slate-600">Date</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">Type</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">Party</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">Amount</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">Category</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">Description</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-4 text-slate-900">
                            {new Date(payment.date).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={getPaymentTypeColor(payment.type)}>
                              {getPaymentTypeLabel(payment.type)}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-slate-900">
                            {payment.ticketHolderName || payment.teamName || 'N/A'}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`font-semibold ${
                              payment.category === 'seat_license' ? 'text-red-600' :
                              ['from_owner', 'from_team'].includes(payment.type) ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {payment.category === 'seat_license' ? '-' :
                               ['from_owner', 'from_team'].includes(payment.type) ? '+' : '-'}
                              {formatCurrency(payment.amount)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {payment.category || '-'}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {payment.description || '-'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditPayment(payment)}
                                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                                title="Edit payment"
                              >
                                <EditIcon className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeletePayment(payment.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                title="Delete payment"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-slate-500">No financial transactions recorded yet.</p>
                  <p className="text-sm text-slate-400 mt-1">Click "Add Payment" to record your first transaction.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Edit Payment Modal */}
          <Dialog open={showEditPaymentModal} onOpenChange={setShowEditPaymentModal}>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Edit Payment</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
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
                                          {team?.name} - {season.year}
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
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Payment Type</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="from_owner">From Owner</SelectItem>
                                    <SelectItem value="to_owner">To Owner</SelectItem>
                                    <SelectItem value="to_team">To Team</SelectItem>
                                    <SelectItem value="from_team">From Team</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {(form.watch("type") === "from_owner" || form.watch("type") === "to_owner") && (
                          <FormField
                            control={form.control}
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
                        )}

                        {(form.watch("type") === "to_team" || form.watch("type") === "from_team") && (
                          <FormField
                            control={form.control}
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
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Amount ($)</FormLabel>
                                <FormControl>
                                  <Input placeholder="0.00" {...field} />
                                </FormControl>
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
                        </div>

                        <FormField
                          control={form.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Category (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., season fees, concessions, parking" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description (Optional)</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Brief description of the payment"
                                  className="resize-none"
                                  rows={2}
                                  {...field}
                                />
                              </FormControl>
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
                                  placeholder="Additional notes or comments"
                                  className="resize-none"
                                  rows={2}
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
                              setShowEditPaymentModal(false);
                              setEditingPayment(null);
                              form.reset();
                            }}
                          >
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={updatePaymentMutation.isPending}
                          >
                            {updatePaymentMutation.isPending ? "Updating..." : "Update Payment"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
        </main>
      </div>
    </div>
  );
}