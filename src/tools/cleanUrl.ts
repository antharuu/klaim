export default function(url: string) : string {
    return url
        .trim()
        // remove slashes at the beginning and end of the string
        .replace(/^\/|\/$/g, '')
}
