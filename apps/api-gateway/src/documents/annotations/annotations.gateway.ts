import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseFilters, UsePipes, ValidationPipe } from '@nestjs/common';
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

// ── DTOs ────────────────────────────────────────────────────────────
export class JoinDocumentDto {
  @IsString()
  @IsNotEmpty()
  documentId!: string;
}

export class CursorMoveDto {
  @IsString()
  @IsNotEmpty()
  documentId!: string;

  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;
}

export class AddAnnotationDto {
  @IsString()
  @IsNotEmpty()
  documentId!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  // Add more annotation fields as per domain requirements
}

// ── Gateway ─────────────────────────────────────────────────────────

/**
 * WebSocket Gateway for Real-Time Document Annotations
 * 
 * Uses socket.io + Redis Adapter to support multi-instance broadcasting.
 * Clients join a specific document "room" to receive updates scoped to that document.
 */
@WebSocketGateway({
  cors: {
    origin: '*', // In production, replace with specific origins from ConfigService
    credentials: true,
  },
  namespace: '/annotations',
})
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AnnotationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AnnotationsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected via WebSocket: ${client.id}`);
    // Authentication logic could be inserted here (e.g. via client.handshake.auth.token)
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from WebSocket: ${client.id}`);
  }

  /**
   * Subscribes a client to a document's room to receive cursor/annotation updates.
   */
  @SubscribeMessage('join-document')
  async handleJoinDocument(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinDocumentDto,
  ): Promise<{ status: string; room: string }> {
    const room = `doc:${payload.documentId}`;
    
    await client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
    
    return { status: 'joined', room };
  }

  /**
   * Broadcasts cursor movement to everyone in the document room EXCEPT the sender.
   * Uses `client.broadcast.to(room)` intentionally to avoid echoing back.
   */
  @SubscribeMessage('cursor-move')
  handleCursorMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CursorMoveDto,
  ): void {
    const room = `doc:${payload.documentId}`;
    
    // Broadcast to the room, excluding the sender
    client.broadcast.to(room).emit('cursor-changed', {
      clientId: client.id,
      x: payload.x,
      y: payload.y,
    });
  }

  /**
   * Broadcasts a new annotation to everyone in the document room EXCEPT the sender.
   * Assuming the REST/GraphQL mutation creates it in DB, this provides the real-time feedback.
   */
  @SubscribeMessage('add-annotation')
  handleAddAnnotation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: AddAnnotationDto,
  ): void {
    const room = `doc:${payload.documentId}`;
    
    client.broadcast.to(room).emit('annotation-added', {
      clientId: client.id,
      ...payload,
    });
    
    this.logger.log(`New annotation added to room ${room} by ${client.id}`);
  }
}
