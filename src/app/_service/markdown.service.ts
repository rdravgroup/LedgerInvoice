import { Injectable } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import css from 'highlight.js/lib/languages/css';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('css', css);

@Injectable({ providedIn: 'root' })
export class MarkdownService {
  constructor(private sanitizer: DomSanitizer) {
    marked.setOptions({
      gfm: true,
      breaks: false,
      smartypants: false,
      highlight: function(code: string, lang?: string) {
        try {
          if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
          }
          return hljs.highlightAuto(code).value;
        } catch {
          return code;
        }
      }
    });
  }

  render(markdown: string): SafeHtml {
    const md = markdown || '';
    const html = marked.parse(md);
    const clean = DOMPurify.sanitize(html);
    return this.sanitizer.bypassSecurityTrustHtml(clean);
  }
}
