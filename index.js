const MAX_BATCH_SIZE = 100000;
const DEFAULT_MAX_RESULTS = 10000;
const MAX_RESULT_LIMIT = 50000;
const DEFAULT_CHUNK_SIZE = 1000;

const SUPPORTED_TYPES = new Set([
  "EAN-8",
  "UPC-A",
  "EAN-13",
  "GTIN-14",
  "Unknown"
]);

const SUPPORTED_ERROR_TYPES = new Set([
  "invalid_check_digit",
  "missing_check_digit",
  "invalid_length",
  "invalid_characters",
  "empty_input",
  "other"
]);

const SUPPORTED_VALIDITY_FILTERS = new Set([
  "all",
  "valid",
  "invalid"
]);

function createMessage(code, message) {
  return { code, message };
}

function cleanInput(value) {
  if (value === null || value === undefined) {
    return {
      success: false,
      barcode: null,
      error: createMessage(
        "empty_input",
        "Barcode input is empty."
      ),
      warnings: []
    };
  }

  const input = String(value).trim();

  if (input.length === 0) {
    return {
      success: false,
      barcode: null,
      error: createMessage(
        "empty_input",
        "Barcode input is empty."
      ),
      warnings: []
    };
  }

  if (!/^[0-9\s-]+$/.test(input)) {
    return {
      success: false,
      barcode: null,
      error: createMessage(
        "invalid_characters",
        "Barcode contains unsupported characters. Only digits, spaces, and hyphens are accepted."
      ),
      warnings: []
    };
  }

  const barcode =
    input.replace(/[\s-]/g, "");

  const warnings = [];

  if (barcode !== input) {
    warnings.push(
      createMessage(
        "formatting_removed",
        "Spaces or hyphens were removed before validation."
      )
    );
  }

  return {
    success: true,
    barcode,
    warnings
  };
}

function getCanonicalKey(value) {
  if (value === null || value === undefined) {
    return `invalid:${String(value)}`;
  }

  const input = String(value).trim();

  if (/^[0-9\s-]+$/.test(input)) {
    return `barcode:${input.replace(/[\s-]/g, "")}`;
  }

  return `raw:${input}`;
}

function identifyBarcodeByLength(length) {
  switch (length) {
    case 8:
      return "EAN-8";

    case 12:
      return "UPC-A";

    case 13:
      return "EAN-13";

    case 14:
      return "GTIN-14";

    default:
      return "Unknown";
  }
}

function calculateCheckDigit(body) {
  let sum = 0;
  let multiplyByThree = true;

  for (let i = body.length - 1; i >= 0; i--) {
    const digit =
      body.charCodeAt(i) - 48;

    sum += multiplyByThree
      ? digit * 3
      : digit;

    multiplyByThree =
      !multiplyByThree;
  }

  return (10 - (sum % 10)) % 10;
}

function normalizeToGTIN14(barcode) {
  return barcode.padStart(14, "0");
}

function detectMissingCheckDigit(barcode) {
  let targetType = null;

  if (barcode.length === 7) {
    targetType = "EAN-8";
  } else if (barcode.length === 11) {
    targetType = "UPC-A";
  }

  if (!targetType) {
    return null;
  }

  const checkDigit =
    calculateCheckDigit(barcode);

  return {
    targetType,
    checkDigit,
    completedBarcode:
      barcode + String(checkDigit)
  };
}

