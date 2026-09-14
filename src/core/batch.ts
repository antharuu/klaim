/**
 * A single batch entry: either a thunk returning a Promise (recommended, so the
 * call is only triggered when the batch actually runs) or a Promise that is
 * already in flight (e.g. a route already invoked).
 *
 * @template T - Resolved value type of the entry
 */
export type BatchInput<T = unknown> = (() => Promise<T>) | Promise<T>;

/**
 * Outcome of a single batch entry, mirroring the shape of
 * `PromiseSettledResult` used by `Promise.allSettled`.
 *
 * @template T - Resolved value type of the entry
 */
export type BatchResult<T = unknown>
    = | { status: "fulfilled"; value: T }
    | { status: "rejected"; reason: unknown };

/**
 * Named batch input: an object whose values are batch entries.
 */
export type BatchInputObject = Record<string, BatchInput>;

/**
 * Positional batch input: an array (or tuple) of batch entries.
 */
export type BatchInputArray = readonly BatchInput[];

/**
 * Resolves the batch entry input type to its result type.
 *
 * @template Input - A single batch entry
 */
type ResultOf<Input> = Input extends BatchInput<infer T> ? BatchResult<T> : never;

/**
 * Maps every entry of a tuple/array input to its `BatchResult`, preserving
 * positions (and literal length when a tuple is provided).
 *
 * @template Input - Tuple/array of batch entries
 */
export type BatchOutputArray<Input extends BatchInputArray> = {
    [K in keyof Input]: ResultOf<Input[K]>;
};

/**
 * Maps every entry of a named object input to its `BatchResult`, preserving
 * keys.
 *
 * @template Input - Object map of batch entries
 */
export type BatchOutputObject<Input extends BatchInputObject> = {
    [K in keyof Input]: ResultOf<Input[K]>;
};

/**
 * Normalizes a batch entry (thunk or promise) into a promise.
 *
 * @template T - Resolved value type of the entry
 * @param entry - Thunk or promise to normalize
 * @returns The underlying promise
 */
function toPromise<T> (entry: BatchInput<T>): Promise<T> {
    return typeof entry === "function" ? entry() : entry;
}

/**
 * Converts a native `PromiseSettledResult` into the lighter `BatchResult`
 * shape used by `batch()`.
 *
 * @template T - Resolved value type of the entry
 * @param settled - Result produced by `Promise.allSettled`
 * @returns The equivalent `BatchResult`
 */
function toBatchResult<T> (settled: PromiseSettledResult<T>): BatchResult<T> {
    return settled.status === "fulfilled"
        ? { status: "fulfilled", value: settled.value }
        : { status: "rejected", reason: settled.reason };
}

/**
 * Runs several route calls (or any promises) concurrently and reports each
 * outcome individually, the same way `Promise.allSettled` does. A failing
 * entry never rejects the batch nor blocks the other entries: every key
 * (or index) of the returned object/array holds `{status: 'fulfilled', value}`
 * or `{status: 'rejected', reason}`.
 *
 * `batch()` is a thin orchestration layer: it simply invokes the given route
 * calls, so per-route protections already configured on the routes/APIs
 * (rate limiting, timeout, retry, cache, hooks, before/after callbacks...)
 * still apply exactly as if each call had been made individually.
 *
 * Prefer thunks (`() => Klaim.api.route()`) over bare promises so the call is
 * only fired when `batch()` runs; passing an already-started promise works
 * too but the request has then already left before `batch()` is invoked.
 *
 * @template Input - Named object or array/tuple of batch entries
 * @param input - Object or array of thunks/promises representing route calls
 * @returns Promise resolving to an object/array of `BatchResult`, matching
 * the shape of `input`
 * @example
 * ```typescript
 * // Named form (recommended): results keyed like the input
 * const {todos, user} = await batch({
 *   todos: () => Klaim.hello.listTodos(),
 *   user: () => Klaim.hello.getUser({id: 1})
 * });
 *
 * if (todos.status === "fulfilled") console.log(todos.value);
 * if (user.status === "rejected") console.error(user.reason);
 * ```
 * @example
 * ```typescript
 * // Array form: results keep the same order/positions as the input
 * const [todos, user] = await batch([
 *   () => Klaim.hello.listTodos(),
 *   () => Klaim.hello.getUser({id: 1})
 * ]);
 * ```
 */
export async function batch<Input extends BatchInputArray> (input: Input): Promise<BatchOutputArray<Input>>;
export async function batch<Input extends BatchInputObject> (input: Input): Promise<BatchOutputObject<Input>>;
export async function batch (input: BatchInputArray | BatchInputObject): Promise<unknown> {
    if (Array.isArray(input)) {
        const settled = await Promise.allSettled(input.map(toPromise));
        return settled.map(toBatchResult);
    }

    const objectInput = input as BatchInputObject;
    const keys = Object.keys(objectInput);
    const settled = await Promise.allSettled(keys.map(key => toPromise(objectInput[key])));

    const output: Record<string, BatchResult> = {};
    keys.forEach((key, index) => {
        output[key] = toBatchResult(settled[index]);
    });
    return output;
}
