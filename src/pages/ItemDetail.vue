<template>
  <section v-if="item" class="page detail-page">
    <RouterLink class="text-link" to="/home">返回首页</RouterLink>
    <div class="detail-layout">
      <ItemImageGallery :images="item.images" :fallback-text="item.category" />
      <article class="detail-panel">
        <div class="item-card__topline">
          <span class="pill">{{ item.category }}</span>
          <span class="status-pill" :class="statusToneClass(item.status)">
            {{ formatItemStatus(item.status) }}
          </span>
        </div>
        <h1>{{ item.title }}</h1>
        <p>{{ item.description }}</p>
        <dl class="detail-list">
          <div>
            <dt>成色</dt>
            <dd>{{ formatCondition(item.condition) }}</dd>
          </div>
          <div>
            <dt>地点</dt>
            <dd>{{ item.location }}</dd>
          </div>
          <div>
            <dt>发布时间</dt>
            <dd>{{ formatDate(item.created_at) }}</dd>
          </div>
        </dl>
        <UserBrief v-if="owner" :user="owner" />

        <div v-if="!isMine" class="exchange-box">
          <div class="bundle-picker">
            <span class="bundle-picker__label">我的交换物（勾 1-3 件，可组合交换）</span>
            <label
              v-for="myItem in pickerItems"
              :key="myItem.id"
              class="bundle-picker__option"
              :class="{ 'bundle-picker__option--disabled': isOptionDisabled(myItem.id) }"
            >
              <input
                type="checkbox"
                :checked="selectedItemIds.includes(myItem.id)"
                :disabled="isOptionDisabled(myItem.id)"
                @change="toggleItem(myItem.id)"
              />
              <span class="bundle-picker__title">{{ myItem.title }}</span>
              <small>{{ formatCondition(myItem.condition) }}</small>
              <em v-if="occupiedItemIds.has(myItem.id)" class="bundle-picker__tag">
                {{ FORM_MESSAGES.exchangeItemOccupied }}
              </em>
            </label>
            <p v-if="!pickerItems.length" class="form-note">没有可交换的物品，先去发布一件</p>
          </div>
          <label>
            留言
            <textarea v-model="messageText" rows="3" />
          </label>
          <button
            class="primary-button"
            type="button"
            :disabled="item.status !== ItemStatus.AVAILABLE"
            @click="requestExchange"
          >
            {{ submitLabel }}
          </button>
        </div>
        <button v-else-if="item.status === ItemStatus.AVAILABLE" class="secondary-button" type="button" @click="offlineItem">
          下架这件物品
        </button>
      </article>
    </div>
  </section>
  <EmptyState v-else title="物品不存在" description="可能已被清理或链接无效" mark="404" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

import EmptyState from '@/components/common/EmptyState.vue';
import ItemImageGallery from '@/components/common/ItemImageGallery.vue';
import UserBrief from '@/components/common/UserBrief.vue';
import { EXCHANGE_BUNDLE_MAX, ExchangeStatus } from '@/constants/exchange';
import { ItemStatus } from '@/constants/item';
import { FORM_MESSAGES } from '@/constants/messages';
import { useAuthStore } from '@/stores/authStore';
import { useExchangeStore } from '@/stores/exchangeStore';
import { useItemStore } from '@/stores/itemStore';
import { formatCondition, formatDate, formatItemStatus, statusToneClass } from '@/utils/formatters';
import { message } from '@/utils/message';

const route = useRoute();
const itemStore = useItemStore();
const authStore = useAuthStore();
const exchangeStore = useExchangeStore();

const item = computed(() => itemStore.items.find((entry) => entry.id === route.params.id));
const owner = computed(() => authStore.users.find((user) => user.id === item.value?.user_id));
const isMine = computed(() => authStore.currentUser?.id === item.value?.user_id);
const occupiedItemIds = computed(() => exchangeStore.occupiedItemIds);
// 可勾列表：可交换的 + 已被别的方案占用的（占用件置灰并标注，指出哪件发不出去）
const pickerItems = computed(() => {
  if (!authStore.currentUser) return [];
  return itemStore
    .myItems(authStore.currentUser.id)
    .filter((entry) => entry.status === ItemStatus.AVAILABLE || occupiedItemIds.value.has(entry.id));
});
const selectedItemIds = ref<string[]>([]);
const messageText = ref('我想用这件闲置与你交换，可以沟通时间和地点。');

const isOptionDisabled = (itemId: string) =>
  occupiedItemIds.value.has(itemId) ||
  (!selectedItemIds.value.includes(itemId) && selectedItemIds.value.length >= EXCHANGE_BUNDLE_MAX);

const toggleItem = (itemId: string) => {
  if (selectedItemIds.value.includes(itemId)) {
    selectedItemIds.value = selectedItemIds.value.filter((id) => id !== itemId);
    return;
  }
  if (selectedItemIds.value.length >= EXCHANGE_BUNDLE_MAX) {
    message(FORM_MESSAGES.exchangeBundleMax, 'error');
    return;
  }
  selectedItemIds.value = [...selectedItemIds.value, itemId];
};

const submitLabel = computed(() =>
  selectedItemIds.value.length > 1 ? `以 ${selectedItemIds.value.length} 件换 1 件` : '发起交换',
);

const requestExchange = async () => {
  if (!authStore.currentUser || !item.value || !owner.value) return;
  if (!itemStore.assertCanExchange(authStore.currentUser.id)) return;
  if (!selectedItemIds.value.length) {
    message(FORM_MESSAGES.exchangeBundleEmpty, 'error');
    return;
  }
  try {
    await exchangeStore.create({
      from_user_id: authStore.currentUser.id,
      to_user_id: owner.value.id,
      from_item_id: selectedItemIds.value[0],
      from_item_ids: [...selectedItemIds.value],
      to_item_id: item.value.id,
      status: ExchangeStatus.PENDING,
      message: messageText.value,
    });
    selectedItemIds.value = [];
  } catch (error) {
    // 组里有物品被别的方案占用：发不出去，提示里指出哪件，并刷新占用标记
    message(error instanceof Error ? error.message : '交换请求发送失败', 'error');
    await exchangeStore.hydrate();
  }
};

const offlineItem = async () => {
  if (!item.value) return;
  await itemStore.offline(item.value.id);
};
</script>
