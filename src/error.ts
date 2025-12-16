/**
 * @typedef {object} KvErrors
 * @property {(type: string) => string} ERROR_UNSUPPORTED_KEY_TYPE - Error for unsupported key types.
 * @property {string} ERROR_CHECK_FAILED_KEY_EXISTS - Error for check failed due to key existing.
 * @property {string} ERROR_CHECK_FAILED_VERSION_MISMATCH - Error for check failed due to version mismatch.
 */

export const KvErrors = {
    ERROR_UNSUPPORTED_KEY_TYPE: (type: string) => `Unsupported key type: ${type}`,
    ERROR_CHECK_FAILED_KEY_EXISTS: "Check failed: key exists",
    ERROR_CHECK_FAILED_VERSION_MISMATCH: "Check failed: version mismatch",
} as const;
