<script setup>
import { defineAsyncComponent, ref, computed, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useUISettings } from 'dashboard/composables/useUISettings';
import { useFileUpload } from 'dashboard/composables/useFileUpload';
import { vOnClickOutside } from '@vueuse/components';
import { ALLOWED_FILE_TYPES } from 'shared/constants/messages';
import { useKeyboardEvents } from 'dashboard/composables/useKeyboardEvents';
import FileUpload from 'vue-upload-component';
import { extractTextFromMarkdown } from 'dashboard/helper/editorHelper';
import { format } from 'date-fns';

import Button from 'dashboard/components-next/button/Button.vue';
import WhatsAppOptions from './WhatsAppOptions.vue';

const props = defineProps({
  attachedFiles: { type: Array, default: () => [] },
  isWhatsappInbox: { type: Boolean, default: false },
  isEmailOrWebWidgetInbox: { type: Boolean, default: false },
  isTwilioSmsInbox: { type: Boolean, default: false },
  messageTemplates: { type: Array, default: () => [] },
  channelType: { type: String, default: '' },
  isLoading: { type: Boolean, default: false },
  disableSendButton: { type: Boolean, default: false },
  hasSelectedInbox: { type: Boolean, default: false },
  hasNoInbox: { type: Boolean, default: false },
  isDropdownActive: { type: Boolean, default: false },
  messageSignature: { type: String, default: '' },
  inboxId: { type: Number, default: null },
  scheduledAt: { type: [Date, String, Number, null], default: null },
  isScheduling: { type: Boolean, default: false },
});

const emit = defineEmits([
  'discard',
  'sendMessage',
  'sendWhatsappMessage',
  'insertEmoji',
  'addSignature',
  'removeSignature',
  'attachFile',
  'schedule',
  'update:scheduledAt',
]);

const { t } = useI18n();

const uploadAttachment = ref(null);
const isEmojiPickerOpen = ref(false);
const isSchedulerOpen = ref(false);
const scheduleAt = ref(null);
const tempDate = ref(null);

const EmojiInput = defineAsyncComponent(
  () => import('shared/components/emoji/EmojiInput.vue')
);

const signatureToApply = computed(() =>
  props.isEmailOrWebWidgetInbox
    ? props.messageSignature
    : extractTextFromMarkdown(props.messageSignature)
);

const {
  fetchSignatureFlagFromUISettings,
  setSignatureFlagForInbox,
  isEditorHotKeyEnabled,
} = useUISettings();

const sendWithSignature = computed(() => {
  return fetchSignatureFlagFromUISettings(props.channelType);
});

const setSignature = () => {
  if (signatureToApply.value) {
    if (sendWithSignature.value) {
      emit('addSignature', signatureToApply.value);
    } else {
      emit('removeSignature', signatureToApply.value);
    }
  }
};

const toggleMessageSignature = () => {
  setSignatureFlagForInbox(props.channelType, !sendWithSignature.value);
  setSignature();
};

// Added this watch to dynamically set signature on target inbox change.
// Only targetInbox has value and is Advance Editor(used by isEmailOrWebWidgetInbox)
// Set the signature only if the inbox based flag is true
watch(
  () => props.hasSelectedInbox,
  newValue => {
    nextTick(() => {
      if (newValue && props.isEmailOrWebWidgetInbox) setSignature();
    });
  },
  { immediate: true }
);

const onClickInsertEmoji = emoji => {
  emit('insertEmoji', emoji);
};

const openScheduler = () => {
  isSchedulerOpen.value = true;
  // Siempre usar el estado interno scheduleAt, no la prop
  tempDate.value = scheduleAt.value ? new Date(scheduleAt.value) : null;
};

const closeScheduler = () => {
  isSchedulerOpen.value = false;
};

const confirmSchedule = () => {
  if (tempDate.value) {
    scheduleAt.value = new Date(tempDate.value);
    // Emitir el evento para sincronizar con el componente padre
    emit('update:scheduledAt', scheduleAt.value);
    closeScheduler();
  }
};

const clearSchedule = () => {
  tempDate.value = null;
  scheduleAt.value = null;
  // Emitir el evento para sincronizar con el componente padre
  emit('update:scheduledAt', null);
  closeScheduler();
};

