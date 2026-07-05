import sanitizeHtml from 'sanitize-html';

/**
 * Sanitizes the rich-text biography/story field on Person (Spec §M4.3 / §13).
 * Contributors submit formatted text; we allow a small, safe subset of tags and
 * strip everything else (scripts, styles, event handlers, iframes, etc.) so an
 * approved biography can never carry stored XSS. RTL Arabic content is preserved.
 */
export function sanitizeBiography(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [
      'p',
      'br',
      'span',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'blockquote',
      'ul',
      'ol',
      'li',
      'h3',
      'h4',
      'a',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'rel'],
      span: ['dir'],
      p: ['dir'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    // Force safe link behaviour; drop anything not on the allow-list above.
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow' }),
    },
    disallowedTagsMode: 'discard',
  }).trim();
}
