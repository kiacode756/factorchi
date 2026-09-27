import { Invoice, Profile, RealtimeNotification, SubscriptionRequest } from '../types';

type RealtimeEventHandler = (event: { id?: string; type: string; payload: any; targetUserId?: string; timestamp: string }) => void;

class RealtimeService {
  private eventSource: EventSource | null = null;
  private listeners: Set<RealtimeEventHandler> = new Set();
  private isConnected = false;
  private currentUserId: string | null = null;
  private reconnectTimer: any = null;
  private pollTimer: any = null;
  private statusListeners: Set<(connected: boolean) => void> = new Set();
  private processedEventIds: Set<string> = new Set();
  private lastPollTimestamp = new Date(Date.now() - 30000).toISOString();
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('factorchi_realtime_channel');
        this.broadcastChannel.onmessage = (msgEvent) => {
          if (msgEvent.data && msgEvent.data.type) {
            // Isolate cross-tab messages to the matching user only
            if (
              msgEvent.data.targetUserId &&
              this.currentUserId &&
              msgEvent.data.targetUserId !== this.currentUserId
            ) {
              return;
            }
            this.handleIncomingEvent(msgEvent.data, false);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel not supported:', e);
      }
    }
  }

  public subscribe(handler: RealtimeEventHandler): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  public onStatusChange(handler: (connected: boolean) => void): () => void {
    this.statusListeners.add(handler);
    handler(this.isConnected);
    return () => {
      this.statusListeners.delete(handler);
    };
  }

  private setConnectionStatus(status: boolean) {
    if (this.isConnected !== status) {
      this.isConnected = status;
      this.statusListeners.forEach((fn) => {
        try {
          fn(status);
        } catch (e) {
          console.error('Status listener error:', e);
        }
      });
    }
  }

  public connect(userId: string) {
    if (this.currentUserId === userId && this.eventSource && this.eventSource.readyState !== EventSource.CLOSED) {
      return;
    }

    this.disconnect();
    this.currentUserId = userId;

    if (typeof window === 'undefined') return;

    try {
      const streamUrl = `/api/realtime/stream?userId=${encodeURIComponent(userId)}`;
      const es = new EventSource(streamUrl);
      this.eventSource = es;

      es.onopen = () => {
        this.setConnectionStatus(true);
      };

      es.addEventListener('connected', () => {
        this.setConnectionStatus(true);
      });

      es.addEventListener('ping', () => {
        this.setConnectionStatus(true);
      });

      // Standard message handler
      es.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          this.setConnectionStatus(true);
          this.handleIncomingEvent(parsed, true);
        } catch (err) {
          console.warn('Realtime SSE message parse warning:', err);
        }
      };

      es.addEventListener('message', (e: any) => {
        try {
          const parsed = JSON.parse(e.data);
          this.setConnectionStatus(true);
          this.handleIncomingEvent(parsed, true);
        } catch (err) {
          console.warn('Realtime SSE event parse warning:', err);
        }
      });

      es.onerror = () => {
        this.setConnectionStatus(false);
        if (es.readyState === EventSource.CLOSED) {
          this.scheduleReconnect();
        }
      };
    } catch (e) {
      console.warn('EventSource initialization error:', e);
      this.setConnectionStatus(false);
      this.scheduleReconnect();
    }

    // High-frequency dual fallback poll (every 3.5s)
    this.startBackupPoll();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (this.currentUserId) {
        this.connect(this.currentUserId);
      }
    }, 3000);
  }

  private startBackupPoll() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    // Intelligent backup poll: Only poll if SSE is NOT currently connected, and tab is visible
    this.pollTimer = setInterval(async () => {
      if (!this.currentUserId) return;
      if (typeof document !== 'undefined' && document.hidden) return; // Pause while tab is inactive
      if (this.isConnected && this.eventSource && this.eventSource.readyState === EventSource.OPEN) {
        return; // SSE is actively connected and streaming; skip redundant HTTP polling!
      }
      try {
        const url = `/api/realtime/poll?userId=${encodeURIComponent(this.currentUserId)}&since=${encodeURIComponent(this.lastPollTimestamp)}`;
        const res = await fetch(url, {
          headers: { 'x-user-id': this.currentUserId },
        });
        if (res.ok) {
          const data = await res.json();
          this.setConnectionStatus(true);
          if (data.timestamp) {
            this.lastPollTimestamp = data.timestamp;
          }
          if (data.events && Array.isArray(data.events) && data.events.length > 0) {
            data.events.forEach((ev: any) => this.handleIncomingEvent(ev, true));
          }
        }
      } catch {
        // quiet fallback
      }
    }, 8000);
  }

  private handleIncomingEvent(event: { id?: string; type: string; payload: any; targetUserId?: string; timestamp: string }, broadcastToOtherTabs = true) {
    if (event.id) {
      if (this.processedEventIds.has(event.id)) {
        return; // already processed
      }
      this.processedEventIds.add(event.id);
      if (this.processedEventIds.size > 200) {
        const arr = Array.from(this.processedEventIds);
        this.processedEventIds = new Set(arr.slice(-100));
      }
    }

    // Ignore if targeted to another user
    if (event.targetUserId && this.currentUserId && event.targetUserId !== this.currentUserId) {
      return;
    }

    // Forward to other browser tabs with targetUserId attached
    if (broadcastToOtherTabs && this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          ...event,
          targetUserId: event.targetUserId || this.currentUserId || undefined,
        });
      } catch (e) {
        // ignore
      }
    }

    // Notify all local listeners
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('Realtime listener error:', err);
      }
    });
  }

  public publishLocal(type: string, payload: any, targetUserId?: string) {
    const event = {
      id: `local-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      type,
      payload,
      targetUserId: targetUserId || this.currentUserId || undefined,
      timestamp: new Date().toISOString(),
    };
    this.handleIncomingEvent(event, true);
  }

  public disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.setConnectionStatus(false);
    this.currentUserId = null;
  }
}

export const realtime = new RealtimeService();
