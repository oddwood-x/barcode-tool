import {
  analyzeBarcode,
  analyzeBarcodeBatch,
  MAX_BATCH_SIZE,
  DEFAULT_MAX_RESULTS,
  MAX_RESULT_LIMIT
} from "./index.js";

let passed = 0;
let failed = 0;

function assert(name, condition) {
  if (condition) {
    console.log(`PASS - ${name}`);
    passed++;
  } else {
    console.log(`FAIL - ${name}`);
    failed++;
  }
}

function calculateCheckDigit(body) {
  let sum = 0;
  let multiplyByThree = true;

  for (let i = body.length - 1; i >= 0; i--) {
    const digit = body.charCodeAt(i) - 48;

    sum += multiplyByThree
      ? digit * 3
      : digit;

    multiplyByThree = !multiplyByThree;
  }

  return (10 - (sum % 10)) % 10;
}

function makeEAN13(number) {
  const body = String(number)
    .padStart(12, "0")
    .slice(-12);

  return body + calculateCheckDigit(body);
}

function makeInvalidEAN13(number) {
  const valid = makeEAN13(number);

  const correctDigit =
    Number(valid.at(-1));

  const wrongDigit =
    (correctDigit + 1) % 10;

  return (
    valid.slice(0, -1) +
    String(wrongDigit)
  );
}

function timedRun(label, fn) {
  const start =
    process.hrtime.bigint();

  const result = fn();

  const end =
    process.hrtime.bigint();

  const ms =
    Number(end - start) / 1e6;

  console.log(
    `${label}: ${ms.toFixed(3)} ms`
  );

  return result;
}

console.log(
  "\n--- ODDWOOD BARCODE STRESS TEST ---"
);

console.log(
  `MAX_BATCH_SIZE: ${MAX_BATCH_SIZE}`
);

console.log(
  `DEFAULT_MAX_RESULTS: ${DEFAULT_MAX_RESULTS}`
);

console.log(
  `MAX_RESULT_LIMIT: ${MAX_RESULT_LIMIT}`
);

/*
 * Generate 100,000 unique valid EAN-13 values.
 */

console.log(
  "\nGenerating 100,000 valid barcodes..."
);

const valid100k =
  Array.from(
    { length: 100000 },
    (_, i) => makeEAN13(i)
  );

/*
 * 1. 100k valid summary
 */

const validSummary =
  timedRun(
    "100k valid summary",
    () =>
      analyzeBarcodeBatch(
        valid100k,
        "summary"
      )
  );

assert(
  "100k valid summary counts",
  validSummary.total === 100000 &&
  validSummary.validCount === 100000 &&
  validSummary.invalidCount === 0 &&
  validSummary.uniqueCount === 100000 &&
  validSummary.duplicateCount === 0
);

/*
 * 2. 100k valid errors_only
 */

const validErrorsOnly =
  timedRun(
    "100k valid errors_only",
    () =>
      analyzeBarcodeBatch(
        valid100k,
        "errors_only"
      )
  );

assert(
  "100k valid errors_only returns zero",
  validErrorsOnly.matchedResultCount === 0 &&
  validErrorsOnly.returnedResultCount === 0 &&
  validErrorsOnly.truncated === false
);

/*
 * Generate 100,000 invalid values.
 */

console.log(
  "\nGenerating 100,000 invalid barcodes..."
);

const invalid100k =
  Array.from(
    { length: 100000 },
    (_, i) => makeInvalidEAN13(i)
  );

/*
 * 3. 100k invalid summary
 */

const invalidSummary =
  timedRun(
    "100k invalid summary",
    () =>
      analyzeBarcodeBatch(
        invalid100k,
        "summary"
      )
  );

assert(
  "100k invalid summary counts",
  invalidSummary.total === 100000 &&
  invalidSummary.validCount === 0 &&
  invalidSummary.invalidCount === 100000 &&
  invalidSummary.errorStatistics
    .invalid_check_digit === 100000
);

/*
 * 4. Default result limit
 */

const defaultLimit =
  timedRun(
    "100k invalid default full",
    () =>
      analyzeBarcodeBatch(
        invalid100k,
        "full"
      )
  );

