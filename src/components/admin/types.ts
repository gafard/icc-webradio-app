export type ModerationCaseStatus = 'open' | 'reviewing' | 'actioned' | 'dismissed';
export type ModerationTargetType = 'post' | 'comment' | 'group' | 'user';
export type ModerationActionType =
  | 'hide'
  | 'unhide'
  | 'remove'
  | 'dismiss'
  | 'warn'
  | 'suspend_device'
  | 'ban_device'
  | 'ban_user';

export type ModerationQueueSort = 'risk' | 'recent';

export type QueueItem = {
  id: string;
  targetType: ModerationTargetType;
  targetId: string;
  status: ModerationCaseStatus;
  riskScore: number;
  reportsCount: number;
  lastReportedAt: string | null;
  assignedTo: string | null;
  updatedAt: string | null;
  preview: {
    title: string;
    subtitle: string;
    content: string;
    authorName: string | null;
    authorDeviceId: string | null;
    createdAt: string | null;
    visibility: string | null;
    moderationStatus: string | null;
  };
};

export type CaseReport = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: string | null;
  message: string | null;
  status: string;
  reporterUserId: string | null;
  reporterDeviceId: string | null;
  createdAt: string;
};

export type CaseAction = {
  id: string;
  caseId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  note: string | null;
  adminUserId: string | null;
  adminActor: string | null;
  createdAt: string;
  metadata: Record<string, any>;
};

export type CaseDetail = {
  item: QueueItem;
  reports: CaseReport[];
  actions: CaseAction[];
};
