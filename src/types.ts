export enum IssueSeverity {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  Critical = 'Critical'
}

export enum IssueStatus {
  Reported = 'Reported',
  Reviewed = 'Reviewed',
  InProgress = 'In Progress',
  Completed = 'Completed'
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  communityId?: string;
  points: number;
  role: 'citizen' | 'official';
  badges?: string[];
}

export interface Community {
  id: string;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number; // catchment radius in km
  createdByUid?: string;
  memberUids?: string[];
  createdAt?: number;
}

export interface AIReasoningItem {
  agentName: string;
  timestamp: number;
  decision: string;
  reasoning: string;
}

export interface IssueStatusHistoryItem {
  status: IssueStatus;
  timestamp: number;
  updatedBy: string;
  note?: string;
}

export interface Issue {
  id: string;
  communityId: string;
  title: string;
  description: string;
  category: string;
  severity: IssueSeverity;
  status: IssueStatus;
  isAnonymous: boolean;
  lat: number;
  lng: number;
  mediaUrls: string[];
  reporterUid: string;
  reporterName: string;
  reporterPhoto?: string;
  aiReasoningLog?: AIReasoningItem[];
  routingTag?: string;
  createdAt: number;
  upvoterUids?: string[];
  upvoteCount: number;
  statusHistory?: IssueStatusHistoryItem[];
  resolutionSummary?: string;
  resolutionImage?: string;
}

export interface Comment {
  id: string;
  issueId: string;
  communityId?: string;
  uid: string;
  userName: string;
  userPhotoURL?: string;
  text: string;
  createdAt: number;
  isStaff?: boolean;
}

export interface ChatMessage {
  id: string;
  communityId: string;
  uid: string;
  userName: string;
  userPhotoURL?: string;
  text: string;
  type: 'text' | 'issueShare';
  linkedIssueId?: string;
  linkedIssueTitle?: string;
  createdAt: number;
  moderationStatus?: string;
}

export interface Notification {
  id: string;
  uid: string;
  communityId: string;
  title: string;
  message: string;
  type: 'issue_escalation' | 'chat_message' | 'issue_update' | string;
  linkedIssueId?: string;
  isRead: boolean;
  createdAt: number;
}

export type CivicNotification = Notification;

export interface Badge {
  id: string;
  name: string;
  iconUrl: string;
}

export const STATIC_BADGES: Badge[] = [
  {
    id: 'neighborhood_hero',
    name: 'Neighborhood Hero',
    iconUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=hero&backgroundColor=3b82f6'
  },
  {
    id: 'first_responder',
    name: 'First Responder',
    iconUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=responder&backgroundColor=ef4444'
  },
  {
    id: 'civic_champion',
    name: 'Civic Champion',
    iconUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=champion&backgroundColor=10b981'
  },
  {
    id: 'guardian_angel',
    name: 'Guardian Angel',
    iconUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=guardian&backgroundColor=f59e0b'
  },
  {
    id: 'vigilant_eye',
    name: 'Vigilant Eye',
    iconUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=eye&backgroundColor=8b5cf6'
  },
  {
    id: 'consensus_builder',
    name: 'Consensus Builder',
    iconUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=builder&backgroundColor=ec4899'
  },
  {
    id: 'master_repairer',
    name: 'Master Repairer',
    iconUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=repairer&backgroundColor=14b8a6'
  }
];
