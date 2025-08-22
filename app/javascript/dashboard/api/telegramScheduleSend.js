import { scheduleSend } from './scheduleSend';

/**
 * Schedule a Telegram message to be sent later
 * @param {Object} params - Parameters for scheduling
 * @param {number} params.accountId - Account ID
 * @param {number} params.inboxId - Inbox ID
 * @param {number} params.conversationId - Conversation ID
 * @param {number} params.contactId - Contact ID
 * @param {string} params.message - Plain text message
 * @param {string} params.messageHtml - HTML message
 * @param {Date} params.scheduledAt - Scheduled date/time
 * @param {string} params.scheduledAtLocal - Local formatted date/time
 * @param {number} params.timezoneOffsetMinutes - Timezone offset in minutes
 * @returns {Promise<Object>} - Response from the webhook
 */
export const scheduleTelegramMessage = async (params) => {
  const {
    accountId,
    inboxId,
    conversationId,
    contactId,
    message,
    messageHtml,
    scheduledAt,
    scheduledAtLocal,
    timezoneOffsetMinutes,
  } = params;

  // Validate required parameters
  if (!accountId || !inboxId || !conversationId || !contactId) {
    throw new Error('Missing required parameters: accountId, inboxId, conversationId, contactId');
  }

  if (!message || !message.trim()) {
    throw new Error('Message is required');
  }

  if (!scheduledAt) {
    throw new Error('Scheduled date/time is required');
  }

  // Validate that scheduled date is in the future
  const now = new Date();
  const scheduledDate = new Date(scheduledAt);
  if (scheduledDate <= now) {
    throw new Error('Scheduled date must be in the future');
  }

  const payload = {
    source: 'chatwoot',
    channel: 'telegram',
    account_id: accountId,
    inbox_id: inboxId,
    conversation_id: conversationId,
    contact_id: contactId,
    to: [], // Not applicable for Telegram
    cc: [],
    bcc: [],
    subject: '', // Not applicable for Telegram
    message: message.trim(),
    message_html: messageHtml || message.trim(),
    message_text: message.trim(),
    scheduled_at: scheduledDate.toISOString(),
    scheduled_at_local: scheduledAtLocal,
    timezone_offset_minutes: timezoneOffsetMinutes,
  };

  return scheduleSend(payload);
};
