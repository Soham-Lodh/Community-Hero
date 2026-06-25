import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { 
  onSnapshot, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  addDoc,
  getDocs,
  arrayUnion,
  arrayRemove,
  increment,
  writeBatch
} from 'firebase/firestore';
import { onAuthStateChanged, User, signInAnonymously, signInWithPopup, signOut } from 'firebase/auth';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import { Community, UserProfile, Issue, ChatMessage, Comment, IssueStatus, IssueSeverity, CivicNotification } from '../types';

interface AppContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  currentCommunity: Community | null;
  communities: Community[];
  issues: Issue[];
  chatMessages: ChatMessage[];
  allIssuesCityWide: Issue[];
  loading: boolean;
  authLoading: boolean;
  isFirstRun: boolean;
  communitiesLoaded: boolean;
  notifications: CivicNotification[];
  activeToast: CivicNotification | null;
  setActiveToast: (toast: CivicNotification | null) => void;
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  createNotification: (uid: string, communityId: string, title: string, message: string, type: 'issue_update' | 'chat_message' | 'issue_escalation', linkedIssueId?: string) => Promise<void>;
  triggerGamificationEvaluate: (uid: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInAsDemoUser: (name: string, role: 'citizen' | 'official') => Promise<void>;
  signOutUser: () => Promise<void>;
  joinCommunity: (communityId: string) => Promise<void>;
  leaveCommunity: () => Promise<void>;
  createCommunity: (name: string, centerLat: number, centerLng: number, radiusKm: number) => Promise<string>;
  reportIssue: (issueData: Omit<Issue, 'id' | 'createdAt' | 'upvoteCount' | 'upvoterUids' | 'statusHistory'>) => Promise<string>;
  upvoteIssue: (issueId: string, evidenceBase64?: string) => Promise<void>;
  addComment: (issueId: string, text: string) => Promise<void>;
  sendChatMessage: (text: string, type?: 'text' | 'issueShare', linkedIssueId?: string, linkedIssueTitle?: string) => Promise<{ approved: boolean; reason?: string }>;
  seedDatabase: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentCommunity, setCurrentCommunity] = useState<Community | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [allIssuesCityWide, setAllIssuesCityWide] = useState<Issue[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [communitiesLoaded, setCommunitiesLoaded] = useState<boolean>(false);
  const [isFirstRun, setIsFirstRun] = useState<boolean>(false);
  const googlePopupInFlightRef = useRef(false);

  const surfaceListenerError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      operationType,
      path,
      uid: auth.currentUser?.uid || currentUser?.uid || null
    };
    console.error("Realtime listener failed:", errInfo);
  };

  // Trigger Database Auto-Seeding & Listen for communities
  useEffect(() => {
    // Setup global communities listener
    const commRef = collection(db, 'communities');
    const unsubscribeComms = onSnapshot(commRef, (snapshot) => {
      const commsList: Community[] = [];
      snapshot.forEach((docSnap) => {
        commsList.push({ id: docSnap.id, ...docSnap.data() } as Community);
      });
      setCommunities(commsList);
      setCommunitiesLoaded(true);
      setIsFirstRun(commsList.length === 0);
    }, (error) => {
      setCommunitiesLoaded(true);
      surfaceListenerError(error, OperationType.LIST, 'communities');
    });

    return () => {
      unsubscribeComms();
    };
  }, []);

  // Fetch global city-wide issues (coordinates, severity, status only for security)
  useEffect(() => {
    const fetchCityWideIssues = async () => {
      try {
        const issuesRef = collection(db, 'issues');
        const querySnapshot = await getDocs(issuesRef);
        const issuesList: Issue[] = [];
        querySnapshot.forEach((docSnap) => {
          issuesList.push({ id: docSnap.id, ...docSnap.data() } as Issue);
        });
        setAllIssuesCityWide(issuesList);
      } catch (err) {
        console.warn("Could not load citywide issues from Firestore:", err);
      }
    };
    fetchCityWideIssues();
  }, [issues]);

  // Monitor Auth State
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setAuthLoading(true);
      if (user) {
        setCurrentUser(user);
        // Load or create Firestore user profile
        await fetchOrCreateProfile(user.uid, user.displayName || 'Neighbor', user.photoURL || '', undefined, user.email || '');
      } else {
        localStorage.removeItem('civicpulse_demo_user');
        setCurrentUser(null);
        setUserProfile(null);
        setCurrentCommunity(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // Listen to User Profile in real-time
  useEffect(() => {
    if (!currentUser?.uid) return;

    const userDocRef = doc(db, 'users', currentUser.uid);
    const unsubProfile = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile({ uid: docSnap.id, ...docSnap.data() } as UserProfile);
      }
    }, (error) => {
      surfaceListenerError(error, OperationType.GET, `users/${currentUser.uid}`);
    });

    return () => unsubProfile();
  }, [currentUser?.uid]);

  // Listen to User Notifications in real-time
  const [notifications, setNotifications] = useState<CivicNotification[]>([]);
  const [activeToast, setActiveToast] = useState<CivicNotification | null>(null);

  useEffect(() => {
    if (!currentUser?.uid) {
      setNotifications([]);
      return;
    }

    const notifRef = collection(db, 'notifications');
    const q = query(
      notifRef,
      where('uid', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    let isInitialLoad = true;

    const unsubNotifs = onSnapshot(q, (snapshot) => {
      const notifList: CivicNotification[] = [];
      snapshot.forEach((docSnap) => {
        notifList.push({ id: docSnap.id, ...docSnap.data() } as CivicNotification);
      });

      // Find if any new unread notification is added (for real-time toast)
      if (!isInitialLoad) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const newNotif = { id: change.doc.id, ...change.doc.data() } as CivicNotification;
            if (Date.now() - newNotif.createdAt < 15000 && !newNotif.isRead) {
              setActiveToast(newNotif);
              setTimeout(() => {
                setActiveToast((current) => current?.id === newNotif.id ? null : current);
              }, 4500);
            }
          }
        });
      } else {
        isInitialLoad = false;
      }

      setNotifications(notifList);
    }, (error) => {
      surfaceListenerError(error, OperationType.LIST, 'notifications');
    });

    return () => unsubNotifs();
  }, [currentUser?.uid]);

  const createNotification = async (
    uid: string,
    communityId: string,
    title: string,
    message: string,
    type: 'issue_update' | 'chat_message' | 'issue_escalation',
    linkedIssueId?: string
  ) => {
    try {
      const notifRef = collection(db, 'notifications');
      await addDoc(notifRef, {
        uid,
        communityId,
        title,
        message,
        type,
        linkedIssueId: linkedIssueId || null,
        isRead: false,
        createdAt: Date.now()
      });
    } catch (err) {
      console.error("Error creating notification:", err);
      handleFirestoreError(err, OperationType.CREATE, 'notifications');
    }
  };

  const markNotificationAsRead = async (id: string) => {
    try {
      const notifRef = doc(db, 'notifications', id);
      await updateDoc(notifRef, { isRead: true });
    } catch (err) {
      console.error("Error marking notification as read:", err);
      handleFirestoreError(err, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  const markAllNotificationsAsRead = async () => {
    if (!currentUser?.uid) return;
    try {
      const unreadNotifs = notifications.filter(n => !n.isRead);
      for (const notif of unreadNotifs) {
        const notifRef = doc(db, 'notifications', notif.id);
        await updateDoc(notifRef, { isRead: true });
      }
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
      handleFirestoreError(err, OperationType.UPDATE, 'notifications');
    }
  };

  const triggerGamificationEvaluate = async (uid: string) => {
    try {
      await fetch('/api/gamification/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid })
      });
    } catch (err) {
      console.error("Gamification evaluation failed:", err);
    }
  };

  // Sync Current Community & Community-Scoped Collections when user changes community
  useEffect(() => {
    if (!userProfile?.communityId) {
      setCurrentCommunity(null);
      setIssues([]);
      setChatMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Listen to active community doc
    const communityRef = doc(db, 'communities', userProfile.communityId);
    const unsubComm = onSnapshot(communityRef, (docSnap) => {
      if (docSnap.exists()) {
        setCurrentCommunity({ id: docSnap.id, ...docSnap.data() } as Community);
      }
    }, (error) => {
      surfaceListenerError(error, OperationType.GET, `communities/${userProfile.communityId}`);
    });

    // 2. Listen to community issues
    const issuesRef = collection(db, 'issues');
    const qIssues = query(
      issuesRef, 
      where('communityId', '==', userProfile.communityId),
      orderBy('createdAt', 'desc')
    );
    const unsubIssues = onSnapshot(qIssues, (snapshot) => {
      const issuesList: Issue[] = [];
      snapshot.forEach((docSnap) => {
        issuesList.push({ id: docSnap.id, ...docSnap.data() } as Issue);
      });
      setIssues(issuesList);
      setLoading(false);
    }, (error) => {
      console.error("Issues listener error:", error);
      setLoading(false);
      surfaceListenerError(error, OperationType.LIST, 'issues');
    });

    // 3. Listen to community chat
    const chatRef = collection(db, 'chatMessages');
    const qChat = query(
      chatRef,
      where('communityId', '==', userProfile.communityId),
      where('moderationStatus', '==', 'approved'),
      orderBy('createdAt', 'asc')
    );
    const unsubChat = onSnapshot(qChat, (snapshot) => {
      const messages: ChatMessage[] = [];
      snapshot.forEach((docSnap) => {
        messages.push({ id: docSnap.id, ...docSnap.data() } as ChatMessage);
      });
      setChatMessages(messages);
    }, (error) => {
      surfaceListenerError(error, OperationType.LIST, 'chatMessages');
    });

    return () => {
      unsubComm();
      unsubIssues();
      unsubChat();
    };
  }, [userProfile?.communityId]);

  // Fetch or create profile inside Firestore
  const fetchOrCreateProfile = async (uid: string, defaultName: string, defaultPhoto: string, roleInput?: 'citizen' | 'official', defaultEmail?: string) => {
    try {
      const userDocRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        setUserProfile({ uid, ...userDoc.data() } as UserProfile);
      } else {
        const newProfile: UserProfile = {
          uid,
          name: defaultName,
          email: defaultEmail || '',
          photoURL: defaultPhoto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
          communityId: null,
          points: 0,
          badges: [],
          role: roleInput || 'citizen'
        };
        await setDoc(userDocRef, newProfile);
        setUserProfile(newProfile);
      }
    } catch (err) {
      console.error("Error in fetchOrCreateProfile:", err);
      handleFirestoreError(err, OperationType.READ, `users/${uid}`);
    }
  };

  // Auth Operations
  const signInWithGoogle = async () => {
    if (googlePopupInFlightRef.current) {
      throw new Error("Google sign-in is already open. Finish or close the current popup first.");
    }

    try {
      googlePopupInFlightRef.current = true;
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        localStorage.removeItem('civicpulse_demo_user');
      }
    } catch (error: any) {
      console.error("Google login failed:", error);
      if (error?.code === 'auth/cancelled-popup-request') {
        throw new Error("A Google sign-in popup was already in progress. Please try once more.");
      }
      if (error?.code === 'auth/popup-closed-by-user') {
        throw new Error("Google sign-in was closed before completion.");
      }
      if (error?.code === 'auth/popup-blocked') {
        throw new Error("Your browser blocked the Google sign-in popup. Allow popups for this site or use demo access.");
      }
      throw error;
    } finally {
      googlePopupInFlightRef.current = false;
    }
  };

  const signInAsDemoUser = async (name: string, role: 'citizen' | 'official') => {
    const credential = await signInAnonymously(auth);
    const uid = credential.user.uid;
    const photoURL = `https://images.unsplash.com/photo-${role === 'official' ? '1570295999919-56ceb5ecca61' : '1535713875002-d1d0cf377fde'}?w=150&auto=format&fit=crop&q=80`;

    localStorage.removeItem('civicpulse_demo_user');
    setCurrentUser(credential.user);
    await fetchOrCreateProfile(uid, name, photoURL, role, `${uid}@civicpulse.org`);
  };

  const signOutUser = async () => {
    localStorage.removeItem('civicpulse_demo_user');
    await signOut(auth);
    setCurrentUser(null);
    setUserProfile(null);
    setCurrentCommunity(null);
  };

  // Community Operations
  const joinCommunity = async (communityId: string) => {
    if (!userProfile) return;
    
    try {
      // Check if user already in a community
      if (userProfile.communityId && userProfile.communityId !== communityId) {
        // Leave old community member lists first
        const oldCommRef = doc(db, 'communities', userProfile.communityId);
        await updateDoc(oldCommRef, {
          memberUids: arrayRemove(userProfile.uid)
        });
      }

      const userDocRef = doc(db, 'users', userProfile.uid);
      await updateDoc(userDocRef, { communityId });

      const newCommRef = doc(db, 'communities', communityId);
      await updateDoc(newCommRef, {
        memberUids: arrayUnion(userProfile.uid)
      });

      setUserProfile(prev => prev ? { ...prev, communityId } : null);
    } catch (err) {
      console.error("Error joining community:", err);
      handleFirestoreError(err, OperationType.UPDATE, `communities/${communityId}`);
    }
  };

  const leaveCommunity = async () => {
    if (!userProfile || !userProfile.communityId) return;

    try {
      const oldCommId = userProfile.communityId;
      const oldCommRef = doc(db, 'communities', oldCommId);
      await updateDoc(oldCommRef, {
        memberUids: arrayRemove(userProfile.uid)
      });

      const userDocRef = doc(db, 'users', userProfile.uid);
      await updateDoc(userDocRef, { communityId: null });

      setUserProfile(prev => prev ? { ...prev, communityId: null } : null);
      setCurrentCommunity(null);
    } catch (err) {
      console.error("Error leaving community:", err);
      handleFirestoreError(err, OperationType.UPDATE, `communities/${userProfile.communityId}`);
    }
  };

  const createCommunity = async (name: string, centerLat: number, centerLng: number, radiusKm: number): Promise<string> => {
    if (!userProfile) throw new Error("Authentication required");

    // Enforce Geo-Validation server-side via API
    const response = await fetch('/api/ai/geovalidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, lat: centerLat, lng: centerLng, radiusKm })
    });
    
    const valResult = await response.json();
    if (!valResult.valid) {
      throw new Error(valResult.reason);
    }

    try {
      const newCommRef = doc(collection(db, 'communities'));
      const newCommunity: Community = {
        id: newCommRef.id,
        name,
        centerLat,
        centerLng,
        radiusKm,
        createdByUid: userProfile.uid,
        memberUids: [userProfile.uid],
        createdAt: Date.now()
      };

      await setDoc(newCommRef, newCommunity);

      // Join the newly created community
      const userDocRef = doc(db, 'users', userProfile.uid);
      await updateDoc(userDocRef, { communityId: newCommRef.id });
      setUserProfile(prev => prev ? { ...prev, communityId: newCommRef.id } : null);

      return newCommRef.id;
    } catch (err) {
      console.error("Error creating community:", err);
      handleFirestoreError(err, OperationType.CREATE, 'communities');
      throw err;
    }
  };

  // Issue Operations
  const reportIssue = async (issueData: Omit<Issue, 'id' | 'createdAt' | 'upvoteCount' | 'upvoterUids' | 'statusHistory'>): Promise<string> => {
    if (!userProfile) throw new Error("Authentication required");

    const newIssueRef = doc(collection(db, 'issues'));
    const now = Date.now();
    const newIssue: Issue = {
      ...issueData,
      id: newIssueRef.id,
      communityId: userProfile.communityId || issueData.communityId,
      reporterUid: userProfile.uid,
      reporterName: issueData.isAnonymous ? undefined : userProfile.name,
      reporterPhoto: issueData.isAnonymous ? undefined : userProfile.photoURL,
      upvoteCount: 0,
      upvoterUids: [],
      createdAt: now,
      statusHistory: [{ status: IssueStatus.Reported, timestamp: now, updatedBy: "System" }]
    };

    Object.keys(newIssue).forEach((key) => {
      if ((newIssue as any)[key] === undefined) delete (newIssue as any)[key];
    });

    const batch = writeBatch(db);
    batch.set(newIssueRef, newIssue);

    const userDocRef = doc(db, 'users', userProfile.uid);
    const badgesToAdd = userProfile.badges?.includes('first_report') ? [] : ['first_report'];
    batch.update(userDocRef, {
      points: increment(50),
      ...(badgesToAdd.length > 0 ? { badges: arrayUnion(...badgesToAdd) } : {})
    });

    const notifRef = doc(collection(db, 'notifications'));
    batch.set(notifRef, {
      uid: userProfile.uid,
      communityId: newIssue.communityId,
      title: "Report Received",
      message: `Thank you for filing "${newIssue.title}". We have queued it for review!`,
      type: "issue_update",
      linkedIssueId: newIssueRef.id,
      isRead: false,
      createdAt: now
    });

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'issues');
    }

    setIssues((prev) => {
      if (prev.some((issue) => issue.id === newIssueRef.id)) return prev;
      return [newIssue, ...prev];
    });

    // Evaluate badges on the server
    await triggerGamificationEvaluate(userProfile.uid);
    return newIssueRef.id;
  };

  const upvoteIssue = async (issueId: string, evidenceBase64?: string) => {
    if (!userProfile) return;

    const issueRef = doc(db, 'issues', issueId);
    const issueSnap = await getDoc(issueRef);
    if (!issueSnap.exists()) return;

    const issue = issueSnap.data() as Issue;
    if (issue.communityId !== userProfile.communityId) {
      console.warn("User attempted to upvote an issue in another community:", { issueId, userCommunityId: userProfile.communityId, issueCommunityId: issue.communityId });
      throw new Error("You can only interact with issues in your own community");
    }
    if (issue.reporterUid === userProfile.uid) {
      throw new Error("You cannot upvote your own reported issue!");
    }
    if (issue.upvoterUids.includes(userProfile.uid)) {
      throw new Error("You have already upvoted/verified this issue!");
    }

    try {
      // Prepare update parameters
      const updates: any = {
        upvoteCount: increment(1),
        upvoterUids: arrayUnion(userProfile.uid)
      };

      // If corroborating evidence photo is attached, push to mediaUrls and log reasoning
      if (evidenceBase64) {
        try {
          const intakeRes = await fetch('/api/ai/intake', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: evidenceBase64 })
          });
          const visionData = await intakeRes.json();
          
          if (visionData.isValidCivicIssue !== false) {
            updates.mediaUrls = arrayUnion(evidenceBase64);
            updates.aiReasoningLog = arrayUnion({
              agentName: "Verification Agent",
              timestamp: Date.now(),
              decision: "Added Corroborating Image Evidence",
              reasoning: `User ${userProfile.name} uploaded a matching verification image. Vision analysis: "${visionData.description}"`
            });
          }
        } catch (err) {
          console.error("Verification vision check failed, applying base upvote:", err);
        }
      } else {
        // Standard log item
        updates.aiReasoningLog = arrayUnion({
          agentName: "Upvote Agent",
          timestamp: Date.now(),
          decision: `Citizen Verification Added`,
          reasoning: `User ${userProfile.name} verified this issue. Total verifications is now ${issue.upvoteCount + 1}.`
        });
      }

      await updateDoc(issueRef, updates);

      // Reward voter with points (10 points)
      const userDocRef = doc(db, 'users', userProfile.uid);
      const badgesToAdd: string[] = [];

      if (!userProfile.badges.includes('verified_citizen')) {
        badgesToAdd.push('verified_citizen');
      }

      await updateDoc(userDocRef, {
        points: increment(10),
        ...(badgesToAdd.length > 0 ? { badges: arrayUnion(...badgesToAdd) } : {})
      });

      // Notify user of verification
      await createNotification(
        userProfile.uid,
        userProfile.communityId,
        "Verification Registered",
        `Your verification for "${issue.title}" has been registered. +10 Points!`,
        "issue_update",
        issue.id
      );

      // Trigger server-side badge evaluation
      await triggerGamificationEvaluate(userProfile.uid);
    } catch (err) {
      console.error("Error upvoting issue:", err);
      handleFirestoreError(err, OperationType.UPDATE, `issues/${issueId}`);
    }
  };

  const addComment = async (issueId: string, text: string) => {
    if (!userProfile || !userProfile.communityId) return;

    try {
      const commentsRef = collection(db, 'comments');
      const newComment = {
        issueId,
        communityId: userProfile.communityId,
        uid: userProfile.uid,
        userName: userProfile.name,
        userPhotoURL: userProfile.photoURL,
        text,
        createdAt: Date.now()
      };

      await addDoc(commentsRef, newComment);
    } catch (err) {
      console.error("Error adding comment:", err);
      handleFirestoreError(err, OperationType.CREATE, 'comments');
    }
  };

  // Moderate Chat and Write to database
  const sendChatMessage = async (
    text: string, 
    type: 'text' | 'issueShare' = 'text', 
    linkedIssueId?: string, 
    linkedIssueTitle?: string
  ) => {
    if (!userProfile || !userProfile.communityId) {
      throw new Error("You must belong to a community to chat");
    }

    // Call server moderation
    const response = await fetch('/api/chat/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    const modResult = await response.json();

    if (!modResult.approved) {
      return { approved: false, reason: modResult.reason };
    }

    try {
      // Add approved message to database
      const chatRef = collection(db, 'chatMessages');
      const newMessage: Omit<ChatMessage, 'id'> = {
        communityId: userProfile.communityId,
        uid: userProfile.uid,
        userName: userProfile.name,
        userPhotoURL: userProfile.photoURL,
        text,
        type,
        moderationStatus: 'approved',
        createdAt: Date.now()
      };
      if (linkedIssueId) newMessage.linkedIssueId = linkedIssueId;
      if (linkedIssueTitle) newMessage.linkedIssueTitle = linkedIssueTitle;

      await addDoc(chatRef, newMessage);

      // Notify other community members
      if (currentCommunity && currentCommunity.memberUids) {
        for (const memberUid of currentCommunity.memberUids) {
          if (memberUid !== userProfile.uid) {
            await createNotification(
              memberUid,
              userProfile.communityId,
              `New message in ${currentCommunity.name}`,
              `${userProfile.name}: ${text.substring(0, 40)}${text.length > 40 ? '...' : ''}`,
              'chat_message',
              linkedIssueId || undefined
            );
          }
        }
      }

      // Award 5 points for chat coordination and evaluate badges
      const userDocRef = doc(db, 'users', userProfile.uid);
      await updateDoc(userDocRef, {
        points: increment(5)
      });
      await triggerGamificationEvaluate(userProfile.uid);

      return { approved: true };
    } catch (err) {
      console.error("Error sending chat message:", err);
      handleFirestoreError(err, OperationType.CREATE, 'chatMessages');
      throw err;
    }
  };

  const seedDatabase = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();
      console.log("Seeding triggered manually:", data.message);
    } catch (err) {
      console.error("Manual seed call failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppContext.Provider value={{
      currentUser,
      userProfile,
      currentCommunity,
      communities,
      issues,
      chatMessages,
      allIssuesCityWide,
      loading,
      authLoading,
      isFirstRun,
      communitiesLoaded,
      notifications,
      activeToast,
      setActiveToast,
      markNotificationAsRead,
      markAllNotificationsAsRead,
      createNotification,
      triggerGamificationEvaluate,
      signInWithGoogle,
      signInAsDemoUser,
      signOutUser,
      joinCommunity,
      leaveCommunity,
      createCommunity,
      reportIssue,
      upvoteIssue,
      addComment,
      sendChatMessage,
      seedDatabase
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
