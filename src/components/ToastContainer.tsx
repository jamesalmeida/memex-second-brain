import React from 'react';
import { observer } from '@legendapp/state/react';
import Toast from './Toast';
import { toastStore, toastActions } from '../stores/toast';
import { themeStore } from '../stores/theme';

export const ToastContainer: React.FC = observer(() => {
  const visible = toastStore.visible.get();
  const message = toastStore.message.get();
  const type = toastStore.type.get();
  const isDarkMode = themeStore.isDarkMode.get();

  // Don't render if not visible or no message
  if (!visible || !message || typeof message !== 'string' || message === '') {
    return null;
  }

  return (
    <Toast
      message={message}
      type={type}
      isDarkMode={isDarkMode}
      onDismiss={toastActions.hide}
    />
  );
});
