
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AppStep, Service, Project, ProjectStatus, SocialData, UserSettings, CaptionTone, VideoStyle, VideoEditingConfig, VideoCreative } from './types.ts';
import { SERVICES } from './constants.tsx';
import { enhanceImageWithAI, generateSocialPack, regenerateSingleCaption, generateVideoCreative, detectPhotoPairs } from './geminiService.ts';
import { generateDetailerVideo } from './videoService.ts';
import Layout from './components/Layout.tsx';
import {
  canCompleteProject,
  canMakeAICall,
  incrementUsage,
  resetUsageIfNewMonth,
  getOrCreateUserId,
  FREE_PROJECTS_PER_MONTH,
  FREE_AI_CALLS_PER_MONTH,
  FREE_GALLERY_SIZE,
  getUsageDisplay,
} from './usageLimits.ts';

// --- Types for Pairing ---
interface PhotoPair {
  id: string;
  before: string;
  after: string;
}

function getApiErrorMessage(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('api_key') || m.includes('api key')) return 'Please check your Gemini API key in .env.local';
  if (m.includes('quota') || m.includes('limit')) return 'API quota reached. Try again later.';
  if (m.includes('model') || m.includes('not found')) return 'This feature may be unavailable. Try again later.';
  return raw.length > 120 ? raw.slice(0, 120) + '…' : raw;
}

