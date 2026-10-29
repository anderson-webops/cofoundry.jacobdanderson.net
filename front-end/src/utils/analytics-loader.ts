export function ensureAnalyticsScript(document: Document, src: string, websiteId: string) {
  if (Array.from(document.scripts).some(script => script.src === src))
    return

  const script = document.createElement("script")
  script.defer = true
  script.src = src
  script.dataset.websiteId = websiteId
  document.head.appendChild(script)
}
