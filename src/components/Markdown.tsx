import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { safeTextStyle } from '../lib/richText';
import { ArrowUpRight } from 'lucide-react';
interface Props { body: string; assets: Record<string, string>; onNavigate: (id: string) => void }
export function Markdown({ body, assets, onNavigate }: Props) {
  return <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, [rehypeSanitize, {
    ...defaultSchema, tagNames: [...(defaultSchema.tagNames || []), 'u'],
    attributes: { ...defaultSchema.attributes, span: [...(defaultSchema.attributes?.span || []), 'style'] },
    protocols: { ...defaultSchema.protocols, href: ['http', 'https', 'mailto', 'node'] },
  }]]}
    urlTransform={url => url.startsWith('node://') ? url : defaultUrlTransform(url)}
    components={{
      span: ({ children, style }) => <span style={safeTextStyle(style as Record<string, unknown>)}>{children}</span>,
      a: ({ href, children }) => <a href={href} className={href?.startsWith('node://') ? 'node-link' : ''}
        onClick={event => {
          event.preventDefault();
          event.stopPropagation();
          if (href?.startsWith('node://')) onNavigate(href.slice(7));
          else if (href && /^(https?:|mailto:)/.test(href)) {
            if (window.ointel) void window.ointel.openExternal(href);
            else window.open(href, '_blank', 'noopener,noreferrer');
          }
        }}>{children}{href?.startsWith('node://') && <ArrowUpRight size={12} />}</a>,
      img: ({ src, alt }) => <img src={assets[src || ''] || (src?.startsWith('https:') ? src : undefined)} alt={alt || 'Embedded image'} loading="lazy" />,
    }}>{body || '*A little space for your next thought. Click Edit to begin.*'}</ReactMarkdown></div>;
}
