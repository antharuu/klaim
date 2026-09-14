/**
 * Per-call cancellation token backing the exposed `.cancel()` API.
 *
 * A token never allocates its own `AbortController`. When the current attempt
 * is running under a `.withTimeout()` budget, cancellation reuses that
 * attempt's existing transport controller via {@link CancelToken.bindAbort}
 * (zero extra allocation, no collision between concurrent calls or with the
 * timeout mechanism). Without a timeout, cancellation still settles the call
 * immediately through {@link CancelToken.whenCancelled}, and guards late
 * results (e.g. a cache write) through {@link CancelToken.assertActive} —
 * the same guard style already used by the timeout runner.
 */
export interface CancelToken {
    /** Whether `.cancel()` has been called for this token */
    readonly cancelled: boolean;
    /** The cancellation reason once cancelled, otherwise undefined */
    readonly reason: unknown;
    /**
     * Marks the token as cancelled, invokes the currently bound abort
     * function (if any) and settles {@link CancelToken.whenCancelled}.
     * Subsequent calls are no-ops.
     *
     * @param customReason - Optional cancellation reason; defaults to a `CancelledError`
     */
    cancel(customReason?: unknown): void;
    /** Throws the cancellation reason when the token is cancelled; a no-op otherwise. */
    assertActive(): void;
    /**
     * Binds the abort function of the currently active attempt's transport
     * controller, so cancellation can reach it immediately. Pass `undefined`
     * to unbind once that attempt settles.
     *
     * @param abort - Abort function of the in-flight attempt's own controller
     */
    bindAbort(abort: ((reason?: unknown) => void) | undefined): void;
    /**
     * A promise that rejects with the cancellation reason as soon as
     * `.cancel()` is called (or immediately if already cancelled). Intended
     * to be raced against the in-flight request so cancellation settles the
     * call without waiting for a cooperative transport.
     *
     * @returns A promise that never resolves and rejects once cancelled
     */
    whenCancelled(): Promise<never>;
}

/**
 * Creates a new, unbound cancellation token.
 *
 * @param defaultReason - Builds the `CancelledError` used when `.cancel()` is called without a reason
 * @returns A fresh cancellation token
 */
export function createCancelToken (defaultReason: () => unknown): CancelToken {
    let cancelled = false;
    let reason: unknown;
    let activeAbort: ((reason?: unknown) => void) | undefined;
    let rejectPending: ((reason: unknown) => void) | undefined;
    const pending = new Promise<never>((_resolve, reject) => {
        rejectPending = reject;
    });
    // Nothing ever consumes a losing race by default; avoid an unhandled rejection warning.
    pending.catch(() => {});

    return {
        /**
         * Whether `.cancel()` has been called for this token.
         *
         * @returns Whether the token has been cancelled
         */
        get cancelled (): boolean {
            return cancelled;
        },
        /**
         * The cancellation reason once cancelled, otherwise undefined.
         *
         * @returns The cancellation reason, or undefined
         */
        get reason (): unknown {
            return reason;
        },
        /**
         * Marks the token as cancelled and invokes the currently bound abort function.
         *
         * @param customReason - Optional cancellation reason; defaults to a `CancelledError`
         */
        cancel (customReason?: unknown): void {
            if (cancelled) return;
            cancelled = true;
            reason = customReason ?? defaultReason();
            activeAbort?.(reason);
            rejectPending?.(reason);
        },
        /** Throws the cancellation reason when the token is cancelled; a no-op otherwise. */
        assertActive (): void {
            if (cancelled) throw reason;
        },
        /**
         * Binds or unbinds the current attempt's transport abort function.
         *
         * @param abort - Abort function of the in-flight attempt's own controller
         */
        bindAbort (abort: ((reason?: unknown) => void) | undefined): void {
            activeAbort = abort;
            if (cancelled) activeAbort?.(reason);
        },
        /**
         * A promise that rejects with the cancellation reason once cancelled.
         *
         * @returns A promise that never resolves and rejects once cancelled
         */
        whenCancelled (): Promise<never> {
            return pending;
        }
    };
}
