<script>
import { ref } from 'vue';
import { useUISettings } from 'dashboard/composables/useUISettings';
import { useKeyboardEvents } from 'dashboard/composables/useKeyboardEvents';
import FileUpload from 'vue-upload-component';
import * as ActiveStorage from 'activestorage';
import inboxMixin from 'shared/mixins/inboxMixin';
import { FEATURE_FLAGS } from 'dashboard/featureFlags';
import {
  ALLOWED_FILE_TYPES,
  ALLOWED_FILE_TYPES_FOR_TWILIO_WHATSAPP,
  ALLOWED_FILE_TYPES_FOR_LINE,
  ALLOWED_FILE_TYPES_FOR_INSTAGRAM,
} from 'shared/constants/messages';
import VideoCallButton from '../VideoCallButton.vue';
import AIAssistanceButton from '../AIAssistanceButton.vue';
import { REPLY_EDITOR_MODES } from './constants';
import { mapGetters } from 'vuex';
import NextButton from 'dashboard/components-next/button/Button.vue';
import ScheduleSendPopover from 'dashboard/components-next/ScheduleSend/ScheduleSendPopover.vue';
import ScheduledChip from 'dashboard/components-next/ScheduleSend/ScheduledChip.vue';
import { isTelegramConversation, formatDateToLocal, getTimezoneOffsetMinutes } from 'dashboard/helper/conversation';
import { scheduleTelegramMessage } from 'dashboard/api/telegramScheduleSend';

