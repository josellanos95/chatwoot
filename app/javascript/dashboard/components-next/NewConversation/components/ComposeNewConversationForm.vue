<script setup>
import { reactive, ref, computed } from 'vue';
import { useVuelidate } from '@vuelidate/core';
import { required, requiredIf } from '@vuelidate/validators';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { INBOX_TYPES } from 'dashboard/helper/inbox';
import {
  appendSignature,
  removeSignature,
  extractTextFromMarkdown,
} from 'dashboard/helper/editorHelper';
import {
  buildContactableInboxesList,
  prepareNewMessagePayload,
  prepareWhatsAppMessagePayload,
} from 'dashboard/components-next/NewConversation/helpers/composeConversationHelper.js';
import { format } from 'date-fns';
import { scheduleSend } from 'dashboard/api/scheduleSend';
import { useAlert } from 'dashboard/composables';

import ContactSelector from './ContactSelector.vue';
import InboxSelector from './InboxSelector.vue';
import EmailOptions from './EmailOptions.vue';
import MessageEditor from './MessageEditor.vue';
import ActionButtons from './ActionButtons.vue';
import InboxEmptyState from './InboxEmptyState.vue';
import AttachmentPreviews from './AttachmentPreviews.vue';

const props = defineProps({
  contacts: { type: Array, default: () => [] },
  contactId: { type: String, default: null },
  selectedContact: { type: Object, default: null },
  targetInbox: { type: Object, default: null },
  currentUser: { type: Object, default: null },
  isCreatingContact: { type: Boolean, default: false },
  isFetchingInboxes: { type: Boolean, default: false },
  isLoading: { type: Boolean, default: false },
  isDirectUploadsEnabled: { type: Boolean, default: false },
  contactConversationsUiFlags: { type: Object, default: null },
  contactsUiFlags: { type: Object, default: null },
  messageSignature: { type: String, default: '' },
  sendWithSignature: { type: Boolean, default: false },
});

const emit = defineEmits([
  'searchContacts',
  'discard',
  'updateSelectedContact',
  'updateTargetInbox',
  'clearSelectedContact',
  'createConversation',
]);

const { t } = useI18n();
const route = useRoute();

const showContactsDropdown = ref(false);
const showInboxesDropdown = ref(false);
const showCcEmailsDropdown = ref(false);
const showBccEmailsDropdown = ref(false);

const scheduledAt = ref(null);
const isScheduling = ref(false);
const alert = useAlert || { success: console.log, error: console.error };

const isCreating = computed(() => props.contactConversationsUiFlags.isCreating);

const state = reactive({
  message: '',
  subject: '',
  ccEmails: '',
  bccEmails: '',
  attachedFiles: [],
});

const inboxTypes = computed(() => ({
  isEmail: props.targetInbox?.channelType === INBOX_TYPES.EMAIL,
  isTwilio: props.targetInbox?.channelType === INBOX_TYPES.TWILIO,
  isWhatsapp: props.targetInbox?.channelType === INBOX_TYPES.WHATSAPP,
  isWebWidget: props.targetInbox?.channelType === INBOX_TYPES.WEB,
  isApi: props.targetInbox?.channelType === INBOX_TYPES.API,
  isEmailOrWebWidget:
    props.targetInbox?.channelType === INBOX_TYPES.EMAIL ||
    props.targetInbox?.channelType === INBOX_TYPES.WEB,
  isTwilioSMS:
    props.targetInbox?.channelType === INBOX_TYPES.TWILIO &&
    props.targetInbox?.medium === 'sms',
}));

const whatsappMessageTemplates = computed(() =>
  Object.keys(props.targetInbox?.messageTemplates || {}).length
    ? props.targetInbox.messageTemplates
    : []
);

const inboxChannelType = computed(() => props.targetInbox?.channelType || '');

const validationRules = computed(() => ({
  selectedContact: { required },
  targetInbox: { required },
  message: { required: requiredIf(!inboxTypes.value.isWhatsapp) },
  subject: { required: requiredIf(inboxTypes.value.isEmail) },
}));

