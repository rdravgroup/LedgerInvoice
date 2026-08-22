import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, OnDestroy, OnInit, Optional, ViewChild } from '@angular/core';
import { environment } from '../../../environments/environment';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../material.module';
import { AiChatService } from '../../_service/ai-chat.service';
import { AuthService } from '../../_service/authentication.service';
import { SelectedCompanyService } from '../../_service/selected-company.service';
import { MarkdownPipe } from '../../_pipe/markdown.pipe';
import { ChatMessage } from '../../_model/ai-chat.model';

@Component({
  selector: 'app-ai-chat',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, MarkdownPipe],
  templateUrl: './ai-chat.component.html',
  styleUrls: ['./ai-chat.component.css']
})
export class AiChatComponent implements AfterViewChecked, OnDestroy {
  @ViewChild('messagesViewport') private messagesViewport?: ElementRef<HTMLDivElement>;

  messageControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(2000)]
  });

  messages: ChatMessage[] = [
    {
      id: crypto.randomUUID(),
      sender: 'assistant',
      text: 'Hi, I am your CodeXClear ERP assistant. Ask me about invoices, customers, products, ledger, payments, purchases, reports, or access issues.',
      timestamp: new Date()
    }
  ];

  quickActionGroups = [
    {
      title: 'Sales',
      icon: 'trending_up',
      prompts: ['Business this month from sales and receivables', 'Total sales as of now', 'Show month wise sales']
    },
    {
      title: 'Invoices',
      icon: 'receipt_long',
      prompts: ['How many invoices were created in the past month?', 'Create a sales invoice for 5 laptops', 'Show outstanding ageing']
    },
    {
      title: 'Inventory',
      icon: 'inventory_2',
      prompts: ['Show low stock products', 'Show product summary', 'Show purchase summary this month']
    }
  ];

  // session management
  sessions: Array<{ id: string; title: string; timestamp: string; messages: ChatMessage[] }> = [];
  selectedSessionId: string | null = null;

  sending = false;
  isMaximized = false;
  quickActionsOpen = false;
  isDragging = false;
  private shouldScroll = true;
  private currentAbortController?: AbortController | null = null;
  private storageKey = '';
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private readonly dragMoveHandler = (event: PointerEvent) => this.onDragMove(event);
  private readonly dragEndHandler = () => this.stopDrag();

  constructor(
    private aiChatService: AiChatService,
    private authService: AuthService,
    private selectedCompanyService: SelectedCompanyService,
    @Optional() private dialogRef?: MatDialogRef<AiChatComponent>
  ) {}

  get isDialogMode(): boolean {
    return !!this.dialogRef;
  }

  ngOnInit(): void {
    const companyId = (window.localStorage.getItem('companyid') || 'global') as string;
    this.storageKey = `ai_chat_history_${companyId}`;
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) this.messages = JSON.parse(raw) as ChatMessage[];
    } catch { /* ignore parse errors */ }
    this.loadSessions();
  }

  private sessionsKey(): string {
    const companyId = (window.localStorage.getItem('companyid') || 'global') as string;
    return `ai_chat_sessions_${companyId}`;
  }

  private loadSessions(): void {
    try {
      const raw = localStorage.getItem(this.sessionsKey());
      this.sessions = raw ? JSON.parse(raw) : [];
    } catch { this.sessions = []; }
  }

  saveSession(): void {
    try {
      const id = crypto.randomUUID();
      const title = this.messages.find(m => m.sender === 'user')?.text?.slice(0, 60) || `Conversation ${new Date().toLocaleString()}`;
      const session = { id, title, timestamp: new Date().toISOString(), messages: JSON.parse(JSON.stringify(this.messages)) };
      this.sessions.unshift(session);
      // limit to 20
      if (this.sessions.length > 20) this.sessions = this.sessions.slice(0, 20);
      localStorage.setItem(this.sessionsKey(), JSON.stringify(this.sessions));
      this.selectedSessionId = id;
    } catch { /* ignore */ }
  }

  loadSession(id: string | null): void {
    if (!id) return;
    const s = this.sessions.find(x => x.id === id);
    if (!s) return;
    this.messages = JSON.parse(JSON.stringify(s.messages));
    this.selectedSessionId = id;
    this.shouldScroll = true;
  }

  clearSessions(): void {
    try { localStorage.removeItem(this.sessionsKey()); this.sessions = []; this.selectedSessionId = null; } catch { }
  }

  retryAssistantFailure(failedMessage: ChatMessage): void {
    // find previous user message
    const idx = this.messages.findIndex(m => m.id === failedMessage.id);
    if (idx <= 0) return;
    for (let i = idx - 1; i >= 0; i--) {
      const m = this.messages[i];
      if (m.sender === 'user') {
        this.messageControl.setValue(m.text);
        this.sendMessage();
        return;
      }
    }
  }

  ngAfterViewChecked(): void {
    if (!this.shouldScroll) return;
    this.scrollToBottom();
    this.shouldScroll = false;
  }

  ngOnDestroy(): void {
    this.stopDrag();
    try { this.currentAbortController?.abort(); } catch { /* ignore */ }
  }

  sendMessage(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    const text = this.messageControl.value.trim();
    if (!text || this.messageControl.invalid || this.sending) return;

    this.messages.push({
      id: crypto.randomUUID(),
      sender: 'user',
      text,
      timestamp: new Date()
    });

    this.messageControl.reset('');
    this.sending = true;
    this.shouldScroll = true;

    // Use streaming endpoint so UI shows incremental typing
    this.streamResponse(text).catch(() => {
      this.sending = false;
      this.shouldScroll = true;
      this.messages.push({
        id: crypto.randomUUID(),
        sender: 'assistant',
        text: 'I could not reach the AI service right now. Please try again in a moment.',
        timestamp: new Date(),
        failed: true
      });
    });
  }

  private async streamResponse(message: string): Promise<void> {
    this.sending = true;
    this.shouldScroll = true;

    // Add placeholder assistant message to append to
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'assistant',
      text: '',
      timestamp: new Date()
    };

    this.messages.push(assistantMsg);

    const token = localStorage.getItem('token');
    this.currentAbortController = new AbortController();
    const signal = this.currentAbortController.signal;
    try {
      const resp = await fetch(`${environment.apiUrl}ai/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ message, companyId: this.getEffectiveCompanyId() }),
        signal
      });

      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let buffer = '';

      while (!done) {
        const { value, done: d } = await reader.read();
        done = !!d;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          // process lines
          const parts = buffer.split('\n');
          buffer = parts.pop() || '';
          for (const line of parts) {
            if (!line) continue;
            // SSE events are like: data: {json}\n
            const trimmed = line.trim();
            if (trimmed.startsWith('data:')) {
              const data = trimmed.substring(5).trim();
              if (data === '[DONE]') { done = true; break; }
              try {
                const obj = JSON.parse(data);
                // OpenAI stream: choices[].delta.content
                const choices = obj.choices || [];
                if (choices.length > 0) {
                  const ch = choices[0];
                  let content = '';
                  if (ch.delta && ch.delta.content) content = ch.delta.content;
                  else if (ch.message && ch.message.content) content = ch.message.content;
                  else if (obj.text) content = obj.text;
                  if (content) {
                    assistantMsg.text += content;
                    assistantMsg.timestamp = new Date();
                    this.shouldScroll = true;
                  }
                } else if (obj.error) {
                  assistantMsg.text += `${assistantMsg.text ? '\n' : ''}${obj.error}`;
                  assistantMsg.failed = true;
                }
              } catch (ex) {
                // not JSON - append raw
                assistantMsg.text += data + '\n';
              }
            } else {
              // fallback: append raw
              assistantMsg.text += line;
            }
          }
          this.shouldScroll = true;
        }
      }
    } catch (err) {
      if ((err as any)?.name === 'AbortError') {
        assistantMsg.text += '\n[Stopped by user]';
      } else {
        assistantMsg.text += '\n[Error getting response]';
        throw err;
      }
    } finally {
      this.currentAbortController = null;
      this.sending = false;
      this.shouldScroll = true;
      try { localStorage.setItem(this.storageKey, JSON.stringify(this.messages)); } catch { }
    }
  }

  handleEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.shiftKey) return;
    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
    this.sendMessage(keyboardEvent);
  }

  handlePaste(event: ClipboardEvent): void {
    event.stopPropagation();
  }

  usePrompt(prompt: string): void {
    if (this.sending) return;
    this.messageControl.setValue(prompt);
    this.sendMessage();
  }

  private getEffectiveCompanyId(): string | null {
    return this.selectedCompanyService.getSelectedCompanyId() || this.authService.getCompanyId();
  }

  stopStreaming(): void {
    try { this.currentAbortController?.abort(); } catch { /* ignore */ }
  }

  stopDialogEvent(event: Event): void {
    event.stopPropagation();
  }


  startDrag(event: PointerEvent): void {
    if (!this.dialogRef || this.isMaximized || event.button !== 0) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, mat-select, .no-drag')) return;

    const pane = this.getDialogPane();
    if (!pane) return;

    const rect = pane.getBoundingClientRect();
    this.dragOffsetX = event.clientX - rect.left;
    this.dragOffsetY = event.clientY - rect.top;
    this.isDragging = true;
    document.body.classList.add('ai-chat-dragging');
    window.addEventListener('pointermove', this.dragMoveHandler);
    window.addEventListener('pointerup', this.dragEndHandler, { once: true });
    event.preventDefault();
  }

  private onDragMove(event: PointerEvent): void {
    if (!this.dialogRef || !this.isDragging) return;

    const pane = this.getDialogPane();
    const width = pane?.offsetWidth || 440;
    const height = pane?.offsetHeight || 600;
    const margin = 8;
    const left = Math.min(Math.max(event.clientX - this.dragOffsetX, margin), window.innerWidth - width - margin);
    const top = Math.min(Math.max(event.clientY - this.dragOffsetY, margin), window.innerHeight - height - margin);

    this.dialogRef.updatePosition({ left: `${left}px`, top: `${top}px` });
  }

  private stopDrag(): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    document.body.classList.remove('ai-chat-dragging');
    window.removeEventListener('pointermove', this.dragMoveHandler);
    window.removeEventListener('pointerup', this.dragEndHandler);
  }

  private getDialogPane(): HTMLElement | null {
    return this.messagesViewport?.nativeElement.closest('.cdk-overlay-pane') as HTMLElement | null;
  }
  trackMessage(_: number, message: ChatMessage): string {
    return message.id;
  }

  toggleMaximize(): void {
    if (!this.dialogRef) return;

    this.isMaximized = !this.isMaximized;
    if (this.isMaximized) {
      this.dialogRef.updateSize('min(980px, calc(100vw - 32px))', 'min(780px, calc(100vh - 32px))');
      this.dialogRef.updatePosition({ right: '24px', bottom: '24px' });
      return;
    }

    this.dialogRef.updateSize('440px', '600px');
    this.dialogRef.updatePosition({ right: '24px', bottom: '88px' });
  }

  closeDialog(): void {
    this.dialogRef?.close();
  }

  private scrollToBottom(): void {
    const element = this.messagesViewport?.nativeElement;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }
}









