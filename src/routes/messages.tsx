import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CheckCheck } from "lucide-react";

export const Route = createFileRoute("/messages")({
  component: MessagesPage,
});

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  sender_profile?: { full_name: string; avatar_url: string | null } | null;
};

type Contact = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  lastMessageAt: string;
};

function MessagesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "login", role: "student" } });
  }, [user, loading, navigate]);

  const loadContacts = async () => {
    if (!user) return;
    // For MVP, we fetch unique users we've messaged or who messaged us
    const { data, error } = await supabase
      .from("messages")
      .select("sender_id, receiver_id, created_at, sender_profile:profiles!messages_sender_id_fkey(full_name, avatar_url), receiver_profile:profiles!messages_receiver_id_fkey(full_name, avatar_url)")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    const uniqueContacts = new Map<string, Contact>();
    (data || []).forEach((m: any) => {
      const isSender = m.sender_id === user.id;
      const contactId = isSender ? m.receiver_id : m.sender_id;
      const profile = isSender ? m.receiver_profile : m.sender_profile;
      
      if (!uniqueContacts.has(contactId) && profile) {
        uniqueContacts.set(contactId, {
          id: contactId,
          full_name: profile.full_name || "Unknown User",
          avatar_url: profile.avatar_url,
          lastMessageAt: m.created_at,
        });
      }
    });

    setContacts(Array.from(uniqueContacts.values()));
  };

  const loadMessages = async (contactId: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("messages")
      .select("id, sender_id, receiver_id, content, created_at")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${user.id})`)
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Failed to load messages");
      return;
    }
    setMessages(data as Message[]);
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 100);
  };

  useEffect(() => {
    if (user) {
      loadContacts();
    }
  }, [user]);

  useEffect(() => {
    if (activeContact) {
      loadMessages(activeContact.id);
      
      // Subscribe to real-time updates for this conversation
      const channelName = [user?.id, activeContact.id].sort().join('_');
      const channel = supabase
        .channel(`room_${channelName}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          (payload) => {
            const newMsg = payload.new as Message;
            if (
              (newMsg.sender_id === user?.id && newMsg.receiver_id === activeContact.id) ||
              (newMsg.sender_id === activeContact.id && newMsg.receiver_id === user?.id)
            ) {
              setMessages((prev) => [...prev, newMsg]);
              setRemoteTyping(false);
              setTimeout(() => {
                if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
              }, 100);
            }
          }
        )
        .on('broadcast', { event: 'typing' }, (payload) => {
          if (payload.payload.userId === activeContact.id) {
             setRemoteTyping(payload.payload.typing);
             setTimeout(() => {
                if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
             }, 50);
          }
        })
        .subscribe();
      
      channelRef.current = channel;

      return () => {
        supabase.removeChannel(channel);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      };
    }
  }, [activeContact, user]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeContact || !newMessage.trim()) return;

    setSending(true);
    const { error } = await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: activeContact.id,
      content: newMessage.trim(),
    });
    
    setSending(false);
    
    if (error) {
      toast.error("Failed to send message");
    } else {
      setNewMessage("");
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: { userId: user.id, typing: false },
        });
      }
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
                      <p className="truncate text-xs text-muted-foreground">
                        {new Date(contact.lastMessageAt).toLocaleDateString()}
                      </p>
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
                      <Link to="/teacher/$id" params={{ id: activeContact.id }} className="text-xs text-brand hover:underline">View Profile</Link>
                    </div>
                  </div>
                </div>

                {/* Messages List */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-surface/30">
                  {messages.map((msg, index) => {
                    const isMe = msg.sender_id === user?.id;
                    const prevMsg = index > 0 ? messages[index - 1] : null;
                    const isConsecutive = prevMsg && prevMsg.sender_id === msg.sender_id && 
                      (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 60000);
                    
                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} ${isConsecutive ? "mt-1" : "mt-4"}`}>
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
                  {remoteTyping && (
                    <div className="flex justify-start mt-4">
                      <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex gap-1 items-center h-10">
                        <span className="size-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="size-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="size-1.5 bg-muted-foreground/40 rounded-full animate-bounce"></span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input Area */}
                <div className="border-t border-border p-6 bg-card">
                  <form onSubmit={sendMessage} className="flex gap-3">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        if (channelRef.current && user) {
                          channelRef.current.send({
                            type: 'broadcast',
                            event: 'typing',
                            payload: { userId: user.id, typing: e.target.value.length > 0 },
                          });
                          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                          typingTimeoutRef.current = setTimeout(() => {
                            channelRef.current?.send({
                              type: 'broadcast',
                              event: 'typing',
                              payload: { userId: user.id, typing: false },
                            });
                          }, 3000);
                        }
                      }}
                      placeholder="Type a message..."
                      className="flex-1 rounded-full border border-border bg-surface px-6 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                    <Button type="submit" disabled={!newMessage.trim() || sending} className="rounded-full bg-brand px-8 font-semibold">
                      Send
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