export default {
  name: 'ReplyBottomPanel',
  components: { 
    NextButton, 
    FileUpload, 
    VideoCallButton, 
    AIAssistanceButton,
    ScheduleSendPopover,
    ScheduledChip,
  },
  mixins: [inboxMixin],
  props: {
    mode: {
      type: String,
      default: REPLY_EDITOR_MODES.REPLY,
    },
    onSend: {
      type: Function,
      default: () => {},
    },
    sendButtonText: {
      type: String,
      default: '',
    },
    recordingAudioDurationText: {
      type: String,
      default: '00:00',
    },
    // inbox prop is used in /mixins/inboxMixin,
    // remove this props when refactoring to composable if not needed
    // eslint-disable-next-line vue/no-unused-properties
    inbox: {
      type: Object,
      default: () => ({}),
    },
    showFileUpload: {
      type: Boolean,
      default: false,
    },
    showAudioRecorder: {
      type: Boolean,
      default: false,
    },
    onFileUpload: {
      type: Function,
      default: () => {},
    },
    toggleEmojiPicker: {
      type: Function,
      default: () => {},
    },
    toggleAudioRecorder: {
      type: Function,
      default: () => {},
    },
    toggleAudioRecorderPlayPause: {
      type: Function,
      default: () => {},
    },
    isRecordingAudio: {
      type: Boolean,
      default: false,
    },
    recordingAudioState: {
      type: String,
      default: '',
    },
    isSendDisabled: {
      type: Boolean,
      default: false,
    },
    showEditorToggle: {
      type: Boolean,
      default: false,
    },
    isOnPrivateNote: {
      type: Boolean,
      default: false,
    },
    enableMultipleFileUpload: {
      type: Boolean,
      default: true,
    },
    enableWhatsAppTemplates: {
      type: Boolean,
      default: false,
    },
    conversationId: {
      type: Number,
      required: true,
    },
    message: {
      type: String,
      default: '',
    },
    newConversationModalActive: {
      type: Boolean,
      default: false,
    },
    portalSlug: {
      type: String,
      required: true,
    },
    conversationType: {
      type: String,
      default: '',
    },
    conversation: {
      type: Object,
      default: () => ({}),
    },
  },
  emits: [
    'replaceText',
    'toggleInsertArticle',
    'toggleEditor',
    'selectWhatsappTemplate',
  ],
  setup() {
    const { setSignatureFlagForInbox, fetchSignatureFlagFromUISettings } =
      useUISettings();

    const uploadRef = ref(false);

    const keyboardEvents = {
      '$mod+Alt+KeyA': {
        action: () => {
          // TODO: This is really hacky, we need to replace the file picker component with
          // a custom one, where the logic and the component markup is isolated.
          // Once we have the custom component, we can remove the hacky logic below.

          const uploadTriggerButton = document.querySelector(
            '#conversationAttachment'
          );
          uploadTriggerButton.click();
        },
        allowOnFocusedInput: true,
      },
    };

    useKeyboardEvents(keyboardEvents);

    return {
      setSignatureFlagForInbox,
      fetchSignatureFlagFromUISettings,
      uploadRef,
    };
  },
  data() {
    return {
      scheduledAt: null,
      isScheduling: false,
      showSchedulePopover: false,
    };
  },
  computed: {
    ...mapGetters({
      accountId: 'getCurrentAccountId',
      isFeatureEnabledonAccount: 'accounts/isFeatureEnabledonAccount',
      uiFlags: 'integrations/getUIFlags',
    }),
    isNote() {
      return this.mode === REPLY_EDITOR_MODES.NOTE;
    },
    wrapClass() {
      return {
        'is-note-mode': this.isNote,
      };
    },
    showAttachButton() {
      return this.showFileUpload || this.isNote;
    },
    showAudioRecorderButton() {
      if (this.isALineChannel) {
        return false;
      }
      // Disable audio recorder for safari browser as recording is not supported
      // const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(
      //   navigator.userAgent
      // );

      return (
        this.isFeatureEnabledonAccount(
          this.accountId,
          FEATURE_FLAGS.VOICE_RECORDER
        ) && this.showAudioRecorder
        // !isSafari
      );
    },
    showAudioPlayStopButton() {
      return this.showAudioRecorder && this.isRecordingAudio;
    },
    isInstagramDM() {
      return this.conversationType === 'instagram_direct_message';
    },
    allowedFileTypes() {
      if (this.isATwilioWhatsAppChannel) {
        return ALLOWED_FILE_TYPES_FOR_TWILIO_WHATSAPP;
      }
      if (this.isALineChannel) {
        return ALLOWED_FILE_TYPES_FOR_LINE;
      }
      if (this.isAnInstagramChannel || this.isInstagramDM) {
        return ALLOWED_FILE_TYPES_FOR_INSTAGRAM;
      }

      return ALLOWED_FILE_TYPES;
    },
    enableDragAndDrop() {
      return !this.newConversationModalActive;
    },
    audioRecorderPlayStopIcon() {
      switch (this.recordingAudioState) {
        // playing paused recording stopped inactive destroyed
        case 'playing':
          return 'i-ph-pause';
        case 'paused':
          return 'i-ph-play';
        case 'stopped':
          return 'i-ph-play';
        default:
          return 'i-ph-stop';
      }
    },
    showMessageSignatureButton() {
      return !this.isOnPrivateNote;
    },
    sendWithSignature() {
      // channelType is sourced from inboxMixin
      return this.fetchSignatureFlagFromUISettings(this.channelType);
    },
    signatureToggleTooltip() {
      return this.sendWithSignature
        ? this.$t('CONVERSATION.FOOTER.DISABLE_SIGN_TOOLTIP')
        : this.$t('CONVERSATION.FOOTER.ENABLE_SIGN_TOOLTIP');
    },
    enableInsertArticleInReply() {
      return this.portalSlug;
    },
    isFetchingAppIntegrations() {
      return this.uiFlags.isFetching;
    },
    isTelegramConversation() {
      return isTelegramConversation(this.conversation);
    },
    showScheduleSendButton() {
      return this.isTelegramConversation && !this.isOnPrivateNote;
    },
    isScheduleButtonPrimary() {
      return !!this.scheduledAt;
    },
    scheduleButtonTooltip() {
      if (this.scheduledAt) {
        return this.$t('SCHEDULE_SEND.TOOLTIP_READY', { datetime: this.formattedScheduledAt });
      }
      return this.$t('SCHEDULE_SEND.TOOLTIP_SELECT');
    },
    formattedScheduledAt() {
      if (!this.scheduledAt) return '';
      return formatDateToLocal(this.scheduledAt);
    },
  },
  mounted() {
    ActiveStorage.start();
  },
  methods: {
    toggleMessageSignature() {
      this.setSignatureFlagForInbox(this.channelType, !this.sendWithSignature);
    },
    replaceText(text) {
      this.$emit('replaceText', text);
    },
    toggleInsertArticle() {
      this.$emit('toggleInsertArticle');
    },
    openSchedulePopover() {
      this.showSchedulePopover = true;
    },
    closeSchedulePopover() {
      this.showSchedulePopover = false;
    },
    confirmSchedule(date) {
      this.scheduledAt = date;
      this.closeSchedulePopover();
    },
    clearSchedule() {
      this.scheduledAt = null;
      this.closeSchedulePopover();
    },
    onScheduleSendClick() {
      // Si ya hay una fecha programada, enviar directamente
      if (this.scheduledAt) {
        this.onScheduleSend();
      } else {
        // Si no hay fecha, abrir el popover
        this.openSchedulePopover();
      }
    },
    
    async onScheduleSend() {
      if (!this.scheduledAt) {
        this.$emit('showAlert', {
          type: 'error',
          message: this.$t('SCHEDULE_SEND.VALIDATION_REQUIRED'),
        });
        return;
      }

      if (!this.message || !this.message.trim()) {
        this.$emit('showAlert', {
          type: 'error',
          message: this.$t('SCHEDULE_SEND.MESSAGE_REQUIRED'),
        });
        return;
      }

      // Validate that scheduled date is in the future
      const now = new Date();
      const scheduledDate = new Date(this.scheduledAt);
      if (scheduledDate <= now) {
        this.$emit('showAlert', {
          type: 'error',
          message: this.$t('SCHEDULE_SEND.VALIDATION_FUTURE'),
        });
        return;
      }

      try {
        this.isScheduling = true;
        
        const params = {
          accountId: this.accountId,
          inboxId: this.conversation.inbox_id,
          conversationId: this.conversation.id,
          contactId: this.conversation.meta?.sender?.id || this.conversation.contact_id,
          message: this.message.trim(),
          messageHtml: this.message.trim(), // For Telegram, we'll use plain text
          scheduledAt: this.scheduledAt,
          scheduledAtLocal: this.formattedScheduledAt,
          timezoneOffsetMinutes: getTimezoneOffsetMinutes(),
        };

        await scheduleTelegramMessage(params);

        this.$emit('showAlert', {
          type: 'success',
          message: this.$t('SCHEDULE_SEND.TOAST_SUCCESS', { datetime: this.formattedScheduledAt }),
        });

        // Clear the scheduled date after successful scheduling
        this.scheduledAt = null;
      } catch (error) {
        console.error('Error scheduling Telegram message:', error);
        this.$emit('showAlert', {
          type: 'error',
          message: error.message || this.$t('SCHEDULE_SEND.TOAST_ERROR'),
        });
      } finally {
        this.isScheduling = false;
      }
    },
  },
};
</script>