export function analyzeBarcode(value) {
  const input =
    value === null ||
    value === undefined
      ? ""
      : String(value);

  const cleaned =
    cleanInput(value);

  if (!cleaned.success) {
    return {
      input,
      cleanedInput: null,
      type: "Unknown",
      valid: false,
      error: cleaned.error,
      warnings: cleaned.warnings,
      actualCheckDigit: null,
      expectedCheckDigit: null,
      correctedBarcode: null,
      gtin14: null
    };
  }

  const barcode =
    cleaned.barcode;

  const warnings =
    cleaned.warnings;

  if (
    barcode.length === 7 ||
    barcode.length === 11
  ) {
    const missing =
      detectMissingCheckDigit(
        barcode
      );

    return {
      input,
      cleanedInput: barcode,
      type: missing.targetType,
      valid: false,
      error: createMessage(
        "missing_check_digit",
        `The barcode appears to be a ${missing.targetType} value with its check digit missing.`
      ),
      warnings,
      actualCheckDigit: null,
      expectedCheckDigit:
        missing.checkDigit,
      correctedBarcode:
        missing.completedBarcode,
      gtin14: null
    };
  }

  if (
    barcode.length !== 8 &&
    barcode.length !== 12 &&
    barcode.length !== 13 &&
    barcode.length !== 14
  ) {
    return {
      input,
      cleanedInput: barcode,
      type: "Unknown",
      valid: false,
      error: createMessage(
        "invalid_length",
        `Unsupported barcode length: ${barcode.length} digits. Expected 8, 12, 13, or 14 digits.`
      ),
      warnings,
      actualCheckDigit: null,
      expectedCheckDigit: null,
      correctedBarcode: null,
      gtin14: null
    };
  }

  const type =
    identifyBarcodeByLength(
      barcode.length
    );

  const body =
    barcode.slice(0, -1);

  const actualCheckDigit =
    barcode.charCodeAt(
      barcode.length - 1
    ) - 48;

  const expectedCheckDigit =
    calculateCheckDigit(body);

  const valid =
    actualCheckDigit ===
    expectedCheckDigit;

  if (!valid) {
    return {
      input,
      cleanedInput: barcode,
      type,
      valid: false,
      error: createMessage(
        "invalid_check_digit",
        `Invalid check digit. Expected ${expectedCheckDigit} but received ${actualCheckDigit}.`
      ),
      warnings,
      actualCheckDigit,
      expectedCheckDigit,
      correctedBarcode:
        body +
        String(expectedCheckDigit),
      gtin14: null
    };
  }

  return {
    input,
    cleanedInput: barcode,
    type,
    valid: true,
    error: null,
    warnings,
    actualCheckDigit,
    expectedCheckDigit,
    correctedBarcode: null,
    gtin14:
      normalizeToGTIN14(barcode)
  };
}

function createErrorStatistics() {
  return {
    invalid_check_digit: 0,
    missing_check_digit: 0,
    invalid_length: 0,
    invalid_characters: 0,
    empty_input: 0,
    other: 0
  };
}

function createTypeStatistics() {
  return {
    "EAN-8": {
      total: 0,
      valid: 0,
      invalid: 0
    },

    "UPC-A": {
      total: 0,
      valid: 0,
      invalid: 0
    },

    "EAN-13": {
      total: 0,
      valid: 0,
      invalid: 0
    },

    "GTIN-14": {
      total: 0,
      valid: 0,
      invalid: 0
    },

    "Unknown": {
      total: 0,
      valid: 0,
      invalid: 0
    }
  };
}

function addErrorStatistic(
  statistics,
  error
) {
  if (!error || !error.code) {
    statistics.other++;
    return;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      statistics,
      error.code
    )
  ) {
    statistics[error.code]++;
  } else {
    statistics.other++;
  }
}

function addTypeStatistic(
  statistics,
  result
) {
  const type =
    Object.prototype.hasOwnProperty.call(
      statistics,
      result.type
    )
      ? result.type
      : "Unknown";

  statistics[type].total++;

  if (result.valid) {
    statistics[type].valid++;
  } else {
    statistics[type].invalid++;
  }
}

function normalizeFilter(filter) {
  if (
    filter === null ||
    filter === undefined
  ) {
    return {
      success: true,
      filter: null
    };
  }

  if (
    typeof filter !== "object" ||
    Array.isArray(filter)
  ) {
    return {
      success: false,
      error: createMessage(
        "invalid_filter",
        "Filter must be an object."
      )
    };
  }

  const validity =
    filter.validity ?? "all";

  if (
    !SUPPORTED_VALIDITY_FILTERS.has(
      validity
    )
  ) {
    return {
      success: false,
      error: createMessage(
        "invalid_filter",
        "Filter validity must be all, valid, or invalid."
      )
    };
  }

  let types = null;

  if (filter.types !== undefined) {
    if (
      !Array.isArray(filter.types) ||
      filter.types.length === 0
    ) {
      return {
        success: false,
        error: createMessage(
          "invalid_filter",
          "Filter types must be a non-empty array when provided."
        )
      };
    }

    for (const type of filter.types) {
      if (!SUPPORTED_TYPES.has(type)) {
        return {
          success: false,
          error: createMessage(
            "invalid_filter",
            `Unsupported barcode type filter: ${type}.`
          )
        };
      }
    }

    types =
      new Set(filter.types);
  }

  let errorTypes = null;

  if (
    filter.errorTypes !== undefined
  ) {
    if (
      !Array.isArray(
        filter.errorTypes
      ) ||
      filter.errorTypes.length === 0
    ) {
      return {
        success: false,
        error: createMessage(
          "invalid_filter",
          "Filter errorTypes must be a non-empty array when provided."
        )
      };
    }

    for (
      const errorType
      of filter.errorTypes
    ) {
      if (
        !SUPPORTED_ERROR_TYPES.has(
          errorType
        )
      ) {
        return {
          success: false,
          error: createMessage(
            "invalid_filter",
            `Unsupported error type filter: ${errorType}.`
          )
        };
      }
    }

    errorTypes =
      new Set(filter.errorTypes);
  }

  if (
    validity === "valid" &&
    errorTypes
  ) {
    return {
      success: false,
      error: createMessage(
        "incompatible_filter",
        "errorTypes cannot be combined with validity 'valid' because valid barcodes do not have validation errors."
      )
    };
  }

  return {
    success: true,

    filter: {
      validity,
      types,
      errorTypes,

      public: {
        validity,
        ...(types
          ? {
              types:
                Array.from(types)
            }
          : {}),
        ...(errorTypes
          ? {
              errorTypes:
                Array.from(
                  errorTypes
                )
            }
          : {})
      }
    }
  };
}

