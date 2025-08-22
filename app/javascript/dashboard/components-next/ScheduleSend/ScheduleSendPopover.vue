<template>
  <div
    v-if="isOpen"
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
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Button from 'dashboard/components-next/button/Button.vue';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  scheduledAt: {
    type: [Date, String, Number, null],
    default: null,
  },
});

const emit = defineEmits(['confirm', 'clear']);

const { t } = useI18n();

const tempDate = ref(null);

// Watch for changes in scheduledAt prop
watch(() => props.scheduledAt, (newValue) => {
  if (newValue) {
    tempDate.value = new Date(newValue).toISOString().slice(0, 16);
  } else {
    tempDate.value = null;
  }
}, { immediate: true });

const getMinDateTime = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const confirmSchedule = () => {
  if (tempDate.value) {
    emit('confirm', new Date(tempDate.value));
  }
};

const clearSchedule = () => {
  tempDate.value = null;
  emit('clear');
};
</script>
