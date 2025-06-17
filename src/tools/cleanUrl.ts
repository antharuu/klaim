/**
 * Clean the URL by removing slashes at the beginning and end of the string.
 *
 * @param url - The URL to clean
 * @returns The cleaned URL
 */
export default function (url: string): string {
    return url
        .trim()
    // remove slashes at the beginning and end of the string
        .replace(/^\/|\/$/g, "");
}
