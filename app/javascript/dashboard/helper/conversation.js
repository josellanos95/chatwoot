/**
 * Helper functions for conversation-related operations
 */

/**
 * Check if a conversation belongs to a Telegram inbox
 * @param {Object} conversation - The conversation object
 * @returns {boolean} - True if it's a Telegram conversation
 */
export const isTelegramConversation = (conversation) => {
  if (!conversation) {
    return false;
  }
  
  // Check if the conversation channel type is Telegram
  // The channel type is stored in conversation.meta.channel
  return conversation.meta?.channel === 'Channel::Telegram';
};

/**
 * Extract message content from the editor
 * @param {string} messageHtml - HTML content from the editor
 * @param {string} messageText - Plain text content
 * @returns {Object} - Object with message_html and message_text
 */
export const extractMessageContent = (messageHtml, messageText) => {
  return {
    message_html: messageHtml || '',
    message_text: messageText || '',
  };
};

/**
 * Format date to local timezone string (24h format)
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string (dd/MM/yyyy HH:mm)
 */
export const formatDateToLocal = (date) => {
  if (!date) return '';
  
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

/**
 * Get timezone offset in minutes
 * @returns {number} - Timezone offset in minutes (positive for GMT-3 = -180)
 */
export const getTimezoneOffsetMinutes = () => {
  return new Date().getTimezoneOffset() * -1;
};
