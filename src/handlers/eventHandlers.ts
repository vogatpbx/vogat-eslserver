import type { FreeSwitchEventData } from 'esl-lite';
import { logger } from '../utils/logger';

export function handleAllEvents(data: FreeSwitchEventData) {
    const eventName = data.headers.get('Event-Name') || 'Unknown';
    const uuid = data.headers.get('Unique-ID') || 'Unknown';
    logger.trace({ eventName, uuid }, 'Received event via ALL handler');
    logger.info(data.body.data);
}

export function handleChannelCreate(data: FreeSwitchEventData) {
    const uuid = data.body.uniqueID
    logger.info({ uuid }, 'New channel created');
}

export function handleChannelAnswer(data: FreeSwitchEventData) {
    const uuid = data.body.uniqueID
    logger.info({ uuid }, 'Channel answered');
}

export function handleChannelHangup(data: FreeSwitchEventData) {
    const uuid = data.body.uniqueID
    const cause = data.headers.get('Hangup-Cause');
    logger.info({ uuid, cause }, 'Channel hangup');
}

export function handleChannelDestroy(data: FreeSwitchEventData) {
    const uuid = data.body.uniqueID
    logger.info({ uuid }, 'Channel destroyed');
}

export function handleChannelBridge(data: FreeSwitchEventData) {
    const uuid = data.body.uniqueID
    const otherLeg = data.headers.get('Other-Leg-Unique-ID');
    logger.info({ uuid, otherLeg }, 'Channel bridged');
}

export function handleChannelUnbridge(data: FreeSwitchEventData) {
    const uuid = data.body.uniqueID
    logger.info({ uuid }, 'Channel unbridged');
}

export function handleRecordStart(data: FreeSwitchEventData) {
    const uuid = data.body.uniqueID
    const path = data.headers.get('Record-File-Path');
    logger.info({ uuid, path }, 'Recording started');
}

export function handleRecordStop(data: FreeSwitchEventData) {
    const uuid = data.body.uniqueID
    const path = data.headers.get('Record-File-Path');
    logger.info({ uuid, path }, 'Recording stopped');
}

export function handleHeartbeat(data: FreeSwitchEventData) {
    const body = data.body
    const header = data.headers
    logger.info({ body }, 'Info - Received body')
    logger.info({ header }, 'Info - Received header')
}

export function handleShutdownRequested(data: FreeSwitchEventData) {
    logger.warn('FreeSWITCH shutdown requested');
}

export function handleStartup(data: FreeSwitchEventData) {
    logger.info('FreeSWITCH startup detected');
}

export function handleReloadXml(data: FreeSwitchEventData) {
    const body = data.body.data
    logger.info({body}, 'Reload XML');
}