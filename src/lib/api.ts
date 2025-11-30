export interface Rally {
  rallyIndex: number;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface AnalysisResponse {
  videoId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  rallies?: Rally[];
  error?: string;
  createdAt?: string;
  updatedAt?: string;
}

const SUPABASE_URL = 'https://amexdqbnpothyfzgepoo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZXhkcWJucG90aHlmemdlcG9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5MzI3NzEsImV4cCI6MjA2OTUwODc3MX0.CU18utHYTEsYNI_vRwS9VRsDS4NyiLKZ6-PkElzfH3s';

export async function fetchAnalysis(videoId: string): Promise<AnalysisResponse> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/multipart-upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({
      action: 'get-analysis',
      videoId: videoId
    })
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.json();
}
