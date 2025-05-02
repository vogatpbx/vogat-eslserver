import type { FreeSwitchEventData } from 'esl-lite'
import { logger } from '../../utils/logger'

interface StandardizedEventData {
    eventName: string
    subClass?: string
    uuid?: string
    channelData?: any
    sofiaData?: any
    recordData?: any
    systemData?: any
    rawEventData: FreeSwitchEventData,
    timestamp: string
}

export async function eventToVgtPbx(
    eventName: string, 
    eventData: StandardizedEventData
): Promise<void> {

  const NEXTJS_INTERNAL_API_URL = process.env.NEXTJS_INTERNAL_API_URL || 'http://localhost:3000/api/httpapihandler';
  //const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || 'your-very-secret-key';

  logger.debug(`Notifying Next.js API about event: ${eventName}`);
  
  try {
    const response = await fetch(NEXTJS_INTERNAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventName: eventName,
        subClass: eventData.subClass,
        eventData: eventData,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    logger.debug({ result }, `Next.js API response for ${eventName}`);
    
  } catch (error) {
    logger.error({ err: error }, `Failed to notify Next.js API for ${eventName}`);
  }
}