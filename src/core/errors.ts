/**
 * Base error class for all Klaim-specific errors.
 */
export class KlaimError extends Error {
    /**
     * Creates a new KlaimError instance.
     *
     * @param message - Error message
     */
    public constructor (message: string) {
        super(message);
        this.name = "KlaimError";
    }
}

/**
 * Thrown when a rate limit is exceeded.
 */
export class RateLimitError extends KlaimError {
    /** Time in milliseconds until the next request is allowed */
    public readonly retryAfterMs: number;

    /**
     * Creates a new RateLimitError instance.
     *
     * @param message - Error message
     * @param retryAfterMs - Time in ms until the next request is allowed
     */
    public constructor (message: string, retryAfterMs: number) {
        super(message);
        this.name = "RateLimitError";
        this.retryAfterMs = retryAfterMs;
    }
}

/**
 * Thrown when a request exceeds its configured timeout.
 */
export class TimeoutError extends KlaimError {
    /**
     * Creates a new TimeoutError instance.
     *
     * @param message - Error message
     */
    public constructor (message: string) {
        super(message);
        this.name = "TimeoutError";
    }
}

/**
 * Thrown when all retry attempts have been exhausted.
 */
export class RetryExhaustedError extends KlaimError {
    /** The number of attempts that were made */
    public readonly attempts: number;

    /** The original error that caused the final failure */
    public readonly cause: Error | undefined;

    /**
     * Creates a new RetryExhaustedError instance.
     *
     * @param message - Error message
     * @param attempts - Number of attempts made
     * @param cause - Original error
     */
    public constructor (message: string, attempts: number, cause?: Error) {
        super(message);
        this.name = "RetryExhaustedError";
        this.attempts = attempts;
        this.cause = cause;
    }
}

/**
 * Thrown when a required URL argument is missing.
 */
export class MissingArgumentError extends KlaimError {
    /** The name of the missing argument */
    public readonly argument: string;

    /**
     * Creates a new MissingArgumentError instance.
     *
     * @param argument - Name of the missing argument
     */
    public constructor (argument: string) {
        super(`Argument ${argument} is missing`);
        this.name = "MissingArgumentError";
        this.argument = argument;
    }
}

/**
 * Thrown when a route path is invalid.
 */
export class InvalidPathError extends KlaimError {
    /**
     * Creates a new InvalidPathError instance.
     *
     * @param path - The invalid path
     */
    public constructor (path: string) {
        super(`Invalid path: ${path}`);
        this.name = "InvalidPathError";
    }
}