const isScheduleButtonPrimary = computed(() => !!scheduleAt.value);
const scheduleButtonTooltip = computed(() => {
  if (scheduleAt.value) {
    return t('SCHEDULE_SEND.TOOLTIP_READY', { datetime: formattedScheduledAt.value });
  }
  return t('SCHEDULE_SEND.TOOLTIP_SELECT');
});

const scheduleButtonLabel = computed(() => {
  if (scheduleAt.value) {
    return t('SCHEDULE_SEND.BUTTON');
  }
  return t('SCHEDULE_SEND.BUTTON');
});

const onScheduleClick = () => {
  if (scheduleAt.value) {
    // Si ya hay una fecha seleccionada, emitir el evento para ejecutar el POST
    emit('schedule', scheduleAt.value);
  } else {
    // Si no hay fecha, abrir el picker
    openScheduler();
  }
};

const onEditSchedule = () => {
  // Abrir el picker para editar la fecha existente
  openScheduler();
};

const getMinDateTime = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formattedScheduledAt = computed(() =>
  scheduleAt.value ? format(new Date(scheduleAt.value), 'dd/MM/yyyy HH:mm') : ''
);

// Sincronizar la prop scheduledAt con el estado interno
watch(() => props.scheduledAt, (newValue) => {
  if (newValue) {
    scheduleAt.value = new Date(newValue);
  } else {
    scheduleAt.value = null;
  }
}, { immediate: true });

const { onFileUpload } = useFileUpload({
  isATwilioSMSChannel: props.isTwilioSmsInbox,
  attachFile: ({ blob, file }) => {
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file.file);
    reader.onloadend = () => {
      const newFile = {
        resource: blob || file,
        isPrivate: false,
        thumb: reader.result,
        blobSignedId: blob?.signed_id,
      };
      emit('attachFile', [...props.attachedFiles, newFile]);
    };
  },
});

const sendButtonLabel = computed(() => {
  const keyCode = isEditorHotKeyEnabled('cmd_enter') ? '⌘ + ↵' : '↵';
  return t('COMPOSE_NEW_CONVERSATION.FORM.ACTION_BUTTONS.SEND', {
    keyCode,
  });
});

const keyboardEvents = {
  Enter: {
    action: () => {
      if (
        isEditorHotKeyEnabled('enter') &&
        !props.isWhatsappInbox &&
        !props.isDropdownActive
      ) {
        emit('sendMessage');
      }
    },
  },
  '$mod+Enter': {
    action: () => {
      if (
        isEditorHotKeyEnabled('cmd_enter') &&
        !props.isWhatsappInbox &&
        !props.isDropdownActive
      ) {
        emit('sendMessage');
      }
    },
  },
};
useKeyboardEvents(keyboardEvents);
</script>

