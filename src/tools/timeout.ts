import { TimeoutError } from "../core/errors";

export interface ITimeoutConfig {
    duration: number; // seconds
    message: string;
}

export const DEFAULT_TIMEOUT_CONFIG: ITimeoutConfig = {
    duration: 5,
    message: "Request timed out"
};

/**
 * Internal runner, armed before the operation (including cache lookup).
 *
 * @param operation - Deferred operation and terminal guard
 * @param config - Timeout configuration in seconds
 * @param callerSignal - Original request signal, retained across retries
 * @returns The first observed terminal result
 */
export async function runWithTimeout<T> (
    operation: (signal: AbortSignal | null | undefined, assertActive: () => void) => Promise<T>,
    config: ITimeoutConfig,
    callerSignal?: AbortSignal | null
): Promise<T> {
    const { duration, message } = config;
    let terminal = false;
    let failed = false;
    let terminalReason: unknown;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let relay: (() => void) | undefined;
    /** Throws the original terminal reason on a losing continuation. */
    function assertActive (): void {
        if (failed) throw terminalReason;
    }
    try {
        return await new Promise<T>((resolve, reject) => {
            /**
             * Selects a rejection only while the attempt is active.
             *
             * @param error - Original operation or setup rejection
             */
            function fail (error: unknown): void {
                if (terminal) return;
                terminal = failed = true;
                terminalReason = error;
                reject(error);
            }
            try {
                if (typeof globalThis.AbortController === "function") {
                    controller = new globalThis.AbortController();
                    if (callerSignal) {
                        const transport = controller;
                        /** Relays caller cancellation without terminating the runner. */
                        relay = (): void => {
                            if (!transport.signal.aborted) transport.abort(callerSignal.reason);
                        };
                        callerSignal.addEventListener("abort", relay);
                        if (callerSignal.aborted) relay();
                    }
                }
                timer = setTimeout(() => {
                    if (terminal) return;
                    const error = new TimeoutError(message);
                    // Commit timeout before abort can synchronously reject transport.
                    terminal = failed = true;
                    terminalReason = error;
                    try {
                        if (controller && !controller.signal.aborted) controller.abort(error);
                    } catch {
                        // A platform abort failure cannot replace the winning timeout.
                    } finally {
                        reject(error);
                    }
                }, duration * 1000);
                Promise.resolve(operation(controller?.signal ?? callerSignal, assertActive)).then(value => {
                    if (terminal) return;
                    terminal = true;
                    resolve(value);
                }, fail); // Observe losing rejections too; cleanup never awaits the loser.
            } catch (error: unknown) {
                fail(error);
            }
        });
    } finally {
        try {
            clearTimeout(timer);
        } catch {
            // Cleanup cannot change an already selected terminal result.
        }
        try {
            if (relay) callerSignal?.removeEventListener("abort", relay);
        } catch {
            // Attempt both cleanups even on a non-conforming platform.
        }
    }
}

/**
 * Wraps a promise with a timeout.
 *
 * @param promise - Promise to execute
 * @param config - Timeout configuration
 * @returns The result of the promise or a timeout error
 */
export async function withTimeout<T> (promise: Promise<T>, config: ITimeoutConfig): Promise<T> {
    const { duration, message } = config;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                timer = setTimeout(() => reject(new TimeoutError(message)), duration * 1000);
            })
        ]);
    } finally {
        clearTimeout(timer);
    }
}
