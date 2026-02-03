// Types pour les fonctionnalités spirituelles

export interface PrayerEntry {
  id: string;
  title: string;
  content: string;
  date: string; // ISO string
  answered?: boolean;
  answerDate?: string; // ISO string
  answer?: string;
  category: string;
  tags: string[];
  userId?: string;
}

export interface ReadingPlan {
  id: string;
  title: string;
  description: string;
  days: number;
  dailyVerses: string[];
  schedule?: string[][];
  completed: boolean;
  startDate?: string; // ISO string
  currentDay?: number;
  planKey?: string;
  planCategory?: string;
  mode?: 'auto' | 'manual';
  templateId?: string;
  templateSource?: 'official' | 'community' | 'personal';
  userId?: string;
}

export interface SpiritualChallenge {
  id: string;
  title: string;
  description: string;
  duration: number; // jours
  startDate: string; // ISO string
  endDate: string; // ISO string
  completed: boolean;
  dailyTasks: DailyTask[];
  progress: number;
  category?: string;
  difficulty?: 'facile' | 'moyen' | 'difficile';
  frequency?: 'quotidien' | 'hebdo';
  templateId?: string;
  templateSource?: 'official' | 'community' | 'personal';
  userId?: string;
}

export interface DailyTask {
  id: string;
  challengeId: string;
  day: number;
  title: string;
  completed: boolean;
  completedDate?: string; // ISO string
}

export interface BibleVerse {
  id: string;
  reference: string;
  text: string;
  version?: string;
  userId?: string;
}

export interface PrayerRequest {
  id: string;
  content: string;
  location?: {
    latitude: number;
    longitude: number;
    city: string;
  };
  date: string; // ISO string
  prayedForCount: number;
  status: 'requested' | 'prayed' | 'answered';
  userId?: string;
}

export interface SpiritualProgress {
  id: string;
  userId: string;
  date: string; // ISO string
  prayerCount: number;
  readingCount: number;
  challengeCompleted: number;
  notes: string;
}

export type TemplateVisibility = 'private' | 'public' | 'official';
export type TemplateType = 'plan' | 'challenge';

export interface SpiritualTemplate {
  id: string;
  type: TemplateType;
  title: string;
  description: string;
  days?: number;
  scheduleMode?: 'auto' | 'calendar';
  planKey?: string;
  schedule?: string[][];
  duration?: number;
  taskList?: string[];
  category?: string;
  difficulty?: 'facile' | 'moyen' | 'difficile';
  frequency?: 'quotidien' | 'hebdo';
  visibility: TemplateVisibility;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface SpiritualReport {
  id: string;
  targetId: string;
  targetType: TemplateType;
  reason: string;
  createdAt: string;
  createdBy?: string;
}
