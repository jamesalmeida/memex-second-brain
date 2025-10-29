import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import Toast, { ToastType } from '../components/Toast';
import { themeStore } from '../stores/theme';
import { observer } from '@legendapp/state/react';

interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (options: ToastOptions) => string; // Returns toast ID
  dismissToast: (id: string) => void;
  dismissAllToasts: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastItem extends ToastOptions {
  id: string;
}

export const ToastProvider = observer(({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const isDarkMode = themeStore.isDarkMode.get();

  const showToast = useCallback((options: ToastOptions) => {
    const id = Date.now().toString();
    const newToast: ToastItem = {
      id,
      ...options,
    };

    setToasts((prev) => [...prev, newToast]);

    // Auto-remove after duration + animation time
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, (options.duration || 2500) + 500); // Add 500ms buffer for exit animation

    return id; // Return the ID so callers can dismiss it later
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const dismissAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const handleDismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast, dismissAllToasts }}>
      {children}
      <View style={styles.toastContainer} pointerEvents="box-none">
        {toasts.map((toast, index) => (
          <View
            key={toast.id}
            style={[
              styles.toastWrapper,
              { top: index * 70 }, // Stack toasts if multiple
            ]}
            pointerEvents="box-none"
          >
            <Toast
              message={toast.message}
              type={toast.type}
              duration={toast.duration}
              onDismiss={() => handleDismiss(toast.id)}
              isDarkMode={isDarkMode}
            />
          </View>
        ))}
      </View>
    </ToastContext.Provider>
  );
});

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  toastWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
