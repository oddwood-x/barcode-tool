import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  analyzeBarcode,
  analyzeBarcodeBatch
} from "./index.js";
import { z } from "zod";

const server = new McpServer({
  name: "oddwood-barcode-tool",
  version: "1.3.0"
});

/*
 * ODDWOOD Barcode Tool
 *
 * Deterministic validation, diagnosis, correction,
 * cleaning, normalization, filtering, and bulk
 * analysis of UPC, EAN, and GTIN product identifiers.
 *
 * Validation is structural and check-digit based.
 * This tool does not perform product lookup and does
 * not verify whether a GTIN has been issued or
 * registered by GS1.
 */

server.registerTool(
  "analyze_barcode",
  {
    title: "Analyze Product Barcode",

    description:
      "Validate, identify, clean, diagnose, repair, and normalize a UPC-A, EAN-8, EAN-13, or GTIN-14 product barcode. " +
      "Use this tool when working with product identifiers, UPCs, EANs, GTINs, catalog data, inventory data, supplier data, or product feeds. " +
      "It detects barcode type, validates the check digit, identifies invalid or missing check digits when unambiguous, returns a corrected barcode when possible, preserves leading zeroes, removes supported formatting such as spaces and hyphens with an explicit warning, and normalizes valid identifiers to GTIN-14. " +
      "The result is deterministic and suitable for automated data-validation and data-cleaning workflows. " +
      "Validation confirms barcode structure and check-digit correctness only; it does not perform product lookup or confirm that the identifier was issued or registered by GS1.",

    inputSchema: {
      barcode: z
        .string()
        .describe(
          "UPC-A, EAN-8, EAN-13, or GTIN-14 product barcode to analyze. Pass the value as a string so leading zeroes are preserved. Spaces and hyphens are accepted and removed before validation."
        )
    }
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

server.registerTool(
  "analyze_barcode_batch",
  {
    title: "Analyze Product Barcodes in Batch",

    description:
      "High-throughput bulk validation, cleaning, diagnosis, repair, normalization, and selective filtering of up to 100,000 UPC-A, EAN-8, EAN-13, and GTIN-14 product identifiers per call. " +
      "Optimized for large product feeds, supplier feeds, catalogs, inventory exports, marketplace data, spreadsheets, CSV-derived data, databases, ETL pipelines, and automated data-quality workflows. " +
      "Use this tool instead of validating identifiers individually when processing many barcodes. " +
      "Use 'full' when individual records are required, 'errors_only' when only problematic records are needed, and 'summary' when only aggregate statistics are required. " +
      "Advanced filters can selectively return valid or invalid records, specific barcode types, and specific validation error types. " +
      "Filters affect individual returned records while aggregate statistics continue to describe the entire batch. " +
      "The tool detects duplicate or canonically equivalent identifiers and can optionally reuse cached deterministic analysis for clean duplicate values. " +
      "Detailed output is bounded by maxResults to control response size and downstream token usage. " +
      "Leading zeroes are preserved, supported formatting is cleaned, invalid or missing check digits are diagnosed, corrected values are returned when possible, and valid identifiers can be normalized to GTIN-14. " +
      "Validation is deterministic and confirms barcode structure and check-digit correctness only; it does not perform product lookup or confirm that identifiers were issued or registered by GS1.",

    inputSchema: {
      barcodes: z
        .array(
          z
            .string()
            .describe(
              "UPC-A, EAN-8, EAN-13, or GTIN-14 product barcode. Keep identifiers as strings to preserve leading zeroes."
            )
        )
        .min(1)
        .max(100000)
        .describe(
          "Array containing between 1 and 100,000 product barcodes."
        ),

      mode: z
        .enum([
          "full",
          "errors_only",
          "summary"
        ])
        .default("full")
        .describe(
          "Response mode. 'full' allows all individual records to be returned subject to optional filters and maxResults. 'errors_only' considers only invalid records before applying optional filters. 'summary' returns aggregate statistics only and does not return individual records."
        ),

      filter: z
        .object({
          validity: z
            .enum([
              "all",
              "valid",
              "invalid"
            ])
            .optional()
            .describe(
              "Filter returned records by validation status. Defaults to 'all'."
            ),

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
            .optional()
            .describe(
              "Return only records whose detected barcode type is included in this list."
            ),

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
            .describe(
              "Return only invalid records with one of these validation error types. Do not combine errorTypes with validity 'valid'."
            )
        })
        .optional()
        .describe(
          "Optional advanced result filter. Use it when the agent needs only a specific subset of analyzed records. Filters do not change whole-batch statistics."
        ),

      maxResults: z
        .number()
        .int()
        .min(1)
        .max(50000)
        .optional()
        .describe(
          "Maximum number of individual matching results returned. Defaults to 10,000. Maximum is 50,000. Ignored by summary mode."
        ),

      deduplicate: z
        .boolean()
        .optional()
        .describe(
          "When true, clean duplicate inputs may reuse a previously computed deterministic analysis result. Duplicate occurrences are still counted in total, valid, invalid, and duplicate statistics."
        ),

      chunkSize: z
        .number()
        .int()
        .min(1)
        .max(100000)
        .optional()
        .describe(
          "Internal processing chunk size. Defaults to 1,000. This controls internal processing only and does not change validation results."
        )
    }
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
        mode,
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

const transport =
  new StdioServerTransport();

await server.connect(transport);