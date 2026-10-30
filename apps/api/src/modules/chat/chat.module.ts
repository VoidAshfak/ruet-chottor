import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller.js';
import { ChatGateway } from './chat.gateway.js';
import { ChatModeration } from './chat-moderation.js';
import { ChatRealtime } from './chat-realtime.js';
import { ChatService } from './chat.service.js';

/** 1:1 and group messaging over HTTP and Socket.IO. See docs/modules/chat.md. */
@Module({
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, ChatRealtime, ChatModeration],
  exports: [ChatService],
})
export class ChatModule {}
