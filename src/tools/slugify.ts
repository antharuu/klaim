/**
 * Slugify a text
 *
 * @param text - The text to slugify
 * @param splitCharacter - The character to use to split the text
 * @returns The slugified text
 */
export default function (text: string, splitCharacter: string = "_"): string {
    return text
        .toString()
        .normalize("NFD") // split an accented letter in the base letter and the acent
        .replace(/[\u0300-\u036f]/g, "") // remove all previously split accents
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9 ]/g, "") // remove all chars not letters, numbers and spaces (to be replaced)
        .replace(/\s+/g, splitCharacter); // separator
}
