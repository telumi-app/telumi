export type CampaignTimelineItem = {
  id: string;
  mediaId: string;
  type: 'image' | 'video';
  duration: number;
  maxDuration?: number;
  order: number;
  name: string;
  url?: string;
};
