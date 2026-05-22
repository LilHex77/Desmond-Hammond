import React, { useState, useEffect } from "react";
import { AnimatePresence } from "motion/react";
import { User, Contact } from "./types";
import OTPLogin from "./components/OTPLogin";
import ChatRoom from "./components/ChatRoom";
import ProfileEdit from "./components/ProfileEdit";
import ContactManager from "./components/ContactManager";

// Seed active system bots numbers
const PRE_POPULATED_PHONEBOOK = [
  { name: "Alice Wood (Coder)", phone: "+447700900011" },
  { name: "Coach Bob (Trainer)", phone: "+447700900022" },
  { name: "Chef Charlie", phone: "+447700900033" },
  { name: "Luna AI (Assistant)", phone: "+447700900044" },
  { name: "Hammond AI (male)", phone: "+447700900055" },
  { name: "Vida AI (female)", phone: "+447700900066" }
];

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activePanel, setActivePanel] = useState<"chat" | "profile" | "contacts">("chat");
  const [loading, setLoading] = useState(true);

  // Progressive Web App installation & iframe tracking states
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    setIsInIframe(window.self !== window.top);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e);
      setIsInstallable(true);
      console.log("[PWA] beforeinstallprompt event captured and cached.");
    };

    const handleAppInstalled = () => {
      setIsInstallable(false);
      setInstallPromptEvent(null);
      console.log("[PWA] LinkUp application installed successfully!");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!installPromptEvent) {
      console.warn("[PWA] Native browser installation prompt event not loaded yet.");
      return;
    }
    installPromptEvent.prompt();
    const { outcome } = await installPromptEvent.userChoice;
    console.log(`[PWA] Install status decision: ${outcome}`);
    if (outcome === "accepted") {
      setIsInstallable(false);
      setInstallPromptEvent(null);
    }
  };

  // 1. Initial configuration loading (re-verify profile session and load address books)
  useEffect(() => {
    const cachedUser = localStorage.getItem("linkup_current_user");
    if (cachedUser) {
      try {
        const parsed: User = JSON.parse(cachedUser);
        setCurrentUser(parsed);
      } catch (err) {
        localStorage.removeItem("whatsapp_current_user");
      }
    }
    setLoading(false);
  }, []);

  // 2. Load and synchronize contacts directory whenever user sessions or active drawers state update
  useEffect(() => {
    if (!currentUser) return;

    const loadAndSyncContacts = async () => {
      // Load contacts book from localStorage
      let rawPhonebook = localStorage.getItem(`linkup_phonebook_${currentUser.phone}`);
      let parsedList = rawPhonebook ? JSON.parse(rawPhonebook) : [];

      // If empty layout, seed the system bots automatically
      if (parsedList.length === 0) {
        parsedList = [...PRE_POPULATED_PHONEBOOK];
        localStorage.setItem(
          `linkup_phonebook_${currentUser.phone}`,
          JSON.stringify(parsedList)
        );
      } else {
        // Enforce synchronization of system bots in user's address book
        let changed = false;
        PRE_POPULATED_PHONEBOOK.forEach((bot) => {
          if (!parsedList.some((c: any) => c.phone === bot.phone)) {
            parsedList.push(bot);
            changed = true;
          }
        });
        if (changed) {
          localStorage.setItem(
            `linkup_phonebook_${currentUser.phone}`,
            JSON.stringify(parsedList)
          );
        }
      }

      // Sync directory against Express Backend to verify which numbers have accounts
      try {
        const res = await fetch("/api/contacts/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: currentUser.phone,
            contacts: parsedList,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setContacts(data.contacts);
        }
      } catch (err) {
        console.error("Failure synchronizing address book contacts:", err);
      }
    };

    loadAndSyncContacts();
  }, [currentUser, activePanel]);

  // Handle addition of a new contact
  const handleAddContact = async (name: string, phone: string) => {
    if (!currentUser) return;

    // Load, add, save locally
    const key = `linkup_phonebook_${currentUser.phone}`;
    let rawPhonebook = localStorage.getItem(key);
    let parsedList = rawPhonebook ? JSON.parse(rawPhonebook) : [];

    // Prevent duplicate entries
    if (parsedList.some((c: any) => c.phone === phone)) return;

    parsedList.push({ name, phone });
    localStorage.setItem(key, JSON.stringify(parsedList));

    // Force synchronization updates
    try {
      const res = await fetch("/api/contacts/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: currentUser.phone,
          contacts: parsedList,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setContacts(data.contacts);
      }
    } catch (err) {
      console.error("Adding contact synchronization trigger offline:", err);
    }
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem("linkup_current_user", JSON.stringify(user));
    setActivePanel("chat");
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("linkup_current_user");
    setActivePanel("chat");
  };

  const handleProfileUpdate = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    localStorage.setItem("linkup_current_user", JSON.stringify(updatedUser));
  };

  if (loading) {
    return (
      <div id="app-loading" className="flex flex-col items-center justify-center min-h-screen bg-[#F0F2F5] select-none font-sans">
        <div className="w-12 h-12 border-4 border-[#0284c7] border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs text-slate-500 font-semibold mt-4">LinkUp is booting...</span>
      </div>
    );
  }

  // Routing View
  if (!currentUser) {
    return <OTPLogin onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div id="app-viewport" className="relative w-full h-screen overflow-hidden bg-slate-100 flex items-center justify-center select-none font-sans">
      
      {/* Primary Chat Work Area UI */}
      <ChatRoom
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenProfile={() => setActivePanel("profile")}
        onOpenContacts={() => setActivePanel("contacts")}
        contacts={contacts}
        isInstallable={isInstallable}
        isInIframe={isInIframe}
        onInstall={handleInstallApp}
      />

      {/* Drawer Overlays slides */}
      <AnimatePresence>
        {activePanel === "profile" && (
          <ProfileEdit
            currentUser={currentUser}
            onClose={() => setActivePanel("chat")}
            onUpdateSuccess={handleProfileUpdate}
          />
        )}

        {activePanel === "contacts" && (
          <ContactManager
            contacts={contacts}
            onClose={() => setActivePanel("chat")}
            onAddContact={handleAddContact}
            onSelectContact={() => setActivePanel("chat")}
          />
        )}
      </AnimatePresence>
      
    </div>
  );
}
