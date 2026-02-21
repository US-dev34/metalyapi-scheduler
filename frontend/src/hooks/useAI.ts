import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi, chatApi } from '@/lib/api';
import { DEMO_MODE, getMockChatResponse, getMockForecast } from '@/lib/mockData';
import type { ChatMessage, ChatParseResponse, ForecastResponse } from '@/types';

const AI_KEYS = {
  forecast: (projectId: string) => ['ai', 'forecast', projectId] as const,
};

/**
 * Fetch AI forecast (triggers on-demand via POST).
 */
export function useGenerateForecast(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (): Promise<ForecastResponse> => {
      if (DEMO_MODE) {
        return new Promise((resolve) =>
          setTimeout(() => resolve(getMockForecast()), 800),
        );
      }
      return aiApi.getForecast(projectId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AI_KEYS.forecast(projectId) });
    },
  });
}

/**
 * Chat hook — manages message state, parse, confirm flow.
 * Uses IC-003 ChatParseResponse format.
 */
export function useChat(projectId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingParsed, setPendingParsed] = useState<ChatParseResponse | null>(null);
  const queryClient = useQueryClient();

  const parseMutation = useMutation({
    mutationFn: (message: string): Promise<ChatParseResponse> => {
      if (DEMO_MODE) {
        return new Promise((resolve) =>
          setTimeout(() => resolve(getMockChatResponse(message)), 600),
        );
      }
      return chatApi.sendMessage(projectId!, message);
    },
    onSuccess: (result: ChatParseResponse, message: string) => {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      };
      const assistantMsg: ChatMessage = {
        id: result.message_id,
        role: 'assistant',
        content: result.summary,
        timestamp: new Date().toISOString(),
        parsed: result,
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setPendingParsed(result);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (messageId: string) => {
      if (DEMO_MODE) {
        return new Promise<void>((resolve) => setTimeout(resolve, 400));
      }
      return chatApi.applyActions(projectId!, messageId);
    },
    onSuccess: () => {
      const systemMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'system',
        content: 'Allocations applied successfully.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, systemMsg]);
      setPendingParsed(null);
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
    },
  });

  const sendMessage = useCallback((message: string) => {
    if (!projectId) return;
    parseMutation.mutate(message);
  }, [projectId, parseMutation]);

  const confirmAllocations = useCallback(() => {
    if (!pendingParsed) return;
    confirmMutation.mutate(pendingParsed.message_id);
  }, [pendingParsed, confirmMutation]);

  const clearPending = useCallback(() => setPendingParsed(null), []);
  const clearHistory = useCallback(() => {
    setMessages([]);
    setPendingParsed(null);
  }, []);

  return {
    messages,
    pendingParsed,
    sendMessage,
    confirmAllocations,
    clearPending,
    clearHistory,
    isParsing: parseMutation.isPending,
    isConfirming: confirmMutation.isPending,
    parseError: parseMutation.error,
    confirmError: confirmMutation.error,
  };
}
