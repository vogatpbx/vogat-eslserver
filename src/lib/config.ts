export const config = {
    fsHost: process.env.FREESWITCH_HOST || '127.0.0.1',
    fsPort: parseInt(process.env.FREESWITCH_ESL_PORT || '8021', 10),
    fsPassword: process.env.FREESWITCH_ESL_PASSWORD || 'ClueCon',
    reconnectDelay: 5000 // 5 seconds
};