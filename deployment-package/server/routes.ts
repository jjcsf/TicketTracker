import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isAuthorizedOwner } from "./replitAuth";
import { ticketApiService } from "./services/ticketApiService";
import {
  insertTeamSchema,
  insertSeasonSchema,
  insertGameSchema,
  insertTicketHolderSchema,
  insertSeatSchema,
  insertSeatOwnershipSchema,
  insertPaymentSchema,
  insertPayoutSchema,
  insertTransferSchema,
  insertGameAttendanceSchema,
  insertGamePricingSchema,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, isAuthorizedOwner, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Team routes
  app.get("/api/teams", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const teams = await storage.getTeams();
      res.json(teams);
    } catch (error) {
      console.error("Error fetching teams:", error);
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  app.post("/api/teams", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const teamData = insertTeamSchema.parse(req.body);
      const team = await storage.createTeam(teamData);
      res.status(201).json(team);
    } catch (error) {
      console.error("Error creating team:", error);
      res.status(400).json({ message: "Failed to create team" });
    }
  });

  app.get("/api/teams/:id", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const team = await storage.getTeam(parseInt(req.params.id));
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      res.json(team);
    } catch (error) {
      console.error("Error fetching team:", error);
      res.status(500).json({ message: "Failed to fetch team" });
    }
  });

  // Season routes
  app.get("/api/seasons", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const seasons = await storage.getSeasons(teamId);
      res.json(seasons);
    } catch (error) {
      console.error("Error fetching seasons:", error);
      res.status(500).json({ message: "Failed to fetch seasons" });
    }
  });

  app.get("/api/seasons/:id", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const seasonId = parseInt(req.params.id);
      const season = await storage.getSeason(seasonId);
      if (!season) {
        return res.status(404).json({ message: "Season not found" });
      }
      res.json(season);
    } catch (error) {
      console.error("Error fetching season:", error);
      res.status(500).json({ message: "Failed to fetch season" });
    }
  });

  app.post("/api/seasons", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const seasonData = insertSeasonSchema.parse(req.body);
      const season = await storage.createSeason(seasonData);
      res.status(201).json(season);
    } catch (error) {
      console.error("Error creating season:", error);
      res.status(400).json({ message: "Failed to create season" });
    }
  });

  // Game routes
  app.get("/api/games", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const seasonId = req.query.seasonId ? parseInt(req.query.seasonId as string) : undefined;
      const games = await storage.getGames(seasonId);
      res.json(games);
    } catch (error) {
      console.error("Error fetching games:", error);
      res.status(500).json({ message: "Failed to fetch games" });
    }
  });

  app.post("/api/games", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const gameData = insertGameSchema.parse(req.body);
      const game = await storage.createGame(gameData);
      res.status(201).json(game);
    } catch (error) {
      console.error("Error creating game:", error);
      res.status(400).json({ message: "Failed to create game" });
    }
  });

  app.patch("/api/games/:id", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const gameData = insertGameSchema.partial().parse(req.body);
      const game = await storage.updateGame(parseInt(req.params.id), gameData);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      res.json(game);
    } catch (error) {
      console.error("Error updating game:", error);
      res.status(400).json({ message: "Failed to update game" });
    }
  });

  app.delete("/api/games/:id", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteGame(id);
      if (!success) {
        return res.status(404).json({ message: "Game not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting game:", error);
      res.status(500).json({ message: "Failed to delete game" });
    }
  });

  // Ticket Holder routes
  app.get("/api/ticket-holders", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const holders = await storage.getTicketHolders();
      res.json(holders);
    } catch (error) {
      console.error("Error fetching ticket holders:", error);
      res.status(500).json({ message: "Failed to fetch ticket holders" });
    }
  });

  app.post("/api/ticket-holders", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const holderData = insertTicketHolderSchema.parse(req.body);
      const holder = await storage.createTicketHolder(holderData);
      res.status(201).json(holder);
    } catch (error) {
      console.error("Error creating ticket holder:", error);
      res.status(400).json({ message: "Failed to create ticket holder" });
    }
  });

  app.patch("/api/ticket-holders/:id", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const holderData = insertTicketHolderSchema.partial().parse(req.body);
      const updatedHolder = await storage.updateTicketHolder(id, holderData);
      
      if (!updatedHolder) {
        return res.status(404).json({ message: "Ticket holder not found" });
      }
      
      res.json(updatedHolder);
    } catch (error) {
      console.error("Error updating ticket holder:", error);
      res.status(400).json({ message: "Failed to update ticket holder" });
    }
  });

  // Seat routes
  app.get("/api/seats", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const seats = await storage.getSeats(teamId);
      res.json(seats);
    } catch (error) {
      console.error("Error fetching seats:", error);
      res.status(500).json({ message: "Failed to fetch seats" });
    }
  });

  app.post("/api/seats", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      // Transform the data to match expected types before validation
      const transformedData = {
        ...req.body,
        teamId: parseInt(req.body.teamId),
        licenseCost: req.body.licenseCost ? req.body.licenseCost.toString() : null,
      };
      
      const seatData = insertSeatSchema.parse(transformedData);
      const seat = await storage.createSeat(seatData);
      res.status(201).json(seat);
    } catch (error) {
      console.error("Error creating seat:", error);
      res.status(400).json({ message: "Failed to create seat" });
    }
  });

  app.patch("/api/seats/:id", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      console.log("Original request body:", req.body);
      
      // Transform the data to match expected types before validation
      const transformedData = {
        ...req.body,
        teamId: req.body.teamId ? parseInt(req.body.teamId) : undefined,
        licenseCost: req.body.licenseCost ? req.body.licenseCost.toString() : null,
      };
      
      console.log("Transformed data:", transformedData);
      
      const seatData = insertSeatSchema.partial().parse(transformedData);
      const seat = await storage.updateSeat(parseInt(req.params.id), seatData);
      if (!seat) {
        return res.status(404).json({ message: "Seat not found" });
      }
      res.json(seat);
    } catch (error: any) {
      console.error("Error updating seat:", error);
      if (error.issues) {
        console.error("Validation issues:", error.issues);
      }
      res.status(400).json({ message: "Failed to update seat" });
    }
  });

  // Seat Ownership routes
  app.get("/api/seat-ownership", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const seasonId = req.query.seasonId ? parseInt(req.query.seasonId as string) : undefined;
      const ownerships = await storage.getSeatOwnerships(seasonId);
      res.json(ownerships);
    } catch (error) {
      console.error("Error fetching seat ownerships:", error);
      res.status(500).json({ message: "Failed to fetch seat ownerships" });
    }
  });

  app.post("/api/seat-ownership", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const ownershipData = insertSeatOwnershipSchema.parse(req.body);
      const ownership = await storage.createSeatOwnership(ownershipData);
      res.status(201).json(ownership);
    } catch (error) {
      console.error("Error creating seat ownership:", error);
      res.status(400).json({ message: "Failed to create seat ownership" });
    }
  });

  // Payment routes
  app.get("/api/payments", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const seasonId = req.query.seasonId ? parseInt(req.query.seasonId as string) : undefined;
      const payments = await storage.getPayments(seasonId);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching payments:", error);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.post("/api/payments", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const paymentData = insertPaymentSchema.parse(req.body);
      const payment = await storage.createPayment(paymentData);
      res.status(201).json(payment);
    } catch (error) {
      console.error("Error creating payment:", error);
      res.status(400).json({ message: "Failed to create payment" });
    }
  });

  app.put("/api/payments/:id", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const paymentData = insertPaymentSchema.parse(req.body);
      const payment = await storage.updatePayment(id, paymentData);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }
      res.json(payment);
    } catch (error) {
      console.error("Error updating payment:", error);
      res.status(400).json({ message: "Failed to update payment" });
    }
  });

  app.delete("/api/payments/:id", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid payment ID" });
      }
      
      const success = await storage.deletePayment(id);
      
      if (!success) {
        return res.status(404).json({ message: "Payment not found" });
      }
      
      res.json({ message: "Payment deleted successfully" });
    } catch (error) {
      console.error("Error deleting payment:", error);
      res.status(500).json({ message: "Failed to delete payment" });
    }
  });

  // Payout routes
  app.get("/api/payouts", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const gameId = req.query.gameId ? parseInt(req.query.gameId as string) : undefined;
      const ticketHolderId = req.query.ticketHolderId ? parseInt(req.query.ticketHolderId as string) : undefined;
      const payouts = await storage.getPayouts(gameId, ticketHolderId);
      res.json(payouts);
    } catch (error) {
      console.error("Error fetching payouts:", error);
      res.status(500).json({ message: "Failed to fetch payouts" });
    }
  });

  app.post("/api/payouts", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const payoutData = insertPayoutSchema.parse(req.body);
      const payout = await storage.createPayout(payoutData);
      res.status(201).json(payout);
    } catch (error) {
      console.error("Error creating payout:", error);
      res.status(400).json({ message: "Failed to create payout" });
    }
  });

  // Transfer routes
  app.get("/api/transfers", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const gameId = req.query.gameId ? parseInt(req.query.gameId as string) : undefined;
      const transfers = await storage.getTransfers(gameId);
      res.json(transfers);
    } catch (error) {
      console.error("Error fetching transfers:", error);
      res.status(500).json({ message: "Failed to fetch transfers" });
    }
  });

  app.post("/api/transfers", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const transferData = insertTransferSchema.parse(req.body);
      const transfer = await storage.createTransfer(transferData);
      res.status(201).json(transfer);
    } catch (error) {
      console.error("Error creating transfer:", error);
      res.status(400).json({ message: "Failed to create transfer" });
    }
  });

  app.patch("/api/transfers/:id/status", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const { status } = req.body;
      const transfer = await storage.updateTransferStatus(parseInt(req.params.id), status);
      if (!transfer) {
        return res.status(404).json({ message: "Transfer not found" });
      }
      res.json(transfer);
    } catch (error) {
      console.error("Error updating transfer status:", error);
      res.status(400).json({ message: "Failed to update transfer status" });
    }
  });

  // Game Attendance routes
  app.get("/api/game-attendance", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const gameId = req.query.gameId ? parseInt(req.query.gameId as string) : undefined;
      const attendance = await storage.getGameAttendance(gameId);
      res.json(attendance);
    } catch (error) {
      console.error("Error fetching game attendance:", error);
      res.status(500).json({ message: "Failed to fetch game attendance" });
    }
  });

  app.post("/api/game-attendance", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const attendanceData = insertGameAttendanceSchema.parse(req.body);
      const attendance = await storage.createGameAttendance(attendanceData);
      res.status(201).json(attendance);
    } catch (error) {
      console.error("Error creating game attendance:", error);
      res.status(400).json({ message: "Failed to create game attendance" });
    }
  });

  app.delete("/api/game-attendance/:id", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const attendanceId = parseInt(req.params.id);
      const success = await storage.deleteGameAttendance(attendanceId);
      if (!success) {
        return res.status(404).json({ message: "Attendance record not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting game attendance:", error);
      res.status(500).json({ message: "Failed to delete game attendance" });
    }
  });

  // Game Pricing routes
  app.get("/api/game-pricing", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const gameId = req.query.gameId ? parseInt(req.query.gameId as string) : undefined;
      const pricing = await storage.getGamePricing(gameId);
      res.json(pricing);
    } catch (error) {
      console.error("Error fetching game pricing:", error);
      res.status(500).json({ message: "Failed to fetch game pricing" });
    }
  });

  app.post("/api/game-pricing", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const pricingData = insertGamePricingSchema.parse(req.body);
      const pricing = await storage.upsertGamePricing(pricingData);
      res.json(pricing);
    } catch (error) {
      console.error("Error upserting game pricing:", error);
      res.status(400).json({ message: "Failed to upsert game pricing" });
    }
  });

  // Dashboard routes
  app.get("/api/dashboard/stats/:seasonId", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const seasonId = parseInt(req.params.seasonId);
      const stats = await storage.getDashboardStats(seasonId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/dashboard/financial-summary/:seasonId", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const seasonId = parseInt(req.params.seasonId);
      const summary = await storage.getFinancialSummary(seasonId);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching financial summary:", error);
      res.status(500).json({ message: "Failed to fetch financial summary" });
    }
  });

  app.get("/api/dashboard/ticket-holder-profits/:seasonId", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const seasonId = parseInt(req.params.seasonId);
      const profits = await storage.getTicketHolderProfits(seasonId);
      res.json(profits);
    } catch (error) {
      console.error("Error fetching ticket holder profits:", error);
      res.status(500).json({ message: "Failed to fetch ticket holder profits" });
    }
  });

  // Schedule import routes
  app.post("/api/schedule/preview", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const { teamName, year, includePreseason, includePostseason, homeGamesOnly } = req.body;
      
      console.log('Preview request received:', { teamName, year, includePreseason, includePostseason, homeGamesOnly });
      
      // NBA team mapping for ESPN API with variations
      const nbaTeamMap: { [key: string]: string } = {
        "Atlanta Hawks": "atl",
        "Hawks": "atl",
        "Boston Celtics": "bos",
        "Celtics": "bos",
        "Brooklyn Nets": "bkn",
        "Nets": "bkn",
        "Charlotte Hornets": "cha",
        "Hornets": "cha",
        "Chicago Bulls": "chi",
        "Bulls": "chi",
        "Cleveland Cavaliers": "cle",
        "Cavaliers": "cle",
        "Cavs": "cle",
        "Dallas Mavericks": "dal",
        "Mavericks": "dal",
        "Mavs": "dal",
        "Denver Nuggets": "den",
        "Nuggets": "den",
        "Detroit Pistons": "det",
        "Pistons": "det",
        "Golden State Warriors": "gs",
        "Warriors": "gs",
        "Houston Rockets": "hou",
        "Rockets": "hou",
        "Indiana Pacers": "ind",
        "Pacers": "ind",
        "Los Angeles Clippers": "lac",
        "Clippers": "lac",
        "Los Angeles Lakers": "lal",
        "Lakers": "lal",
        "Memphis Grizzlies": "mem",
        "Grizzlies": "mem",
        "Miami Heat": "mia",
        "Heat": "mia",
        "Milwaukee Bucks": "mil",
        "Bucks": "mil",
        "Minnesota Timberwolves": "min",
        "Timberwolves": "min",
        "Wolves": "min",
        "New Orleans Pelicans": "no",
        "Pelicans": "no",
        "New York Knicks": "ny",
        "Knicks": "ny",
        "Oklahoma City Thunder": "okc",
        "Thunder": "okc",
        "Orlando Magic": "orl",
        "Magic": "orl",
        "Philadelphia 76ers": "phi",
        "76ers": "phi",
        "Sixers": "phi",
        "Phoenix Suns": "phx",
        "Suns": "phx",
        "Portland Trail Blazers": "por",
        "Trail Blazers": "por",
        "Blazers": "por",
        "Sacramento Kings": "sac",
        "Kings": "sac",
        "San Antonio Spurs": "sa",
        "Spurs": "sa",
        "Toronto Raptors": "tor",
        "Raptors": "tor",
        "Utah Jazz": "utah",
        "Jazz": "utah",
        "Washington Wizards": "wsh",
        "Wizards": "wsh"
      };

      // ESPN API team mapping with variations
      const nflTeamMap: { [key: string]: string } = {
        "Arizona Cardinals": "ari",
        "Cardinals": "ari",
        "Atlanta Falcons": "atl",
        "Falcons": "atl",
        "Baltimore Ravens": "bal",
        "Ravens": "bal",
        "Buffalo Bills": "buf",
        "Bills": "buf",
        "Carolina Panthers": "car",
        "Panthers": "car",
        "Chicago Bears": "chi",
        "Bears": "chi",
        "Cincinnati Bengals": "cin",
        "Bengals": "cin",
        "Cleveland Browns": "cle",
        "Browns": "cle",
        "Dallas Cowboys": "dal",
        "Cowboys": "dal",
        "Denver Broncos": "den",
        "Broncos": "den",
        "Detroit Lions": "det",
        "Lions": "det",
        "Green Bay Packers": "gb",
        "Packers": "gb",
        "Houston Texans": "hou",
        "Texans": "hou",
        "Indianapolis Colts": "ind",
        "Colts": "ind",
        "Jacksonville Jaguars": "jax",
        "Jaguars": "jax",
        "Kansas City Chiefs": "kc",
        "Chiefs": "kc",
        "Las Vegas Raiders": "lv",
        "Raiders": "lv",
        "Los Angeles Chargers": "lac",
        "Chargers": "lac",
        "Los Angeles Rams": "lar",
        "Rams": "lar",
        "Miami Dolphins": "mia",
        "Dolphins": "mia",
        "Minnesota Vikings": "min",
        "Vikings": "min",
        "New England Patriots": "ne",
        "Patriots": "ne",
        "New Orleans Saints": "no",
        "Saints": "no",
        "New York Giants": "nyg",
        "Giants": "nyg",
        "New York Jets": "nyj",
        "Jets": "nyj",
        "Philadelphia Eagles": "phi",
        "Eagles": "phi",
        "Pittsburgh Steelers": "pit",
        "Steelers": "pit",
        "San Francisco 49ers": "sf",
        "49ers": "sf",
        "Niners": "sf",
        "Seattle Seahawks": "sea",
        "Seahawks": "sea",
        "Tampa Bay Buccaneers": "tb",
        "Buccaneers": "tb",
        "Bucs": "tb",
        "Tennessee Titans": "ten",
        "Titans": "ten",
        "Washington Commanders": "wsh",
        "Commanders": "wsh"
      };

      // Try to find team in NBA first, then NFL
      let espnTeamCode = null;
      let sport = null;
      
      console.log(`Searching for team "${teamName}"`);
      console.log('NBA team map keys:', Object.keys(nbaTeamMap).slice(0, 10)); // Show first 10 for debugging
      
      // Check NBA teams first
      espnTeamCode = nbaTeamMap[teamName];
      if (espnTeamCode) {
        sport = 'basketball';
        console.log(`Found exact NBA match: ${teamName} -> ${espnTeamCode}`);
      } else {
        // Try case-insensitive match for NBA
        const lowerTeamName = teamName.toLowerCase();
        console.log(`Trying case-insensitive search for: ${lowerTeamName}`);
        for (const [key, value] of Object.entries(nbaTeamMap)) {
          if (key.toLowerCase() === lowerTeamName || key.toLowerCase().includes(lowerTeamName)) {
            espnTeamCode = value;
            sport = 'basketball';
            console.log(`Found NBA case-insensitive match: ${key} -> ${value}`);
            break;
          }
        }
      }
      
      // If not found in NBA, try NFL
      if (!espnTeamCode) {
        console.log(`No NBA match found, trying NFL...`);
        espnTeamCode = nflTeamMap[teamName];
        if (espnTeamCode) {
          sport = 'football';
          console.log(`Found exact NFL match: ${teamName} -> ${espnTeamCode}`);
        } else {
          // Try case-insensitive match for NFL
          const lowerTeamName = teamName.toLowerCase();
          for (const [key, value] of Object.entries(nflTeamMap)) {
            if (key.toLowerCase() === lowerTeamName || key.toLowerCase().includes(lowerTeamName)) {
              espnTeamCode = value;
              sport = 'football';
              console.log(`Found NFL case-insensitive match: ${key} -> ${value}`);
              break;
            }
          }
        }
      }
      
      console.log(`Looking for team: "${teamName}", found code: ${espnTeamCode}, sport: ${sport}`);
      
      if (!espnTeamCode || !sport) {
        console.log('Available NBA teams:', Object.keys(nbaTeamMap));
        console.log('Available NFL teams:', Object.keys(nflTeamMap));
        return res.status(400).json({ 
          message: `Team "${teamName}" not supported for schedule import. Available teams include NFL and NBA teams. Examples: 49ers, Lakers, Warriors, Chiefs, etc.` 
        });
      }

      // Function to get team logo URL from ESPN
      const getTeamLogo = (teamName: string, sport: string) => {
        const baseUrl = sport === 'basketball' 
          ? 'https://a.espncdn.com/i/teamlogos/nba/500'
          : 'https://a.espncdn.com/i/teamlogos/nfl/500';
        
        // ESPN team abbreviations for logos
        const logoMap = sport === 'basketball' ? {
          'Atlanta Hawks': 'atl', 'Boston Celtics': 'bos', 'Brooklyn Nets': 'bkn', 'Charlotte Hornets': 'cha',
          'Chicago Bulls': 'chi', 'Cleveland Cavaliers': 'cle', 'Dallas Mavericks': 'dal', 'Denver Nuggets': 'den',
          'Detroit Pistons': 'det', 'Golden State Warriors': 'gs', 'Houston Rockets': 'hou', 'Indiana Pacers': 'ind',
          'Los Angeles Clippers': 'lac', 'LA Clippers': 'lac', 'Los Angeles Lakers': 'lal', 'LA Lakers': 'lal', 
          'Memphis Grizzlies': 'mem', 'Miami Heat': 'mia', 'Milwaukee Bucks': 'mil', 'Minnesota Timberwolves': 'min', 
          'New Orleans Pelicans': 'no', 'New York Knicks': 'ny', 'Oklahoma City Thunder': 'okc', 'Orlando Magic': 'orl', 
          'Philadelphia 76ers': 'phi', 'Phoenix Suns': 'phx', 'Portland Trail Blazers': 'por', 'Sacramento Kings': 'sac', 
          'San Antonio Spurs': 'sa', 'Toronto Raptors': 'tor', 'Utah Jazz': 'utah', 'Washington Wizards': 'wsh'
        } : {
          'Arizona Cardinals': 'ari', 'Atlanta Falcons': 'atl', 'Baltimore Ravens': 'bal', 'Buffalo Bills': 'buf',
          'Carolina Panthers': 'car', 'Chicago Bears': 'chi', 'Cincinnati Bengals': 'cin', 'Cleveland Browns': 'cle',
          'Dallas Cowboys': 'dal', 'Denver Broncos': 'den', 'Detroit Lions': 'det', 'Green Bay Packers': 'gb',
          'Houston Texans': 'hou', 'Indianapolis Colts': 'ind', 'Jacksonville Jaguars': 'jax', 'Kansas City Chiefs': 'kc',
          'Las Vegas Raiders': 'lv', 'Los Angeles Chargers': 'lac', 'Los Angeles Rams': 'lar', 'Miami Dolphins': 'mia',
          'Minnesota Vikings': 'min', 'New England Patriots': 'ne', 'New Orleans Saints': 'no', 'New York Giants': 'nyg',
          'New York Jets': 'nyj', 'Philadelphia Eagles': 'phi', 'Pittsburgh Steelers': 'pit', 'San Francisco 49ers': 'sf',
          'Seattle Seahawks': 'sea', 'Tampa Bay Buccaneers': 'tb', 'Tennessee Titans': 'ten', 'Washington Commanders': 'wsh'
        };
        
        const teamCode = logoMap[teamName as keyof typeof logoMap];
        return teamCode ? `${baseUrl}/${teamCode}.png` : null;
      };

      // Fetch schedule from ESPN API - use sport-specific endpoints
      let allEvents = [];
      const games = [];
      
      // Construct sport-specific ESPN URL
      const sportPath = sport === 'basketball' ? 'basketball/nba' : 'football/nfl';
      const mainUrl = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/teams/${espnTeamCode}/schedule?season=${year}`;
      
      // Fetch regular season (seasontype=2) and default schedule
      const mainResponse = await fetch(mainUrl);
      if (!mainResponse.ok) {
        throw new Error(`ESPN API error: ${mainResponse.status}`);
      }
      
      const mainData = await mainResponse.json();
      allEvents = mainData.events || [];
      console.log(`Main schedule returned ${allEvents.length} events`);
      
      // Also try explicit regular season (seasontype=2) to ensure we get all games
      try {
        const regularSeasonUrl = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/teams/${espnTeamCode}/schedule?season=${year}&seasontype=2`;
        console.log(`Fetching regular season from: ${regularSeasonUrl}`);
        const regularResponse = await fetch(regularSeasonUrl);
        if (regularResponse.ok) {
          const regularData = await regularResponse.json();
          const regularEvents = regularData.events || [];
          
          regularEvents.forEach((event: any) => {
            if (!allEvents.find((e: any) => e.id === event.id)) {
              allEvents.push(event);
            }
          });
          console.log(`Added ${regularEvents.length} regular season events, total now: ${allEvents.length}`);
        }
      } catch (error) {
        console.warn(`Failed to fetch explicit regular season:`, error instanceof Error ? error.message : String(error));
      }
      
      // Handle preseason for both sports
      if (includePreseason) {
        try {
          // For NBA, preseason is seasontype=1, for NFL it's also seasontype=1
          const preseasonUrl = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/teams/${espnTeamCode}/schedule?season=${year}&seasontype=1`;
          const preseasonResponse = await fetch(preseasonUrl);
          if (preseasonResponse.ok) {
            const preseasonData = await preseasonResponse.json();
            const preseasonEvents = preseasonData.events || [];
            
            preseasonEvents.forEach((event: any) => {
              if (!allEvents.find((e: any) => e.id === event.id)) {
                // Mark preseason events explicitly
                event._isPreseason = true;
                allEvents.push(event);
              }
            });
            console.log(`Added ${preseasonEvents.length} preseason events for ${sport}`);
          }
        } catch (error) {
          console.warn(`Failed to fetch preseason for ${sport}:`, error instanceof Error ? error.message : String(error));
        }
      }
      
      // Handle postseason for both sports
      if (includePostseason) {
        // Try multiple season types for postseason coverage
        const postseasonTypes = sport === 'basketball' ? [3, 4] : [3, 4]; // 3=playoffs, 4=championship/finals
        
        for (const seasonType of postseasonTypes) {
          try {
            const postseasonUrl = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/teams/${espnTeamCode}/schedule?season=${year}&seasontype=${seasonType}`;
            console.log(`Fetching postseason type ${seasonType} from: ${postseasonUrl}`);
            const postseasonResponse = await fetch(postseasonUrl);
            if (postseasonResponse.ok) {
              const postseasonData = await postseasonResponse.json();
              const postseasonEvents = postseasonData.events || [];
              
              postseasonEvents.forEach((event: any) => {
                const existingEvent = allEvents.find((e: any) => e.id === event.id);
                if (!existingEvent) {
                  // Mark postseason events explicitly
                  event._isPostseason = true;
                  allEvents.push(event);
                  console.log(`Added new postseason event ${event.id}`);
                } else {
                  // Mark existing event as postseason
                  existingEvent._isPostseason = true;
                  console.log(`Marked existing event ${event.id} as postseason`);
                }
              });
              console.log(`Added ${postseasonEvents.length} postseason events from seasontype=${seasonType} for ${sport}`);
            } else {
              console.log(`No postseason data available for seasontype=${seasonType} (status: ${postseasonResponse.status})`);
            }
          } catch (error) {
            console.warn(`Failed to fetch postseason seasontype=${seasonType} for ${sport}:`, error instanceof Error ? error.message : String(error));
          }
        }
      }
      
      const espnData = { events: allEvents };
      console.log(`ESPN API returned ${allEvents.length} total events for ${teamName} ${year} (${sport})`);

      if (espnData.events) {
        for (const event of espnData.events) {
          const competition = event.competitions[0];
          if (!competition || !competition.competitors) continue;
          
          const homeTeam = competition.competitors.find((comp: any) => comp.homeAway === 'home');
          const awayTeam = competition.competitors.find((comp: any) => comp.homeAway === 'away');
          
          if (!homeTeam || !awayTeam) continue;
          
          const isHome = homeTeam.team.abbreviation.toLowerCase() === espnTeamCode;
          const opponent = isHome ? awayTeam.team.displayName : homeTeam.team.displayName;
          
          // Filter by home games if requested
          if (homeGamesOnly && !isHome) {
            continue;
          }

          // Determine season type - check multiple possible locations
          let seasonType = 'Regular Season';
          
          // Debug logging for season type detection
          const eventId = event.id;
          const hasPreseasonFlag = !!(event as any)._isPreseason;
          const hasPostseasonFlag = !!(event as any)._isPostseason;
          const eventSeasonType = event.season?.type;
          const competitionSeasonType = competition.season?.type;
          
          if (hasPostseasonFlag || hasPreseasonFlag) {
            console.log(`Event ${eventId}: _isPreseason=${hasPreseasonFlag}, _isPostseason=${hasPostseasonFlag}, eventSeasonType=${eventSeasonType}, competitionSeasonType=${competitionSeasonType}`);
          }
          
          // First check if this event was explicitly marked as preseason or postseason
          if ((event as any)._isPreseason) {
            seasonType = 'Preseason';
          } else if ((event as any)._isPostseason) {
            seasonType = 'Postseason';
          } else {
            // Check event.season.type
            if (event.season && event.season.type) {
              switch (event.season.type) {
                case 1:
                  seasonType = 'Preseason';
                  break;
                case 2:
                  seasonType = 'Regular Season';
                  break;
                case 3:
                  seasonType = 'Postseason';
                  break;
              }
            }
            
            // Also check competition.season.type as backup
            if (seasonType === 'Regular Season' && competition.season && competition.season.type) {
              switch (competition.season.type) {
                case 1:
                  seasonType = 'Preseason';
                  break;
                case 2:
                  seasonType = 'Regular Season';
                  break;
                case 3:
                  seasonType = 'Postseason';
                  break;
              }
            }
            
            // Check for preseason indicators in the name/notes
            if (seasonType === 'Regular Season') {
              const notes = competition.notes?.[0]?.headline || '';
              const competitionName = competition.name || '';
              if (notes.toLowerCase().includes('preseason') || competitionName.toLowerCase().includes('preseason')) {
                seasonType = 'Preseason';
              } else if (notes.toLowerCase().includes('playoff') || competitionName.toLowerCase().includes('playoff')) {
                seasonType = 'Postseason';
              }
            }
          }

          
          // Filter by season type preferences
          if (seasonType === 'Preseason' && !includePreseason) continue;
          if (seasonType === 'Postseason' && !includePostseason) continue;

          // Parse the complete date/time from ESPN API
          const gameDateTime = new Date(event.date);
          
          // Store the full ISO datetime string to preserve timezone information
          let time = null;
          try {
            // Extract time in 24-hour format, preserving the original timezone
            time = gameDateTime.toISOString();
          } catch (error) {
            console.warn('Failed to parse datetime for game:', event.date);
            time = null;
          }

          const opponentLogo = getTeamLogo(opponent, sport);
          console.log(`Opponent: "${opponent}" -> Logo: ${opponentLogo}`);
          
          games.push({
            date: gameDateTime.toISOString().split('T')[0],
            time: time,
            opponent: opponent,
            opponentLogo: opponentLogo,
            seasonType: seasonType,
            isHome: isHome,
            venue: competition.venue?.fullName || '',
          });
        }
      }

      console.log(`Filtered to ${games.length} games matching criteria`);
      
      if (games.length === 0) {
        const currentYear = new Date().getFullYear();
        let message = '';
        
        if (year > currentYear) {
          message = `The ${year} NFL schedule for ${teamName} has not been released yet. The NFL typically releases schedules in April-May. You can import the ${currentYear} season schedule or check back later for ${year} data.`;
        } else if (year < currentYear - 1) {
          message = `No games found for ${teamName} ${year} season. Historical data may be limited. Try importing a more recent season (${currentYear} or ${currentYear - 1}).`;
        } else {
          message = `No games found for ${teamName} ${year} season with the selected criteria. Try including preseason/postseason games or removing the "home games only" filter.`;
        }
        
        return res.json({
          games: [],
          message: message
        });
      }

      res.json(games);
    } catch (error) {
      console.error("Error fetching schedule from ESPN:", error);
      res.status(500).json({ message: "Failed to fetch schedule from ESPN API" });
    }
  });

  app.post("/api/schedule/import", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const { seasonId, games } = req.body;
      
      if (!seasonId || !Array.isArray(games)) {
        return res.status(400).json({ message: "Invalid request data" });
      }

      const importedGames = [];
      
      for (const gameData of games) {
        const newGame = {
          seasonId: seasonId,
          date: gameData.date,
          time: gameData.time || null,
          opponent: gameData.opponent,
          opponentLogo: gameData.opponentLogo || null,
          seasonType: gameData.seasonType || 'Regular Season',
          isHome: gameData.isHome !== undefined ? gameData.isHome : true,
          venue: gameData.venue || null,
          notes: null,
        };

        const game = await storage.createGame(newGame);
        importedGames.push(game);
      }

      res.status(201).json({ 
        message: `Successfully imported ${importedGames.length} games`,
        games: importedGames 
      });
    } catch (error) {
      console.error("Error importing schedule:", error);
      res.status(500).json({ message: "Failed to import schedule" });
    }
  });

  // Season data import/export routes
  app.post("/api/seasons/import", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const { seasonId, csvData } = req.body;
      
      if (!seasonId || !csvData) {
        return res.status(400).json({ message: "Season ID and CSV data are required" });
      }

      // Parse CSV data
      const lines = csvData.trim().split('\n');
      if (lines.length < 2) {
        return res.status(400).json({ message: "CSV must contain header and at least one data row" });
      }

      const headers = lines[0].split(',').map((h: string) => h.replace(/"/g, '').trim());
      const dataRows = lines.slice(1);

      let updatedPricing = 0;
      const pricingUpdates: any[] = [];

      // Get all ticket holders to map names to IDs
      const ticketHolders = await storage.getTicketHolders();
      const seatOwnerships = await storage.getSeatOwnerships(seasonId);

      for (const row of dataRows) {
        const values = row.split(',').map((v: string) => v.replace(/"/g, '').trim());
        
        if (values.length !== headers.length) continue;
        
        const rowData: any = {};
        headers.forEach((header: string, index: number) => {
          rowData[header] = values[index];
        });

        // Skip empty rows or rows without required data
        if (!rowData['Game ID']) continue;

        const gameId = parseInt(rowData['Game ID']);
        if (!gameId) continue;

        // Process owner-specific columns (format: "OwnerName - Cost" or "OwnerName - Sold Price")
        for (const header of headers) {
          if (header.includes(' - Cost') || header.includes(' - Sold Price')) {
            const ownerName = header.replace(/ - (Cost|Sold Price)$/, '');
            const isPrice = header.includes(' - Sold Price');
            const value = rowData[header];
            
            if (!value || !ownerName) continue;
            
            // Find ticket holder by name
            const ticketHolder = ticketHolders.find(th => th.name === ownerName);
            if (!ticketHolder) continue;
            
            // Find all seats owned by this ticket holder for this season
            const ownerSeats = seatOwnerships.filter(so => 
              so.seasonId === seasonId && so.ticketHolderId === ticketHolder.id
            );
            
            // Update pricing for each seat owned by this ticket holder
            for (const seatOwnership of ownerSeats) {
              try {
                // Get existing pricing or create new
                const existingPricing = await storage.getGamePricing(gameId);
                const seatPricing = existingPricing.find(gp => gp.seatId === seatOwnership.seatId);
                
                const pricingData = {
                  gameId,
                  seatId: seatOwnership.seatId,
                  cost: isPrice ? (seatPricing?.cost || null) : value,
                  soldPrice: isPrice ? value : (seatPricing?.soldPrice || null),
                };

                await storage.upsertGamePricing(pricingData);
                pricingUpdates.push({ 
                  gameId, 
                  seatId: seatOwnership.seatId, 
                  owner: ownerName,
                  field: isPrice ? 'soldPrice' : 'cost',
                  value 
                });
                updatedPricing++;
              } catch (error) {
                console.warn(`Failed to update pricing for game ${gameId}, seat ${seatOwnership.seatId}, owner ${ownerName}:`, error);
              }
            }
          }
        }
      }

      res.json({
        message: `Successfully imported ${updatedPricing} pricing records`,
        updatedPricing,
        details: pricingUpdates
      });

    } catch (error) {
      console.error("Error importing season data:", error);
      res.status(500).json({ message: "Failed to import season data" });
    }
  });

  // Team Performance routes
  app.get("/api/team-performance", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const seasonId = req.query.seasonId ? parseInt(req.query.seasonId as string) : undefined;
      const performance = await storage.getTeamPerformance(teamId, seasonId);
      res.json(performance);
    } catch (error) {
      console.error("Error fetching team performance:", error);
      res.status(500).json({ message: "Failed to fetch team performance" });
    }
  });

  app.post("/api/team-performance/calculate", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const { teamId, seasonId } = req.body;
      if (!teamId || !seasonId) {
        return res.status(400).json({ message: "Team ID and Season ID are required" });
      }
      const performance = await storage.calculateTeamPerformance(teamId, seasonId);
      res.json(performance);
    } catch (error) {
      console.error("Error calculating team performance:", error);
      res.status(500).json({ message: "Failed to calculate team performance" });
    }
  });

  // Seat Value Prediction routes
  app.get("/api/seat-predictions", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const seatId = req.query.seatId ? parseInt(req.query.seatId as string) : undefined;
      const seasonId = req.query.seasonId ? parseInt(req.query.seasonId as string) : undefined;
      const predictions = await storage.getSeatValuePredictions(seatId, seasonId);
      res.json(predictions);
    } catch (error) {
      console.error("Error fetching seat predictions:", error);
      res.status(500).json({ message: "Failed to fetch seat predictions" });
    }
  });

  app.post("/api/seat-predictions/calculate", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const { seasonId } = req.body;
      if (!seasonId) {
        return res.status(400).json({ message: "Season ID is required" });
      }
      const predictions = await storage.calculateSeatValuePredictions(seasonId);
      res.json(predictions);
    } catch (error) {
      console.error("Error calculating seat predictions:", error);
      res.status(500).json({ message: "Failed to calculate seat predictions" });
    }
  });

  app.get("/api/seat-predictions/:seatId/:seasonId", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const seatId = parseInt(req.params.seatId);
      const seasonId = parseInt(req.params.seasonId);
      const prediction = await storage.getPredictedSeatValue(seatId, seasonId);
      
      if (!prediction) {
        return res.status(404).json({ message: "Prediction not found" });
      }
      
      res.json(prediction);
    } catch (error) {
      console.error("Error fetching predicted seat value:", error);
      res.status(500).json({ message: "Failed to fetch predicted seat value" });
    }
  });

  app.get("/api/seat-predictions/:seatId/:seasonId/similar-prices", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const seatId = parseInt(req.params.seatId);
      const seasonId = parseInt(req.params.seasonId);
      
      // Get internal pricing data
      const internalPrices = await storage.getSimilarTicketPrices(seatId, seasonId);
      
      // If external APIs are configured, enhance with live market data
      if (ticketApiService.isConfigured()) {
        const seat = await storage.getSeat(seatId);
        const season = await storage.getSeason(seasonId);
        
        if (seat && season) {
          const team = await storage.getTeam(season.teamId);
          if (team) {
            // Enhance each game's data with live market pricing
            for (const gameData of internalPrices) {
              try {
                const marketData = await ticketApiService.getMarketDataForGame(
                  team.name,
                  gameData.opponent,
                  gameData.gameDate,
                  seat.section
                );
                
                // Add live market listings to the response
                if (marketData.listings && marketData.listings.length > 0) {
                  const liveMarketSeats = marketData.listings.map(listing => ({
                    seatId: -1, // Indicates external data
                    section: listing.section,
                    row: listing.row,
                    number: `${listing.quantity} tickets`,
                    currentPrice: listing.price.toString(),
                    sold: false,
                    marketplace: listing.marketplace,
                    seller: listing.seller,
                    url: listing.url
                  }));
                  
                  // Merge with internal data
                  gameData.similarSeats = [...gameData.similarSeats, ...liveMarketSeats];
                  
                  // Sort by price
                  gameData.similarSeats.sort((a, b) => 
                    parseFloat(a.currentPrice) - parseFloat(b.currentPrice)
                  );
                }
              } catch (error) {
                console.warn(`Failed to fetch live market data for game ${gameData.gameId}:`, error);
                // Continue with internal data only
              }
            }
          }
        }
      }
      
      res.json(internalPrices);
    } catch (error) {
      console.error("Error fetching similar ticket prices:", error);
      res.status(500).json({ message: "Failed to fetch similar ticket prices" });
    }
  });

  // API configuration status endpoint
  app.get("/api/external-api/status", isAuthenticated, async (req, res) => {
    try {
      const status = ticketApiService.getConfigurationStatus();
      res.json(status);
    } catch (error) {
      console.error("Error fetching API configuration status:", error);
      res.status(500).json({ message: "Failed to fetch API configuration status" });
    }
  });

  // Report routes
  app.get("/api/reports/season-summary", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const reports = await storage.getSeasonSummaryReport(teamId);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching season summary report:", error);
      res.status(500).json({ message: "Failed to fetch season summary report" });
    }
  });

  app.get("/api/reports/seat-license-investments", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const investments = await storage.getSeatLicenseInvestmentSummary(teamId);
      res.json(investments);
    } catch (error) {
      console.error("Error fetching seat license investments:", error);
      res.status(500).json({ message: "Failed to fetch seat license investments" });
    }
  });

  app.get("/api/reports/owner-balances", isAuthenticated, isAuthorizedOwner, async (req, res) => {
    try {
      const ownerBalances = await storage.getOwnerBalances();
      res.json(ownerBalances);
    } catch (error) {
      console.error("Error fetching owner balances:", error);
      res.status(500).json({ message: "Failed to fetch owner balances" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
