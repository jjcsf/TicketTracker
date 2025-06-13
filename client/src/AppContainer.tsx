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
  return (
    <Switch>
      <Route path="/auth" component={LocalAuthPage} />
      <Route path="/">
        <LocalProtectedRoute>
          <Dashboard />
        </LocalProtectedRoute>
      </Route>
      <Route path="/games">
        <LocalProtectedRoute>
          <Games />
        </LocalProtectedRoute>
      </Route>
      <Route path="/finances">
        <LocalProtectedRoute>
          <Finances />
        </LocalProtectedRoute>
      </Route>
      <Route path="/ticket-holders">
        <LocalProtectedRoute>
          <TicketHolders />
        </LocalProtectedRoute>
      </Route>
      <Route path="/seat-predictions">
        <LocalProtectedRoute>
          <SeatPredictions />
        </LocalProtectedRoute>
      </Route>
      <Route path="/reports">
        <LocalProtectedRoute>
          <Reports />
        </LocalProtectedRoute>
      </Route>
      <Route path="/seats">
        <LocalProtectedRoute>
          <Seats />
        </LocalProtectedRoute>
      </Route>
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