import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  boolean,
  decimal,
  date,
  time,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Local authentication users table
export const localUsers = pgTable("local_users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).unique().notNull(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  password: varchar("password", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  role: varchar("role", { length: 20 }).default("user"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Teams
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Seasons
export const seasons = pgTable("seasons", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id),
  year: integer("year").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Games
export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  seasonId: integer("season_id").notNull().references(() => seasons.id),
  date: date("date").notNull(),
  time: varchar("time", { length: 50 }),
  opponent: varchar("opponent", { length: 255 }).notNull(),
  opponentLogo: varchar("opponent_logo", { length: 500 }),
  seasonType: varchar("season_type", { length: 50 }).notNull().default("Regular Season"),
  isHome: boolean("is_home").default(true),
  venue: varchar("venue", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Ticket Holders
export const ticketHolders = pgTable("ticket_holders", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Seats
export const seats = pgTable("seats", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id),
  section: varchar("section", { length: 50 }).notNull(),
  row: varchar("row", { length: 10 }).notNull(),
  number: varchar("number", { length: 10 }).notNull(),
  licenseCost: decimal("license_cost", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Seat Ownership (per season)
export const seatOwnership = pgTable("seat_ownership", {
  id: serial("id").primaryKey(),
  seatId: integer("seat_id").notNull().references(() => seats.id),
  seasonId: integer("season_id").notNull().references(() => seasons.id),
  ticketHolderId: integer("ticket_holder_id").notNull().references(() => ticketHolders.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Payments (comprehensive financial transactions)
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  seasonId: integer("season_id").references(() => seasons.id), // null for one-time payments like seat licenses
  ticketHolderId: integer("ticket_holder_id").references(() => ticketHolders.id), // null for team payments
  teamId: integer("team_id").references(() => teams.id), // for payments to/from teams
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'from_owner', 'to_owner', 'to_team', 'from_team'
  category: varchar("category", { length: 100 }), // 'seat_license', 'season_fee', 'concessions', 'merchandise', 'parking', etc.
  date: date("date").notNull(),
  description: text("description"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Payouts (earnings to ticket holders per game)
export const payouts = pgTable("payouts", {
  id: serial("id").primaryKey(),
  ticketHolderId: integer("ticket_holder_id").notNull().references(() => ticketHolders.id),
  gameId: integer("game_id").notNull().references(() => games.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Transfers (seat ownership transfers for specific games)
export const transfers = pgTable("transfers", {
  id: serial("id").primaryKey(),
  fromTicketHolderId: integer("from_ticket_holder_id").notNull().references(() => ticketHolders.id),
  toTicketHolderId: integer("to_ticket_holder_id").notNull().references(() => ticketHolders.id),
  seatId: integer("seat_id").notNull().references(() => seats.id),
  gameId: integer("game_id").notNull().references(() => games.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  date: date("date").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Game Attendance (who is attending which game and in which seat)
export const gameAttendance = pgTable("game_attendance", {
  id: serial("id").primaryKey(),
  ticketHolderId: integer("ticket_holder_id").notNull().references(() => ticketHolders.id),
  seatId: integer("seat_id").notNull().references(() => seats.id),
  gameId: integer("game_id").notNull().references(() => games.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Game Pricing (cost and sold price per seat per game)
export const gamePricing = pgTable("game_pricing", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull().references(() => games.id),
  seatId: integer("seat_id").notNull().references(() => seats.id),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  soldPrice: decimal("sold_price", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Ensure only one pricing record per game-seat combination
  uniqueIndex("game_seat_pricing_unique").on(table.gameId, table.seatId),
]);

// Team Performance Metrics
export const teamPerformance = pgTable("team_performance", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id),
  seasonId: integer("season_id").notNull().references(() => seasons.id),
  wins: integer("wins").default(0),
  losses: integer("losses").default(0),
  winPercentage: decimal("win_percentage", { precision: 5, scale: 3 }),
  averageAttendance: integer("average_attendance"),
  marketDemand: decimal("market_demand", { precision: 5, scale: 2 }), // 1-10 scale
  playoffProbability: decimal("playoff_probability", { precision: 5, scale: 2 }), // 0-100%
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Seat Value Predictions
export const seatValuePredictions = pgTable("seat_value_predictions", {
  id: serial("id").primaryKey(),
  seatId: integer("seat_id").notNull().references(() => seats.id),
  seasonId: integer("season_id").notNull().references(() => seasons.id),
  predictedValue: decimal("predicted_value", { precision: 10, scale: 2 }),
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 2 }), // 0-100%
  factorsConsidered: text("factors_considered").array(), // Array of factors like "team_performance", "historical_data", etc.
  baselineValue: decimal("baseline_value", { precision: 10, scale: 2 }),
  performanceMultiplier: decimal("performance_multiplier", { precision: 5, scale: 3 }),
  demandMultiplier: decimal("demand_multiplier", { precision: 5, scale: 3 }),
  calculatedAt: timestamp("calculated_at").defaultNow(),
  validUntil: timestamp("valid_until"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const teamsRelations = relations(teams, ({ many }) => ({
  seasons: many(seasons),
  seats: many(seats),
}));

export const seasonsRelations = relations(seasons, ({ one, many }) => ({
  team: one(teams, {
    fields: [seasons.teamId],
    references: [teams.id],
  }),
  games: many(games),
  seatOwnerships: many(seatOwnership),
}));

export const gamesRelations = relations(games, ({ one, many }) => ({
  season: one(seasons, {
    fields: [games.seasonId],
    references: [seasons.id],
  }),
  payouts: many(payouts),
  transfers: many(transfers),
  attendance: many(gameAttendance),
  pricing: many(gamePricing),
}));

export const ticketHoldersRelations = relations(ticketHolders, ({ many }) => ({
  seatOwnerships: many(seatOwnership),
  payments: many(payments),
  payouts: many(payouts),
  transfersFrom: many(transfers, { relationName: "transfersFrom" }),
  transfersTo: many(transfers, { relationName: "transfersTo" }),
  attendance: many(gameAttendance),
}));

export const seatsRelations = relations(seats, ({ one, many }) => ({
  team: one(teams, {
    fields: [seats.teamId],
    references: [teams.id],
  }),
  ownerships: many(seatOwnership),
  transfers: many(transfers),
  attendance: many(gameAttendance),
  pricing: many(gamePricing),
}));

export const seatOwnershipRelations = relations(seatOwnership, ({ one }) => ({
  seat: one(seats, {
    fields: [seatOwnership.seatId],
    references: [seats.id],
  }),
  season: one(seasons, {
    fields: [seatOwnership.seasonId],
    references: [seasons.id],
  }),
  ticketHolder: one(ticketHolders, {
    fields: [seatOwnership.ticketHolderId],
    references: [ticketHolders.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  season: one(seasons, {
    fields: [payments.seasonId],
    references: [seasons.id],
  }),
  ticketHolder: one(ticketHolders, {
    fields: [payments.ticketHolderId],
    references: [ticketHolders.id],
  }),
  team: one(teams, {
    fields: [payments.teamId],
    references: [teams.id],
  }),
}));

export const payoutsRelations = relations(payouts, ({ one }) => ({
  ticketHolder: one(ticketHolders, {
    fields: [payouts.ticketHolderId],
    references: [ticketHolders.id],
  }),
  game: one(games, {
    fields: [payouts.gameId],
    references: [games.id],
  }),
}));

export const transfersRelations = relations(transfers, ({ one }) => ({
  fromTicketHolder: one(ticketHolders, {
    fields: [transfers.fromTicketHolderId],
    references: [ticketHolders.id],
    relationName: "transfersFrom",
  }),
  toTicketHolder: one(ticketHolders, {
    fields: [transfers.toTicketHolderId],
    references: [ticketHolders.id],
    relationName: "transfersTo",
  }),
  seat: one(seats, {
    fields: [transfers.seatId],
    references: [seats.id],
  }),
  game: one(games, {
    fields: [transfers.gameId],
    references: [games.id],
  }),
}));

export const gameAttendanceRelations = relations(gameAttendance, ({ one }) => ({
  ticketHolder: one(ticketHolders, {
    fields: [gameAttendance.ticketHolderId],
    references: [ticketHolders.id],
  }),
  seat: one(seats, {
    fields: [gameAttendance.seatId],
    references: [seats.id],
  }),
  game: one(games, {
    fields: [gameAttendance.gameId],
    references: [games.id],
  }),
}));

export const gamePricingRelations = relations(gamePricing, ({ one }) => ({
  game: one(games, {
    fields: [gamePricing.gameId],
    references: [games.id],
  }),
  seat: one(seats, {
    fields: [gamePricing.seatId],
    references: [seats.id],
  }),
}));

export const teamPerformanceRelations = relations(teamPerformance, ({ one }) => ({
  team: one(teams, {
    fields: [teamPerformance.teamId],
    references: [teams.id],
  }),
  season: one(seasons, {
    fields: [teamPerformance.seasonId],
    references: [seasons.id],
  }),
}));

export const seatValuePredictionsRelations = relations(seatValuePredictions, ({ one }) => ({
  seat: one(seats, {
    fields: [seatValuePredictions.seatId],
    references: [seats.id],
  }),
  season: one(seasons, {
    fields: [seatValuePredictions.seasonId],
    references: [seasons.id],
  }),
}));

// Insert schemas
export const insertTeamSchema = createInsertSchema(teams).omit({ id: true, createdAt: true });
export const insertSeasonSchema = createInsertSchema(seasons).omit({ id: true, createdAt: true });
export const insertGameSchema = createInsertSchema(games).omit({ id: true, createdAt: true });
export const insertTicketHolderSchema = createInsertSchema(ticketHolders).omit({ id: true, createdAt: true });
export const insertSeatSchema = createInsertSchema(seats).omit({ id: true, createdAt: true });
export const insertSeatOwnershipSchema = createInsertSchema(seatOwnership).omit({ id: true, createdAt: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true });
export const insertPayoutSchema = createInsertSchema(payouts).omit({ id: true, createdAt: true });
export const insertTransferSchema = createInsertSchema(transfers).omit({ id: true, createdAt: true });
export const insertGameAttendanceSchema = createInsertSchema(gameAttendance).omit({ id: true, createdAt: true });
export const insertGamePricingSchema = createInsertSchema(gamePricing).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTeamPerformanceSchema = createInsertSchema(teamPerformance).omit({ id: true, createdAt: true, lastUpdated: true });
export const insertSeatValuePredictionSchema = createInsertSchema(seatValuePredictions).omit({ id: true, createdAt: true, calculatedAt: true });
export const insertLocalUserSchema = createInsertSchema(localUsers).omit({ id: true, createdAt: true, updatedAt: true });

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type LocalUser = typeof localUsers.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Season = typeof seasons.$inferSelect;
export type Game = typeof games.$inferSelect;
export type TicketHolder = typeof ticketHolders.$inferSelect;
export type Seat = typeof seats.$inferSelect;
export type SeatOwnership = typeof seatOwnership.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Payout = typeof payouts.$inferSelect;
export type Transfer = typeof transfers.$inferSelect;
export type GameAttendance = typeof gameAttendance.$inferSelect;
export type GamePricing = typeof gamePricing.$inferSelect;
export type TeamPerformance = typeof teamPerformance.$inferSelect;
export type SeatValuePrediction = typeof seatValuePredictions.$inferSelect;

export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type InsertSeason = z.infer<typeof insertSeasonSchema>;
export type InsertGame = z.infer<typeof insertGameSchema>;
export type InsertTicketHolder = z.infer<typeof insertTicketHolderSchema>;
export type InsertSeat = z.infer<typeof insertSeatSchema>;
export type InsertSeatOwnership = z.infer<typeof insertSeatOwnershipSchema>;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type InsertPayout = z.infer<typeof insertPayoutSchema>;
export type InsertTransfer = z.infer<typeof insertTransferSchema>;
export type InsertGameAttendance = z.infer<typeof insertGameAttendanceSchema>;
export type InsertGamePricing = z.infer<typeof insertGamePricingSchema>;
export type InsertTeamPerformance = z.infer<typeof insertTeamPerformanceSchema>;
export type InsertSeatValuePrediction = z.infer<typeof insertSeatValuePredictionSchema>;
export type InsertLocalUser = z.infer<typeof insertLocalUserSchema>;
