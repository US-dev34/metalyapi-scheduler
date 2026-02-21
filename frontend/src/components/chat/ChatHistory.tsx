import React, { useEffect, useRef } from 'react';
import { User, Bot, Info } from 'lucide-react';
import type { ChatMessage } from '@/types';
import { cn } from '@/lib/utils';

interface ChatHistoryProps {
  messages: ChatMessage[];
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({ messages }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 p-3">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
};

// ----- Message Bubble -----

interface MessageBubbleProps {
  message: ChatMessage;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex items-start gap-2 rounded-md bg-green-50 px-3 py-2">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
        <p className="text-xs text-green-700">{message.content}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex gap-2',
        isUser ? 'justify-end' : 'justify-start',
      )}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100">
          <Bot className="h-4 w-4 text-primary-600" />
        </div>
      )}

      {/* Message content */}
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-3 py-2 text-sm',
          isUser
            ? 'bg-primary-600 text-white'
            : 'bg-gray-100 text-gray-800',
        )}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        <span
          className={cn(
            'mt-1 block text-[10px]',
            isUser ? 'text-primary-200' : 'text-gray-400',
          )}
        >
          {new Date(message.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200">
          <User className="h-4 w-4 text-gray-600" />
        </div>
      )}
    </div>
  );
};
