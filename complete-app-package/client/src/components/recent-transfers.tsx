import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlusIcon } from "lucide-react";
import type { Transfer } from "@shared/schema";

interface RecentTransfersProps {
  seasonId: number | null;
  onNewTransfer: () => void;
}

export default function RecentTransfers({ seasonId, onNewTransfer }: RecentTransfersProps) {
  const { data: transfers, isLoading } = useQuery<Transfer[]>({
    queryKey: ["/api/transfers", { seasonId }],
    enabled: !!seasonId,
  });

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(parseFloat(amount));
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'default';
      case 'pending':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'text-emerald-600';
      case 'pending':
        return 'text-amber-600';
      default:
        return 'text-slate-600';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Recent Transfers</h3>
          <Button 
            variant="outline" 
            size="sm"
            onClick={onNewTransfer}
            disabled={!seasonId}
          >
            <PlusIcon className="w-4 h-4 mr-1" />
            New Transfer
          </Button>
        </div>
      </div>
      <div className="p-6">
        {isLoading ? (
          <div className="text-center text-slate-500">Loading transfers...</div>
        ) : !transfers || transfers.length === 0 ? (
          <div className="text-center text-slate-500">
            No transfers found for this season.
          </div>
        ) : (
          <div className="space-y-4">
            {transfers.slice(0, 5).map((transfer) => (
              <div key={transfer.id} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-b-0">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Seat Transfer #{transfer.id}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(transfer.date)} • Game #{transfer.gameId}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900">
                    {formatCurrency(transfer.amount)}
                  </p>
                  <Badge 
                    variant={getStatusVariant(transfer.status)}
                    className={`text-xs ${
                      transfer.status.toLowerCase() === 'completed' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : transfer.status.toLowerCase() === 'pending'
                        ? 'bg-amber-100 text-amber-700'
                        : ''
                    }`}
                  >
                    {transfer.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
