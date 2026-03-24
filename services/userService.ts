import { db, auth } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'staff';
  createdAt: any;
}

export const bootstrapAdmin = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.email) return;

  // The owner email (from context) is the only one who can bootstrap themselves as admin
  const OWNER_EMAIL = "holaestudiokm@gmail.com";
  
  if (currentUser.email === OWNER_EMAIL) {
    const userRef = doc(db, 'users', currentUser.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      console.log('Bootstrapping admin user...');
      await setDoc(userRef, {
        uid: currentUser.uid,
        email: currentUser.email,
        role: 'admin',
        createdAt: serverTimestamp()
      });
      console.log('Admin user bootstrapped successfully.');
    }
  }
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    return userSnap.data() as UserProfile;
  }
  return null;
};
