/**
 * Calculates the hash value of a given string.
 *
 * @param {string} str - The string to calculate the hash for.
 * @returns {string} The hash value of the input string.
 */
export default function (str: string): string {
    const initialHash = 0x811c9dc5;
    const prime = 0x01000193;
    let hash = initialHash;

    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash *= prime;
    }

    // Convert the integer hash to a hexadecimal string
    let hexHash = (hash >>> 0).toString(16).padStart(8, "0");

    // Extend the hash to 32 characters by rehashing and concatenating
    while (hexHash.length < 32) {
        hash ^= hexHash.charCodeAt(hexHash.length % hexHash.length);
        hash *= prime;
        hexHash += (hash >>> 0).toString(16).padStart(8, "0");
    }

    return hexHash.substring(0, 32);
}