const v$ = useVuelidate(validationRules, {
  selectedContact: computed(() => props.selectedContact),
  targetInbox: computed(() => props.targetInbox),
  message: computed(() => state.message),
  subject: computed(() => state.subject),
});

const validationStates = computed(() => ({
  isContactInvalid:
    v$.value.selectedContact.$dirty && v$.value.selectedContact.$invalid,
  isInboxInvalid: v$.value.targetInbox.$dirty && v$.value.targetInbox.$invalid,
  isSubjectInvalid: v$.value.subject.$dirty && v$.value.subject.$invalid,
  isMessageInvalid: v$.value.message.$dirty && v$.value.message.$invalid,
}));

const newMessagePayload = () => {
  const { message, subject, ccEmails, bccEmails, attachedFiles } = state;
  return prepareNewMessagePayload({
    targetInbox: props.targetInbox,
    selectedContact: props.selectedContact,
    message,
    subject,
    ccEmails,
    bccEmails,
    currentUser: props.currentUser,
    attachedFiles,
    directUploadsEnabled: props.isDirectUploadsEnabled,
  });
};

const contactableInboxesList = computed(() => {
  return buildContactableInboxesList(props.selectedContact?.contactInboxes);
});

const showNoInboxAlert = computed(() => {
  return (
    props.selectedContact &&
    contactableInboxesList.value.length === 0 &&
    !props.contactsUiFlags.isFetchingInboxes &&
    !props.isFetchingInboxes
  );
});

const isAnyDropdownActive = computed(() => {
  return (
    showContactsDropdown.value ||
    showInboxesDropdown.value ||
    showCcEmailsDropdown.value ||
    showBccEmailsDropdown.value
  );
});

const handleContactSearch = value => {
  showContactsDropdown.value = true;
  emit('searchContacts', {
    keys: ['email', 'phone_number', 'name'],
    query: value,
  });
};

const handleDropdownUpdate = (type, value) => {
  if (type === 'cc') {
    showCcEmailsDropdown.value = value;
  } else if (type === 'bcc') {
    showBccEmailsDropdown.value = value;
  } else {
    showContactsDropdown.value = value;
  }
};

const searchCcEmails = value => {
  showCcEmailsDropdown.value = true;
  emit('searchContacts', { keys: ['email'], query: value });
};

const searchBccEmails = value => {
  showBccEmailsDropdown.value = true;
  emit('searchContacts', { keys: ['email'], query: value });
};

const setSelectedContact = async ({ value, action, ...rest }) => {
  v$.value.$reset();
  emit('updateSelectedContact', { value, action, ...rest });
  showContactsDropdown.value = false;
  showInboxesDropdown.value = true;
};

const handleInboxAction = ({ value, action, ...rest }) => {
  v$.value.$reset();
  emit('updateTargetInbox', { ...rest });
  showInboxesDropdown.value = false;
  state.attachedFiles = [];
};

const removeTargetInbox = value => {
  v$.value.$reset();
  // Remove the signature from message content
  // Based on the Advance Editor (used in isEmailOrWebWidget) and Plain editor(all other inboxes except WhatsApp)
  if (props.sendWithSignature) {
    const signatureToRemove = inboxTypes.value.isEmailOrWebWidget
      ? props.messageSignature
      : extractTextFromMarkdown(props.messageSignature);
    state.message = removeSignature(state.message, signatureToRemove);
  }
  emit('updateTargetInbox', value);
  state.attachedFiles = [];
};

const clearSelectedContact = () => {
  emit('clearSelectedContact');
  state.attachedFiles = [];
};

const onClickInsertEmoji = emoji => {
  state.message += emoji;
};

const handleAddSignature = signature => {
  state.message = appendSignature(state.message, signature);
};

const handleRemoveSignature = signature => {
  state.message = removeSignature(state.message, signature);
};

const handleAttachFile = files => {
  state.attachedFiles = files;
};

const clearForm = () => {
  Object.assign(state, {
    message: '',
    subject: '',
    ccEmails: '',
    bccEmails: '',
    attachedFiles: [],
  });
  scheduledAt.value = null;
  v$.value.$reset();
};