// --- Main App ---

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.DASHBOARD);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [completedChecklist, setCompletedChecklist] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [pairs, setPairs] = useState<PhotoPair[]>([]);
  const [processingMessage, setProcessingMessage] = useState("Analyzing photos...");
  const [isLoading, setIsLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallReason, setPaywallReason] = useState<'projects' | 'ai' | null>(null);
  
  // Video Lab specific
  const [selectedVideoStyle, setSelectedVideoStyle] = useState<VideoStyle | null>(null);
  const [videoPromptText, setVideoPromptText] = useState("");
  const [videoCreative, setVideoCreative] = useState<VideoCreative | null>(null);
  const [isBrainstorming, setIsBrainstorming] = useState(false);
  const [videoProgress, setVideoProgress] = useState<{ status: string; progress?: number } | null>(null);

  const [editingConfig, setEditingConfig] = useState<VideoEditingConfig>({
    filter: 'none',
    textOverlay: '',
    textPosition: 'bottom',
    trimStart: 0,
    trimEnd: 100,
    textColor: '#ffffff',
    fontSize: 32,
    textBackground: true,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    playbackSpeed: 1,
    isMuted: true,
  });

  // Settings State - Load from localStorage on mount
  const [userSettings, setUserSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('detailerPro_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved settings', e);
      }
    }
    return {
      defaultServiceId: 'full_detail',
      captionTone: 'Professional',
      autoSaveToGallery: true,
      autoGenerateTikTok: true,
      autoPairPhotos: true,
    };
  });

  // Profile (avatar + display name) - Load from localStorage on mount
  const [userName, setUserName] = useState<string>(() => localStorage.getItem('detailerPro_userName') ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string>(() => localStorage.getItem('detailerPro_avatar') ?? '');
  useEffect(() => {
    if (userName === '') localStorage.removeItem('detailerPro_userName');
    else localStorage.setItem('detailerPro_userName', userName);
  }, [userName]);
  useEffect(() => {
    if (avatarUrl === '') localStorage.removeItem('detailerPro_avatar');
    else localStorage.setItem('detailerPro_avatar', avatarUrl);
  }, [avatarUrl]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Recent Projects - Load from localStorage on mount (cap at FREE_GALLERY_SIZE)
  const [recentProjects, setRecentProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('detailerPro_projects');
    if (saved) {
      try {
        const projects = JSON.parse(saved);
        const filtered = projects.filter((p: Project) => 
          p.originalImage && 
          !p.originalImage.includes('unsplash.com') &&
          (p.originalImage.startsWith('data:') || p.originalImage.startsWith('blob:'))
        );
        return filtered.slice(0, FREE_GALLERY_SIZE);
      } catch (e) {
        console.error('Failed to parse saved projects', e);
      }
    }
    return [];
  });

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('detailerPro_settings', JSON.stringify(userSettings));
  }, [userSettings]);

  // Save projects to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('detailerPro_projects', JSON.stringify(recentProjects));
  }, [recentProjects]);

  // Usage limits: ensure anonymous ID and monthly usage exist
  useEffect(() => {
    getOrCreateUserId();
    resetUsageIfNewMonth();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') {
        return;
      }

      // Escape key - go back or to dashboard
      if (e.key === 'Escape') {
        if (step === AppStep.DASHBOARD) return;
        if (step === AppStep.SELECT_SERVICE || step === AppStep.CHECKLIST || step === AppStep.UPLOAD) {
          reset();
        } else if (step === AppStep.VIDEO_LAB) {
          setSelectedVideoStyle(null);
        } else {
          setStep(AppStep.DASHBOARD);
        }
      }

      // Ctrl/Cmd + S - Save/Export
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (currentProject && (step === AppStep.SOCIAL_PACK || step === AppStep.VIDEO_EDIT)) {
          handleExport();
        }
      }

      // Ctrl/Cmd + K - Open settings
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setStep(AppStep.SETTINGS);
      }

      // Number keys for quick navigation (when on dashboard)
      if (step === AppStep.DASHBOARD && e.key >= '1' && e.key <= '6') {
        const serviceIndex = parseInt(e.key) - 1;
        if (SERVICES[serviceIndex]) {
          handleStartService(SERVICES[serviceIndex]);
          setStep(AppStep.SELECT_SERVICE);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, currentProject]);

  useEffect(() => {
    if (step === AppStep.PROCESSING || step === AppStep.VIDEO_PROCESSING) {
      const photoMsgs = [
        "Analyzing photos...",
        "Detecting before/after shots...",
        "Selecting best angles...",
        "Preparing social content..."
      ];
      const videoMsgs = [
        "Warming up the AI Video Engines...",
        "Simulating light reflections on paint...",
        "Rendering cinematic motion...",
        "Color grading for maximum gloss...",
        "Synthesizing high-fidelity frames..."
      ];
      const messages = step === AppStep.VIDEO_PROCESSING ? videoMsgs : photoMsgs;
      
      let i = 0;
      const interval = setInterval(() => {
        i = (i + 1) % messages.length;
        setProcessingMessage(messages[i]);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [step]);

  // Handle Playback Loop within Trim range
  useEffect(() => {
    if (step === AppStep.VIDEO_EDIT && videoRef.current) {
      const video = videoRef.current;
      video.playbackRate = editingConfig.playbackSpeed;
      video.muted = editingConfig.isMuted;

      const handleTimeUpdate = () => {
        const duration = video.duration || 6;
        const start = (editingConfig.trimStart / 100) * duration;
        const end = (editingConfig.trimEnd / 100) * duration;

        if (video.currentTime < start || video.currentTime >= end) {
          video.currentTime = start;
          if (video.paused) video.play();
        }
      };

      video.addEventListener('timeupdate', handleTimeUpdate);
      return () => video.removeEventListener('timeupdate', handleTimeUpdate);
    }
  }, [editingConfig.trimStart, editingConfig.trimEnd, editingConfig.playbackSpeed, editingConfig.isMuted, step]);

  const handleStartService = (service: Service) => {
    setSelectedService(service);
  };

  const goToChecklist = () => {
    if (selectedService) setStep(AppStep.CHECKLIST);
  };

  const toggleChecklistItem = (item: string) => {
    setCompletedChecklist(prev => 
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  // Safe canvas pixel limit for Safari/mobile (e.g. ~16.7M)
  const MAX_CANVAS_PIXELS = 16e6;

  // Compress image before upload
  const compressImage = (file: File, maxWidth: number = 1920, quality: number = 0.85): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Cap by max width first
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          // Cap total pixels for Safari/mobile canvas limits
          if (width * height > MAX_CANVAS_PIXELS) {
            const scale = Math.sqrt(MAX_CANVAS_PIXELS / (width * height));
            width = Math.floor(width * scale);
            height = Math.floor(height * scale);
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleMultipleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const validFiles: File[] = [];
    const errors: string[] = [];

    // Validate files
    Array.from(files).forEach((file) => {
      // Check file type
      if (!file.type.startsWith('image/')) {
        errors.push(`${file.name}: Not an image file`);
        return;
      }

      // Check file size (max 10MB before compression)
      if (file.size > 10 * 1024 * 1024) {
        errors.push(`${file.name}: File too large (max 10MB)`);
        return;
      }

      validFiles.push(file);
    });

    if (errors.length > 0) {
      triggerErrorToast(errors.join('. '));
    }

    if (validFiles.length === 0) return;

    // Process and compress images sequentially (reduces OOM on mobile)
    setIsLoading(true);
    const compressedImages: string[] = [];
    let failedCount = 0;

    for (const file of validFiles) {
      try {
        const dataUrl = await compressImage(file);
        compressedImages.push(dataUrl);
      } catch (err) {
        console.error('Error compressing image:', file.name, err);
        failedCount += 1;
      }
    }

    if (compressedImages.length > 0) {
      setUploadedFiles(prev => [...prev, ...compressedImages]);
      triggerToast();
    }

    if (failedCount > 0) {
      const message =
        compressedImages.length > 0
          ? `${compressedImages.length} photo(s) added; ${failedCount} could not be processed. Try smaller images or JPG/PNG.`
          : "Couldn't process one or more photos. Try smaller images or JPG/PNG.";
      triggerErrorToast(message);
    }

    setIsLoading(false);
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const videoUrl = URL.createObjectURL(file);
      const projectData: Project = {
        id: Date.now().toString(),
        serviceId: 'video_lab_upload',
        originalImage: null,
        editedImage: null,
        date: new Date().toLocaleDateString(),
        status: 'Draft',
        generatedVideoUrl: videoUrl,
        editingConfig: editingConfig
      };
      setCurrentProject(projectData);
      setStep(AppStep.VIDEO_EDIT);
    }
  };

  const deleteUploadedFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const startProcessing = async () => {
    if (uploadedFiles.length === 0) return;
    setStep(AppStep.PROCESSING);
    setIsLoading(true);

    try {
      let detectedPairs: PhotoPair[] = [];
      
      if (userSettings.autoPairPhotos && uploadedFiles.length >= 2) {
        if (!canMakeAICall()) {
          setPaywallReason('ai');
          setShowPaywall(true);
          setIsLoading(false);
          setStep(AppStep.DASHBOARD);
          return;
        }
        try {
          const aiPairs = await detectPhotoPairs([...uploadedFiles]);
          incrementUsage('aiCalls');
          detectedPairs = aiPairs.map(pair => ({
            id: Math.random().toString(36).substr(2, 9),
            before: pair.before,
            after: pair.after
          }));
        } catch (pairError) {
          console.warn('AI pairing failed, using sequential fallback:', pairError);
          for (let i = 0; i < uploadedFiles.length; i += 2) {
            if (uploadedFiles[i+1]) {
              detectedPairs.push({
                id: Math.random().toString(36).substr(2, 9),
                before: uploadedFiles[i],
                after: uploadedFiles[i+1]
              });
            }
          }
        }
      } else {
        // Sequential pairing if auto-pairing is disabled
        for (let i = 0; i < uploadedFiles.length; i += 2) {
          if (uploadedFiles[i+1]) {
            detectedPairs.push({
              id: Math.random().toString(36).substr(2, 9),
              before: uploadedFiles[i],
              after: uploadedFiles[i+1]
            });
          }
        }
      }

      const mainImage = detectedPairs[0]?.after || uploadedFiles[0];
      if (!canMakeAICall()) {
        setPaywallReason('ai');
        setShowPaywall(true);
        setIsLoading(false);
        setStep(AppStep.DASHBOARD);
        return;
      }
      const enhanced = await enhanceImageWithAI(mainImage, selectedService?.name || 'General Detail');
      incrementUsage('aiCalls');
      if (!canMakeAICall()) {
        setPaywallReason('ai');
        setShowPaywall(true);
        setIsLoading(false);
        setStep(AppStep.DASHBOARD);
        return;
      }
      const social = await generateSocialPack(mainImage, selectedService?.name || 'General Detail');
      incrementUsage('aiCalls');
      
      const newProject: Project = {
        id: Date.now().toString(),
        serviceId: selectedService?.id || 'unknown',
        originalImage: mainImage,
        editedImage: enhanced,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        status: 'Draft',
        socialData: social,
        editingConfig: editingConfig
      };

      setCurrentProject(newProject);
      setPairs(detectedPairs);
      
      setTimeout(() => {
        setStep(AppStep.BEFORE_AFTER);
        setIsLoading(false);
      }, 2000);
    } catch (err: any) {
      console.error('Processing error:', err);
      triggerErrorToast(getApiErrorMessage(err?.message || 'Processing failed. Please try again.'));
      setStep(AppStep.DASHBOARD);
      setIsLoading(false);
    }
  };

  const brainstormVideoCreative = async () => {
    if (!selectedVideoStyle) return;
    if (!canMakeAICall()) {
      setPaywallReason('ai');
      setShowPaywall(true);
      return;
    }
    setIsBrainstorming(true);
    try {
      const img = uploadedFiles[0] || (currentProject?.editedImage || currentProject?.originalImage);
      const creative = await generateVideoCreative(selectedVideoStyle, img || null, selectedService?.name || "Professional Auto Detailing");
      incrementUsage('aiCalls');
      setVideoCreative(creative);
      setVideoPromptText(creative.sceneDescription);
      setEditingConfig(prev => ({ ...prev, textOverlay: creative.hook }));
    } catch (e: any) {
      console.error('Brainstorm error:', e);
      triggerErrorToast(getApiErrorMessage(e?.message || 'Failed to brainstorm creative direction.'));
    } finally {
      setIsBrainstorming(false);
    }
  };

  const startVideoGeneration = async (style: VideoStyle) => {
    if (!canMakeAICall()) {
      setPaywallReason('ai');
      setShowPaywall(true);
      return;
    }
    setStep(AppStep.VIDEO_PROCESSING);
    
    try {
      let beforeImg = null;
      let afterImg = null;

      if (currentProject) {
        beforeImg = pairs[0]?.before || currentProject.originalImage;
        afterImg = pairs[0]?.after || currentProject.editedImage;
      } else if (uploadedFiles.length > 0) {
        beforeImg = uploadedFiles[0];
        afterImg = uploadedFiles[1] || uploadedFiles[0];
      }
      
      const finalPrompt = videoPromptText || selectedService?.name || "Professional Detail";
      setVideoProgress({ status: 'Initializing...', progress: 0 });
      
      const videoUrl = await generateDetailerVideo(
        style, 
        beforeImg, 
        afterImg, 
        finalPrompt,
        (progress) => setVideoProgress(progress)
      );
      
      setVideoProgress({ status: 'Complete!', progress: 100 });
      
      const projectData: Project = currentProject ? { ...currentProject, generatedVideoUrl: videoUrl, videoCreative: videoCreative || undefined } : {
        id: Date.now().toString(),
        serviceId: 'video_lab',
        originalImage: afterImg,
        editedImage: null,
        date: new Date().toLocaleDateString(),
        status: 'Completed',
        generatedVideoUrl: videoUrl,
        editingConfig: editingConfig,
        videoCreative: videoCreative || undefined
      };
      
      incrementUsage('aiCalls');
      setCurrentProject(projectData);
      setStep(AppStep.VIDEO_EDIT);
    } catch (e: any) {
      console.error('Video generation error:', e);
      triggerErrorToast(getApiErrorMessage(e?.message || 'Video generation failed.'));
      setStep(AppStep.VIDEO_LAB);
    }
  };

  // Export utilities
  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadText = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadVideo = async (videoUrl: string, filename: string) => {
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading video:', error);
      triggerErrorToast('Failed to download video. Please try again.');
    }
  };

  const exportProjectAssets = () => {
    if (!currentProject) return;

    const projectName = `detailer-pro-${currentProject.id}`;
    
    // Export enhanced image
    if (currentProject.editedImage) {
      downloadImage(currentProject.editedImage, `${projectName}-enhanced.jpg`);
    }

    // Export original image
    if (currentProject.originalImage) {
      downloadImage(currentProject.originalImage, `${projectName}-original.jpg`);
    }

    // Export video if available
    if (currentProject.generatedVideoUrl) {
      downloadVideo(currentProject.generatedVideoUrl, `${projectName}-video.mp4`);
    }

    // Export social pack as JSON
    if (currentProject.socialData) {
      const socialPack = {
        captions: currentProject.socialData.captions,
        hashtags: currentProject.socialData.hashtags,
        tiktokScript: currentProject.socialData.tiktokScript,
        postingTimes: currentProject.socialData.postingTimes,
        service: SERVICES.find(s => s.id === currentProject.serviceId)?.name || 'Unknown',
        date: currentProject.date
      };
      downloadText(JSON.stringify(socialPack, null, 2), `${projectName}-social-pack.json`);
    }

    // Export social pack as text file (more readable)
    if (currentProject.socialData) {
      const textContent = `DETAILER PRO - SOCIAL MEDIA PACK
${'='.repeat(50)}

SERVICE: ${SERVICES.find(s => s.id === currentProject.serviceId)?.name || 'Unknown'}
DATE: ${currentProject.date}

CAPTIONS:
${currentProject.socialData.captions.map((cap, i) => `${i + 1}. ${cap}`).join('\n\n')}

HASHTAGS:
${currentProject.socialData.hashtags.join(' ')}

TIKTOK SCRIPT:
${currentProject.socialData.tiktokScript}

POSTING TIMES:
${currentProject.socialData.postingTimes.join(', ')}
`;
      downloadText(textContent, `${projectName}-social-pack.txt`);
    }

    triggerToast();
  };

  const swapPair = (pairId: string) => {
    setPairs(prev => prev.map(p => {
      if (p.id === pairId) {
        return { ...p, before: p.after, after: p.before };
      }
      return p;
    }));
  };

  const deletePair = (pairId: string) => {
    setPairs(prev => prev.filter(p => p.id !== pairId));
  };

  const handleExport = () => {
    if (!canCompleteProject()) {
      setPaywallReason('projects');
      setShowPaywall(true);
      return;
    }
    if (currentProject) {
      const finishedProject = { ...currentProject, status: 'Completed' as ProjectStatus, editingConfig };
      setRecentProjects(prev => {
        const filtered = prev.filter(p => p.id !== finishedProject.id);
        return [finishedProject, ...filtered].slice(0, FREE_GALLERY_SIZE);
      });
      incrementUsage('projectsCompleted');
    }
    setStep(AppStep.EXPORT);
  };

  const triggerToast = useCallback(() => {
    setToastType('success');
    setToastMessage('Copied to Clipboard!');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }, []);
  const triggerErrorToast = useCallback((message: string) => {
    setToastType('error');
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 5000);
  }, []);

  const reset = () => {
    setStep(AppStep.DASHBOARD);
    setSelectedService(null);
    setCurrentProject(null);
    setCompletedChecklist([]);
    setUploadedFiles([]);
    setPairs([]);
    setSelectedVideoStyle(null);
    setVideoPromptText("");
    setVideoCreative(null);
    setEditingConfig({
      filter: 'none',
      textOverlay: '',
      textPosition: 'bottom',
      trimStart: 0,
      trimEnd: 100,
      textColor: '#ffffff',
      fontSize: 32,
      textBackground: true,
      brightness: 100,
      contrast: 100,
      saturation: 100,
      playbackSpeed: 1,
      isMuted: true,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    triggerToast();
  };

  const updateCaption = (index: number, newText: string) => {
    if (!currentProject || !currentProject.socialData) return;
    const newCaptions = [...currentProject.socialData.captions];
    newCaptions[index] = newText;
    setCurrentProject({
      ...currentProject,
      socialData: {
        ...currentProject.socialData,
        captions: newCaptions
      }
    });
  };

  const handleRegenerateCaption = async (index: number) => {
    if (!currentProject || !currentProject.originalImage) return;
    if (!canMakeAICall()) {
      setPaywallReason('ai');
      setShowPaywall(true);
      return;
    }
    setRegeneratingIndex(index);
    try {
      const newCap = await regenerateSingleCaption(currentProject.originalImage, selectedService?.name || 'Professional Detail');
      incrementUsage('aiCalls');
      updateCaption(index, newCap);
    } catch (e: any) {
      console.error("Failed to regenerate caption", e);
      triggerErrorToast(getApiErrorMessage(e?.message || 'Failed to regenerate caption.'));
    } finally {
      setRegeneratingIndex(null);
    }
  };

  const updateSettings = (key: keyof UserSettings, value: any) => {
    setUserSettings(prev => ({ ...prev, [key]: value }));
  };

  const getFullFilterStyle = (config: VideoEditingConfig) => {
    let base = "";
    switch (config.filter) {
      case 'cinematic': base = 'contrast(1.2) brightness(0.9) saturate(1.1)'; break;
      case 'golden': base = 'sepia(0.3) brightness(1.1) saturate(1.4) hue-rotate(-10deg)'; break;
      case 'grayscale': base = 'grayscale(1)'; break;
      case 'cool': base = 'hue-rotate(180deg) saturate(0.8) brightness(1.1)'; break;
      case 'high_gloss': base = 'contrast(1.4) brightness(1.1) saturate(1.5)'; break;
      default: base = 'none'; break;
    }
    const adj = `brightness(${config.brightness}%) contrast(${config.contrast}%) saturate(${config.saturation}%)`;
    return base === 'none' ? adj : `${base} ${adj}`;
  };

  const onSettings = useCallback(() => setStep(AppStep.SETTINGS), []);
  const onPhotoJob = useCallback(() => setStep(AppStep.SELECT_SERVICE), []);
  const onVideoLab = useCallback(() => setStep(AppStep.VIDEO_LAB), []);
  const onStartDefaultService = useCallback(() => {
    const s = SERVICES.find((sv) => sv.id === userSettings.defaultServiceId);
    if (s) {
      handleStartService(s);
      setStep(AppStep.SELECT_SERVICE);
    }
  }, [userSettings.defaultServiceId]);

  return (
    <Layout
      onHome={reset}
      onSettings={onSettings}
      userName={userName}
      avatarUrl={avatarUrl}
      onUserNameChange={setUserName}
      onAvatarChange={setAvatarUrl}
      recentProjectsCount={recentProjects.length}
      defaultServiceName={SERVICES.find((s) => s.id === userSettings.defaultServiceId)?.name ?? 'Photo Job'}
      captionTone={userSettings.captionTone}
      usageDisplay={getUsageDisplay()}
      onStartDefaultService={onStartDefaultService}
      onPhotoJob={onPhotoJob}
      onVideoLab={onVideoLab}
    >
      {showToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] animate-fadeInUp">
          <div className={`px-6 py-3 rounded-2xl font-bold shadow-2xl flex items-center gap-3 border ${toastType === 'error' ? 'bg-red-600 text-white border-red-700' : 'bg-slate-900 text-white border-slate-700'}`}>
            {toastType === 'error' ? <span className="text-red-200">!</span> : <span className="text-green-400">✓</span>}
            {toastMessage}
          </div>
        </div>
      )}

      {showPaywall && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 border border-slate-200">
            <div className="text-center space-y-4">
              <div className="text-4xl">🔒</div>
              <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">
                Monthly limit reached
              </h3>
              <p className="text-slate-600 text-sm">
                {paywallReason === 'projects'
                  ? `You've used your ${FREE_PROJECTS_PER_MONTH} free completed projects this month. Limits reset at the start of each month.`
                  : `You've used your ${FREE_AI_CALLS_PER_MONTH} free AI generations this month. Limits reset at the start of each month.`}
              </p>
              <p className="text-xs text-slate-400">
                {getUsageDisplay().projects} · {getUsageDisplay().ai}
              </p>
              <div className="flex flex-col gap-3 pt-2">
                <a
                  href="mailto:hello@detailerpro.ai?subject=Get%20Unlimited"
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase italic tracking-tighter hover:bg-blue-700 transition-colors"
                >
                  Get unlimited
                </a>
                <button
                  type="button"
                  onClick={() => { setShowPaywall(false); setPaywallReason(null); }}
                  className="w-full py-3 text-slate-600 font-bold text-sm uppercase tracking-tighter hover:text-slate-900"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === AppStep.DASHBOARD && (
        <div className="space-y-12 animate-fadeIn">
          <section className="bg-slate-900 rounded-[40px] p-12 text-white overflow-hidden relative shadow-2xl shadow-slate-300">
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
              <div className="space-y-8 text-center md:text-left flex-1">
                <div className="inline-flex items-center gap-2 bg-blue-500/20 px-3 py-1 rounded-full text-blue-400 text-[10px] font-black uppercase tracking-[0.2em]">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span> Studio Active
                </div>
                <div className="space-y-3">
                  <h2 className="text-5xl font-black tracking-tighter leading-[0.9] uppercase italic">AI Content Hub</h2>
                  <p className="text-slate-400 text-xl font-medium max-w-md">
                    Precision tools for detailing entrepreneurs.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button 
                    onClick={() => setStep(AppStep.SELECT_SERVICE)}
                    className="bg-white text-slate-900 px-10 py-5 rounded-[28px] font-black shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-3 uppercase italic tracking-tighter text-lg"
                  >
                    <span>📸</span> Photo Job
                  </button>
                  <button 
                    onClick={() => setStep(AppStep.VIDEO_LAB)}
                    className="bg-blue-600 text-white px-10 py-5 rounded-[28px] font-black shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-3 uppercase italic tracking-tighter text-lg"
                  >
                    <span>🎥</span> Video Lab
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Studio Gallery</h3>
              {recentProjects.length > 0 && (
                <button 
                  onClick={() => {
                    if (confirm('Clear all projects from gallery?')) {
                      setRecentProjects([]);
                    }
                  }}
                  className="text-xs font-black uppercase text-slate-400 hover:text-red-500 tracking-widest transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {recentProjects.length === 0 && (
                <p className="col-span-full text-center text-slate-500 py-12 font-medium">
                  No projects yet. Start a Photo Job or Video Lab to see them here.
                </p>
              )}
              {recentProjects.map((p) => (
                <div key={p.id} className="group bg-white rounded-[45px] border border-slate-200/50 overflow-hidden hover:shadow-2xl transition-all relative">
                  <div className="aspect-[4/3] relative overflow-hidden bg-slate-100">
                    <img src={p.originalImage || ''} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="Job" />
                    <div className="absolute top-6 right-6 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] bg-slate-900/80 text-white border border-slate-700">
                      {p.status}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Delete this project?')) {
                          setRecentProjects(prev => prev.filter(proj => proj.id !== p.id));
                        }
                      }}
                      className="absolute top-6 left-6 w-8 h-8 rounded-full bg-red-500/80 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete project"
                    >
                      ×
                    </button>
                  </div>
                  <div className="p-8">
                    <h4 className="font-black text-slate-900 text-xl leading-tight uppercase italic tracking-tighter">
                      {SERVICES.find(s => s.id === p.serviceId)?.name || 'Detaling Clip'}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">{p.date}</p>
                  </div>
                </div>
              ))}
              <button 
                onClick={() => setStep(AppStep.SELECT_SERVICE)}
                className="aspect-[4/3] rounded-[45px] border-4 border-dashed border-slate-200 flex flex-col items-center justify-center gap-4 text-slate-300 hover:border-blue-400 hover:text-blue-500 transition-all"
              >
                <span className="text-5xl">+</span>
                <span className="font-black uppercase italic tracking-tighter text-sm">New Creation</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {step === AppStep.SELECT_SERVICE && (
        <div className="max-w-4xl mx-auto space-y-12 animate-fadeIn">
          <button onClick={reset} className="text-sm font-black uppercase text-slate-400 hover:text-slate-600 tracking-widest">← Back</button>
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-black text-slate-900 uppercase italic tracking-tighter">Choose Your Service</h2>
            <p className="text-slate-500 font-medium">Select a job to load its custom photo checklist.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICES.map((s) => (
              <button 
                key={s.id}
                onClick={() => handleStartService(s)}
                className={`relative group p-8 rounded-[38px] border-2 transition-all ${
                  selectedService?.id === s.id ? 'border-blue-600 bg-blue-50/40' : 'border-slate-200/80 bg-white'
                }`}
              >
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-3xl mb-4">{s.icon}</div>
                <h4 className="font-black text-xl mb-1 uppercase italic tracking-tighter text-slate-800">{s.name}</h4>
                <p className="text-xs text-slate-400 font-medium">{s.description}</p>
              </button>
            ))}
          </div>
          <div className="flex flex-col items-center pt-10">
            <button 
              disabled={!selectedService}
              onClick={goToChecklist}
              className="w-full max-w-sm py-5 rounded-3xl font-black text-xl bg-blue-600 text-white shadow-2xl uppercase italic tracking-tighter"
            >
              Start Checklist →
            </button>
          </div>
        </div>
      )}

      {step === AppStep.CHECKLIST && selectedService && (
        <div className="max-w-xl mx-auto space-y-10 animate-fadeIn">
          <button onClick={() => setStep(AppStep.SELECT_SERVICE)} className="text-sm font-black uppercase text-slate-400 hover:text-slate-600 tracking-widest">← Back</button>
          <h2 className="text-3xl font-black text-slate-900 italic uppercase tracking-tighter text-center">Photo Checklist: {selectedService.name}</h2>
          <div className="bg-white rounded-[50px] p-10 border border-slate-200/60 shadow-2xl space-y-4">
            {selectedService.checklist.map((item, i) => (
              <div 
                key={i} 
                onClick={() => toggleChecklistItem(item)}
                className={`flex items-center justify-between p-5 rounded-3xl border cursor-pointer ${
                  completedChecklist.includes(item) ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-100'
                }`}
              >
                <span className="font-black text-sm uppercase tracking-tight">{item}</span>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${completedChecklist.includes(item) ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300'}`}>
                  {completedChecklist.includes(item) && '✓'}
                </div>
              </div>
            ))}
          </div>
          <button 
            disabled={completedChecklist.length < 3}
            onClick={() => setStep(AppStep.UPLOAD)}
            className="w-full py-5 rounded-3xl bg-slate-900 text-white font-black text-xl shadow-2xl uppercase italic tracking-tighter"
          >
            Upload Photos
          </button>
        </div>
      )}

      {step === AppStep.UPLOAD && (
        <div className="max-w-2xl mx-auto space-y-12 animate-fadeIn">
          <button onClick={() => setStep(AppStep.CHECKLIST)} className="text-sm font-black uppercase text-slate-400 hover:text-slate-600 tracking-widest">← Back</button>
          <h2 className="text-4xl font-black text-slate-900 italic uppercase tracking-tighter text-center">Upload Photos</h2>
          <div 
            onClick={() => !isLoading && fileInputRef.current?.click()} 
            className={`bg-white border-2 border-dashed border-slate-200 rounded-[50px] p-24 flex flex-col items-center justify-center transition-all ${
              isLoading ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:bg-slate-50'
            }`}
          >
            <input type="file" multiple accept="image/*" ref={fileInputRef} onChange={handleMultipleFiles} className="hidden" disabled={isLoading} />
            {isLoading ? (
              <>
                <div className="text-6xl mb-4 animate-spin">⏳</div>
                <p className="text-xl font-black uppercase italic tracking-tighter">Compressing images...</p>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">📸</div>
                <p className="text-xl font-black uppercase italic tracking-tighter">Tap to select photos</p>
                <p className="text-xs text-slate-400 mt-2">Max 10MB per file • Images will be compressed</p>
              </>
            )}
          </div>
          {uploadedFiles.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-600">{uploadedFiles.length} photo{uploadedFiles.length !== 1 ? 's' : ''} ready</p>
                <button 
                  onClick={() => setUploadedFiles([])} 
                  className="text-xs font-black uppercase text-red-500 hover:text-red-700"
                >
                  Clear All
                </button>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {uploadedFiles.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border group">
                    <img src={src} className="w-full h-full object-cover" alt={`Upload ${i + 1}`} />
                    <button 
                      onClick={() => deleteUploadedFile(i)} 
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      title="Remove photo"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button 
                onClick={startProcessing} 
                disabled={isLoading}
                className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black text-xl uppercase italic tracking-tighter disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-all"
              >
                Process Photos
              </button>
            </div>
          )}
        </div>
      )}

      {step === AppStep.PROCESSING && (
        <div className="h-[70vh] flex flex-col items-center justify-center space-y-12 animate-fadeIn">
          <div className="relative w-48 h-48 bg-slate-100 rounded-[40px] overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600 animate-scan"></div>
             <div className="w-full h-full flex items-center justify-center text-4xl">🤖</div>
          </div>
          <h3 className="text-4xl font-black text-slate-900 italic tracking-tighter uppercase">{processingMessage}</h3>
        </div>
      )}

      {step === AppStep.VIDEO_PROCESSING && (
        <div className="h-[70vh] flex flex-col items-center justify-center space-y-12 animate-fadeIn">
          <div className="relative w-48 h-48 bg-slate-100 rounded-[40px] overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600 animate-scan"></div>
             <div className="w-full h-full flex items-center justify-center text-4xl">🎥</div>
          </div>
          <div className="space-y-6 w-full max-w-md">
            <h3 className="text-4xl font-black text-slate-900 italic tracking-tighter uppercase text-center">
              {videoProgress?.status || processingMessage}
            </h3>
            {videoProgress?.progress !== undefined && (
              <div className="space-y-2">
                <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${videoProgress.progress}%` }}
                  ></div>
                </div>
                <p className="text-center text-sm font-bold text-slate-600">
                  {videoProgress.progress}% Complete
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {step === AppStep.BEFORE_AFTER && (
        <div className="space-y-10 animate-fadeIn">
          <button onClick={reset} className="text-sm font-black uppercase text-slate-400 hover:text-slate-600 tracking-widest">← Back</button>
          <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Confirm Pairs</h2>
          <div className="grid grid-cols-1 gap-10">
            {pairs.map((pair) => (
              <div key={pair.id} className="bg-white p-6 rounded-[50px] border border-slate-200 shadow-xl grid grid-cols-2 gap-4">
                <div>
                   <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Before</p>
                   <img src={pair.before} className="rounded-3xl aspect-video object-cover border" />
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase text-blue-500 mb-2">After</p>
                   <img src={pair.after} className="rounded-3xl aspect-video object-cover border" />
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setStep(AppStep.SOCIAL_PACK)} className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black text-xl uppercase italic tracking-tighter">Generate Social Pack</button>
        </div>
      )}

      {step === AppStep.SOCIAL_PACK && currentProject && (
        <div className="max-w-5xl mx-auto space-y-12 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h2 className="text-4xl font-black text-slate-900 uppercase italic tracking-tighter">Your Social Assets</h2>
            <button 
              onClick={() => setStep(AppStep.DASHBOARD)}
              className="text-xs font-black uppercase text-slate-400 hover:text-slate-600"
            >
              ← Back
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-4 space-y-8">
               <img src={currentProject.editedImage || currentProject.originalImage || ''} className="w-full rounded-[38px] aspect-[4/5] object-cover shadow-2xl" />
               <div className="bg-slate-900 p-8 rounded-[40px] text-white space-y-6">
                  <h4 className="font-black uppercase italic tracking-tighter">AI Video Lab</h4>
                  <button onClick={() => startVideoGeneration('transformation')} className="w-full py-4 bg-white/10 rounded-2xl text-left px-5 text-sm font-bold border border-white/20 hover:bg-white/20 transition-all">Transformation Clip →</button>
                  <button onClick={() => startVideoGeneration('satisfying')} className="w-full py-4 bg-white/10 rounded-2xl text-left px-5 text-sm font-bold border border-white/20 hover:bg-white/20 transition-all">Satisfying Glide →</button>
                  <button onClick={() => startVideoGeneration('cinematic')} className="w-full py-4 bg-white/10 rounded-2xl text-left px-5 text-sm font-bold border border-white/20 hover:bg-white/20 transition-all">Cinematic B-Roll →</button>
               </div>
            </div>
            <div className="lg:col-span-8 space-y-10">
               <div className="bg-white p-8 rounded-[40px] border border-slate-200 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black uppercase italic tracking-tighter">Captions</h3>
                    <span className="text-xs text-slate-400">Click to edit • Hover for options</span>
                  </div>
                  {currentProject.socialData?.captions.map((cap, i) => (
                    <div key={i} className="p-4 bg-slate-50 rounded-2xl text-sm leading-relaxed border flex justify-between items-start gap-4 group">
                       <textarea
                         value={cap}
                         onChange={(e) => updateCaption(i, e.target.value)}
                         className="flex-1 bg-transparent border-none outline-none resize-none font-medium focus:bg-white focus:ring-2 focus:ring-blue-200 rounded p-2"
                         rows={3}
                       />
                       <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                           onClick={() => handleRegenerateCaption(i)} 
                           disabled={regeneratingIndex === i}
                           className="text-indigo-600 font-black text-[10px] uppercase hover:text-indigo-800 disabled:opacity-50"
                           title="Regenerate"
                         >
                           {regeneratingIndex === i ? '⏳' : '🔄'}
                         </button>
                         <button onClick={() => copyToClipboard(cap)} className="text-blue-600 font-black text-[10px] uppercase hover:text-blue-800" title="Copy">Copy</button>
                       </div>
                    </div>
                  ))}
               </div>
               {currentProject.socialData?.hashtags && (
                 <div className="bg-white p-8 rounded-[40px] border border-slate-200 space-y-4">
                   <h3 className="text-xl font-black uppercase italic tracking-tighter">Hashtags</h3>
                   <div className="flex flex-wrap gap-2">
                     {currentProject.socialData.hashtags.map((tag, i) => (
                       <button
                         key={i}
                         onClick={() => copyToClipboard(tag)}
                         className="px-4 py-2 bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-700 rounded-full text-sm font-bold transition-all"
                       >
                         {tag}
                       </button>
                     ))}
                   </div>
                   <button 
                     onClick={() => copyToClipboard(currentProject.socialData!.hashtags.join(' '))}
                     className="text-xs font-black uppercase text-blue-600 hover:text-blue-800"
                   >
                     Copy All Hashtags
                   </button>
                 </div>
               )}
               <button onClick={handleExport} className="w-full py-6 bg-blue-600 text-white rounded-[35px] font-black text-2xl uppercase italic tracking-tighter hover:bg-blue-700 transition-all">Complete Project</button>
            </div>
          </div>
        </div>
      )}

      {step === AppStep.VIDEO_LAB && (
        <div className="max-w-4xl mx-auto space-y-12 animate-fadeIn pb-24">
          <button onClick={reset} className="text-sm font-black uppercase text-slate-400 hover:text-slate-600 tracking-widest">← Back</button>
          <div className="text-center space-y-4">
             <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic">AI Video Studio</h2>
             <p className="text-slate-500 font-medium text-lg">Select a generation category to begin.</p>
          </div>

          {!selectedVideoStyle ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <button onClick={() => setSelectedVideoStyle('transformation')} className="bg-white p-10 rounded-[50px] border-2 border-slate-100 text-left space-y-6 hover:border-blue-500 transition-all">
                 <div className="text-5xl">🌓</div>
                 <h3 className="font-black text-2xl uppercase italic tracking-tighter">Transformation</h3>
                 <p className="text-slate-400 font-medium leading-relaxed">Morph before and after shots into a cinematic transition.</p>
               </button>
               <button onClick={() => setSelectedVideoStyle('cinematic')} className="bg-white p-10 rounded-[50px] border-2 border-slate-100 text-left space-y-6 hover:border-blue-500 transition-all">
                 <div className="text-5xl">🎬</div>
                 <h3 className="font-black text-2xl uppercase italic tracking-tighter">Cinematic</h3>
                 <p className="text-slate-400 font-medium leading-relaxed">Studio B-Roll style movements and dramatic lighting.</p>
               </button>
               <button onClick={() => setSelectedVideoStyle('satisfying')} className="bg-white p-10 rounded-[50px] border-2 border-slate-100 text-left space-y-6 hover:border-blue-500 transition-all">
                 <div className="text-5xl">✨</div>
                 <h3 className="font-black text-2xl uppercase italic tracking-tighter">Satisfying</h3>
                 <p className="text-slate-400 font-medium leading-relaxed">Macro close-ups of paint reflections and foam textures.</p>
               </button>
               <button onClick={() => setSelectedVideoStyle('pure_promo')} className="bg-slate-900 p-10 rounded-[50px] text-white text-left space-y-6 hover:bg-slate-800 transition-all">
                 <div className="text-5xl">🚀</div>
                 <h3 className="font-black text-2xl uppercase italic tracking-tighter">Pure Promo</h3>
                 <p className="text-slate-400 font-medium leading-relaxed">Describe any detailing scene and AI will generate it.</p>
               </button>
            </div>
          ) : (
            <div className="bg-white rounded-[55px] p-12 border border-slate-100 shadow-2xl space-y-10 animate-scaleIn">
               <div className="flex items-center justify-between border-b pb-8">
                  <button onClick={() => setSelectedVideoStyle(null)} className="text-xs font-black uppercase text-slate-400 tracking-widest">← Styles</button>
                  <h3 className="font-black uppercase italic tracking-tighter text-3xl text-slate-900">{selectedVideoStyle.replace('_', ' ')}</h3>
               </div>
               
               <div className="space-y-6">
                 {/* Asset Input Stage */}
                 {selectedVideoStyle === 'pure_promo' ? (
                    <textarea 
                      value={videoPromptText} onChange={(e) => setVideoPromptText(e.target.value)}
                      placeholder="Describe your scene..." className="w-full bg-slate-50 border-2 rounded-[32px] p-8 min-h-[200px] font-medium text-lg resize-none"
                    />
                  ) : (
                    <div onClick={() => fileInputRef.current?.click()} className="border-4 border-dashed border-slate-100 rounded-[40px] p-12 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all">
                        <input type="file" multiple accept="image/*" ref={fileInputRef} onChange={handleMultipleFiles} className="hidden" />
                        <div className="text-4xl mb-2">📸</div>
                        <p className="text-xl font-black uppercase italic tracking-tighter">Select Source Photos</p>
                        {uploadedFiles.length > 0 && <p className="text-blue-600 font-bold mt-2">{uploadedFiles.length} photos ready</p>}
                    </div>
                  )}

                  {/* Brainstorming Section */}
                  <div className="pt-4">
                    {!videoCreative ? (
                      <button 
                        disabled={isBrainstorming || (selectedVideoStyle !== 'pure_promo' && uploadedFiles.length === 0)}
                        onClick={brainstormVideoCreative}
                        className="w-full py-5 bg-indigo-600 text-white rounded-[30px] font-black text-xl uppercase italic tracking-tighter flex items-center justify-center gap-3 transition-all hover:scale-[1.02] shadow-xl shadow-indigo-100 disabled:opacity-50"
                      >
                        {isBrainstorming ? "Brainstorming..." : "🧠 Brainstorm Creative Direction"}
                      </button>
                    ) : (
                      <div className="space-y-6 animate-fadeIn">
                        <div className="bg-indigo-50 border-l-8 border-indigo-600 p-8 rounded-[35px] space-y-6">
                           <div className="flex justify-between items-center">
                              <h4 className="font-black uppercase italic tracking-tighter text-indigo-900">AI Creative Direction</h4>
                              <button onClick={() => setVideoCreative(null)} className="text-[10px] font-black uppercase text-indigo-400">Clear</button>
                           </div>
                           <div className="space-y-4">
                              <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Hook / Overlay</p>
                                <p className="font-black text-indigo-900 text-2xl uppercase italic tracking-tighter">"{videoCreative.hook}"</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Voiceover / Script</p>
                                <p className="text-sm font-medium text-indigo-800 leading-relaxed italic">"{videoCreative.script}"</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Suggested Vibe</p>
                                <p className="text-xs font-bold text-indigo-700">Music: {videoCreative.suggestedMusicMood}</p>
                              </div>
                           </div>
                        </div>
                        
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">Final Scene Instruction (AI Prompt)</label>
                           <textarea 
                             value={videoPromptText}
                             onChange={(e) => setVideoPromptText(e.target.value)}
                             className="w-full bg-slate-50 border-2 border-indigo-100 rounded-[30px] p-6 text-sm font-medium min-h-[120px] focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                           />
                        </div>
                      </div>
                    )}
                  </div>

                  <button 
                    disabled={!videoPromptText}
                    onClick={() => startVideoGeneration(selectedVideoStyle)} 
                    className={`w-full py-8 rounded-[40px] font-black text-3xl shadow-2xl uppercase italic tracking-tighter transition-all ${
                      videoPromptText ? 'bg-blue-600 text-white hover:scale-[1.02]' : 'bg-slate-100 text-slate-300'
                    }`}
                  >
                    Produce Video Clip
                  </button>
               </div>
            </div>
          )}
        </div>
      )}

      {step === AppStep.VIDEO_EDIT && currentProject && currentProject.generatedVideoUrl && (
        <div className="max-w-6xl mx-auto space-y-12 animate-fadeIn pb-20">
          <button onClick={() => setStep(AppStep.VIDEO_LAB)} className="text-sm font-black uppercase text-slate-400 hover:text-slate-600 tracking-widest">← Back</button>
          <div className="text-center space-y-2">
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic text-center">Video Lab Edit</h2>
            {currentProject.videoCreative && <p className="text-blue-600 font-bold uppercase text-xs tracking-widest">Creative Hook: "{currentProject.videoCreative.hook}"</p>}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-slate-900 rounded-[50px] p-4 shadow-2xl relative aspect-[9/16]">
                <video 
                  ref={videoRef} src={currentProject.generatedVideoUrl} autoPlay loop muted={editingConfig.isMuted} playsInline
                  className="w-full h-full object-cover rounded-[38px]" style={{ filter: getFullFilterStyle(editingConfig) }}
                />
                {editingConfig.textOverlay && (
                  <div className={`absolute left-0 right-0 px-10 flex justify-center ${
                    editingConfig.textPosition === 'top' ? 'top-20' : editingConfig.textPosition === 'middle' ? 'top-1/2 -translate-y-1/2' : 'bottom-24'
                  }`}>
                    <h2 
                      className="text-center font-black uppercase italic tracking-tighter px-4 py-2 rounded-xl"
                      style={{ color: editingConfig.textColor, fontSize: `${editingConfig.fontSize}px`, backgroundColor: editingConfig.textBackground ? 'rgba(0,0,0,0.5)' : 'transparent' }}
                    >
                      {editingConfig.textOverlay}
                    </h2>
                  </div>
                )}
              </div>
            </div>
            <div className="lg:col-span-5 space-y-6 max-h-[85vh] overflow-y-auto pr-2 custom-scrollbar">
              <div className="bg-white p-6 rounded-[35px] border space-y-4">
                 <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">Basic Trim</h3>
                 <div className="space-y-4">
                    <div className="flex justify-between text-[10px] font-black uppercase text-slate-500">
                      <span>Start: {editingConfig.trimStart}%</span>
                    </div>
                    <input type="range" min="0" max={editingConfig.trimEnd - 5} value={editingConfig.trimStart} onChange={(e) => setEditingConfig({ ...editingConfig, trimStart: parseInt(e.target.value) })} className="w-full h-1 bg-slate-100 rounded-full appearance-none cursor-pointer accent-blue-600" />
                    <div className="flex justify-between text-[10px] font-black uppercase text-slate-500">
                      <span>End: {editingConfig.trimEnd}%</span>
                    </div>
                    <input type="range" min={editingConfig.trimStart + 5} max="100" value={editingConfig.trimEnd} onChange={(e) => setEditingConfig({ ...editingConfig, trimEnd: parseInt(e.target.value) })} className="w-full h-1 bg-slate-100 rounded-full appearance-none cursor-pointer accent-red-600" />
                 </div>
              </div>

              {/* Color Adjustments Section */}
              <div className="bg-white p-6 rounded-[35px] border space-y-6">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">🎨 Color Adjust</h3>
                <div className="space-y-5">
                   <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black uppercase text-slate-500">
                         <span>Brightness</span>
                         <span>{editingConfig.brightness}%</span>
                      </div>
                      <input 
                        type="range" min="50" max="150" value={editingConfig.brightness}
                        onChange={(e) => setEditingConfig({ ...editingConfig, brightness: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-blue-600"
                      />
                   </div>
                   <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black uppercase text-slate-500">
                         <span>Contrast</span>
                         <span>{editingConfig.contrast}%</span>
                      </div>
                      <input 
                        type="range" min="50" max="150" value={editingConfig.contrast}
                        onChange={(e) => setEditingConfig({ ...editingConfig, contrast: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-blue-600"
                      />
                   </div>
                   <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black uppercase text-slate-500">
                         <span>Saturation</span>
                         <span>{editingConfig.saturation}%</span>
                      </div>
                      <input 
                        type="range" min="0" max="200" value={editingConfig.saturation}
                        onChange={(e) => setEditingConfig({ ...editingConfig, saturation: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-blue-600"
                      />
                   </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[35px] border space-y-4">
                 <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">Text & Styles</h3>
                 <input type="text" value={editingConfig.textOverlay} onChange={(e) => setEditingConfig({ ...editingConfig, textOverlay: e.target.value })} placeholder="CAPTION" className="w-full p-3 rounded-xl border-2 font-black uppercase outline-none focus:border-blue-500 transition-all" />
                 <div className="grid grid-cols-3 gap-2">
                    {['none', 'cinematic', 'grayscale', 'high_gloss', 'golden', 'cool'].map(f => (
                      <button 
                        key={f} 
                        onClick={() => setEditingConfig({ ...editingConfig, filter: f })} 
                        className={`p-2 rounded-lg border-2 text-[10px] font-black uppercase transition-all ${editingConfig.filter === f ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                      >
                        {f.replace('_', ' ')}
                      </button>
                    ))}
                 </div>
              </div>
              <button onClick={handleExport} className="w-full bg-blue-600 text-white py-6 rounded-[30px] font-black text-xl uppercase italic tracking-tighter shadow-2xl shadow-blue-200 hover:scale-105 transition-all">Export Masterpiece</button>
            </div>
          </div>
        </div>
      )}

      {step === AppStep.EXPORT && currentProject && (
        <div className="max-w-xl mx-auto py-10 flex flex-col items-center space-y-12 animate-fadeIn text-center">
          <button onClick={reset} className="self-start text-sm font-black uppercase text-slate-400 hover:text-slate-600 tracking-widest">← Back</button>
          <div className="w-32 h-32 bg-green-50 text-green-500 rounded-full flex items-center justify-center text-6xl shadow-inner border-2 border-green-100">✓</div>
          <div className="space-y-4">
            <h2 className="text-5xl font-black text-slate-900 italic tracking-tighter uppercase">Finished!</h2>
            <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Your AI masterpiece is ready to share.</p>
          </div>
          <div className="w-full space-y-4">
            <button 
              onClick={exportProjectAssets} 
              className="w-full bg-blue-600 text-white py-5 rounded-3xl font-black text-lg shadow-2xl uppercase italic tracking-tighter hover:bg-blue-700 transition-all"
            >
              📥 Download All Assets
            </button>
            <div className="grid grid-cols-2 gap-3">
              {currentProject.editedImage && (
                <button 
                  onClick={() => downloadImage(currentProject.editedImage!, `detailer-pro-${currentProject.id}-enhanced.jpg`)} 
                  className="bg-white border-2 border-slate-200 text-slate-700 py-3 rounded-2xl font-bold text-sm uppercase tracking-tighter hover:border-blue-500 transition-all"
                >
                  📸 Enhanced Image
                </button>
              )}
              {currentProject.generatedVideoUrl && (
                <button 
                  onClick={() => downloadVideo(currentProject.generatedVideoUrl!, `detailer-pro-${currentProject.id}-video.mp4`)} 
                  className="bg-white border-2 border-slate-200 text-slate-700 py-3 rounded-2xl font-bold text-sm uppercase tracking-tighter hover:border-blue-500 transition-all"
                >
                  🎥 Video
                </button>
              )}
              {currentProject.socialData && (
                <>
                  <button 
                    onClick={() => {
                      const textContent = currentProject.socialData!.captions.map((cap, i) => `${i + 1}. ${cap}`).join('\n\n');
                      downloadText(textContent, `detailer-pro-${currentProject.id}-captions.txt`);
                    }} 
                    className="bg-white border-2 border-slate-200 text-slate-700 py-3 rounded-2xl font-bold text-sm uppercase tracking-tighter hover:border-blue-500 transition-all"
                  >
                    📝 Captions
                  </button>
                  <button 
                    onClick={() => {
                      const textContent = currentProject.socialData!.hashtags.join(' ');
                      downloadText(textContent, `detailer-pro-${currentProject.id}-hashtags.txt`);
                    }} 
                    className="bg-white border-2 border-slate-200 text-slate-700 py-3 rounded-2xl font-bold text-sm uppercase tracking-tighter hover:border-blue-500 transition-all"
                  >
                    #️⃣ Hashtags
                  </button>
                </>
              )}
            </div>
          </div>
          <button onClick={reset} className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black text-lg shadow-2xl uppercase italic tracking-tighter hover:bg-slate-800 transition-all">Return Home</button>
        </div>
      )}

      {step === AppStep.SETTINGS && (
        <div className="max-w-2xl mx-auto space-y-12 animate-fadeIn">
          <button onClick={reset} className="text-sm font-black uppercase text-slate-400 hover:text-slate-600 tracking-widest">← Back</button>
          <h2 className="text-3xl font-black text-slate-900 italic uppercase tracking-tighter">Settings</h2>
          <div className="bg-white rounded-[40px] border p-8 space-y-8">
             <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-400 tracking-widest">Default Tone</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Friendly', 'Professional', 'Luxury'].map(t => (
                    <button key={t} onClick={() => updateSettings('captionTone', t as CaptionTone)} className={`p-3 rounded-xl border-2 font-bold transition-all ${userSettings.captionTone === t ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}>{t}</button>
                  ))}
                </div>
             </div>
             <div className="space-y-4">
                <label className="text-xs font-black uppercase text-slate-400 tracking-widest">Default Service</label>
                <div className="grid grid-cols-2 gap-2">
                  {SERVICES.slice(0, 4).map(s => (
                    <button 
                      key={s.id} 
                      onClick={() => updateSettings('defaultServiceId', s.id)} 
                      className={`p-3 rounded-xl border-2 font-bold transition-all text-left ${userSettings.defaultServiceId === s.id ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                    >
                      <span className="text-xl mr-2">{s.icon}</span>
                      {s.name}
                    </button>
                  ))}
                </div>
             </div>
             <div className="space-y-4">
                <label className="text-xs font-black uppercase text-slate-400 tracking-widest">Auto Features</label>
                <div className="space-y-2">
                  <label className="flex items-center justify-between p-3 rounded-xl border-2 border-slate-100 cursor-pointer hover:border-slate-200 transition-all">
                    <span className="font-bold text-slate-700">Auto-save to Gallery</span>
                    <input 
                      type="checkbox" 
                      checked={userSettings.autoSaveToGallery}
                      onChange={(e) => updateSettings('autoSaveToGallery', e.target.checked)}
                      className="w-5 h-5 rounded accent-blue-600"
                    />
                  </label>
                  <label className="flex items-center justify-between p-3 rounded-xl border-2 border-slate-100 cursor-pointer hover:border-slate-200 transition-all">
                    <span className="font-bold text-slate-700">Auto-generate TikTok Content</span>
                    <input 
                      type="checkbox" 
                      checked={userSettings.autoGenerateTikTok}
                      onChange={(e) => updateSettings('autoGenerateTikTok', e.target.checked)}
                      className="w-5 h-5 rounded accent-blue-600"
                    />
                  </label>
                  <label className="flex items-center justify-between p-3 rounded-xl border-2 border-slate-100 cursor-pointer hover:border-slate-200 transition-all">
                    <span className="font-bold text-slate-700">Auto-pair Photos</span>
                    <input 
                      type="checkbox" 
                      checked={userSettings.autoPairPhotos}
                      onChange={(e) => updateSettings('autoPairPhotos', e.target.checked)}
                      className="w-5 h-5 rounded accent-blue-600"
                    />
                  </label>
                </div>
             </div>
          </div>
          <div className="flex gap-4">
            <button onClick={reset} className="flex-1 bg-slate-200 text-slate-700 py-6 rounded-[35px] font-black text-xl uppercase italic tracking-tighter hover:bg-slate-300 transition-all">Cancel</button>
            <button onClick={() => { triggerToast(); setTimeout(() => reset(), 500); }} className="flex-1 bg-slate-900 text-white py-6 rounded-[35px] font-black text-xl uppercase italic tracking-tighter hover:bg-slate-800 transition-all">Save Settings</button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
