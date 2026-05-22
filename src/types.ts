export interface User {
  phone: string;
  name: string;
  avatarUrl: string;
  status: string;
  isOnline: boolean;
  lastSeen?: string;
}

export interface Message {
  id: string;
  sender: string;
  receiver: string;
  text: string;
  imageUrl?: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
}

export interface Contact {
  phone: string;
  name: string;
  avatarUrl: string;
  status: string;
  isAppUser: boolean;
}
