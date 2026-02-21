import React, { useState, useRef, useCallback } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSend,
  disabled = false,
  isLoading = false,
}) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setValue('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);

    // Auto-resize textarea
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  return (
    <div className="border-t border-gray-200 p-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? 'Select a project first...'
              : 'Type allocation data in natural language...'
          }
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-400"
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim() || isLoading}
          className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-600 text-white transition-colors hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-gray-400">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
};
