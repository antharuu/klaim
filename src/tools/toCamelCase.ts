export default function (text: string): string {
    return text
        .replace(/([-_][a-z])/gi, (match) =>
            match.toUpperCase().replace('-', '').replace('_', ''))
        .replace(/(^\w)/, (match) => match.toLowerCase());
}
