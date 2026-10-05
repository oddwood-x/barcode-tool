import express from "express";
import crypto from "node:crypto";

import {
  McpServer
} from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  StreamableHTTPServerTransport
} from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import {
  analyzeBarcode,
  analyzeBarcodeBatch
} from "./index.js";

import { z } from "zod";

const PORT = process.env.PORT || 3000;

const app = express();

app.use(express.json());

function createServer() {
  const server = new McpServer({
    name: "oddwood-barcode-tool",
    version: "1.3.0"
  });

  server.tool(
    "analyze_barcode",
    "Validate and analyze a single EAN-8, UPC-A, EAN-13, or GTIN-14 barcode. Checks the GTIN check digit, detects common missing check digits, preserves leading zeros, safely removes spaces and hyphens, and returns GTIN-14 normalization when possible.",
    {
      barcode: z
        .string()
        .describe(
          "Barcode value to validate and analyze."
        )
    },
    async ({ barcode }) => {
      const result =
        analyzeBarcode(barcode);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result)
          }
        ]
      };
    }
  );

  server.tool(
    "analyze_barcode_batch",
    "Validate and analyze up to 100,000 EAN-8, UPC-A, EAN-13, or GTIN-14 barcodes in one request. Supports full results, errors-only results, aggregate summaries, duplicate detection, optional deduplication, selective filtering by validity, barcode type, and validation error type, and configurable result limits.",
    {
      barcodes: z
        .array(z.string())
        .min(1)
        .max(100000)
        .describe(
          "Barcode values to validate and analyze."
        ),

      mode: z
        .enum([
          "full",
          "errors_only",
          "summary"
        ])
        .optional()
        .describe(
          "Output mode. Defaults to full."
        ),

      filter: z
        .object({
          validity: z
            .enum([
              "all",
              "valid",
              "invalid"
            ])
            .optional(),

          types: z
            .array(
              z.enum([
                "EAN-8",
                "UPC-A",
                "EAN-13",
                "GTIN-14",
                "Unknown"
              ])
            )
            .min(1)
            .optional(),

          errorTypes: z
            .array(
              z.enum([
                "invalid_check_digit",
                "missing_check_digit",
                "invalid_length",
                "invalid_characters",
                "empty_input",
                "other"
              ])
            )
            .min(1)
            .optional()
        })
        .optional()
        .describe(
          "Optional advanced result filter. Filters affect returned individual records while aggregate statistics still describe the entire batch."
        ),

      maxResults: z
        .number()
        .int()
        .min(1)
        .max(50000)
        .optional()
        .describe(
          "Maximum number of individual results returned. Defaults to 10,000 and cannot exceed 50,000."
        ),

      deduplicate: z
        .boolean()
        .optional()
        .describe(
          "Enable duplicate-result caching during processing."
        ),

      chunkSize: z
        .number()
        .int()
        .min(1)
        .max(100000)
        .optional()
        .describe(
          "Internal processing chunk size. Defaults to 1,000."
        )
    },
    async ({
      barcodes,
      mode,
      filter,
      maxResults,
      deduplicate,
      chunkSize
    }) => {
      const result =
        analyzeBarcodeBatch(
          barcodes,
          mode ?? "full",
          {
            filter,
            maxResults,
            deduplicate,
            chunkSize
          }
        );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result)
          }
        ]
      };
    }
  );

  return server;
}

app.post("/mcp", async (req, res) => {
  const server = createServer();

  const transport =
    new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);

    await transport.handleRequest(
      req,
      res,
      req.body
    );
  } catch (error) {
    console.error(
      "MCP request failed:",
      error
    );

    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error"
        },
        id: null
      });
    }
  }
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "oddwood-barcode-tool"
  });
});

app.get("/mcp", (req, res) => {
  res.status(405).json({
    error:
      "Method not allowed. Use POST /mcp."
  });
});

app.delete("/mcp", (req, res) => {
  res.status(405).json({
    error:
      "Method not allowed."
  });
});

app.listen(PORT, () => {
  console.log(
    `ODDWOOD Barcode Tool remote MCP server running on http://localhost:${PORT}/mcp`
  );

  console.log(
    `Health check: http://localhost:${PORT}/health`
  );
});