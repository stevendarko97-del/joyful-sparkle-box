import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import { SiteNav } from "@/components/site-nav";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CheckCheck } from "lucide-react";

type MessagesSearch = {
  contactId?: string;
};

export const Route = createFileRoute("/messages")({
  validateSearch: (search: Record<string, unknown>): MessagesSearch => {
    return {
      contactId: search.contactId as string | undefined,
    };
  },
  component: MessagesPage,
});

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string | null;
};

type Contact = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role?: string;
  last_message?: string;
  last_message_at?: string;
};

import { getBackendUrl } from "@/lib/config";

const BACKEND = getBackendUrl();

function MessagesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [messages, setMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "login", role: "student" } });
  }, [user, loading, navigate]);

  const loadContacts = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND}/api/messages/contacts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data?.contacts) {
        setContacts(data.contacts);
      }
    } catch (err) {
      console.error("Error loading contacts", err);
    }
  }, []);

  const loadMessages = useCallback(async (contactId: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND}/api/messages/${contactId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data?.messages) {
        setMessages(data.messages);
        setTimeout(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }, 80);
      }
    } catch (err) {
      console.error("Error loading messages", err);
    }
  }, []);

  // Initial load contacts
  useEffect(() => {
    if (user) {
      loadContacts();
    }
  }, [user, loadContacts]);

  // Handle direct navigation via search param ?contactId=...
  useEffect(() => {
    if (!user || !search.contactId) return;
    const targetId = search.contactId;

    // Check if in existing contacts list
    const existing = contacts.find((c) => c.id === targetId);
    if (existing) {
      setActiveContact(existing);
    } else {
      // Fetch contact profile info
      const token = localStorage.getItem("token");
      fetch(`${BACKEND}/api/messages/contact-info/${targetId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data?.contact) {
            const newContact: Contact = {
              id: data.contact.id,
              full_name: data.contact.full_name || "Tutor",
              avatar_url: data.contact.avatar_url,
              role: data.contact.role,
            };
            setActiveContact(newContact);
            setContacts((prev) => (prev.some((c) => c.id === newContact.id) ? prev : [newContact, ...prev]));
          }
        })
        .catch(console.error);
    }
  }, [user, search.contactId, contacts]);

  // Polling for active conversation
  useEffect(() => {
    if (!activeContact) return;
    loadMessages(activeContact.id);

    const interval = setInterval(() => {
      loadMessages(activeContact.id);
    }, 3000);

    return () => clearInterval(interval);
  }, [activeContact, loadMessages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeContact || !newMessage.trim() || sending) return;

    const token = localStorage.getItem("token");
    const content = newMessage.trim();
    setSending(true);

    try {
      const res = await fetch(`${BACKEND}/api/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          receiver_id: activeContact.id,
          content,
        }),
      });
      const data = await res.json();
      setSending(false);

      if (res.ok && data?.message) {
        setNewMessage("");
        setMessages((prev) => [...prev, data.message]);
        loadContacts();
        setTimeout(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }, 50);
      } else {
        toast.error(data?.error || "Failed to send message");
      }
    } catch (err: any) {
      setSending(false);
      toast.error("Failed to send message");
    }
  };

  if (loading) return <div className="min-h-screen bg-surface"><SiteNav /></div>;

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <SiteNav />
      <div className="mx-auto flex w-full max-w-7xl flex-1 overflow-hidden px-6 py-8">
        <div className="flex h-[calc(100vh-140px)] w-full overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          
          {/* Contacts Sidebar */}
          <div className="w-1/3 border-r border-border flex flex-col bg-surface/50">
            <div className="p-6 border-b border-border">
              <h2 className="font-serif text-2xl">Messages</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {contacts.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No conversations yet. Book a session or message a tutor to start!
                </div>
              ) : (
                contacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => setActiveContact(contact)}
                    className={`flex w-full items-center gap-4 rounded-2xl p-4 transition-all text-left ${
                      activeContact?.id === contact.id ? "bg-brand/10 ring-1 ring-brand/20" : "hover:bg-secondary"
                    }`}
                  >
                    <div className="size-12 shrink-0 overflow-hidden rounded-full bg-secondary ring-1 ring-black/5">
                      {contact.avatar_url ? (
                        <img src={contact.avatar_url} alt="" className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center bg-brand/5 text-brand font-bold">
                          {contact.full_name[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="truncate font-semibold">{contact.full_name}</p>
                      {contact.last_message && (
                        <p className="truncate text-xs text-muted-foreground">{contact.last_message}</p>
                      )}
                      {contact.last_message_at && (
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {new Date(contact.last_message_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat Window */}
          <div className="flex flex-1 flex-col bg-card">
            {activeContact ? (
              <>
                {/* Chat Header */}
                <div className="flex items-center justify-between border-b border-border p-6 shadow-sm z-10">
                  <div className="flex items-center gap-4">
                    <div className="size-10 shrink-0 overflow-hidden rounded-full bg-secondary">
                      {activeContact.avatar_url ? (
                        <img src={activeContact.avatar_url} alt="" className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center bg-brand/5 text-brand font-bold">
                          {activeContact.full_name[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold">{activeContact.full_name}</h3>
                      {activeContact.role === "teacher" && (
                        <Link to="/teacher/$id" params={{ id: activeContact.id }} className="text-xs text-brand hover:underline">
                          View Tutor Profile
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                {/* Messages List */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-surface/30">
                  {messages.length === 0 && (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      No messages in this chat yet. Say hello! 👋
                    </div>
                  )}
                  {messages.map((msg, index) => {
                    const isMe = msg.sender_id === user?.id;
                    const prevMsg = index > 0 ? messages[index - 1] : null;
                    const isConsecutive = prevMsg && prevMsg.sender_id === msg.sender_id && 
                      (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 60000);
                    
                    return (
                      <div key={msg.id || index} className={`flex ${isMe ? "justify-end" : "justify-start"} ${isConsecutive ? "mt-1" : "mt-4"}`}>
                        <div className={`max-w-[70%] px-4 py-2.5 shadow-sm relative group ${
                          isMe 
                            ? `bg-brand text-primary-foreground ${isConsecutive ? "rounded-2xl rounded-tr-sm" : "rounded-2xl rounded-br-sm"}` 
                            : `bg-card border border-border ${isConsecutive ? "rounded-2xl rounded-tl-sm" : "rounded-2xl rounded-bl-sm"}`
                        }`}>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                          <div className={`flex items-center justify-end gap-1 mt-1 ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            <p className="text-[9px]">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {isMe && <CheckCheck className="size-3" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Input Area */}
                <div className="border-t border-border p-6 bg-card">
                  <form onSubmit={sendMessage} className="flex gap-3">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 rounded-full border border-border bg-surface px-6 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                    <Button type="submit" disabled={!newMessage.trim() || sending} className="rounded-full bg-brand px-8 font-semibold">
                      {sending ? "Sending..." : "Send"}
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center p-8">
                <div className="flex size-20 items-center justify-center rounded-full bg-secondary text-brand mb-4">
                  <svg className="size-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <h3 className="font-serif text-2xl">Your Messages</h3>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">Select a conversation from the sidebar or start a new one from a tutor's profile.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
