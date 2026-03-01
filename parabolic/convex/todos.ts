import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { GenericQueryCtx } from "convex/server";
import { generateEmbedding } from "./lib/embeddings";

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
export const search = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx: GenericQueryCtx<any>, { query, limit = 5 }) => {
    // Generate embedding for the search query
    const embedding = await generateEmbedding(query);

    // Perform vector search
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
export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    completed: v.optional(v.boolean()),
    doBy: v.optional(v.string()),
  },
  handler: async (ctx, { title, description, completed = false, doBy }) => {
    const now = Date.now();

    // Generate embedding for the todo (combine title and description)
    const textForEmbedding = description
      ? `${title} ${description}`
      : title;
    const embedding = await generateEmbedding(textForEmbedding);

    const todoId = await ctx.db.insert("todos", {
      title,
      description,
      completed,
      embedding,
      createdAt: now,
      updatedAt: now,
      doBy,
    });

    return todoId;
  },
});

// Mutation to update a todo
export const update = mutation({
  args: {
    id: v.id("todos"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    completed: v.optional(v.boolean()),
    doBy: v.optional(v.string()),
  },
  handler: async (ctx, { id, title, description, completed, doBy }) => {
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

    // Regenerate embedding if title or description changed
    if (title !== undefined || description !== undefined) {
      const newTitle = title ?? existing.title;
      const newDescription = description ?? existing.description;
      const textForEmbedding = newDescription
        ? `${newTitle} ${newDescription}`
        : newTitle;
      updates.embedding = await generateEmbedding(textForEmbedding);
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
