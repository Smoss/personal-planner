import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { GenericQueryCtx } from "convex/server";
import { sortTodosByDoByDate } from "./lib/todoSort";

// Query to get all todos, ordered by creation date
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const todos = await ctx.db
      .query("todos")
      .order("desc")
      .take(100);
    return todos;
  },
});

// Query to get all todos, sorted by doBy date (tasks without doBy appear last)
export const getAllByDoByDate = query({
  args: {},
  handler: async (ctx) => {
    const todos = await ctx.db
      .query("todos")
      .take(100);

    return todos.sort(sortTodosByDoByDate);
  },
});

// Query to get a single todo by ID
export const getById = query({
  args: { id: v.id("todos") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

// Vector search result type
interface VectorSearchResult {
  _id: string;
  _score: number;
}

// Query to search todos by semantic similarity
// Note: The embedding must be pre-computed using the generateEmbeddingAction
export const search = query({
  args: { embedding: v.array(v.number()), limit: v.optional(v.number()) },
  handler: async (ctx: GenericQueryCtx<any>, { embedding, limit = 5 }) => {
    // Perform vector search using the pre-computed embedding
    const results = await (ctx as any).vectorSearch("todos", "embedding", {
      vector: embedding,
      limit,
    }) as VectorSearchResult[];

    // Fetch full todo documents
    const todos = await Promise.all(
      results.map(async (result: VectorSearchResult) => {
        const todo = await ctx.db.get(result._id as unknown as any);
        if (!todo) return null;
        return {
          ...todo,
          similarity: 1 - result._score, // Convert distance to similarity
        };
      })
    );

    return todos.filter((todo: (typeof todos)[number]): todo is NonNullable<typeof todo> => todo !== null);
  },
});

// Mutation to create a new todo
// Note: The embedding should be pre-computed using the generateEmbeddingAction
export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    completed: v.optional(v.boolean()),
    doBy: v.optional(v.string()),
    embedding: v.optional(v.array(v.number())),
  },
  handler: async (ctx, { title, description, completed = false, doBy, embedding }) => {
    const now = Date.now();

    // Use provided embedding or default to zero vector
    // (Callers should pre-compute embedding using generateEmbeddingAction)
    const finalEmbedding = embedding ?? new Array(768).fill(0);

    const todoId = await ctx.db.insert("todos", {
      title,
      description,
      completed,
      embedding: finalEmbedding,
      createdAt: now,
      updatedAt: now,
      doBy,
    });

    return todoId;
  },
});

// Mutation to update a todo
// Note: If title/description changes, provide a new embedding via generateEmbeddingAction
export const update = mutation({
  args: {
    id: v.id("todos"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    completed: v.optional(v.boolean()),
    doBy: v.optional(v.string()),
    embedding: v.optional(v.array(v.number())),
  },
  handler: async (ctx, { id, title, description, completed, doBy, embedding }) => {
    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error(`Todo with id ${id} not found`);
    }

    const updates: Partial<typeof existing> = {
      updatedAt: Date.now(),
    };

    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (completed !== undefined) updates.completed = completed;
    if (doBy !== undefined) updates.doBy = doBy;

    // Use provided embedding if title or description changed
    // (Callers should pre-compute embedding using generateEmbeddingAction)
    if (embedding !== undefined) {
      updates.embedding = embedding;
    }

    await ctx.db.patch(id, updates);
    return await ctx.db.get(id);
  },
});

// Mutation to delete a todo
export const remove = mutation({
  args: { id: v.id("todos") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return id;
  },
});

// Mutation to toggle todo completion status
export const toggle = mutation({
  args: { id: v.id("todos") },
  handler: async (ctx, { id }) => {
    const todo = await ctx.db.get(id);
    if (!todo) {
      throw new Error(`Todo with id ${id} not found`);
    }

    await ctx.db.patch(id, {
      completed: !todo.completed,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(id);
  },
});