<template>
  <div
    class="relative flex items-center justify-between w-full h-[3.25rem] gap-2 px-4 py-3"
  >
    <div class="flex gap-2 items-center">
      <WhatsAppOptions
        v-if="isWhatsappInbox"
        :inbox-id="inboxId"
        :message-templates="messageTemplates"
        @send-message="emit('sendWhatsappMessage', $event)"
      />
      <div
        v-if="!isWhatsappInbox && !hasNoInbox"
        v-on-click-outside="() => (isEmojiPickerOpen = false)"
        class="relative"
      >
        <Button
          icon="i-lucide-smile-plus"
          color="slate"
          size="sm"
          class="!w-10"
          @click="isEmojiPickerOpen = !isEmojiPickerOpen"
        />
        <EmojiInput
          v-if="isEmojiPickerOpen"
          class="ltr:left-0 rtl:right-0 top-full mt-1.5"
          :on-click="onClickInsertEmoji"
        />
      </div>
      <FileUpload
        v-if="isEmailOrWebWidgetInbox"
        ref="uploadAttachment"
        input-id="composeNewConversationAttachment"
        :size="4096 * 4096"
        :accept="ALLOWED_FILE_TYPES"
        multiple
        :drop-directory="false"
        :data="{
          direct_upload_url: '/rails/active_storage/direct_uploads',
          direct_upload: true,
        }"
        class="p-px"
        @input-file="onFileUpload"
      >
        <Button
          icon="i-lucide-plus"
          color="slate"
          size="sm"
          class="!w-10 relative"
        />
      </FileUpload>
      <Button
        v-if="hasSelectedInbox && !isWhatsappInbox"
        icon="i-lucide-signature"
        color="slate"
        size="sm"
        class="!w-10"
        @click="toggleMessageSignature"
      />
    </div>

    <div class="flex gap-2 items-center">
      <Button
        :label="t('COMPOSE_NEW_CONVERSATION.FORM.ACTION_BUTTONS.DISCARD')"
        variant="faded"
        color="slate"
        size="sm"
        class="!text-xs font-medium"
        @click="emit('discard')"
      />
      <Button
        v-if="!isWhatsappInbox"
        :variant="isScheduleButtonPrimary ? 'solid' : 'outline'"
        :color="isScheduleButtonPrimary ? 'blue' : 'slate'"
        size="sm"
        class="!text-xs font-medium ml-2"
        :label="t('SCHEDULE_SEND.BUTTON')"
        :title="scheduleButtonTooltip"
        :disabled="isScheduling"
        :is-loading="isScheduling"
        @click="onScheduleClick"
      />
      
      <!-- Schedule Popover -->
      <div
        v-if="isSchedulerOpen"
        class="absolute bottom-14 right-4 z-50 bg-white dark:bg-n-solid-3 border border-n-strong rounded-lg shadow-lg p-4 min-w-[380px]"
      >
        <div class="mb-3">
          <label class="block text-sm font-medium text-n-slate-12 mb-2">
            {{ t('SCHEDULE_SEND.TITLE') }}
          </label>
          <input
            v-model="tempDate"
            type="datetime-local"
            :min="getMinDateTime()"
            class="w-full px-3 py-2 border border-n-strong rounded-md bg-white dark:bg-n-solid-2 text-n-slate-12 focus:outline-none focus:ring-2 focus:ring-n-brand focus:border-transparent"
          />
        </div>
        <div class="flex gap-2 justify-end">
          <Button
            variant="faded"
            color="slate"
            size="sm"
            :label="t('GENERAL.CLEAR')"
            @click="clearSchedule"
          />
          <Button
            variant="solid"
            color="blue"
            size="sm"
            :label="t('SCHEDULE_SEND.PICKER_CONFIRM')"
            :disabled="!tempDate"
            aria-label="Confirm scheduled date and time"
            @click="confirmSchedule"
          />
        </div>
      </div>
      
      <Button
        v-if="!isWhatsappInbox"
        :label="sendButtonLabel"
        size="sm"
        class="!text-xs font-medium"
        :disabled="isLoading || disableSendButton || isScheduling"
        :is-loading="isLoading"
        @click="emit('sendMessage')"
      />
    </div>
    
    <!-- Schedule Badge -->
    <div
      v-if="scheduleAt"
      class="absolute bottom-20 right-4 z-40 bg-n-amber-9/10 border border-n-amber-8 rounded-full px-3 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-n-amber-9/20 transition-colors"
      @click="onEditSchedule"
      title="Click to edit scheduled time"
    >
      <span class="text-xs text-n-amber-11 font-medium">
        Scheduled: {{ formattedScheduledAt }}
      </span>
      <button
        @click.stop="clearSchedule"
        class="text-n-amber-11 hover:text-n-amber-12 transition-colors"
        title="Clear scheduled time"
        aria-label="Clear scheduled time"
      >
        <span class="text-xs">×</span>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.emoji-dialog::before {
  @apply hidden;
}

// The <label> tag inside the file-upload component overlaps the button due to its position.
// This causes the button's hover state to not work, as it's positioned below the label (z-index).
// Increasing the button's z-index would break the file upload functionality.
// This style ensures the label remains clickable while preserving the button's hover effect.
:deep() {
  .file-uploads.file-uploads-html5 {
    label {
      @apply hover:cursor-pointer;
    }

    &:hover button {
      @apply dark:bg-n-solid-2 bg-n-alpha-2;
    }
  }
}
</style>
