'use client';

import {
  CHAT_LIMITS,
  type ChatMember,
  type Conversation,
  groupNameSchema,
} from '@ruet-chottor/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FormError } from '@/components/form/FormError';
import { InfoTip } from '@/components/guide/InfoTip';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { help } from '../help';
import { useGroupActions } from '../hooks/use-chat';
import { ConfirmDialog } from './ConfirmDialog';
import { MemberPicker, type PickedMember } from './MemberPicker';

type Pending = { kind: 'remove'; member: ChatMember } | { kind: 'leave' };

/** Rename, add, remove (owner only) and leave (anyone). The server enforces the same rules. */
export function GroupSettingsDialog({
  conversation,
  myId,
  onClose,
}: {
  conversation: Conversation;
  myId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const actions = useGroupActions(conversation.id);
  const text = help.group.manage;
  const isOwner = conversation.myRole === 'owner';
  const [name, setName] = useState(conversation.name ?? '');
  const [nameError, setNameError] = useState<string>();
  const [adding, setAdding] = useState<PickedMember[]>([]);
  const [confirm, setConfirm] = useState<Pending | null>(null);
  const error =
    actions.rename.error?.message ?? actions.add.error?.message ?? actions.remove.error?.message;

  const rename = () => {
    const parsed = groupNameSchema.safeParse(name);
    if (!parsed.success) return setNameError(parsed.error.issues[0]?.message);
    setNameError(undefined);
    actions.rename.mutate(parsed.data);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogTitle>{text.title}</DialogTitle>
        <DialogDescription>{text.description}</DialogDescription>

        {isOwner ? (
          <form
            noValidate
            className="grid gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              rename();
            }}
          >
            <Label htmlFor="group-rename">{text.rename}</Label>
            <div className="flex gap-2">
              <Input
                id="group-rename"
                value={name}
                maxLength={CHAT_LIMITS.groupNameMaxLength}
                aria-invalid={nameError ? true : undefined}
                onChange={(event) => setName(event.target.value)}
              />
              <Button type="submit" variant="outline" disabled={actions.rename.isPending}>
                {text.save}
              </Button>
            </div>
            {nameError ? <p className="text-sm text-destructive">{nameError}</p> : null}
          </form>
        ) : null}

        <section aria-labelledby="group-members-heading" className="grid gap-2">
          <div className="flex items-center gap-1">
            <h3 id="group-members-heading" className="text-sm font-medium">
              {text.members} ({conversation.members.length})
            </h3>
            <InfoTip text={help.tips.groupMembers} label={help.group.create.membersTipLabel} />
          </div>
          <ul className="grid gap-1">
            {conversation.members.map((member) => (
              <li key={member.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                <span className="min-w-0 flex-1 break-words">{member.name}</span>
                {member.conversationRole === 'owner' ? (
                  <span className="text-xs text-muted-foreground">{text.owner}</span>
                ) : null}
                {isOwner && member.id !== myId ? (
                  <Button
                    size="xs"
                    variant="ghost"
                    aria-label={text.removeLabel(member.name)}
                    onClick={() => setConfirm({ kind: 'remove', member })}
                  >
                    {text.remove}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        {isOwner ? (
          <section className="grid gap-2">
            <div className="flex items-center gap-1">
              <h3 className="text-sm font-medium">{text.add}</h3>
              <InfoTip text={help.tips.newMembers} label={text.add} />
            </div>
            <MemberPicker
              id="group-add"
              selected={adding}
              onChange={setAdding}
              excludeIds={conversation.members.map((m) => m.id)}
              max={CHAT_LIMITS.groupMaxMembers - conversation.members.length}
            />
            {adding.length > 0 ? (
              <Button
                variant="outline"
                disabled={actions.add.isPending}
                onClick={() =>
                  actions.add.mutate(
                    adding.map((m) => m.id),
                    { onSuccess: () => setAdding([]) },
                  )
                }
              >
                {text.addSubmit}
              </Button>
            ) : null}
          </section>
        ) : null}

        <FormError message={error} />
        <DialogFooter>
          <Button variant="destructive" onClick={() => setConfirm({ kind: 'leave' })}>
            {text.leave}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {text.close}
          </Button>
        </DialogFooter>

        {confirm ? (
          <ConfirmDialog
            {...(confirm.kind === 'leave'
              ? text.confirmLeave
              : text.confirmRemove(confirm.member.name))}
            cancel={text.cancel}
            pending={actions.remove.isPending}
            error={actions.remove.error?.message}
            onClose={() => setConfirm(null)}
            onConfirm={() =>
              actions.remove.mutate(confirm.kind === 'leave' ? myId : confirm.member.id, {
                onSuccess: () => {
                  setConfirm(null);
                  if (confirm.kind === 'leave') router.push('/chat');
                },
              })
            }
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