assert(
  "Default 10k result limit",
  defaultLimit.matchedResultCount === 100000 &&
  defaultLimit.returnedResultCount === 10000 &&
  defaultLimit.truncated === true
);

/*
 * 5. Explicit 50k result limit
 */

const maxLimit =
  timedRun(
    "100k invalid 50k result limit",
    () =>
      analyzeBarcodeBatch(
        invalid100k,
        "full",
        {
          maxResults: 50000
        }
      )
  );

assert(
  "Explicit 50k result limit",
  maxLimit.matchedResultCount === 100000 &&
  maxLimit.returnedResultCount === 50000 &&
  maxLimit.truncated === true
);

/*
 * 6. Requests above maxResults are clamped.
 */

const aboveMaxLimit =
  analyzeBarcodeBatch(
    invalid100k,
    "full",
    {
      maxResults: 999999
    }
  );

assert(
  "Result limit clamps to 50k",
  aboveMaxLimit.returnedResultCount ===
    50000 &&
  aboveMaxLimit.truncated === true
);

/*
 * 7. Batch above 100k must be rejected.
 */

const tooLarge =
  analyzeBarcodeBatch(
    [
      ...valid100k,
      makeEAN13(100001)
    ],
    "summary"
  );

assert(
  "Reject 100001 records",
  tooLarge.error?.code ===
    "batch_limit_exceeded"
);

/*
 * 8. 100k identical duplicates.
 */

const duplicate100k =
  Array(100000).fill(
    "036000291452"
  );

const duplicateSummary =
  timedRun(
    "100k duplicate summary",
    () =>
      analyzeBarcodeBatch(
        duplicate100k,
        "summary"
      )
  );

assert(
  "100k duplicate detection",
  duplicateSummary.total === 100000 &&
  duplicateSummary.uniqueCount === 1 &&
  duplicateSummary.duplicateCount === 99999 &&
  duplicateSummary.validCount === 100000
);

/*
 * 9. Canonical duplicate detection.
 */

const canonical =
  analyzeBarcodeBatch(
    [
      "036000291452",
      "036-000-291-452",
      "036 000 291 452"
    ],
    "full"
  );

assert(
  "Canonical duplicate detection",
  canonical.uniqueCount === 1 &&
  canonical.duplicateCount === 2
);

/*
 * 10. Formatting warnings must survive
 * deduplication.
 */

const canonicalDedup =
  analyzeBarcodeBatch(
    [
      "036000291452",
      "036-000-291-452"
    ],
    "full",
    {
      deduplicate: true
    }
  );

assert(
  "Formatting warning survives dedup",
  canonicalDedup.results[1]
    .warnings
    .some(
      warning =>
        warning.code ===
        "formatting_removed"
    )
);

/*
 * 11. Dedup ON and OFF must produce
 * identical aggregate counts.
 */

const duplicateNoCache =
  analyzeBarcodeBatch(
    duplicate100k,
    "summary",
    {
      deduplicate: false
    }
  );

const duplicateWithCache =
  analyzeBarcodeBatch(
    duplicate100k,
    "summary",
    {
      deduplicate: true
    }
  );

assert(
  "Dedup ON/OFF statistics identical",
  duplicateNoCache.total ===
    duplicateWithCache.total &&
  duplicateNoCache.validCount ===
    duplicateWithCache.validCount &&
  duplicateNoCache.invalidCount ===
    duplicateWithCache.invalidCount &&
  duplicateNoCache.uniqueCount ===
    duplicateWithCache.uniqueCount &&
  duplicateNoCache.duplicateCount ===
    duplicateWithCache.duplicateCount
);

/*
 * 12. Different chunk sizes must not
 * change results.
 */

const chunkSizes = [
  1,
  100,
  1000,
  10000,
  100000
];

const chunkResults =
  chunkSizes.map(
    chunkSize =>
      analyzeBarcodeBatch(
        valid100k,
        "summary",
        {
          chunkSize
        }
      )
  );

assert(
  "Chunk sizes produce identical counts",
  chunkResults.every(
    result =>
      result.total === 100000 &&
      result.validCount === 100000 &&
      result.invalidCount === 0 &&
      result.uniqueCount === 100000
  )
);

