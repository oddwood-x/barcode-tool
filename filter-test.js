import {
  analyzeBarcodeBatch
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

const barcodes = [
  "036000291452",   // valid UPC-A
  "036000291453",   // invalid UPC-A check digit
  "96385074",       // valid EAN-8
  "96385075",       // invalid EAN-8 check digit
  "4006381333931",  // valid EAN-13
  "4006381333932",  // invalid EAN-13 check digit
  "03600029145",    // missing UPC-A check digit
  "12345",          // invalid length
  "ABC123"          // invalid characters
];

console.log(
  "\n--- ADVANCED FILTER TESTS ---"
);

/*
 * 1. Invalid-only filter
 */

const invalidOnly =
  analyzeBarcodeBatch(
    barcodes,
    "full",
    {
      filter: {
        validity: "invalid"
      }
    }
  );

assert(
  "Invalid-only filter",
  invalidOnly.results.every(
    result => result.valid === false
  ) &&
  invalidOnly.matchedResultCount === 6
);

/*
 * 2. Valid-only filter
 */

const validOnly =
  analyzeBarcodeBatch(
    barcodes,
    "full",
    {
      filter: {
        validity: "valid"
      }
    }
  );

assert(
  "Valid-only filter",
  validOnly.results.every(
    result => result.valid === true
  ) &&
  validOnly.matchedResultCount === 3
);

/*
 * 3. UPC-A type filter
 */

const upcOnly =
  analyzeBarcodeBatch(
    barcodes,
    "full",
    {
      filter: {
        types: ["UPC-A"]
      }
    }
  );

assert(
  "UPC-A type filter",
  upcOnly.results.every(
    result =>
      result.type === "UPC-A"
  ) &&
  upcOnly.matchedResultCount === 3
);

/*
 * 4. Invalid check digit filter
 */

const checkDigitOnly =
  analyzeBarcodeBatch(
    barcodes,
    "full",
    {
      filter: {
        errorTypes: [
          "invalid_check_digit"
        ]
      }
    }
  );

assert(
  "Invalid check digit filter",
  checkDigitOnly.results.every(
    result =>
      result.error?.code ===
      "invalid_check_digit"
  ) &&
  checkDigitOnly.matchedResultCount === 3
);

/*
 * 5. Combined filter:
 * invalid UPC-A with invalid check digit
 */

const combined =
  analyzeBarcodeBatch(
    barcodes,
    "full",
    {
      filter: {
        validity: "invalid",
        types: ["UPC-A"],
        errorTypes: [
          "invalid_check_digit"
        ]
      }
    }
  );

assert(
  "Combined advanced filter",
  combined.matchedResultCount === 1 &&
  combined.results.length === 1 &&
  combined.results[0].type ===
    "UPC-A" &&
  combined.results[0].valid ===
    false &&
  combined.results[0].error?.code ===
    "invalid_check_digit"
);

/*
 * 6. errors_only + type filter
 */

const errorsOnlyUPC =
  analyzeBarcodeBatch(
    barcodes,
    "errors_only",
    {
      filter: {
        types: ["UPC-A"]
      }
    }
  );

assert(
  "errors_only with UPC-A filter",
  errorsOnlyUPC.results.every(
    result =>
      result.valid === false &&
      result.type === "UPC-A"
  ) &&
  errorsOnlyUPC.matchedResultCount === 2
);

/*
 * 7. Incompatible filter:
 * errors_only cannot request valid records
 */

const incompatible =
  analyzeBarcodeBatch(
    barcodes,
    "errors_only",
    {
      filter: {
        validity: "valid"
      }
    }
  );

assert(
  "Reject incompatible filter",
  incompatible.error?.code ===
    "incompatible_filter"
);

/*
 * 8. validity=valid cannot be combined
 * with errorTypes
 */

const invalidCombination =
  analyzeBarcodeBatch(
    barcodes,
    "full",
    {
      filter: {
        validity: "valid",
        errorTypes: [
          "invalid_check_digit"
        ]
      }
    }
  );

assert(
  "Reject valid + errorTypes",
  invalidCombination.error?.code ===
    "incompatible_filter"
);

/*
 * 9. maxResults must apply AFTER filtering.
 */

const truncated =
  analyzeBarcodeBatch(
    barcodes,
    "full",
    {
      filter: {
        validity: "invalid"
      },
      maxResults: 2
    }
  );

assert(
  "Filter truncation",
  truncated.matchedResultCount === 6 &&
  truncated.returnedResultCount === 2 &&
  truncated.results.length === 2 &&
  truncated.truncated === true
);

/*
 * 10. Aggregate statistics must still describe
 * the entire batch, not only filtered results.
 */

assert(
  "Global statistics preserved",
  invalidOnly.total === 9 &&
  invalidOnly.validCount === 3 &&
  invalidOnly.invalidCount === 6
);

/*
 * 11. Type statistics must still describe
 * the entire batch.
 */

assert(
  "Global type statistics preserved",
  combined.typeStatistics["UPC-A"].total ===
    3 &&
  combined.typeStatistics["EAN-8"].total ===
    2 &&
  combined.typeStatistics["EAN-13"].total ===
    2
);

/*
 * 12. Error statistics must still describe
 * the entire batch.
 */

assert(
  "Global error statistics preserved",
  combined.errorStatistics
    .invalid_check_digit === 3 &&
  combined.errorStatistics
    .missing_check_digit === 1 &&
  combined.errorStatistics
    .invalid_length === 1 &&
  combined.errorStatistics
    .invalid_characters === 1
);

/*
 * 13. Filter metadata should be returned.
 */

assert(
  "Filter metadata returned",
  combined.filter?.validity ===
    "invalid" &&
  combined.filter?.types?.[0] ===
    "UPC-A" &&
  combined.filter?.errorTypes?.[0] ===
    "invalid_check_digit"
);

/*
 * 14. No filter remains backward compatible.
 */

const noFilter =
  analyzeBarcodeBatch(
    barcodes,
    "full"
  );

assert(
  "No-filter backward compatibility",
  noFilter.filter === null &&
  noFilter.matchedResultCount ===
    barcodes.length &&
  noFilter.returnedResultCount ===
    barcodes.length
);

/*
 * 15. Summary remains aggregate-only.
 */

const summary =
  analyzeBarcodeBatch(
    barcodes,
    "summary",
    {
      filter: {
        validity: "invalid"
      }
    }
  );

assert(
  "Summary remains aggregate-only",
  summary.total === 9 &&
  summary.validCount === 3 &&
  summary.invalidCount === 6 &&
  !Object.prototype.hasOwnProperty.call(
    summary,
    "results"
  )
);

console.log(
  "\n--- FILTER TEST SUMMARY ---"
);

console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exitCode = 1;
}