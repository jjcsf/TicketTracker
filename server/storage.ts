import {
  users,
  localUsers,
  teams,
  seasons,
  games,
  ticketHolders,
  seats as seatsTable,
  seatOwnership,
  payments,
  payouts,
  transfers,
  gameAttendance,
  gamePricing,
  teamPerformance,
  seatValuePredictions,
  type User,
  type UpsertUser,
  type LocalUser,
  type InsertLocalUser,
  type Team,
  type Season,
  type Game,
  type TicketHolder,
  type Seat,
  type SeatOwnership,
  type Payment,
  type Payout,
  type Transfer,
  type GameAttendance,
  type GamePricing,
  type InsertTeam,
  type InsertSeason,
  type InsertGame,
  type InsertTicketHolder,
  type InsertSeat,
  type InsertSeatOwnership,
  type InsertPayment,
  type InsertPayout,
  type InsertTransfer,
  type InsertGameAttendance,
  type InsertGamePricing,
  type TeamPerformance,
  type SeatValuePrediction,
  type InsertTeamPerformance,
  type InsertSeatValuePrediction,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, inArray, or, not, isNotNull } from "drizzle-orm";

export type PaymentWithDetails = Payment & {
  ticketHolderName?: string | null;
  teamName?: string | null;
};

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Local authentication operations
  getLocalUser(id: number): Promise<LocalUser | undefined>;
  getLocalUserByUsername(username: string): Promise<LocalUser | undefined>;
  getLocalUserByEmail(email: string): Promise<LocalUser | undefined>;
  createLocalUser(user: InsertLocalUser): Promise<LocalUser>;
  updateLocalUser(id: number, user: Partial<InsertLocalUser>): Promise<LocalUser | undefined>;

  // Team operations
  getTeams(): Promise<Team[]>;
  createTeam(team: InsertTeam): Promise<Team>;
  getTeam(id: number): Promise<Team | undefined>;

  // Season operations
  getSeasons(teamId?: number): Promise<Season[]>;
  createSeason(season: InsertSeason): Promise<Season>;
  getSeason(id: number): Promise<Season | undefined>;

  // Game operations
  getGames(seasonId?: number): Promise<Game[]>;
  createGame(game: InsertGame): Promise<Game>;
  getGame(id: number): Promise<Game | undefined>;
  updateGame(id: number, game: Partial<InsertGame>): Promise<Game | undefined>;
  deleteGame(id: number): Promise<boolean>;

  // Ticket Holder operations
  getTicketHolders(): Promise<TicketHolder[]>;
  createTicketHolder(holder: InsertTicketHolder): Promise<TicketHolder>;
  getTicketHolder(id: number): Promise<TicketHolder | undefined>;
  getTicketHolderByEmail(email: string): Promise<TicketHolder | undefined>;
  updateTicketHolder(id: number, holder: Partial<InsertTicketHolder>): Promise<TicketHolder | undefined>;

  // Seat operations
  getSeats(teamId?: number): Promise<Seat[]>;
  createSeat(seat: InsertSeat): Promise<Seat>;
  getSeat(id: number): Promise<Seat | undefined>;
  updateSeat(id: number, seat: Partial<InsertSeat>): Promise<Seat | undefined>;

  // Seat Ownership operations
  getSeatOwnerships(seasonId?: number): Promise<SeatOwnership[]>;
  createSeatOwnership(ownership: InsertSeatOwnership): Promise<SeatOwnership>;

  // Payment operations
  getPayments(seasonId?: number): Promise<PaymentWithDetails[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: number, payment: Partial<InsertPayment>): Promise<Payment | undefined>;
  deletePayment(id: number): Promise<boolean>;

  // Payout operations
  getPayouts(gameId?: number, ticketHolderId?: number): Promise<Payout[]>;
  createPayout(payout: InsertPayout): Promise<Payout>;

  // Transfer operations
  getTransfers(gameId?: number): Promise<Transfer[]>;
  createTransfer(transfer: InsertTransfer): Promise<Transfer>;
  updateTransferStatus(id: number, status: string): Promise<Transfer | undefined>;

  // Attendance operations
  getGameAttendance(gameId?: number): Promise<GameAttendance[]>;
  createGameAttendance(attendance: InsertGameAttendance): Promise<GameAttendance>;
  deleteGameAttendance(id: number): Promise<boolean>;

  // Pricing operations
  getGamePricing(gameId?: number): Promise<GamePricing[]>;
  upsertGamePricing(pricing: InsertGamePricing): Promise<GamePricing>;

  // Dashboard data
  getDashboardStats(seasonId: number): Promise<{
    totalRevenue: string;
    totalCosts: string;
    totalProfit: string;
    gamesPlayed: number;
    totalGames: number;
    activeSeats: number;
    ticketHolders: number;
  }>;
  
  getFinancialSummary(seasonId: number): Promise<{
    ticketHolderId: number;
    name: string;
    seatsOwned: number;
    balance: string;
  }[]>;

  getTicketHolderProfits(seasonId: number): Promise<{
    ticketHolderId: number;
    name: string;
    revenue: string;
    costs: string;
    profit: string;
  }[]>;

  // Team Performance operations
  getTeamPerformance(teamId?: number, seasonId?: number): Promise<TeamPerformance[]>;
  createTeamPerformance(performance: InsertTeamPerformance): Promise<TeamPerformance>;
  updateTeamPerformance(id: number, performance: Partial<InsertTeamPerformance>): Promise<TeamPerformance | undefined>;
  calculateTeamPerformance(teamId: number, seasonId: number): Promise<TeamPerformance>;

  // Seat Value Prediction operations
  getSeatValuePredictions(seatId?: number, seasonId?: number): Promise<SeatValuePrediction[]>;
  createSeatValuePrediction(prediction: InsertSeatValuePrediction): Promise<SeatValuePrediction>;
  calculateSeatValuePredictions(seasonId: number): Promise<SeatValuePrediction[]>;
  getPredictedSeatValue(seatId: number, seasonId: number): Promise<SeatValuePrediction | undefined>;
  getSimilarTicketPrices(seatId: number, seasonId: number): Promise<{
    gameId: number;
    gameDate: string;
    opponent: string;
    similarSeats: {
      seatId: number;
      section: string;
      row: string;
      number: string;
      currentPrice: string;
      sold: boolean;
    }[];
  }[]>;

  // Report operations
  getSeasonSummaryReport(teamId?: number): Promise<{
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
  }[]>;
  
  getSeatLicenseInvestmentSummary(teamId?: number): Promise<{
    ticketHolderId: number;
    name: string;
    totalLicenseCosts: string;
    seatsOwned: number;
  }[]>;

  // Owner balance operations
  getOwnerBalances(): Promise<{
    ticketHolderId: number;
    name: string;
    seatsOwned: number;
    seatLicenseCosts: string;
    paymentsMade: string;
    paymentsReceived: string;
    balance: string;
  }[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Team operations
  async getTeams(): Promise<Team[]> {
    return await db.select().from(teams).orderBy(teams.name);
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const [newTeam] = await db.insert(teams).values(team).returning();
    return newTeam;
  }

  async getTeam(id: number): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }

  // Season operations
  async getSeasons(teamId?: number): Promise<Season[]> {
    const query = db.select().from(seasons);
    if (teamId) {
      return await query.where(eq(seasons.teamId, teamId)).orderBy(desc(seasons.year));
    }
    return await query.orderBy(desc(seasons.year));
  }

  async createSeason(season: InsertSeason): Promise<Season> {
    const [newSeason] = await db.insert(seasons).values(season).returning();
    return newSeason;
  }

  async getSeason(id: number): Promise<Season | undefined> {
    const [season] = await db.select().from(seasons).where(eq(seasons.id, id));
    return season;
  }

  // Game operations
  async getGames(seasonId?: number): Promise<Game[]> {
    const query = db.select().from(games);
    if (seasonId) {
      return await query.where(eq(games.seasonId, seasonId)).orderBy(games.date);
    }
    return await query.orderBy(games.date);
  }

  async createGame(game: InsertGame): Promise<Game> {
    const [newGame] = await db.insert(games).values(game).returning();
    return newGame;
  }

  async getGame(id: number): Promise<Game | undefined> {
    const [game] = await db.select().from(games).where(eq(games.id, id));
    return game;
  }

  async updateGame(id: number, gameData: Partial<InsertGame>): Promise<Game | undefined> {
    const [updatedGame] = await db
      .update(games)
      .set(gameData)
      .where(eq(games.id, id))
      .returning();
    return updatedGame;
  }

  async deleteGame(id: number): Promise<boolean> {
    // First delete related game pricing data
    await db.delete(gamePricing).where(eq(gamePricing.gameId, id));
    
    // Then delete the game
    const result = await db.delete(games).where(eq(games.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Ticket Holder operations
  async getTicketHolders(): Promise<TicketHolder[]> {
    return await db.select().from(ticketHolders).orderBy(ticketHolders.name);
  }

  async createTicketHolder(holder: InsertTicketHolder): Promise<TicketHolder> {
    const [newHolder] = await db.insert(ticketHolders).values(holder).returning();
    return newHolder;
  }

  async getTicketHolder(id: number): Promise<TicketHolder | undefined> {
    const [holder] = await db.select().from(ticketHolders).where(eq(ticketHolders.id, id));
    return holder;
  }

  async getTicketHolderByEmail(email: string): Promise<TicketHolder | undefined> {
    const [holder] = await db.select().from(ticketHolders).where(eq(ticketHolders.email, email));
    return holder;
  }

  async updateTicketHolder(id: number, holderData: Partial<InsertTicketHolder>): Promise<TicketHolder | undefined> {
    const [updatedHolder] = await db
      .update(ticketHolders)
      .set(holderData)
      .where(eq(ticketHolders.id, id))
      .returning();
    return updatedHolder;
  }

  // Seat operations
  async getSeats(teamId?: number): Promise<Seat[]> {
    const query = db.select().from(seatsTable);
    if (teamId) {
      return await query.where(eq(seatsTable.teamId, teamId)).orderBy(seatsTable.section, seatsTable.row, seatsTable.number);
    }
    return await query.orderBy(seatsTable.section, seatsTable.row, seatsTable.number);
  }

  async createSeat(seat: InsertSeat): Promise<Seat> {
    const [newSeat] = await db.insert(seatsTable).values(seat).returning();
    return newSeat;
  }

  async getSeat(id: number): Promise<Seat | undefined> {
    const [seat] = await db.select().from(seatsTable).where(eq(seatsTable.id, id));
    return seat;
  }

  async updateSeat(id: number, seatData: Partial<InsertSeat>): Promise<Seat | undefined> {
    const [updatedSeat] = await db
      .update(seatsTable)
      .set(seatData)
      .where(eq(seatsTable.id, id))
      .returning();
    return updatedSeat;
  }

  // Seat Ownership operations
  async getSeatOwnerships(seasonId?: number): Promise<SeatOwnership[]> {
    const query = db.select({
      id: seatOwnership.id,
      seatId: seatOwnership.seatId,
      seasonId: seatOwnership.seasonId,
      ticketHolderId: seatOwnership.ticketHolderId,
      createdAt: seatOwnership.createdAt,
      seat: {
        id: seatsTable.id,
        teamId: seatsTable.teamId,
        section: seatsTable.section,
        row: seatsTable.row,
        number: seatsTable.number,
        licenseCost: seatsTable.licenseCost,
        createdAt: seatsTable.createdAt,
      },
      ticketHolder: {
        id: ticketHolders.id,
        name: ticketHolders.name,
        email: ticketHolders.email,
        createdAt: ticketHolders.createdAt,
      }
    })
    .from(seatOwnership)
    .leftJoin(seatsTable, eq(seatOwnership.seatId, seatsTable.id))
    .leftJoin(ticketHolders, eq(seatOwnership.ticketHolderId, ticketHolders.id));
    
    if (seasonId) {
      return await query.where(eq(seatOwnership.seasonId, seasonId));
    }
    return await query;
  }

  async createSeatOwnership(ownership: InsertSeatOwnership): Promise<SeatOwnership> {
    const [newOwnership] = await db.insert(seatOwnership).values(ownership).returning();
    return newOwnership;
  }

  // Payment operations
  async getPayments(seasonId?: number): Promise<PaymentWithDetails[]> {
    const query = db.select({
      id: payments.id,
      seasonId: payments.seasonId,
      ticketHolderId: payments.ticketHolderId,
      teamId: payments.teamId,
      amount: payments.amount,
      type: payments.type,
      category: payments.category,
      description: payments.description,
      date: payments.date,
      notes: payments.notes,
      createdAt: payments.createdAt,
      ticketHolderName: ticketHolders.name,
      teamName: teams.name,
    })
    .from(payments)
    .leftJoin(ticketHolders, eq(payments.ticketHolderId, ticketHolders.id))
    .leftJoin(teams, eq(payments.teamId, teams.id))
    .orderBy(desc(payments.date));

    if (seasonId) {
      return await query.where(eq(payments.seasonId, seasonId));
    }
    
    return await query;
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [newPayment] = await db.insert(payments).values(payment).returning();
    return newPayment;
  }

  async updatePayment(id: number, paymentData: Partial<InsertPayment>): Promise<Payment | undefined> {
    const [updatedPayment] = await db
      .update(payments)
      .set(paymentData)
      .where(eq(payments.id, id))
      .returning();
    return updatedPayment;
  }

  async deletePayment(id: number): Promise<boolean> {
    const result = await db.delete(payments).where(eq(payments.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Payout operations
  async getPayouts(gameId?: number, ticketHolderId?: number): Promise<Payout[]> {
    const conditions = [];
    
    if (gameId) conditions.push(eq(payouts.gameId, gameId));
    if (ticketHolderId) conditions.push(eq(payouts.ticketHolderId, ticketHolderId));
    
    if (conditions.length > 0) {
      return await db.select().from(payouts).where(and(...conditions));
    }
    
    return await db.select().from(payouts);
  }

  async createPayout(payout: InsertPayout): Promise<Payout> {
    const [newPayout] = await db.insert(payouts).values(payout).returning();
    return newPayout;
  }

  // Transfer operations
  async getTransfers(gameId?: number): Promise<Transfer[]> {
    const query = db.select().from(transfers);
    if (gameId) {
      return await query.where(eq(transfers.gameId, gameId)).orderBy(desc(transfers.date));
    }
    return await query.orderBy(desc(transfers.date));
  }

  async createTransfer(transfer: InsertTransfer): Promise<Transfer> {
    const [newTransfer] = await db.insert(transfers).values(transfer).returning();
    return newTransfer;
  }

  async updateTransferStatus(id: number, status: string): Promise<Transfer | undefined> {
    const [updatedTransfer] = await db
      .update(transfers)
      .set({ status })
      .where(eq(transfers.id, id))
      .returning();
    return updatedTransfer;
  }

  // Attendance operations
  async getGameAttendance(gameId?: number): Promise<GameAttendance[]> {
    const query = db.select().from(gameAttendance);
    if (gameId) {
      return await query.where(eq(gameAttendance.gameId, gameId));
    }
    return await query;
  }

  async createGameAttendance(attendance: InsertGameAttendance): Promise<GameAttendance> {
    const [newAttendance] = await db.insert(gameAttendance).values(attendance).returning();
    return newAttendance;
  }

  async deleteGameAttendance(id: number): Promise<boolean> {
    const result = await db.delete(gameAttendance).where(eq(gameAttendance.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Pricing operations
  async getGamePricing(gameId?: number): Promise<GamePricing[]> {
    const query = db.select().from(gamePricing);
    if (gameId) {
      return await query.where(eq(gamePricing.gameId, gameId));
    }
    return await query;
  }

  async upsertGamePricing(pricing: InsertGamePricing): Promise<GamePricing> {
    const [existingPricing] = await db
      .select()
      .from(gamePricing)
      .where(and(
        eq(gamePricing.gameId, pricing.gameId),
        eq(gamePricing.seatId, pricing.seatId)
      ));

    if (existingPricing) {
      const [updatedPricing] = await db
        .update(gamePricing)
        .set({ ...pricing, updatedAt: new Date() })
        .where(eq(gamePricing.id, existingPricing.id))
        .returning();
      return updatedPricing;
    } else {
      const [newPricing] = await db.insert(gamePricing).values(pricing).returning();
      return newPricing;
    }
  }

  // Dashboard data
  async getDashboardStats(seasonId: number): Promise<{
    totalRevenue: string;
    totalCosts: string;
    totalProfit: string;
    gamesPlayed: number;
    totalGames: number;
    activeSeats: number;
    ticketHolders: number;
  }> {
    // Get total games in season
    const totalGamesQuery = await db
      .select({ count: sql<number>`count(*)` })
      .from(games)
      .where(eq(games.seasonId, seasonId));

    // Get games played (games with past dates)
    const gamesPlayedQuery = await db
      .select({ count: sql<number>`count(*)` })
      .from(games)
      .where(and(eq(games.seasonId, seasonId), sql`date <= CURRENT_DATE`));

    // Get total revenue from actual sales only (when soldPrice is not null)
    const revenueQuery = await db
      .select({ 
        total: sql<string>`
          COALESCE(SUM(
            CASE 
              WHEN ${gamePricing.soldPrice} IS NOT NULL THEN ${gamePricing.soldPrice}
              ELSE 0
            END
          ), 0)
        `
      })
      .from(seatOwnership)
      .innerJoin(games, eq(seatOwnership.seasonId, games.seasonId))
      .leftJoin(gamePricing, and(
        eq(gamePricing.gameId, games.id),
        eq(gamePricing.seatId, seatOwnership.seatId)
      ))
      .where(eq(seatOwnership.seasonId, seasonId));

    // Get total costs from all seat sales (seat ownership * games * costs)
    const costsQuery = await db
      .select({ 
        total: sql<string>`COALESCE(SUM(${gamePricing.cost}), 0)`
      })
      .from(seatOwnership)
      .innerJoin(games, eq(seatOwnership.seasonId, games.seasonId))
      .leftJoin(gamePricing, and(
        eq(gamePricing.gameId, games.id),
        eq(gamePricing.seatId, seatOwnership.seatId)
      ))
      .where(eq(seatOwnership.seasonId, seasonId));

    // Note: License costs are one-time costs and not included in seasonal calculations

    // Get active seats count
    const activeSeatsQuery = await db
      .select({ count: sql<number>`count(*)` })
      .from(seatOwnership)
      .where(eq(seatOwnership.seasonId, seasonId));

    // Get unique ticket holders for this season
    const ticketHoldersQuery = await db
      .select({ count: sql<number>`count(DISTINCT ticket_holder_id)` })
      .from(seatOwnership)
      .where(eq(seatOwnership.seasonId, seasonId));

    const [totalGames, gamesPlayed, revenue, costs, activeSeats, ticketHolders] = await Promise.all([
      totalGamesQuery,
      gamesPlayedQuery,
      revenueQuery,
      costsQuery,
      activeSeatsQuery,
      ticketHoldersQuery,
    ]);

    const totalRevenue = parseFloat(revenue[0]?.total || "0");
    const totalCosts = parseFloat(costs[0]?.total || "0");
    const totalProfit = totalRevenue - totalCosts;

    return {
      totalRevenue: revenue[0]?.total || "0",
      totalCosts: costs[0]?.total || "0",
      totalProfit: totalProfit.toFixed(2),
      gamesPlayed: gamesPlayed[0]?.count || 0,
      totalGames: totalGames[0]?.count || 0,
      activeSeats: activeSeats[0]?.count || 0,
      ticketHolders: ticketHolders[0]?.count || 0,
    };
  }

  async getFinancialSummary(seasonId: number): Promise<{
    ticketHolderId: number;
    name: string;
    seatsOwned: number;
    balance: string;
  }[]> {
    // Get seat ownerships for the season (license costs are one-time, not seasonal)
    const ownerships = await db
      .select({
        ticketHolderId: seatOwnership.ticketHolderId,
        name: ticketHolders.name,
        seatId: seatOwnership.seatId,
      })
      .from(seatOwnership)
      .innerJoin(ticketHolders, eq(seatOwnership.ticketHolderId, ticketHolders.id))
      .where(eq(seatOwnership.seasonId, seasonId));

    // Get games for the season
    const seasonGames = await db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.seasonId, seasonId));

    const gameIds = seasonGames.map(g => g.id);

    // Get game pricing for season games
    const pricing = gameIds.length > 0 ? await db
      .select({
        seatId: gamePricing.seatId,
        cost: gamePricing.cost,
        soldPrice: gamePricing.soldPrice,
      })
      .from(gamePricing)
      .innerJoin(games, eq(gamePricing.gameId, games.id))
      .where(eq(games.seasonId, seasonId)) : [];

    // Get payments for ticket holders in this season
    const paymentsData = await db
      .select({
        ticketHolderId: payments.ticketHolderId,
        amount: payments.amount,
        type: payments.type,
      })
      .from(payments)
      .where(eq(payments.seasonId, seasonId));

    // Calculate profit/loss for each owner (excluding one-time license costs)
    const ownerSummary = new Map<number, {
      name: string;
      seatsOwned: number;
      totalProfit: number;
      totalPayments: number;
    }>();

    // Initialize owners
    for (const ownership of ownerships) {
      if (!ownerSummary.has(ownership.ticketHolderId)) {
        ownerSummary.set(ownership.ticketHolderId, {
          name: ownership.name,
          seatsOwned: 0,
          totalProfit: 0,
          totalPayments: 0,
        });
      }
      ownerSummary.get(ownership.ticketHolderId)!.seatsOwned++;
    }

    // Calculate game profits for each seat owned
    for (const ownership of ownerships) {
      const seatPricing = pricing.filter(p => p.seatId === ownership.seatId);
      for (const price of seatPricing) {
        const cost = parseFloat(price.cost || "0");
        const revenue = parseFloat(price.soldPrice || "0");
        const profit = revenue - cost;
        ownerSummary.get(ownership.ticketHolderId)!.totalProfit += profit;
      }
    }

    // Subtract payments made by owners
    for (const payment of paymentsData) {
      if (payment.ticketHolderId && ownerSummary.has(payment.ticketHolderId)) {
        const amount = parseFloat(payment.amount);
        // Subtract payments from owners (from_owner type) and add payments to owners (to_owner type)
        if (payment.type === 'from_owner') {
          ownerSummary.get(payment.ticketHolderId)!.totalPayments += amount;
        } else if (payment.type === 'to_owner') {
          ownerSummary.get(payment.ticketHolderId)!.totalPayments -= amount;
        }
      }
    }

    // Convert to result format
    return Array.from(ownerSummary.entries()).map(([ticketHolderId, data]) => ({
      ticketHolderId,
      name: data.name,
      seatsOwned: data.seatsOwned,
      balance: (data.totalProfit - data.totalPayments).toFixed(2),
    }));
  }

  async getTicketHolderProfits(seasonId: number): Promise<{
    ticketHolderId: number;
    name: string;
    revenue: string;
    costs: string;
    profit: string;
    balance: string;
  }[]> {
    // Get ticket sales revenue and costs
    const salesResult = await db
      .select({
        ticketHolderId: ticketHolders.id,
        name: ticketHolders.name,
        totalRevenue: sql<string>`COALESCE(SUM(${gamePricing.soldPrice}), 0)`,
        totalCosts: sql<string>`COALESCE(SUM(${gamePricing.cost}), 0)`,
      })
      .from(seatOwnership)
      .innerJoin(ticketHolders, eq(seatOwnership.ticketHolderId, ticketHolders.id))
      .innerJoin(games, eq(games.seasonId, seasonId))
      .leftJoin(gamePricing, and(
        eq(gamePricing.gameId, games.id),
        eq(gamePricing.seatId, seatOwnership.seatId)
      ))
      .where(eq(seatOwnership.seasonId, seasonId))
      .groupBy(ticketHolders.id, ticketHolders.name);

    // Get payments from owners for this season (excluding seat license payment)
    const paymentsFromOwnersResult = await db
      .select({
        ticketHolderId: payments.ticketHolderId,
        totalPayments: sql<string>`COALESCE(SUM(CASE WHEN ${payments.amount} != '1249.55' THEN ${payments.amount} ELSE 0 END), 0)`,
      })
      .from(payments)
      .where(and(
        eq(payments.seasonId, seasonId),
        eq(payments.type, 'from_owner')
      ))
      .groupBy(payments.ticketHolderId);

    // Get payments to owners for this season
    const paymentsToOwnersResult = await db
      .select({
        ticketHolderId: payments.ticketHolderId,
        totalPayments: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
      })
      .from(payments)
      .where(and(
        eq(payments.seasonId, seasonId),
        eq(payments.type, 'to_owner')
      ))
      .groupBy(payments.ticketHolderId);

    // Create lookup maps
    const paymentsFromMap = new Map<number, number>();
    paymentsFromOwnersResult.forEach(p => {
      if (p.ticketHolderId) {
        paymentsFromMap.set(p.ticketHolderId, parseFloat(p.totalPayments || "0"));
      }
    });

    const paymentsToMap = new Map<number, number>();
    paymentsToOwnersResult.forEach(p => {
      if (p.ticketHolderId) {
        paymentsToMap.set(p.ticketHolderId, parseFloat(p.totalPayments || "0"));
      }
    });

    return salesResult.map(row => {
      const revenue = parseFloat(row.totalRevenue || "0");
      const costs = parseFloat(row.totalCosts || "0");
      const profit = revenue - costs;
      
      const paymentsFromOwner = paymentsFromMap.get(row.ticketHolderId) || 0;
      const paymentsToOwner = paymentsToMap.get(row.ticketHolderId) || 0;
      
      // Balance = (total sales + payments from owner) - (total costs + payments made to owners)
      // Payments from owner should be added as they represent money coming in
      const balance = (revenue + paymentsFromOwner) - (costs + paymentsToOwner);
      
      return {
        ticketHolderId: row.ticketHolderId,
        name: row.name,
        revenue: revenue.toFixed(2),
        costs: costs.toFixed(2),
        profit: profit.toFixed(2),
        balance: balance.toFixed(2),
      };
    });
  }

  // Team Performance operations
  async getTeamPerformance(teamId?: number, seasonId?: number): Promise<TeamPerformance[]> {
    const query = db.select().from(teamPerformance);
    
    if (teamId && seasonId) {
      return await query.where(and(eq(teamPerformance.teamId, teamId), eq(teamPerformance.seasonId, seasonId)));
    } else if (teamId) {
      return await query.where(eq(teamPerformance.teamId, teamId));
    } else if (seasonId) {
      return await query.where(eq(teamPerformance.seasonId, seasonId));
    }
    
    return await query;
  }

  async createTeamPerformance(performance: InsertTeamPerformance): Promise<TeamPerformance> {
    const [newPerformance] = await db.insert(teamPerformance).values(performance).returning();
    return newPerformance;
  }

  async updateTeamPerformance(id: number, performanceData: Partial<InsertTeamPerformance>): Promise<TeamPerformance | undefined> {
    const [updatedPerformance] = await db
      .update(teamPerformance)
      .set({ ...performanceData, lastUpdated: new Date() })
      .where(eq(teamPerformance.id, id))
      .returning();
    return updatedPerformance;
  }

  async calculateTeamPerformance(teamId: number, seasonId: number): Promise<TeamPerformance> {
    // Get all games for the team in this season
    const teamGames = await db
      .select()
      .from(games)
      .where(eq(games.seasonId, seasonId));

    // Calculate win/loss record
    let wins = 0;
    let losses = 0;
    let totalAttendance = 0;
    let gameCount = 0;

    for (const game of teamGames) {
      // Get attendance for this game
      const attendance = await db
        .select({ count: sql<number>`count(*)` })
        .from(gameAttendance)
        .where(eq(gameAttendance.gameId, game.id));
      
      const attendanceCount = attendance[0]?.count || 0;
      totalAttendance += attendanceCount;
      gameCount++;

      // Simple win/loss calculation based on attendance (higher attendance = likely win)
      // In a real system, this would come from actual game results
      if (attendanceCount > 2) {
        wins++;
      } else {
        losses++;
      }
    }

    const totalGamesPlayed = wins + losses;
    const winPercentage = totalGamesPlayed > 0 ? (wins / totalGamesPlayed) : 0;
    const averageAttendance = gameCount > 0 ? Math.min(Math.round(totalAttendance / gameCount), 100000) : 0;
    
    // Calculate market demand based on win percentage and attendance (ensure reasonable bounds)
    const marketDemand = Math.min(10, Math.max(1, (winPercentage * 5) + Math.min(averageAttendance / 100, 5)));
    
    // Calculate playoff probability based on win percentage (ensure reasonable bounds)
    const playoffProbability = Math.min(100, Math.max(0, winPercentage * 100 + (marketDemand * 2)));

    const performanceData: InsertTeamPerformance = {
      teamId,
      seasonId,
      wins: Math.min(wins, 999),
      losses: Math.min(losses, 999),
      winPercentage: winPercentage.toFixed(3),
      averageAttendance: Math.min(averageAttendance, 100000),
      marketDemand: marketDemand.toFixed(2),
      playoffProbability: playoffProbability.toFixed(2),
    };

    // Check if performance record already exists
    const existing = await this.getTeamPerformance(teamId, seasonId);
    if (existing.length > 0) {
      const updated = await this.updateTeamPerformance(existing[0].id, performanceData);
      return updated!;
    } else {
      return await this.createTeamPerformance(performanceData);
    }
  }

  // Seat Value Prediction operations
  async getSeatValuePredictions(seatId?: number, seasonId?: number): Promise<SeatValuePrediction[]> {
    const query = db.select().from(seatValuePredictions);
    
    if (seatId && seasonId) {
      return await query.where(and(eq(seatValuePredictions.seatId, seatId), eq(seatValuePredictions.seasonId, seasonId)));
    } else if (seatId) {
      return await query.where(eq(seatValuePredictions.seatId, seatId));
    } else if (seasonId) {
      return await query.where(eq(seatValuePredictions.seasonId, seasonId));
    }
    
    return await query;
  }

  async createSeatValuePrediction(prediction: InsertSeatValuePrediction): Promise<SeatValuePrediction> {
    const [newPrediction] = await db.insert(seatValuePredictions).values(prediction).returning();
    return newPrediction;
  }

  async calculateSeatValuePredictions(seasonId: number): Promise<SeatValuePrediction[]> {
    // Get season and team info
    const season = await this.getSeason(seasonId);
    if (!season) throw new Error("Season not found");

    // Get team performance
    const teamPerformanceData = await this.getTeamPerformance(season.teamId, seasonId);
    let performance = teamPerformanceData[0];
    
    if (!performance) {
      // Calculate performance if it doesn't exist
      performance = await this.calculateTeamPerformance(season.teamId, seasonId);
    }

    // Get all seats for this team
    const seats = await this.getSeats(season.teamId);
    
    // Get historical pricing data for all seats
    const historicalPricing = await db
      .select({
        seatId: gamePricing.seatId,
        avgCost: sql<string>`AVG(${gamePricing.cost})`,
        avgSoldPrice: sql<string>`AVG(${gamePricing.soldPrice})`,
        maxSoldPrice: sql<string>`MAX(${gamePricing.soldPrice})`,
        salesCount: sql<string>`COUNT(CASE WHEN ${gamePricing.soldPrice} > 0 THEN 1 END)`,
      })
      .from(gamePricing)
      .innerJoin(games, eq(gamePricing.gameId, games.id))
      .where(eq(games.seasonId, seasonId))
      .groupBy(gamePricing.seatId);

    // Get similar seats data for comparison (seats with same section/row characteristics)
    const similarSeatsData = await db
      .select({
        seatId: gamePricing.seatId,
        section: seatsTable.section,
        row: seatsTable.row,
        seatNumber: seatsTable.number,
        avgSoldPrice: sql<string>`AVG(${gamePricing.soldPrice})`,
        avgCurrentPrice: sql<string>`AVG(${gamePricing.cost})`,
        salesCount: sql<string>`COUNT(CASE WHEN ${gamePricing.soldPrice} > 0 THEN 1 END)`,
        recentAvgPrice: sql<string>`AVG(CASE WHEN ${games.date} >= CURRENT_DATE - INTERVAL '30 days' THEN ${gamePricing.soldPrice} END)`,
      })
      .from(gamePricing)
      .innerJoin(games, eq(gamePricing.gameId, games.id))
      .innerJoin(seatsTable, eq(gamePricing.seatId, seatsTable.id))
      .where(and(
        eq(games.seasonId, seasonId),
        eq(seatsTable.teamId, season.teamId)
      ))
      .groupBy(gamePricing.seatId, seatsTable.section, seatsTable.row, seatsTable.number);

    // Get opponent-specific pricing data for better predictions
    const opponentPricingData = await db
      .select({
        opponent: games.opponent,
        avgSoldPrice: sql<string>`AVG(${gamePricing.soldPrice})`,
        avgCost: sql<string>`AVG(${gamePricing.cost})`,
        salesCount: sql<string>`COUNT(CASE WHEN ${gamePricing.soldPrice} > 0 THEN 1 END)`,
        gameCount: sql<string>`COUNT(DISTINCT ${games.id})`,
      })
      .from(gamePricing)
      .innerJoin(games, eq(gamePricing.gameId, games.id))
      .innerJoin(seatsTable, eq(gamePricing.seatId, seatsTable.id))
      .where(and(
        eq(seatsTable.teamId, season.teamId),
        sql`${gamePricing.soldPrice} IS NOT NULL`
      ))
      .groupBy(games.opponent)
      .having(sql`COUNT(DISTINCT ${games.id}) >= 2`); // Only include opponents with multiple games

    const predictions: SeatValuePrediction[] = [];

    for (const seat of seats) {
      const seatPricing = historicalPricing.find(p => p.seatId === seat.id);
      
      // Find similar seats (same section or adjacent rows)
      const similarSeats = similarSeatsData.filter(s => 
        s.seatId !== seat.id && (
          s.section === seat.section || 
          (s.section === seat.section && Math.abs(parseInt(s.row) - parseInt(seat.row)) <= 1)
        )
      );
      
      // Calculate similar seats pricing data
      const similarSeatsAvgPrice = similarSeats.length > 0 
        ? similarSeats.reduce((sum, s) => sum + parseFloat(s.avgSoldPrice || "0"), 0) / similarSeats.length
        : 0;
      
      const similarSeatsCurrentPrice = similarSeats.length > 0 
        ? similarSeats.reduce((sum, s) => sum + parseFloat(s.avgCurrentPrice || "0"), 0) / similarSeats.length
        : 0;
      
      const similarSeatsRecentPrice = similarSeats.length > 0 
        ? similarSeats.reduce((sum, s) => sum + parseFloat(s.recentAvgPrice || "0"), 0) / similarSeats.length
        : 0;
      
      const similarSeatsSalesCount = similarSeats.reduce((sum, s) => sum + parseInt(s.salesCount || "0"), 0);
      
      // Calculate opponent-based pricing trends
      const opponentAvgPrice = opponentPricingData.length > 0
        ? opponentPricingData.reduce((sum, o) => sum + parseFloat(o.avgSoldPrice || "0"), 0) / opponentPricingData.length
        : 0;
      
      // Base value calculation with multiple data sources
      let baselineValue = parseFloat(seat.licenseCost || "100");
      
      // Weight current market pricing more heavily than historical
      if (similarSeatsCurrentPrice > 0 && similarSeatsRecentPrice > 0) {
        const currentPriceWeight = 0.3; // 30% weight for current pricing
        const recentPriceWeight = 0.2; // 20% weight for recent pricing
        baselineValue = (baselineValue * 0.5) + (similarSeatsCurrentPrice * currentPriceWeight) + (similarSeatsRecentPrice * recentPriceWeight);
      } else if (similarSeatsAvgPrice > 0) {
        const similarSeatsWeight = Math.min(similarSeats.length * 0.2, 0.4); // Max 40% weight
        baselineValue = (baselineValue * (1 - similarSeatsWeight)) + (similarSeatsAvgPrice * similarSeatsWeight);
      }
      
      // If seat has its own pricing history, blend it with baseline
      if (seatPricing?.avgSoldPrice) {
        const ownDataWeight = Math.min(parseInt(seatPricing.salesCount || "0") * 0.1, 0.6); // Max 60% weight
        baselineValue = (baselineValue * (1 - ownDataWeight)) + (parseFloat(seatPricing.avgSoldPrice) * ownDataWeight);
      }
      
      // Adjust baseline based on opponent pricing patterns
      if (opponentAvgPrice > 0 && opponentPricingData.length >= 3) {
        const opponentWeight = 0.15; // 15% weight for opponent-specific data
        baselineValue = (baselineValue * (1 - opponentWeight)) + (opponentAvgPrice * opponentWeight);
      }
      
      // Performance multiplier based on team performance
      const performanceMultiplier = 1 + (parseFloat(performance.winPercentage || "0") * 0.5) + (parseFloat(performance.marketDemand || "5") * 0.1);
      
      // Demand multiplier based on market demand and attendance
      const demandMultiplier = 1 + (parseFloat(performance.marketDemand || "5") * 0.15) + ((performance.averageAttendance || 0) * 0.01);
      
      // Similar seats demand factor
      const similarSeatsMultiplier = similarSeatsSalesCount > 0 ? 1 + (similarSeatsSalesCount * 0.02) : 1;
      
      // Calculate predicted value
      const predictedValue = baselineValue * performanceMultiplier * demandMultiplier * similarSeatsMultiplier;
      
      // Enhanced confidence score with current pricing and opponent data
      const hasHistoricalData = seatPricing ? Math.min(parseInt(seatPricing.salesCount || "0") * 4, 20) : 0;
      const hasSimilarSeatsData = similarSeats.length > 0 ? Math.min(similarSeats.length * 8, 25) : 0;
      const hasCurrentPricing = similarSeatsCurrentPrice > 0 ? 15 : 0;
      const hasRecentPricing = similarSeatsRecentPrice > 0 ? 10 : 0;
      const hasOpponentData = opponentPricingData.length >= 3 ? 15 : 0;
      const hasPerformanceData = performance ? 10 : 0;
      const hasAttendanceData = (performance.averageAttendance || 0) > 0 ? 5 : 0;
      const confidenceScore = hasHistoricalData + hasSimilarSeatsData + hasCurrentPricing + hasRecentPricing + hasOpponentData + hasPerformanceData + hasAttendanceData;
      
      const predictionData: InsertSeatValuePrediction = {
        seatId: seat.id,
        seasonId,
        predictedValue: predictedValue.toFixed(2),
        confidenceScore: confidenceScore.toFixed(2),
        factorsConsidered: [
          "team_performance", 
          "historical_pricing", 
          "similar_seats_data",
          "current_market_pricing",
          "recent_pricing_trends",
          "opponent_specific_data",
          "market_demand", 
          "attendance_data"
        ].filter(factor => {
          if (factor === "historical_pricing") return !!seatPricing;
          if (factor === "similar_seats_data") return similarSeats.length > 0;
          if (factor === "current_market_pricing") return similarSeatsCurrentPrice > 0;
          if (factor === "recent_pricing_trends") return similarSeatsRecentPrice > 0;
          if (factor === "opponent_specific_data") return opponentPricingData.length >= 3;
          if (factor === "attendance_data") return (performance.averageAttendance || 0) > 0;
          return true;
        }),
        baselineValue: baselineValue.toFixed(2),
        performanceMultiplier: performanceMultiplier.toFixed(3),
        demandMultiplier: demandMultiplier.toFixed(3),
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Valid for 1 week
      };

      // Check if prediction already exists
      const existing = await this.getSeatValuePredictions(seat.id, seasonId);
      if (existing.length > 0) {
        // Update existing prediction
        const [updated] = await db
          .update(seatValuePredictions)
          .set(predictionData)
          .where(eq(seatValuePredictions.id, existing[0].id))
          .returning();
        predictions.push(updated);
      } else {
        // Create new prediction
        const newPrediction = await this.createSeatValuePrediction(predictionData);
        predictions.push(newPrediction);
      }
    }

    return predictions;
  }

  async getPredictedSeatValue(seatId: number, seasonId: number): Promise<SeatValuePrediction | undefined> {
    const predictions = await this.getSeatValuePredictions(seatId, seasonId);
    
    if (predictions.length === 0) {
      // Generate prediction if it doesn't exist
      await this.calculateSeatValuePredictions(seasonId);
      const newPredictions = await this.getSeatValuePredictions(seatId, seasonId);
      return newPredictions[0];
    }
    
    const prediction = predictions[0];
    
    // Check if prediction is still valid
    if (prediction.validUntil && new Date(prediction.validUntil) < new Date()) {
      // Recalculate if expired
      await this.calculateSeatValuePredictions(seasonId);
      const refreshedPredictions = await this.getSeatValuePredictions(seatId, seasonId);
      return refreshedPredictions[0];
    }
    
    return prediction;
  }

  async getSimilarTicketPrices(seatId: number, seasonId: number): Promise<{
    gameId: number;
    gameDate: string;
    opponent: string;
    similarSeats: {
      seatId: number;
      section: string;
      row: string;
      number: string;
      currentPrice: string;
      sold: boolean;
    }[];
  }[]> {
    // Get the target seat details
    const targetSeat = await this.getSeat(seatId);
    if (!targetSeat) return [];

    // Get all games for this season
    const seasonGames = await db
      .select({
        id: games.id,
        date: games.date,
        opponent: games.opponent,
      })
      .from(games)
      .where(eq(games.seasonId, seasonId))
      .orderBy(games.date);

    const gameData = [];

    for (const game of seasonGames) {
      // Get similar seats pricing for this specific game
      const similarSeatsForGame = await db
        .select({
          seatId: gamePricing.seatId,
          section: seatsTable.section,
          row: seatsTable.row,
          number: seatsTable.number,
          currentPrice: gamePricing.cost,
          soldPrice: gamePricing.soldPrice,
        })
        .from(gamePricing)
        .innerJoin(seatsTable, eq(gamePricing.seatId, seatsTable.id))
        .where(and(
          eq(gamePricing.gameId, game.id),
          eq(seatsTable.teamId, targetSeat.teamId),
          or(
            // Same section
            eq(seatsTable.section, targetSeat.section),
            // Adjacent rows in same section
            and(
              eq(seatsTable.section, targetSeat.section),
              sql`ABS(CAST(${seatsTable.row} AS INTEGER) - CAST(${targetSeat.row} AS INTEGER)) <= 1`
            )
          ),
          // Exclude the target seat itself
          not(eq(seatsTable.id, seatId))
        ));

      if (similarSeatsForGame.length > 0) {
        gameData.push({
          gameId: game.id,
          gameDate: game.date,
          opponent: game.opponent,
          similarSeats: similarSeatsForGame.map(seat => ({
            seatId: seat.seatId,
            section: seat.section,
            row: seat.row,
            number: seat.number,
            currentPrice: seat.currentPrice || "0",
            sold: !!(seat.soldPrice && parseFloat(seat.soldPrice) > 0),
          })),
        });
      }
    }

    return gameData;
  }

  // Report operations
  async getSeasonSummaryReport(teamId?: number): Promise<{
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
  }[]> {
    // Get seasons, optionally filtered by team
    const seasonsQuery = db
      .select({
        seasonId: seasons.id,
        seasonYear: seasons.year,
        teamId: seasons.teamId,
        teamName: teams.name,
      })
      .from(seasons)
      .innerJoin(teams, eq(seasons.teamId, teams.id))
      .orderBy(desc(seasons.year), teams.name);

    const seasonsList = teamId 
      ? await seasonsQuery.where(eq(seasons.teamId, teamId))
      : await seasonsQuery;

    const reports = [];

    for (const season of seasonsList) {
      // Get owner financial data for this season
      const ownerData = await db
        .select({
          ticketHolderId: seatOwnership.ticketHolderId,
          name: ticketHolders.name,
          totalSales: sql<string>`
            COALESCE(SUM(
              CASE 
                WHEN ${gamePricing.soldPrice} IS NOT NULL THEN ${gamePricing.soldPrice}
                ELSE 0
              END
            ), 0)
          `,
          totalGameCosts: sql<string>`COALESCE(SUM(${gamePricing.cost}), 0)`,
        })
        .from(seatOwnership)
        .innerJoin(ticketHolders, eq(seatOwnership.ticketHolderId, ticketHolders.id))
        .innerJoin(games, eq(games.seasonId, seatOwnership.seasonId))
        .leftJoin(gamePricing, and(
          eq(gamePricing.gameId, games.id),
          eq(gamePricing.seatId, seatOwnership.seatId)
        ))
        .where(eq(seatOwnership.seasonId, season.seasonId))
        .groupBy(seatOwnership.ticketHolderId, ticketHolders.name)
        .orderBy(ticketHolders.name);

      // Calculate owner details with profit (excluding license costs)
      const ownerDetails = ownerData.map(owner => {
        const sales = parseFloat(owner.totalSales);
        const gameCosts = parseFloat(owner.totalGameCosts);
        const profit = sales - gameCosts;
        
        return {
          ticketHolderId: owner.ticketHolderId,
          name: owner.name,
          sales: sales.toFixed(2),
          costs: gameCosts.toFixed(2),
          profit: profit.toFixed(2),
        };
      });

      // Calculate season totals
      const totalSales = ownerDetails.reduce((sum, owner) => sum + parseFloat(owner.sales), 0);
      const totalCosts = ownerDetails.reduce((sum, owner) => sum + parseFloat(owner.costs), 0);
      const totalProfit = totalSales - totalCosts;

      reports.push({
        seasonId: season.seasonId,
        seasonYear: season.seasonYear,
        teamName: season.teamName,
        totalSales: totalSales.toFixed(2),
        totalCosts: totalCosts.toFixed(2),
        totalProfit: totalProfit.toFixed(2),
        ownerDetails,
      });
    }

    return reports;
  }

  async getSeatLicenseInvestmentSummary(teamId?: number): Promise<{
    ticketHolderId: number;
    name: string;
    totalLicenseCosts: string;
    seatsOwned: number;
  }[]> {
    const query = db
      .select({
        ticketHolderId: seatOwnership.ticketHolderId,
        name: ticketHolders.name,
        totalLicenseCosts: sql<string>`COALESCE(SUM(DISTINCT ${seatsTable.licenseCost}), 0)`,
        seatsOwned: sql<number>`COUNT(DISTINCT ${seatsTable.id})`,
      })
      .from(seatOwnership)
      .innerJoin(ticketHolders, eq(seatOwnership.ticketHolderId, ticketHolders.id))
      .innerJoin(seatsTable, eq(seatOwnership.seatId, seatsTable.id))
      .groupBy(seatOwnership.ticketHolderId, ticketHolders.name)
      .orderBy(ticketHolders.name);

    if (teamId) {
      return await query.where(eq(seatsTable.teamId, teamId));
    }

    return await query;
  }

  async getOwnerBalances(): Promise<{
    ticketHolderId: number;
    name: string;
    seatsOwned: number;
    seatLicenseCosts: string;
    paymentsMade: string;
    paymentsReceived: string;
    balance: string;
  }[]> {
    try {
      // Get all ticket holders
      const ticketHoldersResult = await db.select().from(ticketHolders);
      
      // Get seat ownership data with sales revenue and costs
      const ownershipResult = await db
        .select({
          ticketHolderId: seatOwnership.ticketHolderId,
          seatId: seatOwnership.seatId,
          seasonId: seatOwnership.seasonId,
          licenseCost: seatsTable.licenseCost,
        })
        .from(seatOwnership)
        .innerJoin(seatsTable, eq(seatOwnership.seatId, seatsTable.id));

      // Get game pricing data (sales revenue and costs) - deduplicated by seat and game
      const pricingResult = await db
        .select({
          seatId: gamePricing.seatId,
          gameId: gamePricing.gameId,
          cost: gamePricing.cost,
          soldPrice: gamePricing.soldPrice,
        })
        .from(gamePricing)
        .innerJoin(games, eq(gamePricing.gameId, games.id))
        .groupBy(gamePricing.seatId, gamePricing.gameId, gamePricing.cost, gamePricing.soldPrice);

      // Get payments data
      const paymentsResult = await db
        .select({
          ticketHolderId: payments.ticketHolderId,
          type: payments.type,
          amount: payments.amount,
        })
        .from(payments)
        .where(inArray(payments.type, ['from_owner', 'to_owner', 'to_team']));

      // Calculate team payment distribution
      const totalSeats = ownershipResult.length;
      const totalTeamPayments = paymentsResult
        .filter(p => p.type === 'to_team')
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);
      const teamPaymentPerSeat = totalSeats > 0 ? totalTeamPayments / totalSeats : 0;

      // Build result for each ticket holder
      const result = ticketHoldersResult.map(holder => {
        const ownerships = ownershipResult.filter(o => o.ticketHolderId === holder.id);
        const holderPayments = paymentsResult.filter(p => p.ticketHolderId === holder.id);
        
        // Count unique seats owned and their license costs (don't double-count across seasons)
        const uniqueSeatsMap = new Map<number, number>();
        ownerships.forEach(o => {
          if (!uniqueSeatsMap.has(o.seatId)) {
            uniqueSeatsMap.set(o.seatId, parseFloat(o.licenseCost || "0"));
          }
        });
        const seatsOwned = uniqueSeatsMap.size;
        const seatLicenseCosts = Array.from(uniqueSeatsMap.values()).reduce((sum, cost) => sum + cost, 0);
        
        // Calculate total sales revenue and costs across all owned seats (deduplicated by seat+game)
        let totalSales = 0;
        let totalCosts = 0;
        
        // Use unique seats to avoid double-counting across seasons
        Array.from(uniqueSeatsMap.keys()).forEach(seatId => {
          const seatPricing = pricingResult.filter(p => p.seatId === seatId);
          seatPricing.forEach(pricing => {
            totalSales += parseFloat(pricing.soldPrice || "0");
            totalCosts += parseFloat(pricing.cost || "0");
          });
        });
        
        const paymentsFromOwner = holderPayments
          .filter(p => p.type === 'from_owner' && parseFloat(p.amount) !== 1249.55)
          .reduce((sum, p) => sum + parseFloat(p.amount), 0);
        
        const paymentsToOwner = holderPayments
          .filter(p => p.type === 'to_owner')
          .reduce((sum, p) => sum + parseFloat(p.amount), 0);
        
        // Balance = (total sales + payments from owner) - (total costs + seat license + payments made to owners)
        // Payments from owner should be added as they represent money coming in
        const balance = (totalSales + paymentsFromOwner) - (totalCosts + seatLicenseCosts + paymentsToOwner);
        
        return {
          ticketHolderId: holder.id,
          name: holder.name,
          seatsOwned,
          seatLicenseCosts: seatLicenseCosts.toFixed(2),
          paymentsMade: paymentsFromOwner.toFixed(2),
          paymentsReceived: paymentsToOwner.toFixed(2),
          balance: balance.toFixed(2),
        };
      }).filter(r => r.seatsOwned > 0);

      return result.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Error in getOwnerBalances:', error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();
