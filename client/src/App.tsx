import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SeasonProvider } from "@/contexts/SeasonContext";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import AccessDenied from "@/pages/access-denied";
import Dashboard from "@/pages/dashboard";
import Games from "@/pages/games";
import Finances from "@/pages/finances";
import TicketHolders from "@/pages/ticket-holders";
import SeatPredictions from "@/pages/seat-predictions";
import Reports from "@/pages/reports";
import Seats from "@/pages/seats";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading, isForbidden } = useAuth();

  return (
    <Switch>
      {isLoading ? (
        <Route path="/" component={Landing} />
      ) : isForbidden ? (
        <Route path="/" component={AccessDenied} />
      ) : !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/games" component={Games} />
          <Route path="/finances" component={Finances} />
          <Route path="/ticket-holders" component={TicketHolders} />
          <Route path="/seat-predictions" component={SeatPredictions} />
          <Route path="/reports" component={Reports} />
          <Route path="/seats" component={Seats} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SeasonProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </SeasonProvider>
    </QueryClientProvider>
  );
}

export default App;