function resultMatchesFilter(
  result,
  filter
) {
  if (!filter) {
    return true;
  }

  if (
    filter.validity === "valid" &&
    !result.valid
  ) {
    return false;
  }

  if (
    filter.validity === "invalid" &&
    result.valid
  ) {
    return false;
  }

  if (
    filter.types &&
    !filter.types.has(result.type)
  ) {
    return false;
  }

  if (filter.errorTypes) {
    if (result.valid) {
      return false;
    }

    const errorCode =
      result.error?.code ?? "other";

    if (
      !filter.errorTypes.has(
        errorCode
      )
    ) {
      return false;
    }
  }

  return true;
}

function createBatchError(
  mode,
  code,
  message
) {
  return {
    total: 0,
    validCount: 0,
    invalidCount: 0,
    mode,
    error:
      createMessage(
        code,
        message
      ),
    warnings: [],
    results: []
  };
}

function buildSummaryResult({
  total,
  uniqueCount,
  duplicateCount,
  validCount,
  invalidCount,
  warnings,
  errorStatistics,
  typeStatistics
}) {
  return {
    total,
    validCount,
    invalidCount,
    uniqueCount,
    duplicateCount,
    errorStatistics,
    typeStatistics,
    warnings
  };
}

export function analyzeBarcodeBatch(
  values,
  mode = "full",
  options = {}
) {
  const supportedModes =
    new Set([
      "full",
      "errors_only",
      "summary"
    ]);

  if (!supportedModes.has(mode)) {
    return createBatchError(
      mode,
      "invalid_output_mode",
      "Output mode must be full, errors_only, or summary."
    );
  }

  if (!Array.isArray(values)) {
    return createBatchError(
      mode,
      "invalid_batch",
      "Batch input must be an array of barcode strings."
    );
  }

  if (values.length === 0) {
    return createBatchError(
      mode,
      "empty_batch",
      "Batch input contains no barcodes."
    );
  }

  if (
    values.length >
    MAX_BATCH_SIZE
  ) {
    return createBatchError(
      mode,
      "batch_limit_exceeded",
      `Batch contains ${values.length} barcodes. Maximum allowed per call is ${MAX_BATCH_SIZE}.`
    );
  }

  const normalizedFilter =
    normalizeFilter(
      options.filter
    );

  if (!normalizedFilter.success) {
    return createBatchError(
      mode,
      normalizedFilter.error.code,
      normalizedFilter.error.message
    );
  }

  const filter =
    normalizedFilter.filter;

  if (
    mode === "errors_only" &&
    filter?.validity === "valid"
  ) {
    return createBatchError(
      mode,
      "incompatible_filter",
      "errors_only mode cannot be combined with validity 'valid'. Use full mode to return valid records."
    );
  }

  const requestedMaxResults =
    Number.isInteger(
      options.maxResults
    )
      ? options.maxResults
      : DEFAULT_MAX_RESULTS;

  const maxResults =
    Math.min(
      Math.max(
        requestedMaxResults,
        1
      ),
      MAX_RESULT_LIMIT
    );

  const requestedChunkSize =
    Number.isInteger(
      options.chunkSize
    )
      ? options.chunkSize
      : DEFAULT_CHUNK_SIZE;

  const chunkSize =
    Math.min(
      Math.max(
        requestedChunkSize,
        1
      ),
      MAX_BATCH_SIZE
    );

  const deduplicate =
    options.deduplicate === true;

  let validCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;
  let matchedResultCount = 0;

  const results = [];

  const errorStatistics =
    createErrorStatistics();

  const typeStatistics =
    createTypeStatistics();

  const seenCanonicalKeys =
    new Set();

  const analysisCache =
    deduplicate
      ? new Map()
      : null;

  for (
    let chunkStart = 0;
    chunkStart < values.length;
    chunkStart += chunkSize
  ) {
    const chunkEnd =
      Math.min(
        chunkStart + chunkSize,
        values.length
      );

    for (
      let index = chunkStart;
      index < chunkEnd;
      index++
    ) {
      const value =
        values[index];

      const canonicalKey =
        getCanonicalKey(value);

      if (
        seenCanonicalKeys.has(
          canonicalKey
        )
      ) {
        duplicateCount++;
      } else {
        seenCanonicalKeys.add(
          canonicalKey
        );
      }

      let result;

      /*
       * Canonical caching avoids recalculating
       * equivalent clean barcode values.
       *
       * Formatted values are still analyzed
       * individually so input metadata and
       * formatting warnings remain correct.
       */
      const cleaned =
        cleanInput(value);

      const canReuseCanonicalResult =
        deduplicate &&
        cleaned.success &&
        cleaned.warnings.length === 0 &&
        analysisCache.has(
          canonicalKey
        );

      if (canReuseCanonicalResult) {
        result =
          analysisCache.get(
            canonicalKey
          );
      } else {
        result =
          analyzeBarcode(value);

        if (
          deduplicate &&
          cleaned.success &&
          cleaned.warnings.length === 0
        ) {
          analysisCache.set(
            canonicalKey,
            result
          );
        }
      }

      if (result.valid) {
        validCount++;
      } else {
        invalidCount++;

        addErrorStatistic(
          errorStatistics,
          result.error
        );
      }

      addTypeStatistic(
        typeStatistics,
        result
      );

      if (mode === "summary") {
        continue;
      }

      /*
       * Mode establishes the broad result set.
       * The optional advanced filter narrows
       * that set further.
       */
      const allowedByMode =
        mode === "full" ||
        (
          mode === "errors_only" &&
          !result.valid
        );

      if (!allowedByMode) {
        continue;
      }

      if (
        !resultMatchesFilter(
          result,
          filter
        )
      ) {
        continue;
      }

      matchedResultCount++;

      if (
        results.length <
        maxResults
      ) {
        results.push({
          index,
          ...result
        });
      }
    }
  }

  const warnings = [];

  if (invalidCount > 0) {
    warnings.push(
      createMessage(
        "batch_contains_invalid_barcodes",
        `${invalidCount} of ${values.length} barcodes failed validation.`
      )
    );
  }

  if (duplicateCount > 0) {
    warnings.push(
      createMessage(
        "batch_contains_duplicates",
        `${duplicateCount} duplicate or canonically equivalent barcode inputs were detected.`
      )
    );
  }

  const uniqueCount =
    values.length -
    duplicateCount;

  /*
   * Summary always describes the entire batch.
   * Filters affect returned individual records,
   * not aggregate batch statistics.
   */
  if (mode === "summary") {
    return buildSummaryResult({
      total: values.length,
      uniqueCount,
      duplicateCount,
      validCount,
      invalidCount,
      warnings,
      errorStatistics,
      typeStatistics
    });
  }

  const truncated =
    matchedResultCount >
    results.length;

  if (truncated) {
    warnings.push(
      createMessage(
        "results_truncated",
        `Only ${results.length} of ${matchedResultCount} matching results were returned.`
      )
    );
  }

  return {
    total: values.length,
    uniqueCount,
    duplicateCount,
    validCount,
    invalidCount,
    mode,
    filter:
      filter
        ? filter.public
        : null,
    matchedResultCount,
    deduplicationEnabled:
      deduplicate,
    error: null,
    warnings,
    errorStatistics,
    typeStatistics,
    returnedResultCount:
      results.length,
    truncated,
    results
  };
}

export {
  MAX_BATCH_SIZE,
  DEFAULT_MAX_RESULTS,
  MAX_RESULT_LIMIT,
  DEFAULT_CHUNK_SIZE
};