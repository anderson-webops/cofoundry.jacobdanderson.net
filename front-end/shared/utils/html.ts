const lessThanPattern = /</g
const lineSeparatorPattern = /\u2028/g
const paragraphSeparatorPattern = /\u2029/g

export function serializeJsonForHtml(value: unknown) {
  return JSON.stringify(value)
    .replace(lessThanPattern, "\\u003c")
    .replace(lineSeparatorPattern, "\\u2028")
    .replace(paragraphSeparatorPattern, "\\u2029")
}
