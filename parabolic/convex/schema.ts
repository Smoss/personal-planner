import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  todos: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    completed: v.boolean(),
    embedding: v.optional(v.array(v.float64())),  // 768-dim vector for nomic-embed-text-v2-moe
    createdAt: v.number(),  // Unix timestamp in milliseconds
    updatedAt: v.number(),
  })
    .vectorIndex("embedding", {
      vectorField: "embedding",
      dimensions: 768,  // nomic-embed-text-v2-moe produces 768-dimensional embeddings
    }),
});
