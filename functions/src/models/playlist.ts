export interface UserPlaylist {
  id?: string;
  title: string;
  description?: string;
  episodes: string[]; // Array of episode IDs
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  videoCount: number;
  thumbnailUrl?: string;
  isPublic: boolean;
}

export interface PlaylistVideo {
  id: string;
  playlistId: string;
  videoId: string;
  addedAt: Date;
  order: number;
}

export interface PlaylistWithStatus extends UserPlaylist {
  hasVideo: boolean; // Whether a specific video is in this playlist
}