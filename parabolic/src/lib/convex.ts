import { ConvexReactClient } from "convex/react";
import type { Doc } from "../../convex/_generated/dataModel";

// Create a Convex client instance
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
}

export const convex = new ConvexReactClient(convexUrl);

// Export types for use in components
export type { Suggestion } from "../../convex/agent";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// Use Convex's generated types
export type Todo = Doc<"todos">;

export interface TodoCreate {
  title: string;
  description?: string;
  completed?: boolean;
}

export interface TodoUpdate {
  title?: string;
  description?: string;
  completed?: boolean;
}
