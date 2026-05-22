import React, { useState } from "react";
import { motion } from "motion/react";
import { X, Search, Plus, UserPlus, Send, Sparkles, PhoneCall, Smartphone } from "lucide-react";
import { Contact } from "../types";

interface ContactManagerProps {
  contacts: Contact[];
  onClose: () => void;
  onAddContact: (name: string, phone: string) => void;
  onSelectContact: (phone: string) => void;
}

export default function ContactManager({ contacts, onClose, onAddContact, onSelectContact }: ContactManagerProps) {
  const [search, setSearch] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [invitedPhone, setInvitedPhone] = useState<string | null>(null);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !newContactPhone.trim()) return;
    
    // Normalize format
    const cleaned = newContactPhone.replace(/[\s-()]/g, "");
    const formatted = cleaned.startsWith("+") ? cleaned : `+44${cleaned.replace(/^0+/, "")}`;
    
    onAddContact(newContactName.trim(), formatted);
    setNewContactName("");
    setNewContactPhone("");
    setIsAdding(false);
  };

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  return (
    <motion.div
      initial={{ x: "-100%" }}
      animate={{ x: 0 }}
      exit={{ x: "-100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="absolute inset-0 bg-white z-20 flex flex-col w-full h-full text-slate-800"
    >
      {/* Header element */}
      <div className="bg-[#0284c7] text-white px-5 py-6 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-6">
          <button 
            onClick={onClose} 
            className="hover:bg-[#0369a1] p-1.5 rounded-full transition outline-none"
            title="Go back"
          >
            <X className="w-5 h-5" />
          </button>
          <span className="text-lg font-semibold tracking-wide">Contacts Directory</span>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="bg-sky-600 hover:bg-sky-700 text-white p-2 rounded-xl transition flex items-center gap-1 text-xs font-semibold"
        >
          {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{isAdding ? "Cancel" : "Add New"}</span>
        </button>
      </div>

      {/* Add New Contact Form Drawer */}
      {isAdding && (
        <motion.form
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          onSubmit={handleAddSubmit}
          className="bg-slate-50 border-b border-slate-200 p-4 flex flex-col gap-3 shrink-0"
        >
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <UserPlus className="w-4 h-4 text-[#0284c7]" /> Synchronize New Contact Slot
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Full Name (e.g. Rachel)"
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
              className="bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs font-medium outline-none focus:border-[#0284c7]"
              required
            />
            <input
              type="tel"
              placeholder="Phone (e.g. 7700 900055)"
              value={newContactPhone}
              onChange={(e) => setNewContactPhone(e.target.value)}
              className="bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs font-mono outline-none focus:border-[#0284c7]"
              required
            />
          </div>
          <p className="text-[10px] text-slate-400">
            💡 If another user logs in with this number, they will immediately synch! Try adding <strong>7700 900011-44</strong> to add AI bots.
          </p>
          <button
            type="submit"
            className="w-full bg-[#0284c7] hover:bg-[#0369a1] text-white py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            Save to App Address Book
          </button>
        </motion.form>
      )}

      {/* Search contacts bar */}
      <div className="p-3 bg-white border-b border-slate-100 shrink-0">
        <div className="relative bg-slate-100 rounded-xl px-3 py-2 flex items-center gap-2">
          <Search className="text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search matching names or telephone digits..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent outline-none text-xs w-full text-slate-700 font-medium"
          />
        </div>
      </div>

      {/* Contacts List Grid content */}
      <div className="flex-1 overflow-y-auto">
        {filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400 mt-8 gap-3">
            <Smartphone className="w-10 h-10 text-slate-350 stroke-[1.5]" />
            <span className="text-xs font-medium">No contacts match your query.</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-150">
            {filteredContacts.map((contact) => (
              <div
                key={contact.phone}
                className={`p-4 flex items-center justify-between hover:bg-slate-55 transition ${contact.isAppUser ? 'cursor-pointer' : ''}`}
                onClick={() => {
                  if (contact.isAppUser) {
                    onSelectContact(contact.phone);
                    onClose();
                  }
                }}
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0 select-none">
                    <img
                      src={contact.avatarUrl}
                      alt={contact.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-slate-800 truncate">
                        {contact.name}
                      </span>
                      {contact.isAppUser && (
                        <span className="bg-sky-100 text-sky-800 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase scale-90">
                          App User
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 truncate mt-0.5">
                      {contact.isAppUser ? contact.status : "No connection found"}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {contact.phone}
                    </span>
                  </div>
                </div>

                {/* Actions indicators */}
                <div>
                  {contact.isAppUser ? (
                    <span className="text-xs font-bold text-[#0284c7] flex items-center gap-1 bg-sky-50 px-2.5 py-1 rounded-xl">
                      <Sparkles className="w-3.5 h-3.5" /> Chat
                    </span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setInvitedPhone(contact.phone);
                      }}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" /> Invite
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invitation simulation dialogue overlay */}
      {invitedPhone && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl flex flex-col gap-4 text-center"
          >
            <div className="w-12 h-12 bg-sky-50 text-[#0284c7] rounded-full mx-auto flex items-center justify-center mb-1">
              <PhoneCall className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Simulate SMS Invite</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              We've dispatched a mock invite link to <strong>{invitedPhone}</strong> containing this setup's URL link.
            </p>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 text-left">
              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">SMS Envelope Preview</span>
              <p className="text-xs text-slate-700 mt-1 font-medium italic">
                "Hey! Come chat with me on LinkUp! Try logging in with our phone code to synchronize: {window.location.origin}"
              </p>
            </div>
            <button
              onClick={() => setInvitedPhone(null)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-xl text-xs transition active:scale-95"
            >
              Close Simulator
            </button>
          </motion.div>
        </div>
      )}

      {/* Footer information bar */}
      <div className="bg-slate-50 p-3 text-center text-[10px] text-slate-400 border-t border-slate-100 select-none">
        Contacts with active App directories are updated dynamically.
      </div>
    </motion.div>
  );
}
