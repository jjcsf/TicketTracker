import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

// Container-specific routes without complex authentication
export async function registerContainerRoutes(app: Express): Promise<Server> {
  
  // Mock authentication for container deployment
  app.get('/api/auth/user', (req, res) => {
    res.json({
      id: "container-admin",
      email: "admin@season-tickets.local",
      firstName: "Season Ticket",
      lastName: "Manager"
    });
  });

  app.get('/api/login', (req, res) => {
    res.redirect('/');
  });

  app.get('/api/logout', (req, res) => {
    res.redirect('/');
  });

  // All data API endpoints
  app.get('/api/teams', async (req, res) => {
    try {
      const teams = await storage.getTeams();
      res.json(teams);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  app.get('/api/seasons', async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const seasons = await storage.getSeasons(teamId);
      res.json(seasons);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch seasons" });
    }
  });

  app.get('/api/games', async (req, res) => {
    try {
      const seasonId = req.query.seasonId ? parseInt(req.query.seasonId as string) : undefined;
      const games = await storage.getGames(seasonId);
      res.json(games);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch games" });
    }
  });

  app.get('/api/ticket-holders', async (req, res) => {
    try {
      const holders = await storage.getTicketHolders();
      res.json(holders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch ticket holders" });
    }
  });

  app.get('/api/seats', async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const seats = await storage.getSeats(teamId);
      res.json(seats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch seats" });
    }
  });

  app.get('/api/seat-ownership', async (req, res) => {
    try {
      const seasonId = req.query.seasonId ? parseInt(req.query.seasonId as string) : undefined;
      const ownership = await storage.getSeatOwnerships(seasonId);
      res.json(ownership);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch seat ownership" });
    }
  });

  app.get('/api/payments', async (req, res) => {
    try {
      const seasonId = req.query.seasonId ? parseInt(req.query.seasonId as string) : undefined;
      const payments = await storage.getPayments(seasonId);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.get('/api/payouts', async (req, res) => {
    try {
      const gameId = req.query.gameId ? parseInt(req.query.gameId as string) : undefined;
      const ticketHolderId = req.query.ticketHolderId ? parseInt(req.query.ticketHolderId as string) : undefined;
      const payouts = await storage.getPayouts(gameId, ticketHolderId);
      res.json(payouts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payouts" });
    }
  });

  app.get('/api/transfers', async (req, res) => {
    try {
      const gameId = req.query.gameId ? parseInt(req.query.gameId as string) : undefined;
      const transfers = await storage.getTransfers(gameId);
      res.json(transfers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transfers" });
    }
  });

  app.get('/api/game-attendance', async (req, res) => {
    try {
      const gameId = req.query.gameId ? parseInt(req.query.gameId as string) : undefined;
      const attendance = await storage.getGameAttendance(gameId);
      res.json(attendance);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch game attendance" });
    }
  });

  app.get('/api/game-pricing', async (req, res) => {
    try {
      const gameId = req.query.gameId ? parseInt(req.query.gameId as string) : undefined;
      const pricing = await storage.getGamePricing(gameId);
      res.json(pricing);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch game pricing" });
    }
  });

  app.get('/api/dashboard/stats/:seasonId', async (req, res) => {
    try {
      const seasonId = parseInt(req.params.seasonId);
      const stats = await storage.getDashboardStats(seasonId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  app.get('/api/dashboard/financial-summary/:seasonId', async (req, res) => {
    try {
      const seasonId = parseInt(req.params.seasonId);
      const summary = await storage.getFinancialSummary(seasonId);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch financial summary" });
    }
  });

  app.get('/api/dashboard/ticket-holder-profits/:seasonId', async (req, res) => {
    try {
      const seasonId = parseInt(req.params.seasonId);
      const profits = await storage.getTicketHolderProfits(seasonId);
      res.json(profits);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch ticket holder profits" });
    }
  });

  app.get('/api/team-performance', async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const seasonId = req.query.seasonId ? parseInt(req.query.seasonId as string) : undefined;
      const performance = await storage.getTeamPerformance(teamId, seasonId);
      res.json(performance);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch team performance" });
    }
  });

  app.get('/api/seat-value-predictions', async (req, res) => {
    try {
      const seatId = req.query.seatId ? parseInt(req.query.seatId as string) : undefined;
      const seasonId = req.query.seasonId ? parseInt(req.query.seasonId as string) : undefined;
      const predictions = await storage.getSeatValuePredictions(seatId, seasonId);
      res.json(predictions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch seat value predictions" });
    }
  });

  app.get('/api/reports/season-summary', async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const report = await storage.getSeasonSummaryReport(teamId);
      res.json(report);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch season summary report" });
    }
  });

  app.get('/api/reports/seat-license-investment', async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const report = await storage.getSeatLicenseInvestmentSummary(teamId);
      res.json(report);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch seat license investment summary" });
    }
  });

  app.get('/api/owner-balances', async (req, res) => {
    try {
      const balances = await storage.getOwnerBalances();
      res.json(balances);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch owner balances" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}