<template>
  <div class="flex justify-between p-3" :class="wrapClass">
    <div class="left-wrap">
      <NextButton
        v-tooltip.top-end="$t('CONVERSATION.REPLYBOX.TIP_EMOJI_ICON')"
        icon="i-ph-smiley-sticker"
        slate
        faded
        sm
        @click="toggleEmojiPicker"
      />
      <FileUpload
        ref="uploadRef"
        v-tooltip.top-end="$t('CONVERSATION.REPLYBOX.TIP_ATTACH_ICON')"
        input-id="conversationAttachment"
        :size="4096 * 4096"
        :accept="allowedFileTypes"
        :multiple="enableMultipleFileUpload"
        :drop="enableDragAndDrop"
        :drop-directory="false"
        :data="{
          direct_upload_url: '/rails/active_storage/direct_uploads',
          direct_upload: true,
        }"
        @input-file="onFileUpload"
      >
        <NextButton
          v-if="showAttachButton"
          v-tooltip.top-end="$t('CONVERSATION.REPLYBOX.TIP_ATTACH_ICON')"
          icon="i-ph-paperclip"
          slate
          faded
          sm
        />
      </FileUpload>
      <NextButton
        v-if="showAudioRecorderButton"
        v-tooltip.top-end="$t('CONVERSATION.REPLYBOX.TIP_AUDIORECORDER_ICON')"
        :icon="!isRecordingAudio ? 'i-ph-microphone' : 'i-ph-microphone-slash'"
        slate
        faded
        sm
        @click="toggleAudioRecorder"
      />
      <NextButton
        v-if="showEditorToggle"
        v-tooltip.top-end="$t('CONVERSATION.REPLYBOX.TIP_FORMAT_ICON')"
        icon="i-ph-quotes"
        slate
        faded
        sm
        @click="$emit('toggleEditor')"
      />
      <NextButton
        v-if="showAudioPlayStopButton"
        v-tooltip.top-end="$t('CONVERSATION.REPLYBOX.TIP_FORMAT_ICON')"
        :icon="audioRecorderPlayStopIcon"
        slate
        faded
        sm
        :label="recordingAudioDurationText"
        @click="toggleAudioRecorderPlayPause"
      />
      <NextButton
        v-if="showMessageSignatureButton"
        v-tooltip.top-end="signatureToggleTooltip"
        icon="i-ph-signature"
        slate
        faded
        sm
        @click="toggleMessageSignature"
      />
      <NextButton
        v-if="enableWhatsAppTemplates"
        v-tooltip.top-end="$t('CONVERSATION.FOOTER.WHATSAPP_TEMPLATES')"
        icon="i-ph-whatsapp-logo"
        slate
        faded
        sm
        @click="$emit('selectWhatsappTemplate')"
      />
      <VideoCallButton
        v-if="(isAWebWidgetInbox || isAPIInbox) && !isOnPrivateNote"
        :conversation-id="conversationId"
      />
      <AIAssistanceButton
        v-if="!isFetchingAppIntegrations"
        :conversation-id="conversationId"
        :is-private-note="isOnPrivateNote"
        :message="message"
        @replace-text="replaceText"
      />
      <transition name="modal-fade">
        <div
          v-show="uploadRef && uploadRef.dropActive"
          class="fixed top-0 bottom-0 left-0 right-0 z-20 flex flex-col items-center justify-center w-full h-full gap-2 text-n-slate-12 bg-modal-backdrop-light dark:bg-modal-backdrop-dark"
        >
          <fluent-icon icon="cloud-backup" size="40" />
          <h4 class="text-2xl break-words text-n-slate-12">
            {{ $t('CONVERSATION.REPLYBOX.DRAG_DROP') }}
          </h4>
        </div>
      </transition>
      <NextButton
        v-if="enableInsertArticleInReply"
        v-tooltip.top-end="$t('HELP_CENTER.ARTICLE_SEARCH.OPEN_ARTICLE_SEARCH')"
        icon="i-ph-article-ny-times"
        slate
        faded
        sm
        @click="toggleInsertArticle"
      />
    </div>
    <div class="right-wrap">

      
      <!-- Botón Schedule Send para Telegram -->
      <NextButton
        v-if="showScheduleSendButton"
        :variant="isScheduleButtonPrimary ? 'solid' : 'outline'"
        :color="isScheduleButtonPrimary ? 'blue' : 'slate'"
        size="sm"
        class="!text-xs font-medium mr-2"
        :label="$t('SCHEDULE_SEND.BUTTON')"
        :title="scheduleButtonTooltip"
        :disabled="isScheduling"
        :is-loading="isScheduling"
        @click="onScheduleSendClick"
      />
      <NextButton
        :label="sendButtonText"
        type="submit"
        sm
        :color="isNote ? 'amber' : 'blue'"
        :disabled="isSendDisabled"
        class="flex-shrink-0"
        @click="onSend"
      />
    </div>
    

    
    <!-- Schedule Send Popover -->
    <ScheduleSendPopover
      :is-open="showSchedulePopover"
      :scheduled-at="scheduledAt"
      @confirm="confirmSchedule"
      @clear="clearSchedule"
    />
    
    <!-- Scheduled Chip -->
    <ScheduledChip
      :scheduled-at="scheduledAt"
      @edit="openSchedulePopover"
      @clear="clearSchedule"
    />
  </div>
</template>

<style lang="scss" scoped>
.left-wrap {
  @apply items-center flex gap-2;
}

.right-wrap {
  @apply flex;
}

::v-deep .file-uploads {
  label {
    @apply cursor-pointer;
  }

  &:hover button {
    @apply enabled:bg-n-slate-9/20;
  }
}
</style>
