import { apiClient } from './api';
import { ChatMessage, ConversationEntry } from '@/types/api';

export const chatService = {
  getChatHistory: async (toUserId: string, limit = 50): Promise<ChatMessage[]> => {
    const response = await apiClient.get<{ messages: ChatMessage[] }>(
      `/notifications/chat/${toUserId}`,
      { params: { limit } }
    );
    return response.data.messages || [];
  },

  getConversations: async (limit = 30): Promise<ConversationEntry[]> => {
    const response = await apiClient.get<{ conversations: ConversationEntry[] }>(
      '/notifications/conversations',
      { params: { limit } }
    );
    return response.data.conversations || [];
  },
};
