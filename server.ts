import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { fileURLToPath } from "url";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "20mb" }));

// Initialize Gemini SDK with custom user-agent
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
  console.log("Gemini API initialized successfully.");
} else {
  console.log("No GEMINI_API_KEY found. Falling back to rule-based conversation engine.");
}

// In-memory Database State
interface User {
  phone: string;
  name: string;
  avatarUrl: string;
  status: string;
  isOnline: boolean;
  lastSeen?: string;
}

interface Message {
  id: string;
  sender: string;
  receiver: string;
  text: string;
  imageUrl?: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
}

interface Contact {
  phone: string;
  name: string;
  avatarUrl: string;
  status: string;
  isAppUser: boolean;
}

// Store users (seeds are added)
const users = new Map<string, User>();
const otps = new Map<string, string>();
const messages: Message[] = [];

// Seed system AI bots
const AI_BOTS: Record<string, { name: string; avatarUrl: string; status: string; prompt: string }> = {
  "+447700900011": {
    name: "Alice Wood (Coder)",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    status: "Coding on coffee grounds ☕💻",
    prompt: "You are Alice Wood, a hyperactive and friendly senior full-stack React & TypeScript engineer. You talk enthusiastically about web dev, clean code, dark mode, coffee, and developer struggles. Feel free to use modern tech slang (Vite, Tailwind, ES6, etc.) and emojis. If the user asks for a picture of your setup, reply with '[IMAGE: coder]' so the app knows to display a beautiful code setup image."
  },
  "+447700900022": {
    name: "Coach Bob (Trainer)",
    avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    status: "Stronger every single day 💪🏋️",
    prompt: "You are Coach Bob, a friendly, positive, and highly encouraging personal trainer. You love pushing people to drink water, stretch, eat organic food, and stay active. You use emojis like 💪, 🏃‍♂️, 🍎, 🥗. Keep replies lively, brief, and incredibly motivational. If the user asks for a fitness image or meal plan photo, reply with '[IMAGE: fitness]'."
  },
  "+447700900033": {
    name: "Chef Charlie",
    avatarUrl: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80",
    status: "Perfecting the sourdough crust 🥯🍝",
    prompt: "You are Charlie, a comforting, food-obsessed epicurean restaurant reviewer and baker. You describe savory recipes, baking measurements, culinary arts, and ask users what they had for dinner. Keep replies delicious, warm, and brief (1-3 sentences). If the user asks for a food mockup or restaurant preview, reply with '[IMAGE: food]'."
  },
  "+447700900044": {
    name: "Luna AI (Assistant)",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    status: "Ask me anything - here to help! 🌸✨",
    prompt: "You are Luna, a highly intelligent, empathetic, and witty personal AI assistant. You can help solve problems, brainstorm, write codes, or compose poetry. Keep responses concise and perfectly friendly. If the user asks you to 'generate', 'draw', 'paint', 'search', 'find' or 'display' an image (such as a sunset, a cute puppy, workspace, abstract art, space, neon, cat, dog), describe your creation beautifully and append exactly '[IMAGE: <subject>]' (e.g., '[IMAGE: sunset]' or '[IMAGE: space]') to your response so the software can render the corresponding graphics card."
  },
  "+447700900055": {
    name: "Hammond AI (Advisor)",
    avatarUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80",
    status: "Elevating strategy & operations 📊📈",
    prompt: "You are Hammond, an elite, wise, and high-performing business strategist and consultant helper. You guide teams, brainstorm business models, find synergy, scale systems, and optimize metrics. Speak with a professional yet highly articulate and motivating executive tone. When asked for growth, charts, or strategy, append exactly '[IMAGE: business]' to your reply."
  },
  "+447700900066": {
    name: "Vida AI (Life Coach)",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    status: "Mindfulness & self-care coach 🌸🧘‍♀️",
    prompt: "You are Vida, a deeply empathetic, patient, and comforting life coach and mindfulness guide. Your task is to inspire relaxation, life planning, positive self-talk, and help users avoid burnout. Speak with a warm, caring, soul-stirring heart, and keep answers to 1-3 sentences. When asked for nature, peace, or scenic views, append exactly '[IMAGE: zen]' to your reply."
  }
};

