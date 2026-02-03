/**
 * MVP usage limits (client-side). Reset monthly.
 * Free: 3 completed projects/month, 5 AI calls/month, 10 projects in gallery.
 */

const STORAGE_USER_ID = 'detailerPro_userId';
const STORAGE_USAGE = 'detailerPro_usage';

export const FREE_PROJECTS_PER_MONTH = 3;
export const FREE_AI_CALLS_PER_MONTH = 15;
export const FREE_GALLERY_SIZE = 10;

export interface Usage {
  month: string;
  projectsCompleted: number;
  aiCalls: number;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function randomId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getOrCreateUserId(): string {
  let id = localStorage.getItem(STORAGE_USER_ID);
  if (!id) {
    id = randomId();
    localStorage.setItem(STORAGE_USER_ID, id);
  }
  return id;
}

export function getUsage(): Usage {
  try {
    const raw = localStorage.getItem(STORAGE_USAGE);
    if (raw) {
      const parsed = JSON.parse(raw) as Usage;
      if (parsed.month && typeof parsed.projectsCompleted === 'number' && typeof parsed.aiCalls === 'number') {
        return parsed;
      }
    }
  } catch (_) {}
  return {
    month: currentMonth(),
    projectsCompleted: 0,
    aiCalls: 0,
  };
}

export function resetUsageIfNewMonth(): Usage {
  const usage = getUsage();
  const now = currentMonth();
  if (usage.month !== now) {
    const fresh: Usage = { month: now, projectsCompleted: 0, aiCalls: 0 };
    localStorage.setItem(STORAGE_USAGE, JSON.stringify(fresh));
    return fresh;
  }
  return usage;
}

export function saveUsage(usage: Usage): void {
  localStorage.setItem(STORAGE_USAGE, JSON.stringify(usage));
}

export function incrementUsage(type: 'projectsCompleted' | 'aiCalls'): void {
  const usage = resetUsageIfNewMonth();
  if (type === 'projectsCompleted') {
    usage.projectsCompleted += 1;
  } else {
    usage.aiCalls += 1;
  }
  saveUsage(usage);
}

export function canCompleteProject(): boolean {
  const usage = resetUsageIfNewMonth();
  return usage.projectsCompleted < FREE_PROJECTS_PER_MONTH;
}

export function canMakeAICall(): boolean {
  const usage = resetUsageIfNewMonth();
  return usage.aiCalls < FREE_AI_CALLS_PER_MONTH;
}

export function getUsageDisplay(): { projects: string; ai: string } {
  const usage = resetUsageIfNewMonth();
  return {
    projects: `${usage.projectsCompleted}/${FREE_PROJECTS_PER_MONTH} projects this month`,
    ai: `${usage.aiCalls}/${FREE_AI_CALLS_PER_MONTH} AI generations this month`,
  };
}
