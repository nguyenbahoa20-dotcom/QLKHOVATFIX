import React, { useState, useRef, useEffect } from 'react';
import { Bot, Sparkles, Send, X, Trash2, RefreshCw, ChevronDown, MessageSquare, AlertCircle, TrendingUp, Package, ReceiptText, ShieldAlert } from 'lucide-react';
import { Company, InventoryItem, Invoice } from '../types';
import { apiSendAIChatMessage } from '../utils/api';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface AIChatProps {
  selectedCompany?: Company | null;
  inventory?: InventoryItem[];
  invoices?: Invoice[];
  isNotificationVisible?: boolean;
}

export const AIChat: React.FC<AIChatProps> = ({
  selectedCompany,
  inventory = [],
  invoices = [],
  isNotificationVisible = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize welcome message when company changes or when opened first time
  useEffect(() => {
    const compName = selectedCompany?.name || 'Công ty của bạn';
    setMessages([
      {
        id: 'welcome-1',
        sender: 'assistant',
        text: `👋 **Xin chào! Tôi là Trợ Lý Kế Toán TaxVault Data Analyst.**\n\nTôi đang kết nối trực tiếp với CSDL SQLite (vat_database.db) của **${compName}**.\n\nBạn có thể hỏi tôi bất kỳ thông tin nào về **Tồn kho**, **Tổng thuế VAT**, **Cảnh báo hàng tồn** hoặc **Hóa đơn giá trị cao nhất**!`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  }, [selectedCompany?.id]);

  // Scroll to bottom on message updates
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, messages, isLoading]);

  // Quick Prompts as explicitly specified in prompt
  const QUICK_PROMPTS = [
    { label: '📊 Tóm tắt tồn kho hiện tại', prompt: 'Tóm tắt tồn kho hiện tại' },
    { label: '🔝 Hóa đơn có giá trị cao nhất?', prompt: 'Hóa đơn nào có giá trị cao nhất?' },
    { label: '⚠️ Cảnh báo mặt hàng sắp hết', prompt: 'Cảnh báo mặt hàng sắp hết' },
    { label: '💰 Tổng VAT mua vào tháng này', prompt: 'Tổng VAT mua vào tháng này là bao nhiêu?' },
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = (textToSend || inputMessage).trim();
    if (!messageText || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: messageText,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');
    setIsLoading(true);

    try {
      // Build conversation history for context
      const history = messages
        .filter((m) => m.id !== 'welcome-1')
        .map((m) => ({
          role: m.sender === 'user' ? ('user' as const) : ('model' as const),
          text: m.text,
        }));

      const replyText = await apiSendAIChatMessage(
        messageText,
        selectedCompany?.id,
        history,
        inventory,
        invoices
      );

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error('Error getting AI reply:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: '❌ Rất tiếc, không thể kết nối đến Trợ lý AI. Vui lòng kiểm tra dịch vụ backend.',
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearMessages = () => {
    const compName = selectedCompany?.name || 'Công ty của bạn';
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'assistant',
        text: `Đã làm sạch hội thoại! Tôi đã sẵn sàng phân tích CSDL của **${compName}**. Mời bạn chọn gợi ý hoặc nhập câu hỏi bên dưới.`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // Helper to render bold text & bullet points formatted nicely
  const renderFormattedText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Process bold formatting **text**
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const lineContent = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={pIdx} className="font-bold text-slate-900 bg-emerald-50/80 px-1 py-0.5 rounded border border-emerald-200/50">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      });

      const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-');

      return (
        <div
          key={idx}
          className={`${isBullet ? 'pl-2 my-1 flex items-start gap-1.5' : 'my-0.5'} ${
            line.trim() === '' ? 'h-2' : ''
          }`}
        >
          {lineContent}
        </div>
      );
    });
  };

  return (
    <>
      {/* 1. COMPACT FLOATING CHAT BUTTON (Round Icon Button at Bottom-Right Corner) */}
      <div
        className={`fixed right-6 z-50 flex flex-col items-end gap-2 transition-all duration-300 pointer-events-auto ${
          isNotificationVisible ? 'bottom-28' : 'bottom-6'
        }`}
      >
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`group relative w-12 h-12 rounded-full shadow-xl transition-all duration-300 flex items-center justify-center cursor-pointer ${
            isOpen
              ? 'bg-slate-800 text-white hover:bg-slate-700 rotate-90 scale-95 ring-2 ring-slate-600'
              : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white hover:shadow-emerald-500/40 hover:scale-110 active:scale-95 ring-4 ring-emerald-500/20'
          }`}
          title="Trợ lý AI TaxVault Data Analyst"
        >
          {isOpen ? (
            <X className="w-5 h-5 transition-transform" />
          ) : (
            <div className="relative flex items-center justify-center">
              <Bot className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
              <Sparkles className="w-3 h-3 text-amber-300 absolute -top-1 -right-1 animate-pulse" />
            </div>
          )}
        </button>
      </div>

      {/* 2. FLOATING CHAT DRAWER / WINDOW */}
      {isOpen && (
        <div
          className={`fixed right-6 w-[380px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[80vh] bg-white rounded-3xl shadow-2xl border border-slate-200 z-50 flex flex-col overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 ${
            isNotificationVisible ? 'bottom-44' : 'bottom-20'
          }`}
        >
          {/* Header */}
          <div className="px-4 py-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white flex items-center justify-between border-b border-slate-800 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-500/20 rounded-xl border border-emerald-400/30 text-emerald-300 flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm text-slate-100 tracking-tight">TaxVault Data Analyst</h3>
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 truncate max-w-[210px]">
                  {selectedCompany ? selectedCompany.name : 'CSDL SQLite Trực Tuyến'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleClearMessages}
                className="p-1.5 text-slate-400 hover:text-rose-300 hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                title="Làm sạch hội thoại"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                title="Đóng cửa sổ chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/50 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] p-3.5 rounded-2xl shadow-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-emerald-600 text-white rounded-tr-xs font-medium'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs shadow-slate-100'
                  }`}
                >
                  {msg.sender === 'assistant' ? (
                    <div className="space-y-1 text-slate-800">{renderFormattedText(msg.text)}</div>
                  ) : (
                    <div>{msg.text}</div>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">
                  {msg.sender === 'user' ? 'Bạn' : 'AI Analyst'} • {msg.timestamp}
                </span>
              </div>
            ))}

            {isLoading && (
              <div className="flex flex-col items-start">
                <div className="bg-white border border-slate-200/80 text-slate-600 p-3.5 rounded-2xl rounded-tl-xs shadow-xs flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                  <span className="text-xs font-medium text-slate-600">TaxVault AI đang truy vấn CSDL SQLite...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Bar (Gợi ý nhanh trên ô nhập liệu) */}
          <div className="p-2.5 bg-white border-t border-slate-100">
            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>Gợi ý nhanh cho Kế toán:</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {QUICK_PROMPTS.map((qp, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(qp.prompt)}
                  disabled={isLoading}
                  className="px-2.5 py-1.5 text-[11px] font-medium bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200/80 rounded-xl text-slate-700 transition-all cursor-pointer whitespace-nowrap shadow-2xs disabled:opacity-50"
                >
                  {qp.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input Area */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Đặt câu hỏi về tồn kho, VAT, hóa đơn..."
              disabled={isLoading}
              className="flex-1 px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isLoading}
              className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer flex items-center justify-center shrink-0"
              title="Gửi câu hỏi"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
