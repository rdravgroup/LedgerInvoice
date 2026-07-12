import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, Optional, ViewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../material.module';
import { AiChatService } from '../../_service/ai-chat.service';
import { ChatMessage } from '../../_model/ai-chat.model';

@Component({
  selector: 'app-ai-chat',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  templateUrl: './ai-chat.component.html',
  styleUrls: ['./ai-chat.component.css']
})
export class AiChatComponent implements AfterViewChecked {
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

  suggestedPrompts = [
    'Total sales as of now',
    'How many invoices were created in the past month?',
    'Show month wise sales',
    'Show outstanding ageing',
    'Show low stock products',
    'Show purchase summary this month'
  ];

  sending = false;
  isMaximized = false;
  private shouldScroll = true;

  constructor(
    private aiChatService: AiChatService,
    @Optional() private dialogRef?: MatDialogRef<AiChatComponent>
  ) {}

  get isDialogMode(): boolean {
    return !!this.dialogRef;
  }

  ngAfterViewChecked(): void {
    if (!this.shouldScroll) return;
    this.scrollToBottom();
    this.shouldScroll = false;
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

    this.aiChatService.sendMessage(text)
      .pipe(finalize(() => {
        this.sending = false;
        this.shouldScroll = true;
      }))
      .subscribe({
        next: (response) => {
          this.messages.push({
            id: crypto.randomUUID(),
            sender: 'assistant',
            text: response.message,
            timestamp: response.timestampUtc ? new Date(response.timestampUtc) : new Date()
          });
        },
        error: () => {
          this.messages.push({
            id: crypto.randomUUID(),
            sender: 'assistant',
            text: 'I could not reach the AI service right now. Please try again in a moment.',
            timestamp: new Date(),
            failed: true
          });
        }
      });
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

  stopDialogEvent(event: Event): void {
    event.stopPropagation();
  }

  trackMessage(_: number, message: ChatMessage): string {
    return message.id;
  }

  toggleMaximize(): void {
    if (!this.dialogRef) return;

    this.isMaximized = !this.isMaximized;
    if (this.isMaximized) {
      this.dialogRef.updateSize('96vw', '92vh');
      this.dialogRef.updatePosition({ top: '4vh' });
      return;
    }

    this.dialogRef.updateSize('min(760px, calc(100vw - 32px))', 'min(760px, calc(100vh - 32px))');
    this.dialogRef.updatePosition();
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
