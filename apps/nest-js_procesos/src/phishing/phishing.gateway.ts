import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: 'phishing',
})
/**
 * WebSocket gateway para eventos relacionados con phishing.
 * Emite notificaciones en tiempo real sobre registros añadidos/eliminados.
 */
export class PhishingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`📡 Cliente phishing conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`📡 Cliente phishing desconectado: ${client.id}`);
  }

  emitNuevoRegistro(registro: any) {
    this.server.emit('nuevo_registro', registro);
  }

  emitRegistroEliminado(id: number) {
    this.server.emit('registro_eliminado', { id });
  }

  emitTodosEliminados(eliminados: number) {
    this.server.emit('todos_eliminados', { eliminados });
  }
}
