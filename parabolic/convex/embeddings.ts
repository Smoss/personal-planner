import { action } from "./_generated/server";
import { v } from "convex/values";
import { generateEmbedding, generateEmbeddings } from "./lib/embeddings";

/**
 * Action to generate a single embedding for the given text.
 * This is an action (not a query/mutation) so it can use fetch() to call Ollama.
 */
export const generateEmbeddingAction = action({
  args: { text: v.string() },
  handler: async (_ctx, { text }) => {
    const embedding = await generateEmbedding(text);
    return embedding;
  },
});

/**
 * Action to generate embeddings for multiple texts in batch.
 * This is an action (not a query/mutation) so it can use fetch() to call Ollama.
 */
export const generateEmbeddingsAction = action({
  args: { texts: v.array(v.string()) },
  handler: async (_ctx, { texts }) => {
    const embeddings = await generateEmbeddings(texts);
    return embeddings;
  },
});
