'use client';

import React, { createContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { Timestamp } from 'firebase/firestore';

export type Role = 'admin' | 'staff' | 'client';

export interface UserDoc {
  uid: string;
  email: string;
  displayName?: string;
  role: Role;
  photoURL: string | null;
  createdAt?: Timestamp;
  [key: string]: unknown;
}

export interface AuthContextValue {
  user: User | null;
  userDoc: UserDoc | null;
  role: Role | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (snap.exists()) {
            const data = snap.data() as UserDoc;
            setUserDoc(data);
            setRole(data.role ?? 'staff');
          } else {
            // Check if this is the first user in the system
            const usersQuery = query(collection(db, 'users'), limit(1));
            const usersSnap = await getDocs(usersQuery);
            
            // Designated superadmins are always boosted to admin if missing.
            // Other users default to staff to stay consistent with strict security rules.
            const ADMIN_WHITELIST = ['paulinexu6@gmail.com', 'techcesstechnology@gmail.com'];
            const isSuperAdmin = ADMIN_WHITELIST.includes(firebaseUser.email ?? '');
            const newRole: Role = isSuperAdmin ? 'admin' : 'staff';

            const newUserData: UserDoc = {
              uid: firebaseUser.uid,
              email: firebaseUser.email ?? '',
              displayName: firebaseUser.displayName ?? '',
              role: newRole,
              photoURL: firebaseUser.photoURL ?? null,
              createdAt: serverTimestamp() as unknown as Timestamp,
            };

            await setDoc(doc(db, 'users', firebaseUser.uid), newUserData);
            setUserDoc(newUserData);
            setRole(newRole);
          }
        } catch (err) {
          console.error('[AuthContext] Error syncing user profile:', err);
          setUserDoc(null);
          setRole(null);
        }
      } else {
        setUser(null);
        setUserDoc(null);
        setRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  return (
    <AuthContext.Provider
      value={{ user, userDoc, role, loading, signIn, signOut, signInWithGoogle }}
    >
      {children}
    </AuthContext.Provider>
  );
}
