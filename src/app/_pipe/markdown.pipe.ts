import { Pipe, PipeTransform } from '@angular/core';
import { SafeHtml } from '@angular/platform-browser';
import { MarkdownService } from '../_service/markdown.service';

@Pipe({ name: 'markdown', standalone: true })
export class MarkdownPipe implements PipeTransform {
  constructor(private md: MarkdownService) {}
  transform(value: string): SafeHtml {
    return this.md.render(value || '');
  }
}
