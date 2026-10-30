import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  type AddMembersRequest,
  addMembersRequestSchema,
  type ChatMessage,
  type ChatMessagePage,
  type Conversation,
  type ConversationPage,
  conversationIdParamSchema,
  type CreateGroupRequest,
  createGroupRequestSchema,
  type CursorPageQuery,
  cursorPageQuerySchema,
  memberParamSchema,
  messageIdParamSchema,
  type MessagesQuery,
  messagesQuerySchema,
  type RenameGroupRequest,
  renameGroupRequestSchema,
  type SendMessageRequest,
  sendMessageRequestSchema,
  type StartDirectChatRequest,
  startDirectChatRequestSchema,
} from '@ruet-chottor/shared';
import type { Principal } from '../../core/auth/access-token.store.js';
import { CurrentUser } from '../../core/auth/decorators.js';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe.js';
import { ChatService } from './chat.service.js';

/**
 * Every route needs a logged-in member (global AuthGuard); membership is checked in the service.
 * Live delivery is in chat.gateway.ts; sending over HTTP is the fallback when the socket is down.
 */
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('conversations')
  list(
    @CurrentUser() principal: Principal,
    @Query(new ZodValidationPipe(cursorPageQuerySchema)) query: CursorPageQuery,
  ): Promise<ConversationPage> {
    return this.chat.list(principal.userId, query);
  }

  @Post('conversations/direct')
  startDirect(
    @CurrentUser() principal: Principal,
    @Body(new ZodValidationPipe(startDirectChatRequestSchema)) body: StartDirectChatRequest,
  ): Promise<Conversation> {
    return this.chat.startDirect(principal.userId, body.userId);
  }

  @Post('conversations/group')
  createGroup(
    @CurrentUser() principal: Principal,
    @Body(new ZodValidationPipe(createGroupRequestSchema)) body: CreateGroupRequest,
  ): Promise<Conversation> {
    return this.chat.createGroup(principal.userId, body);
  }

  @Get('conversations/:id')
  get(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(conversationIdParamSchema)) params: { id: string },
  ): Promise<Conversation> {
    return this.chat.get(principal.userId, params.id);
  }

  @Patch('conversations/:id')
  rename(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(conversationIdParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(renameGroupRequestSchema)) body: RenameGroupRequest,
  ): Promise<Conversation> {
    return this.chat.rename(principal.userId, params.id, body.name);
  }

  @Post('conversations/:id/members')
  addMembers(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(conversationIdParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(addMembersRequestSchema)) body: AddMembersRequest,
  ): Promise<Conversation> {
    return this.chat.addMembers(principal.userId, params.id, body);
  }

  @Delete('conversations/:id/members/:userId')
  @HttpCode(204)
  removeMember(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(memberParamSchema)) params: { id: string; userId: string },
  ): Promise<void> {
    return this.chat.removeMember(principal.userId, params.id, params.userId);
  }

  @Get('conversations/:id/messages')
  messages(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(conversationIdParamSchema)) params: { id: string },
    @Query(new ZodValidationPipe(messagesQuerySchema)) query: MessagesQuery,
  ): Promise<ChatMessagePage> {
    return this.chat.messages(principal.userId, params.id, query);
  }

  @Post('conversations/:id/messages')
  send(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(conversationIdParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(sendMessageRequestSchema)) body: SendMessageRequest,
  ): Promise<ChatMessage> {
    return this.chat.send(principal.userId, params.id, body);
  }

  @Post('conversations/:id/read')
  @HttpCode(204)
  markRead(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(conversationIdParamSchema)) params: { id: string },
  ): Promise<void> {
    return this.chat.markRead(principal.userId, params.id);
  }

  @Delete('messages/:id')
  @HttpCode(204)
  deleteMessage(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(messageIdParamSchema)) params: { id: string },
  ): Promise<void> {
    return this.chat.deleteMessage(principal.userId, params.id);
  }
}
