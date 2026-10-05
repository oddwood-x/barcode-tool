import { analyzeBarcodeBatch } from "./index.js";

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

function generateRealisticDataset(
  totalCount,
  invalidCount
) {
  const barcodes = [];

  for (let i = 0; i < totalCount; i++) {
    const body =
      String(200000000000 + i);

    const correctCheckDigit =
      calculateCheckDigit(body);

    let checkDigit =
      correctCheckDigit;

    if (i < invalidCount) {
      checkDigit =
        (correctCheckDigit + 1) % 10;
    }

    barcodes.push(
      body + String(checkDigit)
    );
  }

  return barcodes;
}

const barcodes =
  generateRealisticDataset(
    10000,
    100
  );

const modes = [
  "full",
  "errors_only",
  "summary"
];

console.log(
  "Generated 10000 unique EAN-13 barcodes"
);

console.log(
  "Expected valid: 9900"
);

console.log(
  "Expected invalid: 100"
);

for (const mode of modes) {
  const start = performance.now();

  const result = analyzeBarcodeBatch(
    barcodes,
    mode,
    {
      maxResults: 50000
    }
  );

  const end = performance.now();

  const json =
    JSON.stringify(result);

  const responseBytes =
    Buffer.byteLength(
      json,
      "utf8"
    );

  const returnedResults =
    Array.isArray(result.results)
      ? result.results.length
      : 0;

  console.log("");
  console.log(
    `=== ${mode.toUpperCase()} ===`
  );

  console.log(
    `Total: ${result.total}`
  );

  console.log(
    `Unique: ${result.uniqueCount}`
  );

  console.log(
    `Duplicates: ${result.duplicateCount}`
  );

  console.log(
    `Valid: ${result.validCount}`
  );

  console.log(
    `Invalid: ${result.invalidCount}`
  );

  console.log(
    `Invalid check digits: ${result.errorStatistics?.invalid_check_digit ?? 0}`
  );

  console.log(
    `Returned results: ${returnedResults}`
  );

  console.log(
    `Truncated: ${result.truncated ?? false}`
  );

  console.log(
    `Processing time: ${(end - start).toFixed(3)} ms`
  );

  console.log(
    `Response size: ${(responseBytes / 1024).toFixed(2)} KB`
  );
}