/*
 * 13. Large advanced filter.
 *
 * 50k valid + 50k invalid.
 */

const mixed100k = [];

for (let i = 0; i < 50000; i++) {
  mixed100k.push(
    makeEAN13(i)
  );

  mixed100k.push(
    makeInvalidEAN13(
      i + 50000
    )
  );
}

const filteredInvalid =
  timedRun(
    "100k advanced invalid filter",
    () =>
      analyzeBarcodeBatch(
        mixed100k,
        "full",
        {
          filter: {
            validity: "invalid",
            errorTypes: [
              "invalid_check_digit"
            ]
          },
          maxResults: 50000
        }
      )
  );

assert(
  "100k advanced filter counts",
  filteredInvalid.total === 100000 &&
  filteredInvalid.validCount === 50000 &&
  filteredInvalid.invalidCount === 50000 &&
  filteredInvalid.matchedResultCount ===
    50000 &&
  filteredInvalid.returnedResultCount ===
    50000 &&
  filteredInvalid.truncated === false
);

/*
 * 14. Filter truncation at scale.
 */

const filteredTruncated =
  analyzeBarcodeBatch(
    mixed100k,
    "full",
    {
      filter: {
        validity: "invalid"
      },
      maxResults: 1000
    }
  );

assert(
  "100k filtered truncation",
  filteredTruncated.matchedResultCount ===
    50000 &&
  filteredTruncated.returnedResultCount ===
    1000 &&
  filteredTruncated.truncated === true
);

/*
 * 15. errors_only + error filter.
 */

const errorsFiltered =
  analyzeBarcodeBatch(
    mixed100k,
    "errors_only",
    {
      filter: {
        errorTypes: [
          "invalid_check_digit"
        ]
      },
      maxResults: 50000
    }
  );

assert(
  "errors_only advanced filter at scale",
  errorsFiltered.matchedResultCount ===
    50000 &&
  errorsFiltered.returnedResultCount ===
    50000 &&
  errorsFiltered.results.every(
    result =>
      result.valid === false &&
      result.error?.code ===
        "invalid_check_digit"
  )
);

/*
 * 16. Summary must never include
 * individual results.
 */

const summaryNoResults =
  analyzeBarcodeBatch(
    mixed100k,
    "summary"
  );

assert(
  "Summary contains no results array",
  !Object.prototype.hasOwnProperty.call(
    summaryNoResults,
    "results"
  )
);

/*
 * 17. Edge case: formatting-only input.
 */

const formattingOnly =
  analyzeBarcode("---");

assert(
  "Formatting-only input is invalid",
  formattingOnly.valid === false
);

/*
 * 18. All major error categories.
 */

const errorCases =
  analyzeBarcodeBatch(
    [
      "036000291453",
      "03600029145",
      "12345",
      "ABC123",
      ""
    ],
    "full"
  );

assert(
  "All major error categories counted",
  errorCases.errorStatistics
    .invalid_check_digit === 1 &&
  errorCases.errorStatistics
    .missing_check_digit === 1 &&
  errorCases.errorStatistics
    .invalid_length === 1 &&
  errorCases.errorStatistics
    .invalid_characters === 1 &&
  errorCases.errorStatistics
    .empty_input === 1
);

/*
 * 19. Invalid filter values should
 * be rejected by the engine itself.
 */

const invalidFilter =
  analyzeBarcodeBatch(
    ["036000291452"],
    "full",
    {
      filter: {
        validity: "banana"
      }
    }
  );

assert(
  "Invalid filter rejected",
  invalidFilter.error?.code ===
    "invalid_filter"
);

/*
 * 20. Single barcode sanity check after
 * all large stress operations.
 */

const finalSanity =
  analyzeBarcode(
    "036000291452"
  );

assert(
  "Final engine sanity check",
  finalSanity.valid === true &&
  finalSanity.type === "UPC-A" &&
  finalSanity.gtin14 ===
    "00036000291452"
);

console.log(
  "\n--- STRESS TEST SUMMARY ---"
);

console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exitCode = 1;
}
