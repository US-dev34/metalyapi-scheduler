import React from 'react';
import { X, Trash2, MessageSquare } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { useChat } from '@/hooks/useAI';
import { ChatHistory } from '@/components/chat/ChatHistory';
import { MessageInput } from '@/components/chat/MessageInput';
import { ParsedPreview } from '@/components/chat/ParsedPreview';

export const ChatPanel: React.FC = () => {
  const setChatPanelOpen = useUIStore((s) => s.setChatPanelOpen);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  const {
    messages,
    pendingParsed,
    sendMessage,
    confirmAllocations,
    clearPending,
    clearHistory,
    isParsing,
    isConfirming,
  } = useChat(activeProjectId);

  return (
    <div className="panel-slide flex w-96 flex-col border-l border-gray-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary-600" />
          <h2 className="text-sm font-semibold text-gray-800">Chat Input</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearHistory}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="Clear history"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setChatPanelOpen(false)}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Instructions */}
      {messages.length === 0 && (
        <div className="border-b border-gray-100 bg-blue-50 px-4 py-3">
          <p className="text-xs leading-relaxed text-blue-700">
            Type natural language to enter allocation data. For example:
          </p>
          <ul className="mt-1.5 space-y-0.5 text-xs text-blue-600">
            <li>&quot;CW-01 today 5 workers, 3 units done&quot;</li>
            <li>&quot;CW-02 had 7 workers and 5 units completed&quot;</li>
            <li>&quot;DR-01 no work today&quot;</li>
          </ul>
        </div>
      )}

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto">
        <ChatHistory messages={messages} />
      </div>

      {/* Parsed Preview */}
      {pendingParsed && (
        <ParsedPreview
          parsed={pendingParsed}
          onConfirm={confirmAllocations}
          onCancel={clearPending}
          isConfirming={isConfirming}
        />
      )}

      {/* Input */}
      <MessageInput
        onSend={sendMessage}
        disabled={!activeProjectId || isParsing}
        isLoading={isParsing}
      />
    </div>
  );
};
