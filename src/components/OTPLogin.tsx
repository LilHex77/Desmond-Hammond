import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Phone, Lock, User, ArrowRight, MessageSquareCode, CheckCircle2, AlertCircle, MessageSquare } from "lucide-react";

interface OTPLoginProps {
  onLoginSuccess: (user: any) => void;
}

const COUNTRIES = [
  { code: "+44", name: "United Kingdom", flag: "🇬🇧" },
  { code: "+1", name: "United States / Canada", flag: "🇺🇸" },
  { code: "+91", name: "India", flag: "🇮🇳" },
  { code: "+61", name: "Australia", flag: "🇦🇺" },
  { code: "+49", name: "Germany", flag: "🇩🇪" },
  { code: "+233", name: "Ghana", flag: "GH"},
  { code: "+33", name: "France", flag: "🇫🇷" },
  { code: "+34", name: "Spain", flag: "🇪🇸" },
  { code: "+55", name: "Brazil", flag: "🇧🇷" },
  { code: "+234", name: "Nigeria", flag: "🇳🇬" },
  { code: "+27", name: "South Africa", flag: "🇿🇦" },
  { code: "+65", name: "Singapore", flag: "🇸🇬" },
  { code: "+971", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "custom", name: "Other (Custom Code)", flag: "🌐" }
];

