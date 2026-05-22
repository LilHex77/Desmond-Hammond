import React, { useState } from "react";
import { motion } from "motion/react";
import { X, RefreshCw, Save, User2, MessageSquare } from "lucide-react";
import { User } from "../types";

interface ProfileEditProps {
  currentUser: User;
  onClose: () => void;
  onUpdateSuccess: (updatedUser: User) => void;
}

export default function ProfileEdit({ currentUser, onClose, onUpdateSuccess }: ProfileEditProps) {
  const [name, setName] = useState(currentUser.name);
  const [status, setStatus] = useState(currentUser.status);
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRandomizeAvatar = () => {
    const randomSeed = Math.floor(Math.random() * 1000);
    const newAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${randomSeed}`;
    setAvatarUrl(newAvatar);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name cannot be empty");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: currentUser.phone,
          name: name.trim(),
          avatarUrl,
          status: status.trim(),
        }),
      });
      const data = await res.json();

      if (data.success) {
        onUpdateSuccess(data.user);
        onClose();
      } else {
        setError(data.error || "Failed to save profile changes");
      }
    } catch (err) {
      setError("Connection issue. Could not updates.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ x: "-100%" }}
      animate={{ x: 0 }}
      exit={{ x: "-100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="absolute inset-0 bg-[#F0F2F5] z-30 flex flex-col w-full h-full text-slate-800"
    >
      {/* Header element */}
      <div className="bg-[#0284c7] text-white px-5 py-6 flex items-center gap-6 shrink-0 shadow-md">
        <button 
          onClick={onClose} 
          className="hover:bg-[#0369a1] p-1.5 rounded-full transition outline-none"
          title="Go back"
        >
          <X className="w-6 h-6" />
        </button>
        <span className="text-lg font-semibold tracking-wide">Edit Profile</span>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col items-center gap-8">
        
        {/* Profile Picture Controller */}
        <div className="relative group mt-4">
          <div className="w-36 h-36 rounded-full overflow-hidden border-4 border-white shadow-lg bg-sky-50 relative flex items-center justify-center">
            <img
              src={avatarUrl}
              alt="Profile Avatar"
              className="w-full h-full object-cover select-none"
              referrerPolicy="no-referrer"
            />
          </div>
          
          <button
            type="button"
            onClick={handleRandomizeAvatar}
            className="absolute bottom-1 right-1 bg-[#0284c7] hover:bg-[#0369a1] text-white p-2.5 rounded-full shadow-md transition flex items-center justify-center active:scale-95"
            title="Randomize Avatar Avatar"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400 -mt-4 text-center">
          💡 Tap the blue refresh button above to auto-generate a custom vector avatar character seed!
        </p>

        {/* Inputs container */}
        <div className="w-full flex flex-col gap-6 max-w-sm mt-2">
          
          {/* Phone label (read only) */}
          <div className="bg-slate-100/80 border border-slate-200/50 rounded-xl px-4 py-3">
            <label className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">
              Verification Phone Number
            </label>
            <span className="text-sm font-mono text-slate-600 font-semibold mt-1 block">
              {currentUser.phone}
            </span>
          </div>

          {/* Name Field */}
          <div className="bg-white border border-slate-250 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-[#0284c7] transition shadow-sm">
            <label className="text-xs font-semibold text-[#0284c7] flex items-center gap-1.5 uppercase tracking-wider">
              <User2 className="w-3.5 h-3.5" /> Your Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="E.g. Simon Baker"
              className="w-full outline-none text-slate-800 text-sm mt-1.5 font-medium bg-transparent"
              maxLength={25}
              required
            />
          </div>

          {/* Status field */}
          <div className="bg-white border border-slate-250 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-[#0284c7] transition shadow-sm">
            <label className="text-xs font-semibold text-[#0284c7] flex items-center gap-1.5 uppercase tracking-wider">
              <MessageSquare className="w-3.5 h-3.5" /> About / Status Quote
            </label>
            <input
              type="text"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="Hey! I am using LinkUp..."
              className="w-full outline-none text-slate-800 text-sm mt-1.5 font-medium bg-transparent"
              maxLength={80}
            />
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2 text-center font-medium">
              {error}
            </div>
          )}

          {/* Submit Action */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#0284c7] hover:bg-[#0369a1] text-white py-3.5 rounded-xl text-sm font-semibold shadow-md active:scale-[0.98] transition flex items-center justify-center gap-2 mt-4"
          >
            <Save className="w-4 h-4" />
            {saving ? "Updating records..." : "Save Profile Details"}
          </button>

         </div>
      </form>
    </motion.div>
  );
}
