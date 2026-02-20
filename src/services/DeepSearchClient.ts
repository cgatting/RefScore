export interface DeepSearchRefineResponse {
  processedText: string;
  bibliographyText: string;
  bibtex: string;
}

export type ProgressCallback = (percent: number, message: string) => void;

export class DeepSearchClient {
  private baseUrl: string;
  private wsUrl: string;

  private buildBody(manuscriptText: string, options?: { maxResults?: number, noCache?: boolean }) {
    const body: Record<string, any> = { manuscriptText };
    if (options?.maxResults && options.maxResults > 0) {
      body.maxResults = options.maxResults;
    }
    if (options?.noCache === undefined) {
      body.noCache = true;
    } else {
      body.noCache = !!options.noCache;
    }
    return body;
  }

  constructor(baseUrl?: string) {
    if (baseUrl) {
      this.baseUrl = baseUrl;
    } else if (import.meta.env.VITE_DEEPSEARCH_API_URL) {
      this.baseUrl = import.meta.env.VITE_DEEPSEARCH_API_URL as string;
    } else {
      this.baseUrl = "";
    }

    if (this.baseUrl.startsWith('http')) {
      this.wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/ws';
    } else if (this.baseUrl === "") {
        // Relative path, construct absolute WS URL based on current location
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.wsUrl = `${protocol}//${window.location.host}/ws`;
    } else {
        // Fallback or assuming baseUrl is just a path like "/api"
         const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
         this.wsUrl = `${protocol}//${window.location.host}${this.baseUrl}/ws`;
    }
  }

  public async refineDocument(manuscriptText: string, onProgress?: ProgressCallback, options?: { maxResults?: number, noCache?: boolean }): Promise<DeepSearchRefineResponse> {
    let socket: WebSocket | null = null;

    if (onProgress) {
      try {
        socket = new WebSocket(this.wsUrl);
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'progress') {
              onProgress(data.progress * 100, data.message);
            } else if (data.type === 'error') {
              console.error("DeepSearch Error:", data.message);
            }
          } catch (e) {
            console.warn("Failed to parse WS message:", event.data);
          }
        };
        
        // Wait for connection to open
        await new Promise<void>((resolve) => {
          if (!socket) return resolve();
          if (socket.readyState === WebSocket.OPEN) return resolve();
          socket.onopen = () => resolve();
          // Timeout after 2s if WS fails, proceed anyway
          setTimeout(resolve, 2000); 
        });
      } catch (e) {
        console.warn("WebSocket connection failed, proceeding without progress updates", e);
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.buildBody(manuscriptText, options))
      });

      if (!response.ok) {
        let message = `DeepSearch API Error: ${response.status} ${response.statusText}`;
        try {
          const data = await response.json();
          if (data?.detail) {
            message = `DeepSearch API Error: ${data.detail}`;
          }
        } catch {
        }
        throw new Error(message);
      }

      return await response.json();
    } finally {
      if (socket) {
        socket.close();
      }
    }
  }
}
