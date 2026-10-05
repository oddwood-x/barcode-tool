import "dotenv/config";

import express from "express";

import {
  McpServer
} from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  StreamableHTTPServerTransport
} from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import {
  createPaymentWrapper,
  x402ResourceServer
} from "@x402/mcp";

import {
  ExactEvmScheme
} from "@x402/evm/exact/server";

import {
  createCdpFacilitatorClient
} from "@coinbase/cdp-sdk/x402";

import {
  analyzeBarcode,
  analyzeBarcodeBatch
} from "./index.js";

import { z } from "zod";


const PORT =
  Number(process.env.PORT || 3001);

const NETWORK =
  process.env.X402_NETWORK;

const PAY_TO =
  process.env.X402_PAY_TO;

const SINGLE_PRICE =
  process.env.X402_SINGLE_PRICE;

const BATCH_PRICE =
  process.env.X402_BATCH_PRICE;

const CDP_API_KEY_ID =
  process.env.CDP_API_KEY_ID;

const CDP_API_KEY_SECRET =
  process.env.CDP_API_KEY_SECRET;


const requiredConfig = {
  X402_NETWORK: NETWORK,
  X402_PAY_TO: PAY_TO,
  X402_SINGLE_PRICE: SINGLE_PRICE,
  X402_BATCH_PRICE: BATCH_PRICE,
  CDP_API_KEY_ID,
  CDP_API_KEY_SECRET
};


