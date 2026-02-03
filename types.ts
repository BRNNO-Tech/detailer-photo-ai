
export enum AppStep {
  DASHBOARD = 'DASHBOARD',
  SELECT_SERVICE = 'SELECT_SERVICE',
  CHECKLIST = 'CHECKLIST',
  UPLOAD = 'UPLOAD',
  PROCESSING = 'PROCESSING',
  BEFORE_AFTER = 'BEFORE_AFTER',
  SOCIAL_PACK = 'SOCIAL_PACK',
  VIDEO_LAB = 'VIDEO_LAB',
  VIDEO_PROCESSING = 'VIDEO_PROCESSING',
  VIDEO_EDIT = 'VIDEO_EDIT',
  EXPORT = 'EXPORT',
  SETTINGS = 'SETTINGS'
}

export type ProjectStatus = 'Completed' | 'Draft' | 'Needs Photos';

export interface Service {
  id: string;
  name: string;
  description: string;
  icon: string;
  checklist: string[];
}

export interface SocialData {
  captions: string[];
  hashtags: string[];
  tiktokScript: string;
  postingTimes: string[];
}

export interface VideoCreative {
  script: string;
  sceneDescription: string;
  suggestedMusicMood: string;
  hook: string;
}

export interface Project {
  id: string;
  serviceId: string;
  originalImage: string | null;
  editedImage: string | null;
  date: string;
  status: ProjectStatus;
  socialData?: SocialData;
  videoCreative?: VideoCreative;
  generatedVideoUrl?: string;
  editingConfig?: VideoEditingConfig;
}

export interface VideoEditingConfig {
  filter: string;
  textOverlay: string;
  textPosition: 'top' | 'middle' | 'bottom';
  trimStart: number;
  trimEnd: number;
  textColor: string;
  fontSize: number;
  textBackground: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  playbackSpeed: number;
  isMuted: boolean;
}

export type CaptionTone = 'Friendly' | 'Professional' | 'Luxury' | 'Hype' | 'Short & punchy';

export interface UserSettings {
  defaultServiceId: string;
  captionTone: CaptionTone;
  autoSaveToGallery: boolean;
  autoGenerateTikTok: boolean;
  autoPairPhotos: boolean;
}

export type VideoStyle = 'transformation' | 'cinematic' | 'satisfying' | 'pure_promo';
