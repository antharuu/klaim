/**
 * Generate a new token
 *
 * @param {number} length The length of the token
 *
 * @returns {string} The generated token
 */
export default function (length?: number): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let token = "";
    for (let i = 0; i < (length || 32); i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}