export default function OTPLogin({ onLoginSuccess }: OTPLoginProps) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [customCountryCode, setCustomCountryCode] = useState("+");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [receivedOtp, setReceivedOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [smsNotification, setSmsNotification] = useState<string | null>(null);

  const getCountryCode = () => {
    if (selectedCountry.code === "custom") {
      const cleaned = customCountryCode.trim();
      return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
    }
    return selectedCountry.code;
  };

  // Play a beautiful synthetic feedback ping
  const playSfx = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch notification ping
      gain.gain.setValueAtTime(0.01, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      // AudioContext blocks sometimes, ignore safely
    }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.trim().length < 8) {
      setError("Please enter a valid phone number (min 8 digits)");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const code = getCountryCode();
      const formattedPhone = phone.startsWith("+") ? phone : `${code}${phone.replace(/^0+/, "")}`;
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formattedPhone }),
      });
      const data = await res.json();

      if (data.success) {
        setReceivedOtp(data.otp);
        setStep("otp");
        
        // Trigger realistic Simulated SMS pop-up banner
        setTimeout(() => {
          playSfx();
          setSmsNotification(`💬 SMS Verification: Your LinkUp code is ${data.otp}`);
          // Auto remove after 10 seconds
          setTimeout(() => setSmsNotification(null), 10000);
        }, 1200);
      } else {
        setError(data.error || "Failed to request OTP code.");
      }
    } catch (err) {
      setError("Server connection failed. Make sure server is online.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 4) {
      setError("Please key in the 6-digit confirmation code");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const code = getCountryCode();
      const formattedPhone = phone.startsWith("+") ? phone : `${code}${phone.replace(/^0+/, "")}`;
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formattedPhone, otp, name: name.trim() || undefined }),
      });
      const data = await res.json();

      if (data.success) {
        setSmsNotification(null);
        onLoginSuccess(data.user);
      } else {
        setError(data.error || "The code entered is incorrect.");
      }
    } catch (err) {
      setError("Verification failed. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="otp-login" className="flex flex-col items-center justify-center min-h-screen bg-[#F0F2F5] p-4 font-sans select-none relative overflow-hidden">
      
      {/* Dynamic Simulated SMS Notification Popup */}
      <AnimatePresence>
        {smsNotification && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 w-full max-w-sm bg-slate-900 border-l-4 border-[#0284c7] text-white p-4 rounded-xl shadow-2xl z-50 flex flex-col gap-1 cursor-pointer"
            onClick={() => {
              setOtp(receivedOtp || "");
              playSfx();
            }}
          >
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold flex items-center gap-1">
                <MessageSquareCode className="w-3.5 h-3.5 text-[#38bdf8]" /> Simulating SMS Network
              </span>
              <span>Just now</span>
            </div>
            <p className="text-sm font-medium mt-1 select-all">{smsNotification}</p>
            <span className="text-[10px] text-sky-400 mt-2 text-right">💡 Tap to auto-fill code</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-100 p-8 flex flex-col items-center text-center relative"
      >
        {/* LinkUp Logo Emblem */}
        <div className="mb-6 flex items-center justify-center select-none" id="login-logo-container">
          <img
            src="/src/assets/images/linkup_logo_1779425895069.png"
            alt="LinkUp Logo"
            className="w-24 h-24 rounded-3xl shadow-lg shadow-sky-500/10 object-contain hover:scale-105 transition duration-300"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const sib = document.getElementById('login-fallback-emblem');
              if (sib) sib.classList.remove('hidden');
            }}
          />
          <div id="login-fallback-emblem" className="hidden bg-[#0284c7] text-white px-6 py-4.5 rounded-3xl shadow-md flex items-center justify-center font-sans">
            <span className="text-2xl font-black tracking-tight select-none">
              Link<span className="text-[#f97316]">U</span>p
            </span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 leading-tight">LinkUp</h1>
        <p className="text-sm text-slate-500 mt-2 mb-8">
          Validate and test communication with delivery checks, multi-user simulation, and smart auto-responders.
        </p>

        <AnimatePresence mode="wait">
          {step === "phone" ? (
            <motion.form
              key="phone-form"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSendOTP}
              className="w-full flex flex-col gap-4 text-left"
            >
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Select Country & Phone Number
                </label>
                
                {/* Styled elegant dropdown list of countries */}
                <div className="relative mt-1.5 mb-2.5">
                  <select
                    value={selectedCountry.code}
                    onChange={(e) => {
                      const found = COUNTRIES.find(c => c.code === e.target.value);
                      if (found) {
                        setSelectedCountry(found);
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#0284c7] outline-none rounded-xl py-3 px-3.5 pr-10 text-xs font-semibold text-slate-700 appearance-none cursor-pointer transition"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code} className="text-slate-800 font-medium">
                        {c.flag} {c.name} {c.code !== "custom" ? `(${c.code})` : ""}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                    </svg>
                  </div>
                </div>

                {/* Show custom code input if Custom chosen */}
                {selectedCountry.code === "custom" && (
                  <div className="relative mb-2.5">
                    <input
                      type="text"
                      placeholder="e.g. +353"
                      value={customCountryCode}
                      onChange={(e) => {
                        let text = e.target.value;
                        if (!text.startsWith("+")) {
                          text = "+" + text.replace(/[^\d]/g, "");
                        } else {
                          text = "+" + text.slice(1).replace(/[^\d]/g, "");
                        }
                        setCustomCountryCode(text);
                      }}
                      className="w-full border border-slate-200 focus:border-[#0284c7] outline-none rounded-xl py-2.5 px-3.5 text-xs font-semibold text-slate-800 bg-slate-50 focus:bg-white transition"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block px-1">
                      💡 Type custom country calling digits starting with "+" (e.g. +353)
                    </span>
                  </div>
                )}

                {/* Main phone text input container */}
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono font-bold text-slate-500">
                    {getCountryCode()}
                  </span>
                  <input
                    type="tel"
                    placeholder="7700 900088"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value.replace(/[^\d+]/g, ""));
                      setError(null);
                    }}
                    style={{ paddingLeft: `${Math.max(42, (getCountryCode().length + 2) * 9.5)}px` }}
                    className="w-full border border-slate-200 focus:border-[#0284c7] outline-none rounded-xl py-3 pr-4 text-base tracking-wide bg-slate-50 focus:bg-white text-slate-800 transition font-mono"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 text-red-600 rounded-xl px-4 py-3 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0284c7] hover:bg-[#0369a1] text-white font-semibold py-3 px-4 rounded-xl shadow-md shadow-sky-700/10 hover:shadow-lg transition flex items-center justify-center gap-2 mt-2"
              >
                {loading ? "Simulating network..." : "Send Verification OTP"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.form>
          ) : (
            <motion.form
              key="otp-form"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleVerifyOTP}
              className="w-full flex flex-col gap-4 text-left"
            >
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex justify-between items-center">
                  <span>Enter Code Block</span>
                  <button 
                    type="button" 
                    onClick={() => { setStep("phone"); setError(null); }} 
                    className="text-xs text-[#0284c7] hover:underline normal-case font-medium"
                  >
                    Change Number
                  </button>
                </label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4.5 h-4.5" />
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="Verification OTP (e.g. 123456)"
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value.trim());
                      setError(null);
                    }}
                    className="w-full border border-slate-200 focus:border-[#0284c7] outline-none rounded-xl py-3 pl-11 pr-4 text-base tracking-widest bg-slate-50 focus:bg-white text-slate-800 transition font-mono"
                    required
                  />
                </div>
              </div>

              {/* Display Name for Profile Management */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Your Display Name (Optional)
                </label>
                <div className="relative mt-1.5">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4.5 h-4.5" />
                  <input
                    type="text"
                    placeholder="Alice Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border border-slate-200 focus:border-[#0284c7] outline-none rounded-xl py-3 pl-11 pr-4 text-base bg-slate-50 focus:bg-white text-slate-800 transition"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 text-red-600 rounded-xl px-4 py-3 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 text-xs text-sky-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-sky-600 mt-0.5" />
                <span>
                  <strong>Code Tip:</strong> Check the pop-up notification at the top to auto-fill, or type the code <strong>123456</strong> to verify!
                </span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0284c7] hover:bg-[#0369a1] text-white font-semibold py-3 px-4 rounded-xl shadow-md shadow-sky-700/10 hover:shadow-lg transition flex items-center justify-center gap-2 mt-2"
              >
                {loading ? "Verifying code..." : "Sign In & Connect"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Branding Footer */}
        <div className="text-[11px] text-slate-400 mt-8 flex flex-col items-center gap-1">
          <span>LinkUp Client • Secure Channel TLS 1.3</span>
          <span className="font-mono text-[9px] text-[#0284c7] bg-sky-50/50 px-2 py-0.5 rounded">
            SERVER STATUS: READY & RESPONSIVE
          </span>
        </div>
      </motion.div>
    </div>
  );
}
