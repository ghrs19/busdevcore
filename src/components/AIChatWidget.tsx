'use client';

import { Send, Sparkles, X, Zap } from 'lucide-react';
import React, { useState, useRef, useEffect, Suspense } from 'react';
import { usePathname } from 'next/navigation';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time: string;
}

function AIChatWidgetContent() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init',
      role: 'assistant',
      content: 'Halo! Saya BusDev AI Copilot. Ada yang bisa saya bantu terkait data estimasi, penawaran komersial, klien, atau tarif role di busdevcore?',
      time: 'Sekarang',
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Draggable FAB State
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);

  // Auto scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Sembunyikan di halaman login atau print view
  if (pathname === '/login' || pathname?.includes('/print')) {
    return null;
  }

  // Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isOpen) return;
    setIsDragging(false);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.startX;
      const dy = moveEvent.clientY - dragStartRef.current.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        setIsDragging(true);
      }
      setPosition({
        x: dragStartRef.current.posX + dx,
        y: dragStartRef.current.posY + dy,
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setTimeout(() => {
        setIsDragging(false);
        dragStartRef.current = null;
      }, 50);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Touch Support for Mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isOpen) return;
    const touch = e.touches[0];
    dragStartRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      posX: position.x,
      posY: position.y,
    };

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (!dragStartRef.current) return;
      const moveTouch = moveEvent.touches[0];
      const dx = moveTouch.clientX - dragStartRef.current.startX;
      const dy = moveTouch.clientY - dragStartRef.current.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        setIsDragging(true);
      }
      setPosition({
        x: dragStartRef.current.posX + dx,
        y: dragStartRef.current.posY + dy,
      });
    };

    const handleTouchEnd = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      setTimeout(() => {
        setIsDragging(false);
        dragStartRef.current = null;
      }, 50);
    };

    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  };

  const handleFabClick = () => {
    if (isDragging) return;
    setIsOpen(!isOpen);
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputMessage).trim();
    if (!textToSend || loading) return;

    const messageId = crypto.randomUUID();
    const currentTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: String(messageId),
      role: 'user',
      content: textToSend,
      time: currentTime,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInputMessage('');
    setLoading(true);

    try {
      const historyPayload = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          chat_history: historyPayload,
        }),
      });

      const data = await res.json();
      if (data.success && data.reply) {
        const assistantMsg: ChatMessage = {
          id: `${messageId}-response`,
          role: 'assistant',
          content: data.reply,
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        throw new Error(data.error || 'Gagal menerima balasan AI');
      }
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : 'Terjadi kendala jaringan';
      const errorMsg: ChatMessage = {
        id: `${messageId}-response`,
        role: 'assistant',
        content: `Maaf, saya sedang mengalami kendala: ${errText}`,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Draggable Floating Action Button Container */}
      <div
        style={{
          position: 'fixed',
          right: '28px',
          bottom: '28px',
          transform: `translate(${position.x}px, ${position.y}px)`,
          zIndex: 9999,
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        {/* Floating Chat Window */}
        {isOpen && (
          <div
            ref={chatWindowRef}
            className="linear-card-elevated"
            style={{
              position: 'absolute',
              bottom: '68px',
              right: 0,
              width: '390px',
              height: '520px',
              maxWidth: 'calc(100vw - 40px)',
              maxHeight: 'calc(100vh - 120px)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-hover)',
              borderRadius: '14px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.25), 0 0 20px rgb(var(--accent-rgb) / 0.25)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'fadeIn 0.15s ease-out',
            }}
          >
            {/* Chat Header */}
            <div
              style={{
                padding: '14px 18px',
                background: 'var(--row-hover)',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-text) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    boxShadow: '0 0 10px rgb(var(--accent-rgb) / 0.4)',
                  }}
                >
                  <Zap style={{ width: '16px', height: '16px' }} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>BusDev AI Copilot</span>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-success)' }} />
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    Terhubung ke Hermes Agent & Database
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  transition: 'color 0.1s ease',
                }}
                title="Tutup Chat"
              >
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            {/* Quick Context Prompt Chips */}
            <div
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--row-hover)',
                display: 'flex',
                gap: '6px',
                overflowX: 'auto',
                scrollbarWidth: 'none',
              }}
            >
              {[
                'Apa proposal terbaru?',
                'Ringkasan klien & deal',
                'Tarif gaji role master',
              ].map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(chip)}
                  style={{
                    whiteSpace: 'nowrap',
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    background: 'var(--row-hover)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Chat Messages Body */}
            <div
              style={{
                flex: 1,
                padding: '16px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                background: 'var(--row-hover)',
              }}
            >
              {messages.map((m) => {
                const isUser = m.role === 'user';
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isUser ? 'flex-end' : 'flex-start',
                      maxWidth: '90%',
                      alignSelf: isUser ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                        background: isUser
                          ? 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-hover) 100%)'
                          : 'var(--row-hover)',
                        border: isUser ? 'none' : '1px solid var(--border-subtle)',
                        color: isUser ? '#ffffff' : 'var(--text-primary)',
                        fontSize: '12.5px',
                        lineHeight: '1.5',
                        whiteSpace: 'pre-wrap',
                        boxShadow: isUser ? '0 2px 8px rgb(var(--accent-rgb) / 0.2)' : 'none',
                      }}
                    >
                      {m.content}
                    </div>
                    <span
                      style={{
                        fontSize: '10px',
                        color: 'var(--text-tertiary)',
                        marginTop: '3px',
                        padding: '0 4px',
                      }}
                    >
                      {m.time}
                    </span>
                  </div>
                );
              })}

              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-tertiary)', fontSize: '12px', padding: '6px 12px' }}>
                  <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-hover)' }} />
                  <span>BusDev AI sedang menganalisis data...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Footer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              style={{
                padding: '12px 14px',
                background: 'var(--row-hover-faint)',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
              }}
            >
              <input
                type="text"
                className="linear-input"
                placeholder="Tanyakan data klien, proposal, estimasi..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={loading}
                style={{
                  flex: 1,
                  fontSize: '12.5px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                }}
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || loading}
                className="btn-primary"
                style={{
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  cursor: !inputMessage.trim() || loading ? 'not-allowed' : 'pointer',
                  opacity: !inputMessage.trim() || loading ? 0.6 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>Kirim</span>
                <Send style={{ width: '13px', height: '13px' }} />
              </button>
            </form>
          </div>
        )}

        {/* The Round Draggable Floating Action Button */}
        <div
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onClick={handleFabClick}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: isOpen
              ? 'rgb(var(--ink-rgb) / 0.1)'
              : 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-text) 100%)',
            boxShadow: isOpen
              ? '0 4px 12px rgba(0,0,0,0.4)'
              : '0 8px 24px rgb(var(--accent-rgb) / 0.4), 0 0 12px rgb(var(--accent-rgb) / 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            cursor: isDragging ? 'grabbing' : 'pointer',
            border: isOpen ? '1px solid var(--border-hover)' : '1px solid rgb(var(--ink-rgb) / 0.2)',
            transition: isDragging ? 'none' : 'transform 0.15s ease, box-shadow 0.15s ease',
            transform: 'scale(1)',
          }}
          title={isOpen ? 'Tutup AI Assistant' : 'Tarik (Drag) atau Klik untuk Chat dengan AI'}
        >
          {isOpen ? (
            <X style={{ width: '24px', height: '24px', color: '#fff' }} />
          ) : (
            <Sparkles style={{ width: '26px', height: '26px', color: '#fff' }} />
          )}
        </div>
      </div>
    </>
  );
}

export default function AIChatWidget() {
  return (
    <Suspense fallback={null}>
      <AIChatWidgetContent />
    </Suspense>
  );
}
