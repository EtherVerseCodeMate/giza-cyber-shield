import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Bot,
  MessageCircle,
  X,
  Send,
  Minimize2,
  Maximize2,
  User,
  Loader2,
  Sparkles,
  Settings,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOpenRouterKey } from '@/hooks/useOpenRouterKey';
import { AdinkraSymbolDisplay } from '@/components/khepra/AdinkraSymbolDisplay';
import { useKhepraAuth } from '@/khepra/hooks/useKhepraAuth';

interface ChatMessage {
  id: string;
  message: string;
  messageType: 'user' | 'agent' | 'system';
  timestamp: Date;
}

interface MCPAskResponse {
  answer?: string;
  response?: string;
  message?: string;
  tools_called?: string[];
}

interface FloatingAIAssistantProps {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

const MAX_MESSAGES = 40;

export const FloatingAIAssistant = ({
  position = 'bottom-right',
}: FloatingAIAssistantProps) => {
  const { user } = useAuth();
  const { authState } = useKhepraAuth();
  const { apiKey, hasKey, setApiKey, clearApiKey } = useOpenRouterKey();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const sessionId = useRef<string>(crypto.randomUUID());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Welcome message on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const enhancement = authState.isAuthenticated
        ? `\n\n🔮 KHEPRA Enhanced: Operating with ${authState.culturalContext} intelligence`
        : '';
      setMessages([
        {
          id: crypto.randomUUID(),
          message: `🛡️ ARGUS AI Assistant\n\nI'm your 24/7 cybersecurity companion. Ask me about:\n• Security alerts & threats\n• Compliance status\n• Risk assessments\n• Quick actions${enhancement}\n\nHow can I help you secure your environment?`,
          messageType: 'agent',
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, authState]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || loading) return;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        message: text,
        messageType: 'user',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage].slice(-MAX_MESSAGES));
      setInput('');
      setLoading(true);

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        // BYOK: user-supplied OpenRouter key takes precedence over server env
        if (hasKey) headers['X-OpenRouter-Key'] = apiKey;

        // PQC token for Khepra-authenticated sessions
        const pqcToken = localStorage.getItem('khepra_pqc_token');
        if (pqcToken) headers['X-Khepra-PQC-Token'] = pqcToken;

