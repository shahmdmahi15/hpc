"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  MessageSquare,
  Send,
  Bell,
  BellOff,
  Search,
  Users,
  AlertTriangle,
  Stethoscope,
  Activity,
  CreditCard,
  DoorOpen,
  UserCheck,
  ShieldCheck,
  Trash2,
  Calendar,
  Volume2,
  VolumeX,
  Menu,
  X,
  Tag,
  Loader2,
  RefreshCw,
  Sparkles,
  Paperclip,
  CheckCheck,
  Clock,
  User,
} from "lucide-react";
import { Role } from "@/generated/prisma/enums";
import {
  getChatMessagesAction,
  sendChatMessageAction,
  deleteChatMessageAction,
  getChatSessionAction,
  getClinicRoomsAction,
  type SerializedChatMessage,
  type ChatClinicRoom,
} from "@/actions/chat/chat.action";
import { searchPatientsAction } from "@/actions/receptionist/patient.action";
import { DashboardDateSelector } from "@/components/ui/dashboard-date-selector";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { playChatChime } from "@/lib/chat-chime";
import { toast } from "sonner";

interface ClinicChatViewProps {
  currentUserRole: Role;
  currentUserId?: string;
  initialDate?: string;
  activePerformerId?: string;
  performers?: { id: string; name: string; phone?: string | null; role?: Role }[];
  rooms?: { id?: string; number: string; purpose?: string | null; accessType?: string }[];
  showDateSelector?: boolean;
  onDateChange?: (date: string) => void;
}

// Preset clinic rooms fallback (all clinic rooms 200 - 215)
const FALLBACK_CLINIC_ROOMS = [
  { number: "200", purpose: "Waiting Room" },
  { number: "201", purpose: "Cashier Register" },
  { number: "202", purpose: "Private Room" },
  { number: "203", purpose: "Private Room" },
  { number: "204", purpose: "Kitchen" },
  { number: "205", purpose: "Doctor Consultation" },
  { number: "206", purpose: "Equipment Room" },
  { number: "207", purpose: "Therapy Room" },
  { number: "208", purpose: "Therapy Room" },
  { number: "209", purpose: "Therapy Room" },
  { number: "210", purpose: "Therapy Room" },
  { number: "211", purpose: "Therapy Room" },
  { number: "212", purpose: "Therapy Room" },
  { number: "213", purpose: "Therapy Room" },
  { number: "214", purpose: "Therapy Room" },
  { number: "215", purpose: "Therapy Room" },
];