for (
  const [name, value]
  of Object.entries(requiredConfig)
) {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`
    );
  }
}


const facilitatorClient =
  createCdpFacilitatorClient();

const resourceServer =
  new x402ResourceServer(
    facilitatorClient
  );


resourceServer.register(
  NETWORK,
  new ExactEvmScheme()
);

await resourceServer.initialize();


const singleAccepts =
  await resourceServer.buildPaymentRequirements({
    scheme: "exact",
    network: NETWORK,
    payTo: PAY_TO,
    price: SINGLE_PRICE
  });


const batchAccepts =
  await resourceServer.buildPaymentRequirements({
    scheme: "exact",
    network: NETWORK,
    payTo: PAY_TO,
    price: BATCH_PRICE
  });


const paidSingle =
  createPaymentWrapper(
    resourceServer,
    {
      accepts: singleAccepts,
      resource: {
        url: "mcp://tool/analyze_barcode",
        description:
          "Validate and analyze a single barcode.",
        mimeType: "application/json"
      }
    }
  );


const paidBatch =
  createPaymentWrapper(
    resourceServer,
    {
      accepts: batchAccepts,
      resource: {
        url: "mcp://tool/analyze_barcode_batch",
        description:
          "Validate and analyze a batch of barcodes.",
        mimeType: "application/json"
      }
    }
  );


const app = express();

app.use(express.json());


function logEvent(
  event,
  details = {}
) {
  console.log(
    JSON.stringify({
      timestamp:
        new Date().toISOString(),
      event,
      ...details
    })
  );
}


function getMcpRequestInfo(body) {
  if (!body || typeof body !== "object") {
    return {
      method: "unknown",
      tool: null
    };
  }

  const method =
    typeof body.method === "string"
      ? body.method
      : "unknown";

  let tool = null;

  if (
    method === "tools/call" &&
    body.params &&
    typeof body.params.name === "string"
  ) {
    tool = body.params.name;
  }

  return {
    method,
    tool
  };
}


function createServer() {

  const server =
    new McpServer({
      name: "oddwood-barcode-tool",
      version: "1.3.0"
    });


  server.tool(
    "analyze_barcode",

    "Validate and analyze a single EAN-8, UPC-A, EAN-13, or GTIN-14 barcode. Checks the GTIN check digit, detects common missing check digits, preserves leading zeros, safely removes spaces and hyphens, and returns GTIN-14 normalization when possible. Price: $0.001 USDC per call.",

    {
      barcode: z
        .string()
        .describe(
          "Barcode value to validate and analyze."
        )
    },

    paidSingle(
      async ({ barcode }) => {

        const startedAt =
          performance.now();

        logEvent(
          "paid_tool_execution_started",
          {
            tool:
              "analyze_barcode"
          }
        );

        try {

          const result =
            analyzeBarcode(barcode);

          const durationMs =
            Number(
              (
                performance.now() -
                startedAt
              ).toFixed(2)
            );

          logEvent(
            "paid_tool_execution_completed",
            {
              tool:
                "analyze_barcode",
              success: true,
              durationMs
            }
          );

          return {
            content: [
              {
                type: "text",
                text:
                  JSON.stringify(result)
              }
            ]
          };

        } catch (error) {

          const durationMs =
            Number(
              (
                performance.now() -
                startedAt
              ).toFixed(2)
            );

          logEvent(
            "paid_tool_execution_failed",
            {
              tool:
                "analyze_barcode",
              success: false,
              durationMs,
              error:
                error instanceof Error
                  ? error.name
                  : "UnknownError"
            }
          );

          throw error;
        }
      }
    )
  );


  server.tool(
    "analyze_barcode_batch",

    "Validate and analyze up to 100,000 EAN-8, UPC-A, EAN-13, or GTIN-14 barcodes in one request. Supports full results, errors-only results, aggregate summaries, duplicate detection, optional deduplication, selective filtering by validity, barcode type, and validation error type, and configurable result limits. Price: $0.003 USDC per call.",

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

    paidBatch(
      async ({
        barcodes,
        mode,
        filter,
        maxResults,
        deduplicate,
        chunkSize
      }) => {

        const startedAt =
          performance.now();

        logEvent(
          "paid_tool_execution_started",
          {
            tool:
              "analyze_barcode_batch",
            batchItemCount:
              barcodes.length
          }
        );

        try {

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

          const durationMs =
            Number(
              (
                performance.now() -
                startedAt
              ).toFixed(2)
            );

          logEvent(
            "paid_tool_execution_completed",
            {
              tool:
                "analyze_barcode_batch",
              success: true,
              batchItemCount:
                barcodes.length,
              durationMs
            }
          );

          return {
            content: [
              {
                type: "text",
                text:
                  JSON.stringify(result)
              }
            ]
          };

        } catch (error) {

          const durationMs =
            Number(
              (
                performance.now() -
                startedAt
              ).toFixed(2)
            );

          logEvent(
            "paid_tool_execution_failed",
            {
              tool:
                "analyze_barcode_batch",
              success: false,
              batchItemCount:
                barcodes.length,
              durationMs,
              error:
                error instanceof Error
                  ? error.name
                  : "UnknownError"
            }
          );

          throw error;
        }
      }
    )
  );


  return server;
}


app.post(
  "/mcp",
  async (req, res) => {

    const requestStartedAt =
      performance.now();

    const {
      method,
      tool
    } = getMcpRequestInfo(
      req.body
    );

    logEvent(
      "mcp_request_received",
      {
        httpMethod:
          req.method,
        path:
          req.path,
        mcpMethod:
          method,
        tool
      }
    );


    const server =
      createServer();

    const transport =
      new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined
      });


    res.on(
      "finish",
      () => {

        const durationMs =
          Number(
            (
              performance.now() -
              requestStartedAt
            ).toFixed(2)
          );

        logEvent(
          "mcp_request_completed",
          {
            httpMethod:
              req.method,
            path:
              req.path,
            mcpMethod:
              method,
            tool,
            statusCode:
              res.statusCode,
            durationMs
          }
        );
      }
    );


    res.on(
      "close",
      () => {
        transport.close();
        server.close();
      }
    );


    try {

      await server.connect(
        transport
      );

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

      logEvent(
        "mcp_request_failed",
        {
          httpMethod:
            req.method,
          path:
            req.path,
          mcpMethod:
            method,
          tool,
          error:
            error instanceof Error
              ? error.name
              : "UnknownError"
        }
      );

      if (!res.headersSent) {

        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message:
              "Internal server error"
          },
          id: null
        });
      }
    }
  }
);


app.get(
  "/health",
  (req, res) => {

    logEvent(
      "health_request",
      {
        httpMethod:
          req.method,
        path:
          req.path
      }
    );

    res.json({
      status: "ok",
      service:
        "oddwood-barcode-tool-paid",
      network: NETWORK,
      payTo: PAY_TO,
      prices: {
        analyze_barcode:
          SINGLE_PRICE,
        analyze_barcode_batch:
          BATCH_PRICE
      }
    });
  }
);


app.get(
  "/mcp",
  (req, res) => {

    logEvent(
      "unsupported_mcp_request",
      {
        httpMethod:
          req.method,
        path:
          req.path
      }
    );

    res.status(405).json({
      error:
        "Method not allowed. Use POST /mcp."
    });
  }
);


app.delete(
  "/mcp",
  (req, res) => {

    logEvent(
      "unsupported_mcp_request",
      {
        httpMethod:
          req.method,
        path:
          req.path
      }
    );

    res.status(405).json({
      error:
        "Method not allowed."
    });
  }
);


app.listen(
  PORT,
  () => {

    console.log(
      `ODDWOOD paid MCP server running on port ${PORT}`
    );

    console.log(
      `Network: ${NETWORK}`
    );

    console.log(
      `Payment receiver: ${PAY_TO}`
    );

    console.log(
      `analyze_barcode: ${SINGLE_PRICE}`
    );

    console.log(
      `analyze_barcode_batch: ${BATCH_PRICE}`
    );

    logEvent(
      "server_started",
      {
        port: PORT,
        network: NETWORK
      }
    );
  }
);