const handleSendMessage = async () => {
  const isValid = await v$.value.$validate();
  if (!isValid) return;

  try {
    const success = await emit('createConversation', {
      payload: newMessagePayload(),
      isFromWhatsApp: false,
    });
    if (success) {
      clearForm();
      // Limpiar el scheduling cuando se envía el mensaje inmediatamente
      scheduledAt.value = null;
    }
  } catch (error) {
    // Form will not be cleared if conversation creation fails
  }
};

const handleSendWhatsappMessage = async ({ message, templateParams }) => {
  const whatsappMessagePayload = prepareWhatsAppMessagePayload({
    targetInbox: props.targetInbox,
    selectedContact: props.selectedContact,
    message,
    templateParams,
    currentUser: props.currentUser,
  });
  await emit('createConversation', {
    payload: whatsappMessagePayload,
    isFromWhatsApp: true,
  });
  // Limpiar el scheduling cuando se envía el mensaje de WhatsApp
  scheduledAt.value = null;
};

const getAccountId = () => {
  // 1. Intentar obtener desde la ruta (Composition API)
  if (route?.params?.accountId) {
    const accountId = Number(route.params.accountId);
    if (Number.isInteger(accountId) && accountId > 0) {
      return accountId;
    }
  }

  // 2. Parsear desde window.location.pathname
  if (typeof window !== 'undefined') {
    const match = window.location.pathname.match(/\/app\/accounts\/(\d+)\//);
    if (match && match[1]) {
      const accountId = Number(match[1]);
      if (Number.isInteger(accountId) && accountId > 0) {
        return accountId;
      }
    }
  }

  // 3. Fallback a configuraciones globales
  if (typeof window !== 'undefined' && window?.chatwootConfig?.account_id) {
    const accountId = Number(window.chatwootConfig.account_id);
    if (Number.isInteger(accountId) && accountId > 0) {
      return accountId;
    }
  }

  return null;
};

const onScheduleSend = async (dateValue) => {
  if (!dateValue) {
    alert.error(t('SCHEDULE_SEND.VALIDATION_REQUIRED'));
    return;
  }

  // Validar que la fecha sea futura (mínimo 1 minuto en el futuro)
  const now = new Date();
  const scheduledDate = new Date(dateValue);
  const minFutureDate = new Date(now.getTime() + 60000); // +1 minuto

  if (scheduledDate < minFutureDate) {
    alert.error(t('SCHEDULE_SEND.VALIDATION_FUTURE'));
    return;
  }

  try {
    isScheduling.value = true;
    const accountId = getAccountId();

    const payload = {
      channel: 'email',
      account_id: accountId,
      inbox_id: props.targetInbox?.id,
      contact_id: props.selectedContact?.id,
      to: props.selectedContact?.email ? [props.selectedContact.email] : [],
      cc: state.ccEmails ? state.ccEmails.split(',').map(e => e.trim()).filter(Boolean) : [],
      bcc: state.bccEmails ? state.bccEmails.split(',').map(e => e.trim()).filter(Boolean) : [],
      subject: state.subject,
      message: state.message,
      message_html: state.message, // HTML del editor
      message_text: state.message.replace(/<[^>]*>/g, ''), // Texto plano limpiado
      // timestamps
      scheduled_at: new Date(dateValue).toISOString(), // UTC
      scheduled_at_local: format(new Date(dateValue), 'dd/MM/yyyy HH:mm'),
      timezone_offset_minutes: -new Date().getTimezoneOffset(),
      // metadata opcional
      source: 'chatwoot',
    };

    await scheduleSend(payload);
    const formattedDateTime = format(new Date(dateValue), 'dd/MM/yyyy HH:mm');
    const successMessage = t('SCHEDULE_SEND.TOAST_SUCCESS', { datetime: formattedDateTime });
    console.log('Schedule success, showing toast:', successMessage);
    alert(successMessage);
  } catch (e) {
    const errorMessage = t('SCHEDULE_SEND.TOAST_ERROR');
    console.log('Schedule error, showing toast:', errorMessage);
    alert(errorMessage);
    console.error(e);
  } finally {
    isScheduling.value = false;
  }
};
</script>

<template>
  <div
    class="w-[42rem] divide-y divide-n-strong overflow-visible transition-all duration-300 ease-in-out top-full justify-between flex flex-col bg-n-alpha-3 border border-n-strong shadow-sm backdrop-blur-[100px] rounded-xl min-w-0"
  >
    <ContactSelector
      :contacts="contacts"
      :selected-contact="selectedContact"
      :show-contacts-dropdown="showContactsDropdown"
      :is-loading="isLoading"
      :is-creating-contact="isCreatingContact"
      :contact-id="contactId"
      :contactable-inboxes-list="contactableInboxesList"
      :show-inboxes-dropdown="showInboxesDropdown"
      :has-errors="validationStates.isContactInvalid"
      @search-contacts="handleContactSearch"
      @set-selected-contact="setSelectedContact"
      @clear-selected-contact="clearSelectedContact"
      @update-dropdown="handleDropdownUpdate"
    />
    <InboxEmptyState v-if="showNoInboxAlert" />
    <InboxSelector
      v-else
      :target-inbox="targetInbox"
      :selected-contact="selectedContact"
      :show-inboxes-dropdown="showInboxesDropdown"
      :contactable-inboxes-list="contactableInboxesList"
      :has-errors="validationStates.isInboxInvalid"
      @update-inbox="removeTargetInbox"
      @toggle-dropdown="showInboxesDropdown = $event"
      @handle-inbox-action="handleInboxAction"
    />

    <EmailOptions
      v-if="inboxTypes.isEmail"
      v-model:cc-emails="state.ccEmails"
      v-model:bcc-emails="state.bccEmails"
      v-model:subject="state.subject"
      :contacts="contacts"
      :show-cc-emails-dropdown="showCcEmailsDropdown"
      :show-bcc-emails-dropdown="showBccEmailsDropdown"
      :is-loading="isLoading"
      :has-errors="validationStates.isSubjectInvalid"
      @search-cc-emails="searchCcEmails"
      @search-bcc-emails="searchBccEmails"
      @update-dropdown="handleDropdownUpdate"
    />

    <MessageEditor
      v-if="!inboxTypes.isWhatsapp && !showNoInboxAlert"
      v-model="state.message"
      :message-signature="messageSignature"
      :send-with-signature="sendWithSignature"
      :is-email-or-web-widget-inbox="inboxTypes.isEmailOrWebWidget"
      :has-errors="validationStates.isMessageInvalid"
      :has-attachments="state.attachedFiles.length > 0"
    />

    <AttachmentPreviews
      v-if="state.attachedFiles.length > 0"
      :attachments="state.attachedFiles"
      @update:attachments="state.attachedFiles = $event"
    />

    <ActionButtons
      :attached-files="state.attachedFiles"
      :is-whatsapp-inbox="inboxTypes.isWhatsapp"
      :is-email-or-web-widget-inbox="inboxTypes.isEmailOrWebWidget"
      :is-twilio-sms-inbox="inboxTypes.isTwilioSMS"
      :message-templates="whatsappMessageTemplates"
      :channel-type="inboxChannelType"
      :is-loading="isCreating"
      :disable-send-button="isCreating"
      :has-selected-inbox="!!targetInbox"
      :inbox-id="targetInbox?.id"
      :has-no-inbox="showNoInboxAlert"
      :is-dropdown-active="isAnyDropdownActive"
      :message-signature="messageSignature"
      :scheduled-at="scheduledAt"
      :is-scheduling="isScheduling"
      @insert-emoji="onClickInsertEmoji"
      @add-signature="handleAddSignature"
      @remove-signature="handleRemoveSignature"
      @attach-file="handleAttachFile"
      @discard="$emit('discard')"
      @send-message="handleSendMessage"
      @send-whatsapp-message="handleSendWhatsappMessage"
      @schedule="onScheduleSend"
      @update:scheduled-at="(value) => scheduledAt = value"
    />
  </div>
</template>
