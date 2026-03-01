// Ollama client configuration and utilities

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

export interface OllamaMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  tools?: OllamaTool[];
}

export interface OllamaTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export interface OllamaChatResponse {
  message: {
    role: string;
    content: string;
    tool_calls?: Array<{
      id: string;
      type: string;
      function: {
        name: string;
        arguments: string;
      };
    }>;
  };
  done: boolean;
}

export interface OllamaEmbeddingRequest {
  model: string;
  prompt: string;
}

export interface OllamaEmbeddingResponse {
  embedding: number[];
}

/**
 * Get the Ollama base URL
 * For local development, this might need to use ngrok or similar tunnel
 */
export function getOllamaBaseUrl(): string {
  return OLLAMA_BASE_URL;
}

/**
 * Call Ollama chat endpoint
 */
export async function callOllamaChat(
  request: OllamaChatRequest
): Promise<OllamaChatResponse> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Ollama chat failed: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Stream chat from Ollama
 * Returns a ReadableStream for streaming responses
 */
export async function streamOllamaChat(
  request: Omit<OllamaChatRequest, "stream">
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...request,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama streaming chat failed: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error("No response body from Ollama");
  }

  return response.body;
}

/**
 * Generate embeddings using Ollama
 */
export async function generateOllamaEmbedding(
  text: string,
  model: string = "nomic-embed-text-v2-moe:latest"
): Promise<number[]> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama embeddings failed: ${response.statusText}`);
  }

  const data: OllamaEmbeddingResponse = await response.json();
  return data.embedding;
}
