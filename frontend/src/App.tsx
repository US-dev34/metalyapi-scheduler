import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Sidebar } from '@/components/layout/Sidebar';
import { MainContent } from '@/components/layout/MainContent';
import { Header } from '@/components/layout/Header';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { AIPanel } from '@/components/ai/AIPanel';
import { LoginPage } from '@/components/auth/LoginPage';
import { useUIStore } from '@/stores/uiStore';
import { supabase } from '@/lib/supabase';

const App: React.FC = () => {
  const chatPanelOpen = useUIStore((s) => s.chatPanelOpen);
  const aiPanelOpen = useUIStore((s) => s.aiPanelOpen);

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <MainContent />
      </div>

      {/* Slide-out panels */}
      {chatPanelOpen && <ChatPanel />}
      {aiPanelOpen && <AIPanel />}
    </div>
  );
};

export default App;
