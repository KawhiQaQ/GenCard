declare module 'ali-oss' {
  interface OSSOptions {
    region: string;
    endpoint?: string;
    accessKeyId: string;
    accessKeySecret: string;
    bucket: string;
    secure?: boolean;
    timeout?: number;
  }

  interface PutOptions {
    headers?: Record<string, string>;
    mime?: string;
    meta?: Record<string, string>;
    callback?: object;
  }

  interface PutResult {
    name: string;
    url: string;
    res: {
      status: number;
      statusCode: number;
      headers: Record<string, string>;
    };
  }

  class OSS {
    constructor(options: OSSOptions);
    put(name: string, file: Buffer | string, options?: PutOptions): Promise<PutResult>;
    delete(name: string): Promise<{ res: { status: number } }>;
    get(name: string): Promise<{ content: Buffer; res: { status: number } }>;
    signatureUrl(name: string, options?: { expires?: number }): string;
  }

  export = OSS;
}
