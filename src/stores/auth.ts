import { observable } from '@legendapp/state';
import { User } from '../types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  session: any | null;
}

const initialState: AuthState = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
  session: null,
};

export const authStore = observable(initialState);

// Computed values
export const authComputed = {
  isAuthenticated: () => authStore.isAuthenticated.get(),
  user: () => authStore.user.get(),
  isLoading: () => authStore.isLoading.get(),
  userId: () => authStore.user.get()?.id,
  userEmail: () => authStore.user.get()?.email,
};

// Actions
export const authActions = {
  setUser: (user: User | null) => {
    authStore.user.set(user);
    authStore.isAuthenticated.set(!!user);
  },

  setSession: (session: any) => {
    authStore.session.set(session);
  },

  setLoading: (loading: boolean) => {
    authStore.isLoading.set(loading);
  },

  reset: () => {
    authStore.set(initialState);
  },

  updateUser: (updates: Partial<User>) => {
    const currentUser = authStore.user.get();
    if (currentUser) {
      authStore.user.set({ ...currentUser, ...updates });
    }
  },
};
