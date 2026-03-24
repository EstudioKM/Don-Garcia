import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile } from '../../services/userService';

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        ...doc.data(),
        uid: doc.id
      })) as UserProfile[];
      setUsers(usersData);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching users:', err);
      setError('No tienes permisos para ver esta sección.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleRoleChange = async (uid: string, newRole: 'admin' | 'staff') => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        role: newRole
      });
    } catch (err) {
      console.error('Error updating role:', err);
      alert('Error al actualizar el rol.');
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (err) {
        console.error('Error deleting user:', err);
        alert('Error al eliminar el usuario.');
      }
    }
  };

  if (loading) return <div className="p-8 text-center text-gold">Cargando usuarios...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-serif text-gold tracking-widest uppercase">Usuarios y Roles</h2>
          <p className="text-stone-500 text-xs uppercase tracking-[0.2em] mt-2">Gestiona el acceso al panel administrativo</p>
        </div>
      </div>

      <div className="bg-stone-900/30 border border-stone-800 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-stone-800 bg-black/20">
              <th className="p-4 text-[10px] uppercase tracking-widest text-stone-500 font-bold">Email</th>
              <th className="p-4 text-[10px] uppercase tracking-widest text-stone-500 font-bold">Rol</th>
              <th className="p-4 text-[10px] uppercase tracking-widest text-stone-500 font-bold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-800/50">
            {users.map((user) => (
              <tr key={user.uid} className="hover:bg-white/5 transition-colors">
                <td className="p-4">
                  <div className="text-sm text-white font-medium">{user.email}</div>
                  <div className="text-[10px] text-stone-600 font-mono mt-1">{user.uid}</div>
                </td>
                <td className="p-4">
                  <select 
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.uid, e.target.value as 'admin' | 'staff')}
                    className="bg-stone-900 border border-stone-800 text-xs text-gold px-2 py-1 focus:outline-none focus:border-gold"
                  >
                    <option value="admin">Administrador</option>
                    <option value="staff">Personal</option>
                  </select>
                </td>
                <td className="p-4">
                  <button 
                    onClick={() => handleDeleteUser(user.uid)}
                    className="text-red-500 hover:text-red-400 text-xs uppercase tracking-widest font-bold"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-gold/5 border border-gold/20 p-6 rounded-sm">
        <h3 className="text-gold text-xs font-bold uppercase tracking-widest mb-2">Nota de Seguridad</h3>
        <p className="text-stone-400 text-[10px] leading-relaxed">
          Los usuarios deben registrarse primero en Firebase Authentication para poder ser gestionados aquí. 
          El primer administrador se crea automáticamente al iniciar sesión con el correo del propietario.
        </p>
      </div>
    </div>
  );
};

export default AdminUsers;
