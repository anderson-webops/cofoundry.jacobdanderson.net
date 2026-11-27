import { defineNitroPlugin } from "nitropack/runtime"
import sriHashes from "#sri-hashes"

export default defineNitroPlugin((nitro) => {
  const integrity = Object.fromEntries(Object.entries(sriHashes).filter(([url]) =>
    /^\/_nuxt\/[\w./-]+\.js$/.test(url),
  ))
  if (!Object.keys(integrity).length)
    return

  const prefix = JSON.stringify({ integrity }).slice(0, -1)
  nitro.hooks.hook("render:html", (html) => {
    html.head = html.head.map(element => element.replace(
      /(<script\b[^>]*>)\{"imports":/g,
      (original, tag: string) => tag.includes("type=\"importmap\"")
        ? `${tag}${prefix},"imports":`
        : original,
    ))
  })
})
