declare namespace chrome {
  namespace runtime {
    const lastError: { message?: string } | undefined;

    function sendMessage<TResponse = unknown>(
      message: unknown,
      callback?: (response: TResponse) => void
    ): void;

    function openOptionsPage(callback?: () => void): Promise<void>;

    const onMessage: {
      addListener(
        callback: (
          message: any,
          sender: unknown,
          sendResponse: (response?: unknown) => void
        ) => boolean | void
      ): void;
    };
  }

  namespace storage {
    interface StorageArea {
      get(keys: string, callback: (items: Record<string, unknown>) => void): void;
      set(items: Record<string, unknown>, callback?: () => void): void;
      remove(keys: string, callback?: () => void): void;
    }

    const local: StorageArea;
    const session: StorageArea | undefined;
  }

  namespace tabs {
    interface Tab {
      id?: number;
      url?: string;
      title?: string;
    }

    function query(queryInfo: Record<string, unknown>): Promise<Tab[]>;
    function get(tabId: number): Promise<Tab>;
    function update(tabId: number, updateProperties: { url?: string }): Promise<Tab | undefined>;

    function sendMessage<TResponse = unknown>(
      tabId: number,
      message: unknown,
      callback?: (response: TResponse) => void
    ): void;
  }

  namespace scripting {
    function executeScript(injection: {
      target: { tabId: number };
      files: string[];
    }): Promise<unknown[]>;
  }
}
