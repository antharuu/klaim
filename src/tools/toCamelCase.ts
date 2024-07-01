/**
 * Convert a string to camel case
 *
 * @param text - The text to convert
 * @returns The text in camel case
 */
export default function (text: string): string {
    return text
        .replace(/([-_][a-z])/gi, match => match.toUpperCase().replace("-", "").replace("_", ""))
        .replace(/(^\w)/, match => match.toLowerCase());
}
