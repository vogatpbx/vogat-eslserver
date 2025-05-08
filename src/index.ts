import { FreeSwitchClient, FreeSwitchEventData } from 'esl-lite'
import { createServer } from 'http';
import express, { Request, Response, NextFunction } from 'express'
import { config } from './lib/config'
import { logNetworkAddresses, getNetworkAddresses } from './lib/network'
import { logger } from './utils/logger'
import {
  handleAllEvents,
  handleChannelCreate,
  handleChannelAnswer,
  handleChannelHangup,
  handleChannelDestroy,
  handleChannelBridge,
  handleChannelUnbridge,
  handleRecordStart,
  handleRecordStop,
  handleHeartbeat,
  handleShutdownRequested,
  handleStartup,
  handleReloadXml,
  handleBackgroundJob,
  handleApiResponse,
  handleChannelCallState,
  handleChannelState,
  handleChannelExecute,
  handleRequestParams,
  handleSofiaRegister,
  handleCallDetail,
  handleRecvMessage,
  handleChannelExecuteComplete
} from './handlers/eventHandlers';

interface RegistrationData {
  extension: string;
  contact: string;
  agent: string;
  status: string;
  ip: string;
}

const app = express();
const httpServer = createServer(app);

let eslClient: FreeSwitchClient | null = null;

app.use(express.json());

async function checkSofiaContact(
  extension: string,
  profile: string,
  domain: string
): Promise<RegistrationData[]> {
  if (!eslClient) {
    logger.error('ESL client not connected, cannot check sofia contact.');
    throw new Error('ESL client not connected');
  }

  const apiCmd = `sofia_contact ${profile}/${extension}@${domain}`;
  logger.debug({ cmd: apiCmd }, 'Executing sofia_contact command');

  try {
    const apiResponse = await eslClient.bgapi(apiCmd, 5000); 

    logger.debug({ apiResponse, type: typeof apiResponse }, 'Received response from eslClient.bgapi for sofia_contact');

    let commandOutput: string | undefined;

    if (typeof apiResponse === 'string') {
      // esl-lite processed the BACKGROUND_JOB event and returned its body
      commandOutput = apiResponse;
    } else if (apiResponse && typeof apiResponse === 'object' && 'body' in apiResponse && (apiResponse as any).body && typeof (apiResponse as any).body === 'object') {
      // This handles the case where apiResponse is the full BACKGROUND_JOB event object
      const eventBody = (apiResponse as any).body;

      if (typeof eventBody.response === 'string') {
        commandOutput = eventBody.response;
      } 
      //Check eventBody.data._body (standard FreeSWITCH event structure)
      else if (eventBody.data && typeof eventBody.data === 'object' && typeof eventBody.data._body === 'string') {
        commandOutput = eventBody.data._body;
      }
      
      if (commandOutput === undefined) {
        logger.error({ receivedObject: apiResponse, cmd: apiCmd }, 'bgapi returned an object, but expected string content (response or data._body) was not found within its body.');
        throw new Error('Invalid object structure in FreeSWITCH response for sofia_contact');
      }
    } else if (apiResponse instanceof Error) {
      logger.error({ errorObj: apiResponse, cmd: apiCmd }, 'bgapi call for sofia_contact returned an Error object.');
      throw new Error(`FreeSWITCH command failed: ${apiResponse.message}`);
    } else {
      //handles null, undefined, or other unexpected types
      logger.error({ apiResponse, cmd: apiCmd }, 'bgapi call for sofia_contact returned an unexpected non-string, non-object, non-error type.');
      throw new Error('Invalid or unexpected response from FreeSWITCH (bgapi did not return string, object, or Error)');
    }
    return parseSofiaContactResponse(commandOutput, extension);

  } catch (error) {
    // This catch block handles errors from `await eslClient.bgapi` itself 
    // (e.g., network issues, library internal errors before a response is formed)
    // or errors re-thrown from the logic above.
    logger.error({ originalError: error, cmd: apiCmd }, 'Exception during bgapi call or response processing for sofia_contact.');
    if (error instanceof Error) {
      throw new Error(`Failed to execute sofia_contact command: ${error.message}`);
    } else {
      throw new Error('Failed to execute sofia_contact command due to an unknown error.');
    }
  }
}

