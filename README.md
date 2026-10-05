# ODDWOOD Barcode Tool

A paid MCP tool for deterministic barcode validation, normalization, and batch analysis.

Built for AI agents and automated workflows that need reliable EAN, UPC, and GTIN processing without spending model reasoning on checksum calculations or large barcode datasets.

## Public MCP Endpoint

```text
https://barcode-tool.fly.dev/mcp
```

**Transport:** Streamable HTTP MCP  
**Payment:** x402  
**Network:** Base  
**Currency:** USDC

## Supported Barcode Types

- EAN-8
- UPC-A
- EAN-13
- GTIN-14

Leading zeros are preserved.

Spaces and hyphens can be safely removed during normalization, with a warning returned in the result.

## Tools

### `analyze_barcode`

Validates and analyzes a single barcode.

**Price:** $0.001 USDC per call

Capabilities:

- Barcode type recognition
- GTIN check digit validation
- Expected vs. actual check digit reporting
- Corrected barcode suggestion for invalid check digits
- Detection of unambiguous missing check digits
- GTIN-14 normalization
- Safe formatting cleanup
- Structured errors and warnings

Example input:

```json
{
  "barcode": "036000291452"
}
```

Example result:

```json
{
  "input": "036000291452",
  "cleanedInput": "036000291452",
  "type": "UPC-A",
  "valid": true,
  "error": null,
  "warnings": [],
  "actualCheckDigit": 2,
  "expectedCheckDigit": 2,
  "correctedBarcode": null,
  "gtin14": "00036000291452"
}
```

---

### `analyze_barcode_batch`

Validates and analyzes up to **100,000 barcodes in one request**.

**Price:** $0.003 USDC per call

Capabilities:

- Batch validation
- Duplicate detection
- Optional deduplication
- Error statistics
- Barcode type statistics
- Internal chunk processing
- Configurable result limits
- Selective result filtering

Output modes:

- `full`
- `errors_only`
- `summary`

Results can be filtered by:

- Validity
- Barcode type
- Validation error type

Supported validation error types:

- `invalid_check_digit`
- `missing_check_digit`
- `invalid_length`
- `invalid_characters`
- `empty_input`
- `other`

The maximum batch size is **100,000 barcodes**.

The default detailed result limit is **10,000 records**, with a hard maximum of **50,000 detailed results**.

## x402 Payments

Tool calls use the x402 payment protocol.

Payments use **USDC on Base**.

| Tool | Price |
|---|---:|
| `analyze_barcode` | $0.001 USDC |
| `analyze_barcode_batch` | $0.003 USDC |

Payment is handled automatically by x402-compatible clients.

## Health Endpoint

```text
https://barcode-tool.fly.dev/health
```

The health endpoint reports service status, configured network, payment receiver, and current tool prices.

## Privacy

The service is designed to process barcode values and does not require personal information.

Do not submit secrets, credentials, private keys, access tokens, or other sensitive information as barcode input.

## Development

Requirements:

- Node.js 24+
- npm

Install dependencies:

```bash
npm install
```

Run the local stdio MCP server:

```bash
node server.js
```

Run the free local HTTP MCP server:

```bash
node remote-server.js
```

Run the x402-enabled server:

```bash
node paid-server.js
```

Run tests:

```bash
node test.js
node filter-test.js
node stress-test.js
```

## License

ISC

## Developer

ODDWOOD