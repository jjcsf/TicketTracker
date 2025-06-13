import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SeasonProvider } from "@/contexts/SeasonContext";
import { LocalAuthProvider, useLocalAuth } from "@/hooks/use-local-auth";
import { LocalProtectedRoute } from "@/lib/local-protected-route";
import LocalAuthPage from "@/pages/local-auth-page";
import Dashboard from "@/pages/dashboard";
import Games from "@/pages/games";
import Finances from "@/pages/finances";
import TicketHolders from "@/pages/ticket-holders";
import SeatPredictions from "@/pages/seat-predictions";
import Reports from "@/pages/reports";
import Seats from "@/pages/seats";
import NotFound from "@/pages/not-found";

function Router() {
  const { user, isLoading } = useLocalAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/auth" component={LocalAuthPage} />
      {user ? (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/games" component={Games} />
          <Route path="/finances" component={Finances} />
          <Route path="/ticket-holders" component={TicketHolders} />
          <Route path="/seat-predictions" component={SeatPredictions} />
          <Route path="/reports" component={Reports} />
          <Route path="/seats" component={Seats} />
        </>
      ) : (
        <Route>
          <LocalAuthPage />
        </Route>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContainer() {
  return (
    <QueryClientProvider client={queryClient}>
      <LocalAuthProvider>
        <SeasonProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </SeasonProvider>
      </LocalAuthProvider>
    </QueryClientProvider>
  );
}

export default AppContainer;