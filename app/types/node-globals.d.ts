// Минимальные типы Node.js для React Native
declare global {
  namespace NodeJS {
    interface Timeout {}
  }

  interface Buffer {
    toString(encoding?: string): string;
    length: number;
  }

  var Buffer: {
    from(data: string | Uint8Array | number[], encoding?: string): Buffer;
    alloc(size: number): Buffer;
    isBuffer(obj: any): obj is Buffer;
  };

  namespace NodeJS {
    interface ProcessEnv {
      [key: string]: string | undefined;
      API_URL?: string;
    }

    interface Process {
      env: ProcessEnv;
    }
  }

  var process: NodeJS.Process;

  // Переопределение setTimeout и clearTimeout для React Native
  function setTimeout(callback: (...args: any[]) => void, ms: number): number;
  function clearTimeout(handle: number | NodeJS.Timeout | null | undefined): void;
  function setInterval(callback: (...args: any[]) => void, ms: number): number;
  function clearInterval(handle: number | NodeJS.Timeout | null | undefined): void;
}

export {};
