"use client";

import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SendHorizonal, X, Bot, User, Utensils, Ticket } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { cn } from "@/lib/utils";
import { restaurantChat } from "@/ai/flows/restaurant-chat-flow";
import { AnimatePresence, motion } from "framer-motion";

type Message = {
  id: number;
  text: string;
  sender: "user" | "bot";
};

type ChatView = "chat" | "menu" | "ticket";

interface ChatInterfaceProps {
  onClose: () => void;
}

export default function ChatInterface({ onClose }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "أهلاً بك في مطعمنا! كيف يمكنني مساعدتك اليوم؟ يمكنك السؤال عن قائمة الطعام، العروض، أو أي شيء آخر.",
      sender: "bot",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = async () => {
    if (inputValue.trim() === "") return;

    const userMessage: Message = {
      id: Date.now(),
      text: inputValue,
      sender: "user",
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await restaurantChat({
        customerMessage: inputValue,
        restaurantData: "اسم المطعم: مائدتي. المطبخ: عربي متنوع. العروض: خصم 20% على الطلبات فوق 100 ريال.",
      });
      
      const botMessage: Message = {
        id: Date.now() + 1,
        text: response.smartReply,
        sender: "bot",
      };
      setMessages((prev) => [...prev, botMessage]);

    } catch (error) {
      console.error("Error with AI chat:", error);
      const errorMessage: Message = {
        id: Date.now() + 1,
        text: "عذراً, حدث خطأ ما. الرجاء المحاولة مرة أخرى.",
        sender: "bot",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
        if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
        }
    }
  }, [messages]);

  const logoImage = PlaceHolderImages.find(p => p.id === 'logo');

  return (
    <Card className="flex flex-col h-full w-full rounded-t-lg sm:rounded-lg border-0 sm:border shadow-none sm:shadow-2xl">
      <CardHeader className="flex flex-row items-center justify-between p-4 bg-primary text-primary-foreground rounded-t-lg">
        <div className="flex items-center gap-3">
          {logoImage && <Avatar>
            <AvatarImage src={logoImage.imageUrl} alt="Restaurant Logo" data-ai-hint={logoImage.imageHint} />
            <AvatarFallback>م</AvatarFallback>
          </Avatar>}
          <CardTitle className="font-headline text-lg">المساعد الذكي</CardTitle>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-primary-foreground hover:bg-white/20 hover:text-primary-foreground">
          <X className="h-5 w-5" />
          <span className="sr-only">إغلاق</span>
        </Button>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full" ref={scrollAreaRef}>
          <div className="p-4 space-y-4">
            <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className={cn(
                  "flex items-start gap-3 max-w-[85%]",
                  message.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto flex-row"
                )}
              >
                <Avatar className="w-8 h-8">
                    {message.sender === 'bot' ? <Bot className="w-8 h-8 p-1 bg-muted rounded-full"/> : <User className="w-8 h-8 p-1 bg-accent text-accent-foreground rounded-full"/>}
                </Avatar>
                <div
                  className={cn(
                    "p-3 rounded-lg text-sm whitespace-pre-wrap",
                    message.sender === "user"
                      ? "bg-primary text-primary-foreground rounded-br-none"
                      : "bg-muted text-muted-foreground rounded-bl-none"
                  )}
                >
                  {message.text}
                </div>
              </motion.div>
            ))}
            </AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-start gap-3 mr-auto"
              >
                <Avatar className="w-8 h-8">
                    <Bot className="w-8 h-8 p-1 bg-muted rounded-full"/>
                </Avatar>
                <div className="p-3 rounded-lg bg-muted">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 bg-primary rounded-full animate-pulse [animation-delay:-0.3s]"></span>
                    <span className="h-2 w-2 bg-primary rounded-full animate-pulse [animation-delay:-0.15s]"></span>
                    <span className="h-2 w-2 bg-primary rounded-full animate-pulse"></span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-2 border-t">
        <div className="relative w-full">
          <Input
            type="text"
            placeholder="اكتب رسالتك هنا..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isLoading && handleSendMessage()}
            className="pr-12 h-12 text-base"
            disabled={isLoading}
            aria-label="حقل إدخال الرسالة"
          />
          <Button
            type="submit"
            size="icon"
            onClick={handleSendMessage}
            disabled={isLoading || inputValue.trim() === ""}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-9 w-9 bg-primary text-primary-foreground"
            aria-label="إرسال الرسالة"
          >
            <SendHorizonal className="h-5 w-5" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
