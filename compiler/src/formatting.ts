export function preTransformContent(content: string): string {
  return content
}

export function postTransformContent(content: string, version: string): string {
  // Could use &hellip; for Ellipses but the spacing was too narrow in my tests and didn't allow
  // any control over the spacing
  return content
    .replace(/ ?\.\.\.+ ?/g, (match) => {
      const prefix = match[0] === ' ' ? '&nbsp;' : ''
      const suffix = match[match.length - 1] === ' ' ? '&nbsp;' : ''
      return prefix + `.&nbsp;.&nbsp;.` + suffix
    })
    .replace(/--+/g, '&mdash;')
    .replace(/<hr>/g, '<div class="scene-break">* * *</div>')
    .replace(/\$version/g, version)
}
