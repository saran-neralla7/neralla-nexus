'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useUser } from '@/hooks/useUser';
import { createClient } from '@/lib/supabase/client';
import { askNexus } from './actions';

interface Message {
  id: string;
  sender: 'user' | 'nexus';
  text: string;
  timestamp: Date;
  matches?: any[];
}

const SUGGESTIONS = [
  "Where is my Passport?",
  "Who is my pediatrician?",
  "When does my car policy expire?",
  "Find my doctor's phone number",
  "Show my active investments",
];

export default function AskNexusPage() {
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'nexus',
      text: "Hello! I am your private family assistant. I can search through your family members, documents, medical history, policies, assets, and contacts. What can I find for you today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isPending, startTransition] = useTransition();
  const [pinVerified, setPinVerified] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isPending]);

  // Check if there is an active vault PIN verification session
  useEffect(() => {
    const checkVaultSession = async () => {
      try {
        const supabase = createClient();
        // Since we store session in cookie 'nexus_vault_verified', we can check if it exists or query RPC
        const { data: verified } = await supabase.rpc('is_vault_session_active');
        setPinVerified(!!verified);
      } catch {
        setPinVerified(false);
      }
    };
    checkVaultSession();
  }, []);

  const handleSend = (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    startTransition(async () => {
      try {
        const res = await askNexus(textToSend, pinVerified);
        const nexusMsg: Message = {
          id: `nexus-${Date.now()}`,
          sender: 'nexus',
          text: res.answer,
          timestamp: new Date(),
          matches: res.matches || [],
        };
        setMessages((prev) => [...prev, nexusMsg]);
      } catch (err: any) {
        toast.error('Failed to get answer from Nexus AI');
        const errorMsg: Message = {
          id: `nexus-err-${Date.now()}`,
          sender: 'nexus',
          text: "I ran into a problem processing your request. Please try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    });
  };

  const getMatchIcon = (type: string) => {
    switch (type) {
      case 'member':
        return 'family_restroom';
      case 'document':
        return 'description';
      case 'document_locked':
        return 'encrypted';
      case 'medical':
        return 'medical_services';
      case 'policy':
        return 'policy';
      case 'asset':
        return 'inventory_2';
      case 'contact':
        return 'contact_phone';
      default:
        return 'search';
    }
  };

  return (
    <div className="px-4 md:px-8 py-6 h-[calc(100vh-160px)] md:h-[calc(100vh-100px)] flex flex-col justify-between">
      {/* Header */}
      <div className="flex-shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <span
            className="material-symbols-outlined text-[30px]"
            style={{ color: '#4fdbc8', fontVariationSettings: "'FILL' 1" }}
          >
            smart_toy
          </span>
          <h1
            style={{
              fontFamily: 'Geist, sans-serif',
              fontSize: '32px',
              fontWeight: '700',
              color: '#dde4e1',
              letterSpacing: '-0.02em',
            }}
          >
            Ask Nexus AI
          </h1>
        </div>
        <p className="text-body-md" style={{ color: '#859490' }}>
          Your private, localized assistant that searches and indexes the family archives.
        </p>
      </div>

      {/* Messages Board */}
      <div className="flex-1 my-6 overflow-y-auto px-2 py-4 rounded-2xl glass border border-white/5 space-y-4 custom-scrollbar">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-4 flex flex-col gap-2 ${
                  isUser
                    ? 'bg-gradient-to-br from-[#14b8a6] to-[#0566d9] text-white rounded-tr-none'
                    : 'bg-white/5 border border-white/10 text-[#dde4e1] rounded-tl-none'
                }`}
              >
                <div className="text-body-sm leading-relaxed whitespace-pre-wrap">
                  {msg.text}
                </div>

                {/* Match Cards */}
                {!isUser && msg.matches && msg.matches.length > 0 && (
                  <div className="mt-3 space-y-2 pt-3 border-t border-white/5">
                    <p className="text-[10px] uppercase tracking-wider text-[#859490] font-bold">Matches Found</p>
                    <div className="grid grid-cols-1 gap-2">
                      {msg.matches.map((match: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-3 hover:bg-white/5 transition-all"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="material-symbols-outlined text-[20px] text-[#4fdbc8]">
                              {getMatchIcon(match.type)}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-xs text-[#dde4e1] truncate">{match.title}</p>
                              <p className="text-[10px] text-[#859490] mt-0.5">{match.subtitle}</p>
                            </div>
                          </div>
                          
                          {match.type === 'document' ? (
                            <a
                              href={match.link}
                              target="_blank"
                              rel="noreferrer"
                              className="py-1 px-3 bg-[#14b8a6]/10 text-[#4fdbc8] border border-[#14b8a6]/20 rounded-lg text-[10px] font-bold hover:bg-[#14b8a6]/20 transition-all flex items-center gap-1"
                            >
                              Open File
                            </a>
                          ) : (
                            <Link
                              href={match.link}
                              className="py-1 px-3 bg-[#14b8a6]/10 text-[#4fdbc8] border border-[#14b8a6]/20 rounded-lg text-[10px] font-bold hover:bg-[#14b8a6]/20 transition-all flex items-center gap-1"
                            >
                              Go to Page
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <span
                  className={`text-[9px] self-end mt-1 ${
                    isUser ? 'text-white/60' : 'text-[#859490]'
                  }`}
                >
                  {msg.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}

        {/* Loading Bubble */}
        {isPending && (
          <div className="flex w-full justify-start">
            <div className="rounded-2xl rounded-tl-none p-4 bg-white/5 border border-white/10 flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#4fdbc8] animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-[#4fdbc8] animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-[#4fdbc8] animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips */}
      <div className="flex-shrink-0 flex gap-2 overflow-x-auto pb-3 pt-1 custom-scrollbar">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => handleSend(s)}
            className="flex-shrink-0 py-1.5 px-3.5 rounded-full text-xs border border-white/5 hover:border-[#4fdbc8]/30 bg-white/5 text-[#bbcac6] hover:text-[#4fdbc8] transition-all"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input Tray */}
      <div className="flex-shrink-0 flex items-center gap-3 pt-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
          placeholder="Ask a question about family data..."
          disabled={isPending}
          className="flex-1 px-4 py-3.5 rounded-xl border border-white/10 bg-transparent text-[#dde4e1] placeholder:text-[#859490]/50 focus:border-[#4fdbc8] focus:outline-none"
        />
        <button
          onClick={() => handleSend(input)}
          disabled={!input.trim() || isPending}
          className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#14b8a6] to-[#0566d9] text-white flex items-center justify-center hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:scale-100 transition-all shadow-lg flex-shrink-0"
        >
          <span className="material-symbols-outlined text-[20px]">send</span>
        </button>
      </div>
    </div>
  );
}
