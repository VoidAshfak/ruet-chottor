import type { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions } from 'socket.io';

/**
 * Socket.IO on the API's HTTP server, limited to the web app's origin.
 * The origin check matters because the browser sends the session cookie with the handshake
 * (the socket equivalent of the HTTP origin check in core/http).
 */
export class SocketIoAdapter extends IoAdapter {
  constructor(
    app: INestApplication,
    private readonly webOrigin: string,
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    return super.createIOServer(port, {
      ...options,
      serveClient: false,
      cors: { origin: this.webOrigin, credentials: true },
      allowRequest: (req, callback) => callback(null, req.headers.origin === this.webOrigin),
    } as ServerOptions);
  }
}
