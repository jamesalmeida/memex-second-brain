import { API_CONFIG } from '../config/api';

export interface AssemblyAITranscript {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text?: string;
  error?: string;
  language_code?: string;
  confidence?: number;
}

const ASSEMBLYAI_BASE_URL = 'https://api.assemblyai.com/v2';

/**
 * Upload a video URL to AssemblyAI for transcription
 */
export const submitTranscription = async (videoUrl: string): Promise<string> => {
  if (!API_CONFIG.ASSEMBLYAI.API_KEY) {
    throw new Error('AssemblyAI API key not configured');
  }

  try {
    const response = await fetch(`${ASSEMBLYAI_BASE_URL}/transcript`, {
      method: 'POST',
      headers: {
        'Authorization': API_CONFIG.ASSEMBLYAI.API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: videoUrl,
        language_detection: true, // Auto-detect language
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AssemblyAI submit error:', response.status, errorText);
      throw new Error(`AssemblyAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.id; // Return the transcript ID for polling
  } catch (error) {
    console.error('Error submitting transcription to AssemblyAI:', error);
    throw error;
  }
};

/**
 * Poll AssemblyAI for transcription status
 */
export const getTranscriptionStatus = async (transcriptId: string): Promise<AssemblyAITranscript> => {
  if (!API_CONFIG.ASSEMBLYAI.API_KEY) {
    throw new Error('AssemblyAI API key not configured');
  }

  try {
    const response = await fetch(`${ASSEMBLYAI_BASE_URL}/transcript/${transcriptId}`, {
      method: 'GET',
      headers: {
        'Authorization': API_CONFIG.ASSEMBLYAI.API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AssemblyAI status check error:', response.status, errorText);
      throw new Error(`AssemblyAI API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      status: data.status,
      text: data.text,
      error: data.error,
      language_code: data.language_code,
      confidence: data.confidence,
    };
  } catch (error) {
    console.error('Error checking transcription status:', error);
    throw error;
  }
};

/**
 * Transcribe a video URL using AssemblyAI
 * This function handles the full workflow: submit -> poll -> return transcript
 */
export const transcribeVideo = async (
  videoUrl: string,
  onProgress?: (status: string) => void
): Promise<{ transcript: string; language: string }> => {
  try {
    console.log('Submitting video to AssemblyAI for transcription:', videoUrl);
    onProgress?.('Submitting video for transcription...');

    // Submit the video URL for transcription
    const transcriptId = await submitTranscription(videoUrl);
    console.log('AssemblyAI transcript ID:', transcriptId);

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max (5 second intervals)
    const pollInterval = 5000; // 5 seconds

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      onProgress?.('Processing transcription...');
      const result = await getTranscriptionStatus(transcriptId);

      console.log(`AssemblyAI status (attempt ${attempts + 1}):`, result.status);

      if (result.status === 'completed') {
        if (!result.text) {
          throw new Error('Transcription completed but no text returned');
        }

        console.log('Transcription completed successfully');
        return {
          transcript: result.text,
          language: result.language_code || 'en',
        };
      } else if (result.status === 'error') {
        throw new Error(`AssemblyAI transcription error: ${result.error || 'Unknown error'}`);
      }

      attempts++;
    }

    throw new Error('Transcription timeout - took longer than expected');
  } catch (error) {
    console.error('Error transcribing video with AssemblyAI:', error);
    throw error;
  }
};
