import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const analysesTable = pgTable("analyses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  githubUrl: text("github_url").notNull(),
  level: text("level").notNull().$type<"beginner" | "intermediate" | "advanced">(),
  status: text("status").notNull().default("pending").$type<"pending" | "processing" | "completed" | "failed">(),
  summary: text("summary"),
  architecture: text("architecture"),
  keyFunctions: text("key_functions"),
  dataFlow: text("data_flow"),
  walkthrough: text("walkthrough"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAnalysisSchema = createInsertSchema(analysesTable).omit({
  id: true,
  status: true,
  summary: true,
  architecture: true,
  keyFunctions: true,
  dataFlow: true,
  walkthrough: true,
  errorMessage: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analysesTable.$inferSelect;
