import { sql } from "drizzle-orm";
import { pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// YouTube Download schemas
export const downloadRequestSchema = z.object({
  url: z.string().url(),
  quality: z.string().optional().default("720p"),
  format: z.enum(["mp4", "mp3", "webm", "m4a"]).optional().default("mp4"),
});

export const videoInfoSchema = z.object({
  title: z.string(),
  thumbnail: z.string(),
  duration: z.string(),
  views: z.string(),
  channel: z.string(),
  uploadDate: z.string(),
  availableQualities: z.array(z.string()),
  availableFormats: z.array(z.string()),
});

export type DownloadRequest = z.infer<typeof downloadRequestSchema>;
export type VideoInfo = z.infer<typeof videoInfoSchema>;
