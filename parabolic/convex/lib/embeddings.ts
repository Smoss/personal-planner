import { generateOllamaEmbedding } from "./ollama";

const DEFAULT_EMBEDDING_MODEL = "nomic-embed-text-v2-moe:latest";
const EMBEDDING_DIMENSIONS = 768;

/**
 * Generate an embedding vector for the given text
 * Uses Ollama's nomic-embed-text-v2-moe model (768 dimensions)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const embedding = await generateOllamaEmbedding(text, DEFAULT_EMBEDDING_MODEL);

    // Validate dimensions
    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      console.warn(
        `Unexpected embedding dimensions: ${embedding.length}, expected ${EMBEDDING_DIMENSIONS}`
      );
    }

    return embedding;
  } catch (error) {
    console.error("Failed to generate embedding:", error);
    // Return zero vector as fallback (will allow storage but poor search results)
    return new Array(EMBEDDING_DIMENSIONS).fill(0);
  }
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map((text) => generateEmbedding(text)));
}

/**
 * Get the expected embedding dimensions
 */
export function getEmbeddingDimensions(): number {
  return EMBEDDING_DIMENSIONS;
}
