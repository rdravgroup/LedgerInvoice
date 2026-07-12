export interface AiChatRequest {
  message: string;
  companyId?: string | null;
}

export interface AiChatResponse {
  message: string;
  timestampUtc: string;
}

export interface AiChatApiResponse {
  responseCode: number;
  result: string;
  errorMessage: string;
  data: AiChatResponse;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  failed?: boolean;
}