app.get('/health', (req, res)=> {
  res.status(200).json({ status: 'ok', eslConnected: eslClient});
});

app.post('/registrations/sofia-contact', async (req: Request, res: Response, next: NextFunction) => {
  const { extension, profile, domain } = req.body;

  if (!extension || !profile || !domain) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: extension, profile, and domain are required.',
    });
  }

  if (!eslClient) {
    logger.error('Cannot check registration: ESL client not connected.');
    return res.status(503).json({
      success: false,
      error: 'ESL client not connected',
    });
  }

  try {
      const registrations = await checkSofiaContact(extension, profile, domain);
      if (registrations.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No registrations found for the specified extension.',
        });
      } else {
        return res.status(200).json({
          success: true,
          registrations: registrations[0],
        });
      }
  } catch (error: any) {
      logger.error({ err: error }, 'Failed to check registrations');
      return res.status(500).json({ 
          success: false, 
          error: 'Failed to check registrations',
          details: error.message
      });
  }
});

app.post('/commands/log', async (req: Request, res: Response, next: NextFunction) => {
  const { level = 'INFO', message } = req.body

  if (!message) {
    logger.warn('Received log command request without message body.');
    return res.status(400).json({ error: 'Message is required' });
  }

  if (!eslClient) {
    logger.error('Cannot process log command: ESL client not connected.');
    return res.status(503).json({ error: 'ESL client not connected' });
  }

  eslClient.log(7, 5000)

  try {
    // Sanitize level for safety, default to INFO
    const validLevels = ['DEBUG', 'INFO', 'NOTICE', 'WARNING', 'ERR', 'CRIT', 'ALERT'];
    const safeLevel = validLevels.includes(String(level).toUpperCase())
      ? String(level).toUpperCase()
      : 'INFO';

    const sanitizedMessage = String(message).replace(/[\r\n]/g, ' ');
    const apiCmd = `log ${safeLevel} ${sanitizedMessage}`;

    logger.debug(`Executing ESL command: ${apiCmd}`);

    const apiResponse = await eslClient.bgapi(apiCmd, 5000); 

    logger.debug({ response: apiResponse }, `ESL command response received`);
    res.status(200).json({ success: true, response: apiResponse });

  } catch (error: any) {
    logger.error({ err: error }, 'Failed to execute ESL log command');
    res.status(500).json({ error: 'Failed to execute ESL command' });
  }
});

async function connectToEsl() {
  logger.info(`Attempting to connect to FreeSWITCH ESL at ${config.fsHost}:${config.fsPort}...`)
  logger.debug(`Using ESL Password: "${config.fsPassword}"`)

  eslClient = new FreeSwitchClient({
    host: config.fsHost,
    port: config.fsPort,
    password: config.fsPassword,
    logger,
  });

  // Channel lifecycle events
  //eslClient.on('CHANNEL_CREATE', handleChannelCreate);
  //eslClient.on('CHANNEL_ANSWER', handleChannelAnswer);
  //eslClient.on('CHANNEL_HANGUP', handleChannelHangup);
  //eslClient.on('CHANNEL_DESTROY', handleChannelDestroy);
  //eslClient.on('CHANNEL_BRIDGE', handleChannelBridge);
  eslClient.on('CHANNEL_UNBRIDGE', handleChannelUnbridge);
  //eslClient.on('CHANNEL_CALLSTATE', handleChannelCallState);
  //eslClient.on('CHANNEL_STATE', handleChannelState);
  eslClient.on('CHANNEL_EXECUTE', handleChannelExecute);
  //eslClient.on('CHANNEL_EXECUTE_COMPLETE', handleChannelExecuteComplete);

  //sofia events

  //eslClient.custom.on('sofia::register', handleSofiaRegister);
  //eslClient.custom.on('sofia::unregister', handleSofiaUnregister);
  //eslClient.custom.on('sofia::expire', handleSofiaExpire);

  //background API events
  eslClient.on('BACKGROUND_JOB', handleBackgroundJob);
  //eslClient.on('API', handleApiResponse);

  // Call recording events
  eslClient.on('RECORD_START', handleRecordStart);
  eslClient.on('RECORD_STOP', handleRecordStop);

  // System events
  //eslClient.on('HEARTBEAT', handleHeartbeat);
  eslClient.on('SHUTDOWN_REQUESTED', handleShutdownRequested);
  eslClient.on('STARTUP', handleStartup);
  eslClient.on('RELOADXML', handleReloadXml);
  eslClient.on('REQUEST_PARAMS', handleRequestParams);
  //eslClient.on('CALL_DETAIL', handleCallDetail);
  //eslClient.on('RECV_MESSAGE', handleRecvMessage);
  //eslClient.on('ALL', handleAllEvents);
}

