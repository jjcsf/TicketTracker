import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { BarChart3Icon } from "lucide-react";

interface FinancialSummaryProps {
  seasonId: number | null;
}

interface FinancialSummaryData {
  ticketHolderId: number;
  name: string;
  seatsOwned: number;
  balance: string;
}

export default function FinancialSummary({ seasonId }: FinancialSummaryProps) {
  const { data: summary, isLoading } = useQuery<FinancialSummaryData[]>({
    queryKey: ["/api/dashboard/financial-summary", seasonId],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/financial-summary/${seasonId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: !!seasonId,
  });

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(Math.abs(num));
    
    return num >= 0 ? `+${formatted}` : `-${formatted}`;
  };

  const getBalanceColor = (balance: string) => {
    const num = parseFloat(balance);
    return num >= 0 ? "text-emerald-600" : "text-red-600";
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900">Financial Summary</h3>
      </div>
      <div className="p-6">
        {isLoading ? (
          <div className="text-center text-slate-500">Loading financial data...</div>
        ) : !summary || summary.length === 0 ? (
          <div className="text-center text-slate-500">
            No financial data available for this season.
          </div>
        ) : (
          <div className="space-y-4">
            {summary.map((holder) => (
              <div key={holder.ticketHolderId} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-b-0">
                <div>
                  <p className="text-sm font-medium text-slate-900">{holder.name}</p>
                  <p className="text-xs text-slate-500">
                    {holder.seatsOwned} seat{holder.seatsOwned !== 1 ? 's' : ''} owned
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-medium ${getBalanceColor(holder.balance)}`}>
                    {formatBalance(holder.balance)}
                  </p>
                  <p className="text-xs text-slate-500">Current balance</p>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-6 pt-4 border-t border-slate-200">
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              // TODO: Navigate to detailed financial report
              console.log('View full report');
            }}
          >
            <BarChart3Icon className="w-4 h-4 mr-2" />
            View Full Report
          </Button>
        </div>
      </div>
    </div>
  );
}
