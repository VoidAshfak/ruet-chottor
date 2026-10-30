'use client';

import { CHAT_LIMITS, groupNameSchema } from '@ruet-chottor/shared';
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
import { useCreateGroup } from '../hooks/use-chat';
import { MemberPicker, type PickedMember } from './MemberPicker';

export function NewGroupDialog({ myId, onClose }: { myId: string; onClose: () => void }) {
  const router = useRouter();
  const create = useCreateGroup();
  const [name, setName] = useState('');
  const [members, setMembers] = useState<PickedMember[]>([]);
  const [error, setError] = useState<string>();
  const text = help.group.create;

  const submit = () => {
    const parsed = groupNameSchema.safeParse(name);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    if (members.length === 0) return setError(text.needMember);
    setError(undefined);
    create.mutate(
      { name: parsed.data, memberIds: members.map((m) => m.id) },
      { onSuccess: (conversation) => router.push(`/chat/${conversation.id}`) },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !create.isPending && onClose()}>
      <DialogContent>
        <DialogTitle>{text.title}</DialogTitle>
        <DialogDescription>{text.description}</DialogDescription>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="group-name">{text.name}</Label>
            <Input
              id="group-name"
              value={name}
              placeholder={text.namePlaceholder}
              maxLength={CHAT_LIMITS.groupNameMaxLength}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium">{text.members}</span>
              <InfoTip text={help.tips.groupMembers} label={text.membersTipLabel} />
            </div>
            <MemberPicker
              id="group-members"
              selected={members}
              onChange={setMembers}
              excludeIds={[myId]}
              max={CHAT_LIMITS.groupMaxMembers - 1}
            />
          </div>
          <FormError message={error ?? create.error?.message} />
          <DialogFooter>
            <Button type="button" variant="outline" disabled={create.isPending} onClick={onClose}>
              {text.cancel}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {text.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
