import React, { useState, useEffect, useRef } from "react";
import { 
  motion, 
  AnimatePresence 
} from "motion/react";
import { 
  Send, 
  Search, 
  Image as ImageIcon, 
  Smile, 
  Plus, 
  Check, 
  CheckCheck, 
  Power, 
  ArrowLeft, 
  Users, 
  X, 
  UserPlus, 
  MessageSquare, 
  Volume2, 
  VolumeX, 
  Sparkles
} from "lucide-react";
import { User, Message, Contact } from "../types";

// Standard emoji set for messaging
const EMOJIS = ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥳", "👍", "🔥", "💯", "🙏", "💖", "🚀", "💻", "💪"];

interface ChatRoomProps {
  currentUser: User;
  onLogout: () => void;
  onOpenProfile: () => void;
  onOpenContacts: () => void;
  contacts: Contact[];
  isInstallable: boolean;
  isInIframe: boolean;
  onInstall: () => void;
}

export default function ChatRoom({ 
  currentUser, 
  onLogout, 
  onOpenProfile, 
  onOpenContacts, 
  contacts,
  isInstallable,
  isInIframe,
  onInstall 
}: ChatRoomProps) {
  const [activeContactPhone, setActiveContactPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [typingStates, setTypingStates] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [imageLightbox, setImageLightbox] = useState<string | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [attachmentLoading, setAttachmentLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Derive active contact info
  const activeContact = contacts.find(c => c.phone === activeContactPhone);

  // Play audio feedbacks safely
  const playSfx = (type: "send" | "receive" | "status") => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === "send") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.08); // E5
        gain.gain.setValueAtTime(0.015, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.18);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.18);
      } else if (type === "receive") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.setValueAtTime(440.00, audioCtx.currentTime + 0.08); // A4
        gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.22);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.22);
      } else if (type === "status") {
        // Soft double tick
        osc.type = "sine";
        osc.frequency.setValueAtTime(987.77, audioCtx.currentTime); // B5
        gain.gain.setValueAtTime(0.005, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.05);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
      }
    } catch (e) {
      // Audio block fallback
    }
  };

  // 1. Establish SSE stream for real-time synchronization
  useEffect(() => {
    const sseUrl = `/api/stream?phone=${encodeURIComponent(currentUser.phone)}`;
    const eventSource = new EventSource(sseUrl);

    console.log(`Subscribing to real-time events at: ${sseUrl}`);

    eventSource.onmessage = (event) => {
      // Keepalive heartbeat
    };

    // Listen to new messages
    eventSource.addEventListener("new_message", (e: any) => {
      const newMsg: Message = JSON.parse(e.data);
      console.log("New message arrived via SSE:", newMsg);

      setMessages((prev) => {
        // Prevent duplication if message already exists
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });

      // Handle sound and notification counts
      if (activeContactPhone === newMsg.sender) {
        // Chat actively open, update to READ on server
        fetch("/api/messages/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: currentUser.phone, contactPhone: newMsg.sender })
        });
        playSfx("receive");
      } else {
        // Increment unread count
        setUnreadCounts((prev) => ({
          ...prev,
          [newMsg.sender]: (prev[newMsg.sender] || 0) + 1
        }));
        playSfx("receive");
      }
    });

    // Listen to message status changes (sent -> delivered -> read)
    eventSource.addEventListener("message_status_update", (e: any) => {
      const update = JSON.parse(e.data);
      console.log("Message status updated via SSE:", update);

      setMessages((prev) => 
        prev.map((msg) => {
          if (msg.id === update.messageId) {
            return { ...msg, status: update.status };
          }
          return msg;
        })
      );

      if (update.status === "read") {
        playSfx("status");
      }
    });

    // Listen to typing state events
    eventSource.addEventListener("typing_state", (e: any) => {
      const typingData = JSON.parse(e.data);
      if (typingData.sender) {
        setTypingStates((prev) => ({
          ...prev,
          [typingData.sender]: typingData.isTyping
        }));
      }
    });

    // Handle stream closed
    eventSource.onerror = (err) => {
      console.warn("SSE encountered an issue. Re-establishing channel...");
    };

    return () => {
      eventSource.close();
      console.log("SSE event Source closed.");
    };
  }, [currentUser.phone, activeContactPhone]);

  // 2. Load chats history for selected user
  useEffect(() => {
    if (!activeContactPhone) return;

    // Load conversation history from API
    const loadConversation = async () => {
      try {
        const res = await fetch(`/api/messages?phone=${encodeURIComponent(currentUser.phone)}&contactPhone=${encodeURIComponent(activeContactPhone)}`);
        const data = await res.json();
        if (data.success) {
          setMessages(data.messages);
          // Clear any dynamic unreads
          setUnreadCounts((prev) => ({
            ...prev,
            [activeContactPhone]: 0
          }));
        }
      } catch (err) {
        console.error("Failed to load chat thread:", err);
      }
    };

    loadConversation();
  }, [activeContactPhone, currentUser.phone]);

  // Scroll viewport down to meet target
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingStates]);

  // 3. Handle Text Typing Notification triggers
  const announceTypingState = async (isTyping: boolean) => {
    if (!activeContactPhone) return;
    try {
      await fetch("/api/messages/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          phone: currentUser.phone, 
          contactPhone: activeContactPhone, 
          isTyping 
        })
      });
    } catch (err) {
      // Fail silently for low priority analytics
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    
    // Typing debouncer triggers
    announceTypingState(true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      announceTypingState(false);
    }, 2000);
  };

  // 4. Submit message trigger
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeContactPhone) return;

    const textToSend = inputText;
    setInputText("");
    setShowEmojiPicker(false);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    announceTypingState(false);

    try {
      playSfx("send");
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: currentUser.phone,
          receiver: activeContactPhone,
          text: textToSend
        })
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) => {
          if (prev.some(m => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
    } catch (err) {
      console.error("Message dispatch failure:", err);
    }
  };

  // 5. Image attachment parser (reads raw local files as base64 and fires)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeContactPhone) return;

    setAttachmentLoading(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        playSfx("send");
        const res = await fetch("/api/messages/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sender: currentUser.phone,
            receiver: activeContactPhone,
            text: "📷 Sent a photo",
            imageUrl: base64String
          })
        });
        const data = await res.json();
        if (data.success) {
          setMessages((prev) => [...prev, data.message]);
        }
      } catch (err) {
        console.error("Image dispatch failed:", err);
      } finally {
        setAttachmentLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Filter contacts lists based on search
  const filteredContacts = contacts.filter(
    (c) =>
      c.isAppUser &&
      (c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
       c.phone.includes(searchQuery))
  );

  return (
    <div id="chatroom" className="flex w-full h-screen bg-[#F0F2F5] overflow-hidden antialiased font-sans flex-col md:flex-row select-none">
      
      {/* Lightbox / Media Viewer Overlay Modal */}
      <AnimatePresence>
        {imageLightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setImageLightbox(null)}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 cursor-zoom-out"
          >
            <button 
              onClick={() => setImageLightbox(null)}
              className="absolute top-6 right-6 text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full z-50 transition"
              title="Close image overlay"
            >
              <X className="w-6 h-6" />
            </button>
            <motion.img
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              src={imageLightbox}
              alt="Expanded Chat Medium"
              className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* LEFT SIDEBAR VIEW (Conversations listing) */}
      <div className={`w-full md:w-[380px] lg:w-[420px] bg-white flex flex-col h-full border-r border-[#E9EDEF] shrink-0 ${activeContactPhone ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Sidebar Header Panel */}
        <div className="bg-[#F0F2F5] py-3.5 px-4 flex items-center justify-between shrink-0 select-none">
          <div 
            onClick={onOpenProfile} 
            className="flex items-center gap-2.5 cursor-pointer hover:bg-slate-200/50 p-1.5 rounded-xl transition"
            title="Edit My Profile"
          >
            <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 bg-white shrink-0">
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-slate-800 truncate block">
                {currentUser.name}
              </span>
              <span className="text-[10px] text-slate-500 font-mono truncate block">
                {currentUser.phone}
              </span>
            </div>
          </div>

          {/* Quick utility controllers */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 text-slate-600 hover:bg-[#E1E5E8] rounded-full transition"
              title={soundEnabled ? "Disable interface sounds" : "Enable interface sounds"}
            >
              {soundEnabled ? <Volume2 className="w-4.5 h-4.5 text-slate-700" /> : <VolumeX className="w-4.5 h-4.5 text-slate-400" />}
            </button>
            <button
              onClick={onOpenContacts}
              className="bg-[#0284c7] hover:bg-[#0369a1] text-white p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition animate-none"
              title="Browse Contacts Database"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Contacts</span>
            </button>
            <button
              onClick={onLogout}
              className="p-2 text-red-650 hover:bg-red-50 rounded-xl transition"
              title="Logout session"
            >
              <Power className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* Contacts search component */}
        <div className="p-3 bg-white border-b border-[#E9EDEF] shrink-0">
          <div className="relative bg-[#F0F2F5] rounded-xl px-3.5 py-2 flex items-center gap-2.5">
            <Search className="text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search chats or find friends..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent outline-none text-xs w-full text-slate-700 font-medium"
            />
          </div>
        </div>

        {/* Chats History Deck */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#F0F2F5] bg-white">
          {filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400 mt-12 gap-3">
              <MessageSquare className="w-10 h-10 text-slate-350 stroke-[1.5]" />
              <span className="text-xs font-medium">To initiate messaging, sync contacts!</span>
              <button
                onClick={onOpenContacts}
                className="text-xs text-[#0284c7] font-bold hover:underline"
              >
                Open contacts book
              </button>
            </div>
          ) : (
            filteredContacts.map((contact) => {
              const isActive = contact.phone === activeContactPhone;
              const isTyping = typingStates[contact.phone];
              const unread = unreadCounts[contact.phone] || 0;

              return (
                <div
                  key={contact.phone}
                  onClick={() => setActiveContactPhone(contact.phone)}
                  className={`p-4 flex items-center justify-between cursor-pointer transition select-none ${isActive ? 'bg-[#F0F2F5]' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-full overflow-hidden border border-slate-200 bg-sky-50 shrink-0">
                      <img
                        src={contact.avatarUrl}
                        alt={contact.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-800 truncate">
                          {contact.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {contact.phone.includes("90001") || contact.phone.includes("90004") ? "AI Bot" : "12:00"}
                        </span>
                      </div>
                      
                      {/* Last message / typing status box */}
                      <div className="flex items-center justify-between mt-0.5">
                        {isTyping ? (
                          <span className="text-xs font-bold text-sky-600 animate-pulse">
                            typing...
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500 truncate pr-4">
                            {contact.status}
                          </span>
                        )}

                        {/* Unread Counter Badge bullet */}
                        {unread > 0 && (
                          <span className="bg-sky-500 text-white font-bold text-[10px] min-w-4.5 h-4.5 px-1.5 rounded-full flex items-center justify-center">
                            {unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer branding */}
        <div className="bg-[#F0F2F5] px-4 py-3 border-t border-[#E9EDEF] flex justify-between items-center text-[10px] text-slate-400 select-none shrink-0 font-mono">
          <div className="flex items-center gap-1">
            <span>LinkUp PWA</span>
            {(isInstallable || isInIframe) && (
              isInstallable ? (
                <button 
                  onClick={onInstall} 
                  className="text-sky-600 font-bold hover:underline cursor-pointer ml-1"
                >
                  [Install App]
                </button>
              ) : (
                <a 
                  href={window.location.href} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-sky-600 font-bold hover:underline cursor-pointer ml-1 animate-pulse"
                >
                  [Open Free Window 🚀]
                </a>
              )
            )}
          </div>
          <span className="text-sky-625 font-semibold text-sky-600">• ONLINE</span>
        </div>
      </div>

      {/* RIGHT CHAT VIEW (Active Chat area or empty intro board) */}
      <div className={`flex-1 flex flex-col h-full bg-[#EFEAE2] relative ${!activeContactPhone ? 'hidden md:flex' : 'flex'}`}>
        
        {!activeContactPhone ? (
          /* Empty introduction Dashboard landing */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[#F8F9FA] border-l border-[#E9EDEF] overflow-y-auto">
            <div className="max-w-md flex flex-col items-center gap-6 my-auto">
              
              {/* Double-tick visual logo icon */}
              <div className="mb-2 flex items-center justify-center select-none" id="intro-logo-container">
                <img
                  src="/src/assets/images/linkup_logo_1779425895069.png"
                  alt="LinkUp Logo"
                  className="w-28 h-28 rounded-3xl shadow-xl shadow-sky-500/5 object-contain hover:scale-105 transition duration-300 pointer-events-none"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const sib = document.getElementById('intro-fallback-emblem');
                    if (sib) sib.classList.remove('hidden');
                  }}
                />
                <div id="intro-fallback-emblem" className="hidden bg-[#0284c7] text-white px-8 py-6 rounded-3xl shadow-lg flex items-center justify-center font-sans">
                  <span className="text-3xl font-black tracking-tight select-none">
                    Link<span className="text-[#f97316]">U</span>p
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">LinkUp</h2>
                <p className="text-xs text-slate-500 max-w-sm leading-relaxed mx-auto">
                  Send live text and images. Test delivery ticks (sent, delivered, read) to simulation contacts! Multi-tab login enables real-time device sync.
                </p>
              </div>

              <button
                onClick={onOpenContacts}
                className="bg-[#0284c7] hover:bg-[#0369a1] text-white px-6 py-2.5 rounded-xl text-xs font-bold transition shadow-sm active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" /> Start by opening contacts
              </button>

              {/* PWA Promotion installation panel */}
              {(isInstallable || isInIframe) && (
                <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left shadow-xs space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-sky-55 text-[#0284c7] bg-sky-50 rounded-xl shrink-0">
                      <Sparkles className="w-5 h-5 text-sky-600 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Install LinkUp Desktop App</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                        Run LinkUp as a standalone app with native multi-tasking, startup launching, and keyboard shortcuts.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 pt-1.5 border-t border-slate-100">
                    {isInstallable ? (
                      <button
                        onClick={onInstall}
                        className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-[10px] py-1.5 px-3 rounded-lg transition shadow-xs cursor-pointer"
                      >
                        Install Native App
                      </button>
                    ) : (
                      <a
                        href={window.location.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-[10px] py-1.5 px-3 rounded-lg transition shadow-xs text-center block"
                      >
                        Launch Standalone to Install
                      </a>
                    )}
                    
                    <span className="text-[10px] text-slate-400 font-mono pl-1">
                      {isInstallable ? "Ready for installation" : "Iframe sandbox restriction detected"}
                    </span>
                  </div>
                </div>
              )}

              <div className="border-t border-slate-150 pt-4 w-full flex justify-between items-center text-[10px] text-slate-400 mt-2">
                <span>⚡ Secure Transport Layer WSS/HTTPS</span>
                <span>Powered by Gemini 3.5</span>
              </div>
            </div>
          </div>
        ) : (
          /* Active Chat Conversation Widget */
          <div className="flex flex-col h-full relative">
            
            {/* Top Bar chat header */}
            <div className="bg-[#F0F2F5] py-2.5 px-4 flex items-center justify-between shrink-0 shadow-sm border-b border-[#E9EDEF] z-10">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setActiveContactPhone(null)}
                  className="md:hidden text-slate-600 hover:bg-slate-200 p-1 rounded-full transition"
                  title="Back to conversation list"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 bg-white shrink-0 select-none">
                  <img
                    src={activeContact?.avatarUrl}
                    alt={activeContact?.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>

                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold text-slate-800">
                    {activeContact?.name}
                  </span>
                  
                  {/* Dynamic Status bar line */}
                  {typingStates[activeContactPhone] ? (
                    <span className="text-[11px] font-bold text-sky-600 animate-pulse">
                      typing...
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 truncate max-w-xs block">
                      {activeContact?.status}
                    </span>
                  )}
                </div>
              </div>

              {/* Status indicators */}
              <div className="flex items-center gap-2">
                <span className="bg-sky-100/80 text-[#0284c7] text-[10px] font-bold py-1 px-3 border border-sky-100 rounded-lg flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-ping"></span>
                  Active Chat
                </span>
              </div>
            </div>

            {/* Main Chat Streams Canvas (messages bubble panel) */}
            <div 
              style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundBlendMode: "overlay" }}
              className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3.5 bg-amber-50/20"
            >
              
              {/* Simple chat safety introduction alert notice */}
              <div className="flex justify-center select-none my-2">
                <span className="bg-[#E0F2FE] text-[#0369a1] text-[10px] px-3.5 py-1.5 rounded-xl font-medium shadow-sm border border-sky-100 max-w-sm text-center block leading-relaxed">
                  🔒 Messages utilize HTTPS transport layer. Fully encrypted and stored in local Sandbox runtime database.
                </span>
              </div>

              {messages.map((msg) => {
                const isMe = msg.sender === currentUser.phone;
                return (
                  <div
                    key={msg.id}
                    className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <motion.div
                      initial={{ scale: 0.96, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`max-w-[75%] md:max-w-[65%] rounded-2xl px-3.5 py-2 relative shadow-sm ${isMe ? 'bg-[#E0F2FE] text-slate-800 rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none'}`}
                    >
                      {/* Optional Rich Media Card sharing displays */}
                      {msg.imageUrl && (
                        <div 
                           className="w-full mb-1.5 rounded-lg overflow-hidden border border-slate-100 max-h-[220px] relative select-none cursor-zoom-in"
                           onClick={() => setImageLightbox(msg.imageUrl || null)}
                        >
                          <img
                            src={msg.imageUrl}
                            alt="Chat attachment"
                            className="w-full h-full object-cover rounded-lg"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}

                      {/* Text element */}
                      <p className="text-[13px] font-normal leading-relaxed break-words whitespace-pre-wrap select-text pr-10">
                        {msg.text}
                      </p>

                      {/* Time and ticks alignment area */}
                      <div className="absolute bottom-1 right-2.5 flex items-center gap-1 select-none">
                        <span className="text-[9px] text-slate-400 font-medium">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        
                        {/* Status Checkmark indicators if owned by user */}
                        {isMe && (
                          <span className="flex items-center">
                            {msg.status === "sent" && <Check className="w-3.5 h-3.5 text-slate-400" />}
                            {msg.status === "delivered" && <CheckCheck className="w-3.5 h-3.5 text-slate-400" />}
                            {msg.status === "read" && <CheckCheck className="w-3.5 h-3.5 text-sky-500" />}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Input Entry Deck */}
            <div className="bg-[#F0F2F5] p-3 border-t border-[#E9EDEF] shrink-0 z-10 relative">
              
              {/* Optional Inline Emoji Drawer Tray */}
              <AnimatePresence>
                {showEmojiPicker && (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    className="absolute bottom-18 left-4 bg-white rounded-2xl p-3 shadow-2xl border border-slate-200 flex flex-wrap gap-2.5 max-w-sm z-50 select-none cursor-pointer"
                  >
                    {EMOJIS.map(item => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setInputText(prev => prev + item);
                        }}
                        className="text-lg hover:scale-125 transition active:scale-90"
                      >
                        {item}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(false)}
                      className="text-[10px] font-bold text-[#0284c7] bg-sky-50 px-2.5 py-1 rounded hover:bg-sky-100/80 transition"
                    >
                      Hide Emojis
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Chat form */}
              <form onSubmit={handleSendMessage} className="flex items-center gap-2.5">
                
                {/* Emoji click element */}
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`p-2 rounded-xl transition shrink-0 ${showEmojiPicker ? 'text-[#0284c7] bg-sky-100/50' : 'text-slate-600 hover:bg-[#E1E5E8]'}`}
                  title="Insert emoji characters"
                >
                  <Smile className="w-5 h-5" />
                </button>

                {/* Media Picker Attachment trigger */}
                <button
                  type="button"
                  disabled={attachmentLoading}
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-slate-600 hover:bg-[#E1E5E8] rounded-xl transition shrink-0 inline-flex items-center justify-center relative active:scale-95"
                  title="Upload picture media"
                >
                  {attachmentLoading ? (
                    <span className="w-5 h-5 border-2 border-[#0284c7] border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <ImageIcon className="w-5 h-5 text-slate-700" />
                  )}
                </button>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />

                {/* Main text message form input box */}
                <input
                  type="text"
                  placeholder={attachmentLoading ? "Uploading media photo..." : "Type text message..."}
                  value={inputText}
                  onChange={handleInputChange}
                  disabled={attachmentLoading}
                  className="flex-1 bg-white outline-none border border-slate-200/50 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:border-[#0284c7] transition"
                  maxLength={500}
                />

                {/* Mobile/Desktop Send trigger Button */}
                <button
                  type="submit"
                  disabled={attachmentLoading || !inputText.trim()}
                  className={`p-2.5 rounded-xl transition shrink-0 ${inputText.trim() ? 'bg-[#0284c7] hover:bg-[#0369a1] text-white shadow-md' : 'text-slate-400 bg-slate-200 cursor-not-allowed'}`}
                >
                  <Send className="w-4.5 h-4.5" />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
