import assert from "node:assert/strict";
import test from "node:test";
import http from "node:http";

import { env } from "../../../src/config/env.js";
import { CustomRemoteEmbeddingProvider } from "../../../src/domain/planning/embedding-provider-custom.js";

test("CustomRemoteEmbeddingProvider requests OpenAI-compatible embeddings endpoint", async () => {
  const requests: Array<{ authorization: string | undefined; body: string }> = [];
  const server = http.createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      requests.push({
        authorization: request.headers.authorization,
        body,
      });
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({
        data: [
          { index: 1, embedding: [0, 1, 0] },
          { index: 0, embedding: [1, 0, 0] },
        ],
      }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind test server");
  }

  const originalConfig = {
    baseUrl: env.CUSTOM_EMBEDDING_BASE_URL,
    apiKey: env.CUSTOM_EMBEDDING_API_KEY,
    model: env.CUSTOM_EMBEDDING_MODEL,
    path: env.CUSTOM_EMBEDDING_PATH,
  };
  env.CUSTOM_EMBEDDING_BASE_URL = `http://127.0.0.1:${address.port}`;
  env.CUSTOM_EMBEDDING_API_KEY = "test-key";
  env.CUSTOM_EMBEDDING_MODEL = "remote-embed-v1";
  env.CUSTOM_EMBEDDING_PATH = "/embeddings";

  try {
    const provider = new CustomRemoteEmbeddingProvider();
    const vectors = await provider.embedBatch(["first", "second"]);

    assert.deepEqual(vectors, [[1, 0, 0], [0, 1, 0]]);
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.authorization, "Bearer test-key");
    assert.match(requests[0]?.body ?? "", /"model":"remote-embed-v1"/);
    assert.match(requests[0]?.body ?? "", /"input":\["first","second"\]/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    env.CUSTOM_EMBEDDING_BASE_URL = originalConfig.baseUrl;
    env.CUSTOM_EMBEDDING_API_KEY = originalConfig.apiKey;
    env.CUSTOM_EMBEDDING_MODEL = originalConfig.model;
    env.CUSTOM_EMBEDDING_PATH = originalConfig.path;
  }
});

test("CustomRemoteEmbeddingProvider fails fast when api key is missing", async () => {
  const originalConfig = {
    baseUrl: env.CUSTOM_EMBEDDING_BASE_URL,
    apiKey: env.CUSTOM_EMBEDDING_API_KEY,
  };

  env.CUSTOM_EMBEDDING_BASE_URL = "https://example.com/v1";
  env.CUSTOM_EMBEDDING_API_KEY = "";

  try {
    const provider = new CustomRemoteEmbeddingProvider();
    await assert.rejects(
      provider.embedBatch(["first"]),
      /CUSTOM_EMBEDDING_API_KEY is required when PLANNING_RETRIEVAL_EMBEDDING_PROVIDER=custom/,
    );
  } finally {
    env.CUSTOM_EMBEDDING_BASE_URL = originalConfig.baseUrl;
    env.CUSTOM_EMBEDDING_API_KEY = originalConfig.apiKey;
  }
});
