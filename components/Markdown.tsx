'use client'

import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

const components: Components = {
  // Links open in new tab safely
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80">
      {children}
    </a>
  ),
  // Inline code
  code: ({ children, className }) => {
    const isBlock = className?.startsWith('language-')
    if (isBlock) {
      return (
        <code className={className}>
          {children}
        </code>
      )
    }
    return (
      <code className="bg-muted text-foreground rounded px-1 py-0.5 text-[0.85em] font-mono">
        {children}
      </code>
    )
  },
  // Code blocks
  pre: ({ children }) => (
    <pre className="bg-muted rounded-md px-4 py-3 overflow-x-auto text-sm font-mono my-3">
      {children}
    </pre>
  ),
  // Tables
  table: ({ children }) => (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
  th: ({ children }) => (
    <th className="text-left px-3 py-2 border border-border font-semibold text-xs uppercase tracking-wide">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 border border-border align-top">{children}</td>
  ),
  tr: ({ children }) => <tr className="even:bg-muted/30">{children}</tr>,
  // Blockquote
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-border pl-4 italic text-muted-foreground my-3">
      {children}
    </blockquote>
  ),
  // Headings — scale down so they fit in panel / chat contexts
  h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-bold mt-3 mb-1.5">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold mt-3 mb-1">{children}</h3>,
  h4: ({ children }) => <h4 className="text-sm font-semibold mt-2 mb-1">{children}</h4>,
  // Lists
  ul: ({ children }) => <ul className="list-disc list-outside pl-5 my-2 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-outside pl-5 my-2 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  // Paragraph
  p: ({ children }) => <p className="leading-relaxed my-1.5">{children}</p>,
  // Horizontal rule
  hr: () => <hr className="border-border my-4" />,
  // Strong / em
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
}

interface Props {
  children: string
  className?: string
}

export default function Markdown({ children, className }: Props) {
  return (
    <div className={`text-sm text-foreground ${className ?? ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
