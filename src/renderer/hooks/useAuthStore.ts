import { create } from 'zustand';

interface AuthState {
  user: any | null;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  login: async (email, senha) => {
    const user = await window.api.login({ email, senha });
    set({ user });
  },
  logout: () => set({ user: null })
}));
