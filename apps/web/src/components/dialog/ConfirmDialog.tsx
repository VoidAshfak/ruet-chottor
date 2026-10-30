'use client';

import type { ReactNode } from 'react';
import { FormError } from '@/components/form/FormError';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';

type ConfirmDialogProps = {
  title: string;
  body: string;
  confirm: string;
  cancel: string;
  pending: boolean;
  error?: string;
  /** Extra fields, e.g. a reason. */
  children?: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
};

/** Asks before any destructive action (CLAUDE.md §9). Text comes from the caller's help.ts. */
export function ConfirmDialog(props: ConfirmDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && !props.pending && props.onClose()}>
      <DialogContent>
        <DialogTitle>{props.title}</DialogTitle>
        <DialogDescription>{props.body}</DialogDescription>
        {props.children}
        <FormError message={props.error} />
        <DialogFooter>
          <Button variant="outline" disabled={props.pending} onClick={props.onClose}>
            {props.cancel}
          </Button>
          <Button variant="destructive" disabled={props.pending} onClick={props.onConfirm}>
            {props.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