// Built-in clinic channels
const SYSTEM_CHANNELS = [
  {
    id: "GENERAL",
    name: "General Broadcast",
    description: "All clinic staff announcement & general coordination",
    icon: MessageSquare,
    badgeColor: "bg-primary/10 text-primary border-primary/20",
  },
  {
    id: "CLINICAL",
    name: "Doctors & Clinical",
    description: "Doctor consultations, urgent inquiries & prescriptions",
    icon: Stethoscope,
    badgeColor: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
  },
  {
    id: "RECEPTION",
    name: "Reception & Arrivals",
    description: "Patient arrivals, walk-ins & waiting room updates",
    icon: UserCheck,
    badgeColor: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  },
  {
    id: "THERAPY",
    name: "Therapy Floor & Handlers",
    description: "Physical therapy floor, modalities & session calls",
    icon: Activity,
    badgeColor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
  {
    id: "CASHIER",
    name: "Cashier & Billing",
    description: "Invoice clearances, payment queries & cashier desk",
    icon: CreditCard,
    badgeColor: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  },
] as const;

// Quick canned responses for high-speed clinical floor communication
const CANNED_RESPONSES = [
  "Patient arrived at reception",
  "Ready for next therapy patient",
  "Doctor is calling patient to chamber",
  "Payment cleared / Invoice handed to patient",
  "Patient requested doctor consultation serial",
  "Please send patient to Room 200",
  "Therapy session completed",
];

export function ClinicChatView({
  currentUserRole,
  currentUserId: propUserId,
  initialDate,
  activePerformerId: propPerformerId,
  performers = [],
  rooms: propRooms = [],
  showDateSelector = true,
  onDateChange,
}: ClinicChatViewProps) {
  const [clinicRooms, setClinicRooms] = React.useState<
    { number: string; purpose?: string | null }[]
  >(() => (propRooms && propRooms.length > 0 ? propRooms : FALLBACK_CLINIC_ROOMS));

  // Sync rooms prop or fetch all rooms from DB if not provided
  React.useEffect(() => {
    if (propRooms && propRooms.length > 0) {
      setClinicRooms(propRooms);
    } else {
      getClinicRoomsAction().then((res) => {
        if (res.success && res.rooms.length > 0) {
          setClinicRooms(res.rooms);
        }
      });
    }
  }, [propRooms]);

  const todayStr = React.useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const [selectedDate, setSelectedDate] = React.useState<string>(
    initialDate || todayStr,
  );

  // Sync selectedDate when initialDate prop changes from parent
  React.useEffect(() => {
    if (initialDate && initialDate !== selectedDate) {
      setSelectedDate(initialDate);
    }
  }, [initialDate, selectedDate]);
  const [activeChannel, setActiveChannel] = React.useState<string>("GENERAL");
  const [messages, setMessages] = React.useState<SerializedChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = React.useState(true);
  const [isSending, setIsSending] = React.useState(false);

  // Composer State
  const [messageText, setMessageText] = React.useState("");
  const [isUrgent, setIsUrgent] = React.useState(false);
  const [selectedPatientTag, setSelectedPatientTag] = React.useState<any | null>(null);
  const [selectedRoomNumber, setSelectedRoomNumber] = React.useState<string>("");

  // Staff identity for desk roles
  const [authorPerformerId, setAuthorPerformerId] = React.useState<string>(
    () => propPerformerId || performers[0]?.id || "",
  );

  const [myUserId, setMyUserId] = React.useState<string>(propUserId || "");
  const [mySentMessageIds, setMySentMessageIds] = React.useState<Set<string>>(
    () => new Set(),
  );

  // Sync propUserId or fetch current session if missing
  React.useEffect(() => {
    if (propUserId) {
      setMyUserId(propUserId);
    } else {
      getChatSessionAction().then((res) => {
        if (res.success && res.currentUserId) {
          setMyUserId(res.currentUserId);
        }
      });
    }
  }, [propUserId]);

  // Sync active performer prop if updated by parent
  React.useEffect(() => {
    if (propPerformerId && propPerformerId !== authorPerformerId) {
      setAuthorPerformerId(propPerformerId);
    }
  }, [propPerformerId, authorPerformerId]);

  // Robust determination of whether a message was sent by the current viewer
  const isMessageFromMe = React.useCallback(
    (msg: SerializedChatMessage): boolean => {
      // 1. Explicitly sent in this browser session
      if (mySentMessageIds.has(msg.id)) return true;

      // 2. Sent by current selected performer
      if (
        authorPerformerId &&
        msg.performerId &&
        msg.performerId === authorPerformerId
      ) {
        return true;
      }

      // 3. Sent by current logged-in user account
      if (myUserId && msg.senderId === myUserId) {
        // If message was tagged with a performer and we have a selected performer:
        if (msg.performerId && authorPerformerId) {
          return msg.performerId === authorPerformerId;
        }
        return true;
      }

      // 4. Fallback if current user role matches and no conflicting performer
      if (
        !myUserId &&
        currentUserRole &&
        msg.senderRole === currentUserRole &&
        (!msg.performerId || !authorPerformerId || msg.performerId === authorPerformerId)
      ) {
        return true;
      }

      return false;
    },
    [mySentMessageIds, authorPerformerId, myUserId, currentUserRole],
  );

  // Channel unread counts (in-memory for active session)
  const [unreadCounts, setUnreadCounts] = React.useState<Record<string, number>>({});

  // Audio mute
  const [isMuted, setIsMuted] = React.useState(false);

  // Search filter inside current channel's messages
  const [searchQuery, setSearchQuery] = React.useState("");

  // Mobile sidebar drawer
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);

  // Patient tag search dialog
  const [isPatientTagDialogOpen, setIsPatientTagDialogOpen] = React.useState(false);
  const [patientSearchQuery, setPatientSearchQuery] = React.useState("");
  const [patientSearchResults, setPatientSearchResults] = React.useState<any[]>([]);
  const [isSearchingPatient, setIsSearchingPatient] = React.useState(false);

  // Scroll anchor
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const messagesContainerRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        block: "end",
      });
    }
  };

  // Fetch messages for selectedDate & channel
  const fetchMessages = React.useCallback(async (dateStr: string, channelId: string) => {
    setIsLoadingMessages(true);
    try {
      const res = await getChatMessagesAction({
        dateStr,
        channel: channelId,
      });
      if (res.success) {
        setMessages(res.messages);
      }
    } catch (err) {
      console.error("Failed to load chat messages:", err);
    } finally {
      setIsLoadingMessages(false);
      setTimeout(() => scrollToBottom(false), 50);
    }
  }, []);

  // Fetch when date or channel changes
  React.useEffect(() => {
    fetchMessages(selectedDate, activeChannel);
  }, [selectedDate, activeChannel, fetchMessages]);

  // Handle Date Change from DashboardDateSelector
  const handleSelectDate = (newDate: string) => {
    setSelectedDate(newDate);
    onDateChange?.(newDate);
  };

  // Real-time SSE listener
  const { connectionStatus } = useRealtimeEvents({
    onEvent: (event) => {
      const type = (event?.type || "").toUpperCase();
      if (type === "CHAT_MESSAGE_SENT" && event?.data) {
        const newMsg: SerializedChatMessage = event.data;

        // If message is for currently active date
        if (newMsg.dateStr === selectedDate) {
          if (newMsg.channel === activeChannel) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            setTimeout(() => scrollToBottom(true), 50);
          } else {
            // Increment unread count for that channel
            setUnreadCounts((prev) => ({
              ...prev,
              [newMsg.channel]: (prev[newMsg.channel] || 0) + 1,
            }));
          }

          // Play chime if message sent by another person
          if (!isMessageFromMe(newMsg) && !isMuted) {
            playChatChime(newMsg.isUrgent);
          }
        }
      } else if (type === "CHAT_MESSAGE_DELETED" && event?.data) {
        const deletedId = event.data.messageId;
        setMessages((prev) => prev.filter((m) => m.id !== deletedId));
      }
    },
  });

  // Switch channel and clear unread badge
  const handleSwitchChannel = (channelId: string) => {
    setActiveChannel(channelId);
    setUnreadCounts((prev) => ({ ...prev, [channelId]: 0 }));
    setIsMobileSidebarOpen(false);
  };

  // Send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = messageText.trim();
    if (!content || isSending) return;

    setIsSending(true);
    try {
      const res = await sendChatMessageAction({
        content,
        channel: activeChannel,
        dateStr: selectedDate,
        isUrgent,
        performerId: authorPerformerId || undefined,
        patientId: selectedPatientTag?.id || undefined,
        roomNumber: selectedRoomNumber || undefined,
      });

      if (res.success && res.message) {
        const newMsg = res.message;
        setMySentMessageIds((prev) => new Set(prev).add(newMsg.id));
        setMessageText("");
        setIsUrgent(false);
        setSelectedPatientTag(null);
        setSelectedRoomNumber("");
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setTimeout(() => scrollToBottom(true), 50);
      } else {
        toast.error(res.error || "Failed to send message.");
      }
    } catch {
      toast.error("Failed to send message.");
    } finally {
      setIsSending(false);
    }
  };

  // Delete message
  const handleDeleteMessage = async (msgId: string) => {
    try {
      const res = await deleteChatMessageAction(msgId);
      if (res.success) {
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
        toast.success("Message deleted.");
      } else {
        toast.error(res.message || "Failed to delete message.");
      }
    } catch {
      toast.error("Failed to delete message.");
    }
  };

  // Debounced Patient Tag Search
  React.useEffect(() => {
    if (!patientSearchQuery.trim()) {
      setPatientSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingPatient(true);
      try {
        const results = await searchPatientsAction(patientSearchQuery);
        setPatientSearchResults(results);
      } catch {
      } finally {
        setIsSearchingPatient(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [patientSearchQuery]);

  // Filter messages by local search query
  const filteredMessages = React.useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase().trim();
    return messages.filter(
      (m) =>
        m.content.toLowerCase().includes(q) ||
        m.senderName.toLowerCase().includes(q) ||
        (m.patientName && m.patientName.toLowerCase().includes(q)),
    );
  }, [messages, searchQuery]);

  // Active channel title & description
  const activeChannelMeta = React.useMemo(() => {
    const sys = SYSTEM_CHANNELS.find((c) => c.id === activeChannel);
    if (sys) return sys;

    return {
      id: activeChannel,
      name: `#${activeChannel.toLowerCase()}`,
      description: "Channel conversation",
      icon: MessageSquare,
      badgeColor: "bg-muted text-foreground border-border",
    };
  }, [activeChannel]);

  return (
    <div className="space-y-2.5">
      {/* ---------------------------------------------------- */}
      {/* 1. Header Control Bar (Date, Status, Sound)          */}
      {/* ---------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 rounded-xl bg-card border border-border/80 shadow-2xs">
        {/* Left: Date Selector or Live Chat Indicator */}
        <div className="flex flex-wrap items-center gap-2">
          {showDateSelector ? (
            <DashboardDateSelector
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              onRefresh={() => fetchMessages(selectedDate, activeChannel)}
              isRefreshing={isLoadingMessages}
            />
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary font-bold text-xs">
                <MessageSquare className="size-3.5" />
                <span>Clinic Communication</span>
              </div>
            </div>
          )}

          {/* Active Day Indicator */}
          {selectedDate !== todayStr && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-[10.5px] font-mono font-bold flex items-center gap-1">
              <Calendar className="size-3" />
              <span>Browsing History: {selectedDate}</span>
            </span>
          )}
        </div>

        {/* Right: Sound toggle, SSE status & Performer identity */}
        <div className="flex items-center gap-2 justify-between sm:justify-end">
          {/* Performer switcher for desk roles */}
          {performers.length > 1 && (
            <div className="flex items-center gap-1.5 bg-muted/40 border border-border/70 rounded-lg px-2 py-1">
              <ShieldCheck className="size-3 text-sky-500 shrink-0" />
              <span className="text-[10px] text-muted-foreground font-semibold">Author:</span>
              <Select
                value={authorPerformerId}
                onValueChange={(val) => {
                  if (val) setAuthorPerformerId(val);
                }}
              >
                <SelectTrigger className="h-5.5 text-[11px] font-semibold bg-transparent border-0 p-0 shadow-none focus:ring-0">
                  <SelectValue placeholder="Staff" />
                </SelectTrigger>
                <SelectContent>
                  {performers.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Connection status badge */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 border border-border/60 text-[10.5px] font-mono">
            <span
              className={`size-1.5 rounded-full ${
                connectionStatus === "connected"
                  ? "bg-emerald-500 animate-pulse"
                  : "bg-amber-500"
              }`}
            />
            <span className="text-muted-foreground capitalize">
              {connectionStatus === "connected" ? "Realtime Live" : "Syncing"}
            </span>
          </div>

          {/* Sound Mute Toggle */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsMuted((prev) => !prev)}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            title={isMuted ? "Unmute message chime" : "Mute message chime"}
          >
            {isMuted ? (
              <VolumeX className="size-3.5 text-muted-foreground" />
            ) : (
              <Volume2 className="size-3.5 text-emerald-500" />
            )}
          </Button>

          {/* Mobile Channels Toggle */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
            className="h-7 px-2 text-xs md:hidden flex items-center gap-1 border-border/80"
          >
            <Menu className="size-3.5" />
            <span>Channels</span>
          </Button>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. Main Chat Layout (Channels Sidebar + Stream)      */}
      {/* ---------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 h-[calc(100vh-250px)] min-h-[520px]">
        {/* Left Sidebar: Channels & Staff Direct Messages */}
        <Card
          className={`md:col-span-4 lg:col-span-3 border-border/80 bg-card/95 shadow-2xs flex flex-col overflow-hidden ${
            isMobileSidebarOpen
              ? "fixed inset-x-3 top-20 bottom-4 z-50 md:relative md:inset-auto md:z-auto"
              : "hidden md:flex"
          }`}
        >
          {/* Sidebar Header */}
          <CardHeader className="p-2.5 pb-2 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="size-3.5 text-primary" />
              <CardTitle className="text-xs font-bold text-foreground">
                Clinic Channels
              </CardTitle>
            </div>
            {isMobileSidebarOpen && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileSidebarOpen(false)}
                className="h-6 w-6 p-0 md:hidden"
              >
                <X className="size-3.5" />
              </Button>
            )}
          </CardHeader>

          <CardContent className="p-2 flex-1 overflow-y-auto space-y-3">
            {/* Department Channels List */}
            <div className="space-y-1">
              <div className="px-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Clinic Channels
              </div>
              {SYSTEM_CHANNELS.map((ch) => {
                const Icon = ch.icon;
                const isActive = activeChannel === ch.id;
                const unread = unreadCounts[ch.id] || 0;

                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => handleSwitchChannel(ch.id)}
                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Icon className="size-3.5 shrink-0" />
                      <span className="truncate">{ch.name}</span>
                    </div>
                    {unread > 0 && !isActive && (
                      <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9.5px] font-bold font-mono">
                        {unread}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Right Main Pane: Active Conversation Stream & Composer */}
        <Card className="md:col-span-8 lg:col-span-9 border-border/80 bg-card/90 shadow-2xs flex flex-col overflow-hidden">
          {/* Conversation Header */}
          <CardHeader className="p-2.5 pb-2 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between space-y-0 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <activeChannelMeta.icon className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-bold text-foreground truncate">
                    {activeChannelMeta.name}
                  </h3>
                  <span
                    className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-full border ${activeChannelMeta.badgeColor}`}
                  >
                    {selectedDate}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">
                  {activeChannelMeta.description}
                </p>
              </div>
            </div>

            {/* Filter Search inside Channel */}
            <div className="relative w-36 sm:w-48 shrink-0">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="pl-6.5 h-6.5 text-[11px] bg-background"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-2.5" />
                </button>
              )}
            </div>
          </CardHeader>

          {/* Messages Stream */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[280px]"
          >
            {isLoadingMessages ? (
              <div className="h-full flex flex-col items-center justify-center space-y-2 text-muted-foreground py-16">
                <Loader2 className="size-6 animate-spin text-primary" />
                <span className="text-xs">Loading messages for {selectedDate}...</span>
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center space-y-2 text-muted-foreground py-16 text-center">
                <div className="size-10 rounded-full bg-muted/60 flex items-center justify-center">
                  <MessageSquare className="size-5 text-muted-foreground" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-foreground">
                    No messages yet on {selectedDate}
                  </h4>
                  <p className="text-[11px] max-w-xs text-muted-foreground">
                    Start the conversation in {activeChannelMeta.name}. Messages are saved
                    cleanly by date.
                  </p>
                </div>
              </div>
            ) : (
              filteredMessages.map((msg) => {
                const isMe = isMessageFromMe(msg);
                const canDelete = isMe || currentUserRole === Role.ADMIN;
                const timeStr = new Date(msg.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2 group ${
                      isMe ? "justify-end" : "justify-start"
                    }`}
                  >
                    {!isMe && (
                      <div className="size-7 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                        {msg.senderName.charAt(0)}
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] sm:max-w-[70%] space-y-1 rounded-xl p-2.5 shadow-2xs border ${
                        msg.isUrgent
                          ? "bg-rose-500/10 border-rose-500/40 text-foreground"
                          : isMe
                            ? "bg-primary text-primary-foreground border-primary/90"
                            : "bg-muted/40 border-border/80 text-foreground"
                      }`}
                    >
                      {/* Sender Identity & Badges */}
                      <div
                        className={`flex items-center gap-1.5 flex-wrap text-[10px] ${
                          isMe ? "text-primary-foreground/80" : "text-muted-foreground"
                        }`}
                      >
                        <span className="font-bold">{msg.senderName}</span>
                        <span
                          className={`px-1 py-0.1 rounded font-mono text-[9px] ${
                            isMe
                              ? "bg-white/20 text-white"
                              : "bg-muted text-muted-foreground border border-border/70"
                          }`}
                        >
                          {msg.senderRole}
                        </span>

                        {msg.isUrgent && (
                          <span className="px-1.5 py-0.1 rounded bg-rose-600 text-white font-black text-[9px] uppercase tracking-wider animate-pulse flex items-center gap-0.5">
                            <AlertTriangle className="size-2.5" />
                            URGENT
                          </span>
                        )}

                        <span className="ml-auto font-mono text-[9px]">
                          {timeStr}
                        </span>
                      </div>

                      {/* Tagged Patient / Room Badges */}
                      {(msg.patientName || msg.roomNumber) && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          {msg.patientName && (
                            <span
                              className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded border flex items-center gap-1 ${
                                isMe
                                  ? "bg-white/15 text-white border-white/20"
                                  : "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20"
                              }`}
                            >
                              <User className="size-2.5" />
                              <span>Patient: {msg.patientName}</span>
                            </span>
                          )}

                          {msg.roomNumber && (
                            <span
                              className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded border flex items-center gap-1 ${
                                isMe
                                  ? "bg-white/15 text-white border-white/20"
                                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                              }`}
                            >
                              <DoorOpen className="size-2.5" />
                              <span>Room {msg.roomNumber}</span>
                            </span>
                          )}
                        </div>
                      )}

                      {/* Message Content */}
                      <p className="text-xs whitespace-pre-wrap break-words leading-relaxed">
                        {msg.content}
                      </p>

                      {/* Delete Action on hover */}
                      {canDelete && (
                        <div className="flex justify-end pt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(msg.id)}
                            className={`text-[9.5px] flex items-center gap-0.5 transition-colors ${
                              isMe
                                ? "text-primary-foreground/70 hover:text-white"
                                : "text-muted-foreground hover:text-rose-500"
                            }`}
                          >
                            <Trash2 className="size-2.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Canned Clinical Suggestions */}
          <div className="px-2.5 py-1.5 border-t border-border/50 bg-muted/15 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[10px] font-bold text-muted-foreground shrink-0 flex items-center gap-0.5">
              <Sparkles className="size-2.5 text-primary" />
              Quick:
            </span>
            {CANNED_RESPONSES.map((txt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setMessageText(txt)}
                className="px-2 py-0.5 rounded-full bg-background border border-border/70 hover:border-primary text-muted-foreground hover:text-foreground text-[10.5px] whitespace-nowrap shrink-0 transition-colors"
              >
                {txt}
              </button>
            ))}
          </div>

          {/* Composer Form */}
          <form
            onSubmit={handleSendMessage}
            className="p-2.5 border-t border-border/60 bg-card space-y-2"
          >
            {/* Tag Attachments Pill Bar */}
            {(selectedPatientTag || selectedRoomNumber || isUrgent) && (
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                {isUrgent && (
                  <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[10.5px] font-bold flex items-center gap-1">
                    <AlertTriangle className="size-3" />
                    <span>Urgent Alert Active</span>
                    <button
                      type="button"
                      onClick={() => setIsUrgent(false)}
                      className="ml-1 text-rose-500 hover:text-rose-700"
                    >
                      <X className="size-2.5" />
                    </button>
                  </span>
                )}

                {selectedPatientTag && (
                  <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 text-[10.5px] font-bold flex items-center gap-1">
                    <User className="size-3" />
                    <span>{selectedPatientTag.name}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedPatientTag(null)}
                      className="ml-1 text-sky-500 hover:text-sky-700"
                    >
                      <X className="size-2.5" />
                    </button>
                  </span>
                )}

                {selectedRoomNumber && (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10.5px] font-bold flex items-center gap-1">
                    <DoorOpen className="size-3" />
                    <span>Room {selectedRoomNumber}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedRoomNumber("")}
                      className="ml-1 text-emerald-500 hover:text-emerald-700"
                    >
                      <X className="size-2.5" />
                    </button>
                  </span>
                )}
              </div>
            )}

            {/* Input Row */}
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder={`Message in ${activeChannelMeta.name}...`}
                className={`flex-1 h-9 text-xs bg-background transition-all ${
                  isUrgent ? "border-rose-500 focus-visible:ring-rose-500" : ""
                }`}
                autoFocus
              />

              {/* Tag Patient Button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPatientTagDialogOpen(true)}
                className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0 border-border/80"
                title="Tag Patient"
              >
                <Tag className="size-3.5" />
                <span className="hidden sm:inline ml-1">Patient</span>
              </Button>

              {/* Tag Room Selector */}
              <div className="w-28 sm:w-36 shrink-0">
                <Select
                  value={selectedRoomNumber || "none"}
                  onValueChange={(val) => {
                    setSelectedRoomNumber(val === "none" ? "" : val || "");
                  }}
                >
                  <SelectTrigger className="h-9 text-xs bg-background border-border/80 truncate">
                    <SelectValue placeholder="Room" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value="none" className="text-xs">
                      No Room
                    </SelectItem>
                    {clinicRooms.map((r) => (
                      <SelectItem key={r.number} value={r.number} className="text-xs">
                        Room {r.number} {r.purpose ? `(${r.purpose})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Toggle Urgent */}
              <Button
                type="button"
                variant={isUrgent ? "destructive" : "outline"}
                size="sm"
                onClick={() => setIsUrgent((prev) => !prev)}
                className={`h-9 px-2 text-xs shrink-0 ${
                  isUrgent
                    ? "font-bold"
                    : "text-muted-foreground hover:text-rose-500 border-border/80"
                }`}
                title="Mark Urgent Alert"
              >
                <AlertTriangle className="size-3.5" />
              </Button>

              {/* Send Button */}
              <Button
                type="submit"
                disabled={!messageText.trim() || isSending}
                size="sm"
                className="h-9 px-3.5 text-xs font-bold gap-1 bg-primary text-primary-foreground shrink-0"
              >
                {isSending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                <span className="hidden sm:inline">Send</span>
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 3. Patient Tag Search Modal                          */}
      {/* ---------------------------------------------------- */}
      <Dialog
        open={isPatientTagDialogOpen}
        onOpenChange={setIsPatientTagDialogOpen}
      >
        <DialogContent className="sm:max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <User className="size-4 text-primary" />
              <span>Reference / Tag Patient in Message</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
              <Input
                type="search"
                value={patientSearchQuery}
                onChange={(e) => setPatientSearchQuery(e.target.value)}
                placeholder="Search patient name, phone, MRN..."
                className="pl-7 h-8 text-xs bg-background"
                autoFocus
              />
              {isSearchingPatient && (
                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3 animate-spin text-muted-foreground" />
              )}
            </div>

            <div className="max-h-56 overflow-y-auto rounded-lg border border-border/80 bg-card p-1 space-y-1">
              {patientSearchResults.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  {patientSearchQuery.trim()
                    ? "No patients matched search query."
                    : "Type a patient name or phone to tag."}
                </div>
              ) : (
                patientSearchResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedPatientTag(p);
                      setIsPatientTagDialogOpen(false);
                      setPatientSearchQuery("");
                    }}
                    className="w-full text-left p-2 rounded hover:bg-muted text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-semibold text-foreground">{p.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-1.5 font-mono">
                        ({p.gender}, {p.phone})
                      </span>
                    </div>
                    {p.mrn && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {p.mrn}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPatientTagDialogOpen(false)}
                className="h-8 text-xs"
              >
                Close
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
