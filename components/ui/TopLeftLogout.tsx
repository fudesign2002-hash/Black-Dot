import React, { useEffect, useRef, useState } from 'react';
import BlackDotLogo from './BlackDotLogo';
import firebase from 'firebase/compat/app';
import { auth, db } from '../../firebase';
import { Mail, UserRoundCheck } from 'lucide-react';

interface Props {
  user?: firebase.User | null;
  onLogout?: () => void;
  onSignIn?: (teamCuratorUid?: string | null) => void;
  onRequestCloseInfo?: () => void; // optional callback to request closing the InfoPanel
}

export default function TopLeftLogout({ user, onLogout, onSignIn, onRequestCloseInfo }: Props) {
  const [open, setOpen] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isSignedIn = Boolean(user && (user.providerData && user.providerData.length > 0));

  const [cachedAvatar, setCachedAvatar] = useState<string | null>(null);
  const failedUrlsRef = useRef<Set<string>>(new Set()); // Track failed URLs to avoid retrying
  const fetchingUrlsRef = useRef<Set<string>>(new Set()); // Track currently fetching URLs

  useEffect(() => {
    if (!user) {
      setCachedAvatar(null);
      return;
    }

    const sourceUrl = user.photoURL || (user.providerData && (user.providerData[0] as any)?.photoURL) || null;
    if (!sourceUrl) {
      setCachedAvatar(null);
      return;
    }

    const key = `avatar:${user.uid}`;
    const TTL = 1000 * 60 * 60 * 24 * 7; // 7 days - longer cache time

    // Always try to load from cache first
    let cachedData: string | null = null;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.data) {
          cachedData = parsed.data;
          setCachedAvatar(parsed.data);
          
          // If cache is fresh (within TTL), don't fetch again
          if (parsed.ts && (Date.now() - parsed.ts) < TTL) {
            return;
          }
          // Cache is stale but we'll keep using it while trying to refresh in background
        }
      }
    } catch (e) {
      // localStorage error - if we have cached data, use it; otherwise continue to fetch
    }

    // If this URL has failed before, use cached data if available, otherwise skip
    if (failedUrlsRef.current.has(sourceUrl)) {
      // Already have cached data set above, so just return
      return;
    }
    
    // If already fetching, skip
    if (fetchingUrlsRef.current.has(sourceUrl)) {
      return;
    }

    // Mark as fetching to prevent duplicate requests
    fetchingUrlsRef.current.add(sourceUrl);

    // Attempt to fetch and update cache (in background if we have cached data)
    let cancelled = false;
    (async () => {
      try {
        // Add timeout to fail fast if Google is rate-limiting
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const res = await fetch(sourceUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!res.ok) {
          // Mark as failed but keep using cached data if available
          failedUrlsRef.current.add(sourceUrl);
          fetchingUrlsRef.current.delete(sourceUrl);
          // Don't set to null - keep existing cachedAvatar (either from cache or null)
          return;
        }
        
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          if (cancelled) return;
          const dataUrl = reader.result as string;
          setCachedAvatar(dataUrl);
          fetchingUrlsRef.current.delete(sourceUrl);
          try {
            localStorage.setItem(key, JSON.stringify({ data: dataUrl, ts: Date.now() }));
          } catch (err) {
            // ignore storage errors
          }
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        // on fetch error (including timeout), keep using cached data if available
        failedUrlsRef.current.add(sourceUrl);
        fetchingUrlsRef.current.delete(sourceUrl);
        // Don't set to null - keep existing cachedAvatar
      }
    })();

    return () => { 
      cancelled = true;
      fetchingUrlsRef.current.delete(sourceUrl);
    };
  }, [user?.uid, user?.photoURL, user?.providerData]);

  // Only use cachedAvatar, never fallback to avatarUrl to avoid 429 errors
  const displayAvatar = cachedAvatar;

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

  const handleOverlayBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // only dismiss when clicking directly on the background (not the card)
    if (e.target === e.currentTarget) {
      setShowOverlay(false);
      setEmailFormMode('idle');
    }
  };

  const signInWithGoogle = async () => {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await auth.signInWithPopup(provider);
      const signedUser = result.user || null;
      await handlePostSignIn(signedUser);
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
      // after sign-in, run post sign-in processing
      const current = auth.currentUser as firebase.User | null;
      await handlePostSignIn(current);
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
      const current = auth.currentUser as firebase.User | null;
      await handlePostSignIn(current);
      setShowOverlay(false);
      setOpen(false);
      setEmailFormMode('idle');
      setEmailValue('');
      setPasswordValue('');
    } catch (err: any) {
      setAuthError(err.message || 'Create account failed');
    }
  };

  // Team code inputs and lookup
  const [teamCodeChars, setTeamCodeChars] = useState<string[]>(Array(6).fill(''));
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const teamCode = teamCodeChars.join('');
  const teamCodeFilled = teamCode.length === 6 && !teamCodeChars.includes('');
  const [teamLookupLoading, setTeamLookupLoading] = useState(false);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [teamLookupError, setTeamLookupError] = useState<string | null>(null);
  const [teamDocId, setTeamDocId] = useState<string | null>(null);
  const [teamCuratorUid, setTeamCuratorUid] = useState<string | null>(null);

  const handleDigitChange = (index: number, val: string) => {
    const digit = val.slice(-1);
    const next = [...teamCodeChars];
    next[index] = digit;
    setTeamCodeChars(next);
    setTeamName(null);
    setTeamLookupError(null);
    if (digit) {
      const nextInput = inputsRef.current[index + 1];
      if (nextInput) nextInput.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (teamCodeChars[index]) {
        const next = [...teamCodeChars];
        next[index] = '';
        setTeamCodeChars(next);
      } else {
        const prev = inputsRef.current[index - 1];
        if (prev) {
          prev.focus();
          const n = [...teamCodeChars];
          n[index - 1] = '';
          setTeamCodeChars(n);
        }
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!teamCodeFilled) return;
    setTeamLookupLoading(true);
    setTeamLookupError(null);
    (async () => {
      try {
        const q = await (db as any).collection('teams').where('team_code', '==', teamCode).limit(1).get();
        if (cancelled) return;
        if (!q.empty) {
          const doc = q.docs[0];
          const data = doc.data();
          setTeamName(data.name || data.team_name || null);
          setTeamDocId(doc.id);
          // find curator uid in team_members array
          const members = Array.isArray(data.team_members) ? data.team_members : [];
          const curator = members.find((m: any) => m && m.role === 'curator');
          setTeamCuratorUid(curator ? curator.uid : null);
        } else {
          setTeamName(null);
          setTeamLookupError('No matching team');
        }
      } catch (err: any) {
        if (cancelled) return;
        console.error('team lookup failed', err);
        setTeamName(null);
        setTeamLookupError('Lookup failed');
      } finally {
        if (!cancelled) setTeamLookupLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [teamCodeFilled, teamCode]);

  const handlePostSignIn = async (signedInUser: firebase.User | null) => {
    if (!signedInUser) return;
    try {
      // Ensure users collection has a doc for this uid
      await (db as any).collection('users').doc(signedInUser.uid).set({
        email: signedInUser.email || null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      // If we have a matched team doc, ensure the user is a member
      if (teamDocId) {
        const teamRef = (db as any).collection('teams').doc(teamDocId);
        const teamSnap = await teamRef.get();
        if (teamSnap.exists) {
          const data = teamSnap.data();
          const members = Array.isArray(data.team_members) ? data.team_members : [];
          const already = members.some((m: any) => m && m.uid === signedInUser.uid);
          if (!already) {
            await teamRef.update({
              team_members: firebase.firestore.FieldValue.arrayUnion({ role: 'member', uid: signedInUser.uid })
            });
          }
        }
      }

      // Notify parent about team curator override (if any)
      if (typeof onSignIn === 'function') onSignIn(teamCuratorUid || null);
    } catch (err) {
      // swallow for now
      console.error('post sign-in processing failed', err);
    }
  };

  // Debug helpers for stepwise inspection (opened via Shift+Click on the user icon)
  const runDebugStep = async (step: number) => {
    const append = (s: string) => setDebugLogs(l => [...l, s]);
    try {
      if (step === 1) {
        append(`step1: isSignedIn = ${isSignedIn}`);
        append(`step1: displayAvatar present = ${!!displayAvatar}`);
      } else if (step === 2) {
        append('step2: toggling profile menu (open state before) = ' + String(open));
        setOpen(v => { append('step2: open toggled'); return !v; });
      } else if (step === 3) {
        append('step3: calling onRequestCloseInfo (if provided)');
        try {
          if (onRequestCloseInfo) {
            onRequestCloseInfo();
            append('step3: onRequestCloseInfo called');
          } else {
            append('step3: onRequestCloseInfo not provided');
          }
        } catch (err: any) {
          append('step3: onRequestCloseInfo threw: ' + String(err));
        }
      } else if (step === 4) {
        append('step4: setting showOverlay=true (will render sign-in card)');
        setShowOverlay(true);
      } else if (step === 5) {
        append('step5: logging viewport widths');
        append(`window.innerWidth=${window.innerWidth}, documentElement.clientWidth=${document.documentElement.clientWidth}, document.body.clientWidth=${document.body.clientWidth}, scrollWidth=${document.documentElement.scrollWidth}`);
        const rect = containerRef.current?.getBoundingClientRect();
        append('step5: user-button rect=' + (rect ? JSON.stringify(rect.toJSON()) : 'null'));
      }
    } catch (e: any) {
      append('error running step ' + step + ': ' + String(e));
    }
  };

  return (
    <div ref={containerRef} className="fixed top-3 left-3 z-50">
      <button
        aria-label="user menu"
        onPointerDown={(e) => { e.stopPropagation(); }}
        onMouseDown={(e) => { e.stopPropagation(); }}
          onClick={(e) => {
          e.stopPropagation();
          // Shift+Click opens the debug panel
          if ((e as unknown as MouseEvent).shiftKey) {
            setDebugLogs([]);
            setDebugPanelOpen(true);
            return;
          }

          // NORMAL MODE: execute steps 1-3 only (compute isSignedIn, toggle menu if signed in, else call onRequestCloseInfo)
          try {
            // step 1: compute isSignedIn (already derived above)

            // step 2: toggle profile menu if signed in
            if (isSignedIn) {
              setOpen(v => !v);
              return;
            }

            // step 3: if not signed in, request parent to close InfoPanel
            if (onRequestCloseInfo) {
              try {
                onRequestCloseInfo();
              } catch (err) {
                console.error('[TopLeftLogout] step3: onRequestCloseInfo threw', err);
              }
            }

            // Show the sign-in overlay
            setShowOverlay(true);
            return;
          } catch (err) {
            console.error('[TopLeftLogout] click handler error', err);
          }
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
        <div onMouseDown={handleOverlayBackgroundClick} className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 overflow-hidden p-4">
          <div className="bg-white rounded-xl p-8 w-full max-w-md shadow-2xl box-border overflow-hidden">
            <div className="flex flex-col items-center gap-4">
              {/* Logo box */}
              <div className="w-20 h-20 flex items-center justify-center">
                <BlackDotLogo treatAsCompact={false} logoRotationStyle="none" onClick={() => {}} ariaLabel="Black Dot logo" />
              </div>

              <h1 className="text-3xl font-extrabold text-slate-900">Welcome to Black Dot</h1>
              <p className="text-sm text-slate-500 text-center">Please sign in to manage exhibits, artworks, and artists.</p>

              <div className="w-full bg-white mt-4">
                {emailFormMode === 'idle' ? (
                  <>
                    <div className="text-center text-sm text-slate-500 mb-3">Your Team Code</div>
                    <div className="flex justify-center gap-1 sm:gap-2 mb-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <input
                          key={i}
                          ref={(el) => { inputsRef.current[i] = el; }}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={1}
                          value={teamCodeChars[i] ?? ''}
                          onChange={(e) => handleDigitChange(i, e.target.value.replace(/[^0-9]/g, ''))}
                          onKeyDown={(e) => handleDigitKeyDown(i, e as unknown as React.KeyboardEvent<HTMLInputElement>)}
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded-md border border-slate-200 flex items-center justify-center text-center text-lg font-medium text-slate-900 outline-none"
                        />
                      ))}
                    </div>
                    <div className="text-center text-sm text-slate-500 mb-4">
                      {teamLookupLoading ? (
                        <span>Checking team…</span>
                      ) : teamName ? (
                        <span>You are joining team: "{teamName}"</span>
                      ) : teamCodeFilled ? (
                        <span className="text-red-600">No matching team for that code</span>
                      ) : (
                        <span className="text-slate-500">Enter 6-digit team code to continue</span>
                      )}
                    </div>

                    <div className="flex flex-col gap-3">
                      <button
                        type="button"
                        onClick={signInWithGoogle}
                        disabled={!teamName || teamLookupLoading}
                        className={"flex items-center gap-3 justify-center border rounded-xl px-4 py-3 hover:shadow-sm " + ((!teamName || teamLookupLoading) ? 'opacity-50 cursor-not-allowed' : '')}
                      >
                        <img src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Google_Favicon_2025.svg" alt="Google" className="w-5 h-5" />
                        <span className="font-medium">Continue with Google</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEmailFormMode('signin')}
                        disabled={!teamName || teamLookupLoading}
                        className={"flex items-center gap-3 justify-center border rounded-xl px-4 py-3 hover:shadow-sm " + ((!teamName || teamLookupLoading) ? 'opacity-50 cursor-not-allowed' : '')}
                      >
                        <Mail className="w-5 h-5 text-slate-600" />
                        <span className="font-medium">Continue with Email</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <form onSubmit={emailFormMode === 'signin' ? submitEmailSignIn : submitCreateAccount} className="flex flex-col gap-4">
                    <div className="flex flex-col items-stretch gap-3">
                      <div className="flex items-center bg-slate-50 rounded-xl px-3 py-3 border">
                        <Mail className="w-5 h-5 text-slate-500 mr-3" />
                        <input
                          autoFocus
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

                    <button disabled={!emailValue || !passwordValue} type="submit" className={"w-full rounded-xl py-3 text-center text-sm font-medium " + ((!emailValue || !passwordValue) ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-slate-900 text-white')}>{emailFormMode === 'signin' ? 'Sign In' : 'Create Account'}</button>

                    {emailFormMode === 'signin' ? (
                      <button type="button" onClick={() => setEmailFormMode('create')} className="w-full bg-slate-100 text-slate-900 rounded-xl py-3">Create Account</button>
                    ) : (
                      <button type="button" onClick={() => setEmailFormMode('signin')} className="w-full bg-slate-100 text-slate-900 rounded-xl py-3">Back to Sign In</button>
                    )}

                    <div className="mt-2 text-center text-sm text-slate-500">
                      <button type="button" onClick={() => { setEmailFormMode('idle'); setAuthError(null); }} className="underline">Back to sign-in options</button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Debug panel (Shift+Click on user icon to open) */}
      {debugPanelOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50" onClick={() => setDebugPanelOpen(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl box-border max-w-full overflow-auto">
            <h2 className="text-lg font-bold mb-3">User icon click — Debug Steps</h2>
            <p className="text-sm mb-4">按下各步驟按鈕逐一執行，觀察是否會觸發橫向溢出。</p>
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Step 1</div>
                  <div className="text-xs text-neutral-500">檢查登入狀態與 avatar</div>
                </div>
                <button className="px-3 py-1 rounded bg-neutral-200" onClick={(e) => { e.stopPropagation(); runDebugStep(1); }}>Run</button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Step 2</div>
                  <div className="text-xs text-neutral-500">切換內建 profile menu（signed-in 狀態下）</div>
                </div>
                <button className="px-3 py-1 rounded bg-neutral-200" onClick={(e) => { e.stopPropagation(); runDebugStep(2); }}>Run</button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Step 3</div>
                  <div className="text-xs text-neutral-500">呼叫 onRequestCloseInfo（如果 parent 提供）</div>
                </div>
                <button className="px-3 py-1 rounded bg-neutral-200" onClick={(e) => { e.stopPropagation(); runDebugStep(3); }}>Run</button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Step 4</div>
                  <div className="text-xs text-neutral-500">顯示登入 overlay（showOverlay = true）</div>
                </div>
                <button className="px-3 py-1 rounded bg-neutral-200" onClick={(e) => { e.stopPropagation(); runDebugStep(4); }}>Run</button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Step 5</div>
                  <div className="text-xs text-neutral-500">記錄 viewport 與 user-button bounding rect</div>
                </div>
                <button className="px-3 py-1 rounded bg-neutral-200" onClick={(e) => { e.stopPropagation(); runDebugStep(5); }}>Run</button>
              </div>
            </div>

            <div className="border-t pt-3">
              <div className="text-sm font-medium mb-2">Logs</div>
              <div className="max-h-48 overflow-auto text-xs bg-neutral-50 p-2 rounded">
                {debugLogs.length === 0 ? <div className="text-neutral-400">尚無紀錄</div> : debugLogs.map((l, i) => <div key={i} className="whitespace-pre-wrap">{l}</div>)}
              </div>
              <div className="mt-3 flex gap-2">
                <button className="px-3 py-1 rounded bg-neutral-200" onClick={(e) => { e.stopPropagation(); setDebugLogs([]); }}>Clear</button>
                <button className="px-3 py-1 rounded bg-neutral-200" onClick={(e) => { e.stopPropagation(); setDebugPanelOpen(false); }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
