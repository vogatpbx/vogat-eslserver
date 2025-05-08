import type { FreeSwitchEventData } from 'esl-lite'
import { logger } from '../utils/logger'
import { eventToVgtPbx } from '../api/eventhandler/route'

interface CustomEventData {
    eventName: string
    eventSubclass: any
    uuid?: string
    data: any
    timestamp: string
}



export function handleAllEvents(data: FreeSwitchEventData) {
    const eventName = data.headers.get('Event-Name') || 'Unknown';
    const uuid = data.headers.get('Unique-ID') || 'Unknown';
    logger.trace({ eventName, uuid }, 'Received event via ALL handler');
    logger.info(data.body.data);
}

export function handleChannelCreate(data: FreeSwitchEventData) {
    const uuid = data.body.uniqueID
    const body = data.body
    logger.info({ body }, 'New channel created - data');
}

export function handleChannelAnswer(data: FreeSwitchEventData) {
    const uuid = data.body.uniqueID
    const body = data.body
    const eventName =  data.body.eventName || 'Unknown';
    logger.info({ body }, 'Channel answered')
    eventToVgtPbx(eventName, {
        eventName,
        channelData: body,
        rawEventData: data,
        timestamp: new Date().toISOString(),
    })
}

export function handleChannelExecute(data: FreeSwitchEventData) {
    const body = data.body
    logger.info({body}, 'Channel Execute');
}

export function handleChannelExecuteComplete(data: FreeSwitchEventData) {
    const body = data.body
    logger.info({body}, 'Channel Execute Complete');
}

export function handleChannelHangup(data: FreeSwitchEventData) {
    const body = data.body
    const eventName =  data.body.eventName || 'Unknown';
    logger.info({ body }, 'Channel Hangup');
    eventToVgtPbx(eventName, {
        eventName,
        channelData: body,
        rawEventData: data,
        timestamp: new Date().toISOString(),
    })
}

export function handleChannelDestroy(data: FreeSwitchEventData) {
    const uuid = data.body.uniqueID
    const body = data
    logger.info({ body }, 'Channel Destroyed - data');
}

export function handleChannelBridge(data: FreeSwitchEventData) {
    const uuid = data.body.uniqueID
    const otherLeg = data.headers.get('Other-Leg-Unique-ID');
    logger.info({ uuid, otherLeg }, 'Channel bridged');
}

export function handleChannelCallState(data: FreeSwitchEventData) {
    const body = data.body
    logger.info({body}, 'Channel Call State');
}

export function handleChannelState(data: FreeSwitchEventData) {
    const body = data.body
    logger.info({body}, 'Channel State');
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

export function handleBackgroundJob(data: FreeSwitchEventData) {
    const body = data.body.data
    logger.info({body}, 'Background job');
}

export function handleApiResponse(data: FreeSwitchEventData) {
    const body = data.body.data
    logger.info({body}, 'API response');
}

export function handleRequestParams(data: FreeSwitchEventData) {
    const uid = data.body.uniqueID
    const body = data.body.data
    logger.info({uid}, 'Request params');
}

export function handleRecvMessage(data: FreeSwitchEventData) {
    const body = data.body.data
    logger.info({body}, 'Recv message');
}

export function handleCallDetail(data: FreeSwitchEventData) {
    const body = data.body.data
    logger.info({body}, 'call detail');
}




export function handleCustomEvent(data: FreeSwitchEventData) {
    const eventName =  data.body.eventName || 'Unknown';
    const eventSubclass = data.body.data['Event-Subclass'] || 'unknown'

    const customEventData: CustomEventData = {
        eventName,
        eventSubclass,
        data: {
            ...data.body,
            headers: data.headers,
        },
        timestamp: new Date().toISOString(),
    };

    logger.debug({
        eventName,
        eventSubclass,
        customEventData,
    }, 'Custom event received');

    switch (eventSubclass) {
        case 'sofia::register':
            logger.info('Sofia register event');
            break;
        case 'sofia::unregister':
            logger.info('Sofia unregister event');
            break;
        default:
            logger.info('Unknown custom event subclass');
            break;

    }
}


export function handleSofiaRegister(data: FreeSwitchEventData) {
    const registrationData = {
        profile: data.body.data['profile-name'],
        fromUser: data.body.data['from-user'],
        fromHost: data.body.data['from-host'],
        contact: data.body.data['contact'],
        context: data.body.data['user_context'],
        domain: data.body.data['domain_name'],
        username: data.body.data['user_name'],
        sip_number_alias: data.body.data['sip_number_alias'],
        sip_auth_username: data.body.data['sip_auth_username'],
        network_ip: data.body.data['network-ip'],
    }

    logger.info({ 
        subClass: data.body.data['Event-Subclass'],
        registration: registrationData 
    }, 'Sofia register');

    eventToVgtPbx('CUSTOM', {
        eventName: 'CUSTOM',
        subClass: 'sofia::register',
        sofiaData: registrationData,
        rawEventData: data,
        timestamp: new Date().toISOString(),
    })

}