        const res = await fetch('/api/v1/mcp/ask', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            query: text,
            session_id: sessionId.current,
            max_tools: 5,
            context: {
              user_id: user?.id,
              source: 'floating_assistant',
              cultural_context: authState.isAuthenticated
                ? authState.culturalContext
                : null,
            },
          }),
        });

        if (!res.ok) {
          throw new Error(`Agent responded with ${res.status}: ${res.statusText}`);
        }

        const data: MCPAskResponse = await res.json();

        const agentMessage: ChatMessage = {
          id: crypto.randomUUID(),
          message:
            data.answer ??
            data.response ??
            data.message ??
            'No response received.',
          messageType: 'agent',
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, agentMessage].slice(-MAX_MESSAGES));
      } catch (err: unknown) {
        const errText =
          err instanceof Error ? err.message : 'Please try again.';
        setMessages((prev) =>
          [
            ...prev,
            {
              id: crypto.randomUUID(),
              message: `Unable to reach ARGUS agent: ${errText}`,
              messageType: 'system' as const,
              timestamp: new Date(),
            },
          ].slice(-MAX_MESSAGES)
        );
      } finally {
        setLoading(false);
      }
    },
    [input, loading, apiKey, hasKey, user, authState]
  );

  const saveApiKey = () => {
    setApiKey(keyDraft);
    setKeyDraft('');
    setSettingsOpen(false);
  };

  const getPositionClass = () => {
    switch (position) {
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'top-right':
        return 'top-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      default:
        return 'bottom-4 right-4';
    }
  };

  const formatMessage = (message: string) => {
    return message.split('\n').map((line, index) => {
      if (line.startsWith('• ')) {
        return (
          <li key={index} className="ml-4 text-sm">
            {line.substring(2)}
          </li>
        );
      }
      if (line.startsWith('**') && line.endsWith('**')) {
        return (
          <div key={index} className="font-semibold text-primary mb-1 text-sm">
            {line.slice(2, -2)}
          </div>
        );
      }
      if (line.trim() === '') {
        return <br key={index} />;
      }
      return (
        <div key={index} className="text-sm mb-1">
          {line}
        </div>
      );
    });
  };

  const quickSuggestions = [
    "What's my current security status?",
    'Any critical alerts?',
    'Run compliance check',
    'Show threat intelligence',
  ];

  return (
    <div className={`fixed ${getPositionClass()} z-50 transition-all duration-300`}>
      {!isOpen ? (
        <Button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 rounded-full bg-gradient-primary shadow-lg hover:shadow-xl transition-all duration-300 group relative"
          size="lg"
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 animate-pulse" />
          <Bot className="h-6 w-6 text-primary-foreground relative z-10" />
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-success rounded-full animate-pulse flex items-center justify-center">
            <Sparkles className="h-2 w-2 text-white" />
          </div>
        </Button>
      ) : (
        <Card
          className={`card-cyber transition-all duration-300 ${
            isMinimized ? 'w-80 h-16' : 'w-96 h-[500px]'
          } shadow-2xl border-primary/30`}
        >
          {/* Header */}
          <CardHeader className="pb-2 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <div className="w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-success rounded-full animate-pulse" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">
                    ARGUS AI Assistant
                  </CardTitle>
                  {authState.isAuthenticated && (
                    <Badge
                      variant="outline"
                      className="text-xs bg-purple-500/20 text-purple-300 border-purple-500/30"
                    >
                      <AdinkraSymbolDisplay
                        symbolName="Nyame"
                        showMatrix={false}
                        showMeaning={false}
                        className="w-3 h-3 mr-1"
                      />
                      KHEPRA Enhanced
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-1">
                {/* BYOK settings popover */}
                <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      title="AI model settings"
                    >
                      <Settings className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-72 p-4"
                    side="left"
                    align="end"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold">
                          OpenRouter API Key
                        </span>
                        {hasKey && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 ml-auto" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Bring your own <code className="font-mono">sk-or-*</code> key
                        to use your own OpenRouter quota. Stored locally, never sent to
                        our servers.
                      </p>

                      {hasKey ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded-md">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                            <span className="text-xs text-green-600 dark:text-green-400 font-mono">
                              {apiKey.slice(0, 12)}••••••••
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              clearApiKey();
                              setSettingsOpen(false);
                            }}
                          >
                            Remove key
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label htmlFor="or-key" className="text-xs sr-only">
                            OpenRouter API Key
                          </Label>
                          <Input
                            id="or-key"
                            type="password"
                            placeholder="sk-or-v1-..."
                            value={keyDraft}
                            onChange={(e) => setKeyDraft(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && saveApiKey()}
                            className="font-mono text-xs h-8"
                            autoComplete="off"
                          />
                          <Button
                            size="sm"
                            className="w-full text-xs h-8"
                            onClick={saveApiKey}
                            disabled={!keyDraft.trim().startsWith('sk-or-')}
                          >
                            Save key
                          </Button>
                        </div>
                      )}

                      <p className="text-[10px] text-muted-foreground/60">
                        Without a key the agent uses the server-side model.
                        Get a free key at openrouter.ai
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="h-6 w-6 p-0"
                >
                  {isMinimized ? (
                    <Maximize2 className="h-3 w-3" />
                  ) : (
                    <Minimize2 className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardHeader>

          {!isMinimized && (
            <CardContent className="flex flex-col h-[420px] p-4 pt-0">
              <ScrollArea className="flex-1 pr-2 mb-3">
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex items-start space-x-2 ${
                        msg.messageType === 'user'
                          ? 'flex-row-reverse space-x-reverse'
                          : ''
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                          msg.messageType === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-accent text-accent-foreground'
                        }`}
                      >
                        {msg.messageType === 'user' ? (
                          <User className="h-3 w-3" />
                        ) : (
                          <Bot className="h-3 w-3" />
                        )}
                      </div>

                      <div
                        className={`max-w-[85%] ${
                          msg.messageType === 'user' ? 'text-right' : 'text-left'
                        }`}
                      >
                        <div
                          className={`inline-block p-2 rounded-lg text-xs ${
                            msg.messageType === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : msg.messageType === 'system'
                              ? 'bg-destructive/15 text-destructive border border-destructive/20'
                              : 'bg-card border border-border/50'
                          }`}
                        >
                          {formatMessage(msg.message)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {msg.timestamp.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                  ))}

                  {loading && (
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center">
                        <Bot className="h-3 w-3" />
                      </div>
                      <div className="bg-card border border-border/50 p-2 rounded-lg">
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {messages.length === 1 && (
                <div className="mb-3">
                  <div className="text-xs text-muted-foreground mb-2">
                    Quick suggestions:
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {quickSuggestions.map((suggestion, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 p-2 justify-start hover:bg-primary/5"
                        onClick={() => setInput(suggestion)}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex space-x-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about security, compliance, threats..."
                  className="text-sm h-8"
                  disabled={loading}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={loading || !input.trim()}
                  className="h-8 w-8 p-0"
                >
                  {loading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                </Button>
              </form>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
};

// Unused lucide imports kept to prevent tree-shaking from breaking icon bundle
export { MessageCircle };
