import {
  analyzeBarcode,
  analyzeBarcodeBatch
} from "./index.js";

const tests = [
  {
    name: "Valid UPC-A",
    input: "036000291452",
    expected: {
      valid: true,
      type: "UPC-A",
      gtin14: "00036000291452"
    }
  },
  {
    name: "Valid EAN-8",
    input: "96385074",
    expected: {
      valid: true,
      type: "EAN-8",
      gtin14: "00000096385074"
    }
  },
  {
    name: "Valid EAN-13",
    input: "4006381333931",
    expected: {
      valid: true,
      type: "EAN-13",
      gtin14: "04006381333931"
    }
  },
  {
    name: "Valid GTIN-14",
    input: "10012345000017",
    expected: {
      valid: true,
      type: "GTIN-14",
      gtin14: "10012345000017"
    }
  },
  {
    name: "Invalid check digit",
    input: "036000291453",
    expected: {
      valid: false,
      errorCode: "invalid_check_digit",
      expectedCheckDigit: 2,
      correctedBarcode: "036000291452",
      gtin14: null
    }
  },
  {
    name: "Missing UPC-A check digit",
    input: "03600029145",
    expected: {
      valid: false,
      errorCode: "missing_check_digit",
      expectedCheckDigit: 2,
      correctedBarcode: "036000291452"
    }
  },
  {
    name: "Missing EAN-8 check digit",
    input: "9638507",
    expected: {
      valid: false,
      errorCode: "missing_check_digit",
      expectedCheckDigit: 4,
      correctedBarcode: "96385074"
    }
  },
  {
    name: "Invalid characters",
    input: "ABC036000291452",
    expected: {
      valid: false,
      errorCode: "invalid_characters"
    }
  },
  {
    name: "Invalid length",
    input: "12345",
    expected: {
      valid: false,
      errorCode: "invalid_length"
    }
  },
  {
    name: "Formatted UPC-A",
    input: "036-000-291-452",
    expected: {
      valid: true,
      type: "UPC-A",
      gtin14: "00036000291452"
    }
  }
];

let passed = 0;
let failed = 0;

function matchesExpected(result, expected) {
  return Object.entries(expected).every(([key, value]) => {
    if (key === "errorCode") {
      return result.error?.code === value;
    }

    return result[key] === value;
  });
}

for (const test of tests) {
  const result = analyzeBarcode(test.input);
  const success = matchesExpected(result, test.expected);

  if (success) {
    console.log(`PASS - ${test.name}`);
    passed++;
  } else {
    console.log(`FAIL - ${test.name}`);
    console.log("Input:", test.input);
    console.log("Expected:", test.expected);
    console.log("Received:", result);
    failed++;
  }
}

console.log("");
console.log(`Basic tests passed: ${passed}`);
console.log(`Basic tests failed: ${failed}`);

console.log("");
console.log("--- NEW FEATURE TESTS ---");

const leadingZeroTest = analyzeBarcode("036000291452");

console.log(
  leadingZeroTest.cleanedInput === "036000291452"
    ? "PASS - Leading zero preserved"
    : "FAIL - Leading zero preserved"
);

const warningTest = analyzeBarcode("036-000-291-452");

console.log(
  warningTest.warnings.some(
    warning => warning.code === "formatting_removed"
  )
    ? "PASS - Formatting warning"
    : "FAIL - Formatting warning"
);

const detailedErrorTest = analyzeBarcode("036000291453");

console.log(
  detailedErrorTest.error?.code === "invalid_check_digit" &&
  detailedErrorTest.error?.message
    ? "PASS - Detailed error"
    : "FAIL - Detailed error"
);

const batchTest = analyzeBarcodeBatch([
  "036000291452",
  "96385074",
  "036000291453",
  "036-000-291-452"
]);

console.log(
  batchTest.total === 4 &&
  batchTest.validCount === 3 &&
  batchTest.invalidCount === 1 &&
  batchTest.results.length === 4
    ? "PASS - Batch processing"
    : "FAIL - Batch processing"
);

console.log("");
console.log("Batch result:");
console.log(JSON.stringify(batchTest, null, 2));