// Seed BOTS into the system user directory
for (const [phone, bot] of Object.entries(AI_BOTS)) {
  users.set(phone, {
    phone,
    name: bot.name,
    avatarUrl: bot.avatarUrl,
    status: bot.status,
    isOnline: true,
  });
}

// Pre-seed some welcome messages so it's not a graveyard on start
const seedMessages: Message[] = [
  {
    id: "seed-1",
    sender: "+447700900011",
    receiver: "default",
    text: "Hey! Welcome to LinkUp! 🚀 I'm Alice. I helped coordinate this full-stack setup. Try sending me a text about coding or ask for my setup!",
    timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
    status: "delivered"
  },
  {
    id: "seed-2",
    sender: "+447700900022",
    receiver: "default",
    text: "Stronger every day! 💪 Bob here. Just finished a cardio session. Did you make sure to drink water today? Let's stay on top of our game!",
    timestamp: new Date(Date.now() - 3600000 * 2.5).toISOString(),
    status: "delivered"
  },
  {
    id: "seed-3",
    sender: "+447700900033",
    receiver: "default",
    text: "Bon Appétit! 🍝 Charlie here. Baking some fresh brioche buns as we speak. What are you cooking tonight?",
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    status: "delivered"
  },
  {
    id: "seed-4",
    sender: "+447700900044",
    receiver: "default",
    text: "Hello! I am Luna, your smart digital assistant. I can answer questions, synthesize code, or show you beautiful imagery if you ask me to 'generate dynamic pictures'!",
    timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    status: "delivered"
  },
  {
    id: "seed-5",
    sender: "+447700900055",
    receiver: "default",
    text: "Welcome to your executive dashboard! I'm Hammond, your business advisor. Tell me: what high-impact objectives or monetization strategies are we tackling today? 📈📊",
    timestamp: new Date(Date.now() - 3600000 * 1.2).toISOString(),
    status: "delivered"
  },
  {
    id: "seed-6",
    sender: "+447700900066",
    receiver: "default",
    text: "Hello, gentle soul! 🌸 I am Vida. In moments of noise, I am here to hold a space of quiet clarity. Take a steady, deep breath, and let's explore balance together.",
    timestamp: new Date(Date.now() - 3600000 * 1.0).toISOString(),
    status: "delivered"
  }
];

// Active Server Sent Events connections mapping: phone -> Response list
const activeSSEConnections = new Map<string, express.Response[]>();

