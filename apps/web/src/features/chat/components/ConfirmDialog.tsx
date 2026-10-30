'use client';

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
  onConfirm: () => void;
  onClose: () => void;
};

/** Every destructive chat action asks first (CLAUDE.md §9). */
export function ConfirmDialog(props: ConfirmDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && !props.pending && props.onClose()}>
      <DialogContent>
        <DialogTitle>{props.title}</DialogTitle>
        <DialogDescription>{props.body}</DialogDescription>
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