// Start the connection process
connectToEsl()
.then(() => {
  const PORT = process.env.API_PORT || 8081;
  httpServer.listen(PORT, () => {
    logger.info(`HTTP server listening for commands on port ${PORT}`);
    console.log(`HTTP server listening for commands on port ${PORT}`);
    logNetworkAddresses(Number(PORT));
  });
})
.catch(err => {
  logger.fatal({ err }, 'Failed to start ESL application');
  process.exit(1);
});

//const PORT = 8080;
//httpServer.listen(PORT, () => {
//  logNetworkAddresses(PORT);
//});


// Add new parser for sofia_contact response
function parseSofiaContactResponse(response: string, queriedExtension: string): RegistrationData[] {
  let effectiveResponse = response.trim();

  // If the response includes "Job-UUID", try to extract the actual command output after it.
  // The actual output usually follows a newline.
  const jobUuidIndex = effectiveResponse.indexOf('Job-UUID:');
  if (jobUuidIndex !== -1) {
    const newlineAfterJobId = effectiveResponse.indexOf('\n', jobUuidIndex);
    if (newlineAfterJobId !== -1) {
      effectiveResponse = effectiveResponse.substring(newlineAfterJobId + 1).trim();
    } else {
      // If only Job-UUID is present, it means the command might have failed or had no output.
      logger.warn({ response, extension: queriedExtension }, "Sofia_contact response contained Job-UUID but no subsequent data.");
      return [];
    }
  }
  
  logger.debug({ effectiveResponse, originalResponse: response }, "Effective response for sofia_contact parsing");


  // Check for common error responses first
  if (effectiveResponse.startsWith('error/user_not_registered') ||
      effectiveResponse.startsWith('-ERR') ||
      effectiveResponse === '' ||
      effectiveResponse.toLowerCase().includes('invalid') ||
      effectiveResponse.toLowerCase().includes('not found')) {
    logger.info({ response: effectiveResponse, extension: queriedExtension }, "Sofia contact not found or error response.");
    return [];
  }

  // Expected successful response starts with "sofia/"
  if (effectiveResponse.startsWith('sofia/')) {
    const parts = effectiveResponse.split('/');
    if (parts.length >= 3) {
      const sipUri = parts[parts.length - 1];
      const ipMatch = sipUri.match(/@([^:]+):(?:\d+)?/);
      const ip = ipMatch && ipMatch[1] ? ipMatch[1] : '';

      const registration: RegistrationData = {
        extension: queriedExtension,
        contact: effectiveResponse,
        status: 'Registered',
        agent: 'Unknown',
        ip: ip,
      };
      return [registration];
    }
  }

  logger.warn({ response: effectiveResponse, extension: queriedExtension }, "Unrecognized sofia_contact response format.");
  return [];
}

// Graceful shutdown handler
function shutdown() {
  logger.info('Shutting down ESL connection...');
  if (eslClient) {
    try {
      eslClient.end();
      logger.info('ESL connection closed gracefully.');
    } catch (err) {
      logger.error('Error closing ESL connection during shutdown:', err);
    } finally {
      eslClient = null;
    }
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);