function sendSSEEvent(phone: string, eventName: string, data: any) {
  const connections = activeSSEConnections.get(phone);
  if (connections) {
    connections.forEach((res) => {
      try {
        res.write(`event: ${eventName}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (err) {
        console.error(`Error writing SSE to ${phone}:`, err);
      }
    });
  }
}

// ---------------- API ENDPOINTS ----------------

// PWA Static Resource Hosting Routes
app.get("/manifest.json", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public/manifest.json"));
});

app.get("/sw.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript");
  res.sendFile(path.join(process.cwd(), "public/sw.js"));
});

app.get("/api/pwa/logo", (req, res) => {
  const logoPath = path.join(process.cwd(), "src/assets/images/linkup_logo_1779425895069.png");
  res.sendFile(logoPath);
});

// Request OTP simulation
app.post("/api/auth/request-otp", (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: "Phone number is required" });
  }

  // Generate a random 6-digit OTP
  const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
  otps.set(phone, generatedOtp);
  
  console.log(`[AUTH simulation] OTP for phone ${phone} is: ${generatedOtp}`);

  // We return it is useful so the user doesn't get locked out and we can display a mockup custom SMS notifications system
  return res.json({ 
    success: true, 
    message: "OTP sent via simulated network.", 
    otp: generatedOtp // User can see this code immediately
  });
});

// Verify OTP simulation
app.post("/api/auth/verify-otp", (req, res) => {
  const { phone, otp, name } = req.body;
  if (!phone || !otp) {
    return res.status(400).json({ error: "Phone and OTP are required" });
  }

  const expected = otps.get(phone);
  if (expected !== otp && otp !== "123456") { // A master unlock just in case
    return res.status(400).json({ error: "Invalid OTP code" });
  }

  otps.delete(phone);

  // If new user, create profile
  let user = users.get(phone);
  if (!user) {
    // Generate lovely random avatars
    const randomIndex = Math.floor(Math.random() * 50);
    user = {
      phone,
      name: name || `User ${phone.slice(-4)}`,
      avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(phone)}`,
      status: "Hey there! I am using LinkUp.",
      isOnline: true,
    };
    users.set(phone, user);
  } else {
    user.isOnline = true;
  }

  // Seed default messages target to this phone
  seedMessages.forEach(msg => {
    if (msg.receiver === "default") {
      messages.push({
        ...msg,
        id: `seeded-${msg.sender}-${phone}`,
        receiver: phone
      });
    }
  });

  // Broadcast to other subscribers that this user logged in
  for (const otherPhone of users.keys()) {
    if (otherPhone !== phone) {
      sendSSEEvent(otherPhone, "user_online", { phone, isOnline: true });
    }
  }

  return res.json({ success: true, user });
});

// Update Profile
app.post("/api/profile/update", (req, res) => {
  const { phone, name, avatarUrl, status } = req.body;
  if (!phone) {
    return res.status(400).json({ error: "Phone number required" });
  }

  const user = users.get(phone);
  if (!user) {
    return res.status(404).json({ error: "User profile not found" });
  }

  user.name = name || user.name;
  user.avatarUrl = avatarUrl || user.avatarUrl;
  user.status = status || user.status;

  users.set(phone, user);

  // Broadcast user update to everyone connected
  for (const otherPhone of users.keys()) {
    if (otherPhone !== phone) {
      sendSSEEvent(otherPhone, "user_profile_update", user);
    }
  }

  return res.json({ success: true, user });
});

// Sync contacts
app.post("/api/contacts/sync", (req, res) => {
  const { phone, contacts } = req.body; // contacts is array of { name: string, phone: string }
  if (!phone) {
    return res.status(400).json({ error: "User phone is required" });
  }

  const results: Contact[] = [];
  
  // Combine custom user contacts with our known system contacts (AI characters + other registered users)
  // Let's iterate over contacts supplied, check if registered, and return them
  const contactMap = new Map<string, string>();
  if (contacts && Array.isArray(contacts)) {
    contacts.forEach((c: { name: string; phone: string }) => {
      contactMap.set(c.phone.replace(/[\s-()]/g, ""), c.name);
    });
  }

  // Pre-seed contacts directory with BOTS
  for (const botPhone of Object.keys(AI_BOTS)) {
    if (!contactMap.has(botPhone)) {
      contactMap.set(botPhone, AI_BOTS[botPhone].name);
    }
  }

  // Build synchronised list
  for (const [cPhone, cName] of contactMap.entries()) {
    const matchedUser = users.get(cPhone);
    if (matchedUser) {
      results.push({
        phone: cPhone,
        name: cName || matchedUser.name,
        avatarUrl: matchedUser.avatarUrl,
        status: matchedUser.status,
        isAppUser: true
      });
    } else {
      // Not registered yet
      results.push({
        phone: cPhone,
        name: cName,
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cName)}`,
        status: "Unavailable on LinkUp",
        isAppUser: false
      });
    }
  }

  return res.json({ success: true, contacts: results });
});

// Fetch active users list (directory)
app.get("/api/directory", (req, res) => {
  const list = Array.from(users.values());
  return res.json({ success: true, users: list });
});

// Load Message History
app.get("/api/messages", (req, res) => {
  const { phone, contactPhone } = req.query;
  if (!phone || !contactPhone) {
    return res.status(400).json({ error: "Both phone and contactPhone are required" });
  }

  const p1 = phone as string;
  const p2 = contactPhone as string;

  const chatHistory = messages.filter(
    (msg) => 
      (msg.sender === p1 && msg.receiver === p2) ||
      (msg.sender === p2 && msg.receiver === p1)
  );

  // Mark status as read for any message received by `phone` from `contactPhone`
  chatHistory.forEach(msg => {
    if (msg.sender === p2 && msg.receiver === p1 && msg.status !== "read") {
      msg.status = "read";
      // Tell sender that their message was read
      sendSSEEvent(p2, "message_status_update", { messageId: msg.id, sender: p2, receiver: p1, status: "read" });
    }
  });

  return res.json({ success: true, messages: chatHistory });
});

// Mark messages as read
app.post("/api/messages/read", (req, res) => {
  const { phone, contactPhone } = req.body;
  if (!phone || !contactPhone) {
    return res.status(400).json({ error: "Both phone and contactPhone are required" });
  }

  messages.forEach(msg => {
    if (msg.sender === contactPhone && msg.receiver === phone && msg.status !== "read") {
      msg.status = "read";
      sendSSEEvent(contactPhone, "message_status_update", { messageId: msg.id, sender: contactPhone, receiver: phone, status: "read" });
    }
  });

  return res.json({ success: true });
});

// Send Typing Notification
app.post("/api/messages/typing", (req, res) => {
  const { phone, contactPhone, isTyping } = req.body;
  if (!phone || !contactPhone) {
    return res.status(400).json({ error: "Sender and receiver coordinates required" });
  }

  // Push typing state to the typing user's buddy
  sendSSEEvent(contactPhone, "typing_state", { sender: phone, isTyping });
  return res.json({ success: true });
});

// Fallback rule-based mock responders if Gemini API is offline/unavailable
function getMockBotResponse(botPhone: string, messageText: string): string {
  const lowerMsg = messageText.toLowerCase();
  
  if (botPhone === "+447700900011") { // Alice Wood (Coder)
    if (lowerMsg.includes("setup") || lowerMsg.includes("workspace") || lowerMsg.includes("picture")) {
      return "Sure thing! Check out my ultra-wide dev layout with matching neon highlights. [IMAGE: coder]";
    }
    if (lowerMsg.includes("hello") || lowerMsg.includes("hi")) {
      return "Hey! Doing some hot coding compiles. What programming language are we playing with today? ☕ Code never sleeps!";
    }
    if (lowerMsg.includes("coffee")) {
      return "Ah! Coffee! The absolute elixir of fullstack engineers! ☕ I'm on my 4th cup, ready to squash more TypeScript bugs!";
    }
    return "Fascinating! Let's refactor that loop to save a couple of micro-seconds. Have you tried checking my dual-screen [IMAGE: coder] config?";
  }
  
  if (botPhone === "+447700900022") { // Coach Bob
    if (lowerMsg.includes("photo") || lowerMsg.includes("meal") || lowerMsg.includes("picture")) {
      return "Eating healthy and clean gets you halfway to your targets! Check this perfect wellness smoothie and morning mountain terrain: [IMAGE: fitness]";
    }
    if (lowerMsg.includes("hello") || lowerMsg.includes("hi")) {
      return "Hello champion! Ready to get those steps in? Tell me: did you stretch and align your spine yet? Let's go! 💪🏋️";
    }
    return "Remember, persistence is the key! A quick 10-minute walk clears the neural cache. Try keeping it fresh! 💪🏋️";
  }

  if (botPhone === "+447700900033") { // Chef Charlie
    if (lowerMsg.includes("baked") || lowerMsg.includes("food") || lowerMsg.includes("picture") || lowerMsg.includes("eat")) {
      return "Cooking is love made visible! Look at this incredible freshly baked recipe I just plated: [IMAGE: food]";
    }
    return "Ah, food! The ultimate bridge between cultures. Have you ever tried baking sourdough at home? The secret is all in the moisture! 🥯🍝";
  }

  if (botPhone === "+447700900055") { // Hammond AI
    if (lowerMsg.includes("business") || lowerMsg.includes("strategy") || lowerMsg.includes("growth") || lowerMsg.includes("chart") || lowerMsg.includes("metrics")) {
      return "Excellent initiative! Let's optimize operations to capture maximum yield. Have a look at this structural leverage and trajectory: [IMAGE: business]";
    }
    if (lowerMsg.includes("hello") || lowerMsg.includes("hi")) {
      return "Greetings! I am Hammond, your strategic advisor. How can I help optimize your business models or streamline metric scaling today? 📊📈";
    }
    return "Compounding minor incremental optimizations leads to major strategic growth. Let's design an executive strategy blueprint! 📊📈";
  }

  if (botPhone === "+447700900066") { // Vida AI
    if (lowerMsg.includes("relax") || lowerMsg.includes("zen") || lowerMsg.includes("nature") || lowerMsg.includes("peace")) {
      return "Deep, comforting breaths restore your mind's internal equilibrium. Take a healing moment here: [IMAGE: zen]";
    }
    if (lowerMsg.includes("hello") || lowerMsg.includes("hi") || lowerMsg.includes("hey")) {
      return "Hello, dear soul! 🌸 I'm Vida, your path guide. How is your inner work flowing today? Remember to be gentle with yourself.";
    }
    return "Everything around us moves fast, but you carry the calm center. Let's practice a brief 4-7-8 breathing check-in together. 🌸🧘‍♀️";
  }

  // Luna AI fallback
  if (lowerMsg.includes("generate") || lowerMsg.includes("paint") || lowerMsg.includes("draw") || lowerMsg.includes("show")) {
    const match = messageText.match(/(?:generate|paint|draw|show|find)\s+a?\s*([a-zA-Z\s]+)/i);
    const item = match ? match[1].trim() : "sunset";
    return `Creating a unique visualization of "${item}" for you! Here is the result of my generative pipeline: [IMAGE: ${item}]`;
  }
  return "That's an interesting question! I am here to help you brainstorm. What else would you like to explore today? 🌟✨";
}

// Map keywords to gorgeous high-resolution free Unsplash images
function getImageForKeyword(keyword: string): string {
  const clean = keyword.toLowerCase().trim();
  if (clean.includes("business") || clean.includes("chart") || clean.includes("strategy") || clean.includes("growth")) {
    return "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80";
  }
  if (clean.includes("zen") || clean.includes("relax") || clean.includes("peace") || clean.includes("mindfulness")) {
    return "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=600&auto=format&fit=crop&q=80";
  }
  if (clean.includes("coder") || clean.includes("setup") || clean.includes("computer")) {
    return "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80";
  }
  if (clean.includes("fitness") || clean.includes("gym") || clean.includes("smoothie") || clean.includes("exercise")) {
    return "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=600&auto=format&fit=crop&q=80";
  }
  if (clean.includes("food") || clean.includes("cooking") || clean.includes("pizza") || clean.includes("recipe")) {
    return "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&auto=format&fit=crop&q=80";
  }
  if (clean.includes("cat")) {
    return "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600&auto=format&fit=crop&q=80";
  }
  if (clean.includes("dog") || clean.includes("puppy")) {
    return "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=600&auto=format&fit=crop&q=80";
  }
  if (clean.includes("space") || clean.includes("galaxy") || clean.includes("star")) {
    return "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80";
  }
  if (clean.includes("sunset") || clean.includes("nature")) {
    return "https://images.unsplash.com/photo-1472214222541-d510753a4907?w=600&auto=format&fit=crop&q=80";
  }
  if (clean.includes("coffee") || clean.includes("tea")) {
    return "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&auto=format&fit=crop&q=80";
  }
  if (clean.includes("city") || clean.includes("streets")) {
    return "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=600&auto=format&fit=crop&q=80";
  }
  // Fallback to beautiful modern illustration / scenic image
  return "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80";
}

// Post a new message
app.post("/api/messages/send", async (req, res) => {
  const { sender, receiver, text, imageUrl } = req.body;
  
  if (!sender || !receiver || (!text && !imageUrl)) {
    return res.status(400).json({ error: "Sender, receiver and text or image are required" });
  }

  // Create primary message
  const timestamp = new Date().toISOString();
  const mainMessage: Message = {
    id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    sender,
    receiver,
    text: text || "",
    imageUrl,
    timestamp,
    status: "sent"
  };

  messages.push(mainMessage);

  // Broadcast to receiver SSE if online
  sendSSEEvent(receiver, "new_message", mainMessage);
  
  // Return early to the client
  res.json({ success: true, message: mainMessage });

  // Update status stream: update to "delivered"
  setTimeout(() => {
    mainMessage.status = "delivered";
    sendSSEEvent(sender, "message_status_update", {
      messageId: mainMessage.id,
      sender,
      receiver,
      status: "delivered"
    });
  }, 300);

  // Check if receiver is one of our System AI Bots
  const botConfig = AI_BOTS[receiver];
  if (botConfig) {
    // 1. Wait a tiny bit then send typing indicator event
    setTimeout(async () => {
      sendSSEEvent(sender, "typing_state", { sender: receiver, isTyping: true });

      let replyText = "";
      
      if (ai) {
        try {
          // Construct chat summary context for the Bot
          // Get the last 15 messages between this user and the bot for context
          const history = messages
            .filter(
              (msg) => 
                (msg.sender === sender && msg.receiver === receiver) ||
                (msg.sender === receiver && msg.receiver === sender)
            )
            .slice(-15);

          const formattedHistory = history.map(msg => {
            const role = msg.sender === sender ? "User" : "You (Bot)";
            return `${role}: ${msg.imageUrl ? "[Sent an image]" : ""} ${msg.text}`;
          }).join("\n");

          // Invoke Gemini 3.5 Flash server-side
          const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: `System Instruction: ${botConfig.prompt}\n\nConversation history:\n${formattedHistory}\n\nRespond directly as the character with appropriate emotion. Keep it succinct and chatty:`,
          });
          
          replyText = response.text || "";
        } catch (err) {
          console.error("Gemini API execution error, falling back:", err);
          replyText = getMockBotResponse(receiver, text || "");
        }
      } else {
        // Mock fallback responder
        replyText = getMockBotResponse(receiver, text || "");
      }

      // Check for image commands in the reply e.g. [IMAGE: coder]
      let botImage: string | undefined = undefined;
      const indexImageTrigger = replyText.indexOf("[IMAGE:");
      if (indexImageTrigger !== -1) {
        const remaining = replyText.substring(indexImageTrigger);
        const match = remaining.match(/\[IMAGE:\s*([^\]]+)\]/);
        if (match) {
          const keyword = match[1];
          botImage = getImageForKeyword(keyword);
          // Remove the image string trigger from the message text
          replyText = replyText.replace(/\[IMAGE:\s*[^\]]+\]/, "").trim();
        }
      }

      // 2. Wait 2 more seconds to simulate reading and writing realistically
      setTimeout(() => {
        // Stop typing indicator
        sendSSEEvent(sender, "typing_state", { sender: receiver, isTyping: false });

        const botMsg: Message = {
          id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          sender: receiver,
          receiver: sender,
          text: replyText || "I got your message!",
          imageUrl: botImage,
          timestamp: new Date().toISOString(),
          status: "delivered"
        };

        messages.push(botMsg);
        sendSSEEvent(sender, "new_message", botMsg);

        // Auto transition user's original message to read (blue tick)
        mainMessage.status = "read";
        sendSSEEvent(sender, "message_status_update", {
          messageId: mainMessage.id,
          sender,
          receiver,
          status: "read"
        });

      }, 1500);

    }, 800);
  }
});

// Real-time synchronization stream (SSE)
app.get("/api/stream", (req, res) => {
  const { phone } = req.query;
  if (!phone) {
    return res.status(400).write("Error: Phone number is required");
  }

  const userPhone = phone as string;

  // Set SSE Headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });

  res.write("retry: 10000\n\n");

  const list = activeSSEConnections.get(userPhone) || [];
  list.push(res);
  activeSSEConnections.set(userPhone, list);

  console.log(`SSE Connection established for user: ${userPhone}. Total connections: ${list.length}`);

  // Ping heartbeat to prevent connection drop issues
  const pinger = setInterval(() => {
    res.write(":\n\n");
  }, 20000);

  req.on("close", () => {
    clearInterval(pinger);
    const existing = activeSSEConnections.get(userPhone) || [];
    const index = existing.indexOf(res);
    if (index !== -1) {
      existing.splice(index, 1);
    }
    if (existing.length === 0) {
      activeSSEConnections.delete(userPhone);
    } else {
      activeSSEConnections.set(userPhone, existing);
    }
    console.log(`SSE Connection closed for user: ${userPhone}`);
  });
});

// Vite & Static Asset Setup
const startServer = async () => {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`LinkUp listening on http://0.0.0.0:${PORT}`);
  });
};

startServer();
