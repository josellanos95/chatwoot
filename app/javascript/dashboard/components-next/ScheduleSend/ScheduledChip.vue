<template>
  <div
    v-if="scheduledAt"
    class="absolute bottom-20 right-4 z-40 bg-n-amber-9/10 border border-n-amber-8 rounded-full px-3 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-n-amber-9/20 transition-colors"
    @click="$emit('edit')"
    title="Click to edit scheduled time"
  >
    <span class="text-xs text-n-amber-11 font-medium">
      {{ t('SCHEDULE_SEND.SCHEDULED_CHIP', { date: formattedDate }) }}
    </span>
    <button
      @click.stop="$emit('clear')"
      class="text-n-amber-11 hover:text-n-amber-12 transition-colors"
      title="Clear scheduled time"
      aria-label="Clear scheduled time"
    >
      <span class="text-xs">×</span>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatDateToLocal } from 'dashboard/helper/conversation';

const props = defineProps({
  scheduledAt: {
    type: [Date, String, Number, null],
    default: null,
  },
});

defineEmits(['edit', 'clear']);

const { t } = useI18n();

const formattedDate = computed(() => {
  if (!props.scheduledAt) return '';
  return formatDateToLocal(props.scheduledAt);
});
</script>
