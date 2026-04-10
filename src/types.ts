export interface User {
  id: string;
  username: string;
  user_role: 'admin' | 'user';
  status: 'active' | 'inactive';
  created_at: string;
}

export interface Video {
  id: string;
  name: string; // Changed from title to name for consistency with clips
  title?: string;
  filepath: string;
  duration: number;
  durationStr?: string;
  file_size?: number;
  size?: string;
  format?: string;
  res?: string;
  file?: File;
  created_at?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  clips: Video[];
  created_at?: string;
  updated_at?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface Schedule {
  id: string;
  name: string;
  stream_id?: string;
  sourceType?: 'playlist' | 'looping';
  sourceName?: string;
  channel?: string;
  stream_key: string;
  start_time: string;
  end_time: string;
  status: 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'ERROR' | string;
  playlist_path?: string;
  remaining?: number;
  rundown?: Video[];
}


export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
  enabled: boolean;
  schedule: string;
  success_rate: number;
  last_run?: string;
}

export interface YoutubeChannel {
  id: string;
  channel_id: string;
  channel_name: string;
  channel_thumbnail?: string;
  subscriber_count: string;
  platform: string;
  auth_type: 'API Key' | 'OAuth';
  api_key?: string;
  access_token?: string;
  refresh_token?: string;
  created_at?: string;
}

export interface StreamConfig {
  streamKey: string;
  rtmpUrl: string;
  resolution: string;
  videoBitrate: string;
  audioBitrate: string;
  fps: string;
  videoCodec: string;
  audioCodec: string;
  loopMode: 'repeat_all' | 'repeat_one' | 'shuffle' | 'once';
  autoStart: boolean;
  maxDuration: string;
  durationUnit: 'minutes' | 'hours';
  mediaType: 'video_audio' | 'video_only' | 'audio_only';
}

export interface FfmpegStats {
  fps: string;
  bitrate: string;
}

export interface Node {
  id: string;
  name: string;
  url: string;
  load: number;
  status: 'ONLINE' | 'OFFLINE' | string;
  last_seen?: string;
}

export interface Stream {
  id: string;
  title: string;
  status: string;
  node?: string;
  viewer_count?: number;
  platform?: string;
  rtmp_url?: string;
  stream_key?: string;
  playlist_path?: string;
  description?: string;
  tags?: string;
  auto_restart?: boolean;
  ai_tone?: string;
  destinations?: any[];
  privacy_status?: string;
  youtube_broadcast_id?: string;
  youtube_job_status?: string;
  is_queued?: boolean | number;
  created_at?: string;
}

export interface LogEntry {
  time: string;
  type: 'info' | 'warn' | 'error' | 'success';
  msg: string;
}

