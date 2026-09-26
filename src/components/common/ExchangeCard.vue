<template>
  <article class="exchange-card">
    <header>
      <span class="status-pill" :class="statusToneClass(exchange.status)">
        {{ formatExchangeStatus(exchange.status) }}
      </span>
      <span v-if="bundle" class="pill">组合交换 · {{ fromEntries.length }} 换 1</span>
      <small>{{ formatDate(exchange.updated_at) }}</small>
    </header>
    <div class="exchange-card__items">
      <div>
        <span>拿出{{ bundle ? `（共 ${fromEntries.length} 件）` : '' }}</span>
        <strong v-if="!bundle">{{ fromEntries[0]?.item?.title ?? '未知物品' }}</strong>
        <ul v-else class="exchange-card__bundle">
          <li v-for="entry in fromEntries" :key="entry.id">
            <span class="exchange-card__bundle-title">{{ entry.item?.title ?? '未知物品' }}</span>
            <small v-if="entry.item">{{ formatCondition(entry.item.condition) }}</small>
            <em
              v-if="entry.item"
              class="status-pill exchange-card__bundle-status"
              :class="statusToneClass(entry.item.status)"
            >
              {{ formatItemStatus(entry.item.status) }}
            </em>
          </li>
        </ul>
      </div>
      <div>
        <span>换取</span>
        <strong>{{ toItem?.title ?? '未知物品' }}</strong>
      </div>
    </div>

    <div v-if="needItemConfirm" class="exchange-card__confirm">
      <span>物主逐件确认后，整组一起答应或拒绝：</span>
      <label v-for="entry in fromEntries" :key="entry.id">
        <input
          type="checkbox"
          :checked="confirmedIds.includes(entry.id)"
          @change="toggleConfirm(entry.id)"
        />
        已看过「{{ entry.item?.title ?? '未知物品' }}」
      </label>
    </div>

    <p>{{ exchange.message || formatStatusMessage(exchange.status) }}</p>
    <footer>
      <span v-if="fromUser && toUser">{{ fromUser.nickname }} → {{ toUser.nickname }}</span>
      <div v-if="canOperate" class="exchange-card__actions">
        <button
          v-if="exchange.status === ExchangeStatus.PENDING"
          type="button"
          :disabled="needItemConfirm && !allConfirmed"
          @click="$emit('accept', exchange.id)"
        >
          {{ bundle ? '整组答应' : '同意' }}
        </button>
        <button v-if="exchange.status === ExchangeStatus.PENDING" type="button" @click="$emit('reject', exchange.id)">
          {{ bundle ? '整组拒绝' : '拒绝' }}
        </button>
        <button v-if="exchange.status === ExchangeStatus.ACCEPTED" type="button" @click="$emit('complete', exchange.id)">
          完成
        </button>
      </div>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { ExchangeStatus } from '@/constants/exchange';
import { exchangeFromItemIds, isBundleExchange, type Exchange } from '@/models/exchange';
import type { Item } from '@/models/item';
import type { User } from '@/models/user';
import { useAuthStore } from '@/stores/authStore';
import {
  formatCondition,
  formatDate,
  formatExchangeStatus,
  formatItemStatus,
  formatStatusMessage,
  statusToneClass,
} from '@/utils/formatters';

const props = defineProps<{
  exchange: Exchange;
  items: Item[];
  users: User[];
}>();

defineEmits<{
  accept: [id: string];
  reject: [id: string];
  complete: [id: string];
}>();

const authStore = useAuthStore();
const bundle = computed(() => isBundleExchange(props.exchange));
const fromEntries = computed(() =>
  exchangeFromItemIds(props.exchange).map((id) => ({
    id,
    item: props.items.find((item) => item.id === id),
  })),
);
const toItem = computed(() => props.items.find((item) => item.id === props.exchange.to_item_id));
const fromUser = computed(() => props.users.find((user) => user.id === props.exchange.from_user_id));
const toUser = computed(() => props.users.find((user) => user.id === props.exchange.to_user_id));

const confirmedIds = ref<string[]>([]);
const needItemConfirm = computed(
  () =>
    bundle.value &&
    props.exchange.status === ExchangeStatus.PENDING &&
    authStore.currentUser?.id === props.exchange.to_user_id,
);
const allConfirmed = computed(() => fromEntries.value.every((entry) => confirmedIds.value.includes(entry.id)));
const toggleConfirm = (id: string) => {
  confirmedIds.value = confirmedIds.value.includes(id)
    ? confirmedIds.value.filter((item) => item !== id)
    : [...confirmedIds.value, id];
};

const canOperate = computed(
  () =>
    authStore.currentUser?.id === props.exchange.to_user_id ||
    (authStore.currentUser?.id === props.exchange.from_user_id && props.exchange.status === ExchangeStatus.ACCEPTED),
);
</script>
