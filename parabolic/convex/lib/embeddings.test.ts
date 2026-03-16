import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateEmbedding, generateEmbeddingWithFallback, getEmbeddingDimensions } from "./embeddings";

vi.mock("./ollama", () => ({
  generateOllamaEmbedding: vi.fn(),
}));

import { generateOllamaEmbedding } from "./ollama";
const mockGenerateOllamaEmbedding = vi.mocked(generateOllamaEmbedding);

describe("embeddings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getEmbeddingDimensions", () => {
    it("returns 768", () => {
      expect(getEmbeddingDimensions()).toBe(768);
    });
  });

  describe("generateEmbedding", () => {
    it("returns embedding on success", async () => {
      const fakeEmbedding = new Array(768).fill(0.5);
      mockGenerateOllamaEmbedding.mockResolvedValue(fakeEmbedding);

      const result = await generateEmbedding("test text");
      expect(result).toBe(fakeEmbedding);
      expect(mockGenerateOllamaEmbedding).toHaveBeenCalledWith("test text", "nomic-embed-text-v2-moe:latest");
    });

    it("throws when Ollama fails", async () => {
      mockGenerateOllamaEmbedding.mockRejectedValue(new Error("Connection refused"));

      await expect(generateEmbedding("test")).rejects.toThrow("Connection refused");
    });

    it("warns on dimension mismatch but still returns", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const wrongDims = new Array(512).fill(0.1);
      mockGenerateOllamaEmbedding.mockResolvedValue(wrongDims);

      const result = await generateEmbedding("test");
      expect(result).toBe(wrongDims);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Unexpected embedding dimensions: 512")
      );
      warnSpy.mockRestore();
    });
  });

  describe("generateEmbeddingWithFallback", () => {
    it("returns embedding with degraded: false on success", async () => {
      const fakeEmbedding = new Array(768).fill(0.5);
      mockGenerateOllamaEmbedding.mockResolvedValue(fakeEmbedding);

      const result = await generateEmbeddingWithFallback("test");
      expect(result.embedding).toBe(fakeEmbedding);
      expect(result.degraded).toBe(false);
    });

    it("returns zero vector with degraded: true on failure", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockGenerateOllamaEmbedding.mockRejectedValue(new Error("fail"));

      const result = await generateEmbeddingWithFallback("test");
      expect(result.degraded).toBe(true);
      expect(result.embedding).toHaveLength(768);
      expect(result.embedding.every((v: number) => v === 0)).toBe(true);
      errorSpy.mockRestore();
    });
  });
});
