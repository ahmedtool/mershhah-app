
"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'wouter';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { useUser } from '@/hooks/useUser';

export default function ChatPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const { user: currentUser } = useUser();
  const [otherUser, setOtherUser] = useState<any | null>(null);
  const params = useParams();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const restaurantName = decodeURIComponent(params.username as string);

  useEffect(() => {
    let isMounted = true;
    if (isMounted) {
      setOtherUser({
        id: 'mock-owner',
        full_name: restaurantName,
        avatar_url: '',
      });
    }
    return () => { isMounted = false; };
  }, [restaurantName]);

  useEffect(() => {
    let isMounted = true;
    if (currentUser && otherUser && isMounted) {
      setMessages([
        { id: '1', content: 'أهلاً بك! كيف يمكنني مساعدتك؟', sender_id: otherUser.id, created_at: new Date().toISOString() }
      ]);
    }
    return () => { isMounted = false; };
  }, [currentUser, otherUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !currentUser || !otherUser) return;

    const msg = {
        id: Date.now().toString(),
        content: newMessage.trim(),
        sender_id: currentUser.id,
        created_at: new Date().toISOString()
    };

    setMessages((prev) => [...prev, msg]);
    setNewMessage('');

    setTimeout(() => {
        setMessages((prev) => [...prev, {
            id: (Date.now() + 1).toString(),
            content: 'شكراً لرسالتك. سنقوم بالرد عليك في أقرب وقت ممكن.',
            sender_id: otherUser.id,
            created_at: new Date().toISOString()
        }]);
    }, 2000);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <header className="flex items-center gap-4 border-b bg-muted/40 px-6 py-4">
        <Avatar className="h-10 w-10 border">
          <AvatarImage src={otherUser?.avatar_url} alt={otherUser?.full_name} />
          <AvatarFallback>{otherUser?.full_name?.[0]}</AvatarFallback>
        </Avatar>
        <div>
            <h2 className="text-lg font-semibold">{otherUser?.full_name || 'Loading...'}</h2>
            <p className="text-sm text-muted-foreground">{restaurantName}</p>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${msg.sender_id === currentUser?.id ? 'justify-end' : ''}`}>
              {msg.sender_id !== currentUser?.id && (
                <Avatar className="h-8 w-8 border">
                  <AvatarImage src={otherUser?.avatar_url} alt={otherUser?.full_name} />
                  <AvatarFallback>{otherUser?.full_name?.[0]}</AvatarFallback>
                </Avatar>
              )}
              <div className={`max-w-[70%] rounded-lg px-4 py-2 ${ msg.sender_id === currentUser?.id ? 'bg-primary text-primary-foreground' : 'bg-muted' }`}>
                <p className="text-sm">{msg.content}</p>
              </div>
                {msg.sender_id === currentUser?.id && (
                <Avatar className="h-8 w-8 border">
                  <AvatarImage src={(currentUser as any)?.avatar_url} alt={currentUser?.full_name ?? undefined} />
                  <AvatarFallback>{currentUser?.full_name?.[0] || 'U'}</AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
           <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="border-t bg-muted/40 p-4">
        <form onSubmit={handleSendMessage} className="relative">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="اكتب رسالتك هنا..."
            className="pr-16"
          />
          <Button type="submit" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2">
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </footer>
    </div>
  );
}
