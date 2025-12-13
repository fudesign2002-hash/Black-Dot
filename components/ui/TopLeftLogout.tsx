import React, { useEffect, useRef, useState } from 'react';
import firebase from 'firebase/compat/app';
import { auth } from '../../firebase';
import { Mail, UserRoundCheck } from 'lucide-react';

interface Props {
  user?: firebase.User | null;
  onLogout?: () => void;
}

export default function TopLeftLogout({ user, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isSignedIn = Boolean(user && (user.providerData && user.providerData.length > 0));

  const avatarUrl = user ? (user.photoURL || (user.providerData && user.providerData[0] && (user.providerData[0] as any).photoURL) || null) : null;
  const [cachedAvatar, setCachedAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setCachedAvatar(null);
      return;
    }

    const key = `avatar:${user.uid}`;
    const TTL = 1000 * 60 * 60 * 24; // 24 hours

    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.data && parsed.ts && (Date.now() - parsed.ts) < TTL) {
          setCachedAvatar(parsed.data);
          return; // fresh cache present
        }
      }
    } catch (e) {
      // localStorage may be unavailable or parsing failed - continue to fetch
    }

    const sourceUrl = user.photoURL || (user.providerData && (user.providerData[0] as any)?.photoURL) || null;
    if (!sourceUrl) {
      setCachedAvatar(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(sourceUrl);
        if (!res.ok) return;
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          if (cancelled) return;
          const dataUrl = reader.result as string;
          setCachedAvatar(dataUrl);
          try {
            localStorage.setItem(key, JSON.stringify({ data: dataUrl, ts: Date.now() }));
          } catch (err) {
            // ignore storage errors
          }
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        // swallow fetch errors - leave cachedAvatar null
      }
    })();

    return () => { cancelled = true; };
  }, [user?.uid, user?.photoURL, user?.providerData]);

  const displayAvatar = cachedAvatar || avatarUrl || null;

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const handleLogout = async () => {
    setOpen(false);
    try {
      if (onLogout) {
        await onLogout();
        return;
      }
      await auth.signOut();
    } catch (e: any) {
      // [log removed] Sign out failed
      try {
        // fallback: try calling firebase auth directly
        const fb = (await import('firebase/compat/app')).default;
        if (fb && fb.auth) {
          await fb.auth().signOut();
        }
      } catch (err) {
        // [log removed] Fallback signOut also failed
      }
      alert('Logout failed. Check console for details.');
    }
  };

  const signInWithGoogle = async () => {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(provider);
      setShowOverlay(false);
      setOpen(false);
    } catch (e) {
      // ignore
    }
  };

  const signInWithEmail = async () => {
    // legacy placeholder - form-based flow is used now
    return;
  };

  // New email form state and handlers
  const [emailValue, setEmailValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [emailFormMode, setEmailFormMode] = useState<'idle' | 'signin' | 'create'>('idle');
  const [authError, setAuthError] = useState<string | null>(null);

  const submitEmailSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError(null);
    try {
      await auth.signInWithEmailAndPassword(emailValue, passwordValue);
      setShowOverlay(false);
      setOpen(false);
      setEmailFormMode('idle');
      setEmailValue('');
      setPasswordValue('');
    } catch (err: any) {
      setAuthError(err.message || 'Sign in failed');
    }
  };

  const submitCreateAccount = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError(null);
    try {
      await auth.createUserWithEmailAndPassword(emailValue, passwordValue);
      setShowOverlay(false);
      setOpen(false);
      setEmailFormMode('idle');
      setEmailValue('');
      setPasswordValue('');
    } catch (err: any) {
      setAuthError(err.message || 'Create account failed');
    }
  };

  return (
    <div ref={containerRef} className="fixed top-3 left-3 z-50">
      <button
        aria-label="user menu"
        onClick={() => {
          if (isSignedIn) setOpen(v => !v);
          else setShowOverlay(true);
        }}
        className="bg-transparent dark:bg-transparent rounded-full p-1 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-400"
      >
        {isSignedIn && user && displayAvatar ? (
          <img
            src={displayAvatar}
            alt={user.displayName || 'user'}
            className="w-5 h-5 rounded-full object-cover"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              if ((img.dataset || {}).errored) return;
              img.dataset.errored = '1';
              img.src = '/avatar-fallback.svg';
            }}
          />
        ) : isSignedIn && user ? (
          <UserRoundCheck className="w-5 h-5 text-slate-800 dark:text-slate-100" />
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-slate-800 dark:text-slate-100">
            <path d="M12 8a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 20a9 9 0 0118 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {open && isSignedIn && user && (
        <div className="mt-2 w-auto min-w-[18rem] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg py-2">
          <div className="px-3 pb-2">
            <div className="flex items-center gap-2">
              {displayAvatar ? (
                <img
                  src={displayAvatar}
                  className="w-8 h-8 rounded-full"
                  onError={(e) => {
                    const img = e.currentTarget as HTMLImageElement;
                    if ((img.dataset || {}).errored) return;
                    img.dataset.errored = '1';
                    img.src = '/avatar-fallback.svg';
                  }}
                />
              ) : (
                <UserRoundCheck className="w-8 h-8 text-slate-800 dark:text-slate-100" />
              )}
              <div className="text-sm">
                <div className="font-medium text-slate-800 dark:text-slate-100 break-words">{user.displayName || user.email}</div>
                <div className="text-xs text-slate-500">Signed in</div>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-100 dark:border-slate-700" />
          <button onClick={handleLogout} className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm">Logout</button>
        </div>
      )}

      {showOverlay && !isSignedIn && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-96 shadow-xl">
            <h3 className="text-lg font-medium mb-4 text-center">Please sign in to manage your exhibits, artworks, and artists.</h3>

            {emailFormMode === 'idle' && (
              <div className="flex flex-col gap-3">
                <button onClick={signInWithGoogle} className="flex items-center gap-3 justify-center border rounded-lg px-4 py-3 hover:shadow-sm">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Google_Favicon_2025.svg" alt="Google" className="w-5 h-5" />
                  <span>Continue with Google</span>
                </button>
                <button onClick={() => setEmailFormMode('signin')} className="flex items-center gap-3 justify-center border rounded-lg px-4 py-3 hover:shadow-sm">
                  <Mail className="w-5 h-5 text-slate-600" />
                  <span>Continue with Email</span>
                </button>
              </div>
            )}

            {emailFormMode !== 'idle' && (
              <form onSubmit={emailFormMode === 'signin' ? submitEmailSignIn : submitCreateAccount} className="flex flex-col gap-4">
                <div className="flex flex-col items-stretch gap-2">
                  <div className="flex items-center bg-slate-50 rounded-xl px-3 py-3 border">
                    <Mail className="w-5 h-5 text-slate-500 mr-3" />
                    <input
                      value={emailValue}
                      onChange={(e) => setEmailValue(e.target.value)}
                      placeholder="Email"
                      type="email"
                      className="flex-1 bg-transparent outline-none text-sm"
                      required
                    />
                  </div>

                  <div className="flex items-center bg-slate-50 rounded-xl px-3 py-3 border">
                    <svg width="18" height="18" viewBox="0 0 24 24" className="text-slate-500 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none"><path d="M12 11c1.656 0 3 .895 3 2v3H9v-3c0-1.105 1.344-2 3-2zm6-1V9a6 6 0 10-12 0v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <input
                      value={passwordValue}
                      onChange={(e) => setPasswordValue(e.target.value)}
                      placeholder="Password"
                      type="password"
                      className="flex-1 bg-transparent outline-none text-sm"
                      required
                    />
                  </div>
                </div>

                {authError && <div className="text-red-600 text-sm">{authError}</div>}

                <button type="submit" className="w-full bg-blue-600 text-white rounded-xl py-3 text-center">{emailFormMode === 'signin' ? 'Sign In' : 'Create Account'}</button>

                {emailFormMode === 'signin' ? (
                  <button type="button" onClick={() => setEmailFormMode('create')} className="w-full bg-slate-200 text-slate-900 rounded-xl py-3">Create Account</button>
                ) : (
                  <button type="button" onClick={() => setEmailFormMode('signin')} className="w-full bg-slate-200 text-slate-900 rounded-xl py-3">Back to Sign In</button>
                )}

                <div className="mt-2 text-center text-sm text-slate-500">
                  <button onClick={() => { setShowOverlay(false); setEmailFormMode('idle'); }} className="underline">Back to sign-in options</button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
