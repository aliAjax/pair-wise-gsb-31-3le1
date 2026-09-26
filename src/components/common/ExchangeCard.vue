<template>
  <article class="exchange-card">
    <header>
      <span class="status-pill" :class="statusToneClass(exchange.status)">
        {{ formatExchangeStatus(exchange.status) }}
      </span>
      <span v-if="isBundle" class="pill">组合交换 · {{ fromItems.length }} 件</span>
      <small>{{ formatDate(exchange.updated_at) }}</small>
    </header>
    <div class="exchange-card__items">
      <div>
        <span>拿出{{ isBundle ? `（${confirmedCount}/${fromItems.length} 已确认）` : '' }}</span>
        <ul class="exchange-card__bundle">
          <li v-for="fromItem in fromItems" :key="fromItem.id">
            <strong>{{ fromItem.title }}</strong>
            <label v-if="canConfirm" class="exchange-card__confirm">
              <input
                type="checkbox"
                :checked="confirmedIds.includes(fromItem.id)"
                @change="toggleConfirm(fromItem.id)"
              />
              确认这件
            </label>
            <em v-else-if="confirmedIds.includes(fromItem.id)">已确认</em>
          </li>
        </ul>
      </div>
      <div>
        <span>换取</span>
        <strong>{{ toItem?.title ?? '未知物品' }}</strong>
      </div>
    </div>
    <p>{{ exchange.message || formatStatusMessage(exchange.status) }}</p>
    <footer>
      <span v-if="fromUser && toUser">{{ fromUser.nickname }} → {{ toUser.nickname }}</span>
      <div v-if="canOperate" class="exchange-card__actions">
        <template v-if="exchange.status === ExchangeStatus.PENDING">
          <button
            type="button"
            :disabled="!allConfirmed"
            :title="allConfirmed ? '' : FORM_MESSAGES.exchangeBundleNotFullyConfirmed"
            @click="$emit('accept', exchange.id)"
          >
            {{ isBundle ? '整组答应' : '同意' }}
          </button>
          <button type="button" @click="$emit('reject', exchange.id)">
            {{ isBundle ? '整组拒绝' : '拒绝' }}
          </button>
        </template>
        <button v-if="exchange.status === ExchangeStatus.ACCEPTED" type="button" @click="$emit('complete', exchange.id)">
          完成
        </button>
      </div>
    </footer>
    <small v-if="showConfirmHint" class="exchange-card__hint">{{ FORM_MESSAGES.exchangeBundleNotFullyConfirmed }}</small>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { ExchangeStatus } from '@/constants/exchange';
import { FORM_MESSAGES } from '@/constants/messages';
import type { Exchange } from '@/models/exchange';
import { exchangeFromItemIds, isBundleExchange } from '@/models/exchange';
import type { Item } from '@/models/item';
import type { User } from '@/models/user';
import { useAuthStore } from '@/stores/authStore';
import { formatDate, formatExchangeStatus, formatStatusMessage, statusToneClass } from '@/utils/formatters';

const props = defineProps<{
  exchange: Exchange;
  items: Item[];
  users: User[];
}>();

const emit = defineEmits<{
  accept: [id: string];
  reject: [id: string];
  complete: [id: string];
  toggleConfirm: [id: string, itemId: string, confirmed: boolean];
}>();

const authStore = useAuthStore();
const isBundle = computed(() => isBundleExchange(props.exchange));
const fromItems = computed(() =>
  exchangeFromItemIds(props.exchange).map((itemId) => ({
    id: itemId,
    title: props.items.find((item) => item.id === itemId)?.title ?? '未知物品',
  })),
);
const toItem = computed(() => props.items.find((item) => item.id === props.exchange.to_item_id));
const fromUser = computed(() => props.users.find((user) => user.id === props.exchange.from_user_id));
const toUser = computed(() => props.users.find((user) => user.id === props.exchange.to_user_id));
const confirmedIds = computed(() => props.exchange.confirmed_item_ids ?? []);
const confirmedCount = computed(() => confirmedIds.value.filter((id) => exchangeFromItemIds(props.exchange).includes(id)).length);
const allConfirmed = computed(() => !isBundle.value || confirmedCount.value === fromItems.value.length);
const isOwner = computed(() => authStore.currentUser?.id === props.exchange.to_user_id);
const canConfirm = computed(() => isOwner.value && isBundle.value && props.exchange.status === ExchangeStatus.PENDING);
const showConfirmHint = computed(() => canConfirm.value && !allConfirmed.value);
const canOperate = computed(
  () =>
    authStore.currentUser?.id === props.exchange.to_user_id ||
    (authStore.currentUser?.id === props.exchange.from_user_id && props.exchange.status === ExchangeStatus.ACCEPTED),
);

const toggleConfirm = (itemId: string) => {
  emit('toggleConfirm', props.exchange.id, itemId, !confirmedIds.value.includes(itemId));
};
</script>
