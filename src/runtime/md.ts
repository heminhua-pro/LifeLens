import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

/* LLM 回复统一走这里渲染：markdown -> HTML -> 消毒（防提示词注入带出的 XSS） */
const md = new MarkdownIt({ breaks: true, linkify: true })

export function renderMd(src: string): string {
  return DOMPurify.sanitize(md.render(src || ''))
}
