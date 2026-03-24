import React, { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

interface LoginProps {
  onLoginSuccess: () => void;
  onClose: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      onLoginSuccess();
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Email o contraseña incorrectos. Verificá que el usuario esté creado en la consola de Firebase.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Demasiados intentos fallidos. Por favor, intentá más tarde.');
      } else {
        setError('Error de conexión. Verificá tu configuración de Firebase.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-luxury-black border border-stone-800 p-8 md:p-12 shadow-2xl rounded-sm animate-fadeInUp">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-serif text-gold mb-2 tracking-widest uppercase">Acceso Gestión</h2>
          <p className="text-stone-500 text-xs uppercase tracking-[0.3em]">Don García</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-stone-400 font-bold mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-stone-900/50 border border-stone-800 px-4 py-3 text-white focus:outline-none focus:border-gold transition-colors"
              placeholder="admin@dongarcia.com"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-stone-400 font-bold mb-2">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-stone-900/50 border border-stone-800 px-4 py-3 text-white focus:outline-none focus:border-gold transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-4 text-xs font-bold uppercase tracking-widest">
              {error}
            </div>
          )}

          <div className="pt-4 flex flex-col gap-4">
            <button
              type="submit"
              disabled={loading}
              className={`w-full bg-gold text-white py-4 font-black uppercase tracking-[0.3em] text-xs hover:bg-white hover:text-black transition-all shadow-lg ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Iniciando...' : 'Entrar'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full border border-stone-800 text-stone-500 py-4 font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-stone-800/30 transition-all"
            >
              Cancelar
            </button>
          </div>
        </form>
        
        <div className="mt-12 text-center">
          <p className="text-stone-600 text-[9px] uppercase tracking-widest leading-relaxed">
            Este panel es de uso exclusivo para el personal autorizado de Don García.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
