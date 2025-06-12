import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/sidebar";
import TicketHoldersTable from "@/components/ticket-holders-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusIcon, UsersIcon } from "lucide-react";

export default function TicketHolders() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);

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

  if (isLoading) {
    return (
      <div className="flex h-screen bg-slate-50">
        <Sidebar />
        <div className="flex-1 lg:pl-64 flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg text-slate-600">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

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
                <h1 className="text-2xl font-bold text-slate-900">Ticket Holders</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Manage ticket holder information and contact details
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <Button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-2"
                >
                  <PlusIcon className="w-4 h-4" />
                  Add Ticket Holder
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-blue-600" />
                All Ticket Holders
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <TicketHoldersTable />
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}