import { Button } from '@ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@ui/dialog';
import type { ReactNode } from 'react';

export type Props = {
  triggerText?: string;
  title?: string;
  description?: string;
  primaryButtonText?: string;
  onClickPrimaryButton?: () => void;
  secondaryButtonText?: string;
  onClickSecondaryButton?: () => void;
  tertiaryButtonText?: string;
  onClickTertiaryButton?: () => void;
  // 制御用
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // 任意トリガーを挿入したい場合
  triggerNode?: ReactNode;
};

/**shadcn/uiのDialogをラップしたコンポーネント */
const BasicDialog = (props: Props) => {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {/* triggerNode優先、次にtriggerText、未指定ならトリガー非表示 */}
      {props.triggerNode ? (
        <DialogTrigger asChild>{props.triggerNode}</DialogTrigger>
      ) : props.triggerText ? (
        <DialogTrigger>{props.triggerText}</DialogTrigger>
      ) : null}
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>{props.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {props.tertiaryButtonText && (
            <DialogClose asChild>
              <Button variant="outline" onClick={props.onClickTertiaryButton}>
                {props.tertiaryButtonText}
              </Button>
            </DialogClose>
          )}
          {props.secondaryButtonText && (
            <DialogClose asChild>
              <Button variant="outline" onClick={props.onClickSecondaryButton}>
                {props.secondaryButtonText}
              </Button>
            </DialogClose>
          )}
          {props.primaryButtonText && (
            // DialogCloseのonClickを外し、Button側にのみonClickを持たせる
            <DialogClose asChild>
              <Button onClick={props.onClickPrimaryButton}>
                {props.primaryButtonText}
              </Button>
            </DialogClose>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BasicDialog;
