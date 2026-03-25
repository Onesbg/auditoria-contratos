import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '@renderer/hooks/useAuthStore';

const schema = z.object({ email: z.string().email(), senha: z.string().min(4) });

export function LoginPage() {
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });
  const login = useAuthStore((s) => s.login);

  return <div className="login-wrap"><form className="login-box" onSubmit={handleSubmit(async (v) => login(v.email, v.senha))}>
    <h2>Login</h2>
    <label>Email<input {...register('email')} /></label>{errors.email && <small>{errors.email.message}</small>}
    <label>Senha<input type="password" {...register('senha')} /></label>{errors.senha && <small>{errors.senha.message}</small>}
    <button type="submit">Entrar</button>
    <p><small>admin@auditoria.local / admin123</small></p>
  </form></div>;
}
