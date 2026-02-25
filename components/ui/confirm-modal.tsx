'use client';

import { useState } from 'react';
import Modal from './modal';
import Button from './button';
import { AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react';

export type ConfirmType = 'danger' | 'success' | 'warning' | 'info';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  type?: ConfirmType;
  confirmText?: string;
  cancelText?: string;
}

const typeConfig = {
  danger: {
    confirmButton: 'bg-error! hover:bg-error/90! text-white',
    icon: AlertTriangle,
    iconColor: 'text-error',
    bgColor: 'bg-error/10',
  },
  success: {
    confirmButton: 'bg-success! hover:bg-success/90! text-white',
    icon: CheckCircle,
    iconColor: 'text-success',
    bgColor: 'bg-success/10',
  },
  warning: {
    confirmButton: 'bg-warning! hover:bg-warning/90! text-white',
    icon: AlertCircle,
    iconColor: 'text-warning',
    bgColor: 'bg-warning/10',
  },
  info: {
    confirmButton: 'bg-info! hover:bg-info/90! text-white',
    icon: Info,
    iconColor: 'text-info',
    bgColor: 'bg-info/10',
  },
};

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'danger',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
}: ConfirmModalProps) {
  const config = typeConfig[type];
  const IconComponent = config.icon;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title={title}
      size="sm"
      footer={
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleCancel} className="flex-1">
            {cancelText}
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            className={`flex-1 ${config.confirmButton}`}
          >
            {confirmText}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className={`w-16 h-16 rounded-full ${config.bgColor} flex items-center justify-center`}
        >
          <IconComponent size={32} className={config.iconColor} />
        </div>
        <p className="text-secondary text-base leading-relaxed">{message}</p>
      </div>
    </Modal>
  );
}

// Utility hook for using confirm modal
export function useConfirmModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [resolvePromise, setResolvePromise] = useState<
    ((value: boolean) => void) | null
  >(null);
  const [config, setConfig] = useState<{
    title: string;
    message: string;
    type?: ConfirmType;
    confirmText?: string;
    cancelText?: string;
  }>({
    title: '',
    message: '',
  });

  const confirm = (options: {
    title: string;
    message: string;
    type?: ConfirmType;
    confirmText?: string;
    cancelText?: string;
  }): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfig(options);
      setResolvePromise(() => resolve);
      setIsOpen(true);
    });
  };

  const handleConfirm = () => {
    setIsOpen(false);
    if (resolvePromise) {
      resolvePromise(true);
      setResolvePromise(null);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    if (resolvePromise) {
      resolvePromise(false);
      setResolvePromise(null);
    }
  };

  const modalProps = {
    isOpen,
    onClose: handleClose,
    onConfirm: handleConfirm,
    ...config,
  };

  return {
    confirm,
    modalProps,
  };
}
