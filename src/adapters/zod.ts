import { ValidationError } from "../core/errors";

/**
 * Structural shape of the result returned by a zod schema's `safeParseAsync`
 * method. Modelled after zod's `SafeParseReturnType` without importing zod,
 * so this file has no hard dependency on the `zod` package.
 *
 * @template Output - The type produced by a successful parse
 */
export type IZodSafeParseResult<Output>
    = | { success: true; data: Output }
    | { success: false; error: unknown };

/**
 * Minimal structural contract for a zod-like schema. Any object exposing a
 * compatible `safeParseAsync` method (in particular a real zod `ZodType`)
 * satisfies this interface, which lets {@link zodAdapter} avoid importing
 * `zod` at runtime or compile time.
 *
 * @template Output - The type produced by a successful parse
 */
export interface IZodLikeSchema<Output = unknown> {
    /**
     * Asynchronously parses the given data, returning a discriminated result
     * instead of throwing.
     *
     * @param data - The data to validate
     * @returns A promise resolving to the parse result
     */
    safeParseAsync: (data: unknown) => Promise<IZodSafeParseResult<Output>>;
}

/**
 * Return type of {@link zodAdapter}: an object implementing the `validate`
 * contract required by `IElement.schema`.
 *
 * @template Output - The type produced by a successful parse
 */
export interface IValidateAdapter<Output = unknown> {
    /**
     * Validates the given data against the wrapped schema.
     *
     * @param data - The data to validate
     * @returns A promise resolving to the validated (and possibly transformed) data
     * @throws {ValidationError} When the wrapped schema rejects the given data
     */
    validate: (data: unknown) => Promise<Output>;
}

/**
 * Wraps a zod (or zod-compatible) schema into the `{ validate }` interface
 * expected by {@link IElement.schema}, so it can be used with
 * `Route#validate`.
 *
 * `zod` is never imported by Klaim itself: this adapter only relies on the
 * structural shape of {@link IZodLikeSchema}, so the `zod` package stays an
 * entirely optional dependency of the consumer's project - it does not need
 * to be installed unless this adapter is actually used.
 *
 * @template Output - The type produced by a successful parse
 * @param {IZodLikeSchema<Output>} schema - A zod schema instance (or any object exposing a compatible `safeParseAsync` method)
 * @returns {IValidateAdapter<Output>} An object implementing the `validate` contract required by `IElement.schema`
 * @throws {ValidationError} When the wrapped schema rejects the given data
 * @example
 * ```typescript
 * import { z } from "zod";
 * import { Api, Route, zodAdapter } from "klaim";
 *
 * const todoSchema = z.object({
 *   userId: z.number(),
 *   id: z.number().min(1).max(10),
 *   title: z.string(),
 *   completed: z.boolean()
 * });
 *
 * Api.create("hello", "https://jsonplaceholder.typicode.com/", () => {
 *   Route.get("getTodo", "todos/[id]").validate(zodAdapter(todoSchema));
 * });
 * ```
 */
export function zodAdapter<Output = unknown> (schema: IZodLikeSchema<Output>): IValidateAdapter<Output> {
    return {
        /**
         * Validates the given data against the wrapped zod schema.
         *
         * @param data - The data to validate
         * @returns A promise resolving to the validated (and possibly transformed) data
         * @throws {ValidationError} When the wrapped schema rejects the given data
         */
        validate: async (data: unknown): Promise<Output> => {
            const result = await schema.safeParseAsync(data);

            if (!result.success) {
                throw new ValidationError(
                    "Response validation failed (zod adapter)",
                    result.error
                );
            }

            return result.data;
        }
    };
}
