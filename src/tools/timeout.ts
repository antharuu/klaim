export interface ITimeoutConfig {
	duration: number; // seconds
	message: string;
}

export const DEFAULT_TIMEOUT_CONFIG: ITimeoutConfig = {
    duration: 5,
    message: "Request timed out"
};

/**
 *
 * @param promise
 * @param config
 */
export async function withTimeout<T> (promise: Promise<T>, config: ITimeoutConfig): Promise<T> {
    const { duration, message } = config;
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => {
            const id = setTimeout(() => {
                clearTimeout(id);
                reject(new Error(message));
            }, duration * 1000);
        })
    